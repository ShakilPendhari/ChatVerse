const FrameParser = require('./frameParser');
const FrameBuilder = require('./frameBuilder');
const config = require('../config');

class WebSocketServer {
  constructor(authenticator, connectionManager, messageService, groupService, readReceiptService, presenceRegistry) {
    this.authenticator = authenticator;
    this.connectionManager = connectionManager;
    this.messageService = messageService;
    this.groupService = groupService;
    this.readReceiptService = readReceiptService;
    this.presenceRegistry = presenceRegistry;

    this.heartbeatInterval = null;
  }

  init() {
    this.startHeartbeat();
  }

  async handleUpgrade(req, socket, head) {
    try {
      const user = await this.authenticator.authenticateUpgrade(req);
      const conn = this.connectionManager.addConnection(user.userId, socket);

      if (this.presenceRegistry) {
        await this.presenceRegistry.registerConnection(user.userId);
      }

      console.log(`[WS] Connection established: ConnID=${conn.connectionId}, UserID=${user.userId}`);

      const parser = new FrameParser();

      socket.on('data', (chunk) => parser.addChunk(chunk));

      parser.on('frame', (frame) => this.handleFrame(conn, frame));

      parser.on('error', (err) => {
        console.error(`[WS] Frame parsing error for ${conn.connectionId}:`, err.message);
        this.closeConnection(socket, 1002, 'Protocol Error');
      });

      socket.on('close', () => this.handleDisconnect(socket));
      socket.on('error', (err) => {
        console.error(`[WS] Socket error on ${conn.connectionId}:`, err.message);
        this.handleDisconnect(socket);
      });

      // Send connection acknowledgement frame
      socket.write(FrameBuilder.buildTextFrame({
        type: 'connection.ack',
        data: { connectionId: conn.connectionId, userId: user.userId }
      }));

    } catch (err) {
      console.error('[WS] Upgrade authentication failed:', err.message);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  }

  async handleFrame(conn, frame) {
    const { opcode, payload } = frame;

    // Ping Frame
    if (opcode === 0x9) {
      conn.socket.write(FrameBuilder.buildPongFrame(payload));
      return;
    }

    // Pong Frame
    if (opcode === 0xa) {
      conn.lastPong = Date.now();
      return;
    }

    // Close Frame
    if (opcode === 0x8) {
      this.closeConnection(conn.socket, 1000, 'Client closed connection');
      return;
    }

    // Text Frame
    if (opcode === 0x1) {
      try {
        const json = JSON.parse(payload.toString('utf-8'));
        await this.dispatchClientMessage(conn, json);
      } catch (err) {
        console.error(`[WS] Invalid message JSON from ${conn.connectionId}:`, err.message);
        conn.socket.write(FrameBuilder.buildTextFrame({
          type: 'error',
          error: err.message
        }));
      }
    }
  }

  async dispatchClientMessage(conn, msg) {
    const { action, data } = msg;

    switch (action) {
      case 'send_private_message':
        await this.messageService.sendPrivateMessage(
          conn.userId,
          conn.connectionId,
          data.recipientId,
          data.content
        );
        break;

      case 'send_group_message':
        await this.groupService.sendGroupMessage(
          conn.userId,
          conn.connectionId,
          data.groupId,
          data.content
        );
        break;

      case 'mark_read':
        await this.readReceiptService.processReadReceipt(
          conn.userId,
          data.messageId
        );
        break;

      default:
        throw new Error(`Unknown action type: ${action}`);
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const connections = this.connectionManager.getAllConnections();

      for (const conn of connections) {
        if (now - conn.lastPong > config.HEARTBEAT_TIMEOUT_MS) {
          console.warn(`[WS] Connection ${conn.connectionId} timed out. Terminating.`);
          this.closeConnection(conn.socket, 1006, 'Heartbeat Timeout');
        } else {
          try {
            conn.socket.write(FrameBuilder.buildPingFrame());
          } catch (e) {
            this.closeConnection(conn.socket, 1006, 'Write Error');
          }
        }
      }
    }, config.HEARTBEAT_INTERVAL_MS);
  }

  async handleDisconnect(socket) {
    const removed = this.connectionManager.removeConnection(socket);
    if (removed) {
      console.log(`[WS] Connection closed: ConnID=${removed.connectionId}, UserID=${removed.userId}`);
      if (this.presenceRegistry) {
        await this.presenceRegistry.unregisterConnection(removed.userId);
      }
    }
  }

  closeConnection(socket, code = 1000, reason = '') {
    try {
      socket.write(FrameBuilder.buildCloseFrame(code, reason));
    } catch (e) {
      // Ignore write errors on closing sockets
    } finally {
      socket.destroy();
    }
  }

  stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }
}

module.exports = WebSocketServer;
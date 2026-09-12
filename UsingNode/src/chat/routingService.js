// src/chat/routingService.js
const FrameBuilder = require('../websocket/frameBuilder');

class RoutingService {
  constructor(connectionManager) {
    this.connectionManager = connectionManager;
  }

  deliverToLocalUser(userId, payload, excludeConnectionId = null) {
    const connections = this.connectionManager.getConnections(userId);
    let deliveredCount = 0;

    for (const conn of connections) {
      if (excludeConnectionId && conn.connectionId === excludeConnectionId) {
        continue;
      }

      try {
        const frame = FrameBuilder.buildTextFrame(payload);
        conn.socket.write(frame);
        deliveredCount++;
      } catch (err) {
        console.error(`[RoutingService] Delivery failed to conn ${conn.connectionId}:`, err.message);
      }
    }

    return deliveredCount;
  }
}

module.exports = RoutingService;
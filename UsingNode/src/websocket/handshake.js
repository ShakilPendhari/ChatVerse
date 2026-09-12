const crypto = require('crypto');
const config = require('../config');

class HandshakeHandler {
  static generateAcceptKey(secWebSocketKey) {
    return crypto
      .createHash('sha1')
      .update(secWebSocketKey + config.WS_MAGIC_STRING)
      .digest('base64');
  }

  static verifyHeaders(req) {
    const headers = req.headers;
    if (!headers.upgrade || headers.upgrade.toLowerCase() !== 'websocket') {
      return false;
    }
    if (!headers.connection || !headers.connection.toLowerCase().includes('upgrade')) {
      return false;
    }
    if (!headers['sec-websocket-key'] || headers['sec-websocket-version'] !== '13') {
      return false;
    }
    return true;
  }

  static performHandshake(req, socket) {
    if (!this.verifyHeaders(req)) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return false;
    }

    const clientKey = req.headers['sec-websocket-key'];
    const acceptKey = this.generateAcceptKey(clientKey);

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n'
    ];

    socket.write(responseHeaders.join('\r\n'));
    return true;
  }
}

module.exports = HandshakeHandler;
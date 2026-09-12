const http = require('http');
const HandshakeHandler = require('../websocket/handshake');

function createHttpServer(onUpgradeCallback) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket Node Server Active');
  });

  server.on('upgrade', (req, socket, head) => {
    if (!HandshakeHandler.performHandshake(req, socket)) {
      return;
    }
    onUpgradeCallback(req, socket, head);
  });

  return server;
}

module.exports = createHttpServer;
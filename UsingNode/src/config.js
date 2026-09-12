module.exports = {
  NODE_ID: process.env.NODE_ID || 'node-1',
  PORT: parseInt(process.env.PORT || '8000', 10),
  MAX_FRAME_SIZE: 1024 * 1024, // 1MB
  WS_MAGIC_STRING: '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
  HEARTBEAT_INTERVAL_MS: 15000,
  HEARTBEAT_TIMEOUT_MS: 30000,
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
};
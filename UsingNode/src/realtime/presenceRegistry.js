// src/realtime/presenceRegistry.js
class PresenceRegistry {
  constructor(redisClient, nodeId) {
    this.redisClient = redisClient;
    this.nodeId = nodeId;
  }

  async registerConnection(userId) {
    this.redisClient.sendCommand(['HINCRBY', `presence:${userId}`, this.nodeId, 1]);
  }

  async unregisterConnection(userId) {
    this.redisClient.sendCommand(['HINCRBY', `presence:${userId}`, this.nodeId, -1]);
  }

  async clearNodePresence() {
    // Used during graceful shutdown
    console.log(`[PresenceRegistry] Clearing presence registrations for ${this.nodeId}`);
  }
}

module.exports = PresenceRegistry;
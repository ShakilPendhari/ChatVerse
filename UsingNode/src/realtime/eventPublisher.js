// src/realtime/eventPublisher.js
class EventPublisher {
  constructor(redisClient, nodeId) {
    this.redisClient = redisClient;
    this.nodeId = nodeId;
    this.channel = 'chat:events';
  }

  async publish(type, data) {
    const event = {
      eventId: require('crypto').randomUUID(),
      nodeId: this.nodeId,
      type,
      data,
      publishedAt: new Date().toISOString()
    };

    this.redisClient.sendCommand(['PUBLISH', this.channel, JSON.stringify(event)]);
  }
}

module.exports = EventPublisher;
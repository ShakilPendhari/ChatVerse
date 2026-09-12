// src/realtime/eventSubscriber.js
class EventSubscriber {
  constructor(redisClient, nodeId, routingService) {
    this.redisClient = redisClient;
    this.nodeId = nodeId;
    this.routingService = routingService;
    this.channel = 'chat:events';
  }

  subscribe() {
    this.redisClient.sendCommand(['SUBSCRIBE', this.channel]);
    this.redisClient.on('message', ({ channel, payload }) => {
      if (channel !== this.channel) return;
      try {
        const event = JSON.parse(payload);
        // Ignore events originating from this node instance
        if (event.nodeId === this.nodeId) return;

        this.handleClusterEvent(event);
      } catch (err) {
        console.error('[EventSubscriber] Malformed event received:', err.message);
      }
    });
  }

  handleClusterEvent(event) {
    const { type, data } = event;

    switch (type) {
      case 'message.created': {
        const { message, recipientId, senderId, originatingConnectionId } = data;
        // Deliver to target user if present on this node
        this.routingService.deliverToLocalUser(recipientId, {
          type: 'message.created',
          data: message
        });
        // Sync sender connections if present on this node
        this.routingService.deliverToLocalUser(senderId, {
          type: 'message.sync',
          data: message
        }, originatingConnectionId);
        break;
      }

      case 'group.message.created': {
        const { message, members, senderId, originatingConnectionId } = data;
        for (const memberId of members) {
          if (memberId === senderId) {
            this.routingService.deliverToLocalUser(senderId, {
              type: 'message.sync',
              data: message
            }, originatingConnectionId);
          } else {
            this.routingService.deliverToLocalUser(memberId, {
              type: 'group.message.created',
              data: message
            });
          }
        }
        break;
      }

      case 'message.read': {
        const { messageId, userId } = data;
        this.routingService.deliverToLocalUser(userId, {
          type: 'message.read.sync',
          data: { messageId, userId }
        });
        break;
      }
    }
  }
}

module.exports = EventSubscriber;
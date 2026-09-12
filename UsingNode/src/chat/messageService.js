// src/chat/messageService.js
const crypto = require('crypto');

class MessageService {
  constructor(messageRepository, routingService, authorizationService, eventPublisher) {
    this.messageRepository = messageRepository;
    this.routingService = routingService;
    this.authorizationService = authorizationService;
    this.eventPublisher = eventPublisher;
  }

  async sendPrivateMessage(senderId, originatingConnectionId, recipientId, content) {
    await this.authorizationService.canSendPrivateMessage(senderId, recipientId);

    const message = await this.messageRepository.saveMessage({
      messageId: crypto.randomUUID(),
      senderId,
      recipientId,
      groupId: null,
      content,
      createdAt: new Date().toISOString()
    });

    const payload = {
      type: 'message.created',
      data: message
    };

    // 1. Deliver to local active recipient connections
    const localDelivered = this.routingService.deliverToLocalUser(recipientId, payload);

    // 2. Sync sender's OTHER devices on local node
    this.routingService.deliverToLocalUser(senderId, {
      type: 'message.sync',
      data: message
    }, originatingConnectionId);

    // 3. Publish to Redis for multi-node broadcast
    if (this.eventPublisher) {
      await this.eventPublisher.publish('message.created', {
        message,
        originatingConnectionId,
        senderId,
        recipientId
      });
    }

    return { message, localDelivered };
  }
}

module.exports = MessageService;
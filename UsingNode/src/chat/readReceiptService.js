// src/chat/readReceiptService.js
class ReadReceiptService {
  constructor(messageRepository, routingService, eventPublisher) {
    this.messageRepository = messageRepository;
    this.routingService = routingService;
    this.eventPublisher = eventPublisher;
  }

  async processReadReceipt(userId, messageId) {
    const receipt = await this.messageRepository.markAsRead(messageId, userId);

    const payload = {
      type: 'message.read.sync',
      data: receipt
    };

    // Notify all active sessions of this user across local connections
    this.routingService.deliverToLocalUser(userId, payload);

    // Notify other cluster nodes
    if (this.eventPublisher) {
      await this.eventPublisher.publish('message.read', receipt);
    }

    return receipt;
  }
}

module.exports = ReadReceiptService;
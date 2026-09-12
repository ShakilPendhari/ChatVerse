// src/chat/groupService.js
const crypto = require('crypto');

class GroupService {
  constructor(groupRepository, messageRepository, routingService, authorizationService, eventPublisher) {
    this.groupRepository = groupRepository;
    this.messageRepository = messageRepository;
    this.routingService = routingService;
    this.authorizationService = authorizationService;
    this.eventPublisher = eventPublisher;
  }

  async sendGroupMessage(senderId, originatingConnectionId, groupId, content) {
    // 1. Authorize membership against authoritative storage
    await this.authorizationService.canAccessGroup(senderId, groupId);

    // 2. Persist message state
    const message = await this.messageRepository.saveMessage({
      messageId: crypto.randomUUID(),
      senderId,
      recipientId: null,
      groupId,
      content,
      createdAt: new Date().toISOString()
    });

    // 3. Resolve members dynamically at execution time
    const members = await this.groupRepository.getMembers(groupId);

    const payload = {
      type: 'group.message.created',
      data: message
    };

    // 4. Deliver locally to online members
    for (const memberId of members) {
      if (memberId === senderId) {
        // Sync sender's OTHER connections on the same node
        this.routingService.deliverToLocalUser(senderId, {
          type: 'message.sync',
          data: message
        }, originatingConnectionId);
      } else {
        this.routingService.deliverToLocalUser(memberId, payload);
      }
    }

    // 5. Publish to cluster pub/sub
    if (this.eventPublisher) {
      await this.eventPublisher.publish('group.message.created', {
        message,
        members,
        originatingConnectionId,
        senderId
      });
    }

    return message;
  }
}

module.exports = GroupService;
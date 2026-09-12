// src/auth/authorization.js
class AuthorizationService {
  constructor(groupRepository) {
    this.groupRepository = groupRepository;
  }

  async canAccessGroup(userId, groupId) {
    const isMember = await this.groupRepository.isMember(groupId, userId);
    if (!isMember) {
      throw new Error(`FORBIDDEN: User ${userId} is not a member of group ${groupId}`);
    }
    return true;
  }

  async canSendPrivateMessage(senderId, recipientId) {
    if (senderId === recipientId) {
      throw new Error('INVALID_ACTION: Self-messaging is prohibited');
    }
    return true;
  }
}

module.exports = AuthorizationService;
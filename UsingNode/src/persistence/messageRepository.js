// src/persistence/messageRepository.js
class MessageRepository {
  constructor() {
    this.messages = new Map();
    this.reads = new Map(); // messageId -> Set<userId>
  }

  async saveMessage(message) {
    this.messages.set(message.messageId, {
      ...message,
      status: 'STORED'
    });
    return this.messages.get(message.messageId);
  }

  async getMessage(messageId) {
    return this.messages.get(messageId) || null;
  }

  async markAsRead(messageId, userId) {
    if (!this.reads.has(messageId)) {
      this.reads.set(messageId, new Set());
    }
    this.reads.get(messageId).add(userId);

    const msg = this.messages.get(messageId);
    if (msg) {
      msg.status = 'READ';
    }
    return { messageId, userId, readAt: new Date().toISOString() };
  }

  async getUnreadForUser(userId) {
    const unread = [];
    for (const msg of this.messages.values()) {
      if (msg.recipientId === userId) {
        const readSet = this.reads.get(msg.messageId);
        if (!readSet || !readSet.has(userId)) {
          unread.push(msg);
        }
      }
    }
    return unread;
  }
}

module.exports = MessageRepository;
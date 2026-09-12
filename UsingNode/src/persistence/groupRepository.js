// src/persistence/groupRepository.js
class GroupRepository {
  constructor() {
    this.groups = new Map([
      ['G10', { groupId: 'G10', name: 'Engineering' }]
    ]);
    // groupId -> Set<userId>
    this.memberships = new Map([
      ['G10', new Set(['U100', 'U200', 'U300'])]
    ]);
  }

  async findById(groupId) {
    return this.groups.get(groupId) || null;
  }

  async isMember(groupId, userId) {
    const members = this.memberships.get(groupId);
    return members ? members.has(userId) : false;
  }

  async getMembers(groupId) {
    const members = this.memberships.get(groupId);
    return members ? Array.from(members) : [];
  }

  async addMember(groupId, userId) {
    if (!this.memberships.has(groupId)) {
      this.memberships.set(groupId, new Set());
    }
    this.memberships.get(groupId).add(userId);
  }
}

module.exports = GroupRepository;
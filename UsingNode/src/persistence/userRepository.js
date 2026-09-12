// src/persistence/userRepository.js
class UserRepository {
  constructor() {
    this.users = new Map([
      ['U100', { userId: 'U100', name: 'Alice' }],
      ['U200', { userId: 'U200', name: 'Bob' }],
      ['U300', { userId: 'U300', name: 'Charlie' }]
    ]);
  }

  async findById(userId) {
    return this.users.get(userId) || null;
  }

  async save(user) {
    this.users.set(user.userId, user);
    return user;
  }
}

module.exports = UserRepository;
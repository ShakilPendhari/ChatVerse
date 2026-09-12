// src/server/connectionManager.js
const crypto = require('crypto');

class ConnectionManager {
  constructor() {
    // Map<UserId, Set<ConnectionRecord>>
    this.userToConnections = new Map();
    // Map<ConnectionId, ConnectionRecord>
    this.connections = new Map();
    // WeakMap<Socket, ConnectionRecord>
    this.socketMap = new WeakMap();
  }

  addConnection(userId, socket) {
    const connectionId = crypto.randomUUID();
    const record = {
      connectionId,
      userId,
      socket,
      connectedAt: new Date(),
      lastPong: Date.now()
    };

    this.connections.set(connectionId, record);
    this.socketMap.set(socket, record);

    if (!this.userToConnections.has(userId)) {
      this.userToConnections.set(userId, new Set());
    }
    this.userToConnections.get(userId).add(record);

    return record;
  }

  removeConnection(socket) {
    const record = this.socketMap.get(socket);
    if (!record) return null;

    const { userId, connectionId } = record;
    this.connections.delete(connectionId);

    const userSet = this.userToConnections.get(userId);
    if (userSet) {
      userSet.delete(record);
      if (userSet.size === 0) {
        this.userToConnections.delete(userId);
      }
    }

    return record;
  }

  getConnections(userId) {
    const set = this.userToConnections.get(userId);
    return set ? Array.from(set) : [];
  }

  getConnectionBySocket(socket) {
    return this.socketMap.get(socket) || null;
  }

  hasConnections(userId) {
    return this.userToConnections.has(userId) && this.userToConnections.get(userId).size > 0;
  }

  getUserId(socket) {
    const record = this.socketMap.get(socket);
    return record ? record.userId : null;
  }

  getOnlineUsers() {
    return Array.from(this.userToConnections.keys());
  }

  getAllConnections() {
    return Array.from(this.connections.values());
  }
}

module.exports = ConnectionManager;
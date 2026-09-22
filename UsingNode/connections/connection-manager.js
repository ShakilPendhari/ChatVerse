class ConnectionManager {

    constructor() {
        this.activeSockets = new Map()
    }

    connect(userId, socket) {
        if (!this.activeSockets.has(userId)) {
            this.activeSockets.set(userId, new Set());
        }

        const socketSet = this.activeSockets.get(userId);

        socketSet.add(socket);
    }

    disconnect(userId, socket) {
        const socketSet = this.activeSockets.get(userId);

        if (!socketSet) {
            console.log("No such user available");
            return;
        }

        socketSet.delete(socket);

        if (socketSet.size === 0) {
            this.activeSockets.delete(userId);
        }
    }

    getConnections(userId) {
        // Return user's sockets
        const socketSet = this.activeSockets.get(userId);
        return socketSet || new Set()
    }

    sendToUser(userId, data) {
        // Send data to every socket of user
    }

    isOnline(userId) {
        // Check whether user has at least one socket
    }
}

const manager = new ConnectionManager();

const socketA = {};
const socketB = {};
const socketC = {};

manager.connect("user_101", socketA);
manager.connect("user_101", socketB);
manager.connect("user_202", socketC);

console.log(manager.activeSockets);

manager.disconnect("user_101", socketA);
console.log(manager.activeSockets);

manager.disconnect("user_101", socketB);
console.log(manager.activeSockets);

manager.disconnect("user_999", socketA)

module.exports = ConnectionManager;
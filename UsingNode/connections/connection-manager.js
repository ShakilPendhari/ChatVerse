class ConnectionManager {

    connect(userId, socket) {
        // Add socket
    }

    disconnect(userId, socket) {
        // Remove socket
    }

    getConnections(userId) {
        // Return user's sockets
    }

    sendToUser(userId, data) {
        // Send data to every socket of user
    }

    isOnline(userId) {
        // Check whether user has at least one socket
    }
}

module.exports = ConnectionManager;
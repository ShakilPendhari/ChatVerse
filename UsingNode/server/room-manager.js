/**
 * @file room-manager.js
 * @description State tracking for group chat channels and message broadcasting.
 */

const { sendJSON } = require("./frame-parser");

// Map<roomName, Set<WebSocketSocket>>
const rooms = new Map();

/**
 * Main JSON message router.
 */
function handleClientMessage(socket, data, connectionsMap) {
    const meta = connectionsMap.get(socket);
    if (!meta) return;

    switch (data.type) {
        case "PING":
            sendJSON(socket, { type: "PONG", timestamp: Date.now() });
            break;

        case "JOIN_ROOM":
            handleJoinRoom(socket, meta, data, connectionsMap);
            break;

        case "CHAT_MESSAGE":
            handleChatMessage(meta, data);
            break;
    }
}

/**
 * Handles group chat join operations.
 */
function handleJoinRoom(socket, meta, data, connectionsMap) {
    const { username, room } = data;
    if (!username || !room) return;

    // Leave current room if switching
    if (meta.room && rooms.has(meta.room)) {
        rooms.get(meta.room).delete(socket);
        broadcastToRoom(meta.room, {
            type: "USER_LEFT",
            username: meta.username,
            activeUsers: getActiveUsers(meta.room, connectionsMap)
        });
    }

    meta.username = username;
    meta.room = room;

    if (!rooms.has(room)) {
        rooms.set(room, new Set());
    }
    rooms.get(room).add(socket);

    broadcastToRoom(room, {
        type: "USER_JOINED",
        username: username,
        activeUsers: getActiveUsers(room, connectionsMap)
    });
}

/**
 * Broadcasts group text message to room members.
 */
function handleChatMessage(meta, data) {
    if (!meta.room || !rooms.has(meta.room)) return;

    broadcastToRoom(meta.room, {
        type: "CHAT_MESSAGE",
        room: meta.room,
        sender: meta.username,
        message: data.message,
        timestamp: Date.now()
    });
}

/**
 * Broadcasts JSON payload to all sockets in a specified channel.
 */
function broadcastToRoom(roomName, payload) {
    const roomSockets = rooms.get(roomName);
    if (!roomSockets) return;

    for (const clientSocket of roomSockets) {
        sendJSON(clientSocket, payload);
    }
}

/**
 * Returns active user list array for channel.
 */
function getActiveUsers(roomName, connectionsMap) {
    const roomSockets = rooms.get(roomName);
    if (!roomSockets) return [];

    const users = [];
    for (const socket of roomSockets) {
        const meta = connectionsMap.get(socket);
        if (meta && meta.username) users.push(meta.username);
    }
    return users;
}

/**
 * Cleans up socket memory references on disconnect.
 */
function handleDisconnect(socket, connectionsMap) {
    const meta = connectionsMap.get(socket);
    if (!meta) return;

    const { room, username } = meta;

    if (room && rooms.has(room)) {
        rooms.get(room).delete(socket);
        if (rooms.get(room).size === 0) {
            rooms.delete(room);
        } else {
            broadcastToRoom(room, {
                type: "USER_LEFT",
                username: username,
                activeUsers: getActiveUsers(room, connectionsMap)
            });
        }
    }

    connectionsMap.delete(socket);
}

module.exports = {
    handleClientMessage,
    handleDisconnect
};
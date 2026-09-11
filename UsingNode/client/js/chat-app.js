/**
 * @file chat-app.js
 * @description Frontend Application Controller for managing DOM & User Interactions.
 */

import { RobustWebSocket } from "./websocket-client.js";

class ChatApplication {
    constructor() {
        this.currentUser = null;
        this.currentRoom = "general";
        this.socket = null;

        this.elements = {
            usernameInput: document.getElementById("usernameInput"),
            messageInput: document.getElementById("messageInput"),
            joinButton: document.getElementById("joinButton"),
            sendButton: document.getElementById("sendButton"),
            chatWindow: document.getElementById("chatWindow"),
            connectionStatus: document.getElementById("connectionStatus"),
            userList: document.getElementById("userList")
        };

        this._initListeners();
    }

    _initListeners() {
        this.elements.joinButton.addEventListener("click", () => this.handleJoinRoom());
        this.elements.sendButton.addEventListener("click", () => this.handleSendMessage());
        this.elements.messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") this.handleSendMessage();
        });
    }

    initializeSocket() {
        const socketUrl = `ws://${window.location.hostname}:8000`;
        this.socket = new RobustWebSocket(socketUrl);

        this.socket.on("open", () => {
            this.updateStatus("Connected", "status-connected");
            if (this.currentUser) this._sendJoinFrame();
        });

        this.socket.on("message", (payload) => this.handleIncomingPayload(payload));
        this.socket.on("close", () => this.updateStatus("Disconnected", "status-disconnected"));
        this.socket.on("error", () => this.updateStatus("Error", "status-error"));

        this.socket.connect();
    }

    handleJoinRoom() {
        const username = this.elements.usernameInput.value.trim();
        if (!username) return;

        this.currentUser = username;
        if (!this.socket) {
            this.initializeSocket();
        } else {
            this._sendJoinFrame();
        }

        this.elements.usernameInput.disabled = true;
        this.elements.joinButton.disabled = true;
    }

    _sendJoinFrame() {
        this.socket.send({
            type: "JOIN_ROOM",
            username: this.currentUser,
            room: this.currentRoom
        });
    }

    handleSendMessage() {
        const text = this.elements.messageInput.value.trim();
        if (!text || !this.currentUser) return;

        const sent = this.socket.send({
            type: "CHAT_MESSAGE",
            message: text
        });

        if (sent) {
            this.elements.messageInput.value = "";
        }
    }

    handleIncomingPayload(payload) {
        switch (payload.type) {
            case "CHAT_MESSAGE":
                this.renderChatMessage(payload);
                break;
            case "USER_JOINED":
                this.renderNotification(`${payload.username} joined.`);
                this.updateUserList(payload.activeUsers);
                break;
            case "USER_LEFT":
                this.renderNotification(`${payload.username} left.`);
                this.updateUserList(payload.activeUsers);
                break;
        }
    }

    renderChatMessage(data) {
        const msgDiv = document.createElement("div");
        const isSelf = data.sender === this.currentUser;
        msgDiv.className = `message ${isSelf ? "self" : "peer"}`;
        msgDiv.textContent = `${data.sender}: ${data.message}`;
        this.elements.chatWindow.appendChild(msgDiv);
        this.elements.chatWindow.scrollTop = this.elements.chatWindow.scrollHeight;
    }

    renderNotification(text) {
        const note = document.createElement("div");
        note.className = "notification";
        note.textContent = text;
        this.elements.chatWindow.appendChild(note);
    }

    updateUserList(users) {
        if (!users) return;
        this.elements.userList.innerHTML = "";
        users.forEach(u => {
            const li = document.createElement("li");
            li.textContent = u;
            this.elements.userList.appendChild(li);
        });
    }

    updateStatus(text, className) {
        this.elements.connectionStatus.textContent = text;
        this.elements.connectionStatus.className = `status ${className}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.chatApp = new ChatApplication();
});
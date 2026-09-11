/**
 * @file websocket-client.js
 * @description Production Web API WebSocket wrapper with reconnect policies and heartbeats.
 */

export class RobustWebSocket {
    constructor(url, options = {}) {
        this.url = url;
        this.pingIntervalMs = options.pingInterval || 30000;
        this.pongTimeoutMs = options.pongTimeout || 10000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.baseReconnectDelay = options.baseReconnectDelay || 1000;
        
        this.reconnectAttempts = 0;
        this.isExplicitDisconnect = false;
        this.ws = null;
        this.pingTimer = null;
        this.pongTimer = null;

        this.listeners = { open: [], close: [], error: [], message: [] };
    }

    connect() {
        this.isExplicitDisconnect = false;
        try {
            this.ws = new WebSocket(this.url);
            this.ws.onopen = this._handleOpen.bind(this);
            this.ws.onmessage = this._handleMessage.bind(this);
            this.ws.onerror = this._handleError.bind(this);
            this.ws.onclose = this._handleClose.bind(this);
        } catch (err) {
            this._handleError(err);
        }
    }

    _handleOpen(event) {
        this.reconnectAttempts = 0;
        this._startHeartbeat();
        this._emit("open", event);
    }

    _handleMessage(event) {
        this._resetPongTimeout();
        try {
            const data = JSON.parse(event.data);
            if (data.type === "PONG") return;
            this._emit("message", data);
        } catch (err) {
            console.error("[WS Client] Error parsing payload:", err);
        }
    }

    _handleError(event) {
        this._emit("error", event);
    }

    _handleClose(event) {
        this._stopHeartbeat();
        this._emit("close", event);
        if (!this.isExplicitDisconnect) {
            this._attemptReconnection();
        }
    }

    send(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
        try {
            this.ws.send(JSON.stringify(data));
            return true;
        } catch (err) {
            return false;
        }
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this.pingTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: "PING", timestamp: Date.now() }));
                this.pongTimer = setTimeout(() => {
                    this.ws.close(4000, "Heartbeat Timeout");
                }, this.pongTimeoutMs);
            }
        }, this.pingIntervalMs);
    }

    _resetPongTimeout() {
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
    }

    _stopHeartbeat() {
        if (this.pingTimer) clearInterval(this.pingTimer);
        if (this.pongTimer) clearTimeout(this.pongTimer);
        this.pingTimer = null;
        this.pongTimer = null;
    }

    _attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
        this.reconnectAttempts++;
        const exponentialDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
        const delay = Math.max(0, Math.floor(exponentialDelay + jitter));

        setTimeout(() => this.connect(), delay);
    }

    on(event, callback) {
        if (this.listeners[event]) this.listeners[event].push(callback);
    }

    _emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}
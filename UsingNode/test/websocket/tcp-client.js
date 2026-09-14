const net = require("net");
const crypto = require("crypto");

const {
    parseFrames,
} = require("./frame-parser");

class WebSocketTestClient {
    constructor({
        host = "127.0.0.1",
        port = 8000,
        path = "/",
    } = {}) {
        this.host = host;
        this.port = port;
        this.path = path;

        this.socket = null;

        this.buffer = Buffer.alloc(0);

        this.handshakeComplete = false;

        this.handshakeBuffer = Buffer.alloc(0);

        this.pendingFrames = [];

        this.frameWaiters = [];

        this.closeReceived = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.socket = net.createConnection(
                {
                    host: this.host,
                    port: this.port,
                },
                () => {
                    this.sendHandshake();
                }
            );

            this.socket.on(
                "data",
                (chunk) => {
                    this.handleData(chunk);
                }
            );

            this.socket.on(
                "error",
                (error) => {
                    if (!this.handshakeComplete) {
                        reject(error);
                    }

                    this.rejectFrameWaiters(
                        error
                    );
                }
            );

            this.socket.on(
                "close",
                () => {
                    this.closeReceived = true;
                }
            );

            this.onceConnected = resolve;
        });
    }

    sendHandshake() {
        this.secWebSocketKey =
            crypto
                .randomBytes(16)
                .toString("base64");

        const request =
            `GET ${this.path} HTTP/1.1\r\n` +
            `Host: ${this.host}:${this.port}\r\n` +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            `Sec-WebSocket-Key: ${this.secWebSocketKey}\r\n` +
            "Sec-WebSocket-Version: 13\r\n" +
            "\r\n";

        this.socket.write(request);
    }

    handleData(chunk) {
        if (!this.handshakeComplete) {
            this.handshakeBuffer =
                Buffer.concat([
                    this.handshakeBuffer,
                    chunk,
                ]);

            const headerEnd =
                this.handshakeBuffer.indexOf(
                    "\r\n\r\n"
                );

            if (headerEnd === -1) {
                return;
            }

            const headerEndOffset =
                headerEnd + 4;

            const response =
                this.handshakeBuffer
                    .subarray(
                        0,
                        headerEndOffset
                    )
                    .toString("utf8");

            if (
                !response.startsWith(
                    "HTTP/1.1 101"
                )
            ) {
                throw new Error(
                    "WebSocket handshake failed"
                );
            }

            this.handshakeComplete = true;

            this.onceConnected();

            const remaining =
                this.handshakeBuffer.subarray(
                    headerEndOffset
                );

            this.handshakeBuffer =
                Buffer.alloc(0);

            if (remaining.length > 0) {
                this.processFrames(
                    remaining
                );
            }

            return;
        }

        this.processFrames(chunk);
    }

    processFrames(chunk) {
        this.buffer = Buffer.concat([
            this.buffer,
            chunk,
        ]);

        const state = {
            buffer: this.buffer,
        };

        const frames =
            parseFrames(state);

        this.buffer =
            state.buffer;

        for (const frame of frames) {
            this.handleFrame(frame);
        }
    }

    handleFrame(frame) {
        if (this.frameWaiters.length > 0) {
            const waiter =
                this.frameWaiters.shift();

            waiter.resolve(frame);
            return;
        }

        this.pendingFrames.push(frame);
    }

    waitForFrame(timeout = 2000) {
        if (this.pendingFrames.length > 0) {
            return Promise.resolve(
                this.pendingFrames.shift()
            );
        }

        return new Promise(
            (resolve, reject) => {
                const timer =
                    setTimeout(() => {
                        reject(
                            new Error(
                                "Timed out waiting for WebSocket frame"
                            )
                        );
                    }, timeout);

                this.frameWaiters.push({
                    resolve: (frame) => {
                        clearTimeout(timer);
                        resolve(frame);
                    },

                    reject: (error) => {
                        clearTimeout(timer);
                        reject(error);
                    },
                });
            }
        );
    }

    sendFrame(frame) {
        this.socket.write(frame);
    }

    close() {
        if (this.socket) {
            this.socket.destroy();
        }
    }

    rejectFrameWaiters(error) {
        for (
            const waiter
            of this.frameWaiters
        ) {
            waiter.reject(error);
        }

        this.frameWaiters = [];
    }
}

module.exports = {
    WebSocketTestClient,
};
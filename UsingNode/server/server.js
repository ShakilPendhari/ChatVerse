/**
 * @file server.js
 * @description Main application server entrypoint. Runs an HTTP file server and 
 * manages RFC 6455 WebSocket handshakes.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { attachFrameParser } = require("./frame-parser");
const { handleDisconnect, handleClientMessage } = require("./room-manager");
const console = require("console");

const PORT = process.env.PORT || 8000;
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"; // Standard RFC 6455 key constant

// Active Connections Map: Map<socket, { username: string, room: string, isAlive: boolean }>
const connections = new Map();

// Supported Web MIME Types for Static File Server
const MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json"
};

// ============================================================================
// 1. HTTP STATIC FILE SERVER
// ============================================================================
const server = http.createServer((req, res) => {
    if (req.method !== "GET") {
        res.writeHead(405, { "Content-Type": "text/plain" });
        return res.end("Method Not Allowed");
    }

    // 1. Strip leading path-traversal sequences
    let cleanUrl = req.url.replace(/^(\.\.[\/\\])+/, "");

    // 2. Default root requests to index.html BEFORE normalizing
    if (cleanUrl === "/" || cleanUrl === "") {
        cleanUrl = "/index.html";
    }

    // Path maps to root client directory
    const filePath = path.join(__dirname, "..", "client", cleanUrl);
    console.log(filePath)
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === "ENOENT") {
                res.writeHead(404, { "Content-Type": "text/html" });
                res.end("<h1>404 Not Found</h1>");
            } else {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { "Content-Type": contentType });
            res.end(content, "utf-8");
        }
    });
});

// ============================================================================
// 2. WEBSOCKET UPGRADE HANDLER
// ============================================================================
server.on("upgrade", (req, socket, head) => {
    const secWebSocketKey = req.headers["sec-websocket-key"];

    // Return HTTP 400 Bad Request if mandatory key header is missing
    if (!secWebSocketKey) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
    }

    // SHA-1 hash computation of Key + RFC 6455 GUID encoded in Base64
    const acceptKey = crypto
        .createHash("sha1")
        .update(secWebSocketKey.trim() + WS_GUID)
        .digest("base64");

    const handshakeResponse = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${acceptKey}`,
        "",
        ""
    ].join("\r\n");

    socket.write(handshakeResponse);

    // Track state metadata for new connection
    connections.set(socket, { username: null, room: null, isAlive: true });

    // Attach stream parser for binary frame reading
    attachFrameParser(socket, connections, handleClientMessage, handleDisconnect);
});

// ============================================================================
// 3. SERVER HEARTBEAT MONITORING (TCP KEEP-ALIVE)
// ============================================================================
const HEARTBEAT_INTERVAL = 30000;
const interval = setInterval(() => {
    for (const [socket, meta] of connections.entries()) {
        if (!meta.isAlive) {
            console.log(`[Server] Terminating dead connection for user: ${meta.username || "Anonymous"}`);
            handleDisconnect(socket, connections);
            socket.destroy();
            continue;
        }

        meta.isAlive = false;
    }
}, HEARTBEAT_INTERVAL);

server.on("close", () => clearInterval(interval));

// ============================================================================
// 4. START SERVER
// ============================================================================
server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
});
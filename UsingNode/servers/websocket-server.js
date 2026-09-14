const { Buffer } = require("buffer");
const getWebSocketFrameAndParse = require("./../websocket/frame-parser.js")

const server = require("./http-server.js");
const { GUID } = require("../constants.js");
const handshake = require("../websocket/handshake.js");

// ==========================================
// WEBSOCKET UPGRADE HANDLER
// ==========================================

server.on("upgrade", (req, socket, head) => {
    console.log("WebSocket upgrade request received");

    handshake(req, socket)
    // ------------------------------------------
    // 4. Handle data coming from TCP stream
    // ------------------------------------------

    let accumulatedBuffer = Buffer.alloc(0);

    socket.on("data", (chunk) => {
        getWebSocketFrameAndParse(accumulatedBuffer, socket, chunk);
    });

    socket.on("end", () => {
        console.log("Client disconnected");
    });

    socket.on("error", (error) => {
        console.error(
            "WebSocket socket error:",
            error.message
        );
    });
});


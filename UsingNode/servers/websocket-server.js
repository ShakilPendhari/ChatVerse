const { Buffer } = require("buffer");

const getWebSocketFrameAndParse =
    require("../websocket/frame-parser.js");

const server = require("./http-server.js");
const handshake =
    require("../websocket/handshake.js");

// ==========================================
// WEBSOCKET UPGRADE HANDLER
// ==========================================

server.on("upgrade", (req, socket, head) => {
    console.log(
        "WebSocket upgrade request received"
    );

    handshake(req, socket);

    // ==========================================
    // CONNECTION STATE
    // ==========================================

    // TCP is a stream, so frames can be split
    // across multiple TCP chunks.
    let accumulatedBuffer = Buffer.alloc(0);

    // Stores an incomplete fragmented WebSocket
    // message until all continuation frames arrive.
    let fragmentedMessage = null;

    // ==========================================
    // TCP DATA
    // ==========================================

    socket.on("data", (chunk) => {
        const result =
            getWebSocketFrameAndParse(
                accumulatedBuffer,
                socket,
                chunk,
                fragmentedMessage
            );

        accumulatedBuffer =
            result.accumulatedBuffer;

        fragmentedMessage =
            result.fragmentedMessage;
    });

    // ==========================================
    // TCP END
    // ==========================================

    socket.on("end", () => {
        console.log(
            "Client disconnected"
        );
    });

    // ==========================================
    // SOCKET ERROR
    // ==========================================

    socket.on("error", (error) => {
        console.error(
            "WebSocket socket error:",
            error.message
        );
    });
});
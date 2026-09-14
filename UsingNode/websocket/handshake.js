const crypto = require("crypto");
const { GUID } = require("./../constants")

function handshake(req, socket) {
    // ------------------------------------------
    // 1. Validate WebSocket headers
    // ------------------------------------------

    const upgrade = req.headers["upgrade"];
    const connection = req.headers["connection"];
    const secWebSocketKey = req.headers["sec-websocket-key"];

    if (
        !upgrade ||
        upgrade.toLowerCase() !== "websocket" ||
        !connection ||
        !connection.toLowerCase().includes("upgrade") ||
        !secWebSocketKey
    ) {
        socket.write(
            "HTTP/1.1 400 Bad Request\r\n" +
            "Connection: close\r\n" +
            "\r\n"
        );

        socket.destroy();
        return;
    }

    // ------------------------------------------
    // 2. Calculate Sec-WebSocket-Accept
    // ------------------------------------------

    const acceptKey = crypto
        .createHash("sha1")
        .update(secWebSocketKey + GUID)
        .digest("base64");

    // ------------------------------------------
    // 3. Send HTTP 101 Switching Protocols
    // ------------------------------------------

    const acceptHeader = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${acceptKey}`,
        "",
        "",
    ].join("\r\n");

    socket.write(acceptHeader);

    console.log("WebSocket connection established");
}

module.exports = handshake
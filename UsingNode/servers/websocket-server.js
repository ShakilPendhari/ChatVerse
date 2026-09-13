const crypto = require("crypto");
const { Buffer } = require("buffer");

const server = require("./http-server.js");
const { GUID } = require("../constants.js");

// ==========================================
// WEBSOCKET UPGRADE HANDLER
// ==========================================

server.on("upgrade", (req, socket, head) => {
    console.log("WebSocket upgrade request received");

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

    // ------------------------------------------
    // 4. Handle data coming from TCP stream
    // ------------------------------------------

    let accumulatedBuffer = Buffer.alloc(0);

    socket.on("data", (chunk) => {
        // TCP is a stream.
        // One TCP chunk != one WebSocket frame.

        accumulatedBuffer = Buffer.concat([
            accumulatedBuffer,
            chunk,
        ]);

        // ------------------------------------------
        // Process all complete frames currently
        // available inside the buffer.
        // ------------------------------------------

        while (accumulatedBuffer.length >= 2) {
            const byte1 = accumulatedBuffer[0];
            const byte2 = accumulatedBuffer[1];

            // ------------------------------------------
            // Byte 1
            // ------------------------------------------

            const fin = (byte1 & 0x80) !== 0;
            const opcode = byte1 & 0x0f;

            // ------------------------------------------
            // Byte 2
            // ------------------------------------------

            const isMasked = (byte2 & 0x80) !== 0;
            const payloadLengthInfo = byte2 & 0x7f;

            // Client -> Server frames MUST be masked.
            if (!isMasked) {
                console.error(
                    "Client frame is not masked. Closing connection."
                );

                socket.destroy();
                return;
            }

            // ------------------------------------------
            // 5. Determine header size
            // ------------------------------------------

            let payloadLength;
            let maskingKeyOffset;
            let payloadOffset;

            if (payloadLengthInfo <= 125) {
                payloadLength = payloadLengthInfo;

                maskingKeyOffset = 2;
                payloadOffset = 6;
            } else if (payloadLengthInfo === 126) {
                // Need:
                // 2 bytes base header
                // 2 bytes extended length
                // 4 bytes masking key

                if (accumulatedBuffer.length < 8) {
                    break;
                }

                payloadLength =
                    accumulatedBuffer.readUInt16BE(2);

                maskingKeyOffset = 4;
                payloadOffset = 8;
            } else {
                // payloadLengthInfo === 127
                //
                // Need:
                // 2 bytes base header
                // 8 bytes extended length
                // 4 bytes masking key

                if (accumulatedBuffer.length < 14) {
                    break;
                }

                const payloadLengthBigInt =
                    accumulatedBuffer.readBigUInt64BE(2);

                // JavaScript Number can safely represent
                // integers only up to Number.MAX_SAFE_INTEGER.

                if (
                    payloadLengthBigInt >
                    BigInt(Number.MAX_SAFE_INTEGER)
                ) {
                    console.error(
                        "Payload is too large."
                    );

                    socket.destroy();
                    return;
                }

                payloadLength = Number(payloadLengthBigInt);

                maskingKeyOffset = 10;
                payloadOffset = 14;
            }

            // ------------------------------------------
            // 6. Check whether complete frame arrived
            // ------------------------------------------

            const totalFrameSize =
                payloadOffset + payloadLength;

            if (
                accumulatedBuffer.length <
                totalFrameSize
            ) {
                // TCP fragmentation.
                // Wait for more data.
                break;
            }

            // ------------------------------------------
            // 7. Extract masking key
            // ------------------------------------------

            const maskingKey =
                accumulatedBuffer.subarray(
                    maskingKeyOffset,
                    maskingKeyOffset + 4
                );

            // ------------------------------------------
            // 8. Extract masked payload
            // ------------------------------------------

            const maskedPayload =
                accumulatedBuffer.subarray(
                    payloadOffset,
                    totalFrameSize
                );

            // ------------------------------------------
            // 9. Unmask payload
            // ------------------------------------------

            const unmaskedPayload =
                Buffer.alloc(payloadLength);

            for (let i = 0; i < payloadLength; i++) {
                unmaskedPayload[i] =
                    maskedPayload[i] ^
                    maskingKey[i % 4];
            }

            // ------------------------------------------
            // 10. Handle opcode
            // ------------------------------------------

            switch (opcode) {
                case 0x0:
                    // Continuation frame
                    console.log(
                        "Continuation frame"
                    );
                    break;

                case 0x1:
                    // Text frame
                    console.log(
                        "Text frame received"
                    );

                    console.log(
                        "FIN:",
                        fin
                    );

                    console.log(
                        "Payload Length:",
                        payloadLength
                    );

                    console.log(
                        "Decoded Message:",
                        unmaskedPayload.toString("utf8")
                    );

                    break;

                case 0x2:
                    // Binary frame
                    console.log(
                        "Binary frame received"
                    );

                    break;

                case 0x8:
                    // Close frame
                    console.log(
                        "Close frame received"
                    );

                    socket.end();
                    return;

                case 0x9:
                    // Ping
                    console.log(
                        "Ping frame received"
                    );

                    break;

                case 0xA:
                    // Pong
                    console.log(
                        "Pong frame received"
                    );

                    break;

                default:
                    console.log(
                        "Unknown opcode:",
                        opcode
                    );
            }

            // ------------------------------------------
            // 11. Remove processed frame from buffer
            // ------------------------------------------

            accumulatedBuffer =
                accumulatedBuffer.subarray(
                    totalFrameSize
                );
            const response = "A".repeat(900000)
            // --- Example Usage ---
            const frameBuffer = createWebSocketFrame(response);
            // Send `frameBuffer` directly over your TCP socket stream (e.g., socket.write(frameBuffer))
            socket.write(frameBuffer)
        }
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

function createWebSocketFrame(textPayload, opcode = 0x1, isFin = true) {
    const payloadBuffer = Buffer.from(textPayload, 'utf-8');
    const payloadLen = payloadBuffer.length;

    // 1. Calculate Header Length
    let headerLen = 2; // Default for length <= 125
    if (payloadLen > 125 && payloadLen <= 65535) {
        headerLen += 2; // 16-bit extended length
    } else if (payloadLen > 65535) {
        headerLen += 8; // 64-bit extended length
    }

    const frame = Buffer.alloc(headerLen + payloadLen);

    // 2. Byte 0: FIN (1 bit) + RSV (3 bits) + Opcode (4 bits)
    // FIN bit = 0x80 (1000 0000) if true, 0x00 if false
    const finBit = isFin ? 0x80 : 0x00;   // 10000000
    frame[0] = finBit | (opcode & 0x0f);


    // 3. Byte 1: MASK (1 bit) + Payload Length (7 bits)
    // Server-to-client frames set MASK bit to 0 (0x00)
    if (payloadLen <= 125) {
        frame[1] = payloadLen;
    } else if (payloadLen <= 65535) {
        frame[1] = 126;
        frame.writeUInt16BE(payloadLen, 2); // Write length in next 2 bytes
    } else {
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(payloadLen), 2); // Write length in next 8 bytes
    }

    // 4. Copy payload after header
    payloadBuffer.copy(frame, headerLen);

    return frame;
}

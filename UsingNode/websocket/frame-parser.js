const getByte1 = require("./bytes/byte1");
const getByte2 = require("./bytes/byte2");
const createWebSocketFrame = require("./frame-writer")

function getWebSocketFrameAndParse(accumulatedBuffer, socket, chunk) {
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
        // ------------------------------------------
        // Byte 1
        // ------------------------------------------
        const byte1 = accumulatedBuffer[0];
        const { fin, opcode, rsv1, rsv2, rsv3 } = getByte1(byte1,)

        // ==========================================
        // RSV BIT VALIDATION
        // ==========================================

        if (rsv1 || rsv2 || rsv3) {
            console.log(
                "Protocol error: RSV bit set"
            );

            console.log(
                "RSV1:",
                rsv1
            );

            console.log(
                "RSV2:",
                rsv2
            );

            console.log(
                "RSV3:",
                rsv3
            );

            // Close code 1002 = Protocol Error
            const closePayload = Buffer.alloc(2);

            closePayload.writeUInt16BE(
                1002,
                0
            );

            const closeFrame =
                createWebSocketFrame(
                    closePayload,
                    0x8,
                    true
                );

            socket.write(
                closeFrame,
                () => {
                    socket.end();
                }
            );

            break;
        }

        // ------------------------------------------
        // Byte 2
        // ------------------------------------------
        const byte2 = accumulatedBuffer[1];
        const {
            isMasked,
            payloadLengthInfo,
        } = getByte2(byte2);

        if (!isMasked) {
            console.log(
                "Protocol error: client frame is not masked"
            );

            const closePayload =
                Buffer.alloc(2);

            closePayload.writeUInt16BE(
                1002,
                0
            );

            const closeFrame =
                createWebSocketFrame(
                    closePayload,
                    0x8,
                    true
                );

            socket.write(
                closeFrame,
                () => {
                    socket.end();
                }
            );

            return;
        }

        // ------------------------------------------
        // 5. Determine header size
        // ------------------------------------------

        let payloadLength;
        let maskingKeyOffset;
        let payloadOffset;

        if (payloadLengthInfo <= 125) {

            if (accumulatedBuffer.length < 6) {
                break;
            }
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
        // 10 Handle opcode (OPCODE VALIDATION)
        // ------------------------------------------

        const isValidOpcode =
            opcode === 0x0 || // Continuation
            opcode === 0x1 || // Text
            opcode === 0x2 || // Binary
            opcode === 0x8 || // Close
            opcode === 0x9 || // Ping
            opcode === 0xA;   // Pong

        if (!isValidOpcode) {
            console.log(
                "Protocol error: reserved opcode:",
                `0x${opcode.toString(16)}`
            );

            // Close code 1002 = Protocol Error
            const closePayload = Buffer.alloc(2);

            closePayload.writeUInt16BE(
                1002,
                0
            );

            const closeFrame =
                createWebSocketFrame(
                    closePayload,
                    0x8,
                    true
                );

            socket.write(
                closeFrame,
                () => {
                    socket.end();
                }
            );

            break;
        }


        // ==========================================
        // CONTROL FRAME VALIDATION
        // ==========================================

        const isControlFrame =
            opcode === 0x8 ||
            opcode === 0x9 ||
            opcode === 0xA;

        if (isControlFrame) {
            // Control frames must never be fragmented.
            if (!fin) {
                console.log(
                    "Protocol error: control frame must have FIN=1"
                );

                const closePayload = Buffer.alloc(2);

                closePayload.writeUInt16BE(
                    1002,
                    0
                );

                const closeFrame =
                    createWebSocketFrame(
                        closePayload,
                        0x8,
                        true
                    );

                socket.write(
                    closeFrame,
                    () => {
                        socket.end();
                    }
                );

                break;
            }

            // Control frames cannot have payload > 125 bytes.
            if (payloadLength > 125) {
                console.log(
                    "Protocol error: control frame payload too large"
                );

                const closePayload = Buffer.alloc(2);

                closePayload.writeUInt16BE(
                    1002,
                    0
                );

                const closeFrame =
                    createWebSocketFrame(
                        closePayload,
                        0x8,
                        true
                    );

                socket.write(
                    closeFrame,
                    () => {
                        socket.end();
                    }
                );

                break;
            }
        }

        // ==========================================
        // OPCODE HANDLING
        // ==========================================

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

                console.log(
                    "FIN:",
                    fin
                );

                console.log(
                    "Payload Length:",
                    payloadLength
                );

                console.log(
                    "Payload:",
                    unmaskedPayload
                );

                break;

            case 0x8:
                // Close frame
                console.log(
                    "Close frame received"
                );

                // A close frame may contain:
                // 0 bytes → no status code
                // 2+ bytes → status code + optional reason
                if (unmaskedPayload.length === 1) {
                    console.log(
                        "Invalid close frame payload"
                    );

                    socket.end();
                    break;
                }

                let closeCode = null;

                if (unmaskedPayload.length >= 2) {
                    closeCode =
                        unmaskedPayload.readUInt16BE(0);

                    console.log(
                        "Close code:",
                        closeCode
                    );
                }

                // Send Close response.
                const closeFrame =
                    createWebSocketFrame(
                        unmaskedPayload,
                        0x8,
                        true
                    );

                socket.write(
                    closeFrame,
                    () => {
                        socket.end();
                    }
                );

                break;

            case 0x9:
                // Ping
                console.log(
                    "Ping frame received"
                );

                const pongFrame =
                    createWebSocketFrame(
                        unmaskedPayload,
                        0x0A,
                        true
                    );

                socket.write(
                    pongFrame
                );

                break;

            case 0xA:
                // Pong
                console.log(
                    "Pong frame received"
                );

                break;
        }


        // ------------------------------------------
        // 11. Remove processed frame from buffer
        // ------------------------------------------

        accumulatedBuffer =
            accumulatedBuffer.subarray(
                totalFrameSize
            );
        // const response = "A".repeat(900000)
        // // --- Example Usage ---
        // const frameBuffer = createWebSocketFrame(response);
        // // Send `frameBuffer` directly over your TCP socket stream (e.g., socket.write(frameBuffer))
        // socket.write(frameBuffer)
    }
}

module.exports = getWebSocketFrameAndParse




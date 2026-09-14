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
}

module.exports = getWebSocketFrameAndParse
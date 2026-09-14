const getByte1 = require("./bytes/byte1");

const getByte2 = require("./bytes/byte2");

const createWebSocketFrame = require("./frame-writer");

// ==========================================
// SEND PROTOCOL ERROR AND CLOSE
// ==========================================
const sendProtocolErrorAndClose = require("./../helper/send-protocol-error-and-close")


// ==========================================
// WEBSOCKET FRAME PARSER
// ==========================================

function getWebSocketFrameAndParse(
    accumulatedBuffer,
    socket,
    chunk,
    fragmentedMessage
) {
    // ==========================================
    // TCP BUFFER
    // ==========================================

    // TCP is a stream.
    // One TCP chunk != one WebSocket frame.
    accumulatedBuffer =
        Buffer.concat([
            accumulatedBuffer,
            chunk,
        ]);

    // ==========================================
    // PROCESS COMPLETE FRAMES
    // ==========================================

    while (
        accumulatedBuffer.length >= 2
    ) {
        // ==========================================
        // BYTE 1
        // ==========================================

        const byte1 =
            accumulatedBuffer[0];

        const {
            fin,
            opcode,
            rsv1,
            rsv2,
            rsv3,
        } = getByte1(byte1);

        // ==========================================
        // RSV BIT VALIDATION
        // ==========================================

        if (
            rsv1 ||
            rsv2 ||
            rsv3
        ) {
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

            sendProtocolErrorAndClose(
                socket
            );

            return {
                accumulatedBuffer,
                fragmentedMessage,
            };
        }

        // ==========================================
        // BYTE 2
        // ==========================================

        const byte2 =
            accumulatedBuffer[1];

        const {
            isMasked,
            payloadLengthInfo,
        } = getByte2(byte2);

        // ==========================================
        // MASK VALIDATION
        // ==========================================

        // Client -> Server frames MUST be masked.
        if (!isMasked) {
            console.log(
                "Protocol error: client frame is not masked"
            );

            sendProtocolErrorAndClose(
                socket
            );

            return {
                accumulatedBuffer,
                fragmentedMessage,
            };
        }

        // ==========================================
        // DETERMINE HEADER SIZE
        // ==========================================

        let payloadLength;
        let maskingKeyOffset;
        let payloadOffset;

        // ------------------------------------------
        // Payload length: 0 - 125
        // ------------------------------------------

        if (
            payloadLengthInfo <= 125
        ) {
            // Need:
            // 2 bytes base header
            // 4 bytes masking key

            if (
                accumulatedBuffer.length < 6
            ) {
                // Frame header is incomplete.
                break;
            }

            payloadLength =
                payloadLengthInfo;

            maskingKeyOffset = 2;
            payloadOffset = 6;
        }

        // ------------------------------------------
        // Payload length: 126
        // ------------------------------------------

        else if (
            payloadLengthInfo === 126
        ) {
            // Need:
            // 2 bytes base header
            // 2 bytes extended length
            // 4 bytes masking key

            if (
                accumulatedBuffer.length < 8
            ) {
                // Extended length + mask not complete.
                break;
            }

            payloadLength =
                accumulatedBuffer.readUInt16BE(2);

            maskingKeyOffset = 4;
            payloadOffset = 8;
        }

        // ------------------------------------------
        // Payload length: 127
        // ------------------------------------------

        else {
            // Need:
            // 2 bytes base header
            // 8 bytes extended length
            // 4 bytes masking key

            if (
                accumulatedBuffer.length < 14
            ) {
                // Extended length + mask not complete.
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

                return {
                    accumulatedBuffer,
                    fragmentedMessage,
                };
            }

            payloadLength =
                Number(payloadLengthBigInt);

            maskingKeyOffset = 10;
            payloadOffset = 14;
        }

        // ==========================================
        // CHECK COMPLETE FRAME
        // ==========================================

        const totalFrameSize =
            payloadOffset +
            payloadLength;

        if (
            accumulatedBuffer.length <
            totalFrameSize
        ) {
            // TCP fragmentation.
            // Wait for more data.
            break;
        }

        // ==========================================
        // EXTRACT MASKING KEY
        // ==========================================

        const maskingKey =
            accumulatedBuffer.subarray(
                maskingKeyOffset,
                maskingKeyOffset + 4
            );

        // ==========================================
        // EXTRACT MASKED PAYLOAD
        // ==========================================

        const maskedPayload =
            accumulatedBuffer.subarray(
                payloadOffset,
                totalFrameSize
            );

        // ==========================================
        // UNMASK PAYLOAD
        // ==========================================

        const unmaskedPayload =
            Buffer.alloc(payloadLength);

        for (
            let i = 0;
            i < payloadLength;
            i++
        ) {
            unmaskedPayload[i] =
                maskedPayload[i] ^
                maskingKey[i % 4];
        }

        // ==========================================
        // OPCODE VALIDATION
        // ==========================================

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

            sendProtocolErrorAndClose(
                socket
            );

            return {
                accumulatedBuffer,
                fragmentedMessage,
            };
        }

        // ==========================================
        // CONTROL FRAME VALIDATION
        // ==========================================

        const isControlFrame =
            opcode === 0x8 ||
            opcode === 0x9 ||
            opcode === 0xA;

        if (isControlFrame) {
            // --------------------------------------
            // Control frames MUST have FIN=1
            // --------------------------------------

            if (!fin) {
                console.log(
                    "Protocol error: control frame must have FIN=1"
                );

                sendProtocolErrorAndClose(
                    socket
                );

                return {
                    accumulatedBuffer,
                    fragmentedMessage,
                };
            }

            // --------------------------------------
            // Control frame payload <= 125 bytes
            // --------------------------------------

            if (
                payloadLength > 125
            ) {
                console.log(
                    "Protocol error: control frame payload too large"
                );

                sendProtocolErrorAndClose(
                    socket
                );

                return {
                    accumulatedBuffer,
                    fragmentedMessage,
                };
            }
        }

        // ==========================================
        // OPCODE HANDLING
        // ==========================================

        switch (opcode) {

            // ======================================
            // CONTINUATION FRAME
            // ======================================

            case 0x0: {
                console.log(
                    "Continuation frame"
                );

                // Continuation is only valid when
                // a fragmented message is active.
                if (!fragmentedMessage) {
                    console.log(
                        "Protocol error: unexpected continuation frame"
                    );

                    sendProtocolErrorAndClose(
                        socket
                    );

                    return {
                        accumulatedBuffer,
                        fragmentedMessage,
                    };
                }

                // Add this fragment.
                fragmentedMessage.payloads.push(
                    unmaskedPayload
                );

                // ----------------------------------
                // Final continuation
                // ----------------------------------

                if (fin) {
                    const completePayload =
                        Buffer.concat(
                            fragmentedMessage.payloads
                        );

                    console.log(
                        "Fragmented message complete"
                    );

                    console.log(
                        "Opcode:",
                        fragmentedMessage.opcode
                    );

                    // Original message was Text.
                    if (
                        fragmentedMessage.opcode === 0x1
                    ) {
                        console.log(
                            "Decoded Message:",
                            completePayload.toString(
                                "utf8"
                            )
                        );
                    }

                    // Original message was Binary.
                    if (
                        fragmentedMessage.opcode === 0x2
                    ) {
                        console.log(
                            "Binary Payload:",
                            completePayload
                        );
                    }

                    // Fragmentation is complete.
                    fragmentedMessage = null;
                }

                break;
            }

            // ======================================
            // TEXT FRAME
            // ======================================

            case 0x1: {
                console.log(
                    "Text frame received"
                );

                // A new Text frame cannot start
                // while another fragmented message
                // is active.
                if (fragmentedMessage) {
                    console.log(
                        "Protocol error: new text frame while fragmented message is active"
                    );

                    sendProtocolErrorAndClose(
                        socket
                    );

                    return {
                        accumulatedBuffer,
                        fragmentedMessage,
                    };
                }

                // ----------------------------------
                // Start fragmented text message
                // ----------------------------------

                if (!fin) {
                    fragmentedMessage = {
                        opcode: 0x1,
                        payloads: [
                            unmaskedPayload,
                        ],
                    };

                    console.log(
                        "Started fragmented text message"
                    );

                    break;
                }

                // ----------------------------------
                // Complete text message
                // ----------------------------------

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
                    unmaskedPayload.toString(
                        "utf8"
                    )
                );

                break;
            }

            // ======================================
            // BINARY FRAME
            // ======================================

            case 0x2: {
                console.log(
                    "Binary frame received"
                );

                // A new Binary frame cannot start
                // while another fragmented message
                // is active.
                if (fragmentedMessage) {
                    console.log(
                        "Protocol error: new binary frame while fragmented message is active"
                    );

                    sendProtocolErrorAndClose(
                        socket
                    );

                    return {
                        accumulatedBuffer,
                        fragmentedMessage,
                    };
                }

                // ----------------------------------
                // Start fragmented binary message
                // ----------------------------------

                if (!fin) {
                    fragmentedMessage = {
                        opcode: 0x2,
                        payloads: [
                            unmaskedPayload,
                        ],
                    };

                    console.log(
                        "Started fragmented binary message"
                    );

                    break;
                }

                // ----------------------------------
                // Complete binary message
                // ----------------------------------

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
            }

            // ======================================
            // CLOSE FRAME
            // ======================================

            case 0x8: {
                console.log(
                    "Close frame received"
                );

                // A Close frame may contain:
                //
                // 0 bytes
                //     -> no status code
                //
                // 2+ bytes
                //     -> status code + optional reason
                //
                // 1 byte
                //     -> invalid

                if (
                    unmaskedPayload.length === 1
                ) {
                    console.log(
                        "Invalid close frame payload"
                    );

                    socket.end();

                    break;
                }

                let closeCode = null;

                if (
                    unmaskedPayload.length >= 2
                ) {
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
            }

            // ======================================
            // PING
            // ======================================

            case 0x9: {
                console.log(
                    "Ping frame received"
                );

                // Pong must contain the same
                // application data as Ping.
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
            }

            // ======================================
            // PONG
            // ======================================

            case 0xA: {
                console.log(
                    "Pong frame received"
                );

                break;
            }
        }

        // ==========================================
        // REMOVE PROCESSED FRAME
        // ==========================================

        accumulatedBuffer =
            accumulatedBuffer.subarray(
                totalFrameSize
            );
    }

    // ==========================================
    // RETURN CONNECTION STATE
    // ==========================================

    return {
        accumulatedBuffer,
        fragmentedMessage,
    };
}

module.exports =
    getWebSocketFrameAndParse;

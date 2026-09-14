const net = require("net");
const crypto = require("crypto");

const HOST = "127.0.0.1";
const PORT = 8000;

const client = net.createConnection(
    {
        host: HOST,
        port: PORT,
    },
    () => {
        console.log("TCP connection established");

        // ------------------------------------------
        // 1. Create WebSocket handshake key
        // ------------------------------------------

        const secWebSocketKey = crypto
            .randomBytes(16)
            .toString("base64");

        // ------------------------------------------
        // 2. Send HTTP WebSocket Upgrade request
        // ------------------------------------------

        const handshake =
            "GET / HTTP/1.1\r\n" +
            `Host: ${HOST}:${PORT}\r\n` +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            `Sec-WebSocket-Key: ${secWebSocketKey}\r\n` +
            "Sec-WebSocket-Version: 13\r\n" +
            "\r\n";

        console.log("\nSending WebSocket handshake...\n");

        client.write(handshake);
    }
);

// ==========================================
// RECEIVE DATA
// ==========================================

let receivedBuffer = Buffer.alloc(0);

client.on("data", (chunk) => {
    receivedBuffer = Buffer.concat([
        receivedBuffer,
        chunk,
    ]);

    // ------------------------------------------
    // First receive HTTP 101 response
    // ------------------------------------------

    if (receivedBuffer.includes("\r\n\r\n")) {
        const headerEnd =
            receivedBuffer.indexOf("\r\n\r\n") + 4;

        const httpResponse =
            receivedBuffer
                .subarray(0, headerEnd)
                .toString("utf8");

        console.log(
            "Server handshake response:\n"
        );

        console.log(httpResponse);

        receivedBuffer =
            receivedBuffer.subarray(headerEnd);

        // Only send Ping once
        if (!client.pingSent) {
            client.pingSent = true;

            sendPing("Hello");
        }
    }

    // ------------------------------------------
    // Parse WebSocket frames
    // ------------------------------------------

    parseFrames();
});

// ==========================================
// SEND PING
// ==========================================

function sendPing(text) {
    const payload = Buffer.from(text, "utf8");

    console.log("Sending Ping...");
    console.log("Payload:", text);
    console.log("Payload bytes:", payload);

    const frame = createMaskedFrame(
        payload,
        0x09
    );

    console.log("\nPing frame bytes:");
    console.log(frame);

    console.log(
        "Byte 0:",
        frame[0].toString(2).padStart(8, "0")
    );

    console.log(
        "Byte 1:",
        frame[1].toString(2).padStart(8, "0")
    );

    client.write(frame);
}

// ==========================================
// CREATE CLIENT → SERVER FRAME
// ==========================================

function createMaskedFrame(payloadBuffer, opcode) {
    const payloadLen = payloadBuffer.length;

    let headerLen = 2;

    if (
        payloadLen > 125 &&
        payloadLen <= 65535
    ) {
        headerLen += 2;
    } else if (payloadLen > 65535) {
        headerLen += 8;
    }

    // Client frame has:
    // header
    // masking key (4 bytes)
    // masked payload

    const frame =
        Buffer.alloc(
            headerLen +
            4 +
            payloadLen
        );

    // ------------------------------------------
    // Byte 0
    // ------------------------------------------

    const finBit = 0x80;

    frame[0] =
        finBit |
        (opcode & 0x0f);

    // ------------------------------------------
    // Byte 1 + extended length
    // ------------------------------------------

    if (payloadLen <= 125) {
        // MASK = 1
        frame[1] =
            0x80 |
            payloadLen;
    } else if (payloadLen <= 65535) {
        // MASK = 1
        frame[1] =
            0x80 |
            126;

        frame.writeUInt16BE(
            payloadLen,
            2
        );
    } else {
        // MASK = 1
        frame[1] =
            0x80 |
            127;

        frame.writeBigUInt64BE(
            BigInt(payloadLen),
            2
        );
    }

    // ------------------------------------------
    // Determine masking-key position
    // ------------------------------------------

    const maskingKeyOffset =
        headerLen;

    const payloadOffset =
        headerLen + 4;

    // ------------------------------------------
    // Generate masking key
    // ------------------------------------------

    const maskingKey =
        crypto.randomBytes(4);

    maskingKey.copy(
        frame,
        maskingKeyOffset
    );

    // ------------------------------------------
    // Mask payload
    // ------------------------------------------

    for (let i = 0; i < payloadLen; i++) {
        frame[payloadOffset + i] =
            payloadBuffer[i] ^
            maskingKey[i % 4];
    }

    return frame;
}

// ==========================================
// PARSE SERVER → CLIENT FRAMES
// ==========================================

function parseFrames() {
    while (receivedBuffer.length >= 2) {
        const byte1 = receivedBuffer[0];
        const byte2 = receivedBuffer[1];

        const fin =
            (byte1 & 0x80) !== 0;

        const opcode =
            byte1 & 0x0f;

        const isMasked =
            (byte2 & 0x80) !== 0;

        const payloadLengthInfo =
            byte2 & 0x7f;

        let payloadLength;
        let payloadOffset;

        // ------------------------------------------
        // Determine payload offset
        // ------------------------------------------

        if (payloadLengthInfo <= 125) {
            payloadLength =
                payloadLengthInfo;

            payloadOffset = 2;
        } else if (payloadLengthInfo === 126) {
            if (receivedBuffer.length < 4) {
                return;
            }

            payloadLength =
                receivedBuffer.readUInt16BE(2);

            payloadOffset = 4;
        } else {
            if (receivedBuffer.length < 10) {
                return;
            }

            const length =
                receivedBuffer.readBigUInt64BE(2);

            if (
                length >
                BigInt(Number.MAX_SAFE_INTEGER)
            ) {
                console.error(
                    "Payload too large"
                );

                client.destroy();
                return;
            }

            payloadLength =
                Number(length);

            payloadOffset = 10;
        }

        // ------------------------------------------
        // Server → Client should NOT be masked
        // ------------------------------------------

        if (isMasked) {
            console.error(
                "Server sent a masked frame!"
            );

            client.destroy();
            return;
        }

        const totalFrameSize =
            payloadOffset +
            payloadLength;

        if (
            receivedBuffer.length <
            totalFrameSize
        ) {
            return;
        }

        // ------------------------------------------
        // Extract payload
        // ------------------------------------------

        const payload =
            receivedBuffer.subarray(
                payloadOffset,
                totalFrameSize
            );

        // ------------------------------------------
        // Handle opcode
        // ------------------------------------------

        if (opcode === 0xA) {
            console.log("\n========== PONG RECEIVED ==========");

            console.log(
                "FIN:",
                fin
            );

            console.log(
                "Opcode:",
                `0x${opcode.toString(16)}`
            );

            console.log(
                "MASK:",
                isMasked
            );

            console.log(
                "Payload:",
                payload.toString("utf8")
            );

            console.log(
                "Payload bytes:",
                payload
            );

            console.log(
                "Expected:",
                Buffer.from("Hello")
            );

            console.log(
                "Payload identical:",
                payload.equals(
                    Buffer.from("Hello")
                )
            );

            console.log(
                "=================================="
            );

            client.end();
        } else {
            console.log(
                "Received opcode:",
                `0x${opcode.toString(16)}`
            );
        }

        // ------------------------------------------
        // Remove processed frame
        // ------------------------------------------

        receivedBuffer =
            receivedBuffer.subarray(
                totalFrameSize
            );
    }
}

// ==========================================
// CONNECTION EVENTS
// ==========================================

client.on("end", () => {
    console.log(
        "Server closed the connection"
    );
});

client.on("close", () => {
    console.log(
        "TCP connection closed"
    );
});

client.on("error", (error) => {
    console.error(
        "Client error:",
        error.message
    );
});
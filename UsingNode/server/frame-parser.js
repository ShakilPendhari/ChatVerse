/**
 * @file frame-parser.js
 * @description RFC 6455 Binary Frame parser and encoder routines.
 */

const MAX_FRAME_SIZE = 10 * 1024 * 1024; // 10MB Payload Limit (OOM Protection)

/**
 * Attaches a frame parser stream listener to a TCP socket.
 */
function attachFrameParser(socket, connectionsMap, onMessage, onDisconnect) {
    let accumulatedBuffer = Buffer.alloc(0);

    socket.on("data", (chunk) => {
        // Append incoming TCP chunk to stream buffer
        accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);

        // Process frames in loop while buffer has at least 2 header bytes
        while (accumulatedBuffer.length >= 2) {
            const byte1 = accumulatedBuffer[0];
            const byte2 = accumulatedBuffer[1];

            const fin = (byte1 & 0x80) === 0x80;
            const opcode = byte1 & 0x0f;
            const isMasked = (byte2 & 0x80) === 0x80;

            // RFC 6455 Guard: Client frames MUST be masked
            if (!isMasked) {
                console.error("[FrameParser] Client frame unmasked. Closing connection.");
                socket.destroy();
                return;
            }

            const payloadLengthInfo = byte2 & 0x7f;
            let headerSize = 2;
            let payloadLength = payloadLengthInfo;

            // Extended Payload Length checks with length guards
            if (payloadLengthInfo === 126) {
                headerSize = 4;
                if (accumulatedBuffer.length < headerSize) break;
                payloadLength = accumulatedBuffer.readUInt16BE(2);
            } else if (payloadLengthInfo === 127) {
                headerSize = 10;
                if (accumulatedBuffer.length < headerSize) break;
                // Cast BigInt to Number for buffer memory allocation
                payloadLength = Number(accumulatedBuffer.readBigUInt64BE(2));
            }

            // OOM Security Attack Guard
            if (payloadLength > MAX_FRAME_SIZE) {
                console.error(`[FrameParser] Frame size limit exceeded: ${payloadLength} bytes`);
                socket.destroy();
                return;
            }

            const maskingKeyOffset = headerSize;
            const payloadOffset = maskingKeyOffset + 4;
            const totalFrameSize = payloadOffset + payloadLength;

            // Wait for rest of TCP chunk if payload has not fully arrived
            if (accumulatedBuffer.length < totalFrameSize) {
                break;
            }

            // Extract masking key & payload
            const maskingKey = accumulatedBuffer.subarray(maskingKeyOffset, payloadOffset);
            const maskedPayload = accumulatedBuffer.subarray(payloadOffset, totalFrameSize);

            // Execute XOR Unmasking: unmasked[i] = masked[i] ^ maskingKey[i % 4]
            const unmaskedPayload = Buffer.alloc(payloadLength);
            for (let i = 0; i < payloadLength; i++) {
                unmaskedPayload[i] = maskedPayload[i] ^ maskingKey[i % 4];
            }

            // Process decoded payload
            routeFrame(socket, opcode, unmaskedPayload, connectionsMap, onMessage, onDisconnect);

            // Slice processed frame off buffer stream
            accumulatedBuffer = accumulatedBuffer.subarray(totalFrameSize);
        }
    });

    socket.on("end", () => onDisconnect(socket, connectionsMap));
    socket.on("error", () => onDisconnect(socket, connectionsMap));
}

/**
 * Routes decoded frames based on RFC opcode.
 */
function routeFrame(socket, opcode, payload, connectionsMap, onMessage, onDisconnect) {
    const meta = connectionsMap.get(socket);

    switch (opcode) {
        case 0x1: // Text Frame
            try {
                const messageString = payload.toString("utf8");
                const parsedJSON = JSON.parse(messageString);
                onMessage(socket, parsedJSON, connectionsMap);
            } catch (err) {
                console.error("[FrameParser] Invalid JSON frame received.");
            }
            break;

        case 0x8: // Close Frame
            onDisconnect(socket, connectionsMap);
            sendRawFrame(socket, 0x8, Buffer.alloc(0));
            socket.end();
            break;

        case 0x9: // Ping Frame
            sendRawFrame(socket, 0xa, payload); // Return Pong
            break;

        case 0xa: // Pong Frame
            if (meta) meta.isAlive = true;
            break;
    }
}

/**
 * Constructs and writes an unmasked server-to-client frame.
 */
function sendRawFrame(socket, opcode, payload) {
    if (socket.destroyed || !socket.writable) return;

    const payloadLength = payload.length;
    let header;

    if (payloadLength <= 125) {
        header = Buffer.alloc(2);
        header[0] = 0x80 | (opcode & 0x0f);
        header[1] = payloadLength;
    } else if (payloadLength <= 65535) {
        header = Buffer.alloc(4);
        header[0] = 0x80 | (opcode & 0x0f);
        header[1] = 126;
        header.writeUInt16BE(payloadLength, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x80 | (opcode & 0x0f);
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payloadLength), 2);
    }

    socket.write(Buffer.concat([header, payload]));
}

/**
 * Serializes JS object into UTF-8 JSON text frame.
 */
function sendJSON(socket, data) {
    const payload = Buffer.from(JSON.stringify(data), "utf8");
    sendRawFrame(socket, 0x1, payload);
}

module.exports = {
    attachFrameParser,
    sendJSON,
    sendRawFrame
};
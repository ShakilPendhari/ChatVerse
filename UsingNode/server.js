const http = require("http");
const fs = require("fs")
const path = require("path")
const crypto = require("crypto");
const { Buffer } = require("buffer")

const PORT = 8000;
const METHODS = {
    GET: "GET",
   };

// ==========================================
// 1. HTTP FILE SERVER
// ==========================================
const server = http.createServer((req, res) => {
    const method = req.method;
    const url = req.url;

    if (url === "/" && method === METHODS.GET) {
        const filePath = path.join(__dirname, "public", "index.html");
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Error loading HTML");
            } else {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.write(data);
                res.end();
            }
        });
    } else if (url === "/style.css" && method === METHODS.GET) {
        const filePath = path.join(__dirname, "public", "style.css");
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Error loading CSS");
            } else {
                res.writeHead(200, { "Content-Type": "text/css" });
                res.write(data);
                res.end();
            }
        });
    } else if (url === "/app.js" && method === METHODS.GET) {
        const filePath = path.join(__dirname, "public", "app.js");
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Error loading JS");
            } else {
                res.writeHead(200, { "Content-Type": "text/javascript" });
                res.write(data);
                res.end();
            }
        });
    } else {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>404 Not Found</h1>");
    }
});

// ==========================================
// 2. WEBSOCKET UPGRADE HANDLER
// ==========================================
server.on("upgrade", (req, socket, head) => {
    // Magic string defined in RFC 6455 for the WebSocket handshake protocol
    const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    const secWebSocketKey = req.headers["sec-websocket-key"];

    // Compute SHA-1 hash of client key + GUID, encoded in Base64
    const acceptKey = crypto
        .createHash("sha1")
        .update(secWebSocketKey + GUID)
        .digest("base64");

    // Construct valid HTTP 101 Switching Protocols response
    // Must end with double CRLF (\r\n\r\n) to signal end of HTTP header block
    const acceptHeader = [
        `HTTP/1.1 101 Switching Protocols`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Accept: ${acceptKey}`,
        "",
        ""
    ].join("\r\n");

    socket.write(acceptHeader);

    // Maintain an internal buffer to handle TCP streaming and fragmentation
    let accumulatedBuffer = Buffer.alloc(0);

    socket.on("data", (chunk) => {
        // TCP is stream-based; append new chunk to accumulated buffer
        accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);

        // Process frames as long as we have at least 2 bytes (minimum WS header size)
        while (accumulatedBuffer.length >= 2) {
            const byte1 = accumulatedBuffer[0];
            const byte2 = accumulatedBuffer[1];

            // --- STEP 1: Parse Byte 1 (FIN & Opcode) ---
            // FIN bit (Bit 0): 0x80 -> 10000000. Checks if this is the final fragment.
            const fin = (byte1 & 0x80) === 0x80;

            // Opcode (Bits 4-7): 0x0F -> 00001111.
            // Opcode type: 0x1 = Text frame, 0x2 = Binary frame, 0x8 = Close frame
            const opcode = byte1 & 0x0f;

            // --- STEP 2: Parse Byte 2 (Mask & Payload Length Indicator) ---
            // MASK bit (Bit 0): 0x80 -> 10000000. Client-to-server frames MUST be masked.
            const isMasked = (byte2 & 0x80) === 0x80;

            if (!isMasked) {
                console.error("Client frame was not masked. Closing connection per RFC 6455.");
                socket.destroy();
                return;
            }

            // Indicator length (Bits 1-7): 0x7F -> 01111111 (Max 127 in decimal)
            const payloadLengthInfo = byte2 & 0x7f;
            // 126 → next 2 bytes contain actual length
            // 127 → next 8 bytes contain actual length

            let maskingKeyOffset;
            let payloadOffset;
            let payloadLength = payloadLengthInfo;
            const baseHeaderSize = 2;

            // --- STEP 3: Determine Frame Header Boundaries ---
            // Case A: Small Payload (0 to 125 bytes)
            if (payloadLengthInfo <= 125) {
                maskingKeyOffset = 2;
                payloadOffset = maskingKeyOffset + 4; // Header(2) + Mask(4) = 6
            }
            // Case B: Medium Payload (126 bytes) -> Uses 2 extended bytes for length
            else if (payloadLengthInfo === 126) {
                maskingKeyOffset = 4; // Header(2) + LengthBytes(2) = 4
                payloadOffset = maskingKeyOffset + 4; // 8

                // If full 4-byte header is not received yet, wait for more data
                if (accumulatedBuffer.length < 4) break;
                payloadLength = accumulatedBuffer.readUInt16BE(baseHeaderSize);
            }
            // Case C: Large Payload (127 bytes) -> Uses 8 extended bytes for length
            else if (payloadLengthInfo === 127) {
                maskingKeyOffset = 10; // Header(2) + LengthBytes(8) = 10
                payloadOffset = maskingKeyOffset + 4; // 14

                // If full 10-byte header is not received yet, wait for more data
                if (accumulatedBuffer.length < 10) break;
                payloadLength = Number(accumulatedBuffer.readBigUInt64BE(baseHeaderSize));
            }

            // Total bytes required to process this frame complete payload
            const totalFrameSize = payloadOffset + payloadLength;

            // Stop processing loop if TCP packet hasn't received full frame payload yet
            if (accumulatedBuffer.length < totalFrameSize) {
                break;
            }

            // --- STEP 4: Extract Key & Masked Payload ---
            const maskingKey = accumulatedBuffer.subarray(maskingKeyOffset, maskingKeyOffset + 4);
            const maskedPayload = accumulatedBuffer.subarray(payloadOffset, totalFrameSize);

            // --- STEP 5: XOR Unmasking Calculation ---
            // Formula: originalByte[i] = maskedByte[i] XOR maskingKey[i % 4]
            const unmaskedPayload = Buffer.alloc(payloadLength);
            for (let i = 0; i < payloadLength; i++) {
                unmaskedPayload[i] = maskedPayload[i] ^ maskingKey[i % 4];
            }

            // --- STEP 6: Execute Opcode Logic ---
            if (opcode === 0x1) {
                // Text frame
                console.log("FIN:", fin);
                console.log("Opcode:", opcode, "(Text)");
                console.log("Payload Length:", payloadLength);
                console.log("Decoded Message:", unmaskedPayload.toString("utf8"));
            } else if (opcode === 0x8) {
                // Connection Close frame
                console.log("Close frame received from client.");
                socket.end();
                return;
            }

            // --- STEP 7: Advance Buffer Pointer ---
            // Slice off processed frame bytes so loop can evaluate next frame in queue
            accumulatedBuffer = accumulatedBuffer.subarray(totalFrameSize);
        }
    });

    socket.on("end", () => {
        console.log("Client disconnected.");
    });
});

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
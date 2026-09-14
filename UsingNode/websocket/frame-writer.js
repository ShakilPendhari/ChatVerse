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

module.exports = createWebSocketFrame
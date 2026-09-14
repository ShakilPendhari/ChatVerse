const crypto = require("crypto");

function createClientFrame(
    payload,
    opcode,
    {
        fin = true,
        mask = true,
    } = {}
) {
    const payloadBuffer = Buffer.isBuffer(payload)
        ? payload
        : Buffer.from(payload, "utf8");

    const payloadLength = payloadBuffer.length;

    // Client frames MUST be masked.
    if (!mask) {
        throw new Error(
            "Client frames must be masked"
        );
    }

    let headerLength = 2;

    if (
        payloadLength > 125 &&
        payloadLength <= 65535
    ) {
        headerLength += 2;
    } else if (payloadLength > 65535) {
        headerLength += 8;
    }

    const maskingKey = crypto.randomBytes(4);

    const frame = Buffer.alloc(
        headerLength +
        4 +
        payloadLength
    );

    // ==========================================
    // BYTE 0
    // ==========================================

    const finBit = fin ? 0x80 : 0x00;

    frame[0] =
        finBit |
        (opcode & 0x0f);

    // ==========================================
    // BYTE 1 + PAYLOAD LENGTH
    // ==========================================

    if (payloadLength <= 125) {
        frame[1] =
            0x80 |
            payloadLength;
    } else if (payloadLength <= 65535) {
        frame[1] =
            0x80 |
            126;

        frame.writeUInt16BE(
            payloadLength,
            2
        );
    } else {
        frame[1] =
            0x80 |
            127;

        frame.writeBigUInt64BE(
            BigInt(payloadLength),
            2
        );
    }

    // ==========================================
    // MASKING KEY
    // ==========================================

    const maskingKeyOffset =
        headerLength;

    maskingKey.copy(
        frame,
    maskingKeyOffset
    );

    // ==========================================
    // MASK PAYLOAD
    // ==========================================

    const payloadOffset =
        headerLength + 4;

    for (let i = 0; i < payloadLength; i++) {
        frame[payloadOffset + i] =
            payloadBuffer[i] ^
            maskingKey[i % 4];
    }

    return frame;
}

module.exports = {
    createClientFrame,
};
function parseFrames(state) {
    const frames = [];

    while (state.buffer.length >= 2) {
        const byte1 = state.buffer[0];
        const byte2 = state.buffer[1];

        const fin =
            (byte1 & 0x80) !== 0;

        const rsv1 =
            (byte1 & 0x40) !== 0;

        const rsv2 =
            (byte1 & 0x20) !== 0;

        const rsv3 =
            (byte1 & 0x10) !== 0;

        const opcode =
            byte1 & 0x0f;

        const isMasked =
            (byte2 & 0x80) !== 0;

        const payloadLengthInfo =
            byte2 & 0x7f;

        let payloadLength;
        let payloadOffset;

        // ==========================================
        // PAYLOAD LENGTH
        // ==========================================

        if (payloadLengthInfo <= 125) {
            payloadLength =
                payloadLengthInfo;

            payloadOffset = 2;
        } else if (payloadLengthInfo === 126) {
            if (state.buffer.length < 4) {
                break;
            }

            payloadLength =
                state.buffer.readUInt16BE(2);

            payloadOffset = 4;
        } else {
            if (state.buffer.length < 10) {
                break;
            }

            const length =
                state.buffer.readBigUInt64BE(2);

            if (
                length >
                BigInt(Number.MAX_SAFE_INTEGER)
            ) {
                throw new Error(
                    "Payload is too large"
                );
            }

            payloadLength =
                Number(length);

            payloadOffset = 10;
        }

        // ==========================================
        // SERVER FRAME MUST NOT BE MASKED
        // ==========================================

        if (isMasked) {
            throw new Error(
                "Server sent a masked frame"
            );
        }

        const totalFrameSize =
            payloadOffset +
            payloadLength;

        // Complete frame hasn't arrived yet.
        if (
            state.buffer.length <
            totalFrameSize
        ) {
            break;
        }

        // ==========================================
        // PAYLOAD
        // ==========================================

        const payload =
            state.buffer.subarray(
                payloadOffset,
                totalFrameSize
            );

        frames.push({
            fin,
            rsv1,
            rsv2,
            rsv3,
            opcode,
            masked: isMasked,
            payload,
        });

        // ==========================================
        // REMOVE PROCESSED FRAME
        // ==========================================

        state.buffer =
            state.buffer.subarray(
                totalFrameSize
            );
    }

    return frames;
}

module.exports = {
    parseFrames,
};
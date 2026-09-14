function getByte2(byte2) {
    const isMasked =
        (byte2 & 0x80) !== 0;

    const payloadLengthInfo =
        byte2 & 0x7F;

    return {
        isMasked,
        payloadLengthInfo,
    };
}

module.exports = getByte2;
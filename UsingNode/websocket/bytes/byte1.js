function getByte1(byte1) {

    const fin = (byte1 & 0x80) !== 0;

    const rsv1 = (byte1 & 0x40) !== 0;
    const rsv2 = (byte1 & 0x20) !== 0;
    const rsv3 = (byte1 & 0x10) !== 0;

    const opcode = byte1 & 0x0F;

    return { fin, opcode, rsv1, rsv2, rsv3 }
}

module.exports = getByte1
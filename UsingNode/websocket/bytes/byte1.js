function getByte1(byte1) {

    const fin = (byte1 & 0x80) !== 0;
    const opcode = byte1 & 0x0f;

    console.log("byte1")

    return { fin, opcode }
}

module.exports = getByte1
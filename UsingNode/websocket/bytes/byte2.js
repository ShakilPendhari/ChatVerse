

function getByte2(byte2) {
    const isMasked = (byte2 & 0x80) !== 0;
    // Client -> Server frames MUST be masked.
    if (!isMasked) {
        console.error(
            "Client frame is not masked. Closing connection."
        );

        socket.destroy();
        return;
    }


    const payloadLengthInfo = byte2 & 0x7f;   // ranges will be 0-125, 126, 127
    // 0-125 --> means the payload actual length
    // 126   --> means the payload length needs to read from the next 2 bytes (16 bits)
    // 127   --> means the payload length needs to read from the next 8 bytes (64 bits)

    return { isMasked, payloadLengthInfo }
}

module.exports = getByte2
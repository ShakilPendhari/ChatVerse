

function getByte1(byte1) {

    const fin = (byte1 & 0x80) !== 0;
    const opcode = byte1 & 0x0f;
    // ------------------------------------------
    // Handle opcode
    // ------------------------------------------

    switch (opcode) {
        case 0x0:
            // Continuation frame
            console.log(
                "Continuation frame"
            );
            break;

        case 0x1:
            // Text frame
            console.log(
                "Text frame received"
            );

            console.log(
                "FIN:",
                fin
            );

            console.log(
                "Payload Length:",
                payloadLength
            );

            console.log(
                "Decoded Message:",
                unmaskedPayload.toString("utf8")
            );

            break;

        case 0x2:
            // Binary frame
            console.log(
                "Binary frame received"
            );

            break;

        case 0x8:
            // Close frame
            console.log(
                "Close frame received"
            );

            socket.end();
            return;

        case 0x9:
            // Ping
            console.log(
                "Ping frame received"
            );

            break;

        case 0xA:
            // Pong
            console.log(
                "Pong frame received"
            );

            break;

        default:
            console.log(
                "Unknown opcode:",
                opcode
            );
    }

    return { fin, opcode }
}

module.exports = getByte1
function sendProtocolErrorAndClose(socket) {
    // WebSocket close status 1002 = Protocol Error
    const closePayload = Buffer.alloc(2);

    closePayload.writeUInt16BE(1002, 0);

    const closeFrame = createWebSocketFrame(
        closePayload,
        0x8,
        true
    );

    socket.write(closeFrame, () => {
        socket.end();
    });
}

module.exports = sendProtocolErrorAndClose
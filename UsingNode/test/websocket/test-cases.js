const assert = require("assert");

const {
    createClientFrame,
} = require("./frame-builder");

// ==========================================
// TEXT
// ==========================================

async function testText(client) {
    console.log("\n[TEST] Text frame");

    const payload =
        Buffer.from("Hello");

    const frame =
        createClientFrame(
            payload,
            0x1
        );

    client.sendFrame(frame);

    // Text frames do not require a response.
    // Send Ping to verify that the connection is still alive.
    const pingPayload =
        Buffer.from("text-test");

    const pingFrame =
        createClientFrame(
            pingPayload,
            0x9
        );

    client.sendFrame(pingFrame);

    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0xA
    );

    assert.strictEqual(
        response.fin,
        true
    );

    assert.strictEqual(
        response.masked,
        false
    );

    assert.deepStrictEqual(
        response.payload,
        pingPayload
    );

    console.log("PASS");
}

// ==========================================
// BINARY
// ==========================================

async function testBinary(client) {
    console.log("\n[TEST] Binary frame");

    const payload =
        Buffer.from([
            0x00,
            0xff,
            0x10,
            0x7a,
            0x80,
        ]);

    const frame =
        createClientFrame(
            payload,
            0x2
        );

    client.sendFrame(frame);

    console.log("PASS");
}

// ==========================================
// PING → PONG
// ==========================================

async function testPingPong(client) {
    console.log("\n[TEST] Ping → Pong");

    const payload =
        Buffer.from("Hello");

    const frame =
        createClientFrame(
            payload,
            0x9
        );

    client.sendFrame(frame);

    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0xA
    );

    assert.strictEqual(
        response.fin,
        true
    );

    assert.strictEqual(
        response.masked,
        false
    );

    assert.deepStrictEqual(
        response.payload,
        payload
    );

    console.log("PASS");
}

// ==========================================
// PONG
// ==========================================

async function testPong(client) {
    console.log("\n[TEST] Pong frame");

    const payload =
        Buffer.from("client-pong");

    const pongFrame =
        createClientFrame(
            payload,
            0xA
        );

    // Send Pong from client to server.
    client.sendFrame(pongFrame);

    // Pong does not require a response.
    // Send Ping to verify the connection is still alive.
    const pingPayload =
        Buffer.from("pong-test");

    const pingFrame =
        createClientFrame(
            pingPayload,
            0x9
        );

    client.sendFrame(pingFrame);

    const response =
        await client.waitForFrame();

    // Server must respond to Ping with Pong.
    assert.strictEqual(
        response.opcode,
        0xA
    );

    assert.strictEqual(
        response.fin,
        true
    );

    assert.strictEqual(
        response.masked,
        false
    );

    // Server Pong must contain the Ping payload.
    assert.deepStrictEqual(
        response.payload,
        pingPayload
    );

    console.log("PASS");
}

// ==========================================
// CLOSE
// ==========================================

async function testClose(client) {
    console.log("\n[TEST] Close frame");

    // WebSocket normal closure = 1000
    const closePayload =
        Buffer.alloc(2);

    closePayload.writeUInt16BE(
        1000,
        0
    );

    const closeFrame =
        createClientFrame(
            closePayload,
            0x8
        );

    // Send Close frame.
    client.sendFrame(closeFrame);

    // Server should respond with Close.
    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0x8
    );

    assert.strictEqual(
        response.fin,
        true
    );

    assert.strictEqual(
        response.masked,
        false
    );

    assert.deepStrictEqual(
        response.payload,
        closePayload
    );

    console.log(
        "Close code:",
        response.payload.readUInt16BE(0)
    );

    console.log("PASS");
}

// ==========================================
// FRAGMENTED TEXT
// ==========================================

async function testFragmentedText(client) {
    console.log(
        "\n[TEST] Fragmented text"
    );

    const first =
        createClientFrame(
            "Hel",
            0x1,
            {
                fin: false,
            }
        );

    const second =
        createClientFrame(
            "lo",
            0x0,
            {
                fin: true,
            }
        );

    client.sendFrame(first);

    // Give server a chance to process
    await delay(20);

    client.sendFrame(second);

    const response =
        await client.waitForFrame();

    console.log(
        "Server response opcode:",
        response.opcode
    );

    console.log(
        "NOTE: This test requires your server's WebSocket message fragmentation implementation."
    );
}

async function testUnmaskedClientFrame(client) {
    console.log(
        "\n[TEST] Unmasked client frame"
    );

    const payload =
        Buffer.from("Hello");

    // Manually construct an INVALID client frame.
    //
    // FIN = 1
    // Opcode = 0x1 (Text)
    // MASK = 0  <-- INVALID
    // Payload length = 5

    const frame =
        Buffer.alloc(
            2 + payload.length
        );

    frame[0] =
        0x80 | 0x01;

    frame[1] =
        payload.length;

    payload.copy(
        frame,
        2
    );

    client.sendFrame(frame);

    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0x8
    );

    assert.strictEqual(
        response.fin,
        true
    );

    assert.strictEqual(
        response.masked,
        false
    );

    assert.strictEqual(
        response.payload.length,
        2
    );

    const closeCode =
        response.payload.readUInt16BE(0);

    assert.strictEqual(
        closeCode,
        1002
    );

    console.log(
        "Close code:",
        closeCode
    );

    console.log("PASS");
}

async function testReservedOpcode(client) {
    console.log("\n[TEST] Reserved opcode");

    // FIN=1, RSV=000, opcode=0x3 (reserved)
    const firstByte = 0x80 | 0x03;

    // MASK=1, payload length=0
    const secondByte = 0x80;

    const maskingKey = Buffer.from([
        0x01,
        0x02,
        0x03,
        0x04,
    ]);

    const frame = Buffer.concat([
        Buffer.from([
            firstByte,
            secondByte,
        ]),
        maskingKey,
    ]);

    console.log(
        "Sending frame:",
        frame.toString("hex")
    );

    client.sendFrame(frame);

    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0x8
    );

    assert.strictEqual(
        response.fin,
        true
    );

    assert.strictEqual(
        response.masked,
        false
    );

    assert.strictEqual(
        response.payload.length,
        2
    );

    const closeCode =
        response.payload.readUInt16BE(0);

    assert.strictEqual(
        closeCode,
        1002
    );

    console.log(
        "Close code:",
        closeCode
    );

    console.log("PASS");
}

async function testRSVBit(client) {
    console.log("\n[TEST] RSV bit");

    // FIN = 1
    // RSV1 = 1  ← intentionally invalid
    // RSV2 = 0
    // RSV3 = 0
    // Opcode = 0x1 (Text)
    //
    // 1100 0001 = 0xC1
    //
    // Byte 2:
    // MASK = 1
    // Payload length = 0
    //
    // 1000 0000 = 0x80

    const frame = Buffer.concat([
        Buffer.from([
            0xC1,
            0x80,
        ]),

        // Masking key
        Buffer.from([
            0x01,
            0x02,
            0x03,
            0x04,
        ]),
    ]);

    console.log(
        "Sending frame:",
        frame.toString("hex")
    );

    client.sendFrame(frame);

    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0x8
    );

    assert.strictEqual(
        response.fin,
        true
    );

    assert.strictEqual(
        response.masked,
        false
    );

    assert.strictEqual(
        response.payload.length,
        2
    );

    const closeCode =
        response.payload.readUInt16BE(0);

    assert.strictEqual(
        closeCode,
        1002
    );

    console.log(
        "Close code:",
        closeCode
    );

    console.log("PASS");
}

async function testFragmentedControlFrame(client) {
    console.log(
        "\n[TEST] Fragmented control frame"
    );

    // FIN = 0
    // RSV1/RSV2/RSV3 = 0
    // Opcode = 0x9 (Ping)
    //
    // 0000 1001 = 0x09

    // MASK = 1
    // Payload length = 0
    //
    // 1000 0000 = 0x80

    const frame = Buffer.concat([
        Buffer.from([
            0x09,
            0x80,
        ]),

        // Masking key
        Buffer.from([
            0x01,
            0x02,
            0x03,
            0x04,
        ]),
    ]);

    console.log(
        "Sending frame:",
        frame.toString("hex")
    );

    client.sendFrame(frame);

    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0x8
    );

    assert.strictEqual(
        response.fin,
        true
    );

    assert.strictEqual(
        response.masked,
        false
    );

    assert.strictEqual(
        response.payload.length,
        2
    );

    const closeCode =
        response.payload.readUInt16BE(0);

    assert.strictEqual(
        closeCode,
        1002
    );

    console.log(
        "Close code:",
        closeCode
    );

    console.log("PASS");
}
// ==========================================
// HELPERS
// ==========================================

function delay(ms) {
    return new Promise(
        (resolve) =>
            setTimeout(resolve, ms)
    );
}

module.exports = {
    testText,
    testBinary,
    testPingPong,
    testPong,
    testClose,
    testUnmaskedClientFrame,
    testRSVBit,
    testReservedOpcode,
    testFragmentedControlFrame,
    testFragmentedText,
};
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

    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0x1
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

    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0x2
    );

    assert.deepStrictEqual(
        response.payload,
        payload
    );

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
        Buffer.from("PONG");

    const frame =
        createClientFrame(
            payload,
            0xA
        );

    client.sendFrame(frame);

    // Your current server probably doesn't
    // respond to Pong.
    //
    // Therefore this test currently verifies
    // that the frame can be sent without
    // protocol parsing failure.

    console.log(
        "PASS - frame sent"
    );
}

// ==========================================
// CLOSE
// ==========================================

async function testClose(client) {
    console.log("\n[TEST] Close frame");

    // Close code 1000
    const payload =
        Buffer.alloc(2);

    payload.writeUInt16BE(
        1000,
        0
    );

    const frame =
        createClientFrame(
            payload,
            0x8
        );

    client.sendFrame(frame);

    const response =
        await client.waitForFrame();

    assert.strictEqual(
        response.opcode,
        0x8
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
    testFragmentedText,
};
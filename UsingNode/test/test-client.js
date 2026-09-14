const {
    WebSocketTestClient,
} = require("./websocket/tcp-client");

const {
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
} = require("./websocket/test-cases");

async function main() {
    try {
        await runTest(
            "Ping → Pong",
            testPingPong
        );

        await runTest(
            "Text frame",
            testText
        );

        await runTest(
            "Binary frame",
            testBinary
        );

        await runTest(
            "Pong frame",
            testPong
        );

        await runTest(
            "RSV bit",
            testRSVBit
        );

        await runTest(
            "Fragmented control frame",
            testFragmentedControlFrame
        );

        await runTest(
            "Reserved opcode",
            testReservedOpcode
        );

        await runTest(
            "Unmasked client frame",
            testUnmaskedClientFrame
        );

        await runTest(
            "Close frame",
            testClose
        );

        await runTest(
            "Fragmented text",
            testFragmentedText
        );

        console.log(
            "\nAll enabled tests passed."
        );

    } catch (error) {
        console.error(
            "\nTEST FAILED:"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;
    }
}

async function runTest(testName, testFunction) {
    const client =
        new WebSocketTestClient({
            host: "127.0.0.1",
            port: 8000,
            path: "/",
        });

    try {
        console.log(
            `\nConnecting for: ${testName}`
        );

        await client.connect();

        console.log(
            "WebSocket handshake successful"
        );

        await testFunction(client);

    } finally {
        client.close();
    }
}

main();
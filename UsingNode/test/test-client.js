const {
    WebSocketTestClient,
} = require("./websocket/tcp-client");

const {
    testText,
    testBinary,
    testPingPong,
    testPong,
    testClose,
    testFragmentedText,
} = require("./websocket/test-cases");

async function main() {
    const client =
        new WebSocketTestClient({
            host: "127.0.0.1",
            port: 8000,
            path: "/",
        });

    try {
        console.log(
            "Connecting to WebSocket server..."
        );

        await client.connect();

        console.log(
            "WebSocket handshake successful"
        );

        await testPingPong(client);

        await testText(client);

        await testBinary(client);

        await testPong(client);

        // Don't run these yet if your server
        // doesn't implement them completely.
        //
        // await testClose(client);
        // await testFragmentedText(client);

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
    } finally {
        client.close();
    }
}

main();
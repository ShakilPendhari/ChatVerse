const usernameInput = document.getElementById("usernameInput");
const messageInput = document.getElementById("messageInput");

const joinButton = document.getElementById("joinButton");
const sendButton = document.getElementById("sendButton");

joinButton.addEventListener("click", () => {
    const username = usernameInput.value.trim();

    if (!username) {
        usernameInput.focus();
        return;
    }

    console.log("Username entered:", username);
});

sendButton.addEventListener("click", () => {
    const message = messageInput.value.trim();

    if (!message) {
        messageInput.focus();
        return;
    }

    console.log("Message entered:", message);

    messageInput.value = "";
});

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendButton.click();
    }
});

function callWebsocket() {
    const ws = new WebSocket("ws://localhost:8000");
    ws.onopen = () => {
        console.log("WebSocket connected");
        // // 1 byte payload
        // ws.send("A");

        // // 2 byte payload
        // ws.send("AB")

        // 126 byte payload
        ws.send("A".repeat(700000))

        //
        // ws.send("A".repeat(65537))
    };
}
callWebsocket();

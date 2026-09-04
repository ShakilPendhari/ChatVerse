const http = require("http");
const fs = require("fs")
const path = require("path")
const crypto = require("crypto");
const { Buffer } = require("buffer")

const PORT = 8000;
const METHODS = {
    GET: "GET",
}


const server = http.createServer((req, res) => {
    const method = req.method;
    const url = req.url;

    if (url === "/" && method === METHODS.GET) {
        const filePath = path.join(__dirname, "public", "index.html")
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(400, { "Content-Type": "text/plain" })
            }
            else {
                res.writeHead(200, { "Content-Type": "text/html" })
                res.write(data);
            }
            res.end();
        })

    }
    else if (url === "/style.css" && method === METHODS.GET) {
        const filePath = path.join(__dirname, "public", "style.css")
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.log("css error:-->", err)
                res.writeHead(400, { "Content-Type": "text/plain" })
                res.end("<h1>Something went wron with css file</h1>")
            }
            else {
                res.writeHead(200, { "Content-Type": "text/css" })
                res.write(data);
                res.end();
            }
        })

    }
    else if (url === "/app.js" && method === METHODS.GET) {
        const filePath = path.join(__dirname, "public", "app.js")
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(400, { "Content-Type": "text/plain" })
                res.end("<h1>Something went wrong with js file</h1>")
            }
            else {
                res.writeHead(200, { "Content-Type": "text/javascript" })
                res.write(data);
                res.end();
            }
        })

    }
    else {
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end("<h1>Not Found</h1>");
    }
})

server.on("upgrade", (req, socket, head) => {
    const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    const secWebSocketKey = req.headers["sec-websocket-key"];
    const acceptKey = crypto.createHash("sha1").update(secWebSocketKey + GUID).digest("base64")

    const accpetHeader = [
        `HTTP/1.1 101 Switching Protocols`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Accept: ${acceptKey}`,
        "",
        ""
    ].join("\r\n");

    console.log("accpetHeader", accpetHeader)

    socket.write(accpetHeader)


    socket.on("data", (buffer) => {
        // 1st byte : FIN = 1st bit, RSV1+RSV2+RSV3 = 3 bit (Reserve for extension), opcode = 4 bit [(0001 = text), (0010 = binary), (0011 to 0111 = empty), (1000 = close), (1001 = ping), (1010 = pong)] --> opcode is about frame
        // 2nd byte : MASK = 1st bit is 1 then true otherwise false, 7 bit [decimal in between = (0 - 125) then there will not be the extented payload length, decimal = 126 then the range from the (128 - 65535), decimal = 127 then the range from the (65536 - infinity)]
        // if range is from the (0 - 125) then the payload length is the actual value
        // if range is (126) then the payload length is 2 (we need to read the next 2 bytes for the payload length)
        // if range is (127) then the payload length is 8 (we need to read the next 8 bytes for the payload length)
        // if payload length (0 - 125) then the 3rd to 6 byte will be the "maskable-key" and the remaining bytes will be the "masked-payload"
        // if payload length is 126 then 3rd and 4th byte will be the "payload-length" then the next for bytes from the  5th to 8th will be the "maskable-key" and after that the remaining payload will be the "masked-payload"
        // if payload length is 127 then the next 8 bytes will be the "payload-length" from 3rd to 10th and the next 4 will be "maskable-key" from the 11th to the 14th bytes after that the remaining bytes will be the "masked-payload"

        // Now we get the actual data from raw data
        // Get the 1st and 2nd byte from the buffer
        const byte1 = buffer[0];   // 1st byte
        const byte2 = buffer[1];   // 2nd byte

        // STEP1: Now check is this the last frame? if FIN = 1 then that will be the last frame
        const fin = (byte1 & 0x80) === 0x80;  // this is the bitwise and operator inside that will be the "true + true = true" other all will be false like "true + false", "false + false", "false + false" (actual calculation like this
        //   10000001 
        // & 10000000 
        //   10000000)

        // STEP2: The information of frame
        const opcode = (byte1 & 0x0f) === 0x01; // 100000001 & 00001111 === 00000001 which is 1 in decimal (1 base 10 = 00000001 base 2) [ 1 means the payload is text, 2 means the payload is binary etc]
        //   10000001 
        // & 00001111 
        //   00000001

        // STEP3: Get the status of mask
        const isMasked = (byte2 & 0x80) === 0x80;

        // STEP4: Get the payload length
        let payloadLengthInfo = byte2 & 0x7f;
        //   11111111
        // & 01111111
        //   01111111

        //   11111000
        // & 01111111
        //   01111000

        // if the range is from the 0 to 125 then that is the actual length of the payload
        let maskedKeyOffSet;
        let payloadOffSet;
        let payloadLength = payloadLengthInfo;
        const firstTwoHeaders = 2;
        if (payloadLengthInfo >= 0 && payloadLengthInfo <= 125) {
            maskedKeyOffSet = 2;
            payloadOffSet = maskedKeyOffSet + 4;
        }
        else if (payloadLengthInfo === 126) {
            maskedKeyOffSet = 4;    // header (2 bytes + 2 bytes payload length)
            payloadOffSet = maskedKeyOffSet + 4  // 8
            payloadLength = Number(buffer.readUInt16BE(firstTwoHeaders));
        }
        else if (payloadLengthInfo === 127) {
            maskedKeyOffSet = 10  // header (2 bytes + 8 bytes payload length)
            payloadOffSet = maskedKeyOffSet + 4  // 14
            payloadLength = Number(buffer.readBigUInt64BE(firstTwoHeaders));
        }
        const maskbleKey = buffer.subarray(maskedKeyOffSet, maskedKeyOffSet + 4);
        const maskedPayload = buffer.subarray(payloadOffSet, payloadOffSet + payloadLength)

        const unmaskedPayload = Buffer.alloc(payloadLength)
        for (let i = 0; i < payloadLength; i++) {
            unmaskedPayload[i] = maskedPayload[i] ^ maskbleKey[i % 4];
        }
        // Now you can easily convert to string or inspect raw bytes:
        console.log("Unmasked Bytes:", [...unmaskedPayload]);
        console.log("Decoded Message:", unmaskedPayload.toString("utf8"));
    })
})


server.listen(PORT, () => {
    console.log(`Server is listening on the port number ${PORT}`)
})
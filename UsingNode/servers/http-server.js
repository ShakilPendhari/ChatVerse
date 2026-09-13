const http = require("http");
const fs = require("fs");
const path = require("path");

// ==========================================
// HTTP FILE SERVER
// ==========================================

const METHODS = {
    GET: "GET",
};

const PUBLIC_DIR = path.join(__dirname, "..", "public");

const server = http.createServer((req, res) => {
    const method = req.method;
    const url = req.url;

    if (method !== METHODS.GET) {
        res.writeHead(405, {
            "Content-Type": "text/plain",
        });

        res.end("Method Not Allowed");
        return;
    }

    let filePath;
    let contentType;

    switch (url) {
        case "/":
            filePath = path.join(PUBLIC_DIR, "index.html");
            contentType = "text/html";
            break;

        case "/style.css":
            filePath = path.join(PUBLIC_DIR, "style.css");
            contentType = "text/css";
            break;

        case "/app.js":
            filePath = path.join(PUBLIC_DIR, "app.js");
            contentType = "text/javascript";
            break;

        default:
            res.writeHead(404, {
                "Content-Type": "text/html",
            });

            res.end("<h1>404 Not Found</h1>");
            return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error("File read error:", err);

            res.writeHead(500, {
                "Content-Type": "text/plain",
            });

            res.end("Internal Server Error");
            return;
        }

        res.writeHead(200, {
            "Content-Type": contentType,
        });

        res.end(data);
    });
});

module.exports = server;
const http = require("http");
const fs = require("fs")
const path = require("path")

const PORT = 8000;
const METHODS = {
    GET: "GET",
    PUT: "PUT",
    PATCH: "PATCH",
    POST: "POST",
    DELETE: "DELETE"
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
        console.log("directoryName", __dirname, "fileName", __filename)
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end("<h1>Not Found</h1>");
    }
})


server.listen(PORT, () => {
    console.log(`Server is listening on the port number ${PORT}`)
})
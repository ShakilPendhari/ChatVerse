const httpServer = require("./servers/http-server.js");
require("./servers/websocket-server.js");
const { PORT } = require("./constants.js")


httpServer.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
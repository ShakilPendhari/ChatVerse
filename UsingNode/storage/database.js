const fs = require("fs")
const path = require("path")
class Database {
    constructor() {
        this.databasePath = path.join(__dirname, "database.json");
        this.data = this.readDatabaseFile();
    }

    readDatabaseFile() {
        const data = fs.readFileSync(this.databasePath, "utf8") || null;
        return JSON.parse(data);
    }

    findUserById(userId) {
        return this.data.users.find(user => user.id === userId) || null;
    }

    findUserByEmail(email) {
        return this.data.users.find(user => user.email === email) || null
    }
}

module.exports = Database;
const Database = require("./../storage/database.js");

const database = new Database();

console.log(database.findUserById("user_101"));
console.log(database.findUserById("user_999"));

console.log(database.findUserByEmail("rahul@example.com"));
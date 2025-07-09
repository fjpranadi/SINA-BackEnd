const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: '+08:00',
  multipleStatements: true
});

// Set timezone saat koneksi dibuat
db.on('connection', (connection) => {
  connection.query("SET time_zone = '+08:00'");
});

module.exports = db;

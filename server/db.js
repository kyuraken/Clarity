const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
});

async function initDB() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255),
      display_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS plaid_items (
      item_id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(128) NOT NULL,
      access_token VARCHAR(255) NOT NULL,
      institution_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS dismissed_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(128) NOT NULL,
      transaction_id VARCHAR(255) NOT NULL,
      dismissed_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_dismissal (user_id, transaction_id)
    )
  `);

  console.log('Database tables ready');
}

module.exports = { pool, initDB };

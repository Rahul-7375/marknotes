const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'marknotes',
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : null,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initDB() {
  try {
    const connection = await pool.getConnection();
    
    // Create notes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        title      VARCHAR(255) NOT NULL DEFAULT 'Untitled Note',
        content    TEXT NOT NULL,
        tags       JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create versions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS note_versions (
        id       INT AUTO_INCREMENT PRIMARY KEY,
        note_id  INT NOT NULL,
        title    VARCHAR(255) NOT NULL,
        content  TEXT NOT NULL,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Indices are handled by PRIMARY KEY but we can add more if needed
    // CREATE INDEX is slightly different in MySQL for 'IF NOT EXISTS' 
    // but we can just let it fail silently or use a more complex check.
    
    console.log('✅ MySQL Database Initialized');
    connection.release();
  } catch (error) {
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(`❌ Database "${process.env.DB_NAME}" does not exist. Please create it first.`);
    } else {
      console.error('❌ Database Initialization Error:', error.message);
    }
    // We don't exit here to allow server to potentially retry or show useful error
  }
}

initDB();

module.exports = pool;

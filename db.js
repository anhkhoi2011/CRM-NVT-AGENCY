'use strict';

// Nạp cấu hình trước khi tạo pool, kể cả khi chạy trực tiếp server.
require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const mysql = require('mysql2/promise');

const dbHost = String(process.env.DB_HOST || '').trim();
const dbUser = String(process.env.DB_USER || '').trim();
const dbName = String(process.env.DB_NAME || '').trim();
const pool = mysql.createPool({
  host: dbHost || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: dbUser,
  password: process.env.DB_PASSWORD || '',
  database: dbName,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  queueLimit: Number(process.env.DB_QUEUE_LIMIT || 20),
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 8000),
  charset: 'utf8mb4',
  dateStrings: true
});

// Chỉ coi MySQL là đã cấu hình khi đủ các định danh bắt buộc. Nếu thiếu một biến,
// API trả 503 rõ ràng thay vì chờ pool kết nối bằng thông tin rỗng rồi làm login timeout.
const dbConfigured = Boolean(dbHost && dbUser && dbName);
async function dbQuery(sql, params = []) { const [rows] = await pool.execute(sql, params); return rows; }
async function dbHealth() { if (!dbConfigured) return { configured: false }; await pool.query('SELECT 1'); return { configured: true }; }

module.exports = { pool, dbConfigured, dbQuery, dbHealth };

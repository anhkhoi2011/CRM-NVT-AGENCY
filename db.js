'use strict';

// Nạp cấu hình trước khi tạo pool, kể cả khi chạy trực tiếp server.
require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const mysql = require('mysql2/promise');
const { managedPool } = require('./managed-pool.cjs');
function setting(name, fallback, minimum = 1) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum) throw new Error('Invalid database setting: ' + name);
  return value;
}

const dbHost = String(process.env.DB_HOST || '').trim();
const dbUser = String(process.env.DB_USER || '').trim();
const dbName = String(process.env.DB_NAME || '').trim();
const connectionOptions = {
  host: dbHost || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: dbUser,
  password: process.env.DB_PASSWORD || '',
  database: dbName,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: setting('DB_CONNECT_TIMEOUT', 10000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  charset: 'utf8mb4',
  dateStrings: true
};
function createManagedPool(limit, queueLimit) {
  const raw = mysql.createPool({ ...connectionOptions, connectionLimit: limit,
    maxIdle: Math.max(1, Math.ceil(limit * 0.5)), idleTimeout: 30000 });
  raw.on('error', error => {
    // Observe pool errors; mysql2 manages removal of failed connections.
    console.warn('[mysql-pool-error]', error.code || error.message || 'POOL_ERROR');
  });
  raw.on('connection', connection => connection.on('error', error => {
    console.warn('[mysql-connection]', error.code || 'CONNECTION_ERROR');
  }));
  return managedPool(raw, { limit, queueLimit,
    acquireTimeout: setting('DB_ACQUIRE_TIMEOUT', 10000),
    queryTimeout: setting('DB_QUERY_TIMEOUT', 10000) });
}
const pool = createManagedPool(setting('DB_CONNECTION_LIMIT', 60), setting('DB_QUEUE_LIMIT', 0, 0));
// Authentication must not wait behind large CRM snapshots or Telegram outbox
// delivery. Keep an independent pool for login and session creation.
const authPool = createManagedPool(setting('DB_AUTH_CONNECTION_LIMIT', 25), setting('DB_AUTH_QUEUE_LIMIT', 0, 0));
// Advisory locks must stay on one connection, isolated from foreground queries.
const telegramPool = createManagedPool(1, 1);

// Chỉ coi MySQL là đã cấu hình khi đủ các định danh bắt buộc. Nếu thiếu một biến,
// API trả 503 rõ ràng thay vì chờ pool kết nối bằng thông tin rỗng rồi làm login timeout.
const dbConfigured = Boolean(dbHost && dbUser && dbName);
async function dbQuery(sql, params = []) { const [rows] = await pool.execute(sql, params); return rows; }
async function authQuery(sql, params = []) { const [rows] = await authPool.execute(sql, params); return rows; }
async function dbHealth() { if (!dbConfigured) return { configured: false }; await pool.query('SELECT 1'); return { configured: true }; }

module.exports = { pool, authPool, telegramPool, dbConfigured, dbQuery, authQuery, dbHealth };

'use strict';

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  queueLimit: 0,
  charset: 'utf8mb4'
});

const dbConfigured = Boolean(process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER);
async function dbQuery(sql, params = []) { const [rows] = await pool.execute(sql, params); return rows; }
async function dbHealth() { if (!dbConfigured) return { configured: false }; await pool.query('SELECT 1'); return { configured: true }; }

module.exports = { pool, dbConfigured, dbQuery, dbHealth };

"use strict";
const { pool, dbConfigured } = require('./db.js');
let ready;
// Chỉ tạo bảng bổ sung; không sửa hoặc xóa bảng khách hàng hiện có.
function ensureSchema() {
  if (!dbConfigured) return Promise.reject(new Error('MySQL chưa được cấu hình'));
  if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(96) PRIMARY KEY,
  dedupe_key CHAR(64) NOT NULL UNIQUE,
  payload_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`).catch(error => { ready = null; throw error; });
  return ready;
}
async function persistWebhook(record) {
  await ensureSchema();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO webhook_events (id, dedupe_key, payload_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = id', [record.id, record.dedupeKey, JSON.stringify(record)]);
    const [rows] = await connection.execute('SELECT id FROM webhook_events WHERE dedupe_key = ?', [record.dedupeKey]);
    const eventId = rows[0].id;
    const customerId = `CUS-${eventId}`;
    if (record.status === 'NEW') {
      // Cùng bản gửi luôn dùng một ID; replay không ghi đè phân công/trạng thái cũ.
      await connection.execute(`INSERT INTO customers (id, name, phone, email, source, status, note, custom_fields_json, created_at)
        VALUES (?, ?, ?, ?, 'Landing Page', 'NEW', ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`,
      [customerId, record.customer.name, record.customer.phone, record.customer.email || null,
        `Landing page webhook: ${record.slug}`, JSON.stringify({ webhookSlug: record.slug, webhookEventId: eventId }), record.receivedAt]);
    }
    await connection.commit();
    return { eventId, customerId: record.status === 'NEW' ? customerId : null };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
module.exports = { persistWebhook };

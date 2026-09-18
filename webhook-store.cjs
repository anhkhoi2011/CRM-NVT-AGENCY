"use strict";
const { pool, dbConfigured } = require('./db.js');
const defaultWebsites = require('./crm-defaults.json').websites || [];
const crmData = require('./crm-data.cjs');
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
function parsed(value) {
  if (!value) return null;
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; }
}
function extractReferenceAmount(raw) {
  const values = raw && typeof raw === 'object' ? raw : {};
  const aliases = new Set(['referenceamount','amountreference','sotienkhachthamkhao','sotienkhachhang','sotien','von','capital','budget','investment','khoandautu','taichinh','financialcapacity','customerbudget','recentamount']);
  for (const [key, value] of Object.entries(values)) {
    const normalized = String(key).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const inferredReference = normalized.includes('sotien') && (normalized.includes('thamkhao') || normalized.includes('khach'));
    if (!aliases.has(normalized) && !inferredReference) continue;
    const digits = String(value ?? '').replace(/[^0-9]/g, '');
    if (!digits) continue;
    const amount = Number(digits);
    if (Number.isFinite(amount) && amount >= 0 && amount <= 1e15) return amount;
  }
  return null;
}
function cleanSourceUrl(value, domain = '') {
  const raw = String(value || (domain ? `https://${domain}/` : '')).trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return '';
    url.hash = '';
    return url.toString();
  } catch { return ''; }
}
async function sourceBySlug(connection, slug) {
  const wanted = String(slug || '').toUpperCase();
  const [rows] = await connection.execute("SELECT id, body FROM crm_documents WHERE collection='websites' AND deleted=0");
  const configured = rows.map(row => ({ id: row.id, ...parsed(row.body) })).find(website => String(website.webhookSlug || '').toUpperCase() === wanted);
  const website = configured || defaultWebsites.find(item => String(item.webhookSlug || '').toUpperCase() === wanted);
  if (!website) return null;
  const sourceUrl = cleanSourceUrl(website.sourceUrl, website.domain);
  let domain = String(website.domain || '').trim().toLowerCase();
  if (!domain && sourceUrl) try { domain = new URL(sourceUrl).hostname.toLowerCase(); } catch {}
  return { id: website.id, name: String(website.name || domain || 'Landing page'), domain, sourceUrl, campaign: String(website.campaignId || 'UNATTRIBUTED') };
}
async function persistWebhook(record) {
  await ensureSchema();
  await crmData.prepare();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Cung khoa voi API CRM de phan cong va con tro ty trong luon nhat quan.
    await connection.query('SELECT id FROM crm_write_lock WHERE id=1 FOR UPDATE');
    const website = await sourceBySlug(connection, record.slug);
    const sourceSnapshot = website ? { websiteId: website.id, landingPageName: website.name, landingPageUrl: website.sourceUrl, landingPageDomain: website.domain, campaign: website.campaign } : null;
    const storedRecord = sourceSnapshot ? { ...record, source: sourceSnapshot } : record;
    await connection.execute('INSERT INTO webhook_events (id, dedupe_key, payload_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = id', [record.id, record.dedupeKey, JSON.stringify(storedRecord)]);
    const [rows] = await connection.execute('SELECT id FROM webhook_events WHERE dedupe_key = ?', [record.dedupeKey]);
    const eventId = rows[0].id;
    const customerId = `CUS-${eventId}`;
    if (record.status === 'NEW') {
      // Lưu ảnh chụp nguồn cùng khách; replay không ghi đè phân công/trạng thái cũ.
      const referenceAmount = extractReferenceAmount(record.raw);
      const meta = { webhookSlug: record.slug, webhookEventId: eventId };
      if (referenceAmount !== null) meta.referenceAmount = referenceAmount;
      if (sourceSnapshot) Object.assign(meta, sourceSnapshot);
      await connection.execute(`INSERT INTO customers (id, name, phone, email, source, campaign, website_id, status, note, custom_fields_json, created_at)
        VALUES (?, ?, ?, ?, 'Landing Page', ?, ?, 'NEW', ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`,
      [customerId, record.customer.name, record.customer.phone, record.customer.email || null,
        website?.campaign || 'UNATTRIBUTED', website?.id || null,
        website ? `Data từ ${website.sourceUrl || website.domain}` : 'Data landing page chưa gắn nguồn',
        JSON.stringify({ __crmMeta: meta, __crmFields: {} }), record.receivedAt]);
    }
    if (record.status === 'NEW') await crmData.distributeAutomatic(connection);
    await connection.commit();
    return { eventId, customerId: record.status === 'NEW' ? customerId : null, source: sourceSnapshot };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
module.exports = { persistWebhook, sourceBySlug, cleanSourceUrl };

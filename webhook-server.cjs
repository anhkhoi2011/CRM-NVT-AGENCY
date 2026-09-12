/**
 * Server webhook + static cho CRM NVT Agency.
 *
 * Chạy:  node webhook-server.cjs
 * Mặc định: http://localhost:4173  (bind 0.0.0.0 nên máy khác trong LAN vào được)
 *
 * Hai việc:
 *  1. Phục vụ file tĩnh của repo (thay `python -m http.server 4173`).
 *  2. Nhận data landing page thật tại:
 *        POST /api/data-sources/webhook/ds-<13 số>-<11 ký tự A-Z0-9>/
 *     LadiPage gọi endpoint này. Data được ghi vào inbox bất biến trên đĩa,
 *     CRM (crm.js) đọc inbox rồi đưa vào Chia Leader.
 *
 * Không có dependency ngoài. Node >= 18 (dùng fetch/global có sẵn).
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { dbConfigured, dbQuery, dbHealth } = require('./db.js');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch { /* email optional until npm install */ }

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const REPO_ROOT = path.resolve(__dirname);
const DEFAULT_WEBHOOK_DATA_DIR = process.env.WEBHOOK_DATA_DIR
  ? path.resolve(process.env.WEBHOOK_DATA_DIR)
  : path.join(process.env.HOME || path.dirname(REPO_ROOT), 'webhook-data');
const INBOX_FILE = process.env.WEBHOOK_INBOX_FILE
  ? path.resolve(process.env.WEBHOOK_INBOX_FILE)
  : path.join(DEFAULT_WEBHOOK_DATA_DIR, '.webhook-inbox.json');
const MAX_BODY_BYTES = 256 * 1024;
const MAX_INBOX_RECORDS = 5000;

const EMAIL_TOKEN = (process.env.CRM_EMAIL_TOKEN || '').trim();
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE !== 'false' : SMTP_PORT === 465;
const SMTP_USER = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').trim();
const SMTP_FROM = (process.env.SMTP_FROM || SMTP_USER).trim();
const SMTP_ENABLED = Boolean(nodemailer && SMTP_USER && SMTP_PASS && SMTP_FROM);
const mailTransporter = SMTP_ENABLED ? nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
}) : null;

const dbSessions = new Map();
function dbJson(request, response, status, payload) { return sendJson(response, status, payload, { 'Access-Control-Allow-Origin': request.headers.origin || '*', Vary: 'Origin' }); }
function authUser(request) {
  const value = String(request.headers.authorization || '');
  const token = value.replace(/^Bearer\s+/i, '').trim();
  const session = token && dbSessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (token) dbSessions.delete(token); return null; }
  return session.user;
}
function readDbBody(request) { return readBody(request).then(buffer => JSON.parse(buffer.toString('utf8') || '{}')); }
function dbUser(row) { return { id: row.id, phone: row.phone, email: row.email, name: row.name, role: row.role, teamId: row.team_id, leaderId: row.leader_id, active: Boolean(row.active) }; }
function dbCustomer(row) { return { ...row, customFields: row.custom_fields_json || {}, createdAt: row.created_at, updatedAt: row.updated_at, saleId: row.sale_id, leaderId: row.leader_id, teamId: row.team_id, websiteId: row.website_id }; }
function dbOrder(row) { return { ...row, total: Number(row.total_amount), items: row.items_json || [], customerId: row.customer_id, saleId: row.sale_id, leaderId: row.leader_id, teamId: row.team_id, createdAt: row.created_at, updatedAt: row.updated_at }; }
function dbProduct(row) { return { ...row, price: Number(row.price), rentalMonths: row.rental_months, createdAt: row.created_at, updatedAt: row.updated_at }; }

async function handleDbApi(request, response, pathname) {
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Origin': request.headers.origin || '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' }); return response.end(); }
  if (!dbConfigured) return dbJson(request, response, 503, { error: 'MySQL chưa được cấu hình trên server' });
  try {
    if (pathname === '/api/db/health') return dbJson(request, response, 200, await dbHealth());
    if (pathname === '/api/auth/login' && request.method === 'POST') {
      const body = await readDbBody(request); const rows = await dbQuery('SELECT * FROM users WHERE (phone = ? OR email = ?) AND active = 1 LIMIT 1', [String(body.identifier || ''), String(body.identifier || '').toLowerCase()]); const row = rows[0];
      if (!row || String(body.password || '') !== String(row.password_hash || '')) return dbJson(request, response, 401, { error: 'Thông tin đăng nhập không đúng' });
      const token = crypto.randomBytes(32).toString('hex'); dbSessions.set(token, { user: dbUser(row), expiresAt: Date.now() + 86400000 }); return dbJson(request, response, 200, { token, user: dbUser(row) });
    }
    if (pathname === '/api/auth/me' && request.method === 'GET') { const user = authUser(request); return user ? dbJson(request, response, 200, { user }) : dbJson(request, response, 401, { error: 'Phiên đăng nhập không hợp lệ' }); }
    const user = authUser(request); if (!user) return dbJson(request, response, 401, { error: 'Cần đăng nhập' });
    const [resource, id] = pathname.replace('/api/', '').split('/');
    if (resource === 'customers') {
      if (request.method === 'GET') { const where = user.role === 'SALE' ? 'WHERE sale_id = ?' : user.role === 'LEADER' ? 'WHERE leader_id = ? OR team_id = ?' : ''; const params = user.role === 'SALE' ? [user.id] : user.role === 'LEADER' ? [user.id, user.teamId] : []; const rows = await dbQuery(`SELECT * FROM customers ${where} ORDER BY updated_at DESC`, params); return dbJson(request, response, 200, { items: rows.map(dbCustomer) }); }
      const body = await readDbBody(request); if (request.method === 'POST') { await dbQuery('INSERT INTO customers (id,name,phone,email,source,campaign,website_id,status,sale_id,leader_id,team_id,note,custom_fields_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [body.id,body.name,body.phone,body.email||null,body.source||null,body.campaign||null,body.websiteId||null,body.status||'NEW',body.saleId||null,body.leaderId||null,body.teamId||null,body.note||null,JSON.stringify(body.customFields||{})]); return dbJson(request,response,201,{item:body}); }
      if (request.method === 'PUT' && id) { await dbQuery('UPDATE customers SET name=?,phone=?,email=?,source=?,campaign=?,status=?,sale_id=?,leader_id=?,team_id=?,note=?,custom_fields_json=? WHERE id=?',[body.name,body.phone,body.email||null,body.source||null,body.campaign||null,body.status||'NEW',body.saleId||null,body.leaderId||null,body.teamId||null,body.note||null,JSON.stringify(body.customFields||{}),id]); return dbJson(request,response,200,{ok:true}); }
    }
    if (resource === 'orders') {
      if (request.method === 'GET') { const where = user.role === 'SALE' ? 'WHERE sale_id = ?' : ''; const rows = await dbQuery(`SELECT * FROM orders ${where} ORDER BY updated_at DESC`, user.role === 'SALE' ? [user.id] : []); return dbJson(request,response,200,{items:rows.map(dbOrder)}); }
      const body = await readDbBody(request); if (request.method === 'POST') { await dbQuery('INSERT INTO orders (id,code,customer_id,sale_id,leader_id,team_id,total_amount,status,items_json,note) VALUES (?,?,?,?,?,?,?,?,?,?)',[body.id,body.code,body.customerId,body.saleId||null,body.leaderId||null,body.teamId||null,body.total||0,body.status||'PENDING',JSON.stringify(body.items||[]),body.note||null]); return dbJson(request,response,201,{item:body}); }
      if (request.method === 'PUT' && id) { await dbQuery('UPDATE orders SET code=?,customer_id=?,sale_id=?,leader_id=?,team_id=?,total_amount=?,status=?,items_json=?,note=? WHERE id=?',[body.code,body.customerId,body.saleId||null,body.leaderId||null,body.teamId||null,body.total||0,body.status||'PENDING',JSON.stringify(body.items||[]),body.note||null,id]); return dbJson(request,response,200,{ok:true}); }
    }
    if (resource === 'products') { if (request.method === 'GET') return dbJson(request,response,200,{items:(await dbQuery('SELECT * FROM products WHERE active=1 ORDER BY name')).map(dbProduct)}); const body=await readDbBody(request); if(request.method==='POST'){await dbQuery('INSERT INTO products (id,sku,name,category,price,type,rental_months,active) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),price=VALUES(price),active=VALUES(active)',[body.id,body.sku||null,body.name,body.category||null,body.price||0,body.type||'SALE',body.rentalMonths||null,body.active===false?0:1]);return dbJson(request,response,201,{item:body});} }
    return dbJson(request,response,404,{error:'API không tồn tại'});
  } catch (error) { console.error('[mysql-api]', error); return dbJson(request,response,500,{error:'Lỗi cơ sở dữ liệu'}); }
}

/**
 * Token tùy chọn. LadiPage cho phép khai báo "API Request Header" là một object
 * JSON tùy ý, ví dụ {"token": "abc"}. Nếu đặt WEBHOOK_TOKEN thì server từ chối
 * request không mang token này ở một trong các header dưới đây.
 * Để trống = không kiểm tra (tiện khi mới nối thử).
 */
const WEBHOOK_TOKEN = (process.env.WEBHOOK_TOKEN || '').trim();
const TOKEN_HEADERS = ['x-api-key', 'x-webhook-token', 'token', 'authorization'];

const WEBHOOK_PATH_PATTERN = /^\/api\/data-sources\/webhook\/([^/]+)\/?$/;
const SLUG_PATTERN = /^ds-\d{13}-[A-Z0-9]{11}$/i;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8'
};

/* ------------------------------------------------------------------ inbox */

let inbox = [];
let inboxFlushScheduled = false;

function loadInbox() {
  try {
    const raw = fs.readFileSync(INBOX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    inbox = Array.isArray(parsed) ? parsed.filter(item => item && item.id) : [];
  } catch {
    inbox = [];
  }
}

function flushInbox() {
  inboxFlushScheduled = false;
  const tmp = `${INBOX_FILE}.${process.pid}.tmp`;
  try { fs.mkdirSync(path.dirname(INBOX_FILE), { recursive: true }); } catch (error) {
    console.error('[inbox] cannot create inbox directory:', error.message);
    return;
  }
  try {
    fs.writeFileSync(tmp, JSON.stringify(inbox, null, 2), 'utf8');
    fs.renameSync(tmp, INBOX_FILE);
  } catch (error) {
    console.error('[inbox] không ghi được file inbox:', error.message);
  }
}

function scheduleFlush() {
  if (inboxFlushScheduled) return;
  inboxFlushScheduled = true;
  setImmediate(flushInbox);
}

/* ------------------------------------------------------- LadiPage adapter */

/**
 * LadiPage gửi payload PHẲNG (một cấp) và tên trường là do người dùng tự đặt
 * trong builder — thường là tiếng Việt có dấu. Nên phải đoán trường theo alias,
 * sau khi bỏ dấu + bỏ ký tự không phải chữ số.
 *
 * Theo quy tắc đã chốt: landing page CHỈ lấy họ tên, SĐT, email.
 * KHÔNG lấy IP (LadiPage gửi webhook từ server của họ, IP đó không phải của khách),
 * KHÔNG lấy utm/link/ladi_form_id vào khách hàng.
 */
const KEY_ALIASES = {
  name: ['name', 'fullname', 'hoten', 'hovaten', 'ten', 'tenkhachhang', 'khachhang', 'customer', 'customername', 'yourname', 'field', 'hotenkhachhang'],
  phone: ['phone', 'phonenumber', 'mobile', 'tel', 'telephone', 'sdt', 'sodienthoai', 'dienthoai', 'cellphone', 'number', 'hotline', 'lienhe'],
  email: ['email', 'mail', 'gmail', 'emailaddress', 'thudientu']
};

function stripDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

function normalizeKey(key) {
  return stripDiacritics(key).replace(/[^a-z0-9]/g, '');
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Giá trị LadiPage có thể là mảng (field nhiều lựa chọn) — lấy phần tử đầu có nghĩa. */
function firstScalar(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const scalar = firstScalar(item);
      if (scalar !== '') return scalar;
    }
    return '';
  }
  if (value && typeof value === 'object') return '';
  return value === null || value === undefined ? '' : String(value).trim();
}

/** Làm phẳng một cấp để chịu được payload lồng nhau dù LadiPage normally gửi phẳng. */
function flattenPayload(payload, depth = 0) {
  const flat = {};
  if (!payload || typeof payload !== 'object') return flat;
  for (const [key, value] of Object.entries(payload)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && depth < 2) {
      Object.assign(flat, flattenPayload(value, depth + 1));
      continue;
    }
    const scalar = firstScalar(value);
    if (scalar !== '') flat[key] = scalar;
  }
  return flat;
}

function pickField(flat, normalizedByKey, aliases) {
  for (const alias of aliases) {
    const hit = normalizedByKey[alias];
    if (hit !== undefined && hit !== '') return { value: flat[hit], key: hit };
  }
  return { value: '', key: '' };
}

/**
 * Trả về { name, phone, email } hoặc lỗi. Đây là toàn bộ những gì landing page
 * được phép đưa vào khách hàng.
 */
function adaptLadiPagePayload(payload) {
  const flat = flattenPayload(payload);
  const normalizedByKey = {};
  for (const key of Object.keys(flat)) {
    const normalized = normalizeKey(key);
    if (normalized && !(normalized in normalizedByKey)) normalizedByKey[normalized] = key;
  }

  const name = pickField(flat, normalizedByKey, KEY_ALIASES.name);
  const phone = pickField(flat, normalizedByKey, KEY_ALIASES.phone);
  const email = pickField(flat, normalizedByKey, KEY_ALIASES.email);

  const problems = [];
  if (!name.value) problems.push('thiếu họ tên');

  const digits = normalizeDigits(phone.value);
  // 9–13 số sau khi bỏ ký tự lạ; chấp nhận +84/84 vì CRM tự chuẩn hóa tiếp.
  if (digits.length < 9 || digits.length > 13) problems.push('số điện thoại không hợp lệ');

  if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) problems.push('email sai định dạng');

  return {
    ok: problems.length === 0,
    problems,
    record: {
      name: String(name.value).slice(0, 160),
      phone: String(phone.value).slice(0, 32),
      email: String(email.value).slice(0, 254),
      matchedKeys: { name: name.key, phone: phone.key, email: email.key }
    },
    flat
  };
}

/* ------------------------------------------------------------- parse body */

function contentTypeOf(request) {
  const header = String(request.headers['content-type'] || '').toLowerCase();
  return { full: header, base: header.split(';')[0].trim(), charset: (header.match(/charset=([\w-]+)/) || [])[1] || '' };
}

function parseUrlEncoded(text) {
  const out = {};
  for (const pair of text.split('&')) {
    if (!pair) continue;
    const index = pair.indexOf('=');
    const rawKey = index === -1 ? pair : pair.slice(0, index);
    const rawValue = index === -1 ? '' : pair.slice(index + 1);
    try {
      const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
      if (key in out) {
        out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
      } else {
        out[key] = value;
      }
    } catch {
      /* cặp lỗi encoding thì bỏ qua, không làm sập cả request */
    }
  }
  return out;
}

/**
 * LadiPage có 3 lựa chọn content type: x-www-form-urlencoded (MẶC ĐỊNH),
 * multipart/form-data và application/json. Phải chịu được cả ba, vì người dùng
 * rất dễ quên đổi dropdown và data sẽ mấtเงียบ.
 */
function parseMultipart(buffer, contentTypeFull) {
  const boundaryMatch = contentTypeFull.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return null;
  const boundary = `--${(boundaryMatch[1] || boundaryMatch[2]).trim()}`;
  const out = {};
  const raw = buffer.toString('utf8');
  const parts = raw.split(boundary).slice(1, -1);
  for (const part of parts) {
    const separator = part.indexOf('\r\n\r\n');
    if (separator === -1) continue;
    const head = part.slice(0, separator);
    let body = part.slice(separator + 4);
    if (body.endsWith('\r\n')) body = body.slice(0, -2);
    const nameMatch = head.match(/name="([^"]*)"/i);
    if (!nameMatch) continue;
    out[nameMatch[1]] = body.trim();
  }
  return out;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // KHÔNG destroy socket ở đây: client sẽ thấy "fetch failed" thay vì 413.
        // Ngừng giữ chunk và hút cạn body để response 413 đi được trọn vẹn.
        tooLarge = true;
        chunks.length = 0;
        request.pause();
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) reject(Object.assign(new Error('BODY_TOO_LARGE'), { status: 413 }));
      else resolve(Buffer.concat(chunks));
    });
    request.on('error', reject);
  });
}

function decodeBody(buffer, contentType) {
  const text = buffer.toString(contentType.charset === 'utf-16le' ? 'utf16le' : 'utf8');
  if (contentType.base === 'application/json' || contentType.base === 'text/json') {
    if (!text.trim()) return {};
    return JSON.parse(text);
  }
  if (contentType.base === 'application/x-www-form-urlencoded') return parseUrlEncoded(text);
  if (contentType.base === 'multipart/form-data') {
    const parsed = parseMultipart(buffer, contentType.full);
    if (parsed) return parsed;
  }
  // Không khai báo content type: thử JSON trước, rơi về form-urlencoded.
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { /* rơi xuống dưới */ }
  }
  return parseUrlEncoded(trimmed);
}

/* --------------------------------------------------------------- helpers */

function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  response.end(body);
}

function emailCorsHeaders(request) {
  const origin = String(request.headers.origin || '').trim();
  if (!origin) return {};
  try {
    const originUrl = new URL(origin);
    const host = String(request.headers.host || '').split(':')[0].toLowerCase();
    if (originUrl.hostname.toLowerCase() !== host) return null;
  } catch {
    return null;
  }
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

function checkEmailToken(request) {
  if (!EMAIL_TOKEN) return true;
  return String(request.headers['x-crm-email-token'] || '').trim() === EMAIL_TOKEN;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function maskEmail(value) {
  const email = String(value || '').trim();
  const at = email.indexOf('@');
  if (at < 2) return email ? '?? c?u h?nh' : '';
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}

function handleEmailStatus(request, response) {
  const cors = emailCorsHeaders(request);
  if (cors === null) return sendJson(response, 403, { configured: false, error: 'Ngu?n g?i kh?ng h?p l?' });
  if (request.method !== 'GET') return sendJson(response, 405, { configured: false, error: 'Ch? ch?p nh?n GET' }, { Allow: 'GET', ...cors });
  sendJson(response, 200, { configured: SMTP_ENABLED, sender: maskEmail(SMTP_FROM), host: SMTP_HOST, port: SMTP_PORT }, cors);
}

async function handleEmailNotify(request, response) {
  const cors = emailCorsHeaders(request);
  if (cors === null) return sendJson(response, 403, { sent: false, error: 'Ngu?n g?i kh?ng h?p l?' });
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-CRM-Email-Token', 'Access-Control-Max-Age': '600' });
    response.end();
    return;
  }
  if (request.method !== 'POST') return sendJson(response, 405, { sent: false, error: 'Ch? ch?p nh?n POST' }, { Allow: 'POST, OPTIONS', ...cors });
  if (!checkEmailToken(request)) return sendJson(response, 401, { sent: false, error: 'Thi?u ho?c sai m? b?o v? email' }, cors);
  if (!mailTransporter) return sendJson(response, 503, { sent: false, configured: false, error: 'Server ch?a c?u h?nh Gmail SMTP' }, cors);

  let payload;
  try {
    const buffer = await readBody(request);
    payload = JSON.parse(buffer.toString('utf8'));
  } catch {
    return sendJson(response, 400, { sent: false, error: 'Body JSON kh?ng h?p l?' }, cors);
  }
  const recipients = [...new Set((Array.isArray(payload?.recipients) ? payload.recipients : [payload?.to]).map(value => String(value || '').trim().toLowerCase()).filter(validEmail))].slice(0, 20);
  const subject = String(payload?.subject || '').trim().slice(0, 180);
  const text = String(payload?.text || '').trim().slice(0, 10000);
  if (!recipients.length || !subject || !text) return sendJson(response, 422, { sent: false, error: 'Thi?u ng??i nh?n, ti?u ?? ho?c n?i dung' }, cors);
  try {
    const result = await mailTransporter.sendMail({ from: SMTP_FROM, to: recipients.join(', '), subject, text });
    sendJson(response, 200, { sent: true, messageId: result.messageId, recipients }, cors);
  } catch (error) {
    console.error('[email] send failed:', error.message);
    sendJson(response, 502, { sent: false, error: 'G?i Gmail th?t b?i' }, cors);
  }
}

function clientIpOf(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded;
  const socketAddress = request.socket && request.socket.remoteAddress ? request.socket.remoteAddress : '';
  return socketAddress.replace(/^::ffff:/, '') || 'Chưa xác định';
}

function checkToken(request) {
  if (!WEBHOOK_TOKEN) return true;
  return TOKEN_HEADERS.some(header => {
    const value = String(request.headers[header] || '').trim();
    if (!value) return false;
    const bare = value.replace(/^bearer\s+/i, '');
    return bare === WEBHOOK_TOKEN;
  });
}

function dedupeKey(slug, phone, payload) {
  const payloadHash = crypto.createHash('sha256')
    .update(JSON.stringify(payload, Object.keys(payload).sort()))
    .digest('hex');
  return crypto.createHash('sha256')
    .update(`${slug}|${normalizeDigits(phone)}|${payloadHash}`)
    .digest('hex');
}

function stamp() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/* ------------------------------------------------------------ webhook POST */

async function handleWebhook(request, response, slug) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, X-Webhook-Token, Token',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin'
    });
    response.end();
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { received: false, error: 'Chỉ chấp nhận POST' }, { Allow: 'POST, OPTIONS' });
    return;
  }

  if (!SLUG_PATTERN.test(slug)) {
    sendJson(response, 404, { received: false, error: 'Mã webhook sai định dạng' });
    return;
  }

  if (!checkToken(request)) {
    sendJson(response, 401, { received: false, error: 'Sai token' });
    return;
  }

  const contentType = contentTypeOf(request);
  let buffer;
  try {
    buffer = await readBody(request);
  } catch (error) {
    sendJson(response, error.status || 400, { received: false, error: 'Không đọc được body' });
    return;
  }

  let payload;
  try {
    payload = decodeBody(buffer, contentType);
  } catch {
    sendJson(response, 400, { received: false, error: 'Body không parse được (JSON/form hỏng)' });
    return;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    sendJson(response, 400, { received: false, error: 'Body phải là object các trường form' });
    return;
  }

  const adapted = adaptLadiPagePayload(payload);
  const key = dedupeKey(slug, adapted.record.phone, adapted.flat);

  const existing = inbox.find(item => item.dedupeKey === key);
  if (existing) {
    // Retry của LadiPage: KHÔNG tạo bản ghi mới, chỉ đếm lần gửi lại.
    existing.retryCount = Number(existing.retryCount || 0) + 1;
    scheduleFlush();
    sendJson(response, 200, { received: true, duplicate: true, id: existing.id });
    return;
  }

  const record = {
    id: `WHE-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    slug: slug.toUpperCase(),
    receivedAt: stamp(),
    contentType: contentType.base || 'unknown',
    status: adapted.ok ? 'NEW' : 'INVALID',
    problems: adapted.problems,
    matchedKeys: adapted.record.matchedKeys,
    // Chỉ 3 trường được phép đi vào khách hàng. IP/utm/link cố tình KHÔNG lưu ở đây.
    customer: { name: adapted.record.name, phone: adapted.record.phone, email: adapted.record.email },
    raw: adapted.flat,
    dedupeKey: key,
    retryCount: 0,
    consumedAt: ''
  };

  inbox.push(record);
  if (inbox.length > MAX_INBOX_RECORDS) inbox.splice(0, inbox.length - MAX_INBOX_RECORDS);
  scheduleFlush();
  notifyInboxListeners(record);

  console.log(`[webhook] ${record.status} ${slug} · ${record.customer.name || '(không tên)'} · ${record.customer.phone || '(không sdt)'}`);
  sendJson(response, adapted.ok ? 200 : 422, {
    received: true,
    id: record.id,
    status: record.status,
    problems: record.problems
  });
}

/* ------------------------------------------------------- inbox read + SSE */

const sseClients = new Set();

function notifyInboxListeners(record) {
  const event = `data: ${JSON.stringify({ id: record.id, receivedAt: record.receivedAt, slug: record.slug })}\n\n`;
  for (const client of sseClients) {
    try { client.write(event); } catch { sseClients.delete(client); }
  }
}

function handleInbox(request, response, url) {
  const since = url.searchParams.get('since') || '';
  const includeRaw = url.searchParams.get('raw') === '1';
  const startIndex = since ? inbox.findIndex(item => item.id === since) : -1;
  const items = (startIndex === -1 ? inbox : inbox.slice(startIndex + 1)).map(item => {
    if (includeRaw) return item;
    const { raw, dedupeKey, ...rest } = item;
    return rest;
  });
  sendJson(response, 200, {
    count: items.length,
    lastId: inbox.length ? inbox[inbox.length - 1].id : '',
    items
  }, corsHeaders(request));
}

function handleInboxStream(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    ...corsHeaders(request)
  });
  response.write(`retry: 3000\n\n`);
  sseClients.add(response);
  const heartbeat = setInterval(() => {
    try { response.write(': ping\n\n'); } catch { /* đóng ở request close */ }
  }, 25000);
  request.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(response);
  });
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  return origin
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
}

/* ------------------------------------- IP thật cho đăng ký web / đăng nhập */

/**
 * Quy tắc: IP chỉ thu cho (a) sale tự tạo khách và (b) khách đăng ký từ web.
 * Hai luồng này đi qua trình duyệt khách → server nhìn thấy IP thật của khách.
 */
function handleSessionContext(request, response) {
  sendJson(response, 200, { ip: clientIpOf(request) }, corsHeaders(request));
}

/* ------------------------------------------------------------- static file */

async function serveStatic(request, response, urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  let relative = decoded === '/' ? '/index.html' : decoded;
  const absolute = path.resolve(REPO_ROOT, `.${path.posix.normalize(relative)}`);

  // Chặn path traversal: phải nằm trong REPO_ROOT.
  if (absolute !== REPO_ROOT && !absolute.startsWith(REPO_ROOT + path.sep)) {
    sendJson(response, 403, { error: 'Đường dẫn không hợp lệ' });
    return;
  }

  try {
    const stat = await fsp.stat(absolute);
    if (stat.isDirectory()) {
      return serveStatic(request, response, `${relative.replace(/\/$/, '')}/index.html`);
    }
    const extension = path.extname(absolute).toLowerCase();
    const body = await fsp.readFile(absolute);
    response.writeHead(200, {
      'Content-Type': MIME[extension] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache'
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('404 Không tìm thấy file');
  }
}

/* ------------------------------------------------------------------ router */

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    const webhookMatch = pathname.match(WEBHOOK_PATH_PATTERN);
    if (webhookMatch) {
      await handleWebhook(request, response, decodeURIComponent(webhookMatch[1]));
      return;
    }
    if (pathname === '/api/data-sources/inbox') return handleInbox(request, response, url);
    if (pathname === '/api/data-sources/stream') return handleInboxStream(request, response);
    if (pathname === '/api/session-context') return handleSessionContext(request, response);
    if (pathname === '/api/email/status') return handleEmailStatus(request, response);
    if (pathname === '/api/email/notify') return handleEmailNotify(request, response);
    if (pathname === '/api/db/health' || pathname.startsWith('/api/auth/') || pathname.startsWith('/api/customers') || pathname.startsWith('/api/orders') || pathname.startsWith('/api/products')) return handleDbApi(request, response, pathname);
    if (pathname === '/api/health') return sendJson(response, 200, { ok: true, inbox: inbox.length, token: Boolean(WEBHOOK_TOKEN) });

    if (pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'Không có endpoint này' });
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Chỉ chấp nhận GET' }, { Allow: 'GET, HEAD' });
      return;
    }
    await serveStatic(request, response, pathname);
  } catch (error) {
    console.error('[server] lỗi:', error);
    if (!response.headersSent) sendJson(response, 500, { error: 'Lỗi server' });
  }
});

loadInbox();
server.listen(PORT, HOST, () => {
  const lan = HOST === '0.0.0.0' ? ' (mọi interface — máy khác trong LAN vào được)' : '';
  console.log(`\nCRM webhook server chạy tại http://localhost:${PORT}${lan}`);
  console.log(`Repo root : ${REPO_ROOT}`);
  console.log(`Inbox file: ${INBOX_FILE} (${inbox.length} bản ghi sẵn có)`);
  console.log(`Token     : ${WEBHOOK_TOKEN ? 'BẬT (WEBHOOK_TOKEN)' : 'TẮT — ai cũng POST được'}`);
  console.log('\nEndpoint nhận data landing page:');
  console.log(`  POST http://localhost:${PORT}/api/data-sources/webhook/ds-<13 số>-<11 ký tự>/`);
  console.log('  Chấp nhận: application/json, x-www-form-urlencoded, multipart/form-data');
  console.log('\nTest nhanh:');
  console.log(`  curl -X POST http://localhost:${PORT}/api/data-sources/webhook/ds-1789180581447-IIM6U3AAD1R/ \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -d '{"Họ và tên":"Nguyễn Test","Số điện thoại":"0912345678","Email":"test@gmail.com"}'\n`);
  selfCheckHealth();
});

/* Tự soi lại chính mình qua đúng cái tên người dùng sẽ gõ: "localhost".
   Trên Windows, một server khác (thường là `python -m http.server 4173` còn sót)
   có thể giữ cổng này ở họ IPv6 `::` trong khi mình giữ `0.0.0.0` ở IPv4 —
   `localhost` phân giải sang `::1` trước nên trình duyệt và LadiPage đều rơi vào
   server kia. Không có lỗi nào hiện ra, chỉ là data không bao giờ tới. Vì vậy
   phải tự kiểm tra sau khi listen, và nói to lên nếu cổng bị che. */
async function selfCheckHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`http://localhost:${PORT}/api/health`, { signal: controller.signal });
    const body = await response.text();
    let payload = null;
    try { payload = JSON.parse(body); } catch { payload = null; }
    if (response.ok && payload && payload.ok === true) return;
    console.warn(`\n[webhook] CẢNH BÁO: http://localhost:${PORT}/api/health trả về không phải của server này`);
    console.warn(`[webhook]           HTTP ${response.status} · ${body.slice(0, 120).replace(/\s+/g, ' ')}`);
    warnShadowed();
  } catch (error) {
    console.warn(`\n[webhook] CẢNH BÁO: không tự gọi được http://localhost:${PORT}/api/health (${error.message})`);
    warnShadowed();
  } finally {
    clearTimeout(timer);
  }
}

function warnShadowed() {
  console.warn('[webhook]           Nhiều khả năng "localhost" đang trỏ vào một server khác giữ cùng cổng');
  console.warn('[webhook]           (hay gặp: `python -m http.server 4173` chạy sót, nó bind IPv6 ::).');
  console.warn(`[webhook]           Server này vẫn sống ở http://127.0.0.1:${PORT} — nhưng LadiPage gửi vào`);
  console.warn('[webhook]           "localhost" sẽ KHÔNG tới được. Tắt server kia rồi chạy lại, hoặc dùng PORT khác:');
  console.warn(`[webhook]             netstat -ano | findstr :${PORT}`);
  console.warn(`[webhook]             PORT=${PORT + 1} node webhook-server.cjs\n`);
}

// selfCheckHealth() được gọi trong callback của server.listen — gọi ở đây sẽ đua với bind.

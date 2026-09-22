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
const zlib = require('node:zlib');
const bcrypt = require('bcryptjs');
const crmData = require('./crm-data.cjs');
const { dbConfigured, dbQuery, dbHealth, pool } = require('./db.js');
const { provisionSystemAccounts } = require('./system-accounts.cjs');
const { persistWebhook } = require('./webhook-store.cjs');
const telegramBot = require('./telegram-bot.cjs');
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
const MAX_BODY_BYTES = 8 * 1024 * 1024;
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

function dbJson(request, response, status, payload) { return sendJson(response, status, payload, { 'Access-Control-Allow-Origin': request.headers.origin || '*', Vary: 'Origin' }); }
function tokenHash(request) { return crypto.createHash('sha256').update(String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()).digest('hex'); }
async function authUser(request) {
  const rows = await dbQuery('SELECT u.* FROM crm_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW() AND u.active=1 LIMIT 1', [tokenHash(request)]);
  return rows[0] ? crmData.userRow(rows[0]) : null;
}
function readDbBody(request) { return readBody(request).then(buffer => JSON.parse(buffer.toString('utf8') || '{}')); }
async function passwordMatches(value, stored) {
  if (/^\$2[aby]\$/.test(stored || '')) return bcrypt.compare(value, stored);
  // Hỗ trợ mật khẩu cũ; nâng cấp sang bcrypt sau lần đăng nhập đúng.
  return value.length > 0 && value === stored;
}

// Chế độ demo chỉ được bật chủ động bằng DEMO_MODE=1. npm start/cPanel không bật cờ này.
const DEMO_MODE = typeof process !== 'undefined' && process.env?.DEMO_MODE === '1';
const demoUsers = [
  { id: 'demo-admin', accountId: 'ADMIN-DEMO', phone: '0900000001', email: 'admin.demo@local.test', name: 'Admin Demo', role: 'ADMIN', teamId: '', leaderId: null, active: true },
  { id: 'demo-manager', accountId: 'MANAGER-DEMO', phone: '0900000004', email: 'manager.demo@local.test', name: 'Manager Demo', role: 'MANAGER', teamId: '', leaderId: null, active: true },
  { id: 'demo-leader', accountId: 'LEADER-DEMO', phone: '0900000002', email: 'leader.demo@local.test', name: 'Leader Demo', role: 'LEADER', teamId: 'DEMO', leaderId: null, managerId: 'demo-manager', active: true },
  { id: 'demo-sale', accountId: 'SALE-DEMO', phone: '0900000003', email: 'sale.demo@local.test', name: 'Sale Demo', role: 'SALE', teamId: 'DEMO', leaderId: 'demo-leader', active: true }
];
const demoPasswords = {
  'admin.demo@local.test': 'AdminDemo2026!',
  'manager.demo@local.test': 'ManagerDemo2026!',
  'leader.demo@local.test': 'LeaderDemo2026!',
  'sale.demo@local.test': 'SaleDemo2026!'
};
const demoSessions = new Map();
const demoState = {
  version: 3,
  members: demoUsers.map(user => ({
    ...user,
    initials: user.name.split(/\s+/).map(part => part[0]).join('').toUpperCase(),
    loginEnabled: true
  })),
  registeredAccounts: [],
  customers: [
    { id: 'DEMO-CUS-1', name: 'Khách demo Premium', phone: '0900000011', email: 'premium@local.test', source: 'Demo', campaign: 'DEMO', status: 'NEW', saleId: 'demo-sale', leaderId: 'demo-leader', teamId: 'DEMO', note: 'Dữ liệu demo', customFields: { customerClass: 'Premium' }, createdAt: '2026-09-15 09:00', updatedAt: '2026-09-15 09:00' },
    { id: 'DEMO-CUS-2', name: 'Khách demo Whale', phone: '0900000012', email: 'whale@local.test', source: 'Demo', campaign: 'DEMO', status: 'CONTACTED', saleId: null, leaderId: 'demo-leader', teamId: 'DEMO', note: 'Dữ liệu demo', customFields: { customerClass: 'Whale' }, createdAt: '2026-09-15 10:00', updatedAt: '2026-09-15 10:00' }
  ],
  orders: [], products: DEMO_MODE ? structuredClone(require('./product-catalog.json')) : [], productCategories: DEMO_MODE ? [...new Set(require('./product-catalog.json').map(item => item.category))] : [], registrations: [],
  customFieldDefinitions: DEMO_MODE ? structuredClone(require('./crm-defaults.json').customFieldDefinitions) : [], customerFieldHistory: [], assignmentHistory: [],
  resubmissions: [], notes: [], imports: [], attendance: [], dataOffers: [],
  traffic: [], tasks: [], notifications: [], audit: [], websites: [{ id: 'WEB-DEMO', name: 'Nguồn local', domain: 'localhost:4173', sourceUrl: 'http://localhost:4173/', status: 'ACTIVE' }],
  integrations: [], webhookPending: [], brokerageMetrics: [], careGroups: [],
  settings: { assignmentMode: 'BALANCED', leaderCanUpdate: true, leaderAttendanceRequired: true },
  leaderDistribution: { enabled: true, enabledLeaderIds: ['demo-leader'], weights: { 'demo-leader': 1 }, sourceRules: [] },
  saleDistributionByLeader: { 'demo-leader': { leaderEnabled: true, enabledSaleIds: ['demo-sale'], weights: { 'demo-leader': 1, 'demo-sale': 1 } } }
};

// Chỉ phục hồi RAM demo từ tệp local được chỉ định khi khởi động; production không đọc tệp này.
if(DEMO_MODE&&process.env.DEMO_STATE_FILE){Object.assign(demoState,JSON.parse(fs.readFileSync(process.env.DEMO_STATE_FILE,'utf8').replace(/^\uFEFF/,'')));}
// Ensure all demo roles remain available when restoring an older RAM snapshot.
if (DEMO_MODE) {
  for (const account of demoUsers) {
    const existing = demoState.members.find(member => member.id === account.id);
    if (existing) Object.assign(existing, account, { loginEnabled: true });
    else demoState.members.push({
      ...account,
      initials: account.name.split(/\s+/).map(part => part[0]).join('').toUpperCase(),
      loginEnabled: true
    });
  }
}

// Bo du lieu mau day du cho viec kiem tra giao dien va phan quyen tren demo server.
// Chi them ban ghi thieu, khong ghi de thao tac ma nguoi dung da tao trong phien demo.
function seedDemoWorkspace() {
  if (!DEMO_MODE) return;
  const addOnce = (list, row) => { if (!list.some(item => item.id === row.id)) list.push(row); };
  const addMember = (row, password) => {
    addOnce(demoState.members, { ...row, initials: row.name.split(/\\s+/).map(part => part[0]).join('').toUpperCase(), loginEnabled: true });
    demoPasswords[row.email] = password;
  };
  addMember({ id: 'demo-leader-2', accountId: 'LEADER-DEMO-2', phone: '0900000014', email: 'leader2.demo@local.test', name: 'Leader Demo 2', role: 'LEADER', teamId: 'DEMO-2', leaderId: null, managerId: 'demo-manager', active: true }, 'LeaderDemo2026!');
  addMember({ id: 'demo-sale-2', accountId: 'SALE-DEMO-2', phone: '0900000015', email: 'sale2.demo@local.test', name: 'Sale Demo 2', role: 'SALE', teamId: 'DEMO-2', leaderId: 'demo-leader-2', active: true }, 'SaleDemo2026!');
  addMember({ id: 'demo-sale-3', accountId: 'SALE-DEMO-3', phone: '0900000016', email: 'sale3.demo@local.test', name: 'Sale Demo 3', role: 'SALE', teamId: 'DEMO', leaderId: 'demo-leader', active: true }, 'SaleDemo2026!');
  addMember({ id: 'demo-sale-manager', accountId: 'SALE-MANAGER-DEMO', phone: '0900000017', email: 'sale.manager.demo@local.test', name: 'Sale Truc Thuoc Manager', role: 'SALE', teamId: 'MANAGER-DIRECT', leaderId: null, managerId: 'demo-manager', active: true }, 'SaleDemo2026!');

  const customer = (id, name, phone, owner, status, customerClass, level, createdAt) => ({
    id, name, phone, email: `${id.toLowerCase()}@local.test`, source: 'Landing Page', campaign: 'DEMO-2026', status,
    managerId: owner?.managerId || null, saleAcceptedAt: owner?.saleId ? createdAt : null, saleId: owner?.saleId || null, leaderId: owner?.leaderId || null, teamId: owner?.teamId || null,
    note: 'Du lieu mau de kiem tra quy trinh CRM', customFields: { customerClass, customerLevel: level, callStatus: status === 'CONTACTED' ? 'CONTACTED' : 'NEW' }, createdAt, updatedAt: createdAt
  });
  const owners = {
    leader1: { leaderId: 'demo-leader', teamId: 'DEMO' },
    leader2: { leaderId: 'demo-leader-2', teamId: 'DEMO-2' },
    sale1: { saleId: 'demo-sale', leaderId: 'demo-leader', teamId: 'DEMO' },
    sale2: { saleId: 'demo-sale-2', leaderId: 'demo-leader-2', teamId: 'DEMO-2' },
    sale3: { saleId: 'demo-sale-3', leaderId: 'demo-leader', teamId: 'DEMO' },
    managerSale: { saleId: 'demo-sale-manager', leaderId: null, managerId: 'demo-manager', teamId: 'MANAGER-DIRECT' }
  };
  [
    customer('DEMO-CUS-3', 'Nguyen Minh Anh', '0900000021', owners.sale1, 'CONTACTED', 'Premium', 'L3', '2026-09-16 08:30'),
    customer('DEMO-CUS-4', 'Tran Hoang Nam', '0900000022', owners.sale3, 'NEW', 'Whale', 'L1', '2026-09-16 09:15'),
    customer('DEMO-CUS-5', 'Le Thu Ha', '0900000023', owners.sale2, 'CONTACTED', 'Premium', 'L4.1', '2026-09-15 10:00'),
    customer('DEMO-CUS-6', 'Pham Gia Bao', '0900000024', owners.leader1, 'NEW', 'Lanh', 'L0', '2026-09-17 08:00'),
    customer('DEMO-CUS-7', 'Vo Thanh Tung', '0900000025', owners.leader2, 'NEW', 'Am', 'L1', '2026-09-17 08:10'),
    customer('DEMO-CUS-8', 'Do Ngoc Linh', '0900000026', owners.sale1, 'CONTACTED', 'Nong', 'L5', '2026-09-14 14:20'),
    customer('DEMO-CUS-9', 'Bui Quoc Viet', '0900000027', owners.sale3, 'NEW', 'Pending', 'L0', '2026-09-13 16:45'),
    customer('DEMO-CUS-MANAGER', 'Khach cua Sale Manager', '0900000029', owners.managerSale, 'NEW', 'Am', 'L2', '2026-09-18 09:20'),
    customer('DEMO-CUS-10', 'Hoang Mai Phuong', '0900000028', owners.leader2, 'CONTACTED', 'Whale', 'L4.1', '2026-09-12 11:30')
  ].forEach(row => addOnce(demoState.customers, row));

  const order = (id, code, customerId, saleId, leaderId, teamId, productId, status, total, createdAt, paidAt = '') => ({
    id, code, customerId, saleId, leaderId, teamId, productId, status, total, subtotal: total, qty: 1,
    unitPrice: total, discount: 0, vatRate: 0.1, vatAmount: Math.round(total * 0.1), amountPaid: status === 'PAID' ? total : 0,
    balanceDue: status === 'PAID' ? 0 : total, paymentMode: 'FULL', paymentMethod: 'VietQR', note: 'Don hang mau', createdAt, updatedAt: createdAt, paidAt
  });
  [
    order('DEMO-ORD-1', 'NVT-DEMO-0001', 'DEMO-CUS-3', 'demo-sale', 'demo-leader', 'DEMO', 'p-kh-hhcb', 'PAID', 5000000, '2026-09-15 09:20', '2026-09-15 10:05'),
    order('DEMO-ORD-2', 'NVT-DEMO-0002', 'DEMO-CUS-5', 'demo-sale-2', 'demo-leader-2', 'DEMO-2', 'p-ind-3m', 'PAID', 3042000, '2026-09-15 13:10', '2026-09-15 14:00'),
    order('DEMO-ORD-3', 'NVT-DEMO-0003', 'DEMO-CUS-8', 'demo-sale', 'demo-leader', 'DEMO', 'p-ind-1m', 'PENDING', 1014000, '2026-09-17 08:40'),
    order('DEMO-ORD-4', 'NVT-DEMO-0004', 'DEMO-CUS-10', 'demo-sale-2', 'demo-leader-2', 'DEMO-2', 'p-kh-klcs', 'REFUNDED', 10000000, '2026-09-12 12:00', '2026-09-12 12:30')
  ].forEach(row => addOnce(demoState.orders, row));

  addOnce(demoState.dataOffers, { id: 'DEMO-OFFER-1', customerId: 'DEMO-CUS-6', saleId: 'demo-sale', leaderId: 'demo-leader', teamId: 'DEMO', status: 'PENDING', offeredAt: '2026-09-17 08:00' });
  addOnce(demoState.dataOffers, { id: 'DEMO-OFFER-2', customerId: 'DEMO-CUS-7', saleId: 'demo-sale-2', leaderId: 'demo-leader-2', teamId: 'DEMO-2', status: 'PENDING', offeredAt: '2026-09-17 08:10' });
  addOnce(demoState.careGroups, { id: 'DEMO-CARE-PREMIUM', name: 'Khach Premium', fieldId: 'customerClass', values: ['Premium'], color: '#ca8a04' });
  addOnce(demoState.careGroups, { id: 'DEMO-CARE-WHALE', name: 'Khach Whale', fieldId: 'customerClass', values: ['Whale'], color: '#0f766e' });
  addOnce(demoState.notifications, { id: 'DEMO-NOTICE-1', title: 'Co data moi can xu ly', text: 'Hai khach demo dang cho nhan va phan cong.', role: 'ALL', at: '2026-09-17 08:15', readBy: [] });
  addOnce(demoState.notifications, { id: 'DEMO-NOTICE-2', title: 'Don hang da thanh toan', text: 'Don NVT-DEMO-0001 da ghi nhan thanh cong.', role: 'ALL', at: '2026-09-15 10:05', readBy: [] });
  addOnce(demoState.attendance, { id: 'DEMO-ATT-1', accountId: 'demo-sale', date: '2026-09-17', checkInAt: '2026-09-17 08:02', status: 'PRESENT', ip: '127.0.0.1' });
  addOnce(demoState.attendance, { id: 'DEMO-ATT-2', accountId: 'demo-leader', date: '2026-09-17', checkInAt: '2026-09-17 08:05', status: 'PRESENT', ip: '127.0.0.1' });
  addOnce(demoState.tasks, { id: 'DEMO-TASK-1', customerId: 'DEMO-CUS-4', saleId: 'demo-sale-3', leaderId: 'demo-leader', teamId: 'DEMO', title: 'Goi lai khach Whale', status: 'OPEN', dueAt: '2026-09-18 09:00', createdAt: '2026-09-17 08:30' });
  addOnce(demoState.tasks, { id: 'DEMO-TASK-2', customerId: 'DEMO-CUS-5', saleId: 'demo-sale-2', leaderId: 'demo-leader-2', teamId: 'DEMO-2', title: 'Gui thong tin khoa hoc', status: 'DONE', dueAt: '2026-09-16 15:00', createdAt: '2026-09-15 10:30' });
  addOnce(demoState.brokerageMetrics, { id: 'BRK-2026-09-demo-sale', memberId: 'demo-sale', leaderId: 'demo-leader', teamId: 'DEMO', period: '2026-09', basicLots: 8, microLots: 5, nanoLots: 10, lotCommissionRate: 120000, indicatorCommissionRate: 0.05, courseCommissionRate: 0.1, vatRate: 0.1, updatedAt: '2026-09-17 08:00' });
  addOnce(demoState.brokerageMetrics, { id: 'BRK-2026-09-demo-sale-2', memberId: 'demo-sale-2', leaderId: 'demo-leader-2', teamId: 'DEMO-2', period: '2026-09', basicLots: 5, microLots: 3, nanoLots: 0, lotCommissionRate: 120000, indicatorCommissionRate: 0.05, courseCommissionRate: 0.1, vatRate: 0.1, updatedAt: '2026-09-17 08:00' });
  demoState.leaderDistribution = { ...demoState.leaderDistribution, enabled: true, enabledLeaderIds: ['demo-leader', 'demo-leader-2'], weights: { 'demo-leader': 1, 'demo-leader-2': 1 }, sourceRules: [] };
  demoState.saleDistributionByLeader = {
    ...demoState.saleDistributionByLeader,
    'demo-leader': { leaderEnabled: true, enabledSaleIds: ['demo-leader', 'demo-sale', 'demo-sale-3'], weights: { 'demo-leader': 1, 'demo-sale': 1, 'demo-sale-3': 1 } },
    'demo-leader-2': { leaderEnabled: true, enabledSaleIds: ['demo-leader-2', 'demo-sale-2'], weights: { 'demo-leader-2': 1, 'demo-sale-2': 1 } },
    'manager:demo-manager': { leaderEnabled: true, enabledSaleIds: ['demo-sale-manager'], weights: { 'demo-sale-manager': 1 }, managerDistributionInitialized: true }
  };
}
seedDemoWorkspace();
function demoData(state=demoState){return Object.fromEntries([...crmData.LISTS,...crmData.OBJECTS].map(key=>[key,new Map(crmData.LISTS.includes(key)?(state[key]||[]).map(r=>[r.id,r]):state[key]===undefined?[]:[['$',state[key]]])]));}
function demoToken(request) {
  return String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}
function demoUserFromToken(request) {
  return demoState.members.find(user => user.id === demoSessions.get(demoToken(request))&&user.active!==false) || null;
}
function expireDemoOffers() {
  // Demo cung tuan theo han nhan 24 gio nhu MySQL, khong dem offer cu vao badge.
  const now=Date.now(),at=new Date(now).toLocaleString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,16);
  for(const offer of demoState.dataOffers){
    if(offer.status!=='PENDING'||Date.parse(String(offer.offeredAt).replace(' ','T')+'+07:00')+24*3600000>now)continue;
    offer.status='EXPIRED';offer.resolvedAt=at;
    const customer=demoState.customers.find(c=>c.id===offer.customerId);
    if(customer&&!customer.saleId&&!demoState.dataOffers.some(o=>o.customerId===customer.id&&o.status==='PENDING')){
      customer.saleAcceptedAt=null;customer.updatedAt=at;
      customer.note='Sale khong nhan data sau 24h. Cho Leader phan lai.';
    }
  }
}
function demoPayload(user) {
  expireDemoOffers();
  return {...crmData.snapshot(user,demoData()),user};
}
async function handleDemoApi(request, response, pathname) {
  if (pathname === '/api/db/health') return dbJson(request, response, 200, { configured: false, demo: true });
  if (pathname === '/api/auth/register' && request.method === 'POST') {
    const body=await readDbBody(request),phone=String(body.phone||'').replace(/\D/g,''),email=String(body.email||'').trim().toLowerCase(),name=String(body.name||'').trim(),accountId=String(body.accountId||'').trim().toUpperCase(),password=String(body.password||'');
    if(!name||!/^\d{9,15}$/.test(phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[A-Z0-9][A-Z0-9._-]{2,63}$/.test(accountId)||password.length<8)return dbJson(request,response,400,{error:'Thông tin đăng ký không hợp lệ'});
    if(demoState.members.some(user=>user.phone===phone||user.email===email||user.accountId===accountId))return dbJson(request,response,400,{error:'ID tài khoản, số điện thoại hoặc email đã tồn tại'});
    const id=`u-reg-${crypto.randomUUID()}`,user={id,accountId,phone,email,name,role:'UNASSIGNED',teamId:'',leaderId:null,active:true,initials:name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase(),loginEnabled:true};
    demoState.members.push(user);demoState.registeredAccounts.push(user);demoPasswords[email]=password;
    return dbJson(request,response,201,{success:true,message:'Đăng ký thành công',id});
  }
  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await readDbBody(request);
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const user = demoState.members.find(item => item.phone === identifier&&item.active!==false);
    if (!user || demoPasswords[user.email] !== String(body.password || '')) {
      return dbJson(request, response, 401, { error: 'Thông tin đăng nhập demo không đúng' });
    }
    if(user.role==='UNASSIGNED')return dbJson(request,response,403,{error:'Tài khoản đã đăng ký, đang chờ Admin phân chức vụ.'});
    const token = `demo-${crypto.randomBytes(12).toString('hex')}`;
    demoSessions.set(token, user.id);
    return dbJson(request, response, 200, { token, user });
  }
  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const user = demoUserFromToken(request);
    return user ? dbJson(request, response, 200, { user }) : dbJson(request, response, 401, { error: 'Phiên demo hết hạn' });
  }
  if (pathname === '/api/auth/logout') {
    demoSessions.delete(demoToken(request));
    return dbJson(request, response, 200, { ok: true });
  }
  const user = demoUserFromToken(request);
  if (!user) return dbJson(request, response, 401, { error: 'Đăng nhập demo trước' });
  if (pathname === '/api/state' && request.method === 'GET') return dbJson(request, response, 200, demoPayload(user));
  if (pathname === '/api/state' && request.method === 'POST') {
    const body = await readDbBody(request);
    try{
      expireDemoOffers();
      const next=structuredClone(demoState),original=demoData(),changes=body.changes||[];
      for(const change of changes.slice().sort((a,b)=>(a.key==='customers'?0:1)-(b.key==='customers'?0:1))){
        const {key,id}=change;let {value}=change;if(!original[key])throw Object.assign(Error('Collection không hợp lệ'),{status:400});
        const old=original[key].get(id);
        // Sale nhan ban ghi da che thong tin: giu thong tin goc nhu luong MySQL.
        const pending=key==='customers'&&user.role==='SALE'&&old&&demoState.dataOffers.some(o=>o.customerId===id&&o.saleId===user.id&&o.status==='PENDING');
        if(pending&&value)value={...old,saleId:user.id,saleAcceptedAt:value.saleAcceptedAt,updatedAt:value.updatedAt,status:value.status||old.status,note:value.note!==undefined?value.note:old.note};
        crmData.validate(key,value,id);crmData.authorize(user,key,old,value,demoData(next));
        if(crmData.OBJECTS.includes(key)){next[key]=user.role==='MANAGER'&&['settings','saleDistributionByLeader'].includes(key)?{...next[key],...value}:value;}
        else{next[key]=(next[key]||[]).filter(r=>r.id!==id);if(value)next[key].push(value);}
      }
      Object.assign(demoState,next);
    }catch(e){return dbJson(request,response,e.status||400,{error:e.message});}
    return dbJson(request, response, 200, { ...demoPayload(user), ok: true });
  }
  return dbJson(request, response, 404, { error: 'Demo API không hỗ trợ endpoint này' });
}

async function handleDbApi(request, response, pathname) {
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Origin': request.headers.origin || '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' }); return response.end(); }
  if (DEMO_MODE) return handleDemoApi(request,response,pathname);
  if (!dbConfigured) return dbJson(request,response,503,{error:'MySQL chưa được cấu hình. Không thể lưu dữ liệu.'});
  try {
    if (!await systemAccountsReady) return dbJson(request,response,503,{error:'Khởi tạo tài khoản hệ thống chưa hoàn tất. Kiểm tra schema và quyền MySQL trong log Node.'});
    if (pathname === '/api/db/health') return dbJson(request,response,200,await dbHealth());
    if (pathname === '/api/auth/register' && request.method === 'POST') {
      const body = await readDbBody(request);
      const phone = String(body.phone || '').replace(/\D/g,''), email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim(), accountId = String(body.accountId || '').trim().toUpperCase(), password = String(body.password || '');
      if (!/^\d{9,15}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !name || name.length>160 || !/^[A-Z0-9][A-Z0-9._-]{2,63}$/.test(accountId) || password.length<8 || Buffer.byteLength(password)>72) return dbJson(request,response,400,{error:'Họ tên, ID tài khoản, SĐT, email hoặc mật khẩu không hợp lệ.'});
      const id = `u-reg-${crypto.randomUUID()}`;
      try { await dbQuery("INSERT INTO users(id,account_code,phone,email,password_hash,name,role,active) VALUES (?,?,?,?,?,?,'UNASSIGNED',1)",[id,accountId||null,phone,email,await bcrypt.hash(password,12),name]); }
      catch(e) { if(e.code==='ER_DUP_ENTRY')return dbJson(request,response,400,{error:'ID tài khoản, số điện thoại hoặc email đã tồn tại'});throw e; }
      notifyInboxListeners({id,kind:'users',receivedAt:stamp()});
      return dbJson(request,response,201,{success:true,message:'Đăng ký thành công',id});
    }
    if (pathname === '/api/auth/login' && request.method === 'POST') {
      const body = await readDbBody(request), identifier=String(body.identifier||'').trim().toLowerCase();
      const rows=await dbQuery('SELECT * FROM users WHERE (phone=? OR LOWER(email)=?) AND active=1 LIMIT 1',[identifier,identifier]);
      const row=rows[0], password=String(body.password||'');
      if(!row||!await passwordMatches(password,row.password_hash))return dbJson(request,response,401,{error:'Thông tin đăng nhập không đúng'});
      if(row.role==='UNASSIGNED')return dbJson(request,response,403,{error:'Tài khoản đã đăng ký, đang chờ Admin phân chức vụ.'});
      if(!/^\$2[aby]\$/.test(row.password_hash))await dbQuery('UPDATE users SET password_hash=? WHERE id=?',[await bcrypt.hash(password,12),row.id]);
      const token=crypto.randomBytes(32).toString('hex');
      await dbQuery('INSERT INTO crm_sessions(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))',[crypto.createHash('sha256').update(token).digest('hex'),row.id]);
      return dbJson(request,response,200,{token,user:crmData.userRow(row)});
    }
    const user=await authUser(request);
    if(!user)return dbJson(request,response,401,{error:'Phiên đã hết hạn. Đăng nhập lại để tiếp tục.'});
    if(pathname==='/api/auth/me')return dbJson(request,response,200,{user});
    if(pathname==='/api/auth/logout' && request.method==='POST'){await dbQuery('DELETE FROM crm_sessions WHERE token_hash=?',[tokenHash(request)]);return dbJson(request,response,200,{ok:true});}
    if(pathname==='/api/navigation-counts' && request.method==='GET'){
      if(user.role!=='ADMIN')return dbJson(request,response,403,{error:'Chỉ Admin được xem số data và tài khoản chờ'});
      // API đếm riêng giúp badge cập nhật ngay mà không ghi đè form Admin đang nhập.
      const [dataRows,accountRows]=await Promise.all([
        dbQuery('SELECT COUNT(*) AS total FROM customers WHERE sale_id IS NULL AND leader_id IS NULL AND team_id IS NULL'),
        dbQuery("SELECT COUNT(*) AS total FROM users WHERE role='UNASSIGNED' AND active=1")
      ]);
      return dbJson(request,response,200,{
        data:Number(dataRows[0]?.total||0),
        team:Number(accountRows[0]?.total||0)
      });
    }
    if(pathname==='/api/auth/password' && request.method==='POST'){
      const body=await readDbBody(request), id=body.userId||user.id, password=String(body.password||'');
      if(password.length<8||Buffer.byteLength(password)>72)return dbJson(request,response,400,{error:'Mật khẩu phải từ 8 ký tự và không quá 72 byte'});
      if(id!==user.id&&user.role!=='ADMIN')return dbJson(request,response,403,{error:'Không có quyền'});
      const rows=await dbQuery('SELECT password_hash FROM users WHERE id=?',[id]);
      if(!rows.length)return dbJson(request,response,404,{error:'Nhân sự chưa có tài khoản đăng nhập'});
      if(id===user.id&&!await passwordMatches(String(body.currentPassword||''),rows[0].password_hash))return dbJson(request,response,400,{error:'Mật khẩu hiện tại không đúng'});
      await dbQuery('UPDATE users SET password_hash=? WHERE id=?',[await bcrypt.hash(password,12),id]);
      await dbQuery('DELETE FROM crm_sessions WHERE user_id=?',[id]);
      return dbJson(request,response,200,{ok:true});
    }
    if(pathname==='/api/state'){
      if(request.method==='GET')return dbJson(request,response,200,{...await crmData.read(user),user});
      if(request.method==='POST'){
        const body=await readDbBody(request);
        const result=await crmData.write(user,body.requestId,body.changes);
        notifyInboxListeners({id:body.requestId,kind:'state',receivedAt:stamp()});

        // Phân lại thủ công tạo offer PENDING cho Sale mới. Gửi Telegram sau
        // khi giao dịch đã commit; request phát lại không gửi thêm lần nữa.
        if(!result.replayed && Array.isArray(body.changes) && typeof telegramBot.notifyReassignedLead === 'function'){
          const reassignedOffers=body.changes
            .filter(change=>change?.key==='dataOffers'&&change.value?.status==='PENDING'&&change.value?.source==='MANUAL'&&change.value?.saleId)
            .map(change=>change.value);
          for(const offer of reassignedOffers){
            try{
              const [custRows]=await pool.execute('SELECT * FROM customers WHERE id = ? LIMIT 1',[offer.customerId]);
              if(custRows?.[0]) await telegramBot.notifyReassignedLead(custRows[0],offer);
            }catch(err){
              console.warn('[Telegram Bot] notify reassigned lead notice:',err.message);
            }
          }
        }
        return dbJson(request,response,200,result);
      }
    }
    // API cũ đọc cùng nguồn; ghi bắt buộc kèm phiên bản để không ghi đè âm thầm.
    const [resource,encodedId]=pathname.replace('/api/','').split('/');
    const id=encodedId?decodeURIComponent(encodedId):null;
    const key=resource==='users'?'members':resource;
    if(['customers','orders','products','users','settings'].includes(resource)){
      if(resource==='users'&&!['ADMIN','LEADER','MANAGER'].includes(user.role))return dbJson(request,response,403,{error:'Không có quyền xem users'});
      const snapshot=await crmData.read(user);
      if(request.method==='GET')return dbJson(request,response,200,{items:resource==='users'?snapshot.state.accounts:snapshot.state[key],versions:snapshot.versions});
      const body=await readDbBody(request), recordId=key==='settings'?'$':id||body.id;
      if(request.method!=='POST'&&!Object.hasOwn(body,'_revision'))return dbJson(request,response,428,{error:'Hãy tải lại bản CRM mới; cập nhật cần phiên bản bản ghi'});
      const {_revision,...fields}=body;
      const old=key==='settings'?snapshot.state.settings:[...(snapshot.state[key]||[]),...(key==='members'?snapshot.state.registeredAccounts:[])].find(r=>r.id===recordId);
      const value=request.method==='DELETE'?null:{...old,...fields,...(key==='settings'?{}:{id:recordId})};
      const result=await crmData.write(user,crypto.randomUUID(),[{key,id:recordId,base:_revision??null,value}]);
      return dbJson(request,response,request.method==='POST'?201:200,result);
    }
    return dbJson(request,response,404,{error:'API không tồn tại'});
  }catch(e){console.error('[mysql-api]',e.message);const duplicate=e.code==='ER_DUP_ENTRY';return dbJson(request,response,e.status||(duplicate||e instanceof SyntaxError?400:500),{error:e.status?e.message:duplicate?'ID tài khoản, số điện thoại hoặc email đã tồn tại':e instanceof SyntaxError?'JSON không hợp lệ':'Không lưu được MySQL. Giữ trang mở và thử lại.'});}
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
    try {
      const saved = await persistWebhook(existing);
      sendJson(response, 200, { received: true, duplicate: true, id: saved.eventId });
    } catch (error) {
      console.error('[webhook-mysql]', error.message);
      sendJson(response, 503, { received: false, error: 'Chưa lưu được MySQL. Vui lòng gửi lại.' });
    }
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

  try {
    const saved = await persistWebhook(record);
    record.customerId = saved.customerId;
    record.source = saved.source || null;
    record.duplicate = Boolean(saved.duplicate);
    record.replay = Boolean(saved.replay);
    record.ownerSaleId = saved.ownerSaleId || null;
    record.persisted = true;
  } catch (error) {
    console.error('[webhook-mysql]', error.message);
    sendJson(response, 503, { received: false, error: 'Chưa lưu được MySQL. Vui lòng gửi lại.' });
    return;
  }
  inbox.push(record);
  if (inbox.length > MAX_INBOX_RECORDS) inbox.splice(0, inbox.length - MAX_INBOX_RECORDS);
  scheduleFlush();
  notifyInboxListeners(record);

  if (record.status === 'NEW' && record.customerId && !record.duplicate) {
    (async () => {
      try {
        const [custRows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [record.customerId]);
        if (custRows && custRows.length) {
          const cust = custRows[0];
          const [offerDocs] = await pool.query("SELECT body FROM crm_documents WHERE collection = 'dataOffers' AND JSON_EXTRACT(body, '$.customerId') = ?", [record.customerId]);
          const offer = (offerDocs || []).map(row => typeof row.body === 'string' ? JSON.parse(row.body) : row.body).find(item => item && item.status === 'PENDING') || null;
          await telegramBot.notifyNewLead(cust, offer);
        }
      } catch (err) {
        console.warn('[Telegram Bot] notify lead notice:', err.message);
      }
    })().catch(() => {});
  }

  console.log(`[webhook] ${record.status} ${slug} · ${record.customer.name || '(không tên)'} · ${record.customer.phone || '(không sdt)'}`);
  sendJson(response, adapted.ok ? 200 : 422, {
    received: true,
    id: record.id,
    status: record.status,
    problems: record.problems,
    duplicate: Boolean(record.duplicate),
    customerId: record.customerId || null,
    ownerSaleId: record.ownerSaleId || null
  });
}

/* ------------------------------------------------------- inbox read + SSE */

const sseClients = new Set();

function notifyInboxListeners(record) {
  const event = `data: ${JSON.stringify({ changed: true, kind: record?.kind || 'webhook' })}\n\n`;
  for (const client of sseClients) {
    try { client.write(event); } catch { sseClients.delete(client); }
  }
}

async function handleInbox(request, response, url) {
  const user = DEMO_MODE ? demoUserFromToken(request) : await authUser(request);
  if(user?.role!=='ADMIN')return sendJson(response,403,{error:'Chỉ Admin được xem inbox'},corsHeaders(request));
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
  if (['/customer-journey.svg', '/team-hierarchy-tree.svg'].includes(decoded)) {
    const absolute = path.resolve(REPO_ROOT, `.${decoded}`);
    try {
      const body = await fsp.readFile(absolute);
      const hasVersion=Boolean(new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('v'));
      response.writeHead(200, {
        'Content-Type':'image/svg+xml; charset=utf-8',
        'Content-Length':body.length,
        'Cache-Control':hasVersion ? 'public, max-age=31536000, immutable' : 'no-cache'
      });
      response.end(body);
    } catch {
      response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      response.end('404 Khong tim thay file');
    }
    return;
  }
  if (!['/','/index.html','/crm.js','/crm.css','/crm-modern.css','/crm-boot.css','/logo.jpg','/login-background.jpg','/customer-journey.svg','/care-ui.js','/crm-runtime.html','/crm-runtime-api.js','/reference-view.js','/reference-crm.js','/nvt-mobile-auth.css','/mobile_login_fixed_demo.html','/mobile-login-redesign.svg','/mobile-auth-unified.svg','/mobile_admin_overview.html','/mobile-admin-overview.svg','/mobile-multitab-showcase.svg','/commission_tree_demo.html','/commission-apex-mindmap.svg'].includes(decoded)) return sendJson(response,404,{error:'Không tìm thấy tài nguyên'});

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
    const hasVersion=Boolean(new URL(request.url, `http://${request.headers.host || 'localhost'}`).searchParams.get('v'));
    const contentType=MIME[extension] || 'application/octet-stream';
    const compressible=/^(text\/|application\/(javascript|json|xml)|image\/svg\+xml)/i.test(contentType);
    const acceptsGzip=/\bgzip\b/i.test(String(request.headers['accept-encoding']||''));
    const responseBody=compressible&&acceptsGzip&&body.length>1024?await new Promise((resolve,reject)=>zlib.gzip(body,{level:zlib.constants.Z_BEST_SPEED},(error,result)=>error?reject(error):resolve(result))):body;
    const headers={
      'Content-Type':contentType,
      'Content-Length':responseBody.length,
      'Cache-Control':hasVersion ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Vary':'Accept-Encoding'
    };
    if(responseBody!==body)headers['Content-Encoding']='gzip';
    response.writeHead(200, headers);
    response.end(responseBody);
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
    if (pathname === '/api/telegram/webhook') {
      if (request.method === 'POST') {
        try {
          const buffer = await readBody(request);
          const update = JSON.parse(buffer.toString('utf8') || '{}');
          await telegramBot.handleTelegramUpdate(update);
          return sendJson(response, 200, { ok: true });
        } catch (err) {
          console.warn('[Telegram Webhook] error:', err.message);
          return sendJson(response, 200, { ok: false, error: err.message });
        }
      }
      return sendJson(response, 405, { error: 'Chỉ chấp nhận POST' });
    }
    if (pathname === '/api/broadcast' && request.method === 'POST') {
      const user = DEMO_MODE ? demoUserFromToken(request) : await authUser(request);
      if (!user || user.role !== 'ADMIN') return sendJson(response, 403, { error: 'Chỉ Admin được gửi thông báo' }, corsHeaders(request));
      const body = await readDbBody(request);
      const sent = await telegramBot.sendBroadcastAnnouncement(body);
      if (!sent) {
        return sendJson(response, 503, {
          ok: false,
          error: 'Bot chưa gửi được thông báo. Kiểm tra tài khoản đã liên kết Telegram và trạng thái Bot.'
        }, corsHeaders(request));
      }
      return sendJson(response, 200, { ok: true, sent }, corsHeaders(request));
    }
    if (pathname === '/api/appointments' && request.method === 'GET') {
      const user = DEMO_MODE ? demoUserFromToken(request) : await authUser(request);
      if (!user) return sendJson(response, 401, { error: 'Chưa đăng nhập' }, corsHeaders(request));
      const customerId = url.searchParams.get('customerId') || '';
      if (!customerId) return sendJson(response, 400, { error: 'Thiếu customerId' }, corsHeaders(request));
      if (!dbConfigured) return sendJson(response, 200, { ok: true, appointments: [] }, corsHeaders(request));
      try {
        const rows = await dbQuery(
          `SELECT a.*, u.name AS sale_name
           FROM customer_appointments a
           LEFT JOIN users u ON a.sale_id = u.id
           WHERE a.customer_id = ?
           ORDER BY a.appointment_time ASC`,
          [customerId]
        );
        return sendJson(response, 200, { ok: true, appointments: rows }, corsHeaders(request));
      } catch (err) {
        return sendJson(response, 500, { error: err.message }, corsHeaders(request));
      }
    }
    if (pathname === '/api/appointments' && request.method === 'POST') {
      const user = DEMO_MODE ? demoUserFromToken(request) : await authUser(request);
      if (!user) return sendJson(response, 401, { error: 'Chưa đăng nhập' }, corsHeaders(request));
      const body = await readDbBody(request);
      const { customerId, saleId, appointmentTime, type, note } = body;
      if (!customerId || !appointmentTime) return sendJson(response, 400, { error: 'Thiếu thông tin lịch hẹn' }, corsHeaders(request));
      const id = `APP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const targetSaleId = saleId || user.id;
      try {
        await dbQuery(
          `INSERT INTO customer_appointments (id, customer_id, sale_id, appointment_time, type, note, status)
           VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')`,
          [id, customerId, targetSaleId, appointmentTime, type || 'CONSULTING', note || '']
        );
        return sendJson(response, 201, { ok: true, id }, corsHeaders(request));
      } catch (err) {
        return sendJson(response, 500, { error: err.message }, corsHeaders(request));
      }
    }
    if (pathname.startsWith('/api/appointments/') && (request.method === 'PUT' || request.method === 'DELETE')) {
      const user = DEMO_MODE ? demoUserFromToken(request) : await authUser(request);
      if (!user) return sendJson(response, 401, { error: 'Chưa đăng nhập' }, corsHeaders(request));
      const id = pathname.slice('/api/appointments/'.length);
      if (request.method === 'DELETE') {
        await dbQuery('DELETE FROM customer_appointments WHERE id = ?', [id]);
        return sendJson(response, 200, { ok: true }, corsHeaders(request));
      }
      const body = await readDbBody(request);
      const status = body.status || 'SCHEDULED';
      await dbQuery('UPDATE customer_appointments SET status = ?, note = COALESCE(?, note) WHERE id = ?', [status, body.note || null, id]);
      return sendJson(response, 200, { ok: true }, corsHeaders(request));
    }
    if (pathname === '/api/db/health' || pathname === '/api/navigation-counts' || pathname.startsWith('/api/auth/') || pathname.startsWith('/api/users') || pathname.startsWith('/api/customers') || pathname.startsWith('/api/orders') || pathname.startsWith('/api/products') || pathname.startsWith('/api/settings') || pathname === '/api/state') return handleDbApi(request, response, pathname);
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
// Khôi phục inbox cũ theo ID ổn định; không xóa file gốc sau khi nhập.
async function recoverLegacyInbox() {
  for (const record of inbox) {
    if (!record.dedupeKey || !record.customer) continue;
    const saved = await persistWebhook(record);
    record.customerId = saved.customerId;
    record.source = saved.source || null;
    record.persisted = true;
  }
}
if (dbConfigured) recoverLegacyInbox().catch(error => console.error('[webhook-recovery] Chưa nhập xong inbox cũ:', error.message));
const systemAccountsReady = (async () => {
  if (!dbConfigured) return false;
  await crmData.prepare();
  const result = await provisionSystemAccounts(pool);
  if (result.applied) console.log('[mysql] Đã cấu hình Admin, Marketing, Kế toán theo yêu cầu.');
  return true;
})().catch(error => { console.error('[mysql] Không khởi tạo được tài khoản:', error.message); return false; });
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
  if (dbConfigured && !DEMO_MODE) {
    setInterval(() => {
      telegramBot.runTelegramScheduler().catch(err => console.warn('[Telegram Scheduler]', err.message));
    }, 60000);
  }
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

/**
 * Test END-TO-END cho luồng landing page → CRM.
 * Chạy: node docs/architecture/18-webhook-consumer.cjs
 *
 * Khác 17-webhook-server.cjs (chỉ thử server), file này nối THẬT hai nửa:
 *   1. spawn 16-webhook-server.cjs và POST payload đúng kiểu LadiPage
 *   2. nạp 14-crm-complete.js vào vm sandbox với fetch trỏ vào server đó
 *   3. đăng nhập Admin, chạy pullWebhookInbox(), kiểm tra khách có vào
 *      hàng chờ "Chia Leader → Thứ tự data mới vào" hay không
 *
 * Không có jsdom, không có dependency: dùng lại đúng DOM shim của
 * 14-crm-smoke.cjs.
 *
 * Mọi test chạy trên CÙNG một server nên inbox dồn dần. `bootDemo()` vì thế
 * luôn "prime" cursor + vòng consumed bằng toàn bộ inbox hiện có trước, rồi
 * test mới POST bản ghi của riêng nó — giống hệt thứ tự xảy ra ngoài đời
 * (CRM đã mở sẵn, landing page bắn data về sau).
 */
'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const SERVER = path.join(__dirname, '16-webhook-server.cjs');
const DEMO = path.join(__dirname, '14-crm-complete.js');
const PORT = 4198;
const BASE = `http://127.0.0.1:${PORT}`;
const inboxFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'crm-e2e-')), 'inbox.json');

const CURSOR_KEY = 'nvt-crm-webhook-cursor-v2';
const CONSUMED_KEY = 'nvt-crm-webhook-consumed-v2';

const SLUG_WEB1 = 'ds-1789015513831-ZPKFFVK9S9A'; // của website WEB-NVT trong seed
const SLUG_WEB2 = 'ds-1789902464947-TN30ESRUIJM'; // của website WEB-NVT-2 trong seed
const SLUG_ORPHAN = 'ds-1789015599999-ORPHAN00001'; // hợp lệ nhưng không website nào nhận

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/* --------------------------------------------------------- DOM shim (browser) */

function createElement() {
  const classes = new Set();
  return {
    value: '', innerHTML: '', textContent: '', children: [], dataset: {}, isConnected: true,
    className: '',
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, force) => force === undefined ? (classes.has(name) ? (classes.delete(name), false) : (classes.add(name), true)) : (force ? classes.add(name) : classes.delete(name), force)
    },
    addEventListener() {}, append() {}, remove() {}, focus() {}, click() {}, reset() {},
    setAttribute() {}, getAttribute() { return null; },
    querySelectorAll() { return []; }
  };
}

function storage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

/* --------------------------------------------------------------- test harness */

const results = [];
const check = (name, fn) => results.push([name, fn]);

async function waitForServer(child, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* chưa listen */ }
    if (child.exitCode !== null) throw new Error(`server exited early (code ${child.exitCode})`);
    await sleep(150);
  }
  throw new Error('server không khởi động kịp');
}

async function postLadiPage(slug, body, contentType = 'application/json') {
  const response = await fetch(`${BASE}/api/data-sources/webhook/${slug}/`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
}

/** Nạp demo CRM vào sandbox, trả về `run` để đọc/ghi biến bên trong. */
function bootDemo(role = 'ADMIN') {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, createElement());
    return elements.get(selector);
  };
  const localStorage = storage();
  const sandbox = {
    console, structuredClone, Blob, AbortController, TextEncoder, TextDecoder, URLSearchParams,
    document: {
      readyState: 'loading',
      documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } },
      scrollingElement: { scrollTop: 0, scrollTo() {} },
      activeElement: createElement(),
      body: createElement(),
      addEventListener() {},
      querySelector: element,
      querySelectorAll() { return []; },
      createElement,
      execCommand() { return true; }
    },
    localStorage,
    sessionStorage: storage(),
    crypto: require('node:crypto').webcrypto,
    navigator: { clipboard: null },
    // fetch THẬT, trỏ vào server webhook đang chạy.
    fetch: (input, init) => fetch(input, init),
    EventSource: undefined, // tắt SSE để test đi đúng nhánh polling
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    window: {
      matchMedia: () => ({ matches: false }), addEventListener() {}, scrollTo() {},
      confirm: () => true, location: { origin: BASE, href: `${BASE}/` }
    },
    // setTimeout PHẢI hoãn thật. Shim đồng bộ của smoke test sẽ làm vòng poll
    // tự nối lại thành chuỗi microtask không bao giờ nhường quyền điều khiển.
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(DEMO, 'utf8'), sandbox, { filename: DEMO });
  const run = expression => vm.runInContext(expression, sandbox);
  run(`currentAccount = ACCOUNTS.find(account => account.role === '${role}')`);
  return { run, localStorage };
}

/** Boot demo đã "xem xong" toàn bộ inbox hiện có, để chỉ data mới được ingest. */
async function bootDemoSynced(role = 'ADMIN') {
  const demo = bootDemo(role);
  const inbox = await (await fetch(`${BASE}/api/data-sources/inbox`)).json();
  demo.localStorage.setItem(CONSUMED_KEY, JSON.stringify(inbox.items.map(item => item.id)));
  demo.localStorage.setItem(CURSOR_KEY, inbox.lastId || '');
  return demo;
}

/** Khách vừa tạo luôn được unshift lên đầu state.customers. */
const newest = run => run('state.customers[0]');
const inQueue = (run, id) => run(`state.customers.filter(item => !item.saleId && !item.leaderId && !item.teamId).some(item => item.id === '${id}')`);

/* ------------------------------------------------------------------ test cases */

check('data LadiPage vào đúng hàng chờ "Chia Leader" của website khớp mã', async () => {
  const demo = await bootDemoSynced();
  const { run } = demo;

  // Payload thật kiểu LadiPage: tên trường tiếng Việt có dấu, kèm các extra
  // field hệ thống (IP, link, utm_*, ladi_form_id, user-agent, otp_code).
  const sent = await postLadiPage(SLUG_WEB1, {
    'Họ và tên': 'Nguyễn Landing Page',
    'Số điện thoại': '0912001002',
    Email: 'landing@gmail.com',
    IP: '203.0.113.77',
    link: 'https://ladipage.vn/nvt-growth',
    utm_source: 'facebook', utm_campaign: 'CPA-09',
    ladi_form_id: 'FORM-1', 'user-agent': 'Mozilla/5.0', otp_code: '123456'
  });
  assert.equal(sent.status, 200, JSON.stringify(sent.json));
  assert.equal(sent.json.status, 'NEW');

  const before = run('state.customers.length');
  const outcome = await run('pullWebhookInbox(true)');
  assert.equal(outcome.tally.created, 1, JSON.stringify(outcome));
  assert.equal(run('state.customers.length'), before + 1);

  const customer = newest(run);
  assert.equal(customer.name, 'Nguyễn Landing Page');
  assert.equal(customer.phone, '0912001002');
  assert.equal(customer.email, 'landing@gmail.com');
  assert.equal(customer.websiteId, 'WEB-NVT', 'phải quy đúng website theo mã webhook');
  assert.equal(customer.source, 'Landing Page');
  assert.equal(customer.note, 'Data từ nvtagency.top', 'note mặc định theo domain, không chứa slug');
  assert.ok(!customer.note.includes(SLUG_WEB1.toUpperCase()), 'slug là khóa truy cập — không được vào note');

  // Quy tắc đã chốt: landing page KHÔNG thu IP.
  assert.equal(customer.ipAddress, 'Chưa xác định');
  assert.ok(!JSON.stringify(customer).includes('203.0.113.77'), 'IP hạ tầng LadiPage không được lọt vào customer');
  // Adapter cố tình bỏ utm_campaign của LadiPage → campaign phải theo ánh xạ website.
  assert.equal(customer.campaign, 'UNATTRIBUTED', 'WEB-1 chưa ánh xạ campaignId thì phải là UNATTRIBUTED, không tự bịa CPA-09');

  // Phải nằm trong hàng chờ chia Leader (chưa sale/leader/team nào phụ trách).
  assert.equal(customer.saleId, null);
  assert.equal(customer.leaderId, null);
  assert.equal(customer.teamId, null);
  assert.equal(inQueue(run, customer.id), true);

  // Hiện trong bảng "Thứ tự data mới vào" với nhãn "Chờ chia Leader".
  run('currentView = "distribution"; distributionTab = "QUEUE"');
  const queueHtml = run('distributionView()');
  assert.ok(queueHtml.includes('Chờ chia Leader'), 'hàng chờ phải hiện nhãn "Chờ chia Leader"');
  assert.ok(queueHtml.includes(customer.name), 'tên khách landing page phải có trong bảng thứ tự data mới vào');
  assert.ok(queueHtml.includes('Landing Page'), 'nguồn phải hiển thị là Landing Page');

  // Và trong màn "Khách mới" (poolView).
  run('currentView = "pool"');
  assert.ok(run('poolView()').includes(customer.name), 'khách phải hiện ở màn Khách mới');
});

check('mã webhook không khớp website nào → hàng UNATTRIBUTED, không tự gán WEB-1', async () => {
  const demo = await bootDemoSynced();
  const { run } = demo;
  await postLadiPage(SLUG_ORPHAN, {
    'Họ và tên': 'Khách Không Nguồn', 'Số điện thoại': '0912003004', Email: 'orphan@gmail.com'
  });

  const before = run('state.customers.length');
  const outcome = await run('pullWebhookInbox(true)');
  assert.equal(outcome.tally.pending, 1, JSON.stringify(outcome));
  assert.equal(outcome.tally.created, 0);
  assert.equal(run('state.customers.length'), before, 'không được tạo khách khi chưa rõ nguồn');
  assert.equal(run('webhookPending[0].problem'), 'UNATTRIBUTED');
  assert.equal(run('webhookPending[0].customer.name'), 'Khách Không Nguồn');
  // Slug là khóa truy cập: không được rơi vào audit log.
  assert.ok(!run('JSON.stringify(state.audit)').includes(SLUG_ORPHAN.toUpperCase()), 'slug không được xuất hiện trong audit log');
  assert.ok(demo.localStorage.getItem('nvt-crm-webhook-pending-v2').includes(SLUG_ORPHAN.toUpperCase()), 'hàng chờ phải được persist để không mất khi reload');

  // Admin quy nguồn thủ công vào WEB-NVT-2 → khách vào hàng chờ.
  run("resolveWebhookPending(webhookPending[0].id, 'WEB-NVT-2')");
  assert.equal(run('webhookPending.length'), 0);
  const resolved = newest(run);
  assert.equal(resolved.name, 'Khách Không Nguồn');
  assert.equal(resolved.websiteId, 'WEB-NVT-2');
  assert.equal(resolved.source, 'Landing Page');
  assert.equal(resolved.ipAddress, 'Chưa xác định');
  assert.equal(resolved.campaign, 'UNATTRIBUTED', 'website chưa có campaignId phải giữ UNATTRIBUTED');
  assert.equal(resolved.leaderId, null, 'quy nguồn rồi vẫn phải chờ chia Leader');
  assert.equal(inQueue(run, resolved.id), true);
  assert.equal(run('state.audit.some(item => item.action === "ASSIGN_WEBSITE_SOURCE")'), true);
  assert.ok(!run('JSON.stringify(state.audit)').includes(SLUG_ORPHAN.toUpperCase()), 'kể cả sau khi quy nguồn, slug vẫn không vào audit');
});

check('LadiPage retry cùng payload → không tạo khách thứ hai', async () => {
  const demo = await bootDemoSynced();
  const { run } = demo;
  const payload = { 'Họ và tên': 'Đặng Retry E2E', 'Số điện thoại': '0912005006', Email: 'retrye2e@gmail.com' };
  const first = await postLadiPage(SLUG_WEB1, payload);
  const second = await postLadiPage(SLUG_WEB1, payload);
  const third = await postLadiPage(SLUG_WEB1, payload);
  assert.equal(second.json.duplicate, true);
  assert.equal(third.json.duplicate, true);
  assert.equal(second.json.id, first.json.id);

  const before = run('state.customers.length');
  await run('pullWebhookInbox(true)');
  assert.equal(run('state.customers.length'), before + 1, 'chỉ đúng 1 khách mới');

  // Pull lần hai với cursor đã lưu: không được ingest lại.
  const again = await run('pullWebhookInbox(false)');
  assert.equal(again.pulled, 0, JSON.stringify(again));
  assert.equal(run('state.customers.length'), before + 1, 'pull lại không tạo thêm khách');
});

check('cùng SĐT nhưng khác payload → CRM tự xử lý trùng khách, không nhân đôi', async () => {
  const demo = await bootDemoSynced();
  const { run } = demo;
  await postLadiPage(SLUG_WEB1, { 'Họ và tên': 'Trùng SĐT E2E A', 'Số điện thoại': '0912007008', Email: 'trunge2e.a@gmail.com' });
  const second = await postLadiPage(SLUG_WEB1, { 'Họ và tên': 'Trùng SĐT E2E B', 'Số điện thoại': '0912007008', Email: 'trunge2e.b@gmail.com' });
  assert.equal(second.json.duplicate, undefined, 'payload khác nhau thì server phải nhận là hai bản ghi');

  const before = run('state.customers.length');
  const beforeResub = run('state.resubmissions.length');
  const outcome = await run('pullWebhookInbox(true)');
  assert.equal(outcome.tally.created, 1, JSON.stringify(outcome));
  assert.equal(outcome.tally.resubmission, 1, JSON.stringify(outcome));
  assert.equal(run('state.customers.length'), before + 1, 'trùng SĐT không tạo khách thứ hai');
  assert.equal(run('state.resubmissions.length'), beforeResub + 1, 'phải ghi nhận một lần điền lại form');
  assert.equal(newest(run).name, 'Trùng SĐT E2E A', 'giữ khách đầu tiên, không ghi đè');
});

check('x-www-form-urlencoded (content type MẶC ĐỊNH của LadiPage) vẫn vào hàng chờ', async () => {
  const demo = await bootDemoSynced();
  const { run } = demo;
  const body = new URLSearchParams({ name: 'Lê Form Urlencoded', phone: '0912009010', email: 'urlencode@gmail.com' }).toString();
  const sent = await postLadiPage(SLUG_WEB1, body, 'application/x-www-form-urlencoded');
  assert.equal(sent.status, 200);

  const outcome = await run('pullWebhookInbox(true)');
  assert.equal(outcome.tally.created, 1, JSON.stringify(outcome));
  const customer = newest(run);
  assert.equal(customer.name, 'Lê Form Urlencoded');
  assert.equal(customer.websiteId, 'WEB-NVT');
  assert.equal(inQueue(run, customer.id), true);
});

check('thiếu họ tên bị server chặn 422 → không vào tệp khách, không vào hàng chờ', async () => {
  const demo = await bootDemoSynced();
  const { run } = demo;
  const sent = await postLadiPage(SLUG_WEB1, { 'Số điện thoại': '0912011012', Email: 'invalid@gmail.com' });
  assert.equal(sent.status, 422);
  assert.equal(sent.json.status, 'INVALID');

  const before = run('state.customers.length');
  const outcome = await run('pullWebhookInbox(true)');
  assert.ok(outcome.tally.ignored >= 1, 'bản ghi INVALID phải bị bỏ qua');
  assert.equal(outcome.tally.created, 0);
  assert.equal(run('state.customers.length'), before);
  assert.equal(run('state.customers.some(item => item.phone === "0912011012")'), false);
  assert.equal(run('webhookPending.length'), 0, 'INVALID không được đưa vào hàng chờ quy nguồn');
});

check('SĐT 13 số: server nhận nhưng CRM từ chối → vào hàng REJECTED, không mất data', async () => {
  const demo = await bootDemoSynced();
  const { run } = demo;
  // Server chấp nhận 9–13 chữ số, ingestCustomer chỉ nhận 9–11 sau chuẩn hoá.
  const sent = await postLadiPage(SLUG_WEB1, { 'Họ và tên': 'SĐT Dài', 'Số điện thoại': '0912013014000', Email: 'dai@gmail.com' });
  assert.equal(sent.status, 200, 'server chấp nhận tới 13 chữ số');

  const before = run('state.customers.length');
  const outcome = await run('pullWebhookInbox(true)');
  assert.equal(outcome.tally.pending, 1, JSON.stringify(outcome));
  assert.equal(outcome.tally.created, 0);
  assert.equal(run('state.customers.length'), before);
  assert.equal(run('webhookPending[0].problem'), 'REJECTED');
  assert.equal(run('webhookPending[0].customer.name'), 'SĐT Dài');
  assert.equal(run('webhookPending[0].customer.phone'), '0912013014000', 'giữ nguyên SĐT để Admin tự sửa');
  assert.ok(run('webhookPending[0].reason').length > 0, 'phải kèm lý do để Admin hiểu vì sao bị chặn');
});

check('chỉ Admin chạy consumer — SALE/LEADER không được ingest data landing page', async () => {
  await postLadiPage(SLUG_WEB1, { 'Họ và tên': 'Khách Role Test', 'Số điện thoại': '0912015016', Email: 'roletest@gmail.com' });

  for (const role of ['SALE', 'LEADER']) {
    const { run } = bootDemo(role);
    const before = run('state.customers.length');
    const outcome = await run('pullWebhookInbox(false)');
    assert.equal(outcome.skipped, true, `${role} phải bị bỏ qua`);
    assert.equal(run('state.customers.length'), before, `${role} không được tạo khách từ landing page`);
    assert.equal(run('webhookTransport.mode'), 'idle', `${role} không được bật đồng bộ`);
  }
});

check('mở CRM không qua server Node (file://) → báo offline, không crash', async () => {
  const { run } = bootDemo();
  run('window.location.origin = "file://"');
  const outcome = await run('pullWebhookInbox(true)');
  assert.equal(outcome.pulled, 0);
  assert.equal(run('webhookTransport.mode'), 'offline');
  assert.ok(run('webhookTransport.detail').includes('4173'), 'phải chỉ dẫn chạy qua server Node cổng 4173');
  // CRM vẫn render bình thường.
  run('currentView = "websites"');
  assert.ok(run('websitesView()').length > 0);
});

check('server webhook chưa chạy → CRM vẫn dùng được, nhãn chuyển offline', async () => {
  const { run } = bootDemo();
  run('window.location.origin = "http://127.0.0.1:4197"'); // cổng không ai nghe
  const outcome = await run('pullWebhookInbox(true)');
  assert.equal(outcome.pulled, 0);
  assert.equal(run('webhookTransport.mode'), 'offline');
  run('currentView = "distribution"; distributionTab = "QUEUE"');
  assert.ok(run('distributionView()').length > 0, 'hàng chờ vẫn render được khi server chết');
});

check('mục Websites hiện panel trạng thái đồng bộ webhook', async () => {
  const { run } = bootDemo();
  run('currentView = "websites"');
  const html = run('websitesView()');
  assert.ok(html.includes('webhook-transport'), 'phải có panel trạng thái đồng bộ');
  assert.ok(html.includes('data-webhook-sync'), 'phải có nút "Đồng bộ ngay"');
  assert.ok(html.includes('data-webhook-pending'), 'phải có nút xem data chờ quy nguồn');
  assert.ok(html.includes('16-webhook-server.cjs'), 'phải chỉ dẫn cách chạy server');
  // URL webhook vẫn hiện trong danh mục website như người dùng đã yêu cầu.
  assert.ok(html.includes(SLUG_WEB1), 'mã webhook phải hiện ở danh mục website');
  assert.ok(html.includes(`https://nvtagency.top/api/data-sources/webhook/${SLUG_WEB1}/`), 'phải hiện URL công khai để dán vào LadiPage');
  assert.ok(html.includes(`${BASE}/api/data-sources/webhook/${SLUG_WEB1}/`), 'phải hiện URL nội bộ để test trên máy này');
  assert.ok(html.includes('application/json'), 'phải nói rõ nhận application/json');
});

check('hàng chờ chia Leader hiện banner khi còn data chưa quy được nguồn', async () => {
  const { run } = bootDemo();
  run('currentView = "distribution"; distributionTab = "QUEUE"');
  assert.ok(!run('distributionView()').includes('webhook-pending'), 'không còn data chờ thì không hiện banner');

  run(`webhookPending.push({ id: 'WH-BANNER-1', slug: '${SLUG_ORPHAN.toUpperCase()}', receivedAt: '2026-09-10 09:00', problem: 'UNATTRIBUTED', reason: 'Chưa có website nào dùng mã webhook này', customer: { name: 'Khách Banner', phone: '0912017018', email: '' } })`);
  const html = run('distributionView()');
  assert.ok(html.includes('webhook-pending'), 'phải hiện banner trong hàng chờ');
  assert.ok(!html.includes('Khách Banner'), 'banner chỉ đếm, không in chi tiết khách');
  assert.ok(html.includes('data-webhook-pending'), 'banner phải bấm được để mở modal quy nguồn');
  assert.ok(!html.includes(SLUG_ORPHAN.toUpperCase()), 'slug không được in ra màn hình Leader');
});

check('IP chỉ ghi cho luồng sale tạo khách và đăng ký web — landing page thì không', async () => {
  const demo = bootDemo('SALE');
  const { run } = demo;
  await run('refreshSessionContext()');
  const ip = run('sessionContextIp');
  assert.ok(ip && ip.length > 0, 'phải hỏi được IP thật từ /api/session-context');
  assert.equal(run('sessionContextLoaded'), true);
  assert.notEqual(ip, 'Chờ backend xác định');

  // Khách tự đăng ký từ web → ghi IP thật, hết nhãn chờ.
  run(`$('#registerPhone').value = '0912021022';
       $('#registerEmail').value = 'dangkyweb@gmail.com';
       $('#registerPassword').value = 'matkhau123';
       $('#registerPasswordConfirm').value = 'matkhau123';`);
  const before = run('state.registrations.length');
  await run('submitRegistration()');
  assert.equal(run('state.registrations.length'), before + 1, 'hồ sơ đăng ký phải được tạo');
  assert.equal(run('state.registrations[0].ipAddress'), ip, 'đăng ký từ web phải mang IP thật của phiên');
  assert.notEqual(run('state.registrations[0].ipAddress'), 'Chờ backend xác định');

  // Landing page → KHÔNG có IP, kể cả khi LadiPage gửi extra field "IP".
  // Phải boot (và prime cursor) TRƯỚC khi POST, đúng thứ tự ngoài đời:
  // CRM đang mở sẵn thì landing page mới bắn data về.
  const admin = await bootDemoSynced();
  await postLadiPage(SLUG_WEB1, {
    'Họ và tên': 'Khách Không IP', 'Số điện thoại': '0912023024', Email: 'noip@gmail.com', IP: '198.51.100.23'
  });
  const pulled = await admin.run('pullWebhookInbox(true)');
  assert.equal(pulled.tally.created, 1, JSON.stringify(pulled));
  const landing = newest(admin.run);
  assert.equal(landing.name, 'Khách Không IP');
  assert.equal(landing.ipAddress, 'Chưa xác định', 'landing page không được thu IP');
  assert.ok(!JSON.stringify(landing).includes('198.51.100.23'), 'IP trong payload LadiPage phải bị loại bỏ');
});

check('cursor được lưu để khởi động lại không ingest lại cả inbox', async () => {
  const demo = await bootDemoSynced();
  const { run } = demo;
  await postLadiPage(SLUG_WEB1, { 'Họ và tên': 'Khách Cursor', 'Số điện thoại': '0912019020', Email: 'cursor@gmail.com' });
  await run('pullWebhookInbox(true)');

  const cursor = demo.localStorage.getItem(CURSOR_KEY);
  assert.ok(cursor && cursor.length > 0, 'cursor phải được lưu vào localStorage');
  assert.equal(run('loadWebhookCursor()'), cursor);
  const consumed = demo.localStorage.getItem(CONSUMED_KEY);
  assert.ok(JSON.parse(consumed).length > 0, 'phải ghi lại các id đã xử lý');

  // Boot lại (mất biến trong RAM, chỉ còn localStorage) → không ingest lại.
  const reborn = bootDemo();
  reborn.localStorage.setItem(CURSOR_KEY, cursor);
  reborn.localStorage.setItem(CONSUMED_KEY, consumed);
  const before = reborn.run('state.customers.length');
  const outcome = await reborn.run('pullWebhookInbox(false)');
  assert.equal(outcome.pulled, 0, JSON.stringify(outcome));
  assert.equal(reborn.run('state.customers.length'), before, 'reload không được nhân đôi khách');
});

check('cursor mất hiệu lực → vòng consumed chặn ingest lại cả inbox', async () => {
  const demo = await bootDemo(); // KHÔNG prime: lần pull đầu ingest cả inbox, như CRM mở lần đầu
  const { run } = demo;
  const first = await run('pullWebhookInbox(true)');
  assert.ok(first.pulled > 0, 'lần đầu phải kéo được data đã bắn về trước khi mở CRM');

  // Server trả VỀ TOÀN BỘ inbox khi cursor không còn tồn tại trong đó
  // (inbox bị xoá, hoặc bị cắt theo giới hạn 5000 bản ghi).
  run('saveWebhookCursor("WH-khong-con-ton-tai")');
  const before = run('state.customers.length');
  const outcome = await run('pullWebhookInbox(false)');
  assert.equal(outcome.tally.created, 0, JSON.stringify(outcome));
  assert.ok(outcome.tally.duplicate > 0, 'các bản ghi cũ phải bị nhận diện là đã xử lý');
  assert.equal(run('state.customers.length'), before, 'tuyệt đối không ingest lại khách cũ thành "điền lại form"');
});

/* ---------------------------------------------------------------------- runner */

async function main() {
  if (fs.existsSync(inboxFile)) fs.rmSync(inboxFile);
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', WEBHOOK_INBOX_FILE: inboxFile },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', chunk => { serverLog += chunk; });
  child.stderr.on('data', chunk => { serverLog += chunk; });

  let failed = 0;
  try {
    await waitForServer(child);
    for (const [name, fn] of results) {
      try {
        await fn();
        console.log(`  ✓ ${name}`);
      } catch (error) {
        failed += 1;
        console.log(`  ✗ ${name}\n      ${error.message.split('\n').join('\n      ')}`);
      }
    }
  } catch (error) {
    failed += 1;
    console.error('Không chạy được test:', error.message);
    console.error(serverLog);
  } finally {
    child.kill();
    await sleep(200);
  }

  console.log(failed === 0 ? `\nPASS · ${results.length} test end-to-end` : `\nFAIL · ${failed}/${results.length} test lỗi`);
  process.exit(failed === 0 ? 0 : 1);
}

main();

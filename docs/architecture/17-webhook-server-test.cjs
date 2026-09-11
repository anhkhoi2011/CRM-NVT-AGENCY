/**
 * Test HTTP thật cho 16-webhook-server.cjs.
 * Chạy: node docs/architecture/17-webhook-server-test.cjs
 *
 * Spawn server như một process con, POST thật bằng fetch, kiểm tra inbox.
 */
'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER = path.join(__dirname, '16-webhook-server.cjs');
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PORT = 4199;
const BASE = `http://127.0.0.1:${PORT}`;
const SLUG = 'ds-1789015513831-ZPKFFVK9S9A';
const HOOK = `${BASE}/api/data-sources/webhook/${SLUG}/`;
const inboxFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'crm-hook-')), 'inbox.json');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer(child, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch { /* chưa listen xong */ }
    if (child.exitCode !== null) throw new Error(`server exited early (code ${child.exitCode})`);
    await sleep(150);
  }
  throw new Error('server không khởi động kịp');
}

async function post(body, contentType, extraHeaders = {}) {
  const headers = { 'Content-Type': contentType, ...extraHeaders };
  const response = await fetch(HOOK, { method: 'POST', headers, body });
  return { status: response.status, json: await response.json() };
}

const results = [];
function check(name, fn) { results.push([name, fn]); }

/* ------------------------------------------------------------ test cases */

check('JSON với tên trường tiếng Việt có dấu', async () => {
  const { status, json } = await post(
    JSON.stringify({ 'Họ và tên': 'Nguyễn Hoài An', 'Số điện thoại': '0912345678', Email: 'hoaian@gmail.com' }),
    'application/json'
  );
  assert.equal(status, 200);
  assert.equal(json.received, true);
  assert.equal(json.status, 'NEW');

  const inbox = await (await fetch(`${BASE}/api/data-sources/inbox?raw=1`)).json();
  const record = inbox.items.find(item => item.id === json.id);
  assert.ok(record, 'bản ghi phải nằm trong inbox');
  assert.deepEqual(record.customer, { name: 'Nguyễn Hoài An', phone: '0912345678', email: 'hoaian@gmail.com' });
  assert.equal(record.slug, SLUG.toUpperCase());
  assert.equal(record.contentType, 'application/json');
});

check('chỉ lưu họ tên / SĐT / email — KHÔNG có IP', async () => {
  const { json } = await post(
    JSON.stringify({
      'Họ và tên': 'Trần Thị Bích', 'Số điện thoại': '0987654321', Email: 'bich@gmail.com',
      IP: '203.0.113.77', link: 'https://ladipage.vn/x', utm_source: 'facebook',
      utm_campaign: 'CPA-09', ladi_form_id: 'FORM-1', 'user-agent': 'Mozilla/5.0', otp_code: '123456'
    }),
    'application/json'
  );
  const inbox = await (await fetch(`${BASE}/api/data-sources/inbox?raw=1`)).json();
  const record = inbox.items.find(item => item.id === json.id);
  assert.deepEqual(Object.keys(record.customer).sort(), ['email', 'name', 'phone']);
  assert.equal(record.customer.ip, undefined);
  assert.equal(record.customer.ipAddress, undefined);
  assert.ok(!JSON.stringify(record.customer).includes('203.0.113.77'), 'IP không được lọt vào customer');
});

check('x-www-form-urlencoded (content type MẶC ĐỊNH của LadiPage)', async () => {
  const body = new URLSearchParams({ name: 'Lê Văn Form', phone: '0901001001', email: 'form@gmail.com' }).toString();
  const { status, json } = await post(body, 'application/x-www-form-urlencoded');
  assert.equal(status, 200);
  assert.equal(json.status, 'NEW');
  const inbox = await (await fetch(`${BASE}/api/data-sources/inbox?raw=1`)).json();
  const record = inbox.items.find(item => item.id === json.id);
  assert.equal(record.contentType, 'application/x-www-form-urlencoded');
  assert.equal(record.customer.name, 'Lê Văn Form');
});

check('multipart/form-data (lựa chọn thứ 3 của LadiPage)', async () => {
  const form = new FormData();
  form.append('Họ tên', 'Phạm Multipart');
  form.append('Điện thoại', '0902002002');
  form.append('Gmail', 'multi@gmail.com');
  const response = await fetch(HOOK, { method: 'POST', body: form });
  const json = await response.json();
  assert.equal(response.status, 200, JSON.stringify(json));
  assert.equal(json.status, 'NEW');
});

check('charset=utf-8 trong content type vẫn parse được', async () => {
  const { status, json } = await post(
    JSON.stringify({ name: 'Võ Charset', phone: '0903003003', email: 'charset@gmail.com' }),
    'application/json; charset=utf-8'
  );
  assert.equal(status, 200);
  assert.equal(json.status, 'NEW');
});

check('không có trailing slash vẫn nhận', async () => {
  const response = await fetch(HOOK.replace(/\/$/, ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Không Slash', phone: '0904004004', email: 'noslash@gmail.com' })
  });
  assert.equal(response.status, 200);
});

check('retry trùng payload không tạo bản ghi thứ hai', async () => {
  const payload = JSON.stringify({ name: 'Đặng Retry', phone: '0905005005', email: 'retry@gmail.com' });
  const before = await (await fetch(`${BASE}/api/data-sources/inbox`)).json();
  const first = await post(payload, 'application/json');
  const second = await post(payload, 'application/json');
  const third = await post(payload, 'application/json');
  assert.equal(first.json.duplicate, undefined);
  assert.equal(second.json.duplicate, true);
  assert.equal(third.json.duplicate, true);
  assert.equal(second.json.id, first.json.id);
  const after = await (await fetch(`${BASE}/api/data-sources/inbox?raw=1`)).json();
  assert.equal(after.count, before.count + 1, 'chỉ đúng 1 bản ghi mới');
  const record = after.items.find(item => item.id === first.json.id);
  assert.equal(record.retryCount, 2);
});

check('cùng SĐT nhưng payload khác → bản ghi khác (CRM tự xử lý trùng khách)', async () => {
  const first = await post(JSON.stringify({ name: 'Trùng SĐT A', phone: '0906006006', email: 'a@gmail.com' }), 'application/json');
  const second = await post(JSON.stringify({ name: 'Trùng SĐT B', phone: '0906006006', email: 'b@gmail.com' }), 'application/json');
  assert.equal(second.json.duplicate, undefined);
  assert.notEqual(second.json.id, first.json.id);
});

check('thiếu họ tên → 422 INVALID, không vào luồng khách', async () => {
  const { status, json } = await post(JSON.stringify({ phone: '0907007007', email: 'x@gmail.com' }), 'application/json');
  assert.equal(status, 422);
  assert.equal(json.status, 'INVALID');
  assert.ok(json.problems.some(problem => problem.includes('họ tên')));
  const inbox = await (await fetch(`${BASE}/api/data-sources/inbox?raw=1`)).json();
  const record = inbox.items.find(item => item.id === json.id);
  assert.equal(record.status, 'INVALID');
});

check('SĐT quá ngắn → 422 INVALID', async () => {
  const { status, json } = await post(JSON.stringify({ name: 'SĐT Ngắn', phone: '123', email: 'x@gmail.com' }), 'application/json');
  assert.equal(status, 422);
  assert.equal(json.status, 'INVALID');
});

check('email sai định dạng → 422, nhưng thiếu email thì vẫn nhận', async () => {
  const bad = await post(JSON.stringify({ name: 'Email Lỗi', phone: '0908008008', email: 'not-an-email' }), 'application/json');
  assert.equal(bad.status, 422);

  const noEmail = await post(JSON.stringify({ name: 'Không Email', phone: '0908008009' }), 'application/json');
  assert.equal(noEmail.status, 200);
  assert.equal(noEmail.json.status, 'NEW');
});

check('slug sai định dạng → 404', async () => {
  const response = await fetch(`${BASE}/api/data-sources/webhook/khong-hop-le/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(response.status, 404);
});

check('GET vào webhook → 405', async () => {
  const response = await fetch(HOOK);
  assert.equal(response.status, 405);
});

check('body JSON hỏng → 400', async () => {
  const { status } = await post('{ khong phai json', 'application/json');
  assert.equal(status, 400);
});

check('inbox đọc được qua cursor since', async () => {
  const all = await (await fetch(`${BASE}/api/data-sources/inbox`)).json();
  assert.ok(all.count > 0);
  const pivot = all.items[0].id;
  const tail = await (await fetch(`${BASE}/api/data-sources/inbox?since=${encodeURIComponent(pivot)}`)).json();
  assert.equal(tail.count, all.count - 1);
  assert.ok(!tail.items.some(item => item.id === pivot));
});

check('inbox mặc định không trả raw/dedupeKey', async () => {
  const all = await (await fetch(`${BASE}/api/data-sources/inbox`)).json();
  for (const item of all.items) {
    assert.equal(item.raw, undefined);
    assert.equal(item.dedupeKey, undefined);
  }
});

check('SSE đẩy event khi có bản ghi mới', async () => {
  const controller = new AbortController();
  const stream = await fetch(`${BASE}/api/data-sources/stream`, { signal: controller.signal });
  assert.equal(stream.headers.get('content-type').includes('text/event-stream'), true);
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // Khung SSE chỉ chứa {id, receivedAt, slug} — slug được VIẾT HOA.
  // Nên chờ đúng dòng "data:" chứ không chờ tên khách hàng (không có trong khung).
  const drained = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return buffer;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes('data:')) return buffer;
    }
  })();

  await sleep(200);
  const { json } = await post(
    JSON.stringify({ name: 'Khách SSE', phone: '0909009009', email: 'sse@gmail.com' }),
    'application/json'
  );
  const received = await Promise.race([drained, sleep(4000).then(() => '')]);
  controller.abort();
  assert.ok(received.startsWith('retry: 3000'), `SSE phải mở đầu bằng retry, thực tế: ${JSON.stringify(received)}`);
  const frame = received.split('\n').find(line => line.startsWith('data:'));
  assert.ok(frame, `SSE phải đẩy đúng khung data: cho bản ghi mới, thực tế: ${JSON.stringify(received)}`);
  const pushed = JSON.parse(frame.slice('data:'.length).trim());
  assert.equal(pushed.id, json.id, 'khung SSE phải trỏ đúng bản ghi vừa POST');
  assert.equal(pushed.slug, SLUG.toUpperCase());
  assert.ok(pushed.receivedAt, 'khung SSE phải kèm receivedAt');
});

check('CORS echo Origin, không dùng dấu *', async () => {
  const response = await fetch(`${BASE}/api/data-sources/inbox`, { headers: { Origin: 'https://ladipage.vn' } });
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://ladipage.vn');
  assert.equal(response.headers.get('vary'), 'Origin');
});

check('preflight OPTIONS cho webhook → 204', async () => {
  const response = await fetch(HOOK, { method: 'OPTIONS', headers: { Origin: 'https://ladipage.vn' } });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('access-control-allow-methods'), /POST/);
});

check('session-context trả IP thật cho luồng đăng ký web', async () => {
  const json = await (await fetch(`${BASE}/api/session-context`)).json();
  assert.ok(typeof json.ip === 'string' && json.ip.length > 0);
  assert.notEqual(json.ip, 'Chờ backend xác định');
});

check('server phục vụ file tĩnh của repo', async () => {
  const response = await fetch(`${BASE}/docs/architecture/14-crm-complete-demo.html`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const text = await response.text();
  assert.match(text, /14-crm-complete-demo\.js/);
});

check('chặn path traversal ra ngoài repo', async () => {
  // path.posix.normalize kẹp ".." tại root, nên mọi dãy ".." đều không thể thoát khỏi repo.
  // Hai attempt đầu rơi vào đường dẫn không tồn tại → 404.
  for (const attempt of [
    '/../../windows/win.ini',
    '/%2e%2e/%2e%2e/windows/win.ini',
    '/docs/architecture/../../../../../../windows/win.ini'
  ]) {
    const response = await fetch(`${BASE}${attempt}`);
    assert.ok([403, 404].includes(response.status), `${attempt} phải bị chặn, thực tế ${response.status}`);
  }

  // Attempt này bị kẹp về đúng "/ghi chú.txt" — file CÓ THẬT của repo, nên 200 là đúng.
  // Điều phải khẳng định: nội dung trả về là file trong repo, không phải file ngoài repo.
  const clamped = await fetch(`${BASE}/docs/../../ghi%20ch%C3%BA.txt`);
  assert.equal(clamped.status, 200);
  const served = await clamped.text();
  const onDisk = fs.readFileSync(path.join(REPO_ROOT, 'ghi chú.txt'), 'utf8');
  assert.equal(served, onDisk, 'phải phục vụ đúng file ghi chú.txt trong repo');
  assert.ok(!/win\.ini|\[fonts\]/i.test(served), 'tuyệt đối không được lọt file hệ thống');
});

check('endpoint /api lạ → 404 JSON', async () => {
  const response = await fetch(`${BASE}/api/khong-ton-tai`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /application\/json/);
});

check('body vượt giới hạn → 413', async () => {
  const huge = JSON.stringify({ name: 'Khách To', phone: '0910009010', email: 'big@gmail.com', junk: 'x'.repeat(400 * 1024) });
  const response = await fetch(HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: huge });
  assert.equal(response.status, 413);
});

/* ---------------------------------------------------------------- runner */

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

  // Inbox phải được ghi xuống đĩa thật (bất biến, sống qua restart).
  const persisted = fs.existsSync(inboxFile) ? JSON.parse(fs.readFileSync(inboxFile, 'utf8')) : [];
  console.log(`\n  inbox trên đĩa: ${persisted.length} bản ghi`);
  assert.ok(persisted.length > 0, 'inbox phải được persist ra đĩa');

  console.log(failed === 0 ? `\nPASS · ${results.length} test webhook` : `\nFAIL · ${failed}/${results.length} test lỗi`);
  process.exit(failed === 0 ? 0 : 1);
}

main();

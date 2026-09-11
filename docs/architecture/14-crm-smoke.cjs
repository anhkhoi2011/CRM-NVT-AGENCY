const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createElement() {
  const classes = new Set();
  return {
    value: '', innerHTML: '', textContent: '', children: [], dataset: {}, isConnected: true,
    className: '',
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, force) => force === undefined
        ? (classes.has(name) ? (classes.delete(name), false) : (classes.add(name), true))
        : (force ? classes.add(name) : classes.delete(name), force)
    },
    addEventListener() {}, append() {}, remove() {}, focus() {}, click() {}, reset() {},
    setAttribute() {}, getAttribute() { return null; }, querySelectorAll() { return []; }
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

const elements = new Map();
const element = selector => {
  if (!elements.has(selector)) elements.set(selector, createElement());
  return elements.get(selector);
};
const document = {
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
};
const localStorage = storage();
const sessionStorage = storage();
const sandbox = {
  console, document, localStorage, sessionStorage, structuredClone, Blob,
  crypto: require('node:crypto').webcrypto,
  navigator: { clipboard: null },
  fetch: () => Promise.reject(new Error('fetch disabled in smoke test')),
  EventSource: undefined,
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  window: {
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    scrollTo() {},
    confirm: () => true,
    location: { origin: 'http://localhost:4173', href: 'http://localhost:4173/' }
  },
  setTimeout: () => 1,
  clearTimeout() {},
  setInterval: () => 1,
  clearInterval() {}
};

const filename = path.join(__dirname, '14-crm-complete.js');
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
const run = expression => vm.runInContext(expression, sandbox);

assert.deepEqual(Array.from(run('ACCOUNTS.map(account => account.role)')), ['ADMIN', 'LEADER', 'SALE']);
assert.equal(run('ACCOUNTS[0].name'), 'Start');
assert.equal(run('state.version'), 3);
assert.deepEqual(Array.from(run('state.websites.map(website => website.id)')), ['WEB-NVT', 'WEB-NVT-2']);
assert.equal(run('state.customers.length'), 0);
assert.equal(run('state.products.length'), 0);
assert.equal(run('state.orders.length'), 0);

// Production data starts empty; invalid persisted values must still be normalized.
run(`globalThis.poisonedState = initialState();
  poisonedState.settings.slaMinutes = 'invalid';
  poisonedState.settings.assignmentMode = 'INVALID';
  poisonedState.settings.assignmentCursor = { leaders: -8, salesByTeam: { T2: 'broken' } };
  poisonedState.websites = [{ ...poisonedState.websites[0], webhookSlug: 'bad' }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(poisonedState));
  globalThis.sanitizedState = loadState();`);
assert.equal(run('sanitizedState.settings.slaMinutes'), 30);
assert.equal(run('sanitizedState.settings.assignmentMode'), 'MANUAL');
assert.equal(run('sanitizedState.settings.assignmentCursor.leaders'), 0);
assert.match(run('sanitizedState.websites[0].webhookSlug'), /^ds-\d{13}-[A-Z0-9]{11}$/);

run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[0]; currentView = "websites"');
const websiteHtml = run('websitesView()');
assert.match(websiteHtml, /ds-1789015513831-ZPKFFVK9S9A/);
assert.match(websiteHtml, /https:\/\/nvtagency\.top\/api\/data-sources\/webhook\//);
assert.match(websiteHtml, /application\/json/);
assert.doesNotMatch(websiteHtml, /\bleads?\b/i);

const created = run(`ingestCustomer({
  name: 'Smoke Customer', phone: '0912345678', email: 'smoke@example.com',
  websiteId: 'WEB-NVT', source: 'Landing Page', campaign: 'UNATTRIBUTED'
}, WEBHOOK_INTAKE_CONTEXT)`);
assert.equal(created.created, true);
assert.equal(run('state.customers.length'), 1);
assert.equal(run('state.customers[0].websiteId'), 'WEB-NVT');
assert.equal(run('state.customers[0].ipAddress'), 'Chưa xác định');
assert.equal(run('state.customers[0].saleId'), null);
assert.equal(run('state.customers[0].leaderId'), null);

const duplicate = run(`ingestCustomer({
  name: 'Smoke Customer Again', phone: '0912345678', email: 'again@example.com',
  websiteId: 'WEB-NVT', source: 'Landing Page', campaign: 'UNATTRIBUTED'
}, WEBHOOK_INTAKE_CONTEXT)`);
assert.equal(duplicate.duplicate, true);
assert.equal(run('state.customers.length'), 1);
assert.equal(run('state.resubmissions.length'), 1);

const invalid = run(`ingestCustomer({ name: 'Invalid', phone: '123', websiteId: 'WEB-NVT' }, WEBHOOK_INTAKE_CONTEXT)`);
assert.equal(invalid.created, false);
assert.equal(run('state.customers.length'), 1);

run(`globalThis.pendingResult = ingestWebhookRecord({
  id: 'WHE-SMOKE-1', slug: 'DS-9999999999999-UNKNOWN01', status: 'NEW',
  customer: { name: 'Pending Customer', phone: '0987654321', email: '' }
});`);
assert.equal(run('pendingResult'), 'pending');
assert.equal(run('webhookPending[0].problem'), 'UNATTRIBUTED');
assert.ok(localStorage.getItem('nvt-crm-webhook-pending-v2'));

for (const roleIndex of [0, 1, 2]) {
  run(`currentAccount = ACCOUNTS[${roleIndex}]`);
  assert.equal(run('allowedViews().includes("dashboard")'), true);
  assert.equal(typeof run('dashboardView()'), 'string');
}

run('currentAccount = ACCOUNTS[0]');
for (const view of ['customers', 'distribution', 'websites', 'notifications', 'settings']) {
  run(`currentView = ${JSON.stringify(view)}`);
  assert.equal(typeof run('VIEW_RENDERERS[currentView]()'), 'string');
}

for (const roleIndex of [1, 2]) {
  run(`currentAccount = ACCOUNTS[${roleIndex}]`);
  assert.equal(run('allowedViews().includes("products")'), false);
  assert.equal(run('allowedViews().includes("profile")'), true);
  assert.match(run('productsView()'), /403/);
}
run(`state.settings.leaderAttendanceRequired = false; currentAccount = ACCOUNTS[1]`);
assert.equal(run('allowedViews().includes("attendance")'), false);
assert.match(run('attendanceView()'), /403/);
run(`state.settings.leaderAttendanceRequired = true; currentAccount = ACCOUNTS[0]`);
assert.equal(run('allowedViews().includes("products")'), true);
console.log('PASS · production CRM smoke test');

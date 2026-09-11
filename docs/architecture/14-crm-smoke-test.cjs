const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createElement() {
  const classes = new Set();
  return {
    value: '', innerHTML: '', textContent: '', children: [], dataset: {}, isConnected: true,
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, force) => force === undefined ? (classes.has(name) ? (classes.delete(name), false) : (classes.add(name), true)) : (force ? classes.add(name) : classes.delete(name), force)
    },
    addEventListener() {}, append() {}, remove() {}, focus() {}, click() {},
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
  window: { matchMedia: () => ({ matches: false }), addEventListener() {}, scrollTo() {}, confirm: () => true, location: { origin: 'http://localhost:4173', href: 'http://localhost:4173/demo.html' } },
  /* KHÔNG được chạy callback đồng bộ. initialize() → startWebhookConsumer() xếp
     một vòng poll tự nối lại bằng setTimeout; shim đồng bộ biến vòng đó thành
     chuỗi microtask không bao giờ nhường quyền điều khiển, nên process in xong
     "PASS" rồi treo forever. Không assertion nào ở đây cần timer thật sự chạy. */
  setTimeout: () => 1,
  clearTimeout() {},
  setInterval: () => 1,
  clearInterval() {}
};

const filename = path.join(__dirname, '14-crm-complete-demo.js');
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
const run = expression => vm.runInContext(expression, sandbox);

assert.equal(run('ACCOUNTS.length'), 3);
assert.deepEqual(Array.from(run('ACCOUNTS.map(account => account.role)')), ['ADMIN', 'LEADER', 'SALE']);
assert.equal(run('ACCOUNTS[0].name'), 'Start');
for (let accountIndex = 0; accountIndex < 3; accountIndex += 1) {
  run(`currentAccount = ACCOUNTS[${accountIndex}]`);
  assert.equal(run('allowedViews().includes("tasks")'), false);
}

run(`globalThis.poisonedState = initialState();
  poisonedState.settings.slaMinutes = '<img src=x onerror=alert(1)>';
  poisonedState.settings.monthlyTarget = 'not-a-number';
  poisonedState.settings.assignmentMode = 'INVALID';
  poisonedState.settings.assignmentCursor = { leaders: -8, salesByTeam: { T2: 'broken' } };
  poisonedState.customers.unshift({ ...poisonedState.customers[0], name: 'Duplicate customer' });
  globalThis.poisonOrders = makeOrders().map(order => ({ ...order, id: 'ORD-TEST-' + order.id.slice(4) }));
  poisonedState.orders = poisonOrders.slice(0, 2);
  poisonedState.orders[0].total = '500';
  poisonedState.orders[0].paymentReconciled = 'false';
  poisonedState.orders.push({ ...poisonOrders[0], id: 'ORD-BAD-PRODUCT', productId: 'missing-product' });
  poisonedState.orders.push({ ...poisonOrders[1], id: 'ORD-BAD-TIMESTAMP', createdAt: '2026-02-30 24:00' });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(poisonedState));
  globalThis.sanitizedState = loadState();`);
assert.equal(run('sanitizedState.settings.slaMinutes'), 30);
assert.equal(run('sanitizedState.settings.monthlyTarget'), 350000000);
assert.equal(run('sanitizedState.settings.assignmentMode'), 'MANUAL');
assert.equal(run('sanitizedState.settings.assignmentCursor.leaders'), 0);
assert.equal(run('sanitizedState.settings.assignmentCursor.salesByTeam.T2 || 0'), 0);
assert.equal(run('new Set(sanitizedState.customers.map(customer => customer.id)).size'), run('sanitizedState.customers.length'));
assert.equal(run('typeof sanitizedState.orders[0].total'), 'number');
assert.equal(run('sanitizedState.orders[0].paymentReconciled'), false);
assert.equal(run('sanitizedState.orders[0].subtotal'), run('sanitizedState.orders[0].unitPrice * sanitizedState.orders[0].qty'));
assert.equal(run('sanitizedState.orders[0].total'), run('sanitizedState.orders[0].subtotal - sanitizedState.orders[0].discount'));
assert.equal(run('sanitizedState.orders.some(order => order.id === "ORD-BAD-PRODUCT")'), false);
assert.equal(run('sanitizedState.orders.some(order => order.id === "ORD-BAD-TIMESTAMP")'), false);
assert.equal(run('Array.isArray(sanitizedState.members)'), true);
assert.equal(run('typeof sanitizedState.security.twoFactorEnabled'), 'boolean');
localStorage.removeItem('nvt-crm-complete-v2');

run('currentAccount = ACCOUNTS[0]');
assert.equal(run('scopedCustomers().length'), 11);
assert.equal(run('scopedOrders().length'), run('state.orders.length'));
assert.deepEqual(Array.from(run(`NAVIGATION.ADMIN.find(group => group[0] === 'Vận hành')[1].map(item => item[0])`)), ['dashboard', 'customers', 'distribution', 'websites']);
assert.equal(run('NAVIGATION.ADMIN.flatMap(([, items]) => items).some(item => item[0] === "pool")'), false);
assert.equal(run('NAVIGATION.LEADER.flatMap(([, items]) => items).some(item => item[0] === "pool")'), false);
assert.equal(run(`NAVIGATION.ADMIN.flatMap(([, items]) => items.map(item => item[0])).filter(view => view === 'websites').length`), 1);
assert.equal(run(`NAVIGATION.ADMIN.flatMap(([, items]) => items.map(item => item[0])).some(view => ['content', 'reports'].includes(view))`), false);
assert.equal(run('state.customers.every(customer => websiteById(customer.websiteId))'), true);
assert.equal(run('state.websites.reduce((sum, website) => sum + websiteCustomerRows(website.id).length, 0)'), run('state.customers.length'));
const websiteHtml = run('websitesView()');
assert.match(websiteHtml, /Khách hàng tổng/);
assert.match(websiteHtml, /Khách mới/);
assert.match(websiteHtml, /Cấu hình API/);
assert.match(websiteHtml, /Chưa cấu hình/);
assert.doesNotMatch(websiteHtml, /Nhận data mẫu/);
assert.doesNotMatch(websiteHtml, /\bleads?\b/i);
run('configureWebsiteModal("WEB-1")');
element('#websiteApiProvider').value = 'LANDING_API';
element('#websiteApiEndpoint').value = 'https://landing.example.test/v1';
element('#websiteExternalAccount').value = 'ACCOUNT-01';
element('#websiteCampaignId').value = 'CAMPAIGN-01';
element('#websiteFormId').value = 'FORM-01';
element('#websiteCredential').value = 'landing-secret-1234';
element('#websiteApiForm').onsubmit({ preventDefault() {} });
assert.equal(run('websiteById("WEB-1").connectionStatus'), 'PENDING_BACKEND');
assert.equal(run('websiteById("WEB-1").credentialLast4'), '1234');
assert.equal(run('websiteById("WEB-1").status'), 'PAUSED');
assert.doesNotMatch(run('JSON.stringify(state)'), /landing-secret-1234/);
assert.equal(run('testWebsiteConnection("WEB-1")'), false);
run('toggleWebsite("WEB-1")');
assert.equal(run('websiteById("WEB-1").status'), 'PAUSED');
const capturedWebsiteCustomerId = run('state.customers.find(customer => customer.websiteId === "WEB-1").id');
assert.match(run('customersView()'), /nvtagency\.vn/);
run(`openCustomerDrawer(${JSON.stringify(capturedWebsiteCustomerId)})`);
assert.match(element('#drawerRoot').innerHTML, /Landing page nguồn/);
assert.match(element('#drawerRoot').innerHTML, /nvtagency\.vn/);
run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[0]');
assert.equal(run('periodSnapshot().revenue'), run('dailySeries().reduce((sum, day) => sum + day.revenue, 0)'));
assert.equal(run('periodSnapshot().revenue'), run('productPerformance(scopedOrders()).reduce((sum, item) => sum + item.revenue, 0)'));
assert.equal(run('periodSnapshot().revenue'), run('sourcePerformance().reduce((sum, item) => sum + item.revenue, 0)'));
assert.equal(run('periodSnapshot().revenue'), run('websiteRevenuePerformance().reduce((sum, item) => sum + item.net, 0)'));
assert.equal(run('financialEvents(state.orders).length'), run('state.orders.filter(order => order.paidAt).length + state.orders.filter(order => order.refundedAt).length'));
assert.equal(run('periodSnapshot().leads'), run('periodSnapshot().customers.length'));
const defaultSlaBreaches = run('slaBreachedCustomers().length');
run('state.settings.slaMinutes = 100000; refreshTaskStatuses()');
assert.ok(run('slaBreachedCustomers().length') < defaultSlaBreaches);
run('state.settings.slaMinutes = 30; refreshTaskStatuses()');

run('currentAccount = ACCOUNTS[1]');
assert.equal(run('scopedCustomers().every(customer => customer.teamId === currentAccount.teamId && customer.leaderId === currentAccount.leaderId)'), true);
assert.equal(run('sourcePerformance().every(item => item.sessions === 0 && item.spend === 0)'), true);
const leaderSourceCustomer = run('scopedCustomers().find(customer => customer.websiteId)');
assert.ok(leaderSourceCustomer);
assert.doesNotMatch(run('customersView()'), new RegExp(run(`websiteById(${JSON.stringify(leaderSourceCustomer.websiteId)}).domain`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.equal(run('sourcePerformance().reduce((sum, item) => sum + item.leads, 0)'), run('scopedCustomers().filter(customer => inCurrentPeriod(customer.createdAt)).length'));
run(`state.websites.push({ ...state.websites[0], id: 'WEB-LEADER-PRIVATE', name: 'Landing Team khác', domain: 'other-team.invalid' });
  state.customers.unshift({ ...state.customers.find(customer => customer.saleId === 's4'), id: 'CUS-LEADER-PRIVATE', websiteId: 'WEB-LEADER-PRIVATE', name: 'Khách Team khác' });`);
assert.doesNotMatch(run('customersView()'), /other-team\.invalid|Khách Team khác/);
run(`state.customers = state.customers.filter(customer => customer.id !== 'CUS-LEADER-PRIVATE');
  state.websites = state.websites.filter(website => website.id !== 'WEB-LEADER-PRIVATE');`);

run('currentAccount = ACCOUNTS[2]');
assert.equal(run('scopedCustomers().every(customer => customer.saleId === currentAccount.saleId)'), true);
assert.equal(run('allowedViews().includes("marketing")'), false);
assert.equal(run('assertCanExport()'), false);
assert.equal(run('sourcePerformance().every(item => item.sessions === 0 && item.spend === 0)'), true);
assert.equal(run('sourcePerformance().reduce((sum, item) => sum + item.leads, 0)'), run('scopedCustomers().filter(customer => inCurrentPeriod(customer.createdAt)).length'));
const saleSourceCustomer = run('scopedCustomers().find(customer => customer.websiteId)');
assert.ok(saleSourceCustomer);
assert.doesNotMatch(run('customersView()'), new RegExp(run(`websiteById(${JSON.stringify(saleSourceCustomer.websiteId)}).domain`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
run(`globalThis.foreignDuplicate = { ...state.customers.find(customer => customer.saleId === 's4'), id: 'CUS-01024' };
  state.customers.unshift(foreignDuplicate);
  state.tasks.unshift({ ...state.tasks[0], id: 'TSK-WRONG-SCOPE', ownerId: 's1', leaderId: 'l2', teamId: 'T3' });`);
assert.equal(run('customerById("CUS-01024") === foreignDuplicate'), true);
assert.equal(run('canViewCustomer(customerById("CUS-01024"))'), false);
assert.equal(run('scopedTasks().some(task => task.id === "TSK-WRONG-SCOPE")'), false);
run(`state.websites.push({ ...state.websites[0], id: 'WEB-PRIVATE', name: 'Landing ngoài scope', domain: 'private-foreign.invalid' });
  state.customers.unshift({ ...foreignDuplicate, id: 'CUS-PRIVATE', websiteId: 'WEB-PRIVATE', name: 'Khách ngoài scope' });`);
assert.doesNotMatch(run('customersView()'), /private-foreign\.invalid|Khách ngoài scope/);
assert.doesNotMatch(run('marketingView()'), /private-foreign\.invalid|Khách ngoài scope/);
run('state = initialState(); refreshTaskStatuses()');

run('currentAccount = ACCOUNTS[0]');
assert.equal(run('isPoolCustomer({ saleId: "s1", leaderId: null, teamId: null })'), false);
assert.equal(run('isPoolCustomer({ saleId: null, leaderId: null, teamId: null })'), true);
run('currentAccount = ACCOUNTS[1]');
assert.equal(run('isPoolCustomer({ saleId: null, leaderId: "l1", teamId: "T2" })'), true);
assert.equal(run('isPoolCustomer({ saleId: null, leaderId: "l1", teamId: "T3" })'), false);

run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[2]; dateRange = 7');
const saleDashboard = run('dashboardView()');
assert.match(saleDashboard, /Doanh thu của tôi/);
assert.match(saleDashboard, /Khách hàng của tôi/);
assert.doesNotMatch(saleDashboard, /Sản phẩm bán ra/);
assert.doesNotMatch(saleDashboard, /Nguồn khách hàng|Landing page tạo khách/);
assert.doesNotMatch(run('revenueView()'), /Doanh thu theo nguồn|Doanh thu theo website/);
run('currentAccount = ACCOUNTS[1]');
const leaderDashboard = run('dashboardView()');
assert.match(leaderDashboard, /Tổng khách hàng Team/);
assert.match(leaderDashboard, /Leader & nhân sự trực thuộc/);
assert.doesNotMatch(leaderDashboard, /Nguồn khách hàng|Landing page tạo khách/);
assert.doesNotMatch(run('revenueView()'), /Doanh thu theo nguồn|Doanh thu theo website/);

run('currentAccount = ACCOUNTS[2]; currentView = "customers"');
const saleCustomerId = run('scopedCustomers()[0].id');
const originalStatus = run(`customerById(${JSON.stringify(saleCustomerId)}).status`);
run(`quickUpdateCustomerStatus(${JSON.stringify(saleCustomerId)}, ${JSON.stringify(originalStatus === 'WON' ? 'CONTACTED' : 'WON')})`);
assert.notEqual(run(`customerById(${JSON.stringify(saleCustomerId)}).status`), originalStatus);
const noteCount = run('state.notes.length');
element('#customerNote').value = 'Sale ghi chú từ smoke test';
run(`addCustomerNote(${JSON.stringify(saleCustomerId)})`);
assert.equal(run('state.notes.length'), noteCount + 1);
assert.equal(run(`customerById(${JSON.stringify(saleCustomerId)}).note`), 'Sale ghi chú từ smoke test');
element('#followUpType').value = 'Gọi lại xác nhận nhu cầu';
element('#followUpDueAt').value = '2026-09-08T10:30';
element('#followUpPriority').value = 'HIGH';
const followUpCount = run('state.tasks.length');
run(`addCustomerFollowUp(${JSON.stringify(saleCustomerId)})`);
assert.equal(run('state.tasks.length'), followUpCount + 1);
run(`openCustomerDrawer(${JSON.stringify(saleCustomerId)})`);
assert.match(element('#drawerRoot').innerHTML, /Sản phẩm & đơn hàng đã mua/);
assert.match(element('#drawerRoot').innerHTML, /Lịch chăm sóc/);

run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[0]; currentView = "customers"');
const importedBefore = run('state.customers.length');
assert.equal(run(`addImportedCustomers([{ name: 'Khách Subdata Test', phone: '0888123456', email: 'test@subdata.vn', websiteId: 'WEB-1' }], 'Subdata')`), 1);
assert.equal(run('state.customers.length'), importedBefore + 1);
assert.equal(run('state.customers[0].saleId'), null);
assert.equal(run('state.customers[0].websiteId'), 'WEB-1');
assert.equal(run('isPoolCustomer(state.customers[0])'), true);
assert.equal(run(`addImportedCustomers([{ name: 'Data thiếu nguồn', phone: '0888999999', websiteId: 'WEB-MISSING' }], 'Subdata')`), 0);
assert.equal(run('orderSource("Subdata")'), 'Chưa quy nguồn');
run(`recordCustomerImport('PDF', 'khach-hang-test.pdf', 1)`);
assert.equal(run('state.imports[0].source'), 'PDF');
const subdataBefore = run('state.customers.length');
run('customerImportModal()');
// Mục Tích hợp tạm ẩn: modal nhập data không còn thẻ SUBDATA, chỉ còn đường nhập file.
assert.doesNotMatch(element('#modalRoot').innerHTML, /SUBDATA|openSubdataIntegration/);
assert.match(element('#modalRoot').innerHTML, /FILE IMPORT/);
// Ống cấu hình connector vẫn còn nguyên (gọi thẳng, không qua nav) để mở lại sau này.
run('configureIntegrationModal("INT-SUBDATA")');
element('#integrationName').value = 'Subdata';
element('#integrationProvider').value = 'SUBDATA';
element('#integrationEndpoint').value = 'https://agency.subdata.vn/data';
element('#integrationCredential').value = 'subdata-secret-5678';
element('#integrationApiForm').onsubmit({ preventDefault() {} });
assert.equal(run('state.customers.length'), subdataBefore);
assert.equal(run('state.integrations.find(item => item.provider === "SUBDATA").status'), 'PENDING_BACKEND');
assert.equal(run('state.integrations.find(item => item.provider === "SUBDATA").credentialLast4'), '5678');
assert.doesNotMatch(run('JSON.stringify(state)'), /subdata-secret-5678/);
const pdfBefore = run('state.customers.length');
run('customerImportModal()');
element('#customerImportFile').files = [{ name: 'danh-sach-khach.pdf' }];
element('#customerFileImportForm').onsubmit({ preventDefault() {} });
assert.equal(run('state.customers.length'), pdfBefore);
assert.equal(run('state.imports[0].source'), 'PDF');
assert.equal(run('state.imports[0].status'), 'FAILED');

const memberCount = run('activeStaff().length');
element('#memberName').value = 'Sale Smoke Test';
element('#memberRole').value = 'SALE';
element('#memberTeam').value = 'T2';
element('#memberLeader').value = 'l1';
element('#memberTarget').value = '75000000';
run('saveTeamMember()');
assert.equal(run('activeStaff().length'), memberCount + 1);
const newMemberId = run('activeStaff().find(person => person.name === "Sale Smoke Test").id');
element('#memberRole').value = 'LEADER';
element('#memberLeader').value = '';
run(`saveTeamMember(${JSON.stringify(newMemberId)})`);
assert.equal(run(`activeStaff().find(person => person.id === ${JSON.stringify(newMemberId)}).role`), 'LEADER');
run(`deleteTeamMember(${JSON.stringify(newMemberId)})`);
assert.equal(run(`activeStaff().some(person => person.id === ${JSON.stringify(newMemberId)})`), false);

element('#memberName').value = 'Đinh Minh Anh';
element('#memberRole').value = 'SALE';
element('#memberTeam').value = 'T2';
element('#memberLeader').value = 'l1';
element('#memberTarget').value = '80000000';
run('saveTeamMember(null, "REG-1")');
assert.equal(run('state.registrations.find(item => item.id === "REG-1").status'), 'APPROVED');
assert.equal(run('activeStaff().some(person => person.name === "Đinh Minh Anh")'), true);

run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[0]');
const historicalOrderCount = run('state.orders.length');
run('deleteTeamMember("s4")');
assert.equal(run('state.members.find(person => person.id === "s4").active'), false);
assert.equal(run('activeStaff().some(person => person.id === "s4")'), false);
assert.equal(run('state.customers.every(customer => customer.saleId !== "s4")'), true);
assert.equal(run('state.orders.length'), historicalOrderCount);
assert.equal(run('loadState().orders.length'), historicalOrderCount);

run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[0]; currentView = "settings"');
const loginHistoryCount = run('state.security.loginHistory.length');
run('toggleTwoFactor()');
assert.equal(run('state.security.twoFactorEnabled'), true);
run('recordAdminLogin(true)');
assert.equal(run('state.security.loginHistory.length'), loginHistoryCount + 1);
run('changePasswordModal()');
element('#currentAdminPassword').value = 'admin123';
element('#newAdminPassword').value = 'start2026';
element('#confirmAdminPassword').value = 'start2026';
element('#changePasswordForm').onsubmit({ preventDefault() {} });
assert.equal(run('state.security.adminPassword'), 'start2026');
assert.equal(run('credentialPassword(ACCOUNTS[0])'), 'start2026');
run('currentAccount = null; bindGlobalActions()');
element('#loginPhone').value = '0933445566';
element('#loginPassword').value = 'start2026';
element('#loginOtp').value = '000000';
element('#loginForm').onsubmit({ preventDefault() {} });
assert.equal(run('currentAccount'), null);
assert.match(element('#loginError').textContent, /2FA/);
element('#loginOtp').value = '260907';
element('#loginForm').onsubmit({ preventDefault() {} });
assert.equal(run('currentAccount.id'), 'u-admin');
element('#logoutButton').onclick();
run('state = initialState(); STAFF = state.members');

run('currentAccount = ACCOUNTS[0]; dateRange = 7; datePreset = "7"');
const dateFilterHtml = run('dateFilter()');
for (const label of ['Hôm nay', '7 ngày', '15 ngày', '30 ngày']) assert.match(dateFilterHtml, new RegExp(label));
assert.match(dateFilterHtml, /id="customDateStart"/);
assert.match(dateFilterHtml, /id="customDateEnd"/);
element('#customDateStart').value = '2026-09-01';
element('#customDateEnd').value = '2026-09-07';
assert.equal(run('applyCustomDateRange()'), true);
assert.equal(run('datePreset'), 'CUSTOM');
assert.deepEqual({ ...run('currentPeriodBounds()') }, { start: '2026-09-01', end: '2026-09-07', days: 7 });
assert.deepEqual({ ...run('previousPeriodBounds()') }, { start: '2026-08-25', end: '2026-08-31', days: 7 });
assert.equal(run('inCurrentPeriod("2026-09-01 00:00")'), true);
assert.equal(run('inCurrentPeriod("2026-09-07 23:59")'), true);
assert.equal(run('inCurrentPeriod("2026-08-31 23:59")'), false);
assert.equal(run('dailySeries().length'), 7);

// Invalid-range fixtures are computed relative to today so they cannot rot as the calendar moves.
const invalidRanges = run(`[
  [dayIso(0), dayIso(-1)],
  ['2026-02-30', dayIso(0)],
  [dayIso(-6), dayIso(1)],
  [dayIso(-400), dayIso(0)]
]`);
for (const [invalidStart, invalidEnd] of Array.from(invalidRanges)) {
  element('#customDateStart').value = invalidStart;
  element('#customDateEnd').value = invalidEnd;
  assert.equal(run('applyCustomDateRange()'), false, `range ${invalidStart}..${invalidEnd} must be rejected`);
  assert.deepEqual({ ...run('currentPeriodBounds()') }, { start: '2026-09-01', end: '2026-09-07', days: 7 });
}

for (let accountIndex = 0; accountIndex < 3; accountIndex += 1) {
  run(`currentAccount = ACCOUNTS[${accountIndex}]`);
  for (const range of [1, 7, 15, 30]) {
    run(`dateRange = ${range}; datePreset = String(${range})`);
    assert.equal(run('currentPeriodBounds().days'), range);
    assert.equal(run('dailySeries().length'), range);
    assert.ok(run('periodSnapshot().conversion') <= 100);
    assert.equal(run('periodSnapshot().leads'), run('periodSnapshot().customers.length'));
    assert.equal(run('sourcePerformance().every(item => item.orderRate <= 100)'), true);
    assert.equal(run('periodSnapshot().revenue'), run('dailySeries().reduce((sum, day) => sum + day.revenue, 0)'));
    assert.equal(run('periodSnapshot().revenue'), run('productPerformance(scopedOrders()).reduce((sum, item) => sum + item.revenue, 0)'));
    assert.equal(run('periodSnapshot().revenue'), run('sourcePerformance().reduce((sum, item) => sum + item.revenue, 0)'));
    assert.equal(run('periodSnapshot().revenue'), run('websiteRevenuePerformance().reduce((sum, item) => sum + item.net, 0)'));
  }
  run('dateRange = 7; datePreset = "7"');
  const viewCount = run('allowedViews().length');
  for (let viewIndex = 0; viewIndex < viewCount; viewIndex += 1) {
    const output = run(`VIEW_RENDERERS[allowedViews()[${viewIndex}]]()`);
    assert.equal(typeof output, 'string');
    assert.ok(output.length > 100);
    assert.doesNotMatch(output, /\bleads?\b/i);
    const jumpTargets = Array.from(output.matchAll(/data-view-jump="([^"]+)"/g), match => match[1]);
    jumpTargets.forEach(target => assert.equal(run(`allowedViews().includes(${JSON.stringify(target)})`), true));
  }
}

run(`state = initialState(); STAFF = state.members; currentView = 'pool'; currentAccount = ACCOUNTS[0];
  globalThis.adminBalancedPoolIds = scopedCustomers().filter(isPoolCustomer).map(customer => customer.id);
  globalThis.adminBalancedOrigins = Object.fromEntries(scopedCustomers().filter(isPoolCustomer).map(customer => [customer.id, { websiteId: customer.websiteId, source: customer.source }]));
  globalThis.expectedBalancedLeader = assignmentCandidates(scopedCustomers().filter(isPoolCustomer)[0]).slice().sort((a, b) => assignmentLoad(a) - assignmentLoad(b) || a.id.localeCompare(b.id))[0].id;`);
run('bulkDistributePool("BALANCED")');
assert.equal(run('scopedCustomers().filter(isPoolCustomer).length'), 0);
assert.equal(run('customerById(adminBalancedPoolIds[0]).leaderId'), run('expectedBalancedLeader'));
assert.equal(run('adminBalancedPoolIds.every(id => customerById(id).leaderId && customerById(id).saleId === null)'), true);
assert.equal(run('adminBalancedPoolIds.every(id => customerById(id).websiteId === adminBalancedOrigins[id].websiteId && customerById(id).source === adminBalancedOrigins[id].source)'), true);

run(`state = initialState(); STAFF = state.members; currentView = 'pool'; currentAccount = ACCOUNTS[0];
  globalThis.adminRoundRobinPoolIds = scopedCustomers().filter(isPoolCustomer).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map(customer => customer.id);`);
run('bulkDistributePool("ROUND_ROBIN")');
assert.deepEqual(Array.from(run('adminRoundRobinPoolIds.map(id => customerById(id).leaderId)')), ['l1', 'l2']);
assert.equal(run('adminRoundRobinPoolIds.every(id => customerById(id).websiteId && customerById(id).source)'), true);

run(`state = initialState(); STAFF = state.members; currentView = 'pool'; currentAccount = ACCOUNTS[1];
  globalThis.teamPoolSeed = scopedCustomers().find(isPoolCustomer);
  state.customers.unshift({ ...teamPoolSeed, id: 'CUS-TEAM-RR-2', phone: '0888111102' }, { ...teamPoolSeed, id: 'CUS-TEAM-RR-3', phone: '0888111103' });
  globalThis.teamRoundRobinPoolIds = scopedCustomers().filter(isPoolCustomer).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map(customer => customer.id);
  globalThis.teamRoundRobinOrigins = Object.fromEntries(scopedCustomers().filter(isPoolCustomer).map(customer => [customer.id, { websiteId: customer.websiteId, source: customer.source }]));`);
run('bulkDistributePool("ROUND_ROBIN")');
// Nhận data 2 bước: leader chia sale thì khách GIỮ leader/team nhưng saleId vẫn null,
// kèm đúng một offer PENDING. Khách chỉ thật sự đổ về sale sau khi sale bấm "Nhận data".
assert.equal(run('teamRoundRobinPoolIds.every(id => customerById(id).saleId === null)'), true);
assert.equal(run('teamRoundRobinPoolIds.every(id => state.dataOffers.filter(offer => offer.customerId === id && offer.status === "PENDING").length === 1)'), true);
assert.deepEqual(Array.from(run('teamRoundRobinPoolIds.map(id => state.dataOffers.find(offer => offer.customerId === id && offer.status === "PENDING").saleId)')), ['s1', 's2', 's3']);
assert.equal(run('teamRoundRobinPoolIds.every(id => customerById(id).leaderId === "l1" && customerById(id).teamId === "T2")'), true);
assert.equal(run('teamRoundRobinPoolIds.every(id => customerById(id).websiteId === teamRoundRobinOrigins[id].websiteId && customerById(id).source === teamRoundRobinOrigins[id].source)'), true);
// Chưa nhận thì chưa có task khởi tạo và chưa có đơn, nhưng đã hiện trong Khách của tôi của sale.
assert.equal(run('teamRoundRobinPoolIds.every(id => !state.tasks.some(task => task.customerId === id))'), true);
run('currentAccount = ACCOUNTS[2]');
assert.equal(run('scopedCustomers().some(customer => teamRoundRobinPoolIds.includes(customer.id))'), true);
// Sale thấy hàng chờ của mình nhưng chỉ đúng phần được chia cho s1.
assert.equal(run('pendingOfferCount()'), run('teamRoundRobinPoolIds.filter(id => state.dataOffers.find(offer => offer.customerId === id && offer.status === "PENDING").saleId === "s1").length'));
assert.match(run('acceptQueueView()'), /Nhận data/);
run('currentAccount = ACCOUNTS[1]');
assert.doesNotMatch(run('acceptQueueView()'), /data-accept-offer/);

run('state = initialState(); currentView = "pool"; currentAccount = ACCOUNTS[0]; selectedPoolIds = new Set(["CUS-01016"])');
const adminNewCustomerCount = run('newCustomerCount()');
element('#poolTarget').value = 'l1';
element('#poolReason').value = 'Smoke test Admin -> Leader';
run('assignSelectedPool()');
assert.equal(run('customerById("CUS-01016").leaderId'), 'l1');
assert.equal(run('customerById("CUS-01016").saleId'), null);
assert.equal(run('currentView'), 'customers');
assert.equal(run('newCustomerCount()'), adminNewCustomerCount - 1);

run(`currentAccount = ACCOUNTS[1]; currentView = "pool"; selectedPoolIds = new Set(["CUS-01016"]);
  globalThis.tasksBeforeOffer = state.tasks.length;
  globalThis.notifyBeforeOffer = state.notifications.length`);
element('#poolTarget').value = 's1';
element('#poolReason').value = 'Smoke test Leader -> Sale';
run('assignSelectedPool()');
// Nhận data 2 bước: leader chia sale chỉ tạo offer PENDING, data chưa đổ về sale.
assert.equal(run('customerById("CUS-01016").saleId'), null);
assert.equal(run('customerById("CUS-01016").leaderId'), 'l1');
assert.equal(run('customerById("CUS-01016").teamId'), 'T2');
assert.equal(run('currentView'), 'customers');
assert.equal(run('state.tasks.length'), run('tasksBeforeOffer'));
assert.equal(run('state.dataOffers.filter(offer => offer.customerId === "CUS-01016" && offer.status === "PENDING").length'), 1);
assert.equal(run('state.dataOffers.find(offer => offer.customerId === "CUS-01016" && offer.status === "PENDING").saleId'), 's1');
assert.equal(run('state.notifications.length'), run('notifyBeforeOffer') + 1);
assert.equal(run('state.notifications[0].role'), 'OWN');
assert.equal(run('state.notifications[0].saleId'), 's1');
assert.equal(run('state.assignmentHistory.some(item => item.customerId === "CUS-01016" && item.source === "OFFER")'), true);

// Sale thấy badge + hàng chờ, bấm "Nhận data" thì khách mới thật sự về mình.
run('currentAccount = ACCOUNTS[2]; currentView = "accept"');
assert.equal(run('pendingOfferCount()'), 1);
run('renderNavigation()');
assert.match(element('#sideNav').innerHTML, /Data chờ nhận/);
assert.match(element('#sideNav').innerHTML, /nav-badge/);
const acceptQueueHtml = run('acceptQueueView()');
assert.match(acceptQueueHtml, /data-accept-offer/);
assert.match(acceptQueueHtml, /còn 2[34] giờ|còn 24 giờ 0 phút/);
run('globalThis.pendingOfferId = state.dataOffers.find(offer => offer.customerId === "CUS-01016" && offer.status === "PENDING").id');
run(`globalThis.notifyBeforeAccept = state.notifications.length`);
run('acceptDataOffer(pendingOfferId)');
assert.equal(run('customerById("CUS-01016").saleId'), 's1');
assert.equal(run('customerById("CUS-01016").leaderId'), 'l1');
assert.match(run('customerById("CUS-01016").saleAcceptedAt'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
assert.equal(run('state.dataOffers.find(offer => offer.id === pendingOfferId).status'), 'ACCEPTED');
assert.match(run('state.dataOffers.find(offer => offer.id === pendingOfferId).resolvedAt'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
assert.equal(run('pendingOfferCount()'), 0);
assert.equal(run('state.tasks.some(task => task.customerId === "CUS-01016" && task.ownerId === "s1")'), true);
assert.equal(run('state.tasks.find(task => task.customerId === "CUS-01016").slaBased'), true);
assert.match(run('state.tasks.find(task => task.customerId === "CUS-01016").createdAt'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
assert.equal(run('state.tasks.find(task => task.customerId === "CUS-01016").dueAt'), run('shiftStamp(state.tasks.find(task => task.customerId === "CUS-01016").createdAt, state.settings.slaMinutes)'));
assert.equal(run('state.notifications.length'), run('notifyBeforeAccept') + 1);
assert.equal(run('state.notifications[0].role'), 'LEADER');
assert.equal(run('state.notifications[0].leaderId'), 'l1');
// Sale khác không nhận thay được.
run('currentAccount = ACCOUNTS[1]');
assert.equal(run('acceptDataOffer(pendingOfferId)'), undefined);

// Quá hạn: khách GIỮ leader/team, saleId null — trả về leader đã chia, không lên phễu Admin.
// Khách đã được s1 nhận ở khối trên nên leader phải thu hồi về Khách mới Team trước,
// nếu không nó không còn nằm trong pool và assignSelectedPool() bỏ qua.
run('currentAccount = ACCOUNTS[1]; revokeCustomer("CUS-01016")');
assert.equal(run('isPoolCustomer(customerById("CUS-01016"))'), true);
run(`currentView = "pool"; selectedPoolIds = new Set(["CUS-01016"]);
  globalThis.notifyBeforeExpire = state.notifications.length`);
element('#poolTarget').value = 's2';
element('#poolReason').value = 'Smoke test Leader -> Sale khac';
run('assignSelectedPool()');
assert.equal(run('state.dataOffers.filter(offer => offer.customerId === "CUS-01016" && offer.status === "PENDING").length'), 1);
run(`state.dataOffers.filter(offer => offer.customerId === 'CUS-01016' && offer.status === 'PENDING')
  .forEach(offer => { offer.offeredAt = shiftStamp(stamp(), -(state.settings.acceptTimeoutHours * 60 + 5)); });`);
assert.equal(run('expireStaleOffers()'), true);
assert.equal(run('state.dataOffers.filter(offer => offer.customerId === "CUS-01016" && offer.status === "PENDING").length'), 0);
assert.equal(run('state.dataOffers.filter(offer => offer.customerId === "CUS-01016" && offer.status === "EXPIRED").length >= 1'), true);
assert.equal(run('customerById("CUS-01016").saleId'), null);
assert.equal(run('customerById("CUS-01016").leaderId'), 'l1');
assert.equal(run('customerById("CUS-01016").teamId'), 'T2');
assert.equal(run('isPoolCustomer(customerById("CUS-01016"))'), true);
assert.equal(run('state.notifications.length'), run('notifyBeforeExpire') + 2);
assert.equal(run('state.notifications[0].role'), 'LEADER');
assert.equal(run('state.notifications[0].leaderId'), 'l1');
assert.equal(run('expireStaleOffers()'), false);

// Thu hồi khách phải huỷ luôn lời mời đang chờ.
run('currentAccount = ACCOUNTS[2]');
assert.equal(run('pendingOfferCount()'), 0);
run('currentAccount = ACCOUNTS[1]; selectedPoolIds = new Set(["CUS-01016"])');
element('#poolTarget').value = 's1';
run('assignSelectedPool()');
assert.equal(run('state.dataOffers.filter(offer => offer.customerId === "CUS-01016" && offer.status === "PENDING").length'), 1);
run('revokeCustomer("CUS-01016")');
assert.equal(run('customerById("CUS-01016").saleId'), null);
assert.equal(run('state.dataOffers.filter(offer => offer.customerId === "CUS-01016" && offer.status === "PENDING").length'), 0);

// Chuyển phụ trách từ drawer cũng đi qua hàng chờ.
run('reassignCustomer("CUS-01016", "s1")');
assert.equal(run('customerById("CUS-01016").saleId'), null);
assert.equal(run('state.dataOffers.filter(offer => offer.customerId === "CUS-01016" && offer.status === "PENDING").length'), 1);
assert.equal(run('state.dataOffers.find(offer => offer.customerId === "CUS-01016" && offer.status === "PENDING").saleId'), 's1');

run('currentAccount = ACCOUNTS[2]; currentView = "tasks"');
assert.equal(run('visibleNotifications().some(item => item.role === "LEADER")'), false);
const taskId = run('scopedTasks().find(task => task.status !== "DONE").id');
run(`completeTask(${JSON.stringify(taskId)})`);
assert.equal(run(`state.tasks.find(task => task.id === ${JSON.stringify(taskId)}).status`), 'DONE');

// The demo ships with no seeded orders (initialState.orders is empty), so the order
// lifecycle checks build their own fixture from makeOrders().
run('currentAccount = ACCOUNTS[0]; currentView = "orders"; state.orders = makeOrders()');
const pendingOrderId = run('state.orders.find(order => order.status === "PENDING").id');
run(`changeOrderStatus(${JSON.stringify(pendingOrderId)}, "PAID")`);
assert.equal(run(`state.orders.find(order => order.id === ${JSON.stringify(pendingOrderId)}).status`), 'PAID');
run('reconcileAll()');
assert.equal(run(`state.orders.find(order => order.id === ${JSON.stringify(pendingOrderId)}).paymentReconciled`), false);
// Đối soát tạm ẩn cùng mục Tích hợp: không còn nhảy sang trang integrations.
assert.equal(run('currentView'), 'orders');
run(`changeOrderStatus(${JSON.stringify(pendingOrderId)}, "REFUNDED")`);
assert.equal(run(`state.orders.find(order => order.id === ${JSON.stringify(pendingOrderId)}).status`), 'REFUNDED');
assert.match(run(`state.orders.find(order => order.id === ${JSON.stringify(pendingOrderId)}).refundedAt`), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
assert.equal(run(`state.orders.find(order => order.id === ${JSON.stringify(pendingOrderId)}).paymentReconciled`), false);
assert.equal(run(`state.orders.find(order => order.id === ${JSON.stringify(pendingOrderId)}).refundReconciled`), false);

run('currentView = "websites"; newWebsiteModal()');
element('#websiteName').value = 'Smoke Landing';
element('#websiteDomain').value = 'smoke.nvtagency.vn';
element('#websiteProvider').value = 'LANDING_API';
element('#newWebsiteForm').onsubmit({ preventDefault() {} });
assert.equal(run('state.websites.some(item => item.domain === "smoke.nvtagency.vn")'), true);
assert.equal(run('state.websites.find(item => item.domain === "smoke.nvtagency.vn").connectionStatus'), 'UNCONFIGURED');
// SePay đã bị gỡ khỏi sản phẩm; INT-SUBDATA là kết nối có thật trong seed và
// đi qua đúng một ống cấu hình, nên khối này kiểm tra cùng các bất biến cũ:
// lưu metadata → PENDING_BACKEND, chỉ giữ 4 ký tự cuối, secret không lọt vào state.
run('currentView = "integrations"; configureIntegrationModal("INT-SUBDATA")');
element('#integrationName').value = 'Subdata';
element('#integrationProvider').value = 'SUBDATA';
element('#integrationEndpoint').value = 'https://api.subdata.vn/v1';
element('#integrationCredential').value = 'subdata-secret-9876';
element('#integrationApiForm').onsubmit({ preventDefault() {} });
assert.equal(run('state.integrations.find(item => item.id === "INT-SUBDATA").status'), 'PENDING_BACKEND');
assert.equal(run('state.integrations.find(item => item.id === "INT-SUBDATA").credentialLast4'), '9876');
assert.doesNotMatch(run('JSON.stringify(state)'), /subdata-secret-9876/);
assert.equal(run('testIntegration("INT-SUBDATA")'), false);
run('currentView = "accounting"; reconcileAll()');
assert.equal(run('financialEvents(state.orders).every(event => event.reconciled)'), false);

// Custom columns and immutable customer-Level history.
run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[0]; currentView = "customers"');
assert.equal(run('state.customFieldDefinitions.some(field => field.id === "customerLevel" && field.type === "SELECT")'), true);
assert.equal(run('state.customers.every(customer => customer.customFields && customer.customFields.customerLevel)'), true);
assert.equal(run(`state.customFieldDefinitions.find(field => field.id === 'customerLevel').options.find(option => option.value === 'L5').color`), '#10b981');
assert.equal(run(`state.customFieldDefinitions.find(field => field.id === 'customerLevel').options.find(option => option.value === 'L12.2').color`), '#be123c');
assert.match(run('customersView()'), /<th>Ngày data<\/th><th>Khách hàng<\/th>/);
assert.match(run('customersView()'), /data-quick-custom-field="[^"]+" data-field-id="customerLevel"/);
const levelCustomerId = run('state.customers.find(customer => customer.saleId === "s1").id');
const initialLevelHistoryCount = run(`state.customerFieldHistory.filter(item => item.customerId === ${JSON.stringify(levelCustomerId)} && item.fieldId === 'customerLevel').length`);
run(`setCustomerCustomFields(${JSON.stringify(levelCustomerId)}, { customerLevel: 'L4.1' })`);
run(`setCustomerCustomFields(${JSON.stringify(levelCustomerId)}, { customerLevel: 'L5' })`);
assert.equal(run(`customerById(${JSON.stringify(levelCustomerId)}).customFields.customerLevel`), 'L5');
assert.equal(run(`state.customerFieldHistory.filter(item => item.customerId === ${JSON.stringify(levelCustomerId)} && item.fieldId === 'customerLevel').length`), initialLevelHistoryCount + 2);
assert.equal(run(`quickUpdateCustomerField(${JSON.stringify(levelCustomerId)}, 'customerLevel', 'L6')`), true);
assert.equal(run(`customerById(${JSON.stringify(levelCustomerId)}).customFields.customerLevel`), 'L6');
assert.equal(run(`state.customerFieldHistory.filter(item => item.customerId === ${JSON.stringify(levelCustomerId)} && item.fieldId === 'customerLevel').length`), initialLevelHistoryCount + 3);
assert.equal(run(`JSON.stringify(state.customerFieldHistory.filter(item => item.customerId === ${JSON.stringify(levelCustomerId)} && item.fieldId === 'customerLevel').slice(0, 2).map(item => [item.from, item.to]))`), JSON.stringify([['L5', 'L6'], ['L4.1', 'L5']]));
const oldLevelLabel = run(`state.customerFieldHistory.find(item => item.customerId === ${JSON.stringify(levelCustomerId)} && item.fieldId === 'customerLevel').fieldLabel`);
element('#customFieldLabel').value = 'Level chăm sóc khách';
element('#customFieldType').value = 'SELECT';
element('#customFieldOptions').value = run(`state.customFieldDefinitions.find(field => field.id === 'customerLevel').options.map(option => [option.value, option.label, option.color].join('|')).join('\\n')`);
element('#customFieldShowTable').checked = true;
element('#customFieldRequired').checked = false;
run('saveCustomFieldDefinition("customerLevel")');
assert.equal(run(`state.customFieldDefinitions.find(field => field.id === 'customerLevel').label`), 'Level chăm sóc khách');
assert.equal(run(`state.customerFieldHistory.find(item => item.customerId === ${JSON.stringify(levelCustomerId)} && item.fieldId === 'customerLevel').fieldLabel`), oldLevelLabel);
const historyBeforeProtectedArchive = run('state.customerFieldHistory.length');
run('toggleCustomField("customerLevel")');
assert.equal(run(`state.customFieldDefinitions.find(field => field.id === 'customerLevel').active`), true);
assert.equal(run('state.customerFieldHistory.length'), historyBeforeProtectedArchive);
element('#customFieldLabel').value = 'Ghi chú hồ sơ Docs';
element('#customFieldType').value = 'NOTE';
element('#customFieldOptions').value = '';
element('#customFieldShowTable').checked = true;
element('#customFieldRequired').checked = false;
const customDefinitionCount = run('state.customFieldDefinitions.length');
run('saveCustomFieldDefinition()');
assert.equal(run('state.customFieldDefinitions.length'), customDefinitionCount + 1);
const notesFieldId = run(`state.customFieldDefinitions.find(field => field.label === 'Ghi chú hồ sơ Docs').id`);
assert.equal(run(`state.customers.every(customer => Object.hasOwn(customer.customFields, ${JSON.stringify(notesFieldId)}))`), true);
run('currentAccount = ACCOUNTS[2]');
const saleFieldUpdate = run(`setCustomerCustomFields(${JSON.stringify(levelCustomerId)}, { [${JSON.stringify(notesFieldId)}]: 'Sale cập nhật link và nội dung hồ sơ' })`);
assert.equal(saleFieldUpdate.updated, true);
assert.equal(run(`customerById(${JSON.stringify(levelCustomerId)}).customFields[${JSON.stringify(notesFieldId)}]`), 'Sale cập nhật link và nội dung hồ sơ');
run('currentAccount = ACCOUNTS[0]');
const customHistoryBeforeArchive = run('state.customerFieldHistory.length');
run(`toggleCustomField(${JSON.stringify(notesFieldId)})`);
assert.equal(run(`state.customFieldDefinitions.find(field => field.id === ${JSON.stringify(notesFieldId)}).active`), false);
assert.equal(run('state.customerFieldHistory.length'), customHistoryBeforeArchive);

// Duplicate submissions keep the active/previous Sale and do not create another customer.
run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[0]; currentView = "customers"');
const registeredCustomerId = run(`state.customers.find(customer => customer.customFields.customerLevel === 'L5').id`);
const registeredPhone = run(`customerById(${JSON.stringify(registeredCustomerId)}).phone`);
const registeredWebsite = run(`customerById(${JSON.stringify(registeredCustomerId)}).websiteId`);
const duplicateCustomerCount = run('state.customers.length');
run(`globalThis.registeredDuplicateResult = ingestCustomer({ name: 'Khách gửi lại', phone: ${JSON.stringify(registeredPhone)}, websiteId: ${JSON.stringify(registeredWebsite)}, source: 'Facebook Ads', campaign: 'FB-RESUBMIT' }, { intakeType: 'FORM' })`);
assert.equal(run('registeredDuplicateResult.duplicate'), true);
assert.match(run('registeredDuplicateResult.message'), /DATA TRÙNG - DATA đã đăng ký TK/);
assert.equal(run('state.customers.length'), duplicateCustomerCount);
assert.equal(run('state.resubmissions.length'), 1);
assert.equal(run('state.resubmissions[0].assignedSaleId'), run(`customerById(${JSON.stringify(registeredCustomerId)}).saleId`));

const revokedCustomerId = run(`state.customers.find(customer => customer.saleId === 's1').id`);
const revokedPhone = run(`customerById(${JSON.stringify(revokedCustomerId)}).phone`);
const revokedWebsite = run(`customerById(${JSON.stringify(revokedCustomerId)}).websiteId`);
const assignmentCountBeforeRevoke = run('state.assignmentHistory.length');
run(`revokeCustomer(${JSON.stringify(revokedCustomerId)})`);
assert.equal(run(`customerById(${JSON.stringify(revokedCustomerId)}).saleId`), null);
assert.ok(run('state.assignmentHistory.length') > assignmentCountBeforeRevoke);
run(`globalThis.revokedDuplicateResult = ingestCustomer({ name: 'Khách cũ điền lại', phone: ${JSON.stringify(revokedPhone)}, websiteId: ${JSON.stringify(revokedWebsite)}, source: 'Landing Page', campaign: 'RETURN-FORM' }, { intakeType: 'FORM' })`);
assert.equal(run(`customerById(${JSON.stringify(revokedCustomerId)}).saleId`), 's1');
assert.equal(run('revokedDuplicateResult.duplicate'), true);
assert.ok(run(`state.assignmentHistory.some(item => item.customerId === ${JSON.stringify(revokedCustomerId)} && item.fromSaleId === null && item.toSaleId === 's1')`));

// Dedicated Admin-only Leader distribution: enablement, weights and source override.
run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[0]; currentView = "distribution"');
assert.match(run('distributionView()'), /Chia Leader/);
assert.match(run('distributionView()'), /Thứ tự data mới vào/);
assert.match(run('distributionView()'), /Mới nhất ở trên/);
run(`state.leaderDistribution.enabledLeaderIds = ['l1']; state.settings.assignmentCursor.leaders = 0`);
assert.equal(run(`chooseAssignmentTarget({ leaderId: null, websiteId: 'WEB-1', source: 'Direct', campaign: 'NONE' }, 'ROUND_ROBIN').id`), 'l1');
run(`state.leaderDistribution.enabledLeaderIds = ['l1', 'l2']; state.leaderDistribution.weights = { l1: 1, l2: 2 }; state.settings.assignmentCursor.leaders = 0`);
assert.deepEqual(Array.from(run(`Array.from({ length: 3 }, () => chooseAssignmentTarget({ leaderId: null, websiteId: 'WEB-1', source: 'Direct', campaign: 'NONE' }, 'ROUND_ROBIN').id)`)), ['l1', 'l2', 'l2']);
run(`state.settings.assignmentMode = 'MANUAL'; state.leaderDistribution.sourceRules = [{ id: 'RULE-TEST', matchType: 'WEBSITE', matchValue: 'WEB-2', targetLeaderId: 'l2', active: true }]`);
assert.equal(run(`chooseAssignmentTarget({ leaderId: null, websiteId: 'WEB-2', source: 'Facebook Ads', campaign: 'FB' }, 'MANUAL').id`), 'l2');
run(`state.leaderDistribution.weights = { l1: 100, l2: 1 }`);
assert.equal(run(`chooseAssignmentTarget({ leaderId: null, websiteId: 'WEB-1', source: 'Direct', campaign: 'NONE' }, 'BALANCED').id`), 'l1');
run('currentAccount = ACCOUNTS[1]');
// DRIFT có thật trong sản phẩm: NAVIGATION.LEADER cấp mục 'distribution' với nhãn
// "Chia Sale", nhưng distributionView() vẫn chặn mọi role khác Admin bằng 403 —
// Leader bấm vào chỉ thấy màn hình từ chối. Chưa sửa vì đây là quyết định RBAC
// (mở view theo scope của Leader, hay gỡ mục nav), không thuộc phạm vi webhook.
// Hai assertion dưới khoá đúng hiện trạng để ai đổi MỘT phía sẽ thấy lệch ngay.
assert.equal(run('allowedViews().includes("distribution")'), true);
assert.match(run('distributionView()'), /403 · FORBIDDEN/);
run('currentAccount = ACCOUNTS[2]');
assert.equal(run('allowedViews().includes("distribution")'), false);
assert.equal(run('allowedViews().includes("marketing")'), false);

// Mục Tích hợp tạm ẩn để nâng cấp: không còn trong nav của role nào, và nếu bị ép
// mở thẳng (currentView = 'integrations') thì cũng chỉ thấy 403. state.integrations
// và ống cấu hình connector vẫn còn nguyên để mở lại sau này.
run('state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[0]; currentView = "integrations"');
assert.equal(run('allowedViews().includes("integrations")'), false);
assert.match(run('integrationsView()'), /403 · FORBIDDEN/);
assert.match(run('integrationsView()'), /tạm ẩn/);
assert.equal(run('state.integrations.some(item => item.provider === "SUBDATA")'), true);
assert.equal(run('VIEW_RENDERERS.integrations()'), run('integrationsView()'));
run('currentAccount = ACCOUNTS[2]');
assert.equal(run('allowedViews().includes("integrations")'), false);

// Nav Sale có mục "Data chờ nhận" và Admin/Leader thì không.
assert.deepEqual(Array.from(run('NAVIGATION.SALE[0][1].map(item => item[0])')), ['dashboard', 'customers', 'accept']);
assert.deepEqual(Array.from(run('NAVIGATION.SALE[2][1].map(item => item[0])')), ['attendance', 'notifications']);
assert.equal(run('VIEW_RENDERERS.accept'), run('acceptQueueView'));
run('currentAccount = ACCOUNTS[0]');
assert.equal(run('allowedViews().includes("accept")'), false);
assert.match(run('acceptQueueView()'), /403 · FORBIDDEN/);
run('currentAccount = ACCOUNTS[1]');
assert.equal(run('allowedViews().includes("accept")'), false);
assert.equal(run('pendingOfferCount()'), 0);
run('currentAccount = ACCOUNTS[2]');
assert.equal(run('allowedViews().includes("accept")'), true);
assert.match(run('acceptQueueView()'), /Không có data chờ nhận/);
assert.equal(run('VIEW_RENDERERS.attendance'), run('attendanceView'));

// --- Điểm danh: giờ chốt, IP wifi, báo trễ cho leader, quyền sửa của Admin ---
run(`state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[2]; currentView = "attendance";
  state.attendance = []; state.settings.attendanceIp = ""; state.settings.attendanceDeadline = "00:00";
  globalThis.lateNotifyBefore = state.notifications.length`);
run('checkInToday()');
assert.equal(run('state.attendance.length'), 1);
assert.equal(run('state.attendance[0].accountId'), 's1');
assert.equal(run('state.attendance[0].date'), run('dayIso(0)'));
assert.match(run('state.attendance[0].at'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
// Giờ chốt 00:00 thì chắc chắn muộn, và leader phải nhận được báo trễ.
assert.equal(run('state.attendance[0].late'), true);
assert.equal(run('state.notifications.length'), run('lateNotifyBefore') + 1);
assert.equal(run('state.notifications[0].role'), 'LEADER');
assert.equal(run('state.notifications[0].leaderId'), 'l1');
assert.match(run('state.notifications[0].title'), /muộn/);
// Danh sách IP bỏ trống = ai cũng được tính là đúng wifi (không chặn).
assert.equal(run('state.attendance[0].ipValid'), true);
run('checkInToday()');
assert.equal(run('state.attendance.length'), 1);
assert.match(run('attendanceView()'), /Đi muộn/);
assert.match(run('attendanceView()'), /Lịch điểm danh 3 tháng/);
assert.doesNotMatch(run('attendanceView()'), /checkInButton/);

// Nhiều IP wifi phân cách dấu phẩy, có khoảng trắng thừa vẫn nhận đúng.
run(`state.settings.attendanceIp = "192.168.1.10, 113.161.2.3 ,10.0.0.1"`);
assert.deepEqual(Array.from(run('attendanceWifiIps()')), ['192.168.1.10', '113.161.2.3', '10.0.0.1']);
assert.equal(run("attendanceIsWifiIp('113.161.2.3')"), true);
assert.equal(run("attendanceIsWifiIp('127.0.0.1')"), false);
run(`state.settings.attendanceIp = ""`);
assert.equal(run("attendanceIsWifiIp('8.8.8.8')"), true);

// Đúng giờ thì không báo leader.
run(`state.attendance = []; state.settings.attendanceDeadline = "23:59"; globalThis.ontimeNotifyBefore = state.notifications.length`);
run('checkInToday()');
assert.equal(run('state.attendance[0].late'), false);
assert.equal(run('state.notifications.length'), run('ontimeNotifyBefore'));
assert.match(run('attendanceView()'), /Đúng giờ/);

// Leader chỉ xem: có cột Wi-Fi và hàng "Chưa điểm danh", không có nút sửa của Admin.
run('currentAccount = ACCOUNTS[1]');
assert.match(run('attendanceView()'), /<th>Wi-Fi<\/th>/);
assert.match(run('attendanceView()'), /Chưa điểm danh/);
assert.match(run('attendanceView()'), /Đúng giờ|Đi muộn/);
assert.doesNotMatch(run('attendanceView()'), /data-edit-attendance=/);
assert.doesNotMatch(run('attendanceView()'), /data-makeup-attendance=/);
assert.doesNotMatch(run('attendanceView()'), /saveAttendanceSettings/);

// Admin thấy panel cấu hình và đủ ba nút Ghi bù / Sửa / Xóa.
run('currentAccount = ACCOUNTS[0]');
assert.match(run('attendanceView()'), /saveAttendanceSettings/);
assert.match(run('attendanceView()'), /data-edit-attendance=/);
assert.match(run('attendanceView()'), /data-delete-attendance=/);
assert.match(run('attendanceView()'), /data-makeup-attendance=/);
assert.match(run('attendanceView()'), /Số giờ chờ Sale nhận data/);

element('#attendanceIp').value = '192.168.1.10, 113.161.2.3';
element('#attendanceDeadline').value = '09:00';
element('#acceptTimeoutHours').value = '12';
run('saveAttendanceSettings()');
assert.equal(run('state.settings.attendanceDeadline'), '09:00');
assert.equal(run('state.settings.acceptTimeoutHours'), 12);
assert.equal(run('state.settings.attendanceIp'), '192.168.1.10, 113.161.2.3');
element('#acceptTimeoutHours').value = '999';
run('saveAttendanceSettings()');
assert.equal(run('state.settings.acceptTimeoutHours'), 12);
element('#acceptTimeoutHours').value = '12';
element('#attendanceDeadline').value = '25:99';
run('saveAttendanceSettings()');
assert.equal(run('state.settings.attendanceDeadline'), '09:00');
// Leader không đổi được quy định.
run('currentAccount = ACCOUNTS[1]');
element('#attendanceDeadline').value = '07:00';
run('saveAttendanceSettings()');
assert.equal(run('state.settings.attendanceDeadline'), '09:00');

// Admin ghi bù cho Sale chưa điểm danh: giờ 10:15 quá chốt 09:00 nên tự suy ra Đi muộn.
run('currentAccount = ACCOUNTS[0]');
const makeupSaleId = run(`activeStaff().find(person => person.role === 'SALE' && person.teamId === 'T2' && person.id !== 's1').id`);
const attendanceBeforeMakeup = run('state.attendance.length');
run(`attendanceEditModal(null, ${JSON.stringify(makeupSaleId)})`);
assert.match(element('#modalRoot').innerHTML, /Ghi bù điểm danh/);
element('#attDate').value = run('dayIso(1)');
element('#attTime').value = '10:15';
element('#attLate').value = 'AUTO';
element('#attWifi').value = 'OUT';
element('#attIp').value = '8.8.8.8';
element('#attNote').value = 'Ghi bù theo chấm công';
element('#attendanceEditForm').onsubmit({ preventDefault() {} });
assert.equal(run('state.attendance.length'), attendanceBeforeMakeup + 1);
const makeupRecordId = run(`state.attendance.find(item => item.accountId === ${JSON.stringify(makeupSaleId)}).id`);
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).date`), run('dayIso(1)'));
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).at`), `${run('dayIso(1)')} 10:15`);
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).late`), true);
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).ipValid`), false);
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).editedBy`), 'Start');
assert.equal(run(`state.audit.some(item => item.action === 'MAKEUP_ATTENDANCE')`), true);
// Ghi bù lần hai cho cùng ngày thì bị chặn.
run(`attendanceEditModal(null, ${JSON.stringify(makeupSaleId)})`);
element('#attDate').value = run('dayIso(1)');
element('#attTime').value = '11:00';
element('#attendanceEditForm').onsubmit({ preventDefault() {} });
assert.equal(run('state.attendance.length'), attendanceBeforeMakeup + 1);

// Admin sửa giờ về trước chốt thì nhãn đổi thành Đúng giờ; IP bỏ trống thì giữ IP gốc.
run(`attendanceEditModal(${JSON.stringify(makeupRecordId)}, null)`);
element('#attDate').value = run('dayIso(1)');
element('#attTime').value = '08:45';
element('#attLate').value = 'AUTO';
element('#attWifi').value = 'AUTO';
element('#attIp').value = '';
element('#attNote').value = 'Admin chỉnh lại giờ';
element('#attendanceEditForm').onsubmit({ preventDefault() {} });
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).at`), `${run('dayIso(1)')} 08:45`);
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).late`), false);
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).ip`), '8.8.8.8');
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).ipValid`), false);
assert.equal(run(`state.audit.some(item => item.action === 'UPDATE_ATTENDANCE')`), true);
// Không cho chấm công ngày chưa tới.
run(`attendanceEditModal(${JSON.stringify(makeupRecordId)}, null)`);
element('#attDate').value = run('dayIso(-1)');
element('#attTime').value = '08:00';
element('#attendanceEditForm').onsubmit({ preventDefault() {} });
assert.equal(run(`state.attendance.find(item => item.id === ${JSON.stringify(makeupRecordId)}).date`), run('dayIso(1)'));

// Admin xóa được, Sale thì không.
run(`deleteAttendanceRecord(${JSON.stringify(makeupRecordId)})`);
assert.equal(run(`state.attendance.some(item => item.id === ${JSON.stringify(makeupRecordId)})`), false);
assert.equal(run(`state.audit.some(item => item.action === 'DELETE_ATTENDANCE')`), true);
run('currentAccount = ACCOUNTS[2]');
// Bản ghi của Sale s1 đang còn trong state (khối "đúng giờ" đã xóa mảng rồi chấm lại).
const saleAttendanceId = run(`state.attendance.find(item => item.accountId === 's1').id`);
run(`deleteAttendanceRecord(${JSON.stringify(saleAttendanceId)})`);
assert.equal(run(`state.attendance.some(item => item.id === ${JSON.stringify(saleAttendanceId)})`), true);

// Sale tự tạo khách thì nhận ngay, không sinh lời mời chờ.
run(`state = initialState(); STAFF = state.members; currentAccount = ACCOUNTS[2]; currentView = "customers";
  state.dataOffers = []; state.attendance = [];
  globalThis.selfCreated = ingestCustomer({ name: 'Khách sale tự tạo', phone: '0911000111', websiteId: state.websites[0].id, source: 'Zalo', campaign: 'SELF' }, { intakeType: 'MANUAL' })`);
assert.equal(run('selfCreated.created'), true);
const selfCustomerId = run('selfCreated.customer.id');
assert.equal(run(`customerById(${JSON.stringify(selfCustomerId)}).saleId`), 's1');
assert.match(run(`customerById(${JSON.stringify(selfCustomerId)}).saleAcceptedAt`), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
assert.equal(run('state.dataOffers.length'), 0);
assert.equal(run('pendingOfferCount()'), 0);
assert.equal(run(`state.tasks.some(task => task.customerId === ${JSON.stringify(selfCustomerId)} && task.ownerId === 's1')`), true);

// Khách điền lại form thì trả thẳng về Sale cũ — không bắt sale bấm "Nhận data" lần nữa.
run('currentAccount = ACCOUNTS[1]');
run(`revokeCustomer(${JSON.stringify(selfCustomerId)})`);
assert.equal(run(`customerById(${JSON.stringify(selfCustomerId)}).saleId`), null);
run('currentAccount = ACCOUNTS[0]');
run(`globalThis.resubmitResult = ingestCustomer({ name: 'Khách sale tự tạo', phone: '0911000111', websiteId: state.websites[0].id, source: 'Facebook Ads', campaign: 'RESUBMIT' }, { intakeType: 'FORM' })`);
assert.equal(run('resubmitResult.duplicate'), true);
assert.equal(run(`customerById(${JSON.stringify(selfCustomerId)}).saleId`), 's1');
assert.equal(run('state.dataOffers.length'), 0);

// loadState siết khuôn bản ghi điểm danh và lời mời nhận data: hàng hỏng bị loại.
run(`globalThis.dirtyState = initialState(); STAFF = dirtyState.members;
  dirtyState.settings.attendanceDeadline = "08:30";
  dirtyState.settings.acceptTimeoutHours = 999;
  dirtyState.attendance = [
    { id: "ATT-OLD", date: dayIso(2), accountId: "s1", name: "Nguyễn Thị Mai", teamId: "T2", at: dayIso(2) + " 08:20", ip: "1.1.1.1", late: false, ipValid: false, note: "", editedBy: "" },
    { id: "ATT-BAD", date: "không-hợp-lệ", accountId: "s1", at: "2026-01-05 08:00" },
    { id: "ATT-GHOST", date: dayIso(2), accountId: "s999", at: dayIso(2) + " 08:00" }
  ];
  dirtyState.dataOffers = [
    { id: "OFR-OK", customerId: dirtyState.customers[0].id, saleId: "s1", leaderId: "l1", teamId: "T2", offeredAt: "2026-09-01 08:00", status: "WEIRD", resolvedAt: "", source: "MANUAL" },
    { id: "OFR-GHOST", customerId: dirtyState.customers[1].id, saleId: "s999", leaderId: "l1", teamId: "T2", offeredAt: "2026-09-01 08:00", status: "PENDING", resolvedAt: "", source: "MANUAL" },
    { id: "OFR-DONE", customerId: dirtyState.customers[2].id, saleId: "s1", leaderId: "l1", teamId: "T2", offeredAt: "2026-09-01 08:00", status: "ACCEPTED", resolvedAt: "2026-09-01 09:00", source: "MANUAL" }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dirtyState));
  globalThis.cleanedState = loadState()`);
// Giờ chốt cũ 08:30 được nâng lên 09:00 đúng một lần; giờ chờ nhận data nằm ngoài 1..72 thì quay về mặc định 24.
assert.equal(run('cleanedState.settings.attendanceDeadline'), '09:00');
assert.equal(run('cleanedState.settings.acceptTimeoutHours'), 24);
assert.deepEqual(Array.from(run('cleanedState.attendance.map(item => item.id)')), ['ATT-OLD']);
assert.equal(run('cleanedState.attendance[0].ipValid'), false);
assert.equal(run('cleanedState.attendance[0].late'), false);
assert.deepEqual(Array.from(run('cleanedState.dataOffers.map(item => item.id)')), ['OFR-OK', 'OFR-DONE']);
assert.equal(run(`cleanedState.dataOffers.find(item => item.id === 'OFR-OK').status`), 'PENDING');
assert.equal(run(`cleanedState.dataOffers.find(item => item.id === 'OFR-DONE').resolvedAt`), '2026-09-01 09:00');
localStorage.removeItem('nvt-crm-complete-v2');

// Old version-2 browser state migrates all new arrays and custom values safely.
run(`globalThis.legacyState = initialState(); delete legacyState.customFieldDefinitions; delete legacyState.customerFieldHistory; delete legacyState.assignmentHistory; delete legacyState.resubmissions; delete legacyState.leaderDistribution; delete legacyState.saleDistributionByLeader; legacyState.customers.forEach(customer => delete customer.customFields); localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyState)); globalThis.migratedState = loadState()`);
assert.equal(run('migratedState.customFieldDefinitions.some(field => field.id === "customerLevel")'), true);
assert.equal(run('migratedState.customers.every(customer => customer.customFields.customerLevel === "L0")'), true);
assert.equal(run('migratedState.customers.every(customer => migratedState.customerFieldHistory.some(item => item.customerId === customer.id && item.fieldId === "customerLevel"))'), true);
assert.equal(run('Array.isArray(migratedState.assignmentHistory)'), true);
assert.equal(run('Array.isArray(migratedState.resubmissions)'), true);
assert.equal(run('Array.isArray(migratedState.leaderDistribution.enabledLeaderIds)'), true);
localStorage.removeItem('nvt-crm-complete-v2');

run('initialize()');
element('#loginPhone').value = '0933445566';
element('#loginPassword').value = 'admin123';
element('#loginForm').onsubmit({ preventDefault() {} });
assert.equal(run('currentAccount.id'), 'u-admin');
assert.deepEqual(JSON.parse(sessionStorage.getItem('nvt-crm-session-v1')), { accountId: 'u-admin' });
element('#logoutButton').onclick();
assert.equal(run('currentAccount'), null);
assert.equal(sessionStorage.getItem('nvt-crm-session-v1'), null);

console.log('NVT CRM smoke test: PASS');

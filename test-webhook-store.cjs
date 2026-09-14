"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function fixture(failCustomer = false) {
  const events = new Map(), customers = new Map(), calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
    async execute(sql, values) {
      if (sql.startsWith('INSERT INTO webhook_events')) { if (!events.has(values[1])) events.set(values[1], values[0]); }
      if (sql.startsWith('SELECT id')) return [[{ id: events.get(values[0]) }]];
      if (sql.startsWith('INSERT INTO customers')) {
        if (failCustomer) throw new Error('Database unavailable');
        if (!customers.has(values[0])) customers.set(values[0], values);
      }
      return [{}];
    }
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('./webhook-store.cjs'), 'utf8'), {
    module, require: () => ({ dbConfigured: true, pool: { async query() {}, async getConnection() { return connection; } } })
  });
  return { ...module.exports, customers, events, calls };
}
const record = { id: 'WHE-1', dedupeKey: 'abc', status: 'NEW', slug: 'DS-TEST', receivedAt: '2026-09-14 12:00', customer: { name: 'Test', phone: '0912345678', email: 'test@example.com' } };
test('Lưu khách trước commit và giữ ID khi landing gửi lại', async () => {
  const f = fixture();
  const first = await f.persistWebhook(record);
  const retry = await f.persistWebhook({ ...record, id: 'WHE-2' });
  assert.equal(first.customerId, retry.customerId);
  assert.equal(f.customers.size, 1);
  assert.deepEqual(f.calls, ['begin', 'commit', 'release', 'begin', 'commit', 'release']);
});
test('Lỗi ghi khách phải rollback, không báo thành công', async () => {
  const f = fixture(true);
  await assert.rejects(f.persistWebhook(record), /Database unavailable/);
  assert.deepEqual(f.calls, ['begin', 'rollback', 'release']);
});
test('Payload không hợp lệ vẫn có sự kiện gốc, không tạo khách giả', async () => {
  const f = fixture();
  const result = await f.persistWebhook({ ...record, status: 'INVALID' });
  assert.equal(result.customerId, null);
  assert.equal(f.events.size, 1);
  assert.equal(f.customers.size, 0);
});

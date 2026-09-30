'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const defaultPasswordService = require('./password-service.cjs');
const { createPasswordService } = defaultPasswordService;

test('Password workers verify concurrent logins without blocking the event loop', async () => {
  const service = createPasswordService({ workerCount: 4, rounds: 4, jobTimeout: 5000 });
  try {
    const hash = await service.hash('correct-password');
    let ticks = 0;
    const timer = setInterval(() => { ticks += 1; }, 5);
    const results = await Promise.all(Array.from({ length: 30 }, () => service.compare('correct-password', hash)));
    clearInterval(timer);
    assert.ok(results.every(Boolean));
    assert.ok(ticks > 0);
    assert.deepEqual(service.stats(), { workers: 4, busy: 0, queued: 0 });
  } finally {
    await service.close();
    await defaultPasswordService.close();
  }
});

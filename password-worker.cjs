'use strict';

const { parentPort } = require('node:worker_threads');
const bcrypt = require('bcryptjs');

parentPort.on('message', async message => {
  const { id, action, value, stored, rounds } = message || {};
  try {
    let result;
    if (action === 'compare') result = await bcrypt.compare(String(value || ''), String(stored || ''));
    else if (action === 'hash') result = await bcrypt.hash(String(value || ''), Number(rounds) || 10);
    else throw Object.assign(new Error('Unsupported password action'), { code: 'PASSWORD_ACTION_INVALID' });
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({ id, error: { code: error.code || 'PASSWORD_WORKER_ERROR', message: error.message || 'Password worker failed' } });
  }
});

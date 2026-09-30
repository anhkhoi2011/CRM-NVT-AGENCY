'use strict';

const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const bcrypt = require('bcryptjs');

function integer(value, fallback, minimum = 1, maximum = 32) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function createPasswordService(options = {}) {
  const available = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const workerCount = integer(options.workerCount, Math.max(2, Math.min(4, available || 2)));
  const rounds = integer(options.rounds, 10, 4, 15);
  const jobTimeout = integer(options.jobTimeout, 10000, 1000, 60000);
  const workerFile = options.workerFile || path.join(__dirname, 'password-worker.cjs');
  const queue = [];
  const workers = new Array(workerCount);
  let sequence = 0;
  let closed = false;
  let fallbackMode = false;

  async function fallback(action, value, stored = '') {
    if (action === 'compare') return bcrypt.compare(String(value || ''), String(stored || ''));
    if (action === 'hash') return bcrypt.hash(String(value || ''), rounds);
    throw failure('PASSWORD_ACTION_INVALID', 'Unsupported password action');
  }

  const failure = (code, message = code) => Object.assign(new Error(message), { code, status: 503 });

  function settle(job, error, result) {
    if (!job || job.settled) return;
    job.settled = true;
    clearTimeout(job.timer);
    if (error) job.reject(error);
    else job.resolve(result);
  }

  function replaceWorker(state, reason) {
    const oldWorker = state.worker;
    const activeJob = state.job;
    state.worker = null;
    state.job = null;
    if (activeJob) settle(activeJob, reason);
    if (oldWorker) void oldWorker.terminate().catch(() => {});
    if (!closed) spawn(state.index);
  }

  function spawn(index) {
    if (closed || fallbackMode) return;
    let worker;
    try { worker = new Worker(workerFile); }
    catch (error) {
      // CloudLinux/cPanel may reject worker_threads because of NPROC limits.
      // Keep authentication alive with bcryptjs' asynchronous fallback.
      fallbackMode = true;
      console.warn('[password-service] worker_threads unavailable; using async bcrypt fallback:', error.code || error.message);
      pump();
      return;
    }
    worker.unref();
    const state = workers[index] || { index, worker: null, job: null };
    state.worker = worker;
    state.job = null;
    workers[index] = state;

    worker.on('message', message => {
      if (state.worker !== worker || !state.job || message?.id !== state.job.id) return;
      const job = state.job;
      state.job = null;
      if (message.error) settle(job, failure(message.error.code || 'PASSWORD_WORKER_ERROR', message.error.message));
      else settle(job, null, message.result);
      pump();
    });
    worker.on('error', error => {
      if (state.worker === worker) replaceWorker(state, failure('PASSWORD_WORKER_ERROR', error.message));
    });
    worker.on('exit', code => {
      if (state.worker !== worker) return;
      state.worker = null;
      const job = state.job;
      state.job = null;
      if (job) settle(job, failure('PASSWORD_WORKER_EXIT', `Password worker exited (${code})`));
      if (!closed) spawn(index);
    });
    pump();
  }

  function expire(job) {
    if (job.settled) return;
    const queueIndex = queue.indexOf(job);
    if (queueIndex >= 0) {
      queue.splice(queueIndex, 1);
      settle(job, failure('PASSWORD_QUEUE_TIMEOUT', 'Password verification queue timed out'));
      return;
    }
    const state = workers.find(item => item?.job === job);
    if (state) replaceWorker(state, failure('PASSWORD_WORK_TIMEOUT', 'Password verification timed out'));
  }

  function pump() {
    if (closed) return;
    if (fallbackMode) {
      while (queue.length) {
        const job = queue.shift();
        if (!job || job.settled) continue;
        void fallback(job.action, job.value, job.stored).then(result => settle(job, null, result)).catch(error => settle(job, error));
      }
      return;
    }
    for (const state of workers) {
      if (!queue.length) break;
      if (!state?.worker || state.job) continue;
      const job = queue.shift();
      if (!job || job.settled) continue;
      state.job = job;
      try {
        state.worker.postMessage({ id: job.id, action: job.action, value: job.value, stored: job.stored, rounds });
      } catch (error) {
        replaceWorker(state, failure('PASSWORD_WORKER_ERROR', error.message));
      }
    }
  }

  function submit(action, value, stored = '') {
    if (closed) return Promise.reject(failure('PASSWORD_SERVICE_CLOSED'));
    if (fallbackMode) return fallback(action, value, stored);
    return new Promise((resolve, reject) => {
      const job = { id: ++sequence, action, value, stored, resolve, reject, settled: false, timer: null };
      job.timer = setTimeout(() => expire(job), jobTimeout);
      queue.push(job);
      pump();
    });
  }

  async function close() {
    closed = true;
    while (queue.length) settle(queue.shift(), failure('PASSWORD_SERVICE_CLOSED'));
    await Promise.all(workers.map(async state => {
      if (!state) return;
      if (state.job) settle(state.job, failure('PASSWORD_SERVICE_CLOSED'));
      state.job = null;
      const worker = state.worker;
      state.worker = null;
      if (worker) await worker.terminate().catch(() => {});
    }));
  }

  for (let index = 0; index < workerCount; index += 1) spawn(index);

  return {
    compare: (value, stored) => submit('compare', value, stored),
    hash: value => submit('hash', value),
    stats: () => ({ workers: fallbackMode ? 0 : workerCount, busy: fallbackMode ? 0 : workers.filter(state => state?.job).length, queued: queue.length }),
    close
  };
}

const passwordService = createPasswordService({
  workerCount: integer(process.env.PASSWORD_WORKER_COUNT, undefined),
  rounds: integer(process.env.BCRYPT_ROUNDS, 10, 4, 15),
  jobTimeout: integer(process.env.PASSWORD_JOB_TIMEOUT, 10000, 1000, 60000)
});

module.exports = passwordService;
module.exports.createPasswordService = createPasswordService;

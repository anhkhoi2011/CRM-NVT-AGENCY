'use strict';

// Queue outside mysql2 so timed-out waiters are removed, not executed later.
function managedPool(raw, { limit, acquireTimeout = 10000, queryTimeout = 10000, queueLimit = 0 }) {
  let active = 0;
  const waiting = [];
  const failure = code => Object.assign(new Error(code), { code, status: 503 });
  function leave() { active--; pump(); }
  function pump() {
    while (active < limit && waiting.length) {
      const item = waiting.shift();
      active++;
      item.started = true;
      Promise.resolve().then(() => raw.getConnection()).then(connection => {
        if (item.expired) { connection.release(); leave(); return; }
        clearTimeout(item.timer);
        let released = false, broken = false;
        const release = () => {
          if (released) return;
          released = true;
          try { if (!broken) connection.release(); } finally { leave(); }
        };
        async function command(method, args) {
          if (released || broken) throw failure('DB_CONNECTION_CLOSED');
          let timer;
          try {
            return await Promise.race([
              Promise.resolve().then(() => connection[method](...args)),
              new Promise((_, reject) => { timer = setTimeout(() => {
                broken = true;
                connection.destroy(); // Never return a timed-out transaction to the pool.
                reject(failure('DB_QUERY_TIMEOUT'));
              }, queryTimeout); })
            ]);
          } catch (error) {
            if (!broken && (method === 'rollback' || error.fatal)) { broken = true; connection.destroy(); }
            throw error;
          } finally { clearTimeout(timer); }
        }
        item.resolve({
          query: (...args) => command('query', args),
          execute: (...args) => command('execute', args),
          beginTransaction: () => command('beginTransaction', []),
          commit: () => command('commit', []),
          rollback: () => broken ? Promise.resolve() : command('rollback', []),
          release,
          destroy() { if (!released) { broken = true; connection.destroy(); release(); } }
        });
      }, error => { clearTimeout(item.timer); item.reject(error); leave(); });
    }
  }
  function getConnection() {
    if (queueLimit && active >= limit && waiting.length >= queueLimit) return Promise.reject(failure('DB_QUEUE_FULL'));
    return new Promise((resolve, reject) => {
      const item = { resolve, reject, started: false, expired: false };
      item.timer = setTimeout(() => {
        item.expired = true;
        if (!item.started) { const index = waiting.indexOf(item); if (index >= 0) waiting.splice(index, 1); }
        reject(failure('DB_ACQUIRE_TIMEOUT'));
      }, acquireTimeout);
      waiting.push(item); pump();
    });
  }
  async function run(method, args) {
    const connection = await getConnection();
    try { return await connection[method](...args); } finally { connection.release(); }
  }
  return { getConnection, query: (...args) => run('query', args), execute: (...args) => run('execute', args),
    stats: () => ({ active, queued: waiting.length, limit }), end: () => raw.end() };
}
module.exports = { managedPool };

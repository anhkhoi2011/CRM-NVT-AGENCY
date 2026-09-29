'use strict';

// A small lease manager around mysql2's pool. The important invariant is that
// every acquisition attempt releases its manager slot exactly once, including
// a timeout followed by a late getConnection() resolution.
function managedPool(raw, { limit, acquireTimeout = 5000, queryTimeout = 5000, queueLimit = 0 }) {
  let active = 0;
  const waiting = [];
  let pumping = false;

  const failure = code => Object.assign(new Error(code), { code, status: 503 });

  function releaseSlot(item) {
    if (item.slotReleased) return false;
    item.slotReleased = true;
    active--;
    pump();
    return true;
  }

  function destroy(connection) {
    try { connection?.destroy?.(); } catch { /* the socket is already unusable */ }
  }

  function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (active < limit && waiting.length) {
        const item = waiting.shift();
        if (!item || item.expired || item.settled) continue;

        item.started = true;
        active++;
        Promise.resolve()
          .then(() => raw.getConnection())
          .then(connection => {
            // The acquire timer may have fired while mysql2 was reconnecting.
            // Never hand such a connection to the caller: destroy it and let
            // the finally below release this manager slot.
            if (item.expired || item.settled) {
              destroy(connection);
              return;
            }

            clearTimeout(item.timer);
            let released = false;
            let broken = false;

            const release = () => {
              if (released) return;
              released = true;
              try {
                if (!broken) connection.release();
              } finally {
                releaseSlot(item);
              }
            };

            async function command(method, args) {
              if (released || broken) throw failure('DB_CONNECTION_CLOSED');
              let timer;
              try {
                return await Promise.race([
                  Promise.resolve().then(() => connection[method](...args)),
                  new Promise((_, reject) => {
                    timer = setTimeout(() => {
                      broken = true;
                      destroy(connection);
                      reject(failure('DB_QUERY_TIMEOUT'));
                    }, queryTimeout);
                  })
                ]);
              } catch (error) {
                if (!broken && (method === 'rollback' || error?.fatal)) {
                  broken = true;
                  destroy(connection);
                }
                throw error;
              } finally {
                clearTimeout(timer);
              }
            }

            item.delivered = true;
            item.resolve({
              query: (...args) => command('query', args),
              execute: (...args) => command('execute', args),
              beginTransaction: () => command('beginTransaction', []),
              commit: () => command('commit', []),
              rollback: () => broken ? Promise.resolve() : command('rollback', []),
              release,
              destroy() {
                if (released) return;
                broken = true;
                destroy(connection);
                release();
              }
            });
          })
          .catch(error => {
            clearTimeout(item.timer);
            if (!item.expired && !item.settled) {
              item.settled = true;
              item.reject(error);
            }
          })
          .finally(() => {
            // A successful checkout keeps the slot until the caller releases
            // the lease. Every failure, timeout, or late connection releases
            // it here, exactly once.
            if (!item.delivered) releaseSlot(item);
          });
      }
    } finally {
      pumping = false;
    }
  }

  function getConnection() {
    if (queueLimit && active >= limit && waiting.length >= queueLimit) {
      return Promise.reject(failure('DB_QUEUE_FULL'));
    }

    return new Promise((resolve, reject) => {
      const item = {
        resolve,
        reject,
        started: false,
        expired: false,
        settled: false,
        delivered: false,
        slotReleased: false,
        timer: null
      };

      item.timer = setTimeout(() => {
        item.expired = true;
        if (!item.started) {
          const index = waiting.indexOf(item);
          if (index >= 0) waiting.splice(index, 1);
        }
        if (!item.settled) {
          item.settled = true;
          reject(failure('DB_ACQUIRE_TIMEOUT'));
        }
        // If acquisition is already in progress, release the manager slot now.
        // A late connection is destroyed by pump() and cannot decrement twice.
        if (item.started && !item.delivered) releaseSlot(item);
      }, acquireTimeout);

      waiting.push(item);
      pump();
    });
  }

  async function run(method, args) {
    const connection = await getConnection();
    try {
      return await connection[method](...args);
    } finally {
      connection.release();
    }
  }

  return {
    getConnection,
    query: (...args) => run('query', args),
    execute: (...args) => run('execute', args),
    stats: () => ({ active, queued: waiting.length, limit }),
    end: () => raw.end()
  };
}

module.exports = { managedPool };

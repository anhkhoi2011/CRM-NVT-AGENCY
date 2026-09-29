# Login timeout audit — 2026-09-29

## Findings and changes

- All 12 explicit connection acquisitions in business code had release in finally. No missing-release leak was demonstrated. Transactions and advisory locks need a dedicated connection and cannot safely be replaced by unrelated pool queries.
- Existing authentication shared the business pool (default five connections before the prior patch). The pending login change isolates authentication. This is a plausible starvation path, not proof of the production outage's cause.
- mysql2's installed pool config has no acquireTimeout option. managed-pool.cjs implements a removable FIFO queue with a real acquisition deadline. Expired queued operations never execute; connections arriving after deadline are released. All pool query/execute calls go through automatic finally release.
- SQL commands have a deadline. Timeout destroys the connection rather than returning a possibly active transaction to the pool. No writes are automatically retried. A commit timeout has an unknown outcome; CRM request IDs remain essential for safe retry.
- Failed rollback and fatal connection errors discard the connection. Other rollback failures no longer hide the original error.
- Telegram's advisory lock connection is isolated in a one-connection pool. It intentionally remains acquired while sending; releasing it would break cross-process delivery coordination.
- Inbox writes now use asynchronous mkdir/write/rename, serialized per process. JSON serialization is still synchronous; very large payloads remain a CPU cost. Startup inbox loading is synchronous but outside login request handling.
- No compareSync/hashSync calls were found in production code. bcryptjs compare/hash already use their asynchronous API. This is not a worker-thread CPU offload; CPU under real concurrent load still needs measurement.
- Async route dispatch now awaits handlers within try/catch. Database availability errors return JSON HTTP 503; existing 400/401/403 handling is preserved.
- app.js installs fatal-error logging for uncaught exceptions and unhandled rejections and exits with code 1. Passenger must restart the process. The application does not continue in an unknown state; handlers do not fix a recurring startup misconfiguration.
- mysql2 removes ended/errored pooled connections (verified against installed lib/pool_connection.js). TCP keepalive and idle eviction are configured. No periodic ping or blind write retry was added.

## Configuration

Defaults per Node process:

| Variable | Default |
| --- | ---: |
| DB_CONNECTION_LIMIT | 60 |
| DB_AUTH_CONNECTION_LIMIT | 25 |
| Telegram lock pool | 1 |
| DB_QUEUE_LIMIT / DB_AUTH_QUEUE_LIMIT | 0 |
| DB_CONNECT_TIMEOUT | 5000 ms |
| DB_ACQUIRE_TIMEOUT | 5000 ms |
| DB_QUERY_TIMEOUT | 5000 ms |

queueLimit=0 means no count limit, but every queued operation has a deadline. Set a finite queue limit if request spikes require earlier rejection. Timeout values are independent stages, not a total HTTP request budget. Existing cPanel environment values override defaults. Do not assume 6 GB RAM determines max_user_connections: up to 12 connections per Node process, multiplied by Passenger process count and other apps, must fit MySQL limits.

No SQL schema migration is required. .cpanel.yml copies both new runtime modules before restarting the Node app. Credentials and .env remain outside Git.

## Verification and production follow-up

Automated tests cover SQL errors, acquisition timeout, late connections, hung queries, double release, rollback failure, fatal logging, deployment module inclusion and concurrent login with a stalled business query path. These use controlled fixtures, not the hosting MySQL instance.

The existing login-timing log records lookup, password and session durations on slow completion. mysql-api now includes the route and error code. If the issue persists after deployment, collect those lines at the incident timestamp along with Passenger restarts, MySQL connection limits and active/locked queries. Absence of a Node login log can mean the request was queued before Node; investigate proxy/Passenger separately.

Full CRM snapshots still load and transform the whole dataset before applying per-user visibility. This is a remaining scaling cost outside password authentication; measure row counts, payload size and event-loop delay before changing snapshot and permission semantics. Tests alone cannot certify production latency or prove that the incident is resolved.

## Final pre-push verification

- Browser authentication timeout now covers response JSON/body, not just HTTP headers. A stalled body restores the login button after abort.
- 192 automated tests passed.
- Public hosting probes before this deployment: GET /api/health/live returned 200 in approximately 0.36 seconds; a single invalid POST /api/auth/login returned 401 in approximately 0.13 seconds. POST /api/login (not a route in this source) timed out after 12 seconds.
- One batch of 20 simultaneous POSTs to /api/auth/login with an empty JSON object returned 10 HTTP 401 responses and 10 timeouts (12 seconds). This exercises invalid login lookup only, not successful password verification or state loading.
- Production intermittency is NOT verified as resolved. The pending code was not yet deployed during these probes. Repeat checks after deployment and correlate Node/Passenger logs with timeout timestamps; distinguish DNS/TLS/proxy queuing from database and application time.

## Connection-limit correction

The previous 30-connection business-pool default was too aggressive for a cPanel Passenger deployment. Each Node process also has auth and Telegram pools, and multiple Passenger workers multiply the total. A 30 + 2 + 1 layout can exhaust MySQL's per-user limit and make the dedicated auth pool wait or fail. The safe default is now 8 business + 3 auth + 1 Telegram per process. Keep cPanel variables at these values unless the hosting provider confirms max_user_connections and Passenger process count.

## Production guardrails

The business pool now hard-caps at 8 connections and the auth pool at 4 even if stale cPanel environment variables request a higher value. This prevents a previously configured `DB_CONNECTION_LIMIT=30` from multiplying across Passenger workers and exhausting MySQL. HTTP request, header, and keep-alive timeouts are also explicit. `/api/health/live` reports build `15ef897-login-stability` after deployment so the active backend can be verified.

## 50+ concurrent login tuning

The configured defaults are 60 business leases and 25 authentication leases, with 30-second idle eviction and 5-second connection/acquisition/query deadlines. These values require the hosting account MySQL `max_connections`/`max_user_connections` and Passenger worker count to support them; use smaller environment values if the host limit is lower. The managed pool fixes the prior deadlock: a timed-out in-flight `raw.getConnection()` decrements its slot immediately and destroys a late connection.

## Index verification

`database/login-indexes.sql` checks `users.phone` and `users.email` and adds an index only when an older database lacks one. The current schema defines both columns UNIQUE, which already creates indexes in MySQL. Do not run a duplicate index blindly.

# NVT AGENCY CRM

## Files used in production

- `app.js`, `webhook-server.cjs`, `webhook-store.cjs`, `db.js`, `support-chat.cjs`, `telegram-bot.cjs`: Node.js API, MySQL access, landing webhook, internal support chat, Telegram integration, and static file server.
- `index.html`, `crm-runtime.html`, `crm-runtime-api.js`, `crm.js`, `crm.css`, `crm-modern.css`, `nvt-mobile-auth.css`, `care-ui.js`, `reference-view.js`, `reference-crm.js`, `support-chat-widget.js`: CRM interface and its runtime bridge.
- `crm-data.cjs`, `crm-defaults.json`, `product-catalog.json`, `system-accounts.cjs`, `system-accounts.json`: server-side business rules and safe one-time seed data.
- `database/`: MySQL schema and incremental migrations. Do not delete, rename, or overwrite these files during a normal frontend update.

## Development and verification

- `npm start`: starts the production-style local server on port 4173.
- `npm run demo`: starts a local in-memory demo server. It does not write MySQL and its data is lost after restart.
- `npm test`: runs persistence, permissions, webhook, and UI integration tests.

## Documentation

Operational, deployment, UI, data persistence, and role notes are grouped under `docs/`. Reference screenshots are in `docs/reference-ui/`; they are not loaded by the CRM.

## Local-only files

- `node_modules/`: installed dependencies; recreate with `npm ci`.
- `.chrome-layout-check/`: browser QA cache; ignored by Git and safe to remove.
- `.env`: hosting credentials; never commit it.

## Telegram internal support

Set `TELEGRAM_ADMIN_CHAT_ID` for the one Admin Telegram inbox. To enable replies from Telegram back into CRM, set an HTTPS `TELEGRAM_WEBHOOK_URL` ending in `/api/telegram/webhook` and a long `TELEGRAM_WEBHOOK_SECRET`. The server registers that webhook at startup and accepts incoming Telegram requests only when the secret header matches. Support images are stored outside the public web directory and are served only through authenticated CRM sessions.

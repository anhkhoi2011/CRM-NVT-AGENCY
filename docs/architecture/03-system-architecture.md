# 03 — SYSTEM ARCHITECTURE (§80 Bước 3)

## 3.1 Sơ đồ tổng thể

```
┌──────────────────────────── NGƯỜI DÙNG NỘI BỘ ────────────────────────────┐
│  CRM Admin Frontend  (Next.js — ADMIN / LEADER / SALE cùng 1 app)          │
│  · Menu render theo permission (UI only)                                   │
│  · Không giữ business rule, không truy cập DB                               │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │ HTTPS · cookie JWT (HttpOnly) · CSRF token
┌───────────────────────────── HỆ THỐNG NGOÀI ──────────────────────────────┐
│  Website A/B/C · Landing Page · Mobile App · External System               │
│  dùng: crm-sdk / tracking-sdk / webhook                                    │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │ HTTPS · header `X-Api-Key` · `Idempotency-Key`
                                ▼
              ┌─────────────────────────────────────────────┐
              │        EDGE / REVERSE PROXY (Nginx)         │
              │  TLS · IP allowlist admin · body size limit │
              └──────────────────┬──────────────────────────┘
                                 ▼
╔═══════════════════════ CRM BACKEND API (Modular Monolith) ═══════════════════╗
║ CROSS-CUTTING PIPELINE (thứ tự thực thi cố định)                             ║
║  1 RequestId/CorrelationId  2 Structured log  3 CORS(theo website_domains)   ║
║  4 Rate limit (per API key / per user / per IP)  5 AuthN (JWT | API Key)     ║
║  6 AuthZ Guard: Permission → Data Scope → Record guard                       ║
║  7 Validation (Zod DTO)  8 Idempotency (write API)  9 Transaction boundary   ║
║ 10 Audit hook  11 Outbox write  12 Response envelope + error mapping         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ APPLICATION / DOMAIN MODULES (biên theo doc 01)                              ║
║  Identity&Access · Organization · Customer · Lead · Assignment · Follow-up   ║
║  Catalog · Sales · Billing · Website · Marketing · Tracking · Attribution    ║
║  Content · Media · Integration · Notification · Audit · Import/Export        ║
║  Reporting(read-only) · Settings · [Accounting = placeholder]                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ INFRASTRUCTURE ADAPTERS                                                      ║
║  Repository(Prisma) · StorageAdapter(S3) · MailerAdapter · AdsAdapter(sau)   ║
║  EventBus(in-proc) + OutboxWriter · CacheAdapter(Redis) · Clock · IdGen      ║
╚══════════════════┬────────────────────┬──────────────────┬══════════════════╝
                   ▼                    ▼                  ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐
        │  PostgreSQL 16   │  │    Redis 7       │  │  S3 / R2 / MinIO│
        │  (nguồn sự thật) │  │ cache·ratelimit  │  │  media files    │
        └──────────────────┘  │ queue(BullMQ)    │  └─────────────────┘
                              └────────┬─────────┘
                                       ▼
                    ╔═══════════════════════════════════════╗
                    ║  WORKER PROCESS (cùng codebase)       ║
                    ║  · OutboxDispatcher → EventBus        ║
                    ║  · WebhookSender (retry + backoff)    ║
                    ║  · ImportJob / ExportJob              ║
                    ║  · TrackingIngest (batch → DB)        ║
                    ║  · Scheduler: task overdue, aggregate,║
                    ║    api key expiry, data recycle SLA   ║
                    ╚═══════════════════════════════════════╝
```

## 3.2 Vì sao Modular Monolith (§2)

- Biên module đã rõ ở doc `01`, nhưng **transaction xuyên module là bắt buộc**: tạo Lead →
  gắn Customer → ghi Touchpoint → ghi Audit phải nguyên tử. Microservice sẽ phải dùng saga
  cho một nghiệp vụ vốn đơn giản.
- Một đội nhỏ, một deploy. Tách service khi và chỉ khi: deploy cản nhau, tải Tracking lệch
  hẳn phần còn lại, hoặc cần isolation bảo mật.
- Sẵn đường tách: mỗi module có `module.service.ts` là **cửa duy nhất** vào module đó. Khi
  tách, đổi implement của service thành HTTP client — không đổi caller.

**Ứng viên tách đầu tiên** (khi có nhu cầu thật): `Tracking` (write-heavy, không cần
transaction với phần còn lại) và `Integration/WebhookSender` (I/O chờ lâu).

## 3.3 Hai luồng request (khác nhau về AuthN, giống nhau về AuthZ)

### A. Request từ CRM Admin (người dùng nội bộ)

```
Browser → Nginx → API
  ├ 1 RequestId
  ├ 2 CORS: chỉ origin của crm-admin
  ├ 3 Rate limit theo user_id (VD 600 req/phút)
  ├ 4 AuthN: đọc access token trong HttpOnly cookie → resolve `AuthContext`
  │     AuthContext = { userId, role, permissions[], dataScope, teamIds[], scopeUserIds }
  ├ 5 CSRF check cho method thay đổi dữ liệu (double-submit token)
  ├ 6 AuthZ: @RequirePermission('customer.update') → @ApplyScope('customer')
  ├ 7 Validate DTO
  ├ 8 Service → Repository (trong transaction)
  ├ 9 AuditLog + Outbox trong CÙNG transaction
  └ 10 Envelope response
```

### B. Request từ Website / Landing / hệ thống ngoài (máy-máy)

```
Website → Nginx → API
  ├ 1 RequestId
  ├ 2 CORS: origin phải khớp `website_domains` đã verify của API Client
  ├ 3 Rate limit theo api_key_id (cấu hình từng key)
  ├ 4 AuthN: `X-Api-Key: pk_live_ab12.<secret>`
  │     · tách prefix → tra `api_keys.key_prefix` (indexed)
  │     · so `key_hash` (constant-time) · check `revoked_at`/`expires_at`
  │     · resolve `ApiContext` = { apiClientId, websiteId, scopes[], rateLimit }
  ├ 5 AuthZ: scope check (`lead:create`) — KHÔNG dùng permission của user
  ├ 6 Validate DTO
  ├ 7 Idempotency: nếu có `Idempotency-Key` → tra `idempotency_records`
  │     · hit + request_hash khớp  → trả response đã lưu (200/201, header `Idempotent-Replay: true`)
  │     · hit + request_hash lệch  → 409 `IDEMPOTENCY_KEY_REUSED`
  │     · miss → khóa key (INSERT ... ON CONFLICT) rồi xử lý
  ├ 8 Service (transaction) + Audit(channel=API) + Outbox
  └ 9 Envelope response
```

> Điểm quan trọng: **AuthZ của A và B khác cơ chế nhưng cùng đi qua một Policy layer.**
> API Key không bao giờ được suy ra thành một user để "mượn" data scope; nó chỉ có scope
> hẹp và bị chặn cứng khỏi các endpoint quản trị.

## 3.4 Transaction & Outbox (không mất event — §67)

```
BEGIN
  ├ ghi bảng nghiệp vụ (customers / leads / orders ...)
  ├ ghi bảng lịch sử (customer_status_history / assignment_history ...)
  ├ ghi audit_logs
  └ ghi outbox_events (aggregate, type, payload, status='PENDING')
COMMIT
        │
        ▼ (worker poll mỗi 1s, batch 100, SKIP LOCKED)
OutboxDispatcher → EventBus in-process
        ├─► NotificationHandler   → notifications
        ├─► WebhookSender         → webhook_deliveries (queue + backoff)
        ├─► AttributionHandler    → touchpoints / snapshot
        ├─► ReportingHandler      → invalidate cache / aggregate
        └─► ActivityHandler       → activity_logs / timeline
```

Vì sao Outbox: nếu bắn webhook/notification **trong** transaction → transaction rollback
nhưng webhook đã gửi (không rút lại được). Nếu bắn **sau** commit mà process chết → mất
event. Outbox loại bỏ cả hai.

## 3.5 Background jobs (§81)

| Job | Trigger | Ghi chú |
|-----|---------|---------|
| `outbox:dispatch` | poll 1s | `FOR UPDATE SKIP LOCKED`, retry 5 lần rồi `FAILED` |
| `webhook:send` | từ event | backoff 1m→5m→15m→1h→6h (5 lần) → `DEAD_LETTER` |
| `import:process` | user upload | chunk 500 dòng/tx, ghi `import_rows` + `import_errors` |
| `export:generate` | user request | > 5k dòng thì async, trả link tải hết hạn |
| `tracking:flush` | poll 5s | gom `tracking_events` từ Redis buffer → COPY vào Postgres |
| `aggregate:traffic_daily` | cron 00:15 | ghi `traffic_daily_aggregates` (chỉ số THẬT, §52) |
| `task:overdue_scan` | cron mỗi 15p | Task quá `due_at` → status `OVERDUE` + notification (§43) |
| `assignment:sla_recycle` | cron mỗi giờ | Sale không xử lý trong SLA cấu hình → cảnh báo/recycle (§33) |
| `apikey:expiry_scan` | cron 08:00 | Key sắp hết hạn → alert dashboard (§7) |
| `idempotency:cleanup` | cron 03:00 | xóa record hết `expires_at` |
| `integration:health` | cron 10p | cập nhật `Connected/Warning/Disconnected` (§54) |

## 3.6 Realtime (§39)

MVP dùng **SSE** một chiều: `GET /api/v1/realtime/stream` (auth bằng cookie).
- Server giữ kết nối; Redis pub/sub fan-out giữa các instance API.
- Event gửi ra FE: `customer.status_changed`, `customer.assigned`, `lead.created`,
  `notification.created`, `task.due`.
- Payload chỉ chứa id + nhãn tối thiểu; FE **refetch qua API** để dữ liệu vẫn đi qua
  Data Scope (không tin payload broadcast).
- **Lọc theo scope trước khi phát**: mỗi kết nối SSE đăng ký channel theo `userId` + `teamId`;
  không broadcast toàn hệ thống rồi để FE tự lọc.
- Fallback: `?transport=poll` → TanStack Query polling 20s. `realtime_mode` là setting
  (`SSE` / `POLL` / `OFF`) trong `settings` — không hard-code.

## 3.7 Môi trường & cấu hình

| Env | Mục đích | Ghi chú |
|-----|----------|---------|
| `local` | dev | Docker Compose: postgres, redis, minio, mailhog |
| `staging` | test tích hợp | dữ liệu giả rõ ràng, webhook trỏ về requestbin |
| `production` | thật | backup, monitor, alert |

Cấu hình qua env var, validate bằng Zod khi boot — thiếu biến bắt buộc thì **fail fast**.
Không có giá trị mặc định nào là secret. Danh sách biến: xem `16-deployment-observability.md`.

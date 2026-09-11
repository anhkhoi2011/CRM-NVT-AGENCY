# 02 — TECH STACK ĐỀ XUẤT (§80 Bước 2)

Spec yêu cầu AI *đề xuất* stack kèm lý do, không hard-code framework (§75). Dưới đây là
phương án khuyến nghị + 2 phương án thay thế. **Chờ bạn chốt trước khi code.**

## 2.1 Phương án A — KHUYẾN NGHỊ (TypeScript toàn tuyến)

| Lớp | Chọn | Lý do |
|-----|------|-------|
| Language | **TypeScript** (strict) | Một ngôn ngữ cho FE/BE/SDK → chia sẻ `shared-types` + validation schema (§75), giảm lệch hợp đồng API. |
| Backend | **NestJS 11** (Node 22 LTS) | Có sẵn module boundary, DI, Guard/Interceptor/Pipe — khớp trực tiếp với Modular Monolith + Authorization layer thống nhất (§3). Guard là chỗ duy nhất cắm Permission+DataScope. |
| API | **REST `/api/v1`** + OpenAPI (`@nestjs/swagger`) | §65 yêu cầu versioning + Swagger. REST phù hợp cho website/landing/SDK bên thứ ba hơn GraphQL. |
| Validation | **Zod** (+ `nestjs-zod`) | Một schema dùng cho BE validate, FE form, và `crm-sdk` — tránh viết 3 lần. |
| ORM | **Prisma 6** | Migration versioned, type-safe, dễ review schema. (Xem 2.4 nếu cần SQL thô mạnh hơn.) |
| Database | **PostgreSQL 16** | JSONB cho payload/snapshot attribution, partial & GIN index, partition cho `page_views`/`tracking_events`, CTE cho funnel. Transaction mạnh cho merge/idempotency. |
| Cache / Rate limit | **Redis 7** | Rate limit theo API Key (§19), idempotency lookup nhanh, cache dashboard aggregate, pub/sub cho realtime. |
| Queue / Worker | **BullMQ** (Redis) | Webhook retry + backoff (§66), import/export job, tracking ingest buffer, outbox dispatcher. |
| Realtime | **SSE** cho MVP, WebSocket (Socket.IO) khi cần 2 chiều | §39 cho phép SSE/polling; SSE đơn giản, qua được proxy, đủ cho "Leader thấy Sale cập nhật". |
| Admin Frontend | **Next.js 15 (App Router) + React 19 + TypeScript** | Repo hiện tại đã là Next.js/React/TS → tận dụng được prototype. Desktop-first, RSC cho trang danh sách nặng. |
| UI | **Tailwind CSS + shadcn/ui + TanStack Table + Recharts** | Modern SaaS CRM (§61); TanStack Table cho search/filter/sort/pagination/column-selection; Recharts cho §7/§24/§45. Prototype đã dùng Tailwind + lucide-react. |
| Data fetching | **TanStack Query** | Cache, invalidate sau mutation, polling fallback nếu tắt realtime. |
| Object Storage | **S3-compatible** (AWS S3 / Cloudflare R2 / MinIO self-host) | §73 cần `storage_provider` + `storage_key` → adapter, đổi provider không đổi schema. |
| Auth (CRM user) | **JWT access ngắn (15p) + refresh token rotate, HttpOnly Secure cookie** | §59: secure cookie, session strategy, MFA-ready. |
| Auth (máy-máy) | **API Key: `prefix.secret`, lưu `key_hash`** (Argon2id/HMAC-SHA256) | §19: không lưu plaintext, chỉ hiện full key khi tạo. |
| Password | **Argon2id** | Khuyến nghị hiện hành, chống GPU tốt hơn bcrypt. |
| Logging | **Pino** JSON + redact secret | §59/§81 structured logging, không lộ token. |
| Error tracking | **Sentry** (hoặc GlitchTip self-host) | §17 observability. |
| Metrics | **OpenTelemetry → Prometheus/Grafana** (hoặc Grafana Cloud) | Health, latency, webhook fail rate. |
| Test | **Vitest** (unit) · **Supertest** (API) · **Testcontainers** (Postgres thật) · **Playwright** (E2E) | §80 bước 16, đặc biệt test authorization/data scope. |
| Monorepo | **pnpm workspaces + Turborepo** | §75: `apps/*`, `packages/crm-sdk`, `packages/tracking-sdk`, `packages/shared-types`. |
| Deploy | **Docker + Docker Compose (staging)** → **Kubernetes hoặc VPS + Nginx** (prod) | Không lock cloud; container hóa để scale worker riêng khỏi API. |
| CI/CD | **GitHub Actions** | lint → typecheck → test → migrate dry-run → build image. |

### Vì sao NestJS + Postgres, không phải lựa chọn khác

- Yêu cầu nặng nhất của spec là **authorization đúng và nhất quán** (§3, §44, §59) và
  **không mất lịch sử** (§32, §40, §72). NestJS cho một chỗ duy nhất để cắm Guard; Postgres
  cho transaction + constraint để lịch sử không bị ghi đè.
- Yêu cầu thứ hai là **multi-website qua API** (§17, §19, §75). REST + API Key scope +
  CORS theo `website_domains` là mô hình đã chuẩn hóa, SDK sinh từ OpenAPI.
- Yêu cầu thứ ba là **analytics/attribution** (§26, §53). Postgres window function + CTE +
  materialized view đủ cho quy mô CRM; chưa cần ClickHouse ở phase 1 (xem 2.5).

## 2.2 Phương án B — Laravel 11 (PHP 8.3) + MySQL/Postgres

Chọn khi team mạnh PHP hoặc đã có hạ tầng LAMP.

- **Được**: Eloquent + Policy/Gate khớp RBAC; Sanctum cho API token; Horizon cho queue;
  Filament/Nova dựng admin nhanh; hosting rẻ, nhân sự VN dồi dào.
- **Mất**: Không chia sẻ type với FE (phải sinh type từ OpenAPI); `tracking-sdk`/
  `crm-sdk` phải viết riêng bằng TS; prototype Next.js hiện có phải nối qua API thuần.

## 2.3 Phương án C — Django 5 + DRF + Postgres

Chọn khi ưu tiên admin sinh sẵn và tương lai AI/ML (§79).

- **Được**: Django admin cho backoffice nội bộ; DRF permission class rõ; `django-guardian`
  cho object-level; hệ sinh thái Python cho AI Lead Scoring.
- **Mất**: Django admin **không** thay được Modern SaaS CRM UI (§61) → vẫn phải build FE
  riêng; async/realtime cần Channels, phức tạp hơn.

## 2.4 Điểm cần chốt trong Phương án A

1. **Prisma vs Drizzle vs Kysely** — Prisma dễ đọc schema nhưng raw SQL cho analytics phải
   dùng `$queryRaw`. Nếu bạn muốn SQL-first cho báo cáo: **Drizzle** (type-safe, gần SQL) là
   lựa chọn tốt hơn. Khuyến nghị: **Prisma cho CRUD + view/SQL riêng cho Reporting**.
2. **Monolith deploy 1 container hay tách `api` + `worker`** — khuyến nghị tách 2 process
   cùng codebase (webhook retry và import job không được chặn API).
3. **Multi-tenant**: spec là multi-**website** trong MỘT tổ chức (không phải SaaS nhiều
   khách hàng). Khuyến nghị **single database, `website_id` là cột phân vùng logic**, không
   dùng schema-per-tenant. Cần bạn xác nhận không có nhu cầu bán CRM cho khách khác.
4. **Ngôn ngữ/timezone**: `Asia/Ho_Chi_Minh`, lưu UTC trong DB, format `dd/MM/yyyy HH:mm` ở
   FE (khớp prototype). i18n: vi-VN mặc định, kiến trúc để mở en-US.

## 2.5 Khi nào cần thêm hạ tầng (đừng thêm sớm)

| Ngưỡng | Thêm gì |
|--------|---------|
| `page_views` > ~50M dòng, dashboard chậm | Partition theo tháng + materialized view; sau đó mới xét ClickHouse |
| Webhook outbound > vài nghìn/phút | Tách worker riêng, tăng Redis, cân nhắc Kafka |
| Nhiều team dev độc lập, deploy cản nhau | Tách service theo biên module đã định ở `01` (Tracking và Integration là ứng viên đầu) |
| Cần full-text search tiếng Việt mạnh | Postgres `pg_trgm` + `unaccent` trước; Meilisearch/OpenSearch sau |

**Không** dựng microservice, Kafka, hay ClickHouse ở phase 1 — vi phạm §2 ("không tạo
microservice chỉ để trông scalable").

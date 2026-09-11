# 08 — API DESIGN (§80 Bước 8)

Base: `/api/v1`. OpenAPI 3.1 sinh từ Zod schema, phục vụ `/api/v1/docs`.

## 8.1 Convention chung

### Response envelope

Thành công (single):
```json
{
  "data": { "id": "...", "...": "..." },
  "meta": { "requestId": "01JB...", "timestamp": "2026-09-04T07:12:33.120Z" }
}
```

Thành công (list):
```json
{
  "data": [ { "...": "..." } ],
  "meta": {
    "requestId": "01JB...",
    "pagination": { "cursor": "eyJpZCI6...", "nextCursor": "eyJpZCI6...", "hasMore": true, "limit": 50, "total": 1284 },
    "appliedScope": "TEAM"
  }
}
```

Lỗi:
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Dữ liệu không hợp lệ",
    "details": [ { "field": "phone", "code": "INVALID_PHONE", "message": "Số điện thoại không đúng định dạng" } ],
    "requestId": "01JB...",
    "timestamp": "2026-09-04T07:12:33.120Z"
  }
}
```

`appliedScope` trong meta giúp FE biết mình đang xem ở phạm vi nào (hữu ích cho Leader).

### Mã lỗi chuẩn

| HTTP | code | Khi nào |
|---|---|---|
| 400 | `BAD_REQUEST` | request sai cấu trúc |
| 401 | `UNAUTHENTICATED` | thiếu/không hợp lệ token hoặc API key |
| 401 | `TOKEN_EXPIRED` | access token hết hạn (FE tự refresh) |
| 403 | `FORBIDDEN` | thiếu permission |
| 403 | `SCOPE_INSUFFICIENT` | API key thiếu scope |
| 403 | `ADMIN_ENDPOINT_FORBIDDEN` | API key gọi endpoint quản trị |
| 404 | `NOT_FOUND` | không tồn tại **hoặc ngoài data scope** |
| 409 | `CONFLICT` | vi phạm unique (VD trùng code) |
| 409 | `DUPLICATE_CUSTOMER` | phone/email đã thuộc customer khác |
| 409 | `IDEMPOTENCY_KEY_REUSED` | cùng key, body khác |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | request trước đang xử lý |
| 422 | `VALIDATION_FAILED` | sai nghiệp vụ/định dạng field |
| 422 | `INVALID_TRANSITION` | order status sai state machine |
| 422 | `TARGET_OUT_OF_SCOPE` | assign cho người ngoài phạm vi |
| 422 | `IN_USE` | xóa thứ đang được dùng (status, source) |
| 422 | `NO_CHANGE` | update không thay đổi gì |
| 422 | `LAST_ADMIN_PROTECTED` | thao tác làm mất ADMIN cuối cùng |
| 429 | `RATE_LIMIT_EXCEEDED` | + header `Retry-After` |
| 500 | `INTERNAL_ERROR` | lỗi không lường trước (log kèm requestId) |
| 503 | `SERVICE_UNAVAILABLE` | DB/Redis không sẵn sàng |

### Header

Request:
| Header | Bắt buộc | Ghi chú |
|---|---|---|
| `Authorization: Bearer <jwt>` hoặc cookie | user API | |
| `X-Api-Key: <prefix>.<secret>` | machine API | |
| `Idempotency-Key` | write API quan trọng | UUID/ULID do client sinh |
| `X-Request-Id` | tùy chọn | nếu không có, server sinh ULID |
| `X-Website-Id` | tùy chọn | khi 1 API client phục vụ nhiều website |

Response: `X-Request-Id`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`,
`Idempotent-Replay: true` (khi trả lại kết quả cũ).

### Pagination

**Cursor-based** cho mọi list (ổn định khi dữ liệu thay đổi):
`?limit=50&cursor=<opaque>`. `limit` max 200. `total` chỉ tính khi `?withTotal=true`
(COUNT tốn kém trên bảng lớn). Offset (`?page=`) chỉ hỗ trợ cho bảng nhỏ (products, statuses).

### Filter / Sort / Search

```
?status=st-01,st-02          # in
?createdFrom=2026-08-01&createdTo=2026-08-31
?saleId=<uuid>&teamId=<uuid>&sourceId=<uuid>&campaignId=<uuid>&websiteId=<uuid>
?q=nguyen                    # search: name + phone + email + code (trgm + unaccent)
?sort=-createdAt,fullName    # `-` = desc
?include=status,sale,team    # eager load có kiểm soát (whitelist)
```
Mọi filter đều **thêm vào** scope, không thay thế được scope.

### Versioning

`/api/v1` trong path. Breaking change → `/api/v2`, v1 giữ tối thiểu 6 tháng kèm header
`Deprecation` + `Sunset`. Non-breaking (thêm field optional) không tăng version.

---

## 8.2 Auth endpoints

| Method | Path | Permission | Ghi chú |
|---|---|---|---|
| POST | `/auth/login` | — | rate limit 5/phút/IP+identifier |
| POST | `/auth/refresh` | — | rotate; phát hiện reuse → revoke family |
| POST | `/auth/logout` | auth | |
| POST | `/auth/logout-all` | auth | revoke mọi session |
| GET | `/auth/me` | auth | trả user + permissions[] + scope (FE render menu) |
| POST | `/auth/change-password` | auth | cần mật khẩu cũ |
| POST | `/auth/password-reset/confirm` | — | token từ Admin |
| GET | `/auth/sessions` | auth | thiết bị đang đăng nhập |
| DELETE | `/auth/sessions/{id}` | auth | |

`GET /auth/me` response:
```json
{ "data": {
  "id": "...", "fullName": "Trần Quốc Bảo", "role": "LEADER",
  "dataScope": "TEAM",
  "permissions": ["customer.view","customer.update","customer.assign","..."],
  "teams": [ { "id": "...", "name": "Team Bảo — Miền Bắc", "isLeader": true } ],
  "settings": { "realtimeMode": "SSE", "saleCanSeeRevenue": true }
} }
```

---

## 8.3 Customer endpoints

| Method | Path | Permission | Ghi chú |
|---|---|---|---|
| GET | `/customers` | `customer.view` | list + scope + filter |
| POST | `/customers` | `customer.create` | idempotency hỗ trợ |
| GET | `/customers/{id}` | `customer.view` | 404 nếu ngoài scope |
| PATCH | `/customers/{id}` | `customer.update` | partial |
| DELETE | `/customers/{id}` | `customer.archive` | soft delete, cần `reason` |
| POST | `/customers/{id}/restore` | `customer.restore` | |
| **PATCH** | **`/customers/{id}/status`** | `customer.update_status` | §48 |
| GET | `/customers/{id}/status-history` | `customer.view_history` | append-only |
| GET | `/customers/{id}/timeline` | `customer.view` | cursor, `?kinds=STATUS,NOTE` |
| POST | `/customers/{id}/notes` | `customer.add_note` | |
| GET | `/customers/{id}/notes` | `customer.view` | |
| GET | `/customers/{id}/leads` | `lead.view` | các lần khách để lại thông tin |
| GET | `/customers/{id}/touchpoints` | `customer.view` | lịch sử nguồn (§70) |
| GET | `/customers/{id}/assignments` | `customer.view_history` | lịch sử phân data |
| GET | `/customers/{id}/orders` | `order.view` | |
| GET | `/customers/{id}/tasks` | `task.view` | |
| POST | `/customers/{id}/tasks` | `task.create` | |
| POST | `/customers/merge/preview` | `customer.merge` | dry-run, trả diff + xung đột |
| POST | `/customers/merge` | `customer.merge` | transactional |
| GET | `/customers/duplicates` | `lead.review_duplicate` | hàng chờ review |
| POST | `/customers/duplicates/{id}/resolve` | `lead.review_duplicate` | merge/reject/ignore |
| POST | `/customers/export` | `customer.export` | tạo export job |

### `PATCH /customers/{id}/status` — chi tiết (§48)

Request:
```json
{ "statusId": "uuid-hoặc-code", "note": "Khách đã tạo tài khoản thành công" }
```
Chấp nhận cả UUID và `code` (`account_created_success`) để website ngoài dùng được code
ổn định.

Backend thực hiện đúng 9 bước:
```
1 AuthN (JWT hoặc API key scope customer:update_status)
2 Permission customer.update_status
3 Customer tồn tại (query đã kèm scope → ngoài scope = 404)
4 Record guard: Sale phải là người phụ trách; Leader cần setting bật
5 Validate status: tồn tại, is_active = true
6 BEGIN → update customers.current_status_id + status_updated_at/by
        → INSERT customer_status_history (old, new, actor, role, note, ip, channel)
        → INSERT customer_timeline_events (kind=STATUS)
        → INSERT audit_logs
        → INSERT outbox_events (customer.status_changed)
  COMMIT
7 (worker) notification theo notification_rules + status.notify_on_change
8 (worker) webhook outbound nếu có đăng ký
9 Response 200 { data: customer đã cập nhật + status object }
```
Nếu `statusId` trùng status hiện tại → `422 NO_CHANGE`, **không** ghi history.

---

## 8.4 Lead endpoints

| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| **POST** | **`/leads`** | API key `lead:create` **hoặc** user `lead.create` | §14 — endpoint quan trọng nhất cho website |
| GET | `/leads` | `lead.view` | scope + filter |
| GET | `/leads/{id}` | `lead.view` | |
| PATCH | `/leads/{id}` | `lead.update` | đổi status lead, qualify |
| POST | `/leads/{id}/convert` | `customer.create` | tạo/gắn customer thủ công |
| GET | `/leads/export` | `customer.export` | |

### `POST /api/v1/leads` — hợp đồng cho Landing Page

Request:
```http
POST /api/v1/leads
X-Api-Key: pk_live_ab12.xxxxxxxx
Idempotency-Key: 01JBQ8F3K2M9XV7T4NRS
Content-Type: application/json

{
  "name": "Nguyễn Văn A",
  "phone": "0912 345 678",
  "email": "  A.Nguyen@Gmail.com ",
  "note": "Muốn tư vấn gói cơ bản",
  "websiteId": "uuid",                 // tùy chọn nếu key đã gắn website
  "landingPageCode": "lp-tiktok-01",   // dùng code, không cần biết uuid
  "sourceCode": "tiktok",              // tùy chọn; nếu thiếu → suy từ utm/referrer
  "campaignCode": "campaign01",
  "trackingLinkSlug": "tiktok01",
  "utm": { "source": "tiktok", "medium": "cpc", "campaign": "campaign01", "content": "video01", "term": null },
  "referrer": "https://www.tiktok.com/",
  "pageUrl": "https://lp.example.com/uu-dai?utm_source=tiktok",
  "visitorKey": "v_8f2c...",           // từ tracking-sdk, để nối session
  "sessionKey": "s_31ab...",
  "custom": { "goiDichVu": "basic" }   // lưu vào raw_payload
}
```

Response 201:
```json
{ "data": {
  "leadId": "uuid", "leadCode": "LEAD-20260904-0231",
  "customerId": "uuid", "customerCode": "KH00842",
  "isNewCustomer": false,
  "duplicateDetected": true,
  "duplicateAction": "ATTACHED_TO_EXISTING",
  "assignedTo": null
} }
```

Ngữ nghĩa quan trọng:
- **Luôn 201** khi lead được ghi nhận, kể cả khi customer đã tồn tại (đó là lead mới của
  người cũ — §29). Không trả 409 cho trường hợp này.
- `409 IDEMPOTENCY_KEY_REUSED` chỉ khi cùng `Idempotency-Key` nhưng body khác.
- Gửi lại **đúng** cùng key + cùng body → 201 với `Idempotent-Replay: true`, không tạo lead thứ hai.
- Không có `Idempotency-Key`? Vẫn nhận, nhưng client mất bảo vệ khi retry. Tài liệu SDK
  phải khuyến nghị luôn gửi.
- `duplicateAction` ∈ `NONE` | `ATTACHED_TO_EXISTING` | `FLAGGED_FOR_REVIEW`.

---

## 8.5 Assignment / Data Pool

| Method | Path | Permission | Ghi chú |
|---|---|---|---|
| GET | `/data-pool` | `customer.view_pool` | data chưa phân |
| GET | `/data-pool/stats` | `customer.view_pool` | đếm theo source/website/ngày |
| POST | `/assignments/to-leader` | `customer.assign` | batch `{customerIds[], leaderId, reason}` |
| POST | `/assignments/to-sale` | `customer.assign` | batch, validate target ∈ team |
| POST | `/assignments/reassign` | `customer.assign` | |
| POST | `/assignments/revoke` | `customer.assign` | về pool |
| GET | `/assignments/history` | `customer.view_history` | filter theo customer/user/batch |

Batch response (một phần thành công là bình thường):
```json
{ "data": {
  "batchId": "uuid", "requested": 50, "succeeded": 47, "failed": 3,
  "failures": [ { "customerId": "...", "code": "TARGET_OUT_OF_SCOPE", "message": "..." } ]
} }
```
Trả **207-like semantics trong 200** thay vì fail toàn bộ — Admin phân 500 khách không nên
mất cả lô vì 2 dòng lỗi. Giới hạn batch: 500/lần (cấu hình).

---

## 8.6 Task / Follow-up

| Method | Path | Permission |
|---|---|---|
| GET | `/tasks` | `task.view` (`?view=today\|upcoming\|overdue`) |
| POST | `/tasks` | `task.create` |
| GET | `/tasks/{id}` | `task.view` |
| PATCH | `/tasks/{id}` | `task.update` |
| POST | `/tasks/{id}/complete` | `task.complete` |
| POST | `/tasks/{id}/cancel` | `task.update` |
| GET | `/tasks/summary` | `task.view` (đếm cho dashboard) |

---

## 8.7 Sales / Billing

| Method | Path | Permission |
|---|---|---|
| GET | `/orders` | `order.view` |
| POST | `/orders` | `order.create` (idempotency) |
| GET | `/orders/{id}` | `order.view` |
| PATCH | `/orders/{id}` | `order.update` |
| PATCH | `/orders/{id}/status` | `order.update_status` |
| POST | `/orders/{id}/cancel` | `order.cancel` |
| GET | `/orders/{id}/status-history` | `order.view` |
| GET | `/orders/{id}/attribution` | `order.view` |
| GET | `/payments` | `payment.view` |
| POST | `/payments` | `payment.create` (idempotency) |
| POST | `/payments/{id}/refund` | `payment.refund` |
| GET | `/revenue` | `revenue.view` |
| GET | `/revenue/summary` | `revenue.view` |
| POST | `/revenue/reconcile/{orderId}` | `revenue.adjust` |
| GET | `/products` | `product.view` (public qua key `product:read`) |
| POST/PATCH/DELETE | `/products{/id}` | `product.manage` |

---

## 8.8 Marketing / Website / Tracking

| Method | Path | Permission |
|---|---|---|
| GET/POST/PATCH/DELETE | `/marketing/sources{/id}` | view / `source.manage` |
| GET/POST/PATCH/DELETE | `/marketing/campaigns{/id}` | view / `campaign.manage` |
| GET/POST/PATCH/DELETE | `/marketing/tracking-links{/id}` | view / `tracking_link.manage` |
| GET | `/marketing/analytics` | `marketing.view` |
| GET | `/marketing/funnel` | `marketing.view` |
| GET | `/marketing/attribution` | `attribution.view` |
| GET | `/marketing/traffic` | `traffic.view` |
| GET/POST/PATCH | `/websites{/id}` | `website.view` / `website.manage` |
| GET/POST/DELETE | `/websites/{id}/domains{/domainId}` | `domain.manage` |
| POST | `/websites/{id}/domains/{domainId}/verify` | `domain.manage` |
| GET/POST/PATCH | `/landing-pages{/id}` | `landing_page.manage` |
| POST | `/landing-pages/{id}/test-api` | `landing_page.manage` |
| GET | `/landing-pages/{id}/analytics` | `marketing.view` |
| **POST** | **`/tracking/events`** | API key `tracking:write` |
| GET | `/go/{slug}` | công khai (302 redirect + ghi click) |

`POST /tracking/events` nhận batch:
```json
{ "visitorKey": "v_...", "sessionKey": "s_...", "websiteId": "uuid",
  "events": [ { "name": "pageview", "url": "...", "at": "2026-09-04T07:00:00Z", "properties": {} } ] }
```
Trả `202 Accepted` (ghi vào buffer, worker flush) — không chặn website của khách.

---

## 8.9 Content / Media

| Method | Path | Permission |
|---|---|---|
| GET | `/posts` | `blog.view`; hoặc API key `blog:read` (chỉ PUBLISHED của website đó) |
| GET | `/posts/{idOrSlug}` | như trên |
| POST/PATCH | `/posts{/id}` | `blog.manage` |
| POST | `/posts/{id}/publish` \| `/unpublish` \| `/schedule` | `blog.manage` |
| DELETE | `/posts/{id}` | `blog.manage` (archive) |
| GET | `/posts/{id}/revisions` | `blog.manage` |
| GET/POST/PATCH/DELETE | `/categories{/id}`, `/tags{/id}` | `blog.manage` |
| GET | `/media` | `media.view` |
| POST | `/media/upload` | `media.upload` (multipart) |
| POST | `/media/from-url` | `media.upload` |
| DELETE | `/media/{id}` | `media.delete` |

---

## 8.10 Team / User / System

| Method | Path | Permission |
|---|---|---|
| GET/POST/PATCH | `/teams{/id}` | `team.view` / `team.manage` |
| POST | `/teams/{id}/members` | `team.assign_member` |
| DELETE | `/teams/{id}/members/{userId}` | `team.assign_member` |
| POST | `/teams/members/move` | `team.assign_member` |
| GET | `/teams/{id}/history` | `team.view` |
| GET/POST/PATCH | `/users{/id}` | `user.view` / `user.create` / `user.update` |
| POST | `/users/{id}/lock` \| `/unlock` | `user.lock` |
| POST | `/users/{id}/role` | `user.change_role` |
| POST | `/users/{id}/password-reset` | `user.reset_password` |
| GET/POST/DELETE | `/users/{id}/permissions{/overrideId}` | `user.manage_permission` |
| GET | `/users/{id}/role-history` | `user.view` |
| GET/POST/PATCH/DELETE | `/customer-statuses{/id}` | `status_config.manage` |
| POST | `/customer-statuses/reorder` | `status_config.manage` |
| GET/PATCH | `/settings` | `system.manage` |
| GET | `/settings/history` | `audit.view` |
| GET | `/audit-logs` | `audit.view` |
| GET | `/notifications` | `notification.view` |
| POST | `/notifications/read` | `notification.view` |
| GET/POST/PATCH | `/notification-rules{/id}` | `notification.manage_rules` |

---

## 8.11 Integration

| Method | Path | Permission |
|---|---|---|
| GET/POST/PATCH | `/api-clients{/id}` | `integration.view` / `integration.manage` |
| GET | `/api-clients/{id}/keys` | `api_key.view` |
| POST | `/api-clients/{id}/keys` | `api_key.issue` → **trả full key 1 lần** |
| POST | `/api-keys/{id}/rotate` | `api_key.issue` |
| POST | `/api-keys/{id}/revoke` | `api_key.revoke` |
| GET/POST/PATCH/DELETE | `/webhooks{/id}` | `webhook.manage` |
| POST | `/webhooks/{id}/test` | `webhook.manage` |
| GET | `/webhooks/{id}/deliveries` | `webhook.manage` |
| POST | `/webhooks/deliveries/{id}/retry` | `webhook.manage` |
| GET/POST/PATCH | `/integrations{/id}` | `integration.manage` |
| GET | `/integrations/{id}/logs` | `integration.view` |
| POST | `/webhooks/in/{slug}` | signature verify (không cần JWT) |

`POST /api-clients/{id}/keys` response — **lần duy nhất** thấy secret:
```json
{ "data": {
  "id": "uuid", "name": "Landing TikTok - Production",
  "apiKey": "pk_live_ab12.7f3Kx9QmZ2vLpR8sT4nW6yB1cD5eF0gH",
  "keyPrefix": "pk_live_ab12", "keyLastFour": "0gH",
  "scopes": ["lead:create","tracking:write"], "expiresAt": null,
  "warning": "Lưu lại ngay. Khóa đầy đủ sẽ không hiển thị lại."
} }
```

---

## 8.12 Reports / Dashboard

| Method | Path | Permission |
|---|---|---|
| GET | `/dashboard/summary` | `report.view` (KPI §7, theo scope) |
| GET | `/dashboard/alerts` | `report.view` (data chưa phân, overdue, integration lỗi) |
| GET | `/reports/funnel` | `report.view` |
| GET | `/reports/status-distribution` | `report.view` |
| GET | `/reports/sale-performance` | `report.sale_performance` |
| GET | `/reports/team-performance` | `report.team_performance` |
| GET | `/reports/orders` \| `/revenue` \| `/marketing` | tương ứng |
| POST | `/exports` | `*.export` (tạo job) |
| GET | `/exports/{id}` | người tạo |

Mọi report nhận `?from=&to=&websiteId=&sourceId=&campaignId=&teamId=&saleId=`.
Trả kèm `meta.appliedScope` và `meta.dataAvailability`:
```json
"meta": { "appliedScope": "TEAM",
  "dataAvailability": { "traffic": "NOT_TRACKED", "adSpend": "NOT_CONNECTED", "leads": "OK" } }
```
FE dựa vào đây để hiện "Chưa có dữ liệu" thay vì số 0 gây hiểu sai (§27, §52).

---

## 8.13 Realtime & Health

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/realtime/stream` | SSE, auth cookie, filter theo scope |
| GET | `/health` | liveness (không auth, không lộ chi tiết) |
| GET | `/health/ready` | readiness: DB + Redis + storage |
| GET | `/health/detail` | `system.manage`: version, migration, queue depth |
| GET | `/docs` \| `/docs/openapi.json` | Swagger UI (bảo vệ ở production) |

---

## 8.14 Rate limit mặc định

| Nhóm | Giới hạn |
|---|---|
| `/auth/login` | 5/phút theo IP+identifier, khóa 15 phút sau 10 lần sai |
| User API (đọc) | 600/phút/user |
| User API (ghi) | 120/phút/user |
| `POST /leads` | theo `api_keys.rate_limit_per_minute` (mặc định 60) |
| `POST /tracking/events` | 600/phút/key, 60/phút/visitor |
| `GET /posts` (public) | 300/phút/key |
| Export/Import | 5 job đồng thời/user |

Vượt → `429` + `Retry-After`. Rate limit đếm bằng Redis sliding window.

---

## 8.15 Idempotency — bắt buộc cho endpoint nào

`POST /leads` · `POST /customers` · `POST /orders` · `POST /payments` ·
`POST /assignments/*` · `POST /webhooks/in/{slug}` · `POST /media/upload`.

Luồng (khớp `05-database-schema.md` §5.15):
```
1 Không có header → xử lý bình thường
2 INSERT idempotency_records (state=IN_PROGRESS) ... ON CONFLICT DO NOTHING
3 Nếu insert được → xử lý → UPDATE state=COMPLETED + response_body
4 Nếu conflict:
    · record.state=COMPLETED và request_hash khớp → trả response cũ + Idempotent-Replay
    · request_hash khác                            → 409 IDEMPOTENCY_KEY_REUSED
    · state=IN_PROGRESS                            → 409 IDEMPOTENCY_IN_PROGRESS (client retry sau)
5 TTL 24h (cấu hình), job cleanup mỗi đêm
```
`request_hash` = SHA-256 của body đã canonical hóa (sort key, bỏ whitespace).

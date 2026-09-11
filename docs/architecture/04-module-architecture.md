# 04 — MODULE ARCHITECTURE (§80 Bước 4)

Mỗi module theo cùng một khuôn. `*.service.ts` là **cửa duy nhất** vào module — module khác
chỉ gọi service, không gọi repository của nhau, không join xuyên biên trong code nghiệp vụ.

```
modules/<name>/
  <name>.controller.ts     HTTP: DTO in/out, decorator permission/scope. KHÔNG business logic.
  <name>.service.ts        Use case + transaction boundary + phát event. Cửa public.
  <name>.repository.ts     Truy vấn DB. Chỉ module này gọi.
  <name>.policy.ts         Quy tắc record-level riêng của module (canView/canUpdate 1 record).
  dto/                     Zod schema request/response (nguồn của OpenAPI + SDK).
  events/                  Định nghĩa event module phát ra.
  <name>.module.ts         Wiring; `exports` chỉ service, không export repository.
```

---

## 4.1 Identity & Access

**Trách nhiệm**: user, đăng nhập/đăng xuất, session/token, role (3 role cố định),
permission, permission override, resolve `AuthContext` + data scope.

**Use case chính**
| Use case | Ghi chú |
|---|---|
| `login(email\|phone, password)` | Argon2id verify · rate limit theo IP+identifier · ghi `auth_sessions` · trả access(15p)+refresh(30d) |
| `refresh(token)` | Rotate refresh, phát hiện reuse → revoke cả family |
| `logout` / `logoutAll` | Revoke session |
| `createUser / updateUser` | Admin; validate role ∈ {ADMIN,LEADER,SALE} |
| `lockUser / unlockUser` | `users.status` = `ACTIVE`/`LOCKED`; session bị revoke ngay |
| `resetPassword` | Admin phát token 1 lần, hạn 1h; user tự đặt mật khẩu mới. Admin **không** thấy/đặt mật khẩu trực tiếp |
| `changeRole(userId, role)` | Ghi `user_role_history` + audit; revoke session để AuthContext làm mới |
| `grantOverride / revokeOverride` | `user_permission_overrides` (`ALLOW`/`DENY` + optional scope) |
| `resolveAuthContext(userId)` | permissions = role perms ∪ ALLOW − DENY; dataScope = max(role default, override); cache Redis 60s, invalidate khi role/override/team đổi |

**Quy tắc bảo vệ ADMIN cuối cùng**: không cho hạ role / lock / xóa nếu đó là ADMIN đang
hoạt động cuối cùng → lỗi `LAST_ADMIN_PROTECTED`.

**Event phát**: `user.created`, `user.role_changed`, `user.locked`, `user.password_reset_requested`.

---

## 4.2 Organization (Team)

**Trách nhiệm**: Team, Leader chính, thành viên, lịch sử membership.

- `createTeam`, `updateTeam`, `toggleTeamActive` (không hard delete)
- `assignLeader(teamId, userId)` — user phải có role LEADER; leader cũ ghi vào history
- `addMember(teamId, userId)` / `removeMember` — set `left_at`, `is_active=false`, **không xóa dòng**
- `moveMember(userId, fromTeam, toTeam)` — 1 transaction: đóng membership cũ, mở mới, ghi history
- `getScopeUserIds(userId)` — Leader → tất cả member đang active của team mình phụ trách
  (dùng bởi Authorization layer)

**Ràng buộc**: một Sale chỉ active ở **một** team tại một thời điểm (partial unique index).
Nếu cần multi-team → xem `19-open-questions.md` Q7.

**Event**: `team.created`, `team.member_added`, `team.member_moved`, `team.member_removed`,
`team.leader_changed`.

---

## 4.3 Customer

**Trách nhiệm**: bản ghi người, contact, trạng thái (cấu hình được), status history, note,
timeline, merge.

| Use case | Ghi chú |
|---|---|
| `createCustomer` | normalize phone/email trước khi ghi; check duplicate |
| `updateCustomer` | audit old/new theo từng field |
| `archiveCustomer` / `restoreCustomer` | soft delete `deleted_at`/`deleted_by`/`delete_reason` |
| `updateStatus(id, statusId, note?)` | §48: 9 bước — authN → permission → tồn tại → record guard → cập nhật `current_status_id` → ghi history → audit → notification rule → response. Nếu status không đổi → `NO_CHANGE`, KHÔNG ghi history rác |
| `addNote(id, note)` | ghi `customer_notes` + timeline; cập nhật `last_note` snapshot |
| `getTimeline(id)` | hợp nhất status/assignment/note/order/payment/api/task/system, sort desc, cursor paginate |
| `getStatusHistory(id)` | append-only, không có API sửa/xóa |
| **Status config** `createStatus/updateStatus/toggleActive/reorder/deleteStatus` | Admin only (`system.manage`). Không xóa nếu `is_system` hoặc đang được customer dùng → `IN_USE`, chỉ cho tắt |
| `mergeCustomers(primaryId, dupId, reason)` | §30, xem 4.3.1 |

### 4.3.1 Merge (transactional)

```
BEGIN
 1 lock cả 2 dòng (SELECT ... FOR UPDATE, thứ tự id tăng dần → tránh deadlock)
 2 preview đã tính trước ở API riêng (dry-run) — bước này chỉ áp dụng
 3 chuyển FK sang primary: leads, touchpoints, source_history, status_history, notes,
   tasks, assignments+history, orders, payments, timeline_events
 4 hợp nhất field rỗng của primary từ dup (không ghi đè giá trị đã có)
 5 dup → deleted_at + `merged_into_id = primary`
 6 ghi customer_merge_history (+ snapshot JSONB toàn bộ dup trước merge)
 7 audit_logs + outbox `customer.merged`
COMMIT
```
Không tự động merge khi độ tin cậy thấp → `lead_duplicate_reviews` (§29).

**Event**: `customer.created`, `customer.updated`, `customer.status_changed`,
`customer.note_added`, `customer.merged`, `customer.archived`.

---

## 4.4 Lead

**Trách nhiệm**: tiếp nhận lead từ Landing/API/Import, normalize, dedupe, gắn Customer.

Pipeline `ingestLead(payload, ctx)` — dùng chung cho API, webhook inbound, import:
```
1 validate schema (Zod)
2 normalize: phone (E.164 theo rule cấu hình) · email (lowercase+trim)
3 resolve context: website (từ API key/domain/websiteId) · source · campaign ·
  landing_page · tracking_link · utm · referrer · visitor/session (nếu có)
4 duplicate detection: phone_normalized → email_normalized
     · match chắc  → dùng customer cũ
     · match yếu   → tạo customer mới + đẩy `lead_duplicate_reviews`
     · no match    → tạo customer mới
5 tạo `leads` (luôn tạo — một người có thể nhiều lead)
6 ghi `customer_touchpoints` + `customer_source_history`; cập nhật first/last touch
7 đặt trạng thái mặc định từ `settings.default_customer_status_id` (không hard-code)
8 vào Data Pool: `data_pool_entries` state=UNASSIGNED (nếu chưa có assignment)
9 audit(channel=API|WEB|SYSTEM) + outbox `lead.created` (+ `customer.created` nếu mới)
```
Khác biệt Duplicate vs Idempotency: bước 4 xử lý **cùng một người**; `Idempotency-Key` ở
lớp pipeline (§3.3B) xử lý **cùng một request** — không thay thế nhau.

**Event**: `lead.created`, `lead.duplicate_flagged`, `lead.qualified`.

---

## 4.5 Assignment & Data Pool

**Trách nhiệm**: data chưa phân, giao Admin→Leader→Sale, thu hồi, reassign, recycle, lịch sử.

| Use case | Ai làm | Ghi chú |
|---|---|---|
| `listPool(filter)` | Admin: all · Leader: pool trong phạm vi | filter theo source/website/campaign/ngày/status |
| `assignToLeader(ids[], leaderId, reason)` | Admin (`customer.assign`) | batch, 1 transaction, giới hạn kích thước batch |
| `assignToSale(ids[], saleId, reason)` | Leader (chỉ Sale trong team) / Admin | validate target ∈ scope |
| `reassign(ids[], toUserId, reason)` | theo permission | đóng assignment cũ, mở mới |
| `revoke(ids[], reason)` | Admin/Leader | về Pool state=`RECYCLED` |
| `recycleBySla()` | job | rule trong `settings`: chưa liên hệ sau N giờ / không đổi status sau N ngày |
| `getAssignmentHistory(customerId)` | theo scope | append-only |

`customer_assignments` giữ **assignment hiện tại** (partial unique: 1 active/customer).
`assignment_history` giữ **mọi lần** giao/thu/chuyển: từ ai → tới ai, from/to team, lý do,
thời điểm, actor. Không UPDATE, không DELETE.

**Event**: `customer.assigned`, `customer.unassigned`, `customer.reassigned`,
`customer.recycled`.

---

## 4.6 Follow-up / Task

- `createTask`, `updateTask`, `completeTask`, `cancelTask`, `snoozeTask(dueAt)`
- Query: `today`, `upcoming`, `overdue`, `byCustomer`, `needCall` (khách chưa liên hệ)
- Job `task:overdue_scan` chuyển `OPEN/IN_PROGRESS` quá hạn → `OVERDUE` + notification
- Task xuất hiện trong Customer Timeline (§43)
- Scope: Sale thấy task của mình; Leader thấy task của team; Admin tất cả

**Event**: `task.created`, `task.completed`, `task.due`, `task.overdue`.

---

## 4.7 Catalog (Product)

`createProduct/updateProduct/toggleActive/archiveProduct`, `updatePrice` (audit old→new giá
— ví dụ §56), gán ảnh từ **Media** (không upload riêng), map `product_websites` để website
nào bán sản phẩm nào. `product_code` unique.

---

## 4.8 Sales (Order)

- `createOrder(customerId, items[], ...)` — tính total từ giá **snapshot tại thời điểm tạo**
  (`order_items.unit_price` copy, không tham chiếu động), gắn attribution snapshot (§74)
- `updateOrderStatus` — state machine:
```
PENDING → CONFIRMED → PROCESSING → PAID → COMPLETED
   ↓          ↓            ↓         ↓
CANCELLED  CANCELLED   CANCELLED  REFUNDED
```
  Chuyển sai → `INVALID_TRANSITION`. Mỗi lần chuyển ghi `order_status_history`.
- Order Status **độc lập** Customer Status (§47). Không tự động đổi customer status khi order
  đổi; nếu muốn liên kết thì qua **rule cấu hình** (phase Automation), không hard-code.
- Scope: Sale thấy order mình tạo/của khách mình; Leader theo team; Admin all.

**Event**: `order.created`, `order.status_changed`, `order.cancelled`.

---

## 4.9 Billing (Payment & Revenue)

- `recordPayment(orderId, amount, method, paidAt, ref)` → `payments` (nguồn sự thật về tiền)
- `payment.paid` → handler sinh/cập nhật `revenue_entries` theo rule (§74). Revenue **không**
  cho nhập tay tự do; chỉ có `adjustment` có lý do + audit.
- `reconcile(orderId)` — so tổng payment vs order total vs revenue; lệch → cảnh báo dashboard
- Refund: `payments` bản ghi âm (`type=REFUND`), sinh `revenue_entries` đối ứng

---

## 4.10 Website / Domain / Landing Page

- `createWebsite` (name, code unique, primary domain, language, timezone, logo/favicon media)
- `addDomain(websiteId, domain, type)` → verify bằng DNS TXT hoặc file well-known;
  `is_verified` mới được dùng cho CORS/tracking
- `resolveWebsiteByHost(host)` — cache Redis; dùng cho CORS allowlist + tracking + CMS
- `createLandingPage` (website nullable — landing độc lập được), gán/ tạo API Client,
  `testApi(landingPageId)` gửi lead thử vào môi trường test và trả kết quả chẩn đoán
- Analytics per landing: traffic · leads · orders · revenue · conversion (chỉ số thật)

---

## 4.11 Marketing (Source / Campaign / Tracking Link)

- `lead_sources`: name, code, group (`SOCIAL/SEARCH/VIDEO/WEBSITE/LANDING/REFERRAL/OTHER`),
  `traffic_type` (`PAID/ORGANIC/REFERRAL/DIRECT/OTHER`) — Admin tự tạo, **không hard-code**
- `campaigns`: name, code, source, website, budget (tùy chọn), start/end, status
- `tracking_links`: slug (`/go/tiktok01`), destination URL, source, campaign, website;
  redirect endpoint ghi click + set visitor cookie rồi 302
- Counter (`click`, `unique_visitor`, `lead`, `order`, `revenue`) là **giá trị dẫn xuất** từ
  Tracking/Lead/Order — lưu ở aggregate, không nhập tay

---

## 4.12 Tracking

- Ingest `POST /api/v1/tracking/events` (API key scope `tracking:write`): pageview, click,
  form_view, form_submit, custom
- `visitors` (pseudonymous id trong cookie 1st-party) → `tracking_sessions` (timeout 30p
  cấu hình được) → `page_views` / `tracking_events`
- Chống lạm dụng: rate limit theo key + theo visitor; bỏ payload lạ; giới hạn kích thước
- Privacy (§52): IP chỉ lưu nếu `settings.tracking_store_ip = true`; mặc định **tắt**, có thể
  lưu dạng băm/rút gọn. Không lưu PII trong tracking event
- **Không tạo số liệu giả**: chưa bật tracking thì dashboard hiện "Chưa có dữ liệu", không hiện 0 giả định

---

## 4.13 Attribution

- `customer_touchpoints`: mỗi tiếp xúc có source/campaign/landing/tracking_link/website + thời điểm
- `customers.first_touch_id` / `last_touch_id` (denormalize để query nhanh, có job đối soát)
- `attribution_snapshots`: bản đóng băng gắn với Order (§74) — Order truy ngược được bối cảnh
  dù campaign/landing sau này bị đổi tên hay archive
- Model: `FIRST_TOUCH`, `LAST_TOUCH` ở MVP; `LINEAR`, `TIME_DECAY`, `POSITION_BASED` ở phase 2
  (thêm bảng `attribution_credits`, không đổi core)

---

## 4.14 Content (CMS)

- Post CRUD + `DRAFT/SCHEDULED/PUBLISHED/UNPUBLISHED/ARCHIVED`; `post_websites` (n-n) cho
  phép 1 bài hiện trên nhiều website
- Slug unique **theo website** (unique index trên `post_websites(website_id, slug)`)
- SEO: meta title/description, canonical, robots index/follow, OG image (media ref)
- `post_revisions` giữ phiên bản nội dung
- Public read API `GET /api/v1/posts` (scope `blog:read`) trả bài PUBLISHED của website
  tương ứng API key — website ngoài không cần biết CRM nội bộ

---

## 4.15 Media

- `upload(file)` → validate type/size/extension/MIME sniff/tên file → key ngẫu nhiên
  (không dùng tên gốc) → S3 → `media`
- `registerByUrl(url)` — trường hợp §11 "nhập URL"; đánh dấu `storage_provider='EXTERNAL'`
- `list/search/preview/copyUrl/archive`
- Mọi module chỉ lưu `media_id`. Không module nào có upload riêng (§73)

---

## 4.16 Integration

- API Client CRUD; API Key: `issue` (trả full key **một lần**), `rotate`, `revoke`,
  `setScopes`, `setRateLimit`, `setExpiry`, xem `last_used_at`
- Webhook outbound: đăng ký URL + event types + secret; delivery log + retry/backoff/dead-letter (§66)
- Webhook inbound: endpoint theo provider, verify signature, đưa vào pipeline `ingestLead`
- Integration registry (§54): **một** module duy nhất, mỗi provider là adapter
- `integration_logs`: request/response đã redact, latency, status
- Credential ngoài: mã hóa at-rest (AES-256-GCM, key từ secret manager), không log

---

## 4.17 Notification

- `notifications` per recipient; `notification_rules` cấu hình: event nào, role/user nào nhận,
  điều kiện (VD chỉ status có `notify_on_change=true`)
- Channel MVP: in-app (+ SSE). Email/Zalo/Telegram = adapter phase 3
- `markRead`, `markAllRead`, `unreadCount`

---

## 4.18 Audit

- `audit_logs`: actor (user hoặc api_client), action, module, entity, entity_id, old/new
  (JSONB, đã redact secret), ip, user_agent, channel (`WEB/API/SYSTEM`), correlation_id, created_at
- Ghi qua hook trong transaction — không phải "best effort" sau khi commit
- **Append-only**: không API sửa/xóa; retention theo policy, archive chứ không xóa
- `activity_logs` cho hành vi ít nghiêm trọng (login, xem export) tách khỏi audit nghiệp vụ

---

## 4.19 Import / Export

Import (§50): `Upload → Preview (50 dòng đầu) → Mapping cột → Validation → Duplicate check →
Import (chunk 500/tx) → Result (thành công/lỗi/trùng + file lỗi tải về)`.
Import đi qua **cùng** pipeline `ingestLead` → không có đường tắt bỏ qua dedupe/audit.

Export (§51): customers, leads, orders, revenue, marketing, campaign, traffic. Luôn áp
Data Scope của người xuất; ghi audit ai xuất gì, bao nhiêu dòng, filter nào. > 5k dòng → job
async + link hết hạn.

---

## 4.20 Reporting

Read-only module, không sở hữu bảng nghiệp vụ. Cung cấp: Dashboard KPI (§7), CRM Funnel,
Status Distribution, Sale Performance (§46), Team Performance, Orders, Revenue, Marketing
(source/campaign/landing/tracking link), Attribution.

Quy tắc: **mọi query báo cáo đều nhận `AuthContext` và áp scope ở tầng SQL** (Leader chỉ ra
số của team mình). Số liệu chỉ từ dữ liệu thật; thiếu dữ liệu → trả `null` + lý do, FE hiện
"Chưa có dữ liệu", không hiện 0 gây hiểu sai (§27, §46, §52).

---

## 4.21 System Settings

`settings` dạng key-value có schema + version: phone country rule, default customer status,
SLA recycle, realtime mode, tracking_store_ip, notification defaults, import batch size,
export threshold, rate limit mặc định. Mọi thay đổi ghi `settings_history` + audit.
Không hard-code những giá trị này ở code.

---

## 4.22 Accounting (placeholder — §62)

Route + menu tồn tại, trả trang "Đang cập nhật". Không bảng, không nghiệp vụ. Chỗ móc sẵn:
event `payment.paid` / `revenue.recorded` đã có → phase 4 chỉ thêm subscriber.

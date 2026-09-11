# 01 — BUSINESS DOMAIN MAP (§80 Bước 1)

Mục tiêu: xác định **module/bounded context**, trách nhiệm và biên giới. Đây là bản đồ để
mọi bước sau (schema, API, RBAC, folder) không bị chồng chéo.

## 1.1 Nguyên tắc chia biên

- Mỗi module **sở hữu** bảng của mình. Module khác KHÔNG viết trực tiếp vào bảng đó.
- Đọc dữ liệu ngoài biên: qua **service interface** của module chủ, hoặc qua **read model /
  query service** dùng riêng cho báo cáo. Không rải join tùy tiện xuyên biên trong code
  nghiệp vụ.
- Giao tiếp thay đổi trạng thái xuyên module: qua **domain event** (§67), không gọi chéo
  lồng nhau.
- Mọi module đều đi qua Authorization layer chung (Permission + Data Scope) — không module
  nào tự phát minh cách kiểm tra quyền.

## 1.2 Danh sách module (Core — có trong MVP)

| # | Module | Trách nhiệm chính | Sở hữu (bảng chính) |
|---|--------|-------------------|---------------------|
| 1 | **Identity & Access** | User, đăng nhập, session, Role, Permission, Override, Data Scope | `users` `roles` `permissions` `user_roles` `role_permissions` `user_permission_overrides` `auth_sessions` `user_role_history` |
| 2 | **Organization (Team)** | Team, Leader chính, thành viên, lịch sử vào/ra | `teams` `team_members` `team_membership_history` |
| 3 | **Customer** | Customer, contact, trạng thái cấu hình được, status history, note, timeline, merge | `customers` `customer_contacts` `customer_statuses` `customer_status_history` `customer_notes` `customer_timeline_events` `customer_merge_history` |
| 4 | **Lead** | Lead từ Landing/API/Import, normalize, duplicate detection, review queue | `leads` `lead_events` `lead_duplicate_reviews` |
| 5 | **Assignment & Data Pool** | Data Pool, phân data Admin→Leader→Sale, thu hồi, recycle, lịch sử | `customer_assignments` `assignment_history` `data_pool_entries` |
| 6 | **Follow-up / Task** | Task, reminder, due/overdue, SLA nhắc việc | `customer_tasks` |
| 7 | **Catalog (Product)** | Sản phẩm, giá, ảnh, mapping website | `products` `product_images` `product_websites` |
| 8 | **Sales (Order)** | Đơn hàng, dòng hàng, order status, attribution snapshot | `orders` `order_items` `order_status_history` |
| 9 | **Billing (Payment & Revenue)** | Giao dịch tiền, ghi nhận & đối soát doanh thu | `payments` `revenue_entries` |
| 10 | **Website** | Website, Domain, Landing Page | `websites` `website_domains` `landing_pages` |
| 11 | **Marketing** | Lead Source, Campaign, Tracking Link | `lead_sources` `campaigns` `tracking_links` |
| 12 | **Tracking** | Visitor, Session, Page View, Tracking Event, aggregate | `visitors` `tracking_sessions` `page_views` `tracking_events` `traffic_daily_aggregates` |
| 13 | **Attribution** | Touchpoint history, First/Last/Multi-touch, gán credit | `customer_touchpoints` `customer_source_history` `attribution_snapshots` |
| 14 | **Content (CMS)** | Post, Category, Tag, publish theo nhiều Website, SEO | `posts` `categories` `tags` `post_tags` `post_websites` `post_revisions` |
| 15 | **Media** | Media Library dùng chung, storage abstraction | `media` |
| 16 | **Integration** | API Client, API Key, Webhook in/out, delivery log, idempotency | `api_clients` `api_keys` `webhooks` `webhook_deliveries` `integrations` `integration_logs` `idempotency_records` |
| 17 | **Notification** | Thông báo in-app theo người nhận + rule cấu hình | `notifications` `notification_rules` |
| 18 | **Audit** | Audit Log thao tác quan trọng, activity log | `audit_logs` `activity_logs` |
| 19 | **Import / Export** | Job import Excel/CSV có preview-mapping-validate; export job | `import_jobs` `import_rows` `import_errors` `export_jobs` |
| 20 | **Reporting** | Read model cho Dashboard, Funnel, Sale/Team Performance, Marketing | (không sở hữu bảng nghiệp vụ; dùng view/aggregate) |
| 21 | **System Settings** | Cấu hình runtime: phone rule, SLA, feature flag, realtime mode | `settings` `settings_history` |
| 22 | **Accounting** | **Placeholder** — chỉ hiển thị "Đang cập nhật" (§62) | — |

## 1.3 Module phase sau (architecture phải mở đường — §64, §77–79)

| Module | Phase | Bảng dự kiến | Điểm móc vào kiến trúc |
|--------|-------|--------------|------------------------|
| Ads Platform | 2 | `ad_accounts` `ad_campaigns` `ad_campaign_stats` | map `campaign_id` ↔ external campaign; Integration module quản credential |
| Advanced Attribution | 2 | `attribution_models` `attribution_credits` | đọc `customer_touchpoints`, không đổi schema core |
| Automation | 3 | `automation_rules` `automation_runs` `automation_actions` | subscribe domain event (§67) |
| Communication (Email/SMS/Zalo/Telegram/WhatsApp) | 3 | `message_templates` `message_logs` | Integration + Notification channel adapter |
| AI | 4 | `ai_scores` `ai_interactions` | đọc Customer/Lead/Timeline read model |
| Affiliate & Commission | 4 | `affiliates` `commissions` `commission_rules` | đọc `orders`/`payments` qua event `payment.paid` |
| Accounting / Ledger | 4 | `accounting_entries` `ledger_accounts` | đọc `payments`/`revenue_entries` |

## 1.4 Bản đồ phụ thuộc (ai gọi ai)

```
Identity&Access ◄── (mọi module: authorize)
Organization ◄── Assignment, Reporting, Customer(scope)
Website ◄── Marketing, Tracking, CMS, Catalog, Lead, Order, Integration
Marketing ◄── Lead, Tracking, Attribution, Order, Reporting
Lead ──► Customer (tạo/gắn) ──► Assignment ──► Follow-up
Customer ──► Order ──► Payment ──► Revenue ──► Reporting
Tracking ──► Attribution ──► Order(snapshot) ──► Reporting
Media ◄── Catalog, CMS, Website, Landing Page
Integration ◄── Lead(inbound), Webhook(outbound), Tracking(ingest)
Audit ◄── (mọi module: ghi log)   Notification ◄── (event bus)
```

Chiều mũi tên = chiều phụ thuộc **đọc/gọi**. Không có vòng lặp hai chiều trực tiếp; nơi cần
"ngược chiều" thì dùng event (VD `payment.paid` → Revenue, Notification, Attribution).

## 1.5 Xác nhận quy tắc 3 Role

- Hệ thống có **đúng 3 role**: `ADMIN`, `LEADER`, `SALE`. `ADMIN` = quyền cao nhất.
- Không có `SUPER_ADMIN`, `OWNER`, `MANAGER`, `STAFF`, `EDITOR`.
- Mọi khác biệt quyền trong cùng role → `user_permission_overrides` + Data Scope override.
- `users.role` KHÔNG phải enum tự do: chỉ nhận 3 giá trị trên, được ràng buộc bằng bảng
  `roles` (seed cố định 3 dòng) + FK, và có CHECK/seed guard ở migration.
- Prototype hiện tại đang có `SUPER_ADMIN` và `USER` → xem đường di trú ở
  `19-open-questions.md` §Q3 và `05a` mục "Migration từ prototype".

## 1.6 Ngôn ngữ chung (glossary) — chống nhập nhằng

| Thuật ngữ | Định nghĩa chốt |
|-----------|-----------------|
| **Lead** | Một lần bày tỏ quan tâm (submission/opportunity). Một người có thể có nhiều Lead. |
| **Customer** | Định danh người duy nhất (dedupe theo phone/email đã normalize). |
| **Touchpoint** | Một lần tiếp xúc có nguồn (source/campaign/landing/tracking link) gắn thời điểm. |
| **Assignment** | Quan hệ đang-phụ-trách giữa User (Leader/Sale) và Customer/Lead. |
| **Data Pool** | Tập data chưa phân hoặc vừa thu hồi, chờ giao. |
| **Recycle** | Thu hồi assignment và đưa data về Pool/người khác, giữ nguyên lịch sử. |
| **Customer Status** | Trạng thái chăm sóc, Admin cấu hình. Độc lập Order Status. |
| **Order Status** | Trạng thái đơn hàng: Pending→…→Refunded. |
| **Payment** | Giao dịch tiền thực tế. |
| **Revenue Entry** | Bản ghi ghi nhận doanh thu, sinh/đối soát từ Order+Payment theo rule. |
| **API Client** | Một ứng dụng ngoài được đăng ký (website, landing, hệ thống thứ ba). |
| **API Key** | Credential của API Client, có scope + rate limit + hạn + revoke. |
| **Data Scope** | Phạm vi dữ liệu: `ALL` / `TEAM` / `OWN` / `NONE`. |

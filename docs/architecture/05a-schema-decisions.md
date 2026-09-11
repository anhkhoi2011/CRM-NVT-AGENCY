# 05a — SCHEMA DECISIONS & MIGRATION NOTES

Phần giải thích các quyết định không nhìn thấy được từ DDL, cộng đường di trú từ prototype.

## 1. Vì sao `users.role_id` là một-role, không phải many-to-many

Spec khóa cứng 3 role và nói rõ khác biệt quyền phải xử lý bằng Permission + Data Scope
(§3). Nếu cho user nhiều role, sẽ xuất hiện tổ hợp "LEADER + SALE" — tức là sinh role thứ 4
trên thực tế. Vì vậy: **một user, một role**, và:

- Cần một Leader kiêm bán hàng? → role `LEADER` + override `customer.update` scope `OWN`
  (nếu cần), Leader vẫn được assign khách cho chính mình.
- Cần một Sale được xem cả team? → role `SALE` + `user_permission_overrides` cho
  `customer.view` với `scope = 'TEAM'`.

Bảng `user_roles` mà spec §57 liệt kê được **hợp nhất** vào `users.role_id` + bảng `roles`.
Domain không mất; chỉ mất khả năng gán nhiều role — điều spec đang cấm. Nếu bạn muốn giữ
đúng tên bảng `user_roles`, xem `19-open-questions.md` Q1.

## 2. Vì sao có cột denormalize trên `customers`

`assigned_sale_id`, `assigned_leader_id`, `assigned_team_id`, `current_status_id`,
`order_count`, `total_revenue`, `first_touch_id`, `last_touch_id` là **cache đọc**:

- Nguồn sự thật vẫn là `customer_assignments`, `customer_status_history`, `orders`,
  `payments`, `customer_touchpoints`.
- Lý do: danh sách khách hàng là màn hình nặng nhất (filter theo sale + status + ngày,
  phân trang, 100k+ dòng). Không denormalize thì mỗi dòng phải join 4–5 bảng lịch sử.
- Kỷ luật bắt buộc: **chỉ service của module chủ được ghi các cột này**, ghi trong cùng
  transaction với bảng nguồn, và có job đối soát đêm (`reconcile:customer_rollup`) so lại
  với bảng nguồn, ghi cảnh báo nếu lệch.

## 3. Chiến lược Timeline (§41)

Hai cách: (a) query hợp nhất từ các bảng gốc mỗi lần mở, (b) bảng
`customer_timeline_events` denormalize.

Chọn **(b) + fallback (a)**:
- Ghi vào `customer_timeline_events` khi có event (từ handler outbox) → mở timeline là một
  query, cursor paginate mượt.
- Nhưng `ref_table` + `ref_id` luôn trỏ về bản ghi gốc, nên nếu timeline event bị mất/lệch,
  vẫn rebuild được bằng job từ các bảng gốc. Timeline **không** là nguồn sự thật.

## 4. Append-only enforce thế nào

Các bảng lịch sử (`customer_status_history`, `assignment_history`, `audit_logs`,
`user_role_history`, `team_membership_history`, `customer_merge_history`,
`order_status_history`, `customer_source_history`, `customer_touchpoints`) không được sửa/xóa.

Ba lớp bảo vệ:
1. **Không có method** trong repository/service cho UPDATE/DELETE các bảng này.
2. **Quyền DB**: role ứng dụng chỉ được `SELECT, INSERT` trên các bảng đó.
   ```sql
   REVOKE UPDATE, DELETE ON customer_status_history FROM crm_app;
   GRANT  SELECT, INSERT ON customer_status_history TO   crm_app;
   ```
3. **Trigger** chặn (phòng khi có ai chạy migration sai):
   ```sql
   CREATE FUNCTION deny_mutation() RETURNS trigger AS $$
   BEGIN RAISE EXCEPTION 'append-only table: % không cho %', TG_TABLE_NAME, TG_OP; END $$
   LANGUAGE plpgsql;
   CREATE TRIGGER trg_csh_append_only BEFORE UPDATE OR DELETE ON customer_status_history
     FOR EACH ROW EXECUTE FUNCTION deny_mutation();
   ```

Ngoại lệ có kiểm soát: `webhook_deliveries` và `outbox_events` **phải** UPDATE (đổi
status/attempt) — chúng là hàng đợi, không phải sổ lịch sử.

## 5. Normalize phone/email (§29) — quy tắc chốt

Phone:
1. Bỏ mọi ký tự không phải số và dấu `+`.
2. Nếu bắt đầu `+` → giữ nguyên như E.164.
3. Nếu bắt đầu `00` → thay bằng `+`.
4. Nếu bắt đầu `0` → thay `0` bằng country code cấu hình (`settings.phone_default_country`,
   mặc định `+84`).
5. Nếu không có tiền tố và độ dài khớp số nội địa → prepend country code.
6. Kết quả không khớp E.164 hợp lệ → **không** dùng để dedupe, lưu `phone` thô và bỏ trống
   `phone_normalized`, đánh cờ để review.

Email: `trim` → `lowercase`. **Không** bỏ dấu chấm hay phần `+tag` của Gmail theo mặc định —
đó là quyết định nghiệp vụ có thể sai; nếu bạn muốn, bật `settings.email_strip_gmail_alias`.

Cột generated (tùy chọn, nếu muốn DB tự bảo đảm):
```sql
-- Ví dụ chỉ cho email; phone cần logic phức tạp hơn nên normalize ở application layer
ALTER TABLE customers ADD COLUMN email_normalized TEXT
  GENERATED ALWAYS AS (lower(btrim(email))) STORED;
```
Khuyến nghị: normalize ở **application layer** (một hàm dùng chung cho API/import/webhook),
vì rule country code là cấu hình runtime, không nên nhét vào DDL.

## 6. Unique index và bài toán "trùng nhưng cần cho vào"

`uq_customers__phone` là unique **partial** (`WHERE deleted_at IS NULL`). Hệ quả:
- Insert customer trùng phone → lỗi DB. Đúng ý muốn: pipeline `ingestLead` phải tra trước
  và gắn lead vào customer cũ, không tạo mới (§29).
- Nhưng nếu số điện thoại **thật sự** dùng chung (vợ/chồng, số công ty)? → dù
  `customer_contacts` để lưu thêm số, hoặc chấp nhận một customer đại diện. Nếu nghiệp vụ
  của bạn có nhiều trường hợp này, unique cứng sẽ gây tắc — xem `19-open-questions.md` Q4.

## 7. Vì sao `NUMERIC(18,2)` cho VND

VND không có phần thập phân, nhưng: (a) `NUMERIC` tránh sai số float khi cộng dồn doanh thu;
(b) `(18,2)` giữ chỗ cho USD/EUR nếu sau này bán quốc tế; (c) `18` chữ số đủ cho
999 nghìn tỷ. Chi phí: nhỏ hơn nhiều so với việc phải migrate cột tiền.

## 8. Partition `page_views` / `tracking_events`

Phase 1 có thể **chưa** partition (dữ liệu còn nhỏ). DDL đã viết dạng `PARTITION BY RANGE`
để không phải đổi bảng sau. Nếu triển khai đơn giản trước: bỏ `PARTITION BY`, dùng bảng
thường + index, và migrate sang partition khi vượt ~20–50M dòng (dùng
`pg_partman` hoặc tạo bảng mới + copy).

**Retention**: `page_views`/`tracking_events` giữ 13 tháng chi tiết (cấu hình
`settings.tracking_retention_months`), sau đó chỉ giữ `traffic_daily_aggregates`. Đây là
dữ liệu tracking, không phải lịch sử nghiệp vụ — được phép drop partition cũ (§72 bảo vệ
lịch sử nghiệp vụ, không phải log tracking).

## 9. Bảng spec liệt kê vs schema thực tế — bản đối chiếu

| §57 nêu | Trong schema này | Ghi chú |
|---|---|---|
| `user_roles` | hợp nhất vào `users.role_id` + `roles` | xem mục 1 |
| `sessions`/`auth_sessions` | `auth_sessions` | + `password_reset_tokens` |
| `customer_assignments` | `customer_assignments` (active) | + `assignment_history` (append-only) |
| `customer_assignment_history` | `assignment_history` | đổi tên gọn hơn, cùng domain |
| `customer_sources` | `customer_source_history` + `customer_touchpoints` | tách rõ "lịch sử" vs "touchpoint" |
| `customer_tasks` | `customer_tasks` | đúng |
| `lead_duplicates`/`review_queue` | `lead_duplicate_reviews` | một bảng, đủ chức năng |
| `revenues` | `revenue_entries` | tên rõ hơn: mỗi dòng là một bản ghi nhận |
| `post_websites` | `post_websites` (n-n + slug riêng) | đúng |
| `activity_logs` + `audit_logs` | cả hai | audit = nghiệp vụ, activity = hành vi nhẹ |
| `system_events`/`outbox_events` | `outbox_events` | Transactional Outbox |
| `idempotency_keys`/`records` | `idempotency_records` | đúng |
| `traffic_daily_aggregates` | có | job sinh, không nhập tay |

Không có bảng nào trong §57 bị bỏ về mặt domain.

## 10. Migration từ prototype hiện tại

Prototype (archive tại `docs/archive/legacy-next-fragments/src/lib/`) là frontend-only, dữ liệu
trong `localStorage`. Không có DB để migrate — nhưng có **mô hình dữ liệu** cần chuyển:

| Prototype | Hệ thống thật | Việc phải làm |
|---|---|---|
| `CrmRole` có `SUPER_ADMIN`, `USER` | chỉ `ADMIN`/`LEADER`/`SALE` | `SUPER_ADMIN` → `ADMIN`; `USER` (khách của nền tảng) **không phải** user CRM → thuộc `customers.linked_user_id` hoặc hệ thống ngoài |
| Khóa quan hệ bằng `phone` (`leaderPhone`, `assignedSalePhone`, `memberPhones`) | UUID `user_id` | phone thành attribute; mọi FK dùng UUID |
| `customer.source` là TEXT tự do | `source_id` → `lead_sources` | seed source từ giá trị đang có trong prototype |
| `customer.statusUpdatedAt` + history dùng `changedByRole: 'SUPER_ADMIN'` | `changed_by_role` ∈ ADMIN/LEADER/SALE/SYSTEM/API | map `SUPER_ADMIN`→`ADMIN` |
| `SaleTeam.memberPhones: string[]` | `team_members` (dòng riêng + lịch sử) | mở rộng để giữ `joined_at`/`left_at` |
| Ngày dạng `dd/MM/yyyy HH:mm` (string) | `TIMESTAMPTZ` UTC | parse ở tầng import, format lại ở FE |
| `CrmDb` trong localStorage | Postgres qua REST | prototype giữ lại làm **UI reference**, không làm nguồn dữ liệu |

Prototype đã làm đúng những điểm sau, nên giữ nguyên tinh thần: status cấu hình được,
history append-only, timeline nhiều loại event, notification theo `notify_on_change`,
data scope theo team, seed deterministic để tránh hydration mismatch.

## 11. Seed dữ liệu khởi tạo (§81)

Bắt buộc seed:
1. `roles` — đúng 3 dòng ADMIN/LEADER/SALE.
2. `permissions` — toàn bộ danh sách ở `07-rbac-data-scope.md`.
3. `role_permissions` — matrix mặc định.
4. Một user ADMIN đầu tiên: email + mật khẩu **từ env var** (`SEED_ADMIN_EMAIL`,
   `SEED_ADMIN_PASSWORD`), `must_change_password = true`. Không hard-code trong code.
5. `customer_statuses` — 15 trạng thái mặc định (§36), 1 dòng `is_default`, dòng "Khác"
   `is_system = true`.
6. `lead_sources` — tối thiểu `Direct` (`is_system`) + `Unknown`; các nguồn khác Admin tự tạo.
7. `settings` — giá trị mặc định cho phone country, SLA, realtime mode, retention.
8. `notification_rules` — rule cơ bản cho `customer.status_changed`, `lead.created`,
   `order.created`, `integration.failed`.

**Không** seed: website, campaign, customer giả, order giả, traffic giả (§27, §52).
Dữ liệu demo (nếu cần) nằm trong seed script riêng `seed:demo`, chỉ chạy ở local/staging và
được đánh dấu rõ.

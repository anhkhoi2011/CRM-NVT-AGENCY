# 11 — CUSTOMER & SALES FLOW (§80 Bước 11)

Bao trùm §31–§51, §69 bước 19–33, §74.

## 11.1 Chuỗi trạng thái data — từ lúc vào CRM đến lúc chốt

```
Lead vào CRM
   │
   ▼
┌──────────────┐   Admin assign      ┌────────────────────┐   Leader assign    ┌──────────────┐
│ UNASSIGNED   │ ──────────────────► │ ASSIGNED_TO_LEADER │ ─────────────────► │ ASSIGNED_TO  │
│ (Data Pool)  │                     │                    │                    │ _SALE        │
└──────┬───────┘ ◄────── revoke ─────└─────────┬──────────┘ ◄───── revoke ─────└──────┬───────┘
       │                                       │                                       │
       │                                       │ Admin có thể assign trực tiếp cho Sale│
       │                                       └──────────────────────────────────────►│
       │                                                                               │ Sale liên hệ lần đầu
       │                                                                               ▼
       │                                                                       ┌──────────────┐
       │◄────────── RECYCLED (SLA/nghỉ việc/không phản hồi) ────────────────────│  WORKING     │
       │                                                                       └──────┬───────┘
       │                                                                              │ chốt / mất khách
       │                                                                              ▼
       │                                                                       ┌──────────────┐
       └───────────────────────────────────────────────────────────────────────│   CLOSED     │
                                                                              └──────────────┘
```

Mỗi mũi tên → một dòng `assignment_history` (append-only) + audit log. Không mũi tên nào
được xóa dấu vết (§32).

## 11.2 Admin phân data cho Leader (§32)

```
Admin ở màn hình Data Pool
  ├ filter: source · website · campaign · ngày · chưa liên hệ
  ├ chọn nhiều (checkbox / chọn tất cả trang / chọn theo filter)
  └ POST /assignments/to-leader { customerIds[], leaderId, reason, slaHours? }

Backend (1 transaction, batch tối đa 500):
  1  Permission customer.assign
  2  Validate leader: role=LEADER, status=ACTIVE
  3  Với mỗi customer:
       a  kiểm tra trong scope của người assign
       b  nếu đang có assignment active → đóng (released_at, is_active=false)
       c  INSERT customer_assignments (leader_id, state=ASSIGNED_TO_LEADER,
                                       sla_due_at = now() + slaHours)
       d  UPDATE customers.assigned_leader_id / assigned_team_id / pool_state
       e  UPDATE data_pool_entries.state='ASSIGNED', owner_leader_id=leaderId
       f  INSERT assignment_history (action=ASSIGN_TO_LEADER, from/to, reason, batch_id)
       g  INSERT customer_timeline_events (kind=ASSIGNMENT)
  4  INSERT audit_logs (1 dòng cho cả batch + danh sách id, hoặc 1 dòng/customer — xem 11.9)
  5  INSERT outbox_events customer.assigned (gộp theo batch để không spam notification)
  COMMIT
```

Dòng nào lỗi (ngoài scope, đã bị archive) → không làm fail cả batch, trả trong
`failures[]` (§8.5).

## 11.3 Leader phân data cho Sale (§31, §32)

Giống trên, thêm ràng buộc quan trọng:
```
Validate target Sale:
  · role = SALE, status = ACTIVE
  · sale ∈ scopeUserIds(leader)  ← Sale phải trong team của Leader này
  · nếu không → 422 TARGET_OUT_OF_SCOPE
```
Đây là record guard nghiệp vụ (§7.6), không thể diễn tả bằng data scope thuần.

Leader cũng có thể:
- `reassign` giữa các Sale **trong team mình**
- `revoke` về pool của mình (không về pool chung của Admin, trừ khi có permission)

## 11.4 Data Recycling (§33)

Job `assignment:sla_recycle` chạy mỗi giờ, đọc rule từ `settings`:

| Rule | Setting | Hành động |
|---|---|---|
| Chưa liên hệ sau N giờ | `recycle_no_contact_hours` (mặc định 48) | cảnh báo Leader; sau 2N giờ → recycle |
| Không đổi status sau N ngày | `recycle_stale_days` (mặc định 14) | cảnh báo |
| Khách không phản hồi sau N ngày ở status "Không phản hồi" | `recycle_no_response_days` (30) | recycle về pool |
| Sale bị lock/archive | tức thời | recycle toàn bộ data của Sale đó |

Recycle thủ công: Admin/Leader chọn data → `POST /assignments/revoke {reason}`.

Mọi recycle:
```
1  đóng assignment hiện tại (released_at, is_active=false)
2  data_pool_entries: dòng mới state='RECYCLED', recycle_count++, recycle_reason
3  customers.pool_state='RECYCLED', assigned_sale_id=NULL (giữ assigned_leader_id nếu về pool leader)
4  assignment_history action='RECYCLE' + reason + is_system=true nếu do job
5  outbox customer.recycled → notification Admin/Leader
```
**Lịch sử chăm sóc, status history, notes, orders của khách KHÔNG bị xóa** — chỉ quan hệ
phụ trách thay đổi.

Trường hợp Sale nghỉ việc:
```
POST /users/{id}/lock { reason: "Nghỉ việc từ 01/09/2026", recycleData: true, transferTo?: userId }
  → revoke session
  → recycle hoặc transfer toàn bộ customer đang phụ trách
  → task OPEN của Sale đó: chuyển cho Leader hoặc người được chỉ định
  → audit đầy đủ
```

## 11.5 Sale cập nhật trạng thái (§35, §37, §40, §48)

Màn hình Customer Detail (§37):
```
┌────────────────────────────────────────────────────────────┐
│ Nguyễn Văn A            KH00842          [VIP]             │
│ 0912 345 678 · a.nguyen@gmail.com                          │
│ Sale phụ trách: Sale Nguyễn Văn An · Team Bảo — Miền Bắc    │
│ Nguồn: TikTok → Landing A → campaign01                     │
├────────────────────────────────────────────────────────────┤
│ Trạng thái:  [ Đã tạo tài khoản          ▼ ]               │
│ Ghi chú:     [ Khách đã đăng ký thành công.            ]   │
│              [ Lưu cập nhật ]                              │
└────────────────────────────────────────────────────────────┘
```

Dropdown chỉ liệt kê `customer_statuses` có `is_active = true`, sắp theo `sort_order`.
**Không hard-code danh sách trong FE** (§36) — luôn lấy từ `GET /customer-statuses`.

Backend: 9 bước như §8.3. Điểm cần nhấn:
- Sale chỉ đổi được status của khách mình (record guard, không phải chỉ ẩn nút).
- Leader đổi được chỉ khi `settings.leader_can_update_status = true` (§44).
- Trùng status hiện tại → `422 NO_CHANGE`, không ghi history rác.
- `note` đi kèm được ghi vào `customer_notes` **và** liên kết với dòng history
  (`status_history_id`) để timeline hiển thị "đổi status kèm ghi chú" là một sự kiện (§42).

### Lịch sử trạng thái (§40) — hiển thị

```
GET /customers/{id}/status-history

12:00  Tạo tài khoản thành công  ← Đã tạo tài khoản   Sale Nguyễn Văn An  (WEB)
       "Khách đã đăng ký thành công."
11:30  Đã tạo tài khoản          ← Đang tư vấn        Sale Nguyễn Văn An  (WEB)
11:00  Đang tư vấn               ← Đã liên hệ         Sale Nguyễn Văn An  (WEB)
10:30  Đã liên hệ                ← Lead mới           Sale Nguyễn Văn An  (WEB)
10:00  Lead mới                  ← —                  Hệ thống            (SYSTEM)
       "Lead được tạo từ Landing Page A"
```

Không có endpoint sửa/xóa. `changed_by_role` lưu snapshot role tại thời điểm đổi (nếu người
đó sau này đổi role, lịch sử vẫn đúng).

## 11.6 Leader & Admin thấy gì (§38)

Cùng một nguồn dữ liệu, khác phạm vi:

```
Sale An cập nhật  Nguyễn Văn A → "Tạo tài khoản thành công"
        │
        ├─► customers.current_status_id (1 nguồn duy nhất)
        ├─► customer_status_history (append)
        └─► outbox → notification + SSE
                │
      ┌─────────┼──────────┐
      ▼         ▼          ▼
   Sale An   Leader Bảo   Admin
   (OWN)     (TEAM)       (ALL)
   thấy      thấy         thấy
```

Không tạo bảng/state riêng cho từng role (§35). Leader không cần Sale báo cáo thủ công (§38).

Realtime: SSE đẩy `{type:'customer.status_changed', customerId, ...}` → FE **refetch qua
API** (đi qua scope) chứ không tin payload. Nếu tắt realtime → dữ liệu vẫn đúng trên server,
hiện sau refresh (§39).

## 11.7 Customer Timeline (§41) — nguồn dữ liệu

```
GET /customers/{id}/timeline?kinds=STATUS,NOTE,ORDER&limit=50&cursor=...

12:05  💰 Payment 12.000.000đ (BANK_TRANSFER)     Admin           PAYMENT
12:00  🧾 Đơn DH20260904-0007 · 12.000.000đ       Sale An         ORDER
12:00  ✔ Tạo tài khoản thành công                  Sale An         STATUS
       "Khách đã đăng ký thành công."
11:45  📞 Follow-up: Gọi xác nhận (hoàn thành)     Sale An         TASK
11:30  ✔ Đã tạo tài khoản                          Sale An         STATUS
10:15  👤 Được phân cho Sale Nguyễn Văn An         Leader Bảo      ASSIGNMENT
10:05  👤 Được giao cho Leader Trần Quốc Bảo       Admin           ASSIGNMENT
10:00  ✨ Lead tạo từ Landing Page A (TikTok)      Hệ thống        SYSTEM
```

Đọc từ `customer_timeline_events` (một query, cursor paginate). `ref_table`/`ref_id` cho phép
click mở bản ghi gốc. Timeline không phải nguồn sự thật — rebuild được bằng job.

## 11.8 Follow-up / Task (§43)

```
Sale tạo follow-up từ Customer Detail:
  POST /customers/{id}/tasks
  { type:'CALL', title:'Gọi lại xác nhận nạp tiền',
    dueAt:'2026-09-05T09:00:00+07:00', remindAt:'2026-09-05T08:45:00+07:00',
    priority:'HIGH', description:'Khách hẹn 9h sáng' }
```

Dashboard Sale (§43):
| Khối | Query |
|---|---|
| Việc hôm nay | `due_at::date = today AND status IN (OPEN, IN_PROGRESS)` |
| Việc sắp tới | `due_at > now() AND due_at <= now()+7d` |
| Quá hạn | `status = OVERDUE OR (due_at < now() AND status IN (OPEN,IN_PROGRESS))` |
| Khách cần gọi lại | task type=CALL đang mở |
| Lead chưa liên hệ | `customers.first_contacted_at IS NULL AND assigned_sale_id = me` |

Job `task:overdue_scan` (mỗi 15 phút): `OPEN/IN_PROGRESS` + `due_at < now()` → `OVERDUE`
+ event `task.overdue` → notification cho Sale **và** Leader.
Job reminder: `remind_at <= now() AND reminded_at IS NULL` → notification + set `reminded_at`
(chống gửi lặp).

## 11.9 Order → Payment → Revenue (§74)

### Tạo Order
```
POST /orders
{ customerId, items:[{productId, quantity, unitPrice?}], paymentMethod, note, discountAmount }

Backend:
  1  Permission order.create + record guard (customer ∈ scope)
  2  Với mỗi item: đọc product → SNAPSHOT product_code, product_name, unit_price
       (nếu client gửi unitPrice khác giá hiện tại → cần permission order.update_price,
        mặc định lấy giá hệ thống để Sale không tự hạ giá)
  3  Tính subtotal → discount → tax → total
  4  Gắn attribution: lấy từ customer.last_touch (hoặc lead chỉ định)
       website_id, source_id, campaign_id, landing_page_id, tracking_link_id
  5  BEGIN
       INSERT orders (status='PENDING', sale_id=me, team_id=my_team)
       INSERT order_items (snapshot)
       INSERT attribution_snapshots (COPY tên + utm — bất biến)
       INSERT customer_timeline_events (kind=ORDER)
       INSERT audit_logs
       INSERT outbox_events (order.created)
     COMMIT
```

### State machine Order (§9)
```
        ┌──────────────────────────────────────────────┐
        ▼                                              │
    PENDING ──► CONFIRMED ──► PROCESSING ──► PAID ──► COMPLETED
        │           │              │           │
        ▼           ▼              ▼           ▼
    CANCELLED   CANCELLED     CANCELLED    REFUNDED
```
Chuyển sai → `422 INVALID_TRANSITION`. Mỗi lần → `order_status_history`.

### Ghi nhận Payment
```
POST /payments
{ orderId, amount, method, paidAt, reference, note }
  → payments.status = 'SUCCEEDED'
  → outbox payment.paid
```

### Revenue sinh từ event (không nhập tay)
```
payment.paid → RevenueHandler:
  · rule 'CASH_BASIS' (mặc định): recognized_at = payment.paid_at, amount = payment.amount
  · rule 'ACCRUAL': recognized_at = order.confirmed_at  (nếu business cần)
  · rule đọc từ settings.revenue_recognition_rule
  · INSERT revenue_entries (payment_id, rule_code) — UNIQUE chống trùng khi replay
  · UPDATE orders.paid_amount = SUM(payments SUCCEEDED)
  · nếu paid_amount >= total_amount → order.status = 'PAID' (nếu đang PROCESSING/CONFIRMED)
  · UPDATE customers.total_revenue, order_count (recompute, không increment)
```

Refund:
```
POST /payments/{id}/refund → payments type='REFUND', amount = số âm
  → payment.refunded → revenue_entries entry_type='REVERSAL' (số âm)
  → order.status = 'REFUNDED'
```

### Đối soát (chống hai nguồn số lệch — §74)
Job `reconcile:revenue` mỗi đêm:
```sql
SELECT o.id, o.code, o.total_amount, o.paid_amount,
       COALESCE(p.sum_paid,0) AS actual_paid,
       COALESCE(r.sum_revenue,0) AS recognized
FROM orders o
LEFT JOIN (SELECT order_id, SUM(amount) sum_paid FROM payments
           WHERE status='SUCCEEDED' GROUP BY order_id) p ON p.order_id=o.id
LEFT JOIN (SELECT order_id, SUM(amount) sum_revenue FROM revenue_entries
           GROUP BY order_id) r ON r.order_id=o.id
WHERE o.deleted_at IS NULL
  AND (o.paid_amount <> COALESCE(p.sum_paid,0)
    OR COALESCE(r.sum_revenue,0) <> COALESCE(p.sum_paid,0));
```
Lệch → ghi cảnh báo dashboard + notification Admin. **Không tự sửa** (có thể là adjustment
hợp lệ) — Admin xem và quyết định.

## 11.10 Customer Status ≠ Order Status (§47)

```
Customer Status (chăm sóc, Admin cấu hình)      Order Status (đơn hàng, cố định)
  Lead mới                                        PENDING
  Đã liên hệ                                      CONFIRMED
  Đang tư vấn                                     PROCESSING
  Đã tạo tài khoản                                PAID
  Tạo tài khoản thành công                        COMPLETED
  Đã xác minh/KYC                                 CANCELLED
  Đã nạp tiền                                     REFUNDED
  Đã mua hàng
  ...
```

Hai hệ **độc lập**. Cụ thể:
- Order `PAID` **không** tự đổi customer status sang "Đã mua hàng".
- Customer status "Đã mua hàng" **không** đòi phải có order.
- Muốn liên kết? Dùng rule cấu hình ở phase Automation (§78), không hard-code.

Vì sao tách: một khách có thể "Đã nạp tiền" (trạng thái chăm sóc, đúng với ngành trading/
tài chính) mà chưa có đơn hàng nào trong hệ thống; hoặc có đơn `CANCELLED` nhưng vẫn đang
"Đang chăm sóc". Ép đồng bộ sẽ làm sai cả hai.

## 11.11 Sale Performance (§46) — chỉ số và SQL

```sql
WITH me AS (SELECT unnest($sale_ids::uuid[]) AS sale_id),
base AS (
  SELECT c.assigned_sale_id AS sale_id, c.id, c.current_status_id,
         c.first_contacted_at, c.created_at, ca.assigned_at
  FROM customers c
  LEFT JOIN customer_assignments ca ON ca.customer_id=c.id AND ca.is_active
  WHERE c.deleted_at IS NULL AND c.assigned_sale_id IN (SELECT sale_id FROM me)
    AND ca.assigned_at::date BETWEEN $from AND $to
),
status_counts AS (
  SELECT sale_id, cs.code, COUNT(*) AS n
  FROM base b JOIN customer_statuses cs ON cs.id=b.current_status_id
  GROUP BY sale_id, cs.code
),
resp AS (
  SELECT sale_id,
         COUNT(*) FILTER (WHERE first_contacted_at IS NOT NULL) AS contacted,
         COUNT(*) AS assigned_total,
         AVG(EXTRACT(EPOCH FROM (first_contacted_at - assigned_at))/3600)
           FILTER (WHERE first_contacted_at IS NOT NULL) AS avg_first_response_hours
  FROM base GROUP BY sale_id
),
ord AS (
  SELECT sale_id, COUNT(*) AS orders,
         COUNT(*) FILTER (WHERE status IN ('PAID','COMPLETED')) AS paid_orders
  FROM orders WHERE deleted_at IS NULL AND sale_id IN (SELECT sale_id FROM me)
    AND ordered_at::date BETWEEN $from AND $to
  GROUP BY sale_id
),
rev AS (
  SELECT sale_id, SUM(amount) AS revenue FROM revenue_entries
  WHERE entry_type='RECOGNIZED' AND sale_id IN (SELECT sale_id FROM me)
    AND recognized_at::date BETWEEN $from AND $to
  GROUP BY sale_id
),
tsk AS (
  SELECT assigned_user_id AS sale_id,
         COUNT(*) FILTER (WHERE status IN ('OPEN','IN_PROGRESS')) AS task_open,
         COUNT(*) FILTER (WHERE status='OVERDUE')                 AS task_overdue
  FROM customer_tasks WHERE deleted_at IS NULL
  GROUP BY assigned_user_id
)
SELECT u.id, u.full_name, r.assigned_total, r.contacted,
       ROUND(100.0*r.contacted/NULLIF(r.assigned_total,0),1) AS contact_rate_pct,
       ROUND(r.avg_first_response_hours,2) AS avg_first_response_hours,
       o.orders, o.paid_orders, rv.revenue,
       ROUND(100.0*o.paid_orders/NULLIF(r.assigned_total,0),2) AS conversion_pct,
       t.task_open, t.task_overdue
FROM users u
LEFT JOIN resp r ON r.sale_id=u.id
LEFT JOIN ord  o ON o.sale_id=u.id
LEFT JOIN rev rv ON rv.sale_id=u.id
LEFT JOIN tsk  t ON t.sale_id=u.id
WHERE u.id IN (SELECT sale_id FROM me);
```

`status_counts` trả riêng để FE dựng cột theo status **động** (Admin thêm status mới thì báo
cáo tự có cột mới — không hard-code tên status trong query báo cáo).

Chỉ số nào chưa đủ dữ liệu → trả `null`, không trả 0 (§46 "không tạo KPI giả"):
- `avg_first_response_hours` = null nếu chưa có ai được liên hệ.
- `contact_rate_pct` = null nếu `assigned_total = 0`.

## 11.12 Import khách hàng (§50)

```
Bước 1  POST /imports { entityType:'CUSTOMER', file }        → import_jobs (UPLOADED)
Bước 2  GET /imports/{id}/preview                            → 50 dòng đầu + cột phát hiện
Bước 3  POST /imports/{id}/mapping { columnMapping, options, defaults }
          options.onDuplicate: 'SKIP' | 'ATTACH_LEAD' | 'REVIEW'
          defaults: sourceId, websiteId, assignToLeaderId?, assignToSaleId?
Bước 4  POST /imports/{id}/validate                          → import_rows + import_errors
          · normalize phone/email từng dòng
          · check duplicate trong file (2 dòng cùng phone)
          · check duplicate với DB
          → trả tổng: valid / invalid / duplicate
Bước 5  POST /imports/{id}/run                               → job async, chunk 500/tx
          mỗi dòng đi qua CÙNG pipeline ingestLead
Bước 6  GET /imports/{id}                                    → tiến độ + kết quả
          · success_rows / duplicate_rows / error_rows
          · error_file_media_id → tải file lỗi có cột "Lý do"
```

**Không import trực tiếp mà không kiểm tra** (§50) — bước 2–4 là bắt buộc, API không cho
nhảy từ upload sang run.

## 11.13 Export (§51)

```
POST /exports { entityType:'CUSTOMER', format:'XLSX', filters:{...}, columns:[...] }
  → áp Data Scope của người xuất (Sale chỉ xuất được khách của mình)
  → export_jobs lưu `applied_scope` + `filters` để audit
  → ≤5k dòng: trả file luôn; >5k: job async + link hết hạn 24h
  → audit_logs: ai xuất gì, bao nhiêu dòng, filter nào
```
`customer.export` mặc định **tắt** với SALE (§7.2) — dữ liệu khách là tài sản công ty.

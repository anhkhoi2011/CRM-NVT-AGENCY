# 07 — RBAC + DATA SCOPE (§80 Bước 7)

Tài liệu quan trọng nhất về bảo mật nghiệp vụ. Ba khái niệm **không** được lẫn:

| Khái niệm | Trả lời câu hỏi | Ví dụ |
|---|---|---|
| **Permission** | Được làm *hành động* này không? | `customer.update` |
| **Data Scope** | Được thấy *tập dữ liệu* nào? | `ALL` / `TEAM` / `OWN` / `NONE` |
| **Record Guard** | Được tác động lên *bản ghi cụ thể* này không? | khách này có phải của tôi? |

Cả ba đều kiểm ở **backend**. Ẩn menu ở FE chỉ là trải nghiệm (§3, §63).

---

## 7.1 Ba role — định nghĩa chốt

| Role | Vị thế | Scope mặc định | Ghi chú |
|---|---|---|---|
| `ADMIN` | Quyền cao nhất toàn hệ thống | `ALL` | Là quyền quản trị tối cao. Không có SUPER_ADMIN |
| `LEADER` | Quản lý đội Sale được giao | `TEAM` | Không thấy team khác trừ khi Admin cấp override |
| `SALE` | Xử lý khách được phân | `OWN` | Không thấy khách của Sale khác |

Cấm tạo role thứ 4 (§quy tắc khóa). Khác biệt trong cùng role → `user_permission_overrides`
hoặc `users.scope_override`.

---

## 7.2 Danh mục Permission đầy đủ

Định dạng `<module>.<action>`. `is_dangerous = true` → UI phải xác nhận 2 bước.

### CRM — Customer / Lead

| Code | Ý nghĩa | ADMIN | LEADER | SALE |
|---|---|:--:|:--:|:--:|
| `customer.view` | Xem danh sách/chi tiết khách | ALL | TEAM | OWN |
| `customer.create` | Tạo khách thủ công | ✅ | ✅ | ✅ |
| `customer.update` | Sửa thông tin khách | ALL | TEAM | OWN |
| `customer.update_status` | Cập nhật trạng thái (§35) | ALL | TEAM¹ | OWN |
| `customer.add_note` | Thêm ghi chú | ALL | TEAM | OWN |
| `customer.assign` | Phân/chuyển/thu hồi data | ALL | TEAM² | ❌ |
| `customer.export` | Xuất danh sách khách | ALL | TEAM | ❌³ |
| `customer.import` | Import Excel/CSV | ✅ | ✅³ | ❌ |
| `customer.merge` ⚠ | Gộp khách trùng | ✅ | ❌ | ❌ |
| `customer.archive` ⚠ | Soft delete khách | ✅ | ❌ | ❌ |
| `customer.restore` | Phục hồi khách đã archive | ✅ | ❌ | ❌ |
| `customer.view_history` | Xem lịch sử trạng thái/phân data | ALL | TEAM | OWN |
| `customer.view_pool` | Xem Data Pool | ALL | TEAM | ❌ |
| `lead.view` | Xem lead | ALL | TEAM | OWN |
| `lead.create` | Tạo lead thủ công | ✅ | ✅ | ✅ |
| `lead.update` | Sửa lead / đổi trạng thái lead | ALL | TEAM | OWN |
| `lead.review_duplicate` | Xử lý hàng chờ trùng | ✅ | ❌ | ❌ |

¹ Chỉ khi `settings.leader_can_update_status = true` (§44) — cấu hình, không hard-code.
² Chỉ Sale trong team mình.
³ Mặc định tắt; Admin có thể bật bằng override.

### Follow-up / Task

| Code | ADMIN | LEADER | SALE |
|---|:--:|:--:|:--:|
| `task.view` | ALL | TEAM | OWN |
| `task.create` | ✅ | ✅ | ✅ |
| `task.update` | ALL | TEAM | OWN |
| `task.complete` | ALL | TEAM | OWN |
| `task.assign_other` | ✅ | TEAM | ❌ |
| `task.delete` | ✅ | ❌ | ❌ |

### Sales

| Code | ADMIN | LEADER | SALE |
|---|:--:|:--:|:--:|
| `order.view` | ALL | TEAM | OWN |
| `order.create` | ✅ | ✅ | ✅⁴ |
| `order.update` | ALL | TEAM | OWN⁵ |
| `order.update_status` | ALL | TEAM | OWN⁵ |
| `order.cancel` ⚠ | ✅ | TEAM | ❌ |
| `order.export` | ALL | TEAM | ❌ |
| `payment.view` | ALL | TEAM | OWN |
| `payment.create` | ✅ | ✅ | ❌⁶ |
| `payment.refund` ⚠ | ✅ | ❌ | ❌ |
| `revenue.view` | ALL | TEAM | OWN⁷ |
| `revenue.adjust` ⚠ | ✅ | ❌ | ❌ |
| `product.view` | ✅ | ✅ | ✅ |
| `product.manage` | ✅ | ❌ | ❌ |

⁴ "nếu có permission" (§34) — bật mặc định, Admin có thể thu hồi.
⁵ Chỉ order do mình tạo và chỉ khi order chưa `PAID`.
⁶ Ghi nhận tiền là việc của Admin/Leader để tách vai trò (chống gian lận).
⁷ Doanh thu của chính mình; hiển thị hay không do `settings.sale_can_see_revenue`.

### Team & Nhân sự

| Code | ADMIN | LEADER | SALE |
|---|:--:|:--:|:--:|
| `team.view` | ALL | OWN_TEAM | ❌ |
| `team.manage` | ✅ | ❌ | ❌ |
| `team.assign_member` | ✅ | ❌ | ❌ |
| `user.view` | ALL | TEAM | ❌ |
| `user.create` | ✅ | ❌ | ❌ |
| `user.update` | ✅ | ❌ | ❌ |
| `user.lock` ⚠ | ✅ | ❌ | ❌ |
| `user.reset_password` ⚠ | ✅ | ❌ | ❌ |
| `user.change_role` ⚠ | ✅ | ❌ | ❌ |
| `user.manage_permission` ⚠ | ✅ | ❌ | ❌ |
| `user.view_activity` | ✅ | TEAM | ❌ |

### Marketing / Website / Content

| Code | ADMIN | LEADER | SALE |
|---|:--:|:--:|:--:|
| `marketing.view` | ✅ | TEAM⁸ | ❌ |
| `marketing.manage` | ✅ | ❌ | ❌ |
| `source.manage` | ✅ | ❌ | ❌ |
| `campaign.manage` | ✅ | ❌ | ❌ |
| `tracking_link.manage` | ✅ | ❌ | ❌ |
| `traffic.view` | ✅ | ❌ | ❌ |
| `attribution.view` | ✅ | TEAM⁸ | ❌ |
| `website.view` | ✅ | ❌ | ❌ |
| `website.manage` | ✅ | ❌ | ❌ |
| `domain.manage` | ✅ | ❌ | ❌ |
| `landing_page.manage` | ✅ | ❌ | ❌ |
| `blog.view` | ✅ | ✅ | ✅ |
| `blog.manage` | ✅ | ❌ | ❌ |
| `media.view` | ✅ | ✅ | ✅ |
| `media.upload` | ✅ | ✅ | ✅ |
| `media.delete` | ✅ | ❌ | ❌ |

⁸ Leader chỉ thấy số marketing quy về data/khách của team mình, không thấy ad spend toàn hệ thống.

### Reports

| Code | ADMIN | LEADER | SALE |
|---|:--:|:--:|:--:|
| `report.view` | ALL | TEAM | OWN |
| `report.sale_performance` | ALL | TEAM | OWN |
| `report.team_performance` | ALL | OWN_TEAM | ❌ |
| `report.marketing` | ✅ | ❌ | ❌ |
| `report.export` | ALL | TEAM | ❌ |

### System / Integration / Audit

| Code | ADMIN | LEADER | SALE |
|---|:--:|:--:|:--:|
| `integration.view` | ✅ | ❌ | ❌ |
| `integration.manage` ⚠ | ✅ | ❌ | ❌ |
| `api_key.view` | ✅ | ❌ | ❌ |
| `api_key.issue` ⚠ | ✅ | ❌ | ❌ |
| `api_key.revoke` ⚠ | ✅ | ❌ | ❌ |
| `webhook.manage` ⚠ | ✅ | ❌ | ❌ |
| `audit.view` | ✅ | ❌ | ❌ |
| `notification.view` | ✅ | ✅ | ✅ |
| `notification.manage_rules` | ✅ | ❌ | ❌ |
| `status_config.manage` | ✅ | ❌ | ❌ |
| `system.manage` ⚠ | ✅ | ❌ | ❌ |
| `import.view_jobs` | ALL | OWN | ❌ |

**Tổng: 71 permission.** ADMIN mặc định có tất cả với scope `ALL`.

---

## 7.3 Data Scope — định nghĩa toán học

Với mỗi permission, scope xác định tập bản ghi hợp lệ:

```
ALL   → không thêm điều kiện
TEAM  → bản ghi có owner ∈ scopeUserIds(me)
OWN   → bản ghi có owner = me.id
NONE  → tập rỗng (chặn hoàn toàn, kể cả list)
```

`scopeUserIds(me)`:
```
ADMIN                  → 'ALL' (sentinel)
LEADER                 → [me.id] ∪ {user_id : team_members active của team mà me là leader}
SALE                   → [me.id]
override scope='TEAM'  → như LEADER với team mà user đang là member
```

### "Owner" của từng entity

| Entity | Cột owner cho scope | Ghi chú |
|---|---|---|
| `customers` | `assigned_sale_id`, fallback `assigned_leader_id` | data chưa phân (`NULL`) chỉ ADMIN + LEADER-có-pool thấy |
| `leads` | `assigned_sale_id` → `assigned_leader_id` → qua `customer_id` | |
| `customer_tasks` | `assigned_user_id` | |
| `orders` | `sale_id`, fallback `team_id` | |
| `payments` | qua `order_id` → `orders.sale_id` | |
| `revenue_entries` | `sale_id` / `team_id` | |
| `customer_notes`, `customer_status_history` | qua `customer_id` | scope kế thừa từ customer |
| `data_pool_entries` | `owner_leader_id` (NULL = pool chung của Admin) | |
| `websites`, `campaigns`, `posts`, `products`, `media` | không có owner | dùng permission thuần, không scope |

### Data chưa phân — quy tắc rõ ràng

`customers.assigned_sale_id IS NULL AND assigned_leader_id IS NULL` (pool chung):
- ADMIN: thấy (qua `customer.view_pool`)
- LEADER: **không** thấy, trừ khi `data_pool_entries.owner_leader_id = me.id`
- SALE: không thấy

Đây là điểm dễ sai nhất: nếu chỉ viết `WHERE assigned_sale_id = me.id` thì Leader sẽ mất
data pool được giao; nếu viết lỏng thì Sale thấy toàn bộ pool. Xem SQL mẫu ở 7.5.

---

## 7.4 Thuật toán authorize (một chỗ duy nhất)

```
authorize(authContext, permissionCode, options?) → { allowed, scope }

1  Nếu user.status ≠ ACTIVE                     → DENY (401/403)
2  Lấy overrides còn hiệu lực (revoked_at IS NULL AND (expires_at IS NULL OR > now))
3  Nếu tồn tại override effect='DENY' cho permission → DENY   (DENY luôn thắng)
4  Nếu tồn tại override effect='ALLOW'          → ALLOW, scope = override.scope ?? role scope
5  Nếu role_permissions có permission           → ALLOW, scope = rp.scope
                                                            ?? user.scope_override
                                                            ?? role.default_scope
6  Ngược lại                                    → DENY
```

Thứ tự ưu tiên scope: `override.scope` > `role_permission.scope` > `user.scope_override` >
`role.default_scope`. **DENY luôn thắng ALLOW** — nguyên tắc an toàn.

`AuthContext` được cache Redis 60s theo `user_id`, **invalidate ngay** khi: đổi role, đổi
override, đổi team, lock user, đổi role_permissions.

### Ba lớp áp dụng ở mỗi endpoint

```
Lớp 1 — Permission (decorator)
  @RequirePermission('customer.update')

Lớp 2 — Scope (áp vào query, KHÔNG lọc ở application sau khi fetch)
  const where = scopeFilter('customer', authContext)
  // ALL  → {}
  // TEAM → { OR: [ {assigned_sale_id: {in: ids}}, {assigned_leader_id: me.id} ] }
  // OWN  → { assigned_sale_id: me.id }
  // NONE → { id: null }   ← luôn rỗng

Lớp 3 — Record guard (cho endpoint theo id)
  const c = await repo.findOne({ id, ...where })   // where đã có scope
  if (!c) throw NotFound()                         // 404, KHÔNG 403
```

> **Vì sao trả 404 chứ không 403** khi Sale gọi id của khách người khác: 403 tiết lộ "id này
> tồn tại". 404 không tiết lộ gì. Đây chính là cách chặn "Sale bypass Data Scope bằng cách
> đổi ID trên URL/API" (§59).

### Lớp 2 phải ở tầng SQL, không phải sau khi fetch

Sai:
```ts
const all = await repo.findMany({ where: { status } })   // lấy hết rồi lọc
return all.filter(c => c.assigned_sale_id === me.id)      // ❌ sai: count/paginate sai, rò rỉ qua total
```
Đúng: nhúng scope vào `where` **trước** khi query, để `COUNT`, `LIMIT/OFFSET`, và mọi
aggregate đều đúng.

---

## 7.5 SQL mẫu — scope cho `customers`

```sql
-- ADMIN (ALL)
SELECT * FROM customers WHERE deleted_at IS NULL;

-- LEADER (TEAM): khách của Sale trong team + khách Admin giao cho chính Leader
--                + pool được giao riêng cho Leader này
SELECT c.* FROM customers c
WHERE c.deleted_at IS NULL AND (
      c.assigned_sale_id = ANY($scope_sale_ids)
   OR c.assigned_leader_id = $me_id
   OR EXISTS (SELECT 1 FROM data_pool_entries d
              WHERE d.customer_id = c.id AND d.exited_at IS NULL
                AND d.owner_leader_id = $me_id)
);

-- SALE (OWN)
SELECT * FROM customers
WHERE deleted_at IS NULL AND assigned_sale_id = $me_id;

-- NONE
SELECT * FROM customers WHERE FALSE;
```

Áp dụng tương tự cho `orders`, `revenue_entries`, `customer_tasks`. Với bảng lịch sử, scope
đi qua `customer_id`:
```sql
-- Sale xem lịch sử trạng thái: chỉ khách của mình
SELECT h.* FROM customer_status_history h
JOIN customers c ON c.id = h.customer_id
WHERE c.assigned_sale_id = $me_id AND c.deleted_at IS NULL
ORDER BY h.created_at DESC;
```

---

## 7.6 Record guard nghiệp vụ (ngoài scope)

Một số quy tắc không diễn tả được bằng scope — phải ở `*.policy.ts`:

| Quy tắc | Module |
|---|---|
| Leader chỉ assign cho Sale **trong team mình** (không phải mọi Sale) | Assignment |
| Sale không được assign cho ai (kể cả cho chính mình từ pool) | Assignment |
| Sale chỉ sửa order **chưa PAID** và **do mình tạo** | Sales |
| Không xóa `customer_statuses` đang được customer dùng → `IN_USE` | Customer |
| Không xóa `customer_statuses` có `is_system = true` | Customer |
| Không hạ role/lock ADMIN cuối cùng → `LAST_ADMIN_PROTECTED` | Identity |
| Không tự merge customer khi confidence thấp → review queue | Customer |
| Không đổi order status sai state machine → `INVALID_TRANSITION` | Sales |
| Leader chỉ cập nhật status khi `settings.leader_can_update_status = true` | Customer |
| API Key **không bao giờ** truy cập endpoint quản trị, dù scope gì | Integration |
| Không sửa/xóa mọi bảng `*_history` | Toàn hệ thống |

---

## 7.7 API Key ≠ User — hai hệ thống quyền tách biệt

| | CRM User | API Client/Key |
|---|---|---|
| AuthN | JWT cookie | `X-Api-Key` |
| Quyền | Permission + Data Scope | **Scope string** (`lead:create`,…) |
| Truy cập endpoint quản trị | có (nếu đủ permission) | **không bao giờ** |
| Thấy dữ liệu | theo Data Scope | chỉ dữ liệu của `website_id` gắn với client |

API Key scope hợp lệ:
`lead:create` · `customer:read` · `customer:update_status` · `order:create` · `order:read` ·
`product:read` · `blog:read` · `tracking:write` · `webhook:send` · `media:read`.

Endpoint quản trị (`/api/v1/admin/**`, `/users`, `/teams`, `/settings`, `/audit-logs`,
`/api-clients`, `/api-keys`, `/webhooks`) **chỉ** nhận JWT user, chặn cứng API Key ở guard —
không phải bằng cách "không cấp scope".

---

## 7.8 Test bắt buộc cho RBAC (§80 bước 16)

Mỗi endpoint × mỗi role phải có test. Ma trận tối thiểu:

| Kịch bản | Kết quả mong đợi |
|---|---|
| SALE `GET /customers` | chỉ khách của mình; `meta.total` khớp |
| SALE `GET /customers/{id_của_sale_khác}` | **404**, không 403 |
| SALE `PATCH /customers/{id_khác}/status` | 404 |
| SALE `POST /customers/{id}/assign` | 403 (thiếu `customer.assign`) |
| LEADER `GET /customers` | khách của team + khách được giao + pool của mình |
| LEADER `GET /customers/{id_team_khác}` | 404 |
| LEADER `POST /assignments` tới Sale **ngoài team** | 422 `TARGET_OUT_OF_SCOPE` |
| LEADER `PATCH /customers/{id}/status` khi setting = false | 403 |
| ADMIN mọi endpoint | 200 |
| Override DENY `customer.export` cho ADMIN | 403 (DENY thắng) |
| Override ALLOW `customer.view` scope TEAM cho SALE | thấy cả team |
| Override đã `expires_at` | trở về quyền role |
| API Key scope `lead:create` gọi `GET /customers` | 403 `SCOPE_INSUFFICIENT` |
| API Key gọi `/api/v1/users` | 403 `ADMIN_ENDPOINT_FORBIDDEN` |
| API Key của website A đọc lead của website B | 404 |
| User `LOCKED` với token còn hạn | 401 (kiểm status mỗi request) |
| Hạ role ADMIN cuối cùng | 422 `LAST_ADMIN_PROTECTED` |
| Sale sửa `customer_status_history` | không có endpoint (404 route) |

Test phải chạy trên **DB thật** (Testcontainers) để bắt lỗi scope ở tầng SQL, không mock repository.

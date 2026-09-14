# NVT AGENCY CRM - triển khai MySQL

## Database mới

1. Trong cPanel tạo database, user và cấp quyền cho user.
2. Mở phpMyAdmin, chọn database và import `database/schema.sql`.
3. `schema.sql` đã gồm bảng tài khoản, khách, đơn, sản phẩm, phiên đăng nhập, đồng bộ CRM và sự kiện landing page.
4. Cấu hình biến môi trường theo `.env.example`, sau đó chạy `npm ci` và restart Node.

`schema.sql` đã cài sẵn 7 sản phẩm. Không cần tạo đơn hàng mẫu.

## Database đang chạy

1. Backup toàn bộ MySQL trước khi deploy.
2. Không chạy `DROP`, `TRUNCATE` hoặc xóa database cũ.
3. Deploy đồng thời frontend và backend, bao gồm `crm-data.cjs`, `crm-defaults.json`, `product-catalog.json` và thư mục `database`.
4. Restart Node. Backend sẽ tự seed các sản phẩm còn thiếu một lần. Có thể import `database/product-catalog.sql` thủ công nếu DB user không có quyền ghi khi khởi động.

## Cấu hình Node

- Application Root: `/home/gdyeksti/crm`
- Startup File: `app.js`
- Node.js: 18 trở lên
- Không dùng `python -m http.server` cho CRM vì Python static server không có API/MySQL.

Kiểm tra sau restart:

```text
/api/health
/api/db/health
```

Kiểm tra SQL:

```sql
SELECT id, sku, name, price, type, rental_months, active FROM products ORDER BY created_at;
SELECT setting_key FROM system_settings WHERE setting_key = 'product_catalog_20260914_v1';
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM webhook_events;
```

Deploy code không xóa dữ liệu MySQL. Tuy nhiên, để phòng hỏng hosting, xóa nhầm hoặc chuyển nhà cung cấp, cần backup MySQL tự động hàng ngày và giữ bản sao ở nơi khác hosting.

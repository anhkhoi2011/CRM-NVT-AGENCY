# NVT AGENCY CRM - triển khai MySQL

1. Trong cPanel mở MySQL Databases:
   - Tạo database, user và cấp ALL PRIVILEGES cho user.
   - Ghi lại DB_HOST, DB_NAME, DB_USER, DB_PASSWORD.
2. Mở phpMyAdmin, chọn database vừa tạo và chạy `database/schema.sql`.
3. Trong Node.js App của cPanel, đặt các biến môi trường theo `.env.example`.
   Không đưa file `.env` lên Git hoặc frontend.
4. Upload các file `db.js`, `database/schema.sql`, `package.json`, `package-lock.json` và mã nguồn hiện tại.
5. Trong thư mục app chạy `npm install`, sau đó Restart Application trong cPanel.
6. Kiểm tra `GET /api/db/health`. Khi đúng sẽ trả `{"configured":true}`.

Lưu ý chuyển đổi:
- API MySQL đã có: `/api/auth/login`, `/api/auth/me`, `/api/customers`, `/api/orders`, `/api/products`.
- API trả 503 khi chưa đặt biến DB để webhook và giao diện cũ vẫn hoạt động.
- Dữ liệu localStorage cũ không tự ghi đè dữ liệu MySQL. Hãy xuất/nhập hoặc viết migration riêng trước khi xoá cache trình duyệt.
- `password_hash` trong schema hiện dùng giá trị tương thích tạm thời với API login. Khi đưa tài khoản thật lên production, cần đổi sang hash Argon2/bcrypt và không lưu mật khẩu dạng rõ.

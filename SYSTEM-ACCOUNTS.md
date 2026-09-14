# Tài khoản hệ thống theo yêu cầu ngày 14/09/2026

| Email đăng nhập | Vai trò | Quyền |
| --- | --- | --- |
| admin@nvtagency.top | ADMIN | Toàn quyền hệ thống |
| marketing@nvtagency.top | MARKETING | Tra cứu tổng quan, khách, đơn, sản phẩm, nguồn website và dữ liệu marketing |
| ketoan@nvtagency.top | ACCOUNTING | Tra cứu tổng quan, khách, đơn, sản phẩm và doanh thu/đối soát |

Hai tài khoản phòng ban hiện chỉ có quyền đọc dữ liệu nghiệp vụ, không quản lý tài khoản, phân công, cấu hình, sửa/xóa dữ liệu hay xác nhận thanh toán. Cả hai có nút đổi mật khẩu của chính mình. Quyền được chặn tại backend, không chỉ ẩn nút ở frontend. Đăng nhập bằng email, không cần dấu gạch chéo trước @. Mật khẩu khởi tạo là các mật khẩu chủ hệ thống đã cung cấp trong yêu cầu; mã nguồn chỉ lưu bcrypt hash trong system-accounts.json.

## Khởi tạo và sửa đăng nhập

Cơ chế cũ chỉ tạo Admin khi bảng users rỗng. Cơ chế mới áp dụng cấu hình ba tài khoản một lần, kể cả bảng đã có Sale:

- Tra cứu theo email không phân biệt hoa/thường. Nếu đã có email, cập nhật đúng tài khoản đó sang role, tên, mật khẩu được yêu cầu và kích hoạt; giữ ID và số điện thoại hiện tại.
- Nếu chưa có email Admin, nhận lại tài khoản seed u-admin-start có role ADMIN nếu tồn tại. Nếu chưa có thì tạo mới bằng email. Tài khoản mới không có số điện thoại giả.
- Thu hồi phiên cũ của ba tài khoản. Khách, đơn và lịch sử nghiệp vụ không bị xóa.
- Lưu marker system_accounts_20260914_v1 trong system_settings. Restart/deploy sau đó không reset mật khẩu hoặc tự kích hoạt lại tài khoản đã bị khóa. Không xóa marker để thử đăng nhập.
- Backend chờ khởi tạo xong trước khi xử lý API đăng nhập. Nếu khởi tạo thất bại, trả 503 kèm thông báo rõ ràng; kiểm tra log Node rồi restart sau khi sửa DB.
- Frontend hiển thị lỗi thực tế từ API. Ảnh chụp báo sai mật khẩu ở phiên bản cũ chưa chứng minh mật khẩu sai vì mọi lỗi API đều bị đổi thành cùng thông báo.

## Triển khai trên cPanel

1. Backup database CRM.
2. Đưa đầy đủ mã nguồn lên Git, gồm system-accounts.cjs, system-accounts.json, crm-data.cjs, crm-defaults.json, webhook-server.cjs và crm.js. Không đưa .env lên Git.
3. Trong cPanel Node.js Selector, Application Root phải là `/home/gdyeksti/crm`, Startup File là `app.js`, Application URL phải là domain bạn dùng để mở CRM. Không mở frontend từ Apache `public_html` nếu `/api` chưa được reverse proxy sang Node. Sau đó triển khai HEAD. .cpanel.yml đã bổ sung hai file system-accounts vào thư mục Node /home/gdyeksti/crm/; frontend nằm trong /home/gdyeksti/public_html/. Xác nhận đúng đường dẫn hosting và ứng dụng app.js.
4. Trong giao diện Setup Node.js App, chọn **Run NPM Install** sau lần deploy đầu hoặc khi package-lock.json thay đổi. `.cpanel.yml` không hard-code đường dẫn npm của hosting. MySQL phải có database/schema.sql và các bảng bổ sung. Tài khoản DB cần quyền ALTER cho lần khởi tạo vai trò, cùng quyền CREATE/SELECT/INSERT/UPDATE/DELETE hiện dùng của CRM. database/department-roles.sql là bản DDL để kiểm tra/import thủ công khi cần; startup hiện cũng chạy ALTER trước khi seed lần đầu.
5. Restart ứng dụng. Nếu áp dụng lần đầu thành công, log có dòng: Đã cấu hình Admin, Marketing, Kế toán theo yêu cầu.
6. Tải lại trình duyệt (Ctrl+F5), đăng nhập bằng từng email và mật khẩu đã yêu cầu. Sau khi tự đổi mật khẩu, restart lại và xác nhận mật khẩu mới vẫn có hiệu lực.

Kiểm tra không lộ hash:

```sql
SELECT id, email, role, active FROM users
WHERE LOWER(email) IN ('admin@nvtagency.top','marketing@nvtagency.top','ketoan@nvtagency.top');
SELECT setting_key FROM system_settings WHERE setting_key='system_accounts_20260914_v1';
```

Không chạy Python http.server để đăng nhập CRM vì không có API. Ở máy local có MySQL đã cấu hình, chạy npm start.

## Kiểm chứng

npm test: 25 kiểm tra qua tại workspace, có kiểm tra khởi tạo một lần, giữ ID, rollback, role phòng ban và lỗi đăng nhập. Test dùng CSDL/DOM giả lập; chưa xác minh MySQL/hosting thật và chưa triển khai từ phiên làm việc này. Mật khẩu admin123 trước đây được thay bằng mật khẩu mới theo yêu cầu khi migration này áp dụng lần đầu.

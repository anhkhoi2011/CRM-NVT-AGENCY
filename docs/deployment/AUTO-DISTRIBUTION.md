# Kiểm tra chia data tự động trên server

Bộ chia chạy trong giao dịch MySQL của webhook. Không cần Admin mở CRM. Cùng một khóa crm_write_lock bảo vệ phân công và con trỏ tỷ trọng. API lưu cấu hình và đọc state cũng xử lý hàng chờ cũ. Khách đã có Team/Leader, kể cả lời mời quá 24h, không bị tự chia lại.

## Triển khai

1. Lấy commit mới từ GitHub và deploy theo .cpanel.yml. Phải cập nhật cả crm.js ở public_html và crm-data.cjs, webhook-store.cjs trong thư mục Node.js (/home/gdyeksti/crm/ theo cấu hình repo).
2. Khởi động lại Node.js; tải lại CRM bỏ cache. Không nhập lại schema.sql và không xóa bảng.
3. Mục Data hiển thị trạng thái từ server. Nếu báo server chưa xác nhận bộ chia, kiểm tra thư mục ứng dụng và restart; chỉ thay JavaScript giao diện là chưa đủ.
4. Chọn Leader đang hoạt động, có Team và được bật nhận. Bật tự động hoặc chọn ROUND_ROBIN/BALANCED.

## Kiểm tra trên hosting

- Đóng CRM của Admin, gửi một khách thử mới qua landing. Mở lại: khách phải có Leader/Team và người nhận (hoặc lời mời Sale đang chờ).
- Gửi lại cùng webhook: không đổi người đã nhận hay tạo lời mời trùng.
- Tắt tự động, gửi khách mới: giữ hàng chờ. Bật lại: hàng chờ được chia khi lưu cấu hình.
- Chế độ cân bằng tính khách hiện có và lời mời đang chờ; tỷ lệ từng lô không nhất thiết giống nhau nếu tải trước đó khác nhau.

npm test kiểm tra luồng frontend, webhook và giao dịch qua CSDL giả lập; không thay thế kiểm tra MySQL/cPanel thật.

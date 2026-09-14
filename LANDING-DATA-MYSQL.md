# Dữ liệu landing page trong MySQL

Webhook ghi webhook_events (bản gửi gốc) và customers (khách hợp lệ) trong cùng giao dịch trước HTTP 200. Không cần Admin mở CRM. Gửi lại cùng payload/mã webhook dùng một ID khách, không ghi đè phân công và trạng thái. Payload không hợp lệ lưu vào webhook_events, trả 422 để sửa nguồn.

## Áp dụng

1. Sao lưu MySQL và file `.webhook-inbox.json` hiện có trước triển khai. Không xóa cache trình duyệt cũ nếu còn dữ liệu chưa vào MySQL.
2. Đưa `webhook-store.cjs`, `webhook-server.cjs`, `db.js`, `crm.js` vào đúng thư mục ứng dụng Node đang chạy. File deploy hiện tại chỉ copy vào public_html; nếu app chạy ở /home/gdyeksti/crm cần cập nhật tại đó và Restart Application trên cPanel.
3. Import `database/webhook-events.sql` trong phpMyAdmin. Code cũng thử CREATE TABLE IF NOT EXISTS; DB user cần quyền CREATE hoặc bảng phải được tạo trước.
4. Cấu hình DB_HOST, DB_USER, DB_PASSWORD, DB_NAME qua cPanel hoặc .env cạnh db.js. Restart ứng dụng để nạp biến mới.
5. Giữ WEBHOOK_DATA_DIR trỏ tới thư mục bền vững ngoài mã nguồn, ví dụ /home/gdyeksti/webhook-data. Nếu inbox cũ ở đường dẫn khác, đặt WEBHOOK_INBOX_FILE đúng đường dẫn cũ. Không thay file đó khi deploy.
6. Restart Node; các sự kiện còn trong inbox được nhập lại. Không xóa inbox gốc. Log webhook-recovery báo lỗi nếu nhập chưa xong; sửa kết nối rồi restart để thử lại.
7. Admin đăng nhập bằng API MySQL, Ctrl+F5; gửi form landing thử và kiểm tra SQL dưới đây. Đóng tất cả cửa sổ CRM rồi gửi thêm form để xác nhận lưu độc lập trình duyệt.

```sql
SELECT id, created_at FROM webhook_events ORDER BY created_at DESC LIMIT 20;
SELECT id, name, phone, source, status FROM customers WHERE source = 'Landing Page' ORDER BY created_at DESC LIMIT 20;
```

Mã nguồn cập nhật không xóa hai bảng này. Lên lịch backup MySQL hàng ngày, lưu bản sao ngoài hosting và kiểm tra khôi phục định kỳ bằng công cụ hosting. Đây là việc cần cấu hình trên máy chủ, chưa được tự động thiết lập trong bản sửa.

Giới hạn: chỉ khôi phục được các bản gửi còn trong inbox/backup. Không thể phục hồi dữ liệu đã bị cắt khỏi inbox 5.000 bản ghi nếu không còn bản sao. Khách landing cũ từng nhập thủ công với ID khác có thể cần đối chiếu trùng. Khi MySQL lỗi, server trả 503; cần kiểm tra retry tại bên gửi và gửi lại nếu nhà cung cấp không tự retry. Không có bảo đảm không mất dữ liệu khi ổ đĩa/server bị hỏng nếu không có backup độc lập.

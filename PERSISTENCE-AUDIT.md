# Lưu dữ liệu NVT Agency CRM — cập nhật 14/09/2026

## Những thay đổi đã triển khai trong mã nguồn

- MySQL là nguồn dữ liệu nghiệp vụ. Trình duyệt chỉ giữ bản đang làm việc trong RAM; localStorage chỉ còn lưu giao diện sáng/tối và đọc dữ liệu cũ để xuất bản sao. Token đăng nhập nằm trong sessionStorage; phiên được kiểm tra qua bảng crm_sessions.
- Khách, đơn, sản phẩm và tài khoản tiếp tục dùng các bảng hiện tại. Các trường bổ sung của khách/đơn được giữ trong cột JSON; giá bán và thời điểm tạo cũ được giữ khi đọc lại.
- Bảng crm_documents lưu ghi chú, công việc, điểm danh, phân phối, offer, lịch sử, thông báo, website, cấu hình tích hợp và các dữ liệu phụ. crm_changes giữ trước/sau mỗi thay đổi và requestId chống gửi trùng. crm_write_lock điều phối giao dịch ghi.
- Một lần lưu chứa cả các bản ghi có liên quan. Lỗi ghi thì rollback; phiên bản cũ bị từ chối 409. Không dùng phản hồi lỗi để đánh dấu bản nháp đã lưu. Xóa nghiệp vụ lưu dấu xóa và lịch sử; không tự dọn lịch sử theo số dòng.
- Đăng ký ghi users với UNASSIGNED và bcrypt. Tài khoản chờ chưa được đăng nhập vào CRM. Admin phân quyền xong mới sử dụng. Đổi/reset mật khẩu thực hiện trên server và thu hồi các phiên của tài khoản.
- Admin nhận tín hiệu SSE sau khi đăng ký hoặc ghi dữ liệu thành công; dự phòng đồng bộ mỗi giây. SSE chỉ phát tín hiệu thay đổi, không phát thông tin khách. Inbox chỉ Admin đã xác thực mới đọc được. Độ trễ thực tế phụ thuộc mạng/proxy; trình duyệt đang mở form tạm dừng đọc nền để bảo vệ nội dung đang nhập.
- Landing page tiếp tục lưu webhook_events và khách trong một transaction trước khi trả thành công. Cập nhật mã nguồn không xóa các bảng này.
- Mặc định trong crm-defaults.json chỉ được seed một lần. Triển khai lần sau không ghi đè cài đặt hiện có hoặc tạo lại website đã xóa. Khởi tạo tài khoản hệ thống theo SYSTEM-ACCOUNTS.md, áp dụng một lần kể cả users đã có dữ liệu.
- .cpanel.yml copy frontend vào public_html và ứng dụng vào crm; giữ nguyên .env và dữ liệu runtime, sau đó touch tmp/restart.txt.

## Áp dụng

1. Trước khi triển khai, xuất toàn bộ MySQL bằng phpMyAdmin/công cụ backup hosting và giữ bản sao ngoài hosting. Trên mỗi máy từng dùng bản cũ, giữ nguyên dữ liệu trình duyệt; không xóa cache/localStorage.
2. Đưa đầy đủ mã nguồn lên Git, bao gồm crm-data.cjs, crm-defaults.json và database/crm-persistence.sql. Cập nhật cả frontend và backend trong cùng đợt. Kiểm tra hai đường dẫn /home/gdyeksti/public_html/ và /home/gdyeksti/crm/ phù hợp hosting thực tế.
3. Trong thư mục ứng dụng Node, chạy npm ci khi triển khai lần đầu hoặc khi package-lock.json đổi. Giữ .env tại /home/gdyeksti/crm/.env với DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME. Không đưa .env vào Git hoặc public_html.
4. Với database đã dùng schema.sql, nhập thêm database/crm-persistence.sql. Mã nguồn cũng tự tạo các bảng bổ sung nếu tài khoản DB có quyền CREATE. Với database mới hoàn toàn, nhập database/schema.sql trước. Không DROP/TRUNCATE bảng khi cập nhật.
5. Triển khai HEAD trong cPanel; ứng dụng dùng app.js. Nếu chạy tại máy: npm start, rồi mở cổng 4173. Python http.server chỉ phục vụ file tĩnh, không cung cấp API/MySQL.
6. Đăng nhập Admin, đợi trạng thái đồng bộ MySQL. Dùng admin@nvtagency.top và mật khẩu mới theo yêu cầu; xem SYSTEM-ACCOUNTS.md.

## Phục hồi dữ liệu từng lưu ở trình duyệt

- Tại máy cũ, ở màn đăng nhập chọn **Xuất dữ liệu trình duyệt cũ**. Giữ file này như bản sao gốc riêng tư; bản cũ có thể chứa mật khẩu dạng rõ.
- Admin chọn **Nhập bản sao**, chọn JSON vừa xuất hoặc file **Xuất bản nháp**, xem số mục mới/bỏ qua rồi xác nhận nhập. Chỉ thêm ID chưa tồn tại, không tự ghi đè dữ liệu đang có trên server. Mật khẩu bị loại khỏi dữ liệu nhập; cấu hình không tự ghi đè.
- Tài khoản đăng nhập phải đăng ký và phân quyền qua server. Nhân sự từ bản sao là hồ sơ, không tự có mật khẩu. Nếu ID nhân sự cũ khác tài khoản mới, Admin cần đối chiếu và phân công khách lại trong giao diện. Không bỏ file gốc trước khi hoàn tất đối chiếu.
- File nhập tối đa 8 MB và 2.000 bản ghi mới mỗi giao dịch. File lớn cần chia nhỏ theo quan hệ khách/đơn. Bản ghi trùng ID hoặc chưa phù hợp cần đối chiếu thủ công; đây không phải công cụ tự hòa giải xung đột.
- Khi mạng lỗi, giữ tab mở để thử lại. Nếu phải rời máy, chọn **Xuất bản nháp** trước. Khi lỗi phiên bản/quyền, xuất bản nháp rồi **Tải lại từ máy chủ**; đối chiếu lại thay đổi. RAM chưa gửi thành công không phải bản sao bền vững khi trình duyệt bị tắt đột ngột.

## Kiểm tra nghiệm thu trên hosting

1. Máy A đăng nhập Admin ở Đội ngũ; máy B đăng ký tài khoản mới. Kiểm tra A thấy đúng một tài khoản chờ; B chưa được vào CRM trước khi phân quyền. Phân LEADER/Sale đúng đội và đăng nhập lại B.
2. Admin tạo sản phẩm. Sale tạo khách, thêm ghi chú/công việc, tạo đơn từ sản phẩm. Đợi trạng thái đã lưu rồi kiểm tra máy A thấy cùng dữ liệu. Thử sửa giá sản phẩm: giá lịch sử đơn đã tạo phải giữ nguyên.
3. Admin đổi đơn sang PAID/REFUNDED; tải lại hai máy và đối chiếu tổng tiền, chiết khấu, thời điểm thanh toán/hoàn tiền. Thử phân data, Sale nhận offer, cập nhật hồ sơ/avatar, điểm danh, cột tùy chỉnh và cài đặt.
4. Gửi form landing thật hai lần với cùng sự kiện; đối chiếu webhook_events và customers, kiểm tra dữ liệu gốc còn nguyên. Đừng chỉ nhìn bộ đếm inbox trong RAM; danh sách khách lấy từ MySQL.
5. Đổi mã nguồn hoặc restart Node; đăng nhập lại, đối chiếu số khách/đơn/sản phẩm và các mục phụ. Mở CRM trên thiết bị chưa từng đăng nhập để xác nhận không phụ thuộc bộ nhớ trình duyệt.
6. Ngắt mạng trong lúc lưu: không được báo đã lưu; xuất bản nháp, nối lại mạng và kiểm tra không có bản sao. Hai máy sửa cùng bản ghi: máy sau nhận xung đột, không âm thầm ghi đè.
7. Kiểm tra backup tự động ngoài hosting và thử khôi phục vào database thử nghiệm. Deploy không xóa dữ liệu không đồng nghĩa bảo vệ được sự cố hỏng/mất database.

SQL kiểm tra nhanh, chạy trong đúng database:

```sql
SELECT role, COUNT(*) FROM users GROUP BY role;
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM products;
SELECT collection, deleted, COUNT(*) FROM crm_documents GROUP BY collection, deleted;
SELECT id, request_id, actor_id, created_at FROM crm_changes ORDER BY id DESC LIMIT 20;
SELECT COUNT(*) FROM webhook_events;
```

## Kiểm chứng tại workspace và giới hạn

Chạy npm test: 26 kiểm tra tự động đã qua (transaction mô phỏng, phân quyền, replay, xung đột, phục hồi bản nháp, phân quyền tài khoản, API đăng ký, dựng view và luồng webhook). Kiểm tra cú pháp JavaScript và git diff --check cũng được thực hiện. Test dùng pool/DOM giả lập, không chứng minh hành vi thực tế của MySQL, trình duyệt, cPanel hoặc reverse proxy.

Workspace không có .env/kết nối MySQL hosting; chưa deploy và chưa chạy nghiệm thu hai máy trên hosting. Cần thực hiện danh sách trên trước khi coi hệ thống đã nghiệm thu vận hành. Hiện API snapshot đọc toàn bộ dữ liệu rồi lọc quyền, nên cần đo tải với lượng dữ liệu/người dùng thực tế trước khi mở rộng. Tích hợp provider/SMTP cần thông số và dịch vụ thật; 2FA chưa được triển khai trên server, nút giao diện không còn giả báo đã bật.

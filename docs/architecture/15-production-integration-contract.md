# NVT CRM - Hợp đồng tích hợp production

## 1. Ranh giới triển khai

Giao diện hiện tại là frontend tĩnh và chỉ lưu dữ liệu trong `localStorage`. Nó không được phép tự xác minh API key, giữ secret, nhận webhook thanh toán hoặc đánh dấu một kết nối là thành công. Trạng thái `VERIFIED` chỉ được trả về từ backend sau khi kiểm tra thật.

Backend mục tiêu dùng modular monolith, PostgreSQL, Redis/BullMQ theo `02-tech-stack.md`. RBAC và data scope phải được thực thi lại ở API; ẩn nút trên frontend không phải là kiểm soát truy cập.

## 2. Trạng thái kết nối chuẩn

| Trạng thái | Ý nghĩa |
| --- | --- |
| `UNCONFIGURED` | Chưa có endpoint hoặc credential |
| `PENDING_BACKEND` | Frontend đã gửi metadata, backend chưa xác minh |
| `VERIFIED` | Backend đã gọi provider/xác minh webhook thành công |
| `ERROR` | Xác minh hoặc đồng bộ thất bại, có `lastError` |
| `PAUSED` | Chủ động ngừng nhận/gửi dữ liệu |

Frontend chỉ nhận `credentialConfigured` và `credentialLast4`. API không bao giờ trả secret đầy đủ.

## 3. API tối thiểu

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `POST` | `/api/v1/integrations` | Tạo connector |
| `PATCH` | `/api/v1/integrations/:id` | Sửa metadata/ánh xạ |
| `PUT` | `/api/v1/integrations/:id/credentials` | Ghi secret một chiều vào vault |
| `POST` | `/api/v1/integrations/:id/verify` | Tạo job xác minh thật |
| `POST` | `/api/v1/integrations/:id/sync` | Tạo job đồng bộ theo cursor |
| `GET` | `/api/v1/integrations/:id/runs` | Lịch sử sync, số bản ghi và lỗi |
| `POST` | `/api/v1/data` | Nhận data từ website/landing có API key và idempotency key |
| `GET/POST` | `/api/v1/customer-fields` | Đọc/tạo định nghĩa cột khách hàng động |
| `PATCH` | `/api/v1/customer-fields/:id` | Đổi tên, lựa chọn, thứ tự và trạng thái lưu trữ của cột |
| `PATCH` | `/api/v1/customers/:id/fields` | Cập nhật giá trị và ghi event lịch sử trong cùng transaction |
| `GET` | `/api/v1/customers/:id/field-history` | Lịch sử trường, đặc biệt là Level, theo quyền dữ liệu |
| `GET/PUT` | `/api/v1/distribution/leaders` | Cấu hình Leader/Sale được nhận data và tỷ trọng |
| `GET/POST` | `/api/v1/distribution/source-rules` | Cấu hình chia theo website, nguồn hoặc campaign |
| `GET/POST` | `/api/v1/webhooks/in/meta/:slug` | Verify callback và nhận Facebook Forms |
| `POST` | `/api/v1/webhooks/in/sepay/:slug` | Nhận giao dịch SePay |
| `GET` | `/api/v1/revenue?from=&to=&websiteId=` | Doanh thu đã quy nguồn theo kỳ |

## 4. Secret và an toàn outbound

- API key do CRM cấp chỉ lưu hash; chỉ hiển thị toàn bộ một lần khi tạo.
- Token Subdata, SePay và Facebook cần gọi lại provider phải mã hóa AES-GCM bằng KMS/secret manager, có key version và rotation.
- Không ghi secret vào localStorage, audit log, webhook log, export CSV hoặc error message.
- Endpoint do người dùng nhập phải dùng HTTPS và được backend chống SSRF: chặn loopback, private/link-local IP, giới hạn redirect, timeout và kích thước response.
- Mỗi webhook phải có bản ghi inbox bất biến và unique `(integration_id, provider_event_id)` để chống xử lý trùng.

## 5. Luồng data mới

1. Landing/Facebook/Subdata gửi hoặc đồng bộ một external record.
2. Backend xác minh credential/signature, ghi `inbound_event`, kiểm tra idempotency và chuẩn hóa số điện thoại.
3. Ánh xạ bắt buộc `websiteId`, `landingPageId`, `campaignId`, `formId`. Thiếu ánh xạ thì đưa vào hàng `UNATTRIBUTED`, không tự gán Website A.
4. Upsert khách theo external ID; chuẩn hóa số điện thoại về một định dạng và dùng phone hash/unique index làm khóa chống trùng chính.
5. Nếu khách đã tồn tại, không tạo khách thứ hai: ghi `customer_resubmission`, giữ Sale hiện tại; nếu đã thu hồi thì trả về Sale hoạt động gần nhất trong `customer_assignment_event`.
6. Nếu Level thuộc `L5/L6/L7/L8/L9/L10` hoặc kết quả là “Đã mở tài khoản”, trả mã nghiệp vụ `DUPLICATE_REGISTERED_ACCOUNT` để UI hiển thị `DATA TRÙNG - DATA đã đăng ký TK`.
7. Áp dụng luật nguồn trước, sau đó `MANUAL`, weighted `ROUND_ROBIN` hoặc weighted `BALANCED` trong transaction; khóa cursor khi round-robin để hai worker không giao trùng.
8. Tạo notification/audit/outbox và công việc chăm sóc khi đã có Sale.

Subdata phải lưu cursor/checkpoint theo connector. Một sync run cần có `startedAt`, `finishedAt`, `cursorBefore`, `cursorAfter`, `received`, `created`, `updated`, `skipped`, `failed` và lỗi theo từng bản ghi.

## 6. Cột khách hàng và lịch sử Level

- `customer_field_definition`: `id`, `label`, `type`, `options`, `required`, `showInTable`, `active`, `version`, `createdBy`, `updatedAt`.
- Kiểu cho phép: `TEXT`, `NOTE`, `SELECT`, `MULTI_SELECT`, `CHECKBOX`, `DATE`, `NUMBER`, `URL`. Backend phải kiểm tra URL chỉ dùng HTTP/HTTPS và kiểm tra value nằm trong option hợp lệ.
- `customer_field_value` giữ giá trị hiện tại để truy vấn nhanh; `customer_field_event` là append-only, giữ snapshot `fieldId`, `fieldLabel`, `fromValue`, `toValue`, actor, role, source và timestamp.
- Mọi thay đổi Level phải khóa bản ghi khách, ghi event rồi mới cập nhật current value trong cùng transaction. Không có API xóa/sửa event Level.
- Đổi tên hoặc lưu trữ định nghĩa cột không được cascade xóa value/event. Cột `customerLevel` không được xóa hoặc lưu trữ.
- PostgreSQL cần trigger hoặc quyền DB riêng để tài khoản ứng dụng không thể `UPDATE/DELETE customer_field_event`; audit retention áp dụng theo chính sách doanh nghiệp.

## 7. Phân công và chia Leader

- `customer_assignment_event` là append-only, giữ cả ID và snapshot tên Sale/Leader cũ để nhân sự nghỉ vẫn đọc được lịch sử.
- Leader/Sale bị tắt nhận data không được vào danh sách ứng viên mới; quyền sở hữu khách cũ không tự thay đổi.
- Weighted round-robin dùng cursor được khóa theo workspace/team. Weighted balanced so sánh `active_customer_count / weight` và khóa các ứng viên trong transaction.
- Luật nguồn có thứ tự ưu tiên và khớp chính xác theo `websiteId`, `sourceId` hoặc `campaignId`; Leader đích phải đang hoạt động và được bật nhận data.
- Khách gửi lại form là luồng khôi phục quan hệ chăm sóc, ưu tiên Sale hiện tại rồi Sale hoạt động gần nhất trong lịch sử; không chạy chia ngẫu nhiên như data mới hoàn toàn.

## 8. SePay và doanh thu

1. Adapter SePay xác minh đúng token/header/signature theo tài liệu provider tại thời điểm triển khai.
2. Lưu giao dịch ngân hàng độc lập trước khi đối soát đơn; dedupe bằng mã giao dịch provider.
3. Đối soát theo mã đơn, số tiền và tài khoản nhận. Trường hợp mơ hồ phải vào hàng chờ duyệt, không tự đánh dấu khớp.
4. Chỉ sinh revenue entry sau khi payment đã xác minh và được phân bổ cho đơn.
5. Hoàn tiền là một financial event riêng; báo cáo lọc thu theo `paidAt`, hoàn theo `refundedAt`.

Đơn hàng phải giữ snapshot `acquisitionWebsiteId`, `checkoutWebsiteId`, `landingPageId`, `sourceId`, `campaignId`, Sale, Leader và Team tại thời điểm phát sinh. Việc chuyển khách hoặc nhân sự nghỉ không được làm thay đổi lịch sử doanh thu.

## 9. Quyền xem nguồn

- Admin: toàn hệ thống, gồm sessions, ad spend, CAC và ROAS.
- Leader: không nhận `source`, `campaign`, `landingPage`, traffic, ad spend hoặc attribution trong API customer/order/revenue; chỉ nhận tổng khách, doanh thu Team và nhân sự trực thuộc.
- Sale: không nhận trường nguồn/landing/campaign; chỉ nhận khách và doanh thu của chính Sale, cùng dữ liệu nghiệp vụ được phép cập nhật.
- Backend phải dùng DTO/projection riêng theo role; không gửi trường rồi chỉ ẩn bằng CSS/JavaScript.

## 10. Điều kiện nghiệm thu production

- Không có secret trong bundle, browser storage, log hoặc API response.
- Retry webhook không tạo trùng khách, payment hoặc revenue.
- Khách gửi lại form không tăng số khách và quay về đúng Sale cũ; event lần gửi lại và lịch sử phân công đều còn nguyên.
- Đổi Level nhiều lần tạo đủ event theo đúng thứ tự; đổi tên/lưu trữ cột không làm thay đổi snapshot lịch sử.
- Leader/Sale không thấy nguồn trong response API, export, tìm kiếm hoặc giao diện.
- Leader/Sale bị tắt hoặc có weight khác nhau được áp dụng đúng khi chạy đồng thời nhiều worker.
- Custom date bao gồm cả ngày đầu/cuối; kỳ trước có cùng số ngày.
- Tổng doanh thu ngày, sản phẩm, nguồn và website bằng sổ revenue entries trong cùng scope/kỳ.
- Data không có website nằm ở `UNATTRIBUTED`; không có fallback ngầm.
- Xóa/tạm dừng connector không làm mất lịch sử sync/payment.
- Nhân sự nghỉ không làm mất khách, đơn, payment hoặc attribution lịch sử.

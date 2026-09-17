# Đối chiếu chức năng CRM cũ với giao diện tham chiếu

Ngày kiểm tra: 15/09/2026. Nguồn đối chiếu: các view, modal và nghiệp vụ đang có trong `crm.js`, `care-ui.js`; giao diện lấy từ thư mục `crm nvt test giao dien`.

## Nguyên tắc

Giữ stylesheet nội tuyến và toàn bộ ID gốc của mẫu. Thêm sự kiện, dữ liệu, menu chức năng và form trong các thành phần của mẫu. Runtime cũ vẫn thực hiện nghiệp vụ và lưu qua API; không tạo kho dữ liệu nghiệp vụ thứ hai. Đợt này không sửa backend/schema, không commit/push.

## Chức năng đã nối

| Nhóm | Chức năng | Vị trí |
|---|---|---|
| Giao diện | Đủ 51 lựa chọn font đúng khóa bản cũ; chọn màu tùy ý; kích thước chữ menu/nội dung; lưu cấu hình | Cài đặt |
| Khách hàng | Thêm, chỉnh option màu, phân Sale, lọc nhân sự, hồ sơ chi tiết, ghi chú, lịch chăm sóc | Bảng khách; Hồ sơ → Chi tiết; Chức năng khác |
| Cột | Thêm/sửa/xóa, option màu, nhiều lựa chọn, checkbox, văn bản; lưu trữ/khôi phục qua form cũ | Quản lý cột; Chức năng khác |
| Chăm sóc | Tạo/sửa/xóa nhóm, chọn cột và giá trị tự gom khách, hồ sơ/ghi chú | Chăm sóc khách |
| Nhập khách | Mở form CSV cũ, xử lý file qua runtime | Khách hàng → Chức năng khác |
| Chia data | Chia đều/thủ công/tỷ trọng, bật người nhận, cấu hình Leader | Data → Chức năng khác, theo quyền |
| Nhận data | Danh sách chờ nhận chỉ hiện tên và hạn; nhận trước khi xem đầy đủ | Data của Sale |
| Đơn hàng | Form đầy đủ khách/sản phẩm/số lượng/kênh thanh toán/cọc/thông tin hóa đơn; sửa/xóa theo quyền và hạn; xác nhận cọc/thanh toán/hoàn tiền | Đơn hàng → Chức năng khác; Chi tiết |
| Sản phẩm | Thêm/sửa, bán/thuê, kỳ thuê, SKU, giá, danh mục, ngừng hoạt động/xóa | Sản phẩm; Chức năng khác |
| Doanh thu | Giao dịch thu/hoàn, bảng đúng cột, chi tiết đơn, gói thuê, CSV, báo cáo tổng hợp/marketing | Doanh thu → Chức năng khác |
| Dashboard | Chỉ tiêu tổng hợp từ target của Sale trong phạm vi, doanh thu/chỉ số thật, mở đơn gần đây | Tổng quan |
| Nhân sự | Duyệt tài khoản chờ, tạo/sửa thành viên, chọn Leader/Sale để tạo Team, đổi mật khẩu | Đội ngũ |
| Điểm danh | Cấu hình IP/giờ, điểm danh, lịch sử, chỉnh/ghi bù theo quyền | Điểm danh; Chức năng khác |
| Website/webhook | Tạo/sửa nguồn URL, slug/domain/URL webhook, copy link, inbox và quy nguồn | Website |
| Thông báo/nhật ký | Form thông báo nội bộ, đánh dấu đọc, Telegram settings, IP trong nhật ký | Thông báo; Cài đặt; User log |
| Cá nhân | Hồ sơ/avatar cho Sale/Leader, đổi mật khẩu; form email kiểm tra cho Admin | Tên tài khoản; Cài đặt → Chức năng khác |
| Cài đặt sâu | Mở lại form cài đặt cũ để không bỏ các trường ngoài mẫu | Cài đặt → Chức năng khác → Cài đặt đầy đủ |

Các form chuyên sâu được đặt trong “Chức năng khác…” để giữ cấu trúc trang chính. Đây là cách dùng lại form và hàm cũ, không phải viết lại toàn bộ nghiệp vụ. Một số nhánh chưa được thử thao tác đầu-cuối trên trình duyệt như import CSV, upload avatar, ghi bù điểm danh.

## Phần chưa có hoặc chưa hoàn chỉnh

1. **2FA:** `toggleTwoFactor()` ở bản cũ chỉ thông báo chưa cấu hình phía server. Chưa có luồng xác thực hai lớp hoạt động.
2. **Tích hợp thanh toán bên ngoài:** `integrationsView()` cũ đang bị ẩn để nâng cấp; `accountingView()` còn tên nhà cung cấp `REMOVED_PAYMENT` và không nằm trong router đang dùng. Không đưa màn hình này ra như một kết nối ngân hàng hoạt động. Báo cáo doanh thu/xác nhận thanh toán thủ công đã nối.
3. **Hóa đơn điện tử/ký hợp đồng:** bản cũ có thông tin xuất hóa đơn của đơn hàng, chưa có hệ thống phát hành hóa đơn điện tử/ký số. Nút hợp đồng của mẫu mở form đơn hàng thật.
4. **Nhập chỉ tiêu:** hiển thị tổng `member.target` đã nối; bản cũ chưa có form nhập chỉ tiêu riêng đang hoạt động. Khi dữ liệu không có target, hiển thị chưa đặt chỉ tiêu.
5. **Tìm kiếm tổng hợp và cứu dữ liệu localStorage cũ:** các hàm `openSearchDrawer` và `importRecoveryModal` vẫn ở runtime, chưa có điểm mở riêng trên giao diện tham chiếu. Tìm kiếm từng bảng đang sử dụng được. Khôi phục dữ liệu cũ là công cụ di trú, không phải cơ chế backup MySQL.
6. **Một số thống kê phụ của mẫu:** các ô chưa đủ dữ liệu được để dấu “—”; không dùng số mẫu làm kết quả thật. Chưa nghiệm thu đầy đủ mọi biểu đồ và KPI theo từng vai trò/phạm vi ngày.
7. **Font:** đã bổ sung đường tải các web font còn thiếu trong danh sách; font Windows như Aptos/Calibri cần có trên máy. Mất mạng hoặc chặn Google Fonts sẽ dùng font dự phòng. Không có nghĩa 51 bộ font được đóng gói offline.
8. **Production:** chưa kiểm chứng email/Telegram gửi thật, webhook từ landing bên ngoài, IP qua proxy và MySQL hosting trong đợt giao diện này. Không suy ra khả năng backup/khôi phục hosting từ kết quả server demo.

## Phần dư thừa/di sản đã dọn

- Các file `.bak`, `index.ui-prototype.html`, `index.crm-runtime.html` và các HTML mẫu xác thực đã được xóa sau khi xác nhận không có mã chạy, server hoặc test nào tham chiếu. Ảnh đối chiếu được giữ tại `docs/reference-ui/` để phục vụ kiểm tra giao diện, không được tải bởi CRM.
- Khối cài đặt legacy sau `return` trong `settingsView()` là mã không chạy; danh sách dùng thực tế có 51 font.
- Bộ renderer của mẫu còn giữ cấu trúc gốc; adapter thay các hành vi nghiệp vụ. Chưa loại bỏ toàn bộ mã mẫu để không làm thay đổi ID/bố cục.
- Form nhanh và form đầy đủ cùng dùng nghiệp vụ cũ; đây là hai cách nhập, không phải hai nơi lưu dữ liệu.

## Kiểm chứng

- `npm test`: 76/76 đạt, gồm giữ nguyên CSS/ID, phân quyền, persistence/retry, font, workflow và webhook/store.
- Trình duyệt local: lưu font, mở form phân data/điểm danh, tạo ghi chú, tạo đơn bằng form đầy đủ, chuyển PENDING → PAID → REFUNDED. Không ghi nhận lỗi JavaScript ứng dụng ở các luồng này.
- Đã xem form mobile 390px: giữ bố cục mẫu, nội dung cuộn trong modal, nút đóng nằm trên thanh điều hướng.
- Đã dọn đơn/ghi chú/nhật ký QA theo ID và khôi phục các trường khách bị thay bởi thử thanh toán.
- Kiểm thử tự động dùng fixture và kiểm tra tích hợp cục bộ; không thay thế nghiệm thu MySQL thật. Demo server lưu RAM và mất dữ liệu khi restart.

## Cách xem

Mở `http://localhost:4173/`, nhấn Ctrl+F5. Vào các trang và chọn “Chức năng khác…” ở đầu trang để mở form đầy đủ. Cài đặt hiển thị có 51 font. Bộ script hiện mang phiên bản `20260915-parity-2`.

# Giao diện tham chiếu nối CRM — 15/09/2026

Nguồn giao diện: `C:\Users\ADMIN\Desktop\crm nvt test giao dien\index.html`.

## Quy tắc đang áp dụng
- Trang chính dùng nguyên HTML, CSS, ID, bố cục bảng và các modal của thư mục tham chiếu.
- Không đưa CSS hoặc các view của CRM cũ vào trang hiển thị.
- Chỉ thay dữ liệu và hàm xử lý của các ô có sẵn. Form sản phẩm được bổ sung theo yêu cầu làm tiếp, dùng đúng các lớp giao diện của mẫu.
- Chưa commit/push GitHub.

## Cách kết nối
- `reference-view.js`: các hàm hiển thị từ file gốc, bỏ dữ liệu khởi tạo và lưu localStorage.
- `reference-crm.js`: ánh xạ dữ liệu server vào bảng/form gốc, nối sự kiện, bộ lọc và biểu đồ.
- `crm-runtime.html` + `crm-runtime-api.js`: chạy runtime nghiệp vụ trong frame cùng origin, hiển thị lúc đăng nhập và ẩn sau khi đăng nhập. Form tham chiếu gọi nghiệp vụ qua cầu nối này; không dùng hai kho dữ liệu nghiệp vụ khác nhau.
- `crm.js` vẫn quản lý phiên, polling, requestId khi retry, phân quyền, kiểm tra và giao dịch `/api/state` hiện có.
- Server chỉ bổ sung các đường dẫn file tĩnh mới vào whitelist. `.cpanel.yml` copy các file mới vào cả hai thư mục triển khai.

## Đã nối vào các ô/form hiện có
- Đăng nhập/đăng xuất; menu theo quyền tài khoản.
- Bảng khách và dữ liệu từ server; phân loại theo option server; tìm kiếm; hồ sơ và gọi điện.
- Form thêm khách, nguồn website, phân loại, Level và Sale phụ trách.
- Form tạo mục chăm sóc theo cột, nhiều giá trị và lọc các nhóm mặc định.
- Form tạo đơn dùng catalog thật, VAT 10%, đặt cọc hoặc thanh toán đủ; đơn tạo mới là PENDING, không tự tăng doanh thu đã thu.
- Bảng đơn, sản phẩm, nhân sự, nhật ký; bộ lọc đơn bán/thuê, ngày và tìm kiếm.
- Các chỉ số khách/doanh thu/gói thuê, biểu đồ doanh thu theo kỳ, nguồn data và các ô cấu hình hiển thị/Telegram sẵn có.

## Để đợt sau theo phạm vi người dùng
Các phần còn chờ nối: đặt mục tiêu hoặc các form quản trị sâu. Giữ nút/vị trí của mẫu; thay thông báo thành công giả bằng thông báo chưa có form kết nối. Một số thẻ nội dung phụ và thống kê chuyên sâu của mẫu chưa được ánh xạ hết; chưa coi toàn bộ dashboard mẫu là báo cáo production đã nghiệm thu.

## Bổ sung mục Sản phẩm
- Nút Thêm/Sửa mở form theo mẫu: tên, SKU, danh mục, giá, bán/thuê, kỳ thuê và trạng thái hoạt động.
- Lưu qua hàng đợi giao dịch hiện có; kiểm tra quyền Admin, SKU trùng và gói thuê. Retry giữ nguyên ID, không tạo bản sao.
- Biểu giá đọc catalog thật, hiển thị giá trước/sau VAT 10%; sửa đúng cột VAT/trạng thái và KPI catalog.
- Form tự xếp một cột trên điện thoại, giữ nguyên stylesheet gốc.

## Kiểm tra
- Test đối chiếu hash CSS và toàn bộ ID của file tham chiếu.
- Test hàng đợi retry không tạo nhóm chăm sóc hai lần, không chuyển thao tác khi còn bản ghi chờ, và từ chối Sale sửa cấu hình nhóm.
- Trình duyệt local: đăng nhập, đọc khách/catalog, tạo nhóm chăm sóc, tạo đơn PENDING và reload vẫn đọc lại được qua API demo.
- Chưa kiểm chứng trực tiếp MySQL/hosting production trong đợt này.

## Xem local và triển khai
- Local đang chạy `npm run demo` tại `http://localhost:4173/`. Dùng Ctrl+F5 để lấy script mới.
- Admin local: `admin.demo@local.test` / `AdminDemo2026!`.
- Demo lưu trong RAM server, không tự chuyển sang hosting và không giữ khi restart Node.
- Khi được người dùng cho phép deploy: copy đủ các file mới theo `.cpanel.yml`, restart Node. Production dùng cấu hình MySQL và không bật DEMO_MODE. Không cần thay schema trong đợt nối giao diện này.

Kiểm tra bổ sung: 65/65 test đạt. Trình duyệt local tạo sản phẩm, sửa sang thuê 3 tháng, đổi giá và reload đọc lại đúng. Form 390px không tràn ngang; không có lỗi JavaScript. Đã dọn đúng sản phẩm QA và nhật ký thử nghiệm. Chưa xác minh trực tiếp trên MySQL production.

## Bổ sung cột, chăm sóc và website
- Năm cột nghiệp vụ trong bảng khách đều dùng option/màu từ định nghĩa server. Cột thêm mới hiển thị đúng kiểu: chọn một/nhiều, nội dung, ghi chú hoặc checkbox.
- Quản lý cột: thêm/sửa/xóa, thêm/xóa lựa chọn và chỉnh màu. Sửa nhãn giữ khóa option; lịch sử Level giữ nguyên. Không xóa Level; cột đang dùng trong mục chăm sóc phải được bỏ liên kết trước.
- Sửa lỗi form chăm sóc bị CSS ẩn: hiện đủ tên, cột, màu, giá trị gom nhóm; nối thêm/sửa/xóa mục. Xóa mục không xóa khách.
- Website: form thêm/sửa tên, URL nguồn, nhà cung cấp. Thẻ website lấy dữ liệu server, URL webhook do runtime tạo; bấm URL để copy. Website mới giữ trạng thái chưa cấu hình, không giả báo xác minh.
- Xóa website chưa có dữ liệu; từ chối xóa website đã là nguồn khách để bảo toàn nguồn. Nối nút đồng bộ inbox và form quy nguồn data qua nghiệp vụ hiện có.
- Không đổi stylesheet tham chiếu, backend hay schema. Đã tăng phiên bản script để tải bản mới; chưa commit/push.
- Kiểm thử: tạo cột và option màu, chọn trên khách, tạo mục chăm sóc theo cột mới, thêm/sửa website, sửa nhãn option giữ giá trị cũ và reload; không có lỗi JavaScript. Đã xem ảnh form mobile 390px. Kiểm thử tự động có phân quyền, retry, lịch sử và bảo toàn intake lỗi. Dữ liệu QA local đã được dọn theo ID. Chưa kiểm chứng trực tiếp hosting MySQL.

## Bổ sung Đội ngũ, User log, Thông báo và cấu hình webhook
- Sửa đúng cột tên/chức vụ/Team/Leader/số khách/doanh thu trong bảng nhân sự; nối tạo thành viên/Team, phân chức vụ tài khoản chờ, sửa, xóa và form đặt mật khẩu qua API xác thực sẵn có. Nhân sự tạo thủ công chưa có login cần đăng ký tài khoản; không tự tạo mật khẩu mẫu. Giữ quyền tài khoản quản trị khi sửa tên/email.
- Sửa User log đủ 7 cột; IP đọc từ audit.ip, không nhầm entity. Bản ghi thiếu IP hiện Chưa ghi nhận. IP localhost là địa chỉ phiên local, chưa kiểm chứng IP proxy hosting.
- Thông báo: form tạo nội dung nội bộ, đọc từng tin/đọc tất cả, lọc nhóm, feed và chuông dùng state thật. Form cài đặt bot Telegram dùng các khóa cấu hình cũ; không gửi thử ra kênh bên ngoài.
- Webhook: thêm form sửa slug, URL ghi đè HTTPS, domain chung và sinh slug mới; kiểm tra trùng slug, giữ pipeline nhận/khử trùng/quy nguồn/lưu của backend cũ. Không thay schema/backend.
- 73/73 test đạt. Trình duyệt local đã thử tạo/sửa thành viên, tạo thông báo, sinh/lưu slug webhook, reload; xem form mobile. Không có lỗi JavaScript; dọn dữ liệu QA theo ID. Chưa chạy thử trên hosting production. Chưa commit hoặc push GitHub.

## Rà soát chức năng cũ — 15/09/2026

Đã bổ sung 51 font, màu tùy chọn và menu “Chức năng khác…” mở form cũ qua cầu nối: khách/ghi chú/CSV, chia data, đơn đầy đủ và thanh toán, danh mục sản phẩm, tạo Team từ nhân sự, báo cáo, điểm danh, hồ sơ/mật khẩu/cài đặt/email kiểm tra. Form dùng lớp giao diện tham chiếu; không đưa stylesheet cũ lên trang chính. Bổ sung chỉ tiêu từ target thật, sửa bảng doanh thu/thuê và nút xem đơn dashboard.

Mục “Để đợt sau” ở trên là ghi nhận lịch sử; trạng thái mới nhất và các phần thực sự còn thiếu nằm trong `FUNCTIONAL-PARITY.md`. Hiện 76/76 test đạt; trình duyệt đã thử tạo đơn đầy đủ, thanh toán, hoàn tiền và ghi chú. Không có lỗi JavaScript ở các luồng kiểm tra; đã dọn dữ liệu QA. Chưa kiểm chứng production. Không commit/push.

## Đồng hồ và giảm dựng lại giao diện — 15/09/2026
- Đồng hồ HH:mm:ss cạnh nút đổi màu, dùng timer đã có.
- Bỏ dropdown “Chức năng khác…” trên các tab. Các form chuyên sâu vẫn mở từ Cài đặt → Công cụ quản lý hoặc bấm tên tài khoản → Tài khoản và công cụ (theo quyền).
- Chỉ dựng tab đang xem khi dữ liệu liên quan đổi; tab khác cập nhật khi mở. Không dựng lại lúc người dùng nhập/chọn hoặc khi trang ẩn. Các badge cập nhật độc lập.
- Browser local: đồng hồ chạy, không còn dropdown cũ, cùng DOM dòng khách được giữ sau hơn hai chu kỳ polling, 51 font và công cụ vẫn truy cập được; không có lỗi JavaScript. 76/76 tests đạt. Chưa đo hiệu năng với dữ liệu production lớn.

## Manager và data chưa xử lý

Thay khối mục tiêu bằng bảng data chưa xử lý theo Team/Leader/Sale. Admin xem toàn bộ, Leader xem Team, Manager chỉ xem hệ thống Admin phân công. Bổ sung form chức vụ MANAGER và chọn Manager trên Leader; dùng lại nghiệp vụ Leader theo Team được chọn, kiểm tra quyền MANAGER thật tại backend. Xem `MANAGER-ROLE.md` để biết phạm vi, cách phân công, migration và kiểm chứng 84/84 test. Không commit/push.

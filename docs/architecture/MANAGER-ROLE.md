# Manager và data chưa xử lý — 15/09/2026

## Giao diện

Khối mục tiêu doanh số ở Tổng quan được thay bằng bảng **Data chưa xử lý**: khách, Team, Leader, Sale phụ trách, tình trạng và nút xem hồ sơ. Bảng cuộn ngang trên điện thoại, giới hạn chiều cao để không kéo dài dashboard.

Trong phiên bản này, “chưa xử lý” gồm khách chưa phân Sale, chưa nhận data hoặc còn trạng thái NEW; loại trừ ARCHIVED, LOST và PAID. Khách CONTACTED nhưng chưa phân lại cũng nằm trong danh sách. Tình trạng phân biệt chưa phân Leader, chờ phân/lại, chờ Sale nhận và chưa liên hệ. Hồ sơ Sale chưa nhận vẫn bị kiểm tra quyền theo luồng cũ.

Admin xem danh sách toàn bộ; Leader xem trong Team. Manager xem bảng chưa xử lý tổng hợp các Leader được giao. Các màn hình thao tác như khách/đơn/chia data dùng Team đang chọn. Đội ngũ của Manager hiển thị nhân sự và chỉ số trong toàn bộ hệ thống được giao.

## Phân công

1. Admin vào Đội ngũ, duyệt tài khoản đăng ký hoặc sửa tài khoản có đăng nhập, chọn **MANAGER**. Manager không cần Team riêng.
2. Sửa một Leader, chọn **Manager quản lý (Admin phân công)** rồi lưu. Có thể giao nhiều Leader cho một Manager. Sale đi theo Leader trực tiếp và Team của mình.
3. Manager đăng nhập có giao diện và các thao tác Leader. Khối **Hệ thống được Admin phân công** cho chọn Team để quản lý; tài khoản giữ nhãn MANAGER.
4. Chưa giao Leader: Manager không có dữ liệu khách/đơn/nhân sự đội nào. Chỉ còn hồ sơ cá nhân và danh mục chung mà Leader vốn có quyền xem.
5. Chọn “Chưa giao Manager” trên Leader để bỏ phân công. Backend áp dụng phạm vi mới ở yêu cầu tiếp theo, kể cả token cũ. Màn hình cập nhật khi đồng bộ; yêu cầu ghi ngoài phạm vi bị từ chối ngay.

Chỉ Admin đổi chức vụ hoặc phân hệ thống cho Manager. Manager không tự thêm Team vào phạm vi, sửa tài khoản người khác, cấu hình toàn cục hoặc xác nhận thanh toán. Manager dùng được form phân Sale và tỷ trọng nhận data trong Team được giao. Thay đổi role từ Sale/Leader lên Manager bị chặn nếu còn khách hoặc Sale cần bàn giao; không tự chuyển mất dữ liệu.

Tạo nhân sự thủ công chưa có login không tự tạo mật khẩu. Để đăng nhập thật, dùng tài khoản đã đăng ký/đã có login, sau đó Admin cấp vai trò Manager. Không tạo thêm tài khoản hay mật khẩu production mặc định trong đợt này.

## Lưu trữ và triển khai

- `users.role` thêm MANAGER vào cuối ENUM, giữ thứ tự và dữ liệu vai trò cũ.
- `Leader.managerId` lưu trong bản ghi thành viên của `crm_documents`; đọc cùng `users`, lưu cùng giao dịch và lịch sử sẵn có. Không tạo kho lưu mới, không đổi ID khách/đơn.
- Backend `crm-data.cjs` lấy quan hệ từ dữ liệu server mỗi lần đọc/ghi. Không tin `teamId`, `leaderId` hoặc danh sách quyền do client tự gửi.
- Runtime dùng nhóm chức năng Leader cho Manager, giữ ID thật và `actualRole=MANAGER` cho giao diện/nhật ký. API vẫn xác thực bằng vai trò MANAGER thật trong users; không giả token Leader. Hồ sơ và điểm danh dùng ID Manager.
- Deploy đồng thời backend/frontend và khởi động lại Node. `prepare()` tự mở rộng ENUM; có lệnh thủ công tại `database/manager-role.sql`. Không import lại toàn bộ schema hay reset dữ liệu.
- Chưa chạy trực tiếp migration trên MySQL hosting trong phiên này. Nếu tài khoản DB không có quyền ALTER, chạy SQL bằng tài khoản quản trị DB trước khi khởi động app với quyền DDL phù hợp.
- Không commit/push/deploy hosting trong đợt này.

## Kiểm chứng

84/84 test đạt: dữ liệu cũ/persistence, đọc đúng nhiều Leader được giao, không lộ đội khác dù trùng mã Team, từ chối tự cấp quyền và xác nhận tiền, lưu tỷ trọng không đè đội khác, thu hồi quyền phiên cũ, kiểm tra managerId, hồ sơ/điểm danh đúng ID.

Trình duyệt trên server kiểm thử riêng: Admin đổi tài khoản demo thành Manager, gán Leader; Manager đăng nhập, thấy phạm vi, mở form tỷ trọng và lưu; hồ sơ hiển thị đúng Manager. Kiểm tra bảng khách chưa xử lý và ảnh điện thoại 390px; không ghi nhận lỗi JS trong luồng thử. Dữ liệu thử ở server riêng không nhập vào bản demo người dùng.

Cổng 4173 đã khởi động backend mới sau khi giữ snapshot RAM và đối chiếu các collection. Việc này bảo toàn lần khởi động hiện tại; demo vẫn là RAM, không thay thế MySQL/backup hosting. Không sử dụng snapshot demo để triển khai production.

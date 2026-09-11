# 00 — CONSTRAINTS BRIEF (đọc trước khi thiết kế)

Nguồn: MASTER SPECIFICATION – CRM CORE PLATFORM (bản chốt kiến trúc).
Mọi tài liệu trong `docs/architecture/` PHẢI tuân thủ file này. Nếu phát hiện xung đột
trong yêu cầu, ghi vào mục "Câu hỏi cần xác nhận" của tài liệu — KHÔNG tự quyết định
thay người dùng tại các điểm đã bị khóa.

## A. QUY TẮC KHÓA (LOCKED)

1. Chỉ có ĐÚNG 3 role nghiệp vụ: `ADMIN`, `LEADER`, `SALE`.
2. `ADMIN` là quyền cao nhất toàn hệ thống. KHÔNG tạo `SUPER_ADMIN`, `OWNER`,
   `MANAGER`, `STAFF`, `EDITOR`, `LEADER_ADVANCED` hay role hệ thống nào khác.
3. Khác biệt quyền chi tiết xử lý bằng Permission + Permission Override + Data Scope.
   Tuyệt đối không sinh thêm Role. Mỗi nhân sự phải có một tài khoản và một phiên đăng nhập
   riêng; không dùng một tài khoản chung rồi cho phép chuyển qua lại giữa ADMIN/LEADER/SALE.
4. Data Scope tối thiểu: `ALL` / `TEAM` / `OWN` / `NONE`.
   Mặc định: ADMIN = ALL, LEADER = TEAM, SALE = OWN.
5. CRM là hệ thống trung tâm độc lập: database riêng, backend/API riêng.
6. Website / Landing Page / Mobile App / hệ thống ngoài KHÔNG truy cập DB trực tiếp.
7. KHÔNG fork/copy backend CRM cho từng website. Một CRM Core phục vụ N website qua
   API / SDK / Webhook / Tracking.
8. KHÔNG hard-code: lead source, customer status, API key, secret, password, website,
   campaign, hoặc bất kỳ business rule có thể cấu hình.
9. Mọi thao tác quan trọng phải ghi Audit Log.
10. Ưu tiên soft delete / archive. Không hard delete dữ liệu có lịch sử nghiệp vụ.
    Order / Payment / Audit history không được xóa tùy tiện.
11. Định hướng bắt buộc: API-FIRST + MODULAR + SCALABLE + MULTI-SOURCE +
    MULTI-WEBSITE + MULTI-ROLE (3 role) + AUDITABLE + EXTENSIBLE.
12. Giai đoạn đầu: **Modular Monolith** với biên module rõ ràng. Chỉ tách service khi có
    lý do thực tế về tải / đội ngũ / deployment / isolation.
13. Phân quyền phải kiểm tra ở BACKEND. Ẩn menu frontend chỉ là UI, không phải bảo mật.
14. KHÔNG tạo số liệu giả (traffic, ad spend, KPI) khi chưa có tracking/integration thật.
15. Duplicate Detection (cùng một người) và Idempotency (cùng một request gửi lặp) là
    HAI cơ chế khác nhau, không được dùng thay cho nhau.
16. Customer Status và Order Status ĐỘC LẬP với nhau.
17. Không chỉ lưu `customer.source = X`. Phải có Source/Touchpoint History theo thời gian
    để hỗ trợ First / Last / Multi-touch Attribution.
18. Payment là giao dịch tiền; Revenue là lớp ghi nhận/tổng hợp sinh ra hoặc đối soát từ
    Order/Payment. Không để hai bên thành hai nguồn nhập số độc lập.
19. **GIAI ĐOẠN NÀY CHỈ THIẾT KẾ — KHÔNG VIẾT CODE ỨNG DỤNG.** Sản phẩm là tài liệu
    markdown. Được phép dùng bảng, DDL, interface, YAML/JSON snippet như *artifact thiết
    kế*; KHÔNG tạo file source của app, không scaffold project, không cài dependency.

## B. MÔ HÌNH ROLE & PERMISSION

- `users` là thực thể người dùng duy nhất. Leader/Sale được biểu diễn bằng Role +
  Team membership; KHÔNG tạo bảng nhân sự riêng chỉ vì role.
- Permission dạng `<module>.<action>`: `customer.view/create/update/assign/export/merge`,
  `order.view/create/update`, `payment.view`, `report.view`, `website.manage`,
  `marketing.manage`, `blog.manage`, `integration.manage`, `system.manage`...
- Không rải `if (role === 'ADMIN')` khắp code. Phải có MỘT Authorization/Policy layer
  thống nhất ở backend: permission check + data-scope filter + record-level guard.
- Sale không được bypass Data Scope bằng cách đổi ID trên URL/API.

## C. PHẠM VI MODULE PHẢI GIỮ TRONG KIẾN TRÚC

Auth/RBAC · Team · Customer · Lead · Data Pool & Assignment · Follow-up/Task ·
Customer Status (+History) · Notes · Timeline · Order · Order Item · Product · Payment ·
Revenue · Website · Domain · Landing Page · Lead Source · Campaign · Tracking Link ·
UTM · Visitor/Session/PageView/TrackingEvent · Attribution · CMS (Post/Category/Tag) ·
Media Library · API Client · API Key · Webhook (in/out) · Integration Logs ·
Notification · Audit Log · Import/Export · Reports/Analytics · Settings ·
Kế toán (placeholder "Đang cập nhật").

Phase sau (architecture phải mở đường, không cần build ở MVP): Ads API, Automation,
AI Scoring, Affiliate, Commission, Accounting/Ledger, Mobile App, Email/SMS/Zalo/
Telegram/WhatsApp.

## D. BỐI CẢNH REPO HIỆN TẠI (đã kiểm tra)

Thư mục `c:\Users\ADMIN\Desktop\crm nvt agrncy` hiện có các file rời của một app
Next.js + React + TypeScript + Tailwind (đã lưu tại
`docs/archive/legacy-next-fragments/` với đuôi `.txt`). Đây là **prototype
frontend-only**, state giữ trong React + `localStorage` (`tcn-crm-db-v1`), không có
backend/DB. Không phải git repo.

Điểm quan trọng cho thiết kế:
- Prototype đang dùng `CrmRole = 'SUPER_ADMIN' | 'ADMIN' | 'LEADER' | 'SALE' | 'USER'`
  → **VI PHẠM** quy tắc 3-role. Kiến trúc mới phải chuẩn hóa về đúng ADMIN/LEADER/SALE
  và nêu rõ đường di trú cho `SUPER_ADMIN`/`USER` đang tồn tại trong prototype.
- Prototype dùng số điện thoại làm khóa liên kết nhân sự (`leaderPhone`,
  `assignedSalePhone`, `memberPhones`) → hệ thống thật phải dùng `user_id` (UUID) làm
  khóa quan hệ, phone chỉ là thuộc tính định danh liên hệ.
- Prototype đã có sẵn ý tưởng đúng cần giữ: status cấu hình được (`customer_statuses`),
  history append-only, timeline nhiều loại event, notification theo status, audit log,
  data scope theo team.

# 00 — SOURCE SPEC DIGEST (§1–§81)

Bản số hóa của MASTER SPECIFICATION – CRM CORE PLATFORM, giữ nguyên số mục gốc để mọi
tài liệu thiết kế có thể trích dẫn dạng `§57`. Đây là **nguồn yêu cầu** — không phải
thiết kế. Đọc cùng `00-constraints.md`.

> LƯU Ý: bản spec người dùng gửi bị cắt ở cuối §81 (câu "Không để Controller…").
> Phần thiếu được đánh dấu `[TRUNCATED]` và ghi vào "Câu hỏi cần xác nhận".

---

## §1 MỤC TIÊU

CRM Core Platform độc lập, dùng lâu dài làm hệ thống trung tâm cho nhiều Website,
Landing Page, App, hệ thống ngoài.

Quản lý: User · Admin · Leader · Sale · Team · Khách hàng · Lead · Data khách hàng ·
Data Pool · Phân Data · Lịch sử phân/chuyển Data · Trạng thái khách hàng · Lịch sử trạng
thái · Ghi chú chăm sóc · Follow-up/Task/Reminder · Customer Timeline · Đơn hàng · Sản
phẩm · Thanh toán · Doanh thu · Marketing · Website · Domain · Landing Page · Tracking
Link · UTM · Visitor/Session/PageView/TrackingEvent · Traffic · Campaign · Attribution ·
API Client · API Key · API Integration · Webhook in/out · Integration Logs · Tin tức/
Blog/CMS · Category/Tag · Media Library · Notification · Audit Log · Import/Export ·
Reports/Analytics · Cấu hình hệ thống. Kế toán = mở rộng sau. Ads API, Automation, AI,
Affiliate, Commission = phase sau.

Mục tiêu dài hạn: MỘT CRM Core phục vụ Website A/B/C, nhiều Landing Page, nhiều Brand,
nhiều Source, nhiều Campaign, nhiều Integration — không viết lại CRM. Website mới chỉ
cần đăng ký Website + API Client + API Key, cấu hình endpoint/SDK/tracking.

## §2 KIẾN TRÚC TỔNG QUAN

Luồng Marketing/Sales chuẩn:
`Ads(FB/TikTok/Google/YouTube)/Organic/Referral/Affiliate/Direct/Custom → Website/
Landing/Tracking Link → Visitor/Session/Tracking Event → Form/API/Webhook → CRM Core →
Lead → Customer → Admin phân Data → Leader → Sale → Status/Note/Follow-up → Order →
Payment → Revenue → Sales+Marketing Analytics`

Kiến trúc ứng dụng: `CRM Admin Frontend → CRM Backend API → Domain/Application Modules
→ Database + Cache/Queue/Object Storage khi cần`.

Hệ thống ngoài: `Website/Landing/Mobile/External → API Client/SDK/Tracking Script/
Webhook → API Gateway/CRM Backend → Database`.

Nguyên tắc: FE không truy cập DB; website ngoài không truy cập DB; phân quyền +
validation + business rule ở Backend; module tách theo domain; ưu tiên Modular Monolith;
không tạo microservice chỉ để "trông scalable".

## §3 PHÂN QUYỀN — CHỈ 3 ROLE

**ADMIN** — quyền cao nhất toàn hệ thống, là quyền quản trị tối cao (KHÔNG có
SUPER_ADMIN riêng). Xem/quản lý toàn bộ dữ liệu, module, cấu hình: User, Leader, Sale,
Team, Permission, Website, Marketing, Sales, CMS, API, Webhook, Audit, Settings.
Data Scope mặc định = `ALL`.

**LEADER** — quản lý đội Sale trong phạm vi được giao; nhận data từ Admin; phân data cho
Sale; xem Customer/Lead/Order/Revenue/Task/Report của Team mình; không xem Team khác trừ
khi Admin cấp quyền cụ thể. Data Scope mặc định = `TEAM`.

**SALE** — chỉ xem/xử lý Customer/Lead được phân cho mình; không xem khách của Sale khác;
không xem DB toàn hệ thống; có thể cập nhật Status/Note/Follow-up, tạo Order nếu có
permission. Data Scope mặc định = `OWN`.

Bắt buộc: RBAC + Permission + Data Scope. Scope tối thiểu `ALL/TEAM/OWN/NONE`.
Ví dụ permission: `customer.view`, `customer.create`, `customer.update`,
`customer.assign`, `customer.export`, `customer.merge`, `order.view`, `order.create`,
`order.update`, `payment.view`, `report.view`, `website.manage`, `marketing.manage`,
`blog.manage`, `integration.manage`, `system.manage`.
Cấm rải `if role == ...`; phải có policy/authorization layer thống nhất. Khác biệt quyền
giữa 2 user cùng role → Permission Override / Data Scope, KHÔNG tạo role mới.

## §4 ADMIN — QUẢN LÝ KHÁCH HÀNG

Trường hiển thị: Customer ID · Họ tên · SĐT · Email/Gmail · Nguồn khách · Landing Page ·
Campaign · Tracking Link · UTM · Ngày đăng ký · Sale phụ trách · Leader phụ trách ·
Trạng thái hiện tại · Số đơn hàng · Tổng doanh thu · Ghi chú · Lịch sử chăm sóc · Lịch sử
nguồn khách · Lịch sử phân data.

Hành động: thêm · sửa · xóa (nếu được phép) · Import Excel/CSV · Export · tìm kiếm ·
lọc · phân loại · giao khách cho Leader · chuyển khách · xem timeline · xem lịch sử trạng
thái · xem lịch sử nguồn · xem doanh thu của khách.

## §5 ADMIN — QUẢN LÝ NHÂN SỰ

Xem/tạo/sửa User · khóa/mở khóa tài khoản · reset mật khẩu theo quy trình an toàn · gán
Role ADMIN/LEADER/SALE · chuyển Role · gán User vào Team · chuyển Team · cấp/thu hồi
Permission Override · xem lịch sử Role · lịch sử Team · lịch sử đăng nhập & hoạt động
(nếu bật). Một người = một User; Leader/Sale = Role + Team membership, KHÔNG tạo bảng
nhân sự riêng. Mọi thay đổi Role/Team/Permission/trạng thái tài khoản → Audit Log.

## §6 TEAM MANAGEMENT

`teams`: Team ID · Tên · Code · Leader chính · Status · Created At · Updated At.
`team_members`: Team ID · User ID · Joined At · Left At · Is Active.
Admin: tạo/sửa/bật-tắt Team · gán Leader · gán Sale · chuyển Sale giữa Team · xem lịch sử
thay đổi thành viên. **Không làm mất lịch sử khi chuyển Team.**

## §7 ADMIN DASHBOARD

KPI: Tổng Customer · Customer mới hôm nay · mới tháng này · Tổng Lead · Lead mới hôm nay ·
Data chưa phân · Follow-up quá hạn · Tổng đơn · Đơn hôm nay · Payment đã ghi nhận ·
Doanh thu hôm nay/tháng/tổng · Tổng Product · Website · Landing Page · Campaign · Leader ·
Sale · Traffic/Visitor hôm nay (nếu tracking bật).

Biểu đồ: Sales/Customer Funnel · Doanh thu theo ngày · Customer theo ngày · Lead theo
ngày · Order theo ngày · Traffic theo ngày · Lead theo Source · Revenue theo Source/
Website/Campaign/Sale/Leader-Team · Conversion theo Landing Page · Status Distribution.

Alert: Data chưa phân · Lead chưa liên hệ · Follow-up quá hạn · Integration lỗi ·
Webhook lỗi · API Key sắp hết hạn.

Filter: Hôm nay · Hôm qua · 7 ngày · 30 ngày · Tháng này · Tháng trước · Custom Range ·
Website · Source · Campaign · Leader · Sale.

## §8 MENU ADMIN

Dashboard · CRM (Khách hàng, Leads, Data Pool, Follow-up/Tasks, Import Data, Customer
Timeline/Activity) · Sales (Đơn hàng, Thanh toán, Doanh thu, Sản phẩm) · Marketing (Tổng
quan, Lead Sources, Campaigns, Tracking Links, Traffic, Attribution, Analytics) ·
Websites (Websites, Domains, Landing Pages, Website Analytics) · Content (Tin tức/Blog,
Categories, Tags, Media) · Team (Leader, Sale, Teams, Phân Data, Roles & Permissions) ·
Reports (CRM Funnel, Sale Performance, Team Performance, Orders, Revenue, Marketing) ·
Integrations (API Clients, API Keys, Webhooks, Ad Platforms, Integration Logs) ·
Notifications · Audit Logs · Kế toán (Đang cập nhật) · Settings.
Có thể nhóm lại ở UI nhưng không được làm mất module nghiệp vụ.

## §9 MODULE ĐƠN HÀNG

Trường: Order ID · Customer · Phone · Email · Product · Quantity · Price · Total · Sale ·
Leader · Status · Payment Method · Created Date · Paid Date · Note.
Trạng thái: `Pending` · `Confirmed` · `Processing` · `Paid` · `Completed` · `Cancelled` ·
`Refunded`. Có Search/Filter/Sort/Pagination/Export/Detail/Edit.

## §10 MODULE SẢN PHẨM

Tạo/sửa/xóa/bật-tắt · sửa giá · giá KM · tên · mô tả · hình ảnh · banner.
Trường: Product ID · Product Code · Name · Price · Sale Price · Description · Image ·
Banner · Status · Created At · Updated At.

## §11 MEDIA LIBRARY

Upload ảnh/video · nhập URL ảnh/video · xóa · preview · copy URL · chọn lại media đã
upload. Mọi nơi cần hình ảnh phải có `[Upload ảnh] [Chọn ảnh] [Nhập URL ảnh]`.
**Không tạo hệ thống upload riêng cho từng module.**

## §12 TIN TỨC / BLOG / CMS

Tạo/sửa/archive-soft-delete/publish/unpublish/draft/schedule publish · quản lý Category ·
Tag · chọn một hoặc nhiều Website được phép hiển thị bài · preview.
Post: Post ID · Website ID hoặc quan hệ Post-Website · Title · Slug · Excerpt ·
Thumbnail · Banner · Content · Category · Tags · Author · Status · Published At ·
Scheduled At · Created At · Updated At · Deleted At.
SEO: Meta Title · Meta Description · Canonical URL · Robots Index · Robots Follow · OG
image. Media trong bài: upload / chọn từ Media Library / nhập URL.
Slug unique trong phạm vi Website hoặc có chiến lược unique rõ ràng. CMS không phụ thuộc
một website cụ thể; website ngoài đọc qua API có scope phù hợp.

## §13 MODULE MARKETING

Marketing là module trung tâm, không chỉ để xem thống kê: **trung tâm quản lý nguồn khách
+ tracking + landing page + API + attribution + analytics**.
Luồng: `Ads/Organic/Referral → Landing/Website/Tracking Link → khách truy cập → khách nhập
thông tin → API/Webhook → CRM → Lead → Customer → Leader → Sale → Order → Revenue →
Marketing Analytics`.

## §14 LANDING PAGE INTEGRATION

CRM kết nối nhiều Landing Page (A/B/C/D...). Khách nhập Tên · SĐT · Email · Ghi chú →
Landing gửi `POST /api/v1/leads` → CRM nhận và lưu ngay.

## §15 DỮ LIỆU LEAD

Lead ID · Customer ID (nếu đã tồn tại) · Name · Phone · Email · Source · Medium ·
Campaign · Content · Term · Landing Page · Tracking Link · UTM · Referrer · URL ·
Timestamp · IP (nếu hợp pháp & cần thiết) · Device · Status · Assigned Leader ·
Assigned Sale.

## §16 QUẢN LÝ LANDING PAGE

Add · Edit · Archive/Disable · Enable · nhập URL · đặt tên · gán Website · tạo/gán API
Client + API Key · xem API Status · Test API · xem Traffic/Lead/Orders/Revenue/Conversion.
Trường: Landing Page ID · Website ID (nullable nếu độc lập) · Name · Code · URL · Status ·
API Client ID · Created At · Updated At.
CRM **không bắt buộc** là visual Landing Page Builder ở giai đoạn đầu — mục tiêu là đăng
ký, kết nối, tracking, phân tích.

## §17 WEBSITE MANAGEMENT — MULTI-WEBSITE

Bắt buộc có thực thể Website cấp cao. Website đại diện: website chính · website thương
hiệu · website bán sản phẩm · website Trading · website Social · microsite · web app.
Trường tối thiểu: Website ID · Name · Code · Primary Domain · Default Language ·
Timezone · Logo Media ID · Favicon Media ID · Status · Created At · Updated At.
Quan hệ: Domains · Landing Pages · Posts/Blog · Products · Leads · Customers source/
touchpoint · Orders · Campaigns · Tracking Links · API Clients · Analytics.
Dashboard Website: Traffic · Leads · Conversion · Orders · Revenue · Top Sources ·
Top Campaigns · Top Landing Pages.
Website mới KHÔNG được yêu cầu copy backend CRM.

## §18 DOMAIN MANAGEMENT

`website_domains`: id · website_id · domain · type (`PRIMARY`/`ALIAS`/`SUBDOMAIN`) ·
is_verified · verification_method · status · created_at.
Dùng để: xác định Website từ request · CORS allowlist · tracking · attribution · CMS
publishing · API/Webhook rules.

## §19 API CLIENT, API KEY & API MANAGEMENT

`api_clients`: id · website_id (nullable) · name · type · status · created_at · updated_at.
Một API Client có nhiều API Key (Development/Production/Rotation).
API Key phải có: Authentication · Validation · Permission Scope · Rate Limit · Logging ·
Error Handling · Duplicate Detection · Idempotency · Versioning · Revocation ·
Expiration (nếu cần).
KHÔNG hard-code API Key. KHÔNG lưu plaintext secret để xem lại tùy ý. Ưu tiên lưu:
`key_prefix` · `key_hash` · `scopes` · `last_used_at` · `expires_at` · `revoked_at` ·
`created_by`. Scope ví dụ: `lead:create` · `customer:read` · `product:read` ·
`order:create` · `blog:read` · `webhook:send`. API dạng `/api/v1/...`.
Key đầy đủ chỉ hiển thị tại thời điểm tạo.

## §20 LEAD SOURCE

Admin tự tạo nguồn khách — KHÔNG hard-code. Ví dụ nhóm: Social (TikTok, Facebook,
Instagram, Zalo, Telegram) · Search (Google Ads, Google Organic, Bing) · Video (YouTube
Ads, YouTube Organic) · Website (Website Organic, Website Referral, Direct) · Landing
Page (A/B/C) · Referral (Affiliate, Partner, Referral Link).

## §21 PHÂN LOẠI NGUỒN

Mỗi Source thuộc nhóm traffic: `PAID` · `ORGANIC` · `REFERRAL` · `DIRECT` · `OTHER`.
Ví dụ: TikTok Ads → Source TikTok / Type Social / Traffic Paid. Google Organic → Source
Google / Type Search / Traffic Organic. Partner ABC → Type Referral / Traffic Referral.

## §22 TRACKING LINK

Admin tạo Tracking Link, VD campaign "TikTok Campaign 01" → `domain.com/go/tiktok01`.
CRM lưu: Link ID · Link · Source · Campaign · Destination · Click · Unique Visitor ·
Lead · Order · Revenue. Admin biết link nào ra nhiều khách / nhiều đơn / nhiều doanh thu.

## §23 UTM TRACKING

Hỗ trợ `utm_source` · `utm_medium` · `utm_campaign` · `utm_content` · `utm_term`.
CRM phải lưu các thông tin này cùng Lead.

## §24 THỐNG KÊ NGUỒN KHÁCH

Marketing Dashboard thống kê tổng Lead và tỉ trọng theo từng source (ví dụ TikTok 35%,
Facebook 25%, Google Ads 15%, YouTube 10%, Website Organic 8%, Referral 5%, Other 2%).
Hiển thị: Donut · Pie · Bar · Table.

## §25 THỐNG KÊ LANDING PAGE

Tổng Landing Page · đang hoạt động · Traffic · Leads · %Leads · Orders · Conversion ·
Revenue · Revenue/Lead. Admin so sánh nhiều Landing Page với nhau.

## §26 MARKETING FUNNEL

`Traffic → Landing Page → Lead → Qualified Lead → Assigned Sale → Order → Paid Order →
Revenue`, có số lượng và tỷ lệ chuyển đổi ở từng bước.

## §27 QUẢNG CÁO & API ADS

Thiết kế sẵn để kết nối Facebook/TikTok/Google/YouTube Ads và nền tảng khác. Dữ liệu:
Spend · Impressions · Clicks · Traffic · Leads · Orders · Revenue. Sau đó tính CPL · CPA ·
ROAS · Conversion Rate · Revenue. **Chưa kết nối API thì KHÔNG tạo số liệu giả.**

## §28 MULTI-SOURCE CUSTOMER

Một khách đến từ nhiều nguồn (VD First Touch TikTok → Landing A → Lead → Google Ads →
Landing B → Order). CRM phải lưu lịch sử nguồn; DB hỗ trợ mở rộng First Touch / Last
Touch / Multi-touch Attribution.

## §29 CHỐNG TRÙNG KHÁCH

Ưu tiên kiểm tra định danh đã chuẩn hóa: (1) Phone, (2) Email. Phone normalize trước khi
so sánh (bỏ khoảng trắng/ký tự định dạng, chuẩn hóa country code theo rule cấu hình).
Email tối thiểu lowercase + trim. Không tạo Customer trùng — thay vào đó: tạo Lead mới
nếu là lead/opportunity mới · gắn Lead vào Customer đã tồn tại · ghi Customer Source/
Touchpoint History · cập nhật Last Touch.
Duplicate Detection ≠ Idempotency. Không tự merge khi độ tin cậy thấp → đưa vào hàng chờ
review.

## §30 CUSTOMER MERGE

Quy trình: chọn Customer chính → chọn Customer trùng → preview dữ liệu hợp nhất → cảnh báo
xung đột → xác nhận → merge transactionally.
Phải bảo toàn/chuyển: Leads · Sources/Touchpoints · Status History · Notes · Tasks/
Follow-up · Assignments · Orders · Payments · Timeline/Events.
`customer_merge_history`: primary_customer_id · merged_customer_id · merged_by · reason ·
snapshot/reference · created_at. Không được làm mất khả năng audit.

## §31 LEADER

Xem data Admin giao · nhận data từ file · nhận data qua API (nếu được cấp) · xem Customer
thuộc phạm vi · phân data cho Sale · xem Sale dưới quyền · xem đơn hàng/doanh thu của
Sale · xem tổng doanh thu Team · xem trạng thái khách của Sale · xem lịch sử chăm sóc ·
xem báo cáo theo trạng thái. **Leader không được xem data ngoài phạm vi.**

## §32 CHIA DATA / DATA POOL / REASSIGNMENT

Admin giao Data cho Leader → Leader chia cho Sale. Bắt buộc có Data Pool hoặc cơ chế
tương đương cho data chưa phân và data đang xử lý.
Trạng thái phân data: `UNASSIGNED` · `ASSIGNED_TO_LEADER` · `ASSIGNED_TO_SALE` ·
`WORKING` · `RECYCLED` · `CLOSED`.
Admin: chọn nhiều Customer/Lead · assign batch cho Leader · thu hồi · reassign · xem data
chưa phân. Leader: nhận Data · chọn nhiều · assign cho Sale · reassign trong Team ·
thu hồi (theo permission).
Mở rộng: Round Robin · Capacity-based · Rule-based · Auto assignment.
Assignment History bắt buộc: Customer/Lead · người giao · người nhận · Leader · Sale cũ ·
Sale mới · From Team · To Team · thời gian · lý do. **Không overwrite lịch sử.**

## §33 DATA RECYCLING

Hỗ trợ thu hồi & tái phân Data không mất lịch sử. Lý do: Sale nghỉ việc · Sale không xử lý
trong SLA · khách không phản hồi lâu · Leader/Admin muốn tái phân · sai Team · duplicate/
merge. Data recycle có thể về Data Pool hoặc chuyển trực tiếp cho Leader/Sale khác tùy
permission. Mọi lần recycle/reassign → Assignment History + Audit Log.

## §34 SALE

Chỉ xem khách được Leader phân cho mình. Không xem khách của Sale khác, data của Leader
khác, DB toàn hệ thống.
Được: xem khách của mình (tên, phone, email, source, trạng thái, notes, order, revenue,
timeline, lịch sử chăm sóc) · cập nhật trạng thái · thêm ghi chú · tạo đơn hàng (nếu có
quyền).
Dashboard Sale: Khách hàng của tôi · Khách mới · Khách theo trạng thái · Đơn hàng · Doanh
thu hôm nay/tháng/tổng.

## §35 CẬP NHẬT TRẠNG THÁI KHÁCH HÀNG (BẮT BUỘC)

`SALE → UPDATE CUSTOMER STATUS → CRM DATABASE → LEADER THẤY + ADMIN THẤY`.
**Không tạo dữ liệu trạng thái riêng cho từng Role.**

## §36 DANH SÁCH TRẠNG THÁI KHÁCH

Admin tự cấu hình. Mặc định có thể gồm: (1) Lead mới (2) Đã liên hệ (3) Đang tư vấn
(4) Đã tạo tài khoản (5) Tạo tài khoản thành công (6) Đã xác minh/KYC (7) Đã nạp tiền
(8) Đã mua hàng (9) Đang chăm sóc (10) Không phản hồi (11) Khách từ chối (12) Không có
nhu cầu (13) Khách hàng tiềm năng (14) Hoàn thành (15) Khác.
KHÔNG hard-code. Admin: tạo · sửa · xóa (nếu phù hợp) · bật/tắt · sắp xếp thứ tự.

## §37 SALE CẬP NHẬT TRẠNG THÁI

Customer Detail có: tên khách · SĐT · email · Sale phụ trách · dropdown Trạng thái · Ghi
chú. Luồng ví dụ: `Lead mới → Đã liên hệ → Đang tư vấn → Đã tạo tài khoản → Tạo tài khoản
thành công → Đã xác minh/KYC → Đã nạp tiền → Đã mua hàng`.

## §38 LEADER VÀ ADMIN XEM TRẠNG THÁI

Sale cập nhật → Leader thấy ngay (Khách hàng / Sale / Trạng thái), Admin thấy cùng dữ
liệu. Không cần Sale báo cáo thủ công.

## §39 REAL-TIME UPDATE

Nếu có thể: WebSocket · Server-Sent Events · Polling. Nếu MVP chưa real-time thì dữ liệu
vẫn phải cập nhật ngay trên server và hiển thị sau refresh.

## §40 LỊCH SỬ TRẠNG THÁI

Không chỉ lưu trạng thái hiện tại — phải lưu toàn bộ lịch sử (VD 10:00 Lead mới → 10:30 Đã
liên hệ → 11:00 Đang tư vấn → 11:30 Đã tạo tài khoản → 12:00 Tạo tài khoản thành công).
Lưu: Customer ID · Status cũ · Status mới · người thay đổi · Role · thời gian · ghi chú ·
IP (nếu cần).

## §41 CUSTOMER TIMELINE

Customer Detail phải có Timeline gộp: Status · Assignment · Note · Order · Payment · API
Event · Customer Activity — hiển thị theo thời gian giảm dần kèm actor.

## §42 GHI CHÚ CHĂM SÓC

Sale thêm Note khi cập nhật trạng thái; ghi chú phải lưu vào Timeline.

## §43 FOLLOW-UP / TASK / REMINDER (BẮT BUỘC)

Trường: Task ID · Customer ID · Lead ID (nullable) · Assigned User ID · Type (`CALL`/
`MESSAGE`/`MEETING`/`FOLLOW_UP`/`CUSTOM`) · Title · Description/Note · Priority · Due At ·
Remind At · Status (`OPEN`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`/`OVERDUE`) · Completed
At · Created By · Created At · Updated At.
Dashboard Sale cần: Việc hôm nay · Việc sắp tới · Quá hạn · Khách cần gọi lại · Lead chưa
liên hệ. Task quan trọng phải xuất hiện trong Customer Timeline; có thể trigger
Notification khi đến hạn/quá hạn.

## §44 PHÂN QUYỀN CUSTOMER STATUS

SALE: xem/cập nhật trạng thái khách của mình · thêm ghi chú · xem lịch sử của mình ·
KHÔNG sửa khách của Sale khác · KHÔNG xóa/sửa lịch sử cũ.
LEADER: xem khách của Sale thuộc mình · xem trạng thái · xem lịch sử · cập nhật trạng thái
nếu Admin cấp quyền.
ADMIN: xem tất cả · cập nhật tất cả · cấu hình trạng thái · xem lịch sử · xem báo cáo.

## §45 THỐNG KÊ KHÁCH THEO TRẠNG THÁI

Admin/Leader thống kê tổng khách và số lượng theo từng trạng thái, kèm biểu đồ Status
Distribution · Funnel · Conversion.

## §46 BÁO CÁO THEO SALE / SALE PERFORMANCE

Chỉ số tối thiểu: Data được giao · Data mới · Chưa liên hệ · Đã liên hệ · Đang tư vấn ·
Qualified/Tiềm năng · Đã tạo tài khoản · KYC · Nạp tiền · Đã mua hàng · Orders · Revenue ·
Conversion Rate · Follow-up Open · Follow-up Overdue · Average First Response Time (nếu đủ
dữ liệu) · Response/Contact Rate (nếu định nghĩa được).
Dựa trên dữ liệu thật, KHÔNG tạo KPI giả. Filter: Date Range · Team · Leader · Sale ·
Source · Campaign · Website.

## §47 CUSTOMER STATUS KHÁC ORDER STATUS

Customer Status (Đã liên hệ / Đã tạo tài khoản / Đã nạp tiền / Đã mua hàng) và Order
Status (Pending / Paid / Completed / Cancelled) **phải độc lập**.

## §48 API CẬP NHẬT STATUS

`PATCH /api/v1/customers/{customer_id}/status` với body
`{ "status_id": "account_created_success", "note": "Khách đã tạo tài khoản thành công" }`.
Backend phải: (1) kiểm tra Authentication (2) Permission (3) Customer tồn tại (4) Sale có
quyền với Customer (5) cập nhật Status (6) tạo Status History (7) tạo Audit Log
(8) trigger Notification nếu cần (9) trả response chuẩn.

## §49 NOTIFICATION STATUS

Khi Sale cập nhật trạng thái quan trọng → Leader/Admin nhận notification (VD "Sale Nguyễn
vừa cập nhật Nguyễn Văn A → Tạo tài khoản thành công"). Cấu hình được: trạng thái nào cần
thông báo.

## §50 IMPORT DATA

Admin/Leader (nếu được cấp quyền) import Excel/CSV. Quy trình: `Upload → Preview →
Mapping Column → Validation → Duplicate Check → Import → Result`. **Không import trực tiếp
mà không kiểm tra.**

## §51 EXPORT DATA

Export Customers · Leads · Orders · Revenue · Marketing · Campaign · Traffic. Hỗ trợ CSV ·
Excel. Quyền export kiểm soát theo Role.

## §52 TRAFFIC / VISITOR TRACKING

Mô hình tách: `Visitor → Session → Page View → Tracking Event → Lead → Customer → Order`.
Dữ liệu: Visitor ID/pseudonymous identifier · Session ID · Website ID · Landing Page ID ·
Page URL · Referrer · Source · Campaign · Tracking Link · UTM · Timestamp · Device/browser
ở mức cần thiết · IP chỉ nếu hợp pháp và theo chính sách privacy.
Admin xem: Page Views · Unique Visitors · Sessions · Leads · Conversion Rate · Orders ·
Revenue · Source · Campaign · Landing Page · Website.
**Không tạo số Traffic giả khi chưa có tracking/integration.**

## §53 MARKETING ATTRIBUTION

Hỗ trợ (ít nhất về kiến trúc): First Touch · Last Touch · Multi-touch (phase nâng cao).
Không chỉ lưu `customer.source = X` — phải có Source/Touchpoint History theo thời gian.
Order nên có attribution snapshot/reference (Website · Lead · Source · Campaign · Landing
Page · Tracking Link) để biết bối cảnh tại thời điểm chuyển đổi.
Mục tiêu: Admin trả lời được khách lần đầu đến từ đâu, lần gần nhất từ đâu, Lead nào tạo
conversion, Campaign nào tạo Order, Website/Landing nào mang Revenue, Tracking Link nào
hiệu quả.

## §54 API INTEGRATIONS

MỘT module Integrations thống nhất — không tạo hai module trùng chức năng.
Quản lý: Website · Landing Page · Facebook · TikTok · Google · YouTube · Zalo · Telegram ·
Email/SMS/WhatsApp (phase phù hợp) · hệ thống ngoài · Custom API.
Trường: Integration ID · Name · Type · Provider · Website ID · API Client ID · Endpoint ·
Status · Last Sync · Last Success · Last Error · Request Count · Lead Count · Error Count ·
Created At · Updated At. Status: `Connected` · `Warning` · `Disconnected` · `Disabled`.
Secret/credential lưu bằng cơ chế bảo mật phù hợp, KHÔNG hard-code.

## §55 NOTIFICATION SYSTEM

Thông báo khi: Lead mới · Đơn hàng mới · Customer mới · Data mới được giao · Customer được
chuyển Sale · Role thay đổi · API lỗi · Integration mất kết nối · Trạng thái khách quan
trọng thay đổi.

## §56 AUDIT LOG

Lưu: User · Action · Module · Record ID · Old Value · New Value · IP · User Agent (nếu
cần) · Timestamp. Ví dụ: Product ABC, Old Price 100 → New Price 120, Changed By Admin.

## §57 DATABASE DỰ KIẾN — DOMAIN SCHEMA

Chuẩn hóa, có FK/index phù hợp, giữ lịch sử nghiệp vụ quan trọng. Tên bảng có thể điều
chỉnh theo convention của Tech Stack nhưng **domain phải được giữ**.

- **AUTH/USER/RBAC**: `users` `roles` `permissions` `user_roles` `role_permissions`
  `user_permission_overrides` `sessions|auth_sessions`.
  *Lưu ý role: seed/chính sách chỉ có ADMIN, LEADER, SALE. KHÔNG tạo SUPER_ADMIN.*
- **TEAM**: `teams` `team_members` `team_membership_history` (nếu cần tách lịch sử).
- **CUSTOMER**: `customers` `customer_contacts` `customer_statuses`
  `customer_status_history` `customer_notes` `customer_tasks` `customer_assignments`
  `customer_assignment_history` (hoặc assignment event model) `customer_sources`
  `customer_source_history` `customer_touchpoints` `customer_merge_history`.
- **LEAD**: `leads` `lead_events` `lead_duplicates|review_queue`.
- **WEBSITE**: `websites` `website_domains` `landing_pages`.
- **MARKETING**: `lead_sources` `campaigns` `tracking_links` `visitors`
  `tracking_sessions` `page_views` `tracking_events` `traffic_daily_aggregates`.
- **PRODUCT**: `products` `product_images` `product_websites`.
- **SALES**: `orders` `order_items` `payments` `revenues`.
- **CMS**: `posts` `categories` `tags` `post_tags` `post_websites` (hoặc website_id).
- **MEDIA**: `media`.
- **INTEGRATION**: `api_clients` `api_keys` `webhooks` `webhook_deliveries`
  `integration_logs` `idempotency_keys|idempotency_records`.
- **NOTIFICATION/AUDIT/SYSTEM**: `notifications` `activity_logs` `audit_logs`
  `system_events|outbox_events`.
- **IMPORT/EXPORT**: `import_jobs` `import_rows|staging` `import_errors` `export_jobs`.
- **PHASE SAU**: `ad_accounts` `ad_campaign_stats` `automation_rules` `automation_runs`
  `affiliates` `commissions` `accounting_entries|ledger` `ai_scores` `ai_interactions`.

Không bắt buộc tạo hết bảng phase sau ở MVP, nhưng architecture không được chặn.

## §58 RELATIONSHIP CHÍNH

`User → Role (ADMIN/LEADER/SALE only) → Team → Customer Assignment → Customer →
Lead/Status/Notes/Tasks/Timeline → Order → Order Items → Product → Payment → Revenue`
Website/Marketing: `Website → Domain/Landing Page → Source/Campaign/Tracking Link →
Visitor/Session/Event → Lead → Customer → Order Attribution`
CMS: `Website → Post → Category/Tags/Media`
Integration: `API Client → API Key → CRM API → Domain Modules`
Webhook: `Domain Event → Webhook Delivery → External System`

## §59 BẢO MẬT

Bắt buộc: Authentication · Authorization · RBAC · Data Scope · Password Hashing ·
Session/JWT strategy phù hợp · Secure Cookie · MFA-ready cho Admin · API Authentication ·
API Key hash/rotation/revocation · Rate Limiting · Idempotency cho write API quan trọng ·
Input Validation · Output Encoding · SQLi Protection · XSS Protection · CSRF (nếu phù hợp) ·
CORS policy theo Website/Domain đã đăng ký · Secure File Upload · Audit Log · Environment
Variables/Secret Manager · HTTPS · Encryption at rest (nếu hạ tầng hỗ trợ) · Backup/restore ·
Principle of Least Privilege · Logging không lộ secret.
Không được: hard-code Password/API Key/DB Credentials · cho Frontend truy cập DB · log
plaintext secret/token · cho Sale bypass Data Scope bằng đổi ID trên URL/API.
Security authorization phải test ở Backend/API.

## §60 FILE UPLOAD

Kiểm tra File Type · File Size · Extension · MIME Type · Filename · Storage Path. Đặc biệt
với Excel · CSV · Image · Video.

## §61 UI/UX

Phong cách Modern SaaS CRM: chuyên nghiệp · sạch · dễ dùng · responsive · desktop ưu tiên ·
Sidebar · Topbar · Dashboard · Table · Modal · Drawer · Notification.
Bảng cần: Search · Filter · Sort · Pagination · Column Selection · Export.
Form cần: Required Field · Validation · Loading · Error · Success · Confirmation.

## §62 KẾ TOÁN

Module Kế toán: **CHƯA TRIỂN KHAI**, chỉ hiển thị "Đang cập nhật". Không xây nghiệp vụ kế
toán ở MVP, nhưng architecture/database phải mở rộng được.

## §63 MENU THEO ROLE

ADMIN: như §8 (đầy đủ).
LEADER: Dashboard · Khách hàng · Data được giao/Data Pool trong phạm vi · Phân Data ·
Follow-up/Team Tasks (nếu có quyền) · Sale · Đơn hàng · Doanh thu · Trạng thái khách ·
Báo cáo Team.
SALE: Dashboard · Khách hàng của tôi · Follow-up/Tasks · Đơn hàng · Doanh thu (nếu được
hiển thị) · Trạng thái khách · Lịch sử chăm sóc.
Menu FE phản ánh Permission nhưng **Backend vẫn là lớp kiểm tra quyền cuối cùng**.

## §64 KHẢ NĂNG MỞ RỘNG

Kiến trúc phải cho phép bổ sung: Mobile App · Zalo · Telegram · Facebook · TikTok ·
Google · YouTube · Email Marketing · SMS · WhatsApp · AI Customer Care · AI Lead Scoring ·
Automation · Webhook · Payment · Accounting · Warehouse · Affiliate · Commission · CRM
Automation. Thêm chức năng KHÔNG được yêu cầu viết lại hệ thống. Thêm Website/Brand mới
KHÔNG được fork/copy CRM backend. Module mở rộng giao tiếp qua service/domain API rõ ràng
và event/webhook khi phù hợp.

## §65 API DESIGN

Version `/api/v1/`. Ví dụ: `POST /api/v1/leads` · `GET /api/v1/customers` ·
`GET /api/v1/customers/{id}` · `PATCH /api/v1/customers/{id}/status` ·
`POST /api/v1/customers/{id}/tasks` · `GET|POST /api/v1/orders` · `GET /api/v1/products` ·
`GET /api/v1/posts` · `GET /api/v1/marketing/sources` · `GET /api/v1/marketing/campaigns` ·
`GET /api/v1/marketing/analytics` · `POST /api/v1/tracking/events`.
API phải có: Authentication · Authorization · Permission/Data Scope · Validation ·
Pagination · Filtering · Sorting · Search · Error Response chuẩn · Request/Correlation ID ·
Logging · Rate Limiting · Idempotency cho write endpoint quan trọng · Versioning ·
OpenAPI/Swagger. Response/error cần convention nhất quán. Không expose database model
trực tiếp — dùng DTO/serializer/schema.

## §66 WEBHOOK

Inbound: `Website/Landing/External → Webhook/API → Authentication + Validation +
Idempotency → CRM`.
Outbound events: Customer mới · Lead mới · Order mới · Payment thành công · Customer được
assign · Customer status thay đổi · Order status thay đổi · Post published.
Webhook Delivery Log bắt buộc: webhook_id · event · payload/reference · attempt_count ·
response_code · response_body (giới hạn/an toàn) · status · next_retry_at · delivered_at ·
created_at.
Retry: có policy · có backoff · KHÔNG retry vô hạn · có Dead Letter/Failed state.
Webhook secret phải bảo mật, hỗ trợ signature verification.

## §67 EVENT ARCHITECTURE

Domain/application event rõ ràng: `lead.created` · `customer.created` ·
`customer.assigned` · `customer.status_changed` · `customer.task_due` · `order.created` ·
`order.status_changed` · `payment.paid` · `post.published` · `integration.failed`.
VD `payment.paid` trigger: Revenue update · Notification · Marketing Analytics · Audit/
Activity · Outbound Webhook.
Có thể dùng Transactional Outbox để không mất event giữa DB transaction và worker/queue.
MVP không bắt buộc message broker, nhưng code/module phải tránh coupling hỗn loạn.

## §68 IDEMPOTENCY & REQUEST SAFETY

API tạo Lead/Order/Payment hoặc write từ hệ thống ngoài phải xem xét Idempotency, VD
`POST /api/v1/leads` + header `Idempotency-Key: <unique-key>`. Cùng client gửi lại cùng key
trong thời gian hợp lệ → không tạo bản ghi nghiệp vụ thứ hai, trả lại kết quả của request
đã xử lý.
Idempotency record: client_id · idempotency_key · endpoint/action · request_hash ·
response/status reference · expires_at · created_at.
**Không dùng Idempotency thay cho Duplicate Customer Detection.**

## §69 DATA FLOW CHUẨN (33 bước)

1 User thấy quảng cáo/nội dung/source → 2 click Tracking Link hoặc vào Website/Landing →
3 Tracking ghi Visitor/Session/Source/Campaign/UTM (nếu bật) → 4 xem trang → 5 nhập thông
tin → 6 Website/Landing gửi API/Webhook với API Client hợp lệ → 7 CRM Authentication/
Validation/Rate Limit/Idempotency → 8 CRM nhận Lead → 9 normalize Phone/Email →
10 kiểm tra Duplicate Customer → 11 xác định Website → 12 Source → 13 Campaign →
14 Landing Page → 15 Tracking Link/UTM/Touchpoint → 16 tạo Lead → 17 tạo hoặc gắn vào
Customer hiện có → 18 cập nhật Source/Touchpoint History → 19 Admin thấy Customer/Data
Pool → 20 Admin giao Data cho Leader → 21 Leader phân cho Sale → 22 Sale chăm sóc →
23 Sale cập nhật Status → 24 Sale thêm Note → 25 Sale tạo Follow-up/Task → 26 Leader &
Admin thấy trạng thái/tiến độ theo quyền → 27 Sale tạo Order (nếu có quyền) → 28 Order ghi
attribution snapshot/reference → 29 Payment được ghi nhận → 30 Revenue cập nhật/tổng hợp
theo rule → 31 Marketing/Sales Analytics cập nhật → 32 Event/Notification/Webhook trigger
theo cấu hình → 33 Audit Log ghi thao tác quan trọng.

Admin phải biết được: khách đến từ đâu · First Source · Last Source · Website nào ·
Campaign nào · Landing Page nào · Tracking Link nào · Leader nào quản lý · Sale nào đang
chăm sóc · trạng thái hiện tại · lịch sử trạng thái · lịch sử chăm sóc · follow-up sắp
tới/quá hạn · đơn hàng · payment · revenue.

## §70 NGUYÊN TẮC DATABASE CUSTOMER SOURCE

Không chỉ lưu `customer.source = TikTok`. Phải lưu: First Source · Last Source · Source
History · Campaign History · Landing Page History · Tracking Link History — để sau này hỗ
trợ Marketing Attribution.

## §71 NGUYÊN TẮC DATABASE CUSTOMER STATUS

Customer lưu `current_status_id`; toàn bộ lịch sử ở `customer_status_history`.
`customer_statuses`: id · name · code · description · color · sort_order · is_active ·
created_at · updated_at.
`customer_status_history`: id · customer_id · old_status_id · new_status_id · changed_by ·
changed_by_role · note · created_at.

## §72 SOFT DELETE / ARCHIVE / DATA RETENTION

Không hard delete dữ liệu có lịch sử nghiệp vụ. Ưu tiên soft delete/archive cho Customer ·
User · Product · Post · Campaign · Landing Page · Website · Integration. Fields:
`deleted_at` · `deleted_by` · `delete_reason`. Admin có thể Archive · Restore · xem Trash/
Archived. Permanent Delete chỉ khi có business/legal requirement rõ ràng và phải kiểm tra
quyền, dependency, audit. Order/Payment/Audit History không được xóa tùy tiện.

## §73 MEDIA / STORAGE ARCHITECTURE

`media`: id · website_id (nullable) · file_name · original_name · mime_type · extension ·
file_size · storage_provider · storage_key/path · url/public_url · width · height ·
duration (nếu video) · uploaded_by · created_at · deleted_at.
Product, Post, Banner, Website Logo, Landing Page và module khác chỉ **tham chiếu** Media,
không tự tạo hệ upload riêng.

## §74 ORDER / PAYMENT / REVENUE PRINCIPLES

Customer Status và Order Status độc lập. Payment = giao dịch thanh toán; Revenue = lớp ghi
nhận/tổng hợp theo business rule. Không để Payment và Revenue thành hai nguồn nhập số độc
lập gây lệch. Nguồn sự thật: Payment transaction là nguồn giao dịch tiền; Revenue record/
aggregate phải sinh hoặc đối soát từ Order/Payment theo rule.
Order nên lưu/gắn attribution: customer_id · lead_id · website_id · source_id ·
campaign_id · landing_page_id · tracking_link_id · sale_id/user_id · leader/team reference.
Nếu attribution thay đổi sau này, Order vẫn phải truy ngược được bối cảnh conversion tại
thời điểm tạo.

## §75 SOURCE REUSE — CRM CORE + WEBSITE CLIENT/SDK

Mục tiêu "website mới lấy source dùng" phải triển khai KHÔNG fork backend CRM.
CRM CORE: `crm-admin` frontend · `crm-api` backend · database.
Shared Packages/SDK: `crm-sdk` · `tracking-sdk` · shared types · validation schemas ·
UI package (nếu thực sự dùng chung).
Website Starter/Template: `website-starter` · `landing-page-starter`.
Website mới cấu hình: `CRM_API_URL` · `WEBSITE_ID` · API CLIENT/API KEY · TRACKING CONFIG.
Monorepo gợi ý: `/apps/crm-admin` `/apps/crm-api` `/packages/crm-sdk`
`/packages/tracking-sdk` `/packages/shared-types` `/templates/website-starter`
`/templates/landing-page-starter`. Folder cuối cùng do AI đề xuất theo Tech Stack thực tế —
đây là định hướng, không hard-code framework.

## §76 GIAI ĐOẠN 1 — CRM FOUNDATION

Giai đoạn 1 KHÔNG có nghĩa xóa module khỏi kiến trúc; các module đều được giữ trong Master
Architecture nhưng mức triển khai khác nhau. Ưu tiên hoạt động tốt:
Authentication/RBAC (login, logout, user, 3 role, permission, data scope) · Team (CRUD,
gán Leader/Sale) · Customer/Lead (CRUD, search, filter, import, export, duplicate
detection, status, status history, notes, timeline, customer merge) · Data Assignment
(Data Pool, Admin→Leader, Leader→Sale, reassign, history) · Follow-up (task, reminder,
overdue) · Orders/Products/Payments/Revenue (core CRUD/workflow) · Marketing Foundation
(source, campaign, website, domain, landing page, tracking link, lead, UTM, basic
attribution, basic analytics) · CMS (blog CRUD, category/tag, multi-website mapping) ·
Media (upload, URL, select) · Integrations (API client, API key, webhook basic, integration
logs) · System (notification basic, audit log, settings). Kế toán vẫn "Đang cập nhật".

## §77 GIAI ĐOẠN 2 — MARKETING PLATFORM & ADVANCED ANALYTICS

Visitor Tracking · Sessions · Page Views · Tracking Events · Advanced Attribution ·
Facebook/TikTok/Google/YouTube Ads API · Ad Spend · CPL · CPA · ROAS · Advanced Campaign
Analytics · Traffic Analytics · Real-time/Near-real-time Dashboard · Notification nâng
cao · Webhook retry/monitoring nâng cao.

## §78 GIAI ĐOẠN 3 — AUTOMATION & COMMUNICATION

Workflow Automation · Auto Assign Lead · Round Robin · Capacity Assignment · Auto Follow-up
Reminder · Lead Recycling Rules · Email Marketing · SMS · Zalo · Telegram · WhatsApp ·
Notification Rules · Automation Audit/Run History.

## §79 GIAI ĐOẠN 4 — AI / AFFILIATE / ACCOUNTING / MOBILE

Mobile App · AI Lead Scoring · AI Customer Care · AI Sales Assistant · Chatbot ·
Affiliate · Commission · Accounting · Ledger · Payment Gateway · Warehouse (nếu business
cần) · Advanced Automation. Phase 1 không được thiết kế theo cách khiến các module này
phải viết lại toàn bộ CRM.

## §80 YÊU CẦU AI LẬP TRÌNH — KHÔNG CODE NGAY

**KHÔNG ĐƯỢC BẮT ĐẦU CODE NGAY.** Phải thực hiện theo thứ tự 18 bước:
1 Business Domain Map · 2 Đề xuất Tech Stack · 3 System Architecture · 4 Module
Architecture · 5 Database Schema · 6 ERD · 7 RBAC + Data Scope · 8 API Design · 9 Event &
Webhook Architecture · 10 Marketing Data Flow · 11 Customer & Sales Flow · 12 Website
Integration Flow · 13 UI/UX · 14 Folder/Repository Structure · 15 Security Design ·
16 Testing Strategy · 17 Deployment/Observability · 18 Roadmap triển khai.
Sau đó **chờ người dùng xác nhận kiến trúc**. Chỉ khi được xác nhận mới bắt đầu viết code.

## §81 YÊU CẦU CODE (áp dụng sau khi được xác nhận)

Production-ready · Clean Code · Modular · Maintainable · Scalable · Secure · Testable · có
Validation · Error Handling · Structured Logging · Migration · Seed (seed Role chỉ ADMIN/
LEADER/SALE) · API Documentation · Environment Configuration · Health Check · strategy cho
background job. Không hard-code Secret/API Key/Database Password/Source/Status có thể cấu
hình. Không viết toàn bộ hệ thống vào một file. Không để Controller… `[TRUNCATED — phần
cuối §81 bị cắt trong bản gửi]`

---

## CÂU HỎI CẦN XÁC NHẬN (ghi nhận, không tự quyết)

1. §81 bị cắt giữa câu "Không để Controller…" — cần phần còn lại (dự đoán: không để
   Controller chứa business logic). Sẽ giả định theo hướng thông thường và ghi rõ ở
   `13-open-questions.md`.
2. Tech Stack: spec yêu cầu AI *đề xuất* (§80 bước 2) — sẽ đưa phương án + lý do, chờ chốt.
3. Prototype hiện tại có role `SUPER_ADMIN`/`USER` — cần xác nhận đường di trú về đúng 3
   role.

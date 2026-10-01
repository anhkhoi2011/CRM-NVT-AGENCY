# NVT AGENCY CRM

## Cấu trúc thư mục

```
.                      Mã chạy production (cPanel chép đúng các file ở gốc, xem .cpanel.yml)
├── app.js             File khởi động Passenger → webhook-server.cjs
├── *.cjs, db.js       Server Node: API, MySQL, webhook landing, Telegram, hỗ trợ nội bộ
├── *.html, *.css, *.js  Giao diện CRM (index.html, crm-runtime.html, reference-crm.js, crm.js…)
├── *.json             Dữ liệu mặc định / seed an toàn (crm-defaults, product-catalog, system-accounts…)
├── assets/            Ảnh tĩnh dùng trong giao diện
├── database/          Schema + migration MySQL (không xóa, đổi tên hay ghi đè khi cập nhật)
├── docs/              Tài liệu: architecture/, deployment/, operations/, reference-ui/
├── tests/             Test tự động (node --test), chạy từ thư mục gốc
└── tools/             Công cụ dev (demo-server.cjs)
```

File runtime giữ ở gốc vì server phục vụ tĩnh theo danh sách đường dẫn cố định và `.cpanel.yml` chép theo tên file. Khi thêm file mới cần chạy production, nhớ thêm vào cả `.cpanel.yml` và danh sách static trong `webhook-server.cjs`.

## Cập nhật code

1. `npm test`: phải qua hết trước khi đẩy.
2. Sửa JS/CSS phía trình duyệt: tăng `?v=` tương ứng trong `index.html` / `crm-runtime.html` để trình duyệt tải bản mới.
3. Sửa server: tăng `BUILD_VERSION` trong `webhook-server.cjs`; sau deploy mở `/api/health` để xác nhận bản mới đang chạy.
4. Deploy trên cPanel (Git Version Control → Update + Deploy), Node app tự restart qua `tmp/restart.txt`.

## Lệnh

- `npm start`: chạy server kiểu production ở cổng 4173.
- `npm run demo`: server demo dữ liệu trong RAM, không ghi MySQL.
- `npm test`: chạy toàn bộ test trong `tests/`.

## File chỉ có ở máy

- `node_modules/`: tạo lại bằng `npm ci`.
- `.env`: thông tin hosting, không bao giờ commit. Mẫu ở `.env.example`.

## Telegram bots

Bot hệ thống dùng `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_ADMIN_CHAT_ID` cho liên kết tài khoản, báo data, điểm danh, nhắc lịch và thông báo. Bot hỗ trợ dùng `TELEGRAM_SUPPORT_BOT_TOKEN`, `TELEGRAM_SUPPORT_BOT_USERNAME`, `TELEGRAM_SUPPORT_ADMIN_CHAT_ID` chỉ cho tin nhắn hỗ trợ nội bộ.

Webhook HTTPS riêng: `TELEGRAM_WEBHOOK_URL` kết thúc bằng `/api/telegram/webhook`, `TELEGRAM_SUPPORT_WEBHOOK_URL` kết thúc bằng `/api/telegram/support-webhook`, mỗi bot một `*_WEBHOOK_SECRET` ngẫu nhiên khác nhau (không phải token). Server đăng ký lại webhook khi khởi động; bot hệ thống phải nhận `callback_query` thì nút ĐIỂM DANH / Nhận data mới hoạt động.

Worker Telegram và watchdog: xem `docs/deployment/TELEGRAM-WORKER-WATCHDOG.md`.

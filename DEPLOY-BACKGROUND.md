# Triển khai worker Telegram và watchdog

## Telegram sau khi Update + Deploy

Web mặc định tạo process con `telegram-worker.cjs` riêng sau khi schema SQL sẵn sàng. Worker nhận nguyên cấu hình Telegram/MySQL từ process web; không cần chép token vào Git. File triển khai cPanel đã bao gồm worker và supervisor.

- `RUN_TELEGRAM_SCHEDULER=0` (mặc định): không chạy vòng lặp Telegram trong web.
- `RUN_TELEGRAM_WORKER=1` (mặc định): web tự tạo và giám sát worker. Pool chính của worker tối đa 4 kết nối, auth 1 (tạo lười), Telegram 1.
- Hosting không cho fork/NPROC hết: health/live báo worker unavailable/restarting, log ghi lỗi. Khi đó đặt `RUN_TELEGRAM_WORKER=0` và chạy `node telegram-worker.cjs` bằng trình quản lý process của hosting. Không có fallback âm thầm về web.
- Chỉ để tương thích hosting đặc biệt: `RUN_TELEGRAM_SCHEDULER=1` chạy lại lịch trong web và không tạo worker tự động. Không dùng cùng worker độc lập.

Khóa SQL toàn CSDL đảm bảo chỉ một worker giữ lịch khi Passenger có nhiều process. Khi process cha tắt, worker con dừng; worker mới nhận khóa. Worker có heartbeat 10 giây, supervisor loại worker không phản hồi hơn 45 giây, mỗi lượt xử lý có hạn 180 giây. Thử khởi động lại có backoff tối đa 5 phút; worker chưa nhận được khóa đợi 60 giây.

Thông báo data vẫn lưu SQL trước khi gửi; worker quét khoảng 15 giây sau khi lượt trước xong. Lịch hẹn, điểm danh và báo cáo quét khoảng 60 giây, không chồng các lượt. Khóa gửi điểm danh SQL giữ riêng từng người/ngày, ngày đã quét trong RAM không bị reset vì một người lỗi. Gửi Telegram là at-least-once: lỗi sau khi Telegram đã nhận nhưng trước khi SQL xác nhận vẫn có khả năng lặp thông báo data.

Webhook nhận nút bấm, liên kết tài khoản, trả lời hỗ trợ và API gửi chủ động vẫn ở web. Các request Telegram có timeout mạng; việc tách worker không thay đổi giao thức callback.

## Watchdog trên cPanel (cài Cron một lần)

Watchdog phải chạy bên ngoài process web để vẫn hoạt động khi web treo. Deploy chỉ chép file, **không tự chỉnh Cron của hosting**.

Dùng mục Cron Jobs, lịch mỗi phút (`* * * * *`). Ví dụ cho hosting hiện tại:

```sh
. /home/gdyeksti/nodevenv/crm/18/bin/activate && cd /home/gdyeksti/crm && WATCHDOG_URL=https://nvtagency.top/api/health/live node watchdog.cjs >> tmp/watchdog.log 2>&1
```

Kiểm tra lệnh này thủ công trước khi thêm Cron: phải in `healthy`. Nếu Passenger không mở cổng TCP 4173 thì **không dùng localhost:4173**; cấu hình URL thật như trên hoặc `WATCHDOG_SOCKET` là Unix socket do hosting cung cấp. Giữ đường dẫn nodevenv đúng với phiên bản Node của ứng dụng.

Mỗi lần kiểm tra có timeout tổng 7 giây. Chỉ sau 3 lần lỗi liên tiếp mới chạm `tmp/restart.txt`; tối thiểu 5 phút giữa các yêu cầu restart, tối đa 3 lần/giờ. HTTP 404 hoặc phản hồi 200 không phải JSON liveness CRM được báo sai cấu hình, không restart. Health/live không phụ thuộc MySQL. Lỗi proxy/mạng ngoài cũng có thể làm probe thất bại; Unix socket/local endpoint đúng là lựa chọn trực tiếp hơn.

Passenger xử lý restart marker khi có request phù hợp; đây là yêu cầu khởi động lại, không phải bảo đảm process đã được restart ngay. Trạng thái và log nằm trong tmp, không đưa lên Git và không đụng tới dữ liệu SQL.

## Cache F5

Cache chỉ dùng khi token còn lưu và accountId/role khớp snapshot; phiên cũ thiếu metadata chờ xác thực. Khi chưa có cache, chỉ hiện khung tải trung tính, không hiện HTML Admin mẫu. Token bị 401 hoặc đăng xuất xóa cache; 503 giữ phiên và bản nháp. Dữ liệu cache chỉ để xem trong lúc runtime chưa sẵn sàng. Script được preload, HTML runtime không cache bất biến, bản nháp chờ khôi phục không chặn việc hiện snapshot đã xác thực.

Không thể bảo đảm F5 dưới 100 ms trên mọi máy/mạng hoặc không bao giờ treo. Cần đo trên hosting sau deploy; lần đầu tải không có cache vẫn cần API.

# Nối LadiPage vào CRM bằng webhook

Tài liệu này dành cho người cấu hình landing page, không phải cho lập trình viên.
Làm đúng thứ tự: chạy server → lấy URL trong CRM → dán vào LadiPage → gửi thử.

## 1. Chạy server nhận webhook

```bash
node docs/architecture/16-webhook-server.cjs
```

Mở CRM tại <http://localhost:4173/> (đường dẫn cũ <http://localhost:4173/demo.html> vẫn được hỗ trợ; không mở bằng cách nhấp đúp file
HTML — xem §7). Server này vừa phục vụ file tĩnh vừa nhận webhook thật, không
cần cài thêm gói nào.

Biến môi trường tuỳ chọn:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `4173` | Cổng nghe |
| `HOST` | `0.0.0.0` | Interface nghe; `0.0.0.0` để máy khác gửi được |
| `WEBHOOK_TOKEN` | rỗng | Bật lên thì mọi webhook phải kèm token (§6) |
| `WEBHOOK_INBOX_FILE` | `docs/architecture/.webhook-inbox.json` | Nơi lưu inbox |

## 2. Lấy URL webhook trong CRM

Đăng nhập tài khoản Admin (`0933445566` / `admin123`) → mục **Websites**.

Mỗi thẻ website có khối **Webhook nhận data landing page** chứa:

- ô URL đọc-chỉ, kèm nút **Sao chép** và **Sửa URL**;
- nút **Tạo mã webhook** nếu website chưa có mã;
- dòng *Test nội bộ* là URL trỏ vào chính máy đang chạy server.

URL có dạng:

```
https://nvtagency.top/api/data-sources/webhook/ds-1789015513831-ZPKFFVK9S9A/
```

Phần `ds-...` là **mã webhook (slug)**, định dạng `ds-{13 chữ số}-{11 ký tự
A-Z0-9}`. Bấm **Sửa URL** để đổi slug, ghi đè URL công khai, hoặc đổi domain
công khai dùng chung (mặc định lấy từ `settings.webhookPublicBase`).

> **Slug chính là khóa truy cập.** Ai giữ URL này đều gửi được data vào CRM.
> Đổi slug làm URL cũ chết ngay — phải dán URL mới vào LadiPage.

Hai chiều đều được hỗ trợ: CRM sinh và hiện URL để copy, đồng thời LadiPage
có thể dùng URL nhập tay; server đối chiếu slug để biết bản ghi thuộc website nào.

## 3. Cấu hình bên LadiPage

Trong trang landing page: **Cài đặt form → Lưu data → API** (Webhook/Endpoint).

| Trường | Giá trị |
| --- | --- |
| API URL | URL lấy ở §2 |
| Method | `POST` (LadiPage chỉ có POST) |
| Content-Type | xem ngay dưới |
| API Request Header | xem §6 |

### Content-Type

Dropdown của LadiPage có **đúng 3 lựa chọn**, và **mặc định KHÔNG phải JSON**:

1. `application/x-www-form-urlencoded` ← mặc định của LadiPage
2. `multipart/form-data`
3. `application/json`

**Chọn cái nào cũng được** — server nhận cả ba, kể cả khi có `; charset=utf-8`
đi kèm, và cả khi URL thiếu dấu `/` cuối. Nếu bạn muốn đúng "kiểu
application/json" như yêu cầu ban đầu thì chọn số 3.

### Trường dữ liệu

Chỉ cần map 3 trường của form. Tên trường tiếng Việt có dấu vẫn nhận được —
server bỏ dấu và đối chiếu theo danh sách bí danh:

| Cần lấy | Các tên được nhận (không phân biệt hoa/thường, không cần dấu) |
| --- | --- |
| Họ tên | `name`, `fullname`, `full_name`, `họ tên`, `họ và tên`, `tên`, `ho ten`, `ten khach hang`… |
| Số điện thoại | `phone`, `mobile`, `tel`, `telephone`, `số điện thoại`, `sdt`, `điện thoại`… |
| Email | `email`, `mail`, `gmail`, `email address`, `thư điện tử`… |

**Chỉ 3 trường này được giữ lại.** Payload của LadiPage là phẳng (mọi trường
cùng một cấp), nhưng nếu bạn gửi lồng nhau server vẫn tự làm phẳng.

## 4. Những trường LadiPage tự thêm — và vì sao bị bỏ qua

LadiPage có thể tự gắn các trường hệ thống: `IP`, `link`, `utm_source`,
`utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `variant_url`,
`is_verified`, `otp_code`, `ladi_form_id`, `message_time`, `fbc`, `fbq`,
`user-agent`, `event_id`, `status_send`.

Theo quy tắc đã chốt: **IP chỉ dành cho khách do sale tạo hoặc khách đăng ký
từ web.** Data từ landing page chỉ lấy họ tên, SĐT, email.

Cụ thể:

- `IP` của LadiPage **bị loại bỏ**. Lưu ý thêm: trường `IP` chỉ được LadiPage
  gắn khi bật "Gửi API qua LadiPage", và đó là **IP máy chủ LadiPage**, không
  phải IP của khách — giữ lại chỉ tạo ra dữ liệu sai.
- `utm_*`, `link`, `ladi_form_id`, `fbc`, `fbq` **bị loại bỏ**. Nguồn
  (source/campaign) của khách lấy từ **ánh xạ của chính website trong CRM**,
  không tự nhận từ payload.
- `otp_code`, `user-agent` **bị loại bỏ** — không ghi vào inbox.

Khách tạo ra từ webhook có `IP truy cập = Chưa xác định`. Đó là hành vi đúng,
không phải lỗi.

## 5. Data rơi vào đâu

Bản ghi hợp lệ đi qua đúng một ống dẫn `ingestCustomer()` — cùng đường với
sale nhập khách thủ công — nên:

- **Chia Leader → Thứ tự data mới vào**: khách hiện ở hàng chờ với nhãn
  *Chờ chia Leader*, cùng `poolView()` "Khách mới đang chờ phân";
- dedupe theo SĐT/email: gửi lại **đúng payload** thì server đánh dấu
  `duplicate` và không tạo bản ghi thứ hai; gửi **payload khác** với cùng SĐT
  thì CRM ghi nhận một lần *điền lại form* và **giữ nguyên người phụ trách cũ**,
  không nhân đôi khách;
- nguồn = `Landing Page`, campaign = `campaignId` của website (chưa ánh xạ thì
  `UNATTRIBUTED`);
- chỉ Admin chạy consumer. Sale/Leader đăng nhập sẽ không kéo inbox — nếu chạy
  dưới hai role đó, `ingestCustomer` sẽ tự gắn khách vào chính sale/leader đang
  đăng nhập, sai chủ phụ trách.

### Khi bản ghi không vào được tệp khách

Không có website nào dùng slug đó, hoặc dữ liệu không qua được bước kiểm tra
tạo khách → bản ghi nằm ở hàng **chờ quy nguồn**:

- banner vàng ở đầu hàng chờ Chia Leader, và nút *Data chờ quy nguồn* trong
  mục Websites;
- modal liệt kê từng bản ghi, chọn website rồi bấm **Quy nguồn**.

**Không có fallback ngầm**: hợp đồng §10 cấm tự gán data vô chủ cho Website A.
Bản ghi chờ quy nguồn vẫn được giữ, không mất.

## 6. Token bảo vệ webhook (tuỳ chọn, khuyến nghị khi public)

LadiPage **không có** HMAC hay chữ ký. Nó chỉ có trường tự do
**"API Request Header"** — một object JSON `tên header → giá trị`, ví dụ:

```json
{"token": "LadiPageToken"}
```

Server chấp nhận token ở một trong các header: `x-api-key`,
`x-webhook-token`, `token`, `authorization`.

```bash
WEBHOOK_TOKEN=doi-ma-nay-that-dai node docs/architecture/16-webhook-server.cjs
```

Khi `WEBHOOK_TOKEN` rỗng thì không kiểm tra token (tiện lúc thử trên máy nội bộ).
`GET /api/health` cho biết token đang bật hay tắt (`"token": true/false`) mà
không tiết lộ giá trị.

## 7. Gửi thử và đọc kết quả

```bash
curl -X POST "http://localhost:4173/api/data-sources/webhook/ds-1789015513831-ZPKFFVK9S9A/" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nguyen Hoai An","phone":"0912345678","email":"hoaian@gmail.com"}'
```

> **Đừng gõ tên trường có dấu ngay trong lệnh `curl` trên Windows.** Git Bash /
> cmd thường thay mọi byte không phải ASCII bằng `?`, nên server nhận
> `"H? v tn"` thay vì `"Họ và tên"` và trả `422 thiếu họ tên` — đó là lỗi của
> shell, không phải của webhook. Muốn thử đúng payload tiếng Việt có dấu của
> LadiPage thì ghi ra file rồi gửi file:
>
> ```bash
> # payload.json phải là UTF-8 thật
> curl -X POST "http://localhost:4173/api/data-sources/webhook/ds-.../" \
>   -H "Content-Type: application/json" --data-binary @payload.json
> ```
>
> LadiPage gửi UTF-8 chuẩn nên không gặp vấn đề này; test tự động
> `18-webhook-consumer.cjs` cũng POST bằng Node nên tên trường có dấu
> được kiểm tra đầy đủ.

| Phản hồi | Ý nghĩa |
| --- | --- |
| `200 {received:true, status:"NEW"}` | Đã nhận, chờ CRM kéo về |
| `200 {…, duplicate:true, id:<id cũ>}` | Gửi lại đúng payload — không tạo bản ghi mới |
| `400` | Body JSON hỏng |
| `404` | Slug sai định dạng hoặc không tồn tại |
| `405` | Gọi sai method (chỉ nhận POST) |
| `413` | Body vượt 256 KB |
| `422 {status:"INVALID", problems:[…]}` | Thiếu họ tên / SĐT không hợp lệ / email sai định dạng |

Quy tắc kiểm tra: **họ tên bắt buộc**; SĐT **9–13 chữ số** (tự đổi
`84xxxxxxxxx` → `0xxxxxxxxx`); **email sai định dạng thì chặn, nhưng thiếu
email thì vẫn nhận**.

### CRM lấy data về

Mục **Websites** có khối **Đồng bộ data từ server webhook** với nhãn trạng thái:

| Nhãn | Ý nghĩa |
| --- | --- |
| Chưa bật đồng bộ | Chưa đăng nhập Admin |
| Đang đồng bộ... | Đang đọc inbox |
| Đang nghe trực tiếp | Kênh SSE hoạt động, data về tức thì |
| Hỏi server định kỳ | SSE đứt, vẫn poll 5s/lần — không mất data |
| Chưa thấy server webhook | Mở CRM không qua server Node, hoặc server chưa chạy |
| Lỗi đọc inbox | Server trả lỗi |

Bấm **Đồng bộ ngay** để kéo tay. Con trỏ (cursor) được lưu trong
`localStorage` nên khởi động lại trình duyệt không ingest lại cả inbox; nếu
con trỏ mất hiệu lực (inbox bị xoá hoặc bị cắt ở 5000 bản ghi) thì vòng
"đã xử lý" 400 id chặn việc tạo lại khách cũ.

> **Không mở CRM bằng `file://`.** Khi đó `window.location.origin` không phải
> `http(s)://…` nên CRM không biết server ở đâu và chuyển sang *Chưa thấy
> server webhook*. CRM vẫn dùng bình thường với dữ liệu cục bộ.

## 8. Endpoint liên quan

| Method | Endpoint | Dùng để |
| --- | --- | --- |
| `POST` | `/api/data-sources/webhook/:slug/` | LadiPage gửi data |
| `OPTIONS` | như trên | Preflight CORS → `204` |
| `GET` | `/api/data-sources/inbox?since=&raw=1` | CRM đọc inbox theo cursor |
| `GET` | `/api/data-sources/stream` | SSE đẩy `{id, receivedAt, slug}` |
| `GET` | `/api/session-context` | IP thật cho luồng đăng ký web |
| `GET` | `/api/health` | Kiểm tra server sống |

CORS **echo lại Origin** chứ không dùng `*`, kèm `Vary: Origin` và
`Access-Control-Max-Age: 600`.

Inbox là **bản ghi bất biến ghi xuống đĩa** — restart server không mất data.
Mặc định API inbox không trả `raw` và `dedupeKey`; thêm `?raw=1` khi cần soi
payload gốc.

## 9. Kiểm thử

```bash
node docs/architecture/17-webhook-server.cjs     # test phía server
node docs/architecture/18-webhook-consumer.cjs   # test nối CRM ↔ server
```

Test 18 chạy **end-to-end thật**: spawn server, POST payload đúng dáng
LadiPage, rồi boot chính file `14-crm-complete.js` trong sandbox với
`fetch` trỏ vào server đang chạy, đăng nhập Admin và kéo inbox. Nó khẳng định
khách rơi vào đúng hàng chờ Chia Leader, data vô chủ không bị gán nhầm
website, retry không nhân đôi khách, IP không lọt vào khách landing page, và
mã webhook không bao giờ đi vào note của khách hay audit log.

## 10. Còn thiếu gì so với production

Đây là server nhận webhook thật nhưng **vẫn là tầng demo**, chưa thay được
backend trong `15-production-integration-contract.md`:

- inbox là file JSON, không phải PostgreSQL; chưa có `FOR UPDATE SKIP LOCKED`
  hay transactional outbox như §6 của hợp đồng;
- token so khớp trực tiếp, chưa phải bảng API key chỉ lưu hash và chỉ hiện một
  lần khi tạo (§4);
- chưa chống SSRF cho endpoint do người dùng nhập, chưa giới hạn redirect;
- chưa có DTO/projection riêng theo role (§9) — hiện CRM chặn bằng cách chỉ cho
  Admin chạy consumer, đó là kiểm soát ở frontend, không phải ở API;
- trạng thái kết nối của website vẫn dừng ở `PENDING_BACKEND`: `VERIFIED` chỉ
  được trả về từ backend sau khi kiểm tra thật, frontend không được tự đánh dấu.

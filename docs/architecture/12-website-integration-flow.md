# 12 — WEBSITE INTEGRATION FLOW (§80 Bước 12)

Trả lời câu hỏi cốt lõi của spec: **làm sao website mới dùng được CRM Core mà không fork
backend** (§17, §19, §75).

## 12.1 Nguyên tắc

```
❌ SAI                                    ✅ ĐÚNG
crm-backend-copy-website-A/               crm-api (MỘT bản duy nhất)
crm-backend-copy-website-B/                 ▲     ▲     ▲
crm-backend-copy-website-C/                 │     │     │
  → 3 bản code, 3 DB, không đồng bộ     website-A  B    C
                                        (chỉ dùng SDK + API key + config)
```

Website mới cần đúng 4 thứ:
```env
CRM_API_URL=https://crm.example.com/api/v1
CRM_WEBSITE_ID=<uuid>
CRM_API_KEY=pk_live_ab12.xxxxx      # server-side only
NEXT_PUBLIC_CRM_TRACKING_KEY=pk_pub_cd34.xxxxx   # public key, scope hẹp
```

## 12.2 Quy trình đăng ký website mới (checklist Admin)

```
1  POST /websites
      { name:'Website Trading', code:'trading', primaryDomain:'trading.example.com',
        defaultLanguage:'vi-VN', timezone:'Asia/Ho_Chi_Minh' }

2  POST /websites/{id}/domains
      { domain:'trading.example.com', type:'PRIMARY' }
   → trả verification token
      DNS TXT:  _crm-verify.trading.example.com  →  crm-verify=abc123...
      hoặc file: https://trading.example.com/.well-known/crm-verify.txt

3  POST /websites/{id}/domains/{domainId}/verify
   → is_verified = true   ← CHƯA verify thì CORS/tracking KHÔNG hoạt động

4  POST /api-clients
      { websiteId, name:'Website Trading — Server', type:'WEBSITE' }

5  POST /api-clients/{id}/keys
      { name:'Production server key', environment:'PRODUCTION',
        scopes:['lead:create','customer:read','order:create','blog:read'],
        rateLimitPerMinute: 120 }
   → LƯU FULL KEY NGAY (chỉ hiện 1 lần)

6  POST /api-clients/{id}/keys      ← key thứ 2 cho browser
      { name:'Public tracking key', scopes:['tracking:write'],
        rateLimitPerMinute: 600 }

7  (tùy chọn) POST /landing-pages
      { websiteId, name:'LP Ưu đãi tháng 9', code:'lp-uu-dai-09',
        url:'https://trading.example.com/uu-dai', apiClientId }

8  (tùy chọn) POST /webhooks
      { websiteId, name:'Sync về website', url:'https://trading.example.com/api/crm-hook',
        eventTypes:['customer.status_changed','order.status_changed'] }

9  POST /landing-pages/{id}/test-api  → xác nhận kết nối trước khi chạy quảng cáo
```

Không có bước nào cần deploy lại CRM.

## 12.3 Hai loại API key — tách vai trò

| | Server key | Public/tracking key |
|---|---|---|
| Đặt ở | biến môi trường server | có thể lộ trong JS bundle |
| Scope | `lead:create`, `order:create`, `customer:read`… | **chỉ** `tracking:write` |
| Rate limit | vừa (theo request thật) | cao (nhiều pageview) |
| Nếu bị lộ | nguy hiểm → phải rotate | thiệt hại giới hạn ở dữ liệu tracking rác |

**Quy tắc cứng**: `lead:create` **không bao giờ** cấp cho public key nếu form submit đi
trực tiếp từ browser mà không qua server. Nếu buộc phải submit từ browser (landing page tĩnh,
không có backend), thì:
- Dùng key riêng chỉ có `lead:create`
- Bật CORS chặt theo domain đã verify
- Bật rate limit theo IP + Turnstile/hCaptcha token (`settings.lead_captcha_required`)
- Chấp nhận rủi ro spam lead, có màn hình đánh dấu `SPAM` để lọc

Đây là đánh đổi có ý thức, cần bạn xác nhận — xem `19-open-questions.md` Q6.

## 12.4 Luồng submit form — 2 kiến trúc

### A. Có backend (khuyến nghị)
```
Browser form
   │ POST /api/contact  (same-origin, có CSRF của website)
   ▼
Website backend (Next.js route handler / API route)
   │ thêm X-Api-Key (server env), Idempotency-Key
   │ thêm visitorKey/sessionKey đọc từ cookie
   ▼
CRM  POST /api/v1/leads
   │
   ▼ 201 { leadId, customerId, isNewCustomer }
Website trả về trang cảm ơn
```
Ưu: API key không lộ; validate 2 lớp; ẩn cấu trúc CRM khỏi client.

### B. Landing page tĩnh, không backend
```
Browser form
   │ POST trực tiếp + X-Api-Key (public, scope lead:create)
   │ + captcha token
   ▼
CRM  POST /api/v1/leads   (CORS check theo Origin)
```
Ưu: đơn giản, deploy landing page ở CDN. Nhược: key lộ → phải bù bằng CORS + captcha +
rate limit + monitoring lead spam.

## 12.5 `crm-sdk` — hợp đồng (TypeScript)

Package `@crm/sdk`, sinh type từ OpenAPI. Dùng ở server của website.

```ts
import { createCrmClient } from '@crm/sdk';

const crm = createCrmClient({
  baseUrl: process.env.CRM_API_URL!,
  apiKey: process.env.CRM_API_KEY!,
  websiteId: process.env.CRM_WEBSITE_ID!,
  timeoutMs: 8000,
  retry: { attempts: 3, backoff: 'exponential' },   // chỉ retry lỗi mạng/5xx
});

// 1. Gửi lead
const res = await crm.leads.create({
  name, phone, email, note,
  landingPageCode: 'lp-uu-dai-09',
  utm: readUtmFromRequest(req),
  referrer: req.headers.referer,
  pageUrl: currentUrl,
  visitorKey: cookies.get('crm_vid'),
  sessionKey: cookies.get('crm_sid'),
}, { idempotencyKey: crypto.randomUUID() });   // SDK tự set header

// 2. Đọc blog cho website
const posts = await crm.posts.list({ limit: 10, category: 'tin-tuc' });
const post  = await crm.posts.getBySlug('bai-viet-mau');

// 3. Đọc sản phẩm
const products = await crm.products.list({ status: 'ACTIVE' });

// 4. Tạo đơn từ website (nếu website có giỏ hàng)
const order = await crm.orders.create({ customerPhone, items }, { idempotencyKey });
```

Yêu cầu SDK:
- **Không** chứa business logic — chỉ HTTP + type + retry + error mapping.
- Error class rõ ràng: `CrmValidationError`, `CrmAuthError`, `CrmRateLimitError`,
  `CrmNetworkError` (có `requestId` để tra log).
- Retry **chỉ** cho lỗi mạng/timeout/5xx/429, **không** retry 4xx.
- Luôn gửi `Idempotency-Key` cho write (SDK tự sinh nếu caller không truyền).
- Không log body chứa PII ở mức `info`.

## 12.6 `tracking-sdk` — hợp đồng (browser)

Package `@crm/tracking`, ~5KB gzip, không phụ thuộc framework.

```html
<script src="https://cdn.example.com/crm-tracking.js"
        data-crm-url="https://crm.example.com/api/v1"
        data-crm-key="pk_pub_cd34.xxxxx"
        data-website-id="uuid"
        data-landing-page-code="lp-uu-dai-09"
        defer></script>
```

```ts
// hoặc dùng như module
import { initTracking } from '@crm/tracking';

const tracker = initTracking({
  apiUrl: '...', publicKey: '...', websiteId: '...',
  landingPageCode: 'lp-uu-dai-09',
  respectDoNotTrack: true,      // mặc định true
  consentRequired: false,       // nếu true, chờ tracker.grantConsent()
});

tracker.pageView();                                  // tự gọi khi load + SPA route change
tracker.track('form_view', { formId: 'lead-form' });
tracker.track('click', { element: 'cta-primary' });
const ctx = tracker.getLeadContext();                // { visitorKey, sessionKey, utm, referrer, pageUrl }
// gửi ctx kèm form → CRM nối được lead ↔ session
```

Hành vi bắt buộc:
| Việc | Chi tiết |
|---|---|
| Cookie | `crm_vid` (13 tháng, 1st-party, `SameSite=Lax`, `Secure`), `crm_sid` (sessionStorage, timeout 30p) |
| Batch | gom event, flush mỗi 5s hoặc khi đủ 20 event hoặc `visibilitychange` |
| Gửi | `navigator.sendBeacon` khi rời trang, `fetch` khi bình thường |
| Lỗi | **im lặng** — tracking lỗi không được làm hỏng website của khách |
| Không thu | mật khẩu, nội dung input, số thẻ, email/phone (PII) — chỉ metadata |
| DNT | tôn trọng `navigator.doNotTrack` nếu `respectDoNotTrack: true` |
| SPA | hook `history.pushState`/`popstate` để bắt route change |
| Kích thước | ≤ 8KB gzip, không phụ thuộc lib ngoài |

## 12.7 CORS — cơ chế chính xác

```
Request có Origin: https://trading.example.com
   │
   ├─ 1. Tách host từ Origin
   ├─ 2. Tra website_domains WHERE domain = host
   │        AND is_verified = TRUE AND status = 'ACTIVE'
   │      (cache Redis 5 phút, invalidate khi thêm/verify domain)
   ├─ 3. Nếu không tìm thấy → KHÔNG trả Access-Control-Allow-Origin → browser chặn
   ├─ 4. Nếu tìm thấy, kiểm tra api_client.allowed_origins:
   │        · rỗng   → chấp nhận mọi domain đã verify của website đó
   │        · có giá trị → Origin phải nằm trong danh sách
   └─ 5. Trả:
          Access-Control-Allow-Origin: https://trading.example.com   (echo, KHÔNG dùng *)
          Access-Control-Allow-Credentials: false                     (API key, không cookie)
          Access-Control-Allow-Headers: Content-Type, X-Api-Key, Idempotency-Key, X-Request-Id
          Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS
          Access-Control-Max-Age: 600
          Vary: Origin
```

**Không bao giờ** `Access-Control-Allow-Origin: *` cho endpoint nhận API key. `Vary: Origin`
bắt buộc để CDN không cache sai origin.

Endpoint quản trị (`/users`, `/settings`, …) chỉ cho origin của CRM Admin, và
`Allow-Credentials: true` vì dùng cookie.

## 12.8 Website đọc nội dung CMS (§12)

```
GET /api/v1/posts?limit=10&categorySlug=tin-tuc
X-Api-Key: pk_live_ab12.xxxxx        (scope blog:read)
```
Backend tự lọc:
```sql
SELECT p.*, pw.slug AS website_slug
FROM posts p
JOIN post_websites pw ON pw.post_id = p.id
WHERE pw.website_id = $website_of_api_key        -- ← tự động, client không chọn được
  AND pw.is_visible = TRUE
  AND p.status = 'PUBLISHED'
  AND p.published_at <= now()
  AND p.deleted_at IS NULL
ORDER BY p.published_at DESC;
```
Website A **không thể** đọc bài của website B, dù đổi tham số. Đây là data isolation ở tầng
API, không phụ thuộc client.

Cache: response có `ETag` + `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
Event `post.published` → purge cache (nếu dùng CDN, gọi purge API).

## 12.9 Webhook về website (§66)

Website muốn biết khi trạng thái khách đổi (VD hiện "đơn của bạn đã thanh toán"):
```
CRM ──► POST https://trading.example.com/api/crm-hook
        X-Crm-Event: order.status_changed
        X-Crm-Signature: sha256=...
```
Website verify signature, cập nhật UI/DB của mình. Đây là chiều CRM → website, ngược với
API (website → CRM).

## 12.10 Monorepo structure (§75)

```
crm-platform/
├─ apps/
│  ├─ crm-api/                  NestJS — MỘT backend duy nhất
│  └─ crm-admin/                Next.js — CRM Admin UI (ADMIN/LEADER/SALE)
├─ packages/
│  ├─ shared-types/             type dùng chung (sinh từ OpenAPI + Zod)
│  ├─ crm-sdk/                  client cho website (server-side)
│  ├─ tracking-sdk/             script tracking (browser)
│  ├─ validation/               Zod schema dùng chung BE/FE/SDK
│  └─ ui/                       (tùy chọn) component dùng chung
├─ templates/
│  ├─ website-starter/          Next.js template đã cấu hình crm-sdk + tracking
│  └─ landing-page-starter/     landing tĩnh (Astro/Vite) + form → CRM
├─ docs/
│  └─ architecture/             ← tài liệu này
├─ infra/
│  ├─ docker/                   Dockerfile api, worker, admin
│  ├─ compose/                  docker-compose local
│  └─ migrations/               SQL migration (nếu tách khỏi Prisma)
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json
```

Website thật (trading.example.com) **không** nằm trong monorepo này — nó là repo riêng,
`npm install @crm/sdk @crm/tracking` từ registry (hoặc copy từ `templates/`).

Vì sao tách repo website: website có lifecycle deploy riêng, không nên bị ràng vào CI của
CRM. `templates/` chỉ là điểm khởi đầu để copy.

## 12.11 Checklist kỹ thuật khi thêm website (dán cho dev website)

```
[ ] Xin từ Admin CRM: WEBSITE_ID, SERVER_API_KEY, PUBLIC_TRACKING_KEY
[ ] Domain đã verify trong CRM (nếu chưa, CORS sẽ chặn)
[ ] Thêm env: CRM_API_URL, CRM_WEBSITE_ID, CRM_API_KEY, NEXT_PUBLIC_CRM_TRACKING_KEY
[ ] Cài @crm/sdk (server) + @crm/tracking (browser)
[ ] Nhúng tracking script (hoặc initTracking) ở layout gốc
[ ] Form submit qua backend của website, không gọi CRM trực tiếp từ browser
[ ] Luôn gửi Idempotency-Key cho mỗi lần submit
[ ] Gửi kèm getLeadContext() để CRM nối được attribution
[ ] Xử lý lỗi: hiện thông báo thân thiện, log requestId để tra với Admin CRM
[ ] Test bằng POST /landing-pages/{id}/test-api trước khi chạy ads
[ ] Không log full API key ở bất kỳ đâu
[ ] Nếu dùng webhook: verify signature + dedupe theo X-Crm-Event-Id
```

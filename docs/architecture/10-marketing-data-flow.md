# 10 — MARKETING DATA FLOW (§80 Bước 10)

Bao trùm §13, §22–§28, §52, §53, §69, §70.

## 10.1 Luồng đầy đủ từ quảng cáo đến doanh thu

```
[1] Người dùng thấy quảng cáo / nội dung
        TikTok Ads · Facebook Ads · Google Ads · YouTube · Organic · Referral · Affiliate · Direct
                                    │
[2] Click                           ▼
        ┌─────────────────────────────────────────────────────────┐
        │ A. Tracking Link:  domain.com/go/tiktok01               │
        │    GET /go/{slug} → ghi click, set cookie visitor,      │
        │    gắn UTM vào destination → 302                        │
        │ B. Link trực tiếp có UTM:  lp.example.com/?utm_source=… │
        └──────────────────────────┬──────────────────────────────┘
                                   ▼
[3] Website / Landing Page tải, tracking-sdk khởi động
        · đọc/tạo cookie `crm_vid` (visitorKey, 1st-party, 13 tháng)
        · tạo sessionKey (sessionStorage, timeout 30 phút)
        · thu: page URL, referrer, UTM, device/browser (không PII)
        · POST /api/v1/tracking/events  {name:'pageview', ...}   → 202
                                   ▼
[4] CRM ghi Visitor → Session → PageView
        · visitors: first_seen, first_source, first_campaign, first_landing
        · tracking_sessions: entry_url, referrer, utm, source, campaign
        · page_views: từng trang xem
                                   ▼
[5] Khách xem trang, tương tác
        events: form_view · click · scroll · custom
                                   ▼
[6] Khách nhập form (tên, phone, email, ghi chú)
        crm-sdk gọi POST /api/v1/leads
        kèm X-Api-Key, Idempotency-Key, visitorKey, sessionKey, utm, pageUrl, referrer
                                   ▼
╔══════════════ [7] CRM LEAD INGEST PIPELINE ══════════════════════════════════╗
║  7.1  AuthN API Key → resolve api_client + website + scopes                  ║
║  7.2  CORS check: Origin ∈ website_domains đã verify (hoặc allowed_origins)  ║
║  7.3  Rate limit theo api_key_id                                             ║
║  7.4  Validate schema (Zod)                                                  ║
║  7.5  Idempotency: Idempotency-Key → idempotency_records                     ║
║  7.6  NORMALIZE: phone → E.164 · email → lowercase+trim                      ║
║  7.7  RESOLVE CONTEXT (thứ tự ưu tiên rõ ràng — xem 10.2)                    ║
║         website · landing_page · source · campaign · tracking_link           ║
║  7.8  DUPLICATE DETECTION (phone → email) — xem 10.3                         ║
║  7.9  Tạo `leads` (LUÔN tạo — 1 người có thể nhiều lead)                     ║
║  7.10 Tạo hoặc gắn `customers`                                               ║
║  7.11 Ghi `customer_touchpoints` (sequence_no tăng dần)                      ║
║         + `customer_source_history`; cập nhật first/last touch               ║
║  7.12 Nối visitor ↔ customer (identity resolution): visitors.customer_id     ║
║  7.13 Đặt trạng thái mặc định từ customer_statuses.is_default                ║
║  7.14 Vào Data Pool: data_pool_entries state=UNASSIGNED                      ║
║  7.15 audit_logs + outbox_events (lead.created [, customer.created])         ║
╚═════════════════════════════════┬════════════════════════════════════════════╝
                                   ▼
[8] Admin thấy Data Pool → giao Leader → Leader phân Sale
        assignment_history ghi mọi bước, không overwrite
                                   ▼
[9] Sale chăm sóc: cập nhật Status · thêm Note · tạo Follow-up
        customer_status_history append-only → Leader/Admin thấy ngay (§38)
                                   ▼
[10] Sale tạo Order
        · order gắn FK attribution: website/source/campaign/landing/tracking_link
        · attribution_snapshots: COPY tên + utm (bất biến — §74)
                                   ▼
[11] Payment ghi nhận → event payment.paid
                                   ▼
[12] Revenue entries sinh theo rule
                                   ▼
[13] Analytics: Marketing Funnel · Source ROI · Campaign · Landing · Tracking Link
```

## 10.2 Resolve context — thứ tự ưu tiên (điểm dễ sai)

Khi một lead đến, phải xác định 5 chiều. Quy tắc: **thứ tự ưu tiên rõ ràng, có fallback,
không bao giờ đoán bừa.**

### Website
```
1. payload.websiteId (nếu API key được phép ghi cho website đó)
2. api_client.website_id
3. landing_page.website_id (từ landingPageCode)
4. Origin/Referer header → website_domains.domain (verified) → website_id
5. → null + đánh cờ `context_incomplete` (không đoán)
```
Nếu API key thuộc website A nhưng payload khai website B → **403**, không im lặng chấp nhận.

### Landing Page
```
1. payload.landingPageCode / landingPageId
2. api_client.landing_page_id
3. matching pageUrl với landing_pages.url (exact path, không fuzzy)
4. → null
```

### Tracking Link
```
1. payload.trackingLinkSlug
2. cookie/param `_tl` do endpoint /go/{slug} đặt
3. → null
```

### Source (§20, §21) — có fallback nhiều tầng
```
1. payload.sourceCode / sourceId (khớp lead_sources.code)
2. tracking_link.source_id
3. campaign.source_id
4. utm_source khớp lead_sources.utm_source_match[]   ← ánh xạ cấu hình được
5. Phân loại từ referrer domain:
      google.* + utm_medium=cpc|ppc → source "Google Ads"   (nếu có cấu hình)
      google.* không utm            → source "Google Organic"
      facebook.com / fb.com         → source "Facebook"
      tiktok.com                    → source "TikTok"
      youtube.com                   → source "YouTube"
      (không có referrer, không utm)→ source hệ thống "Direct"
      referrer domain khác          → source hệ thống "Referral" (lưu referrer_url)
6. → source hệ thống "Unknown"
```
Bảng ánh xạ referrer → source **là dữ liệu cấu hình** (`lead_sources.utm_source_match` +
`settings.referrer_source_map`), **không hard-code** (§20). Admin sửa được mà không sửa code.

### Campaign
```
1. payload.campaignCode / campaignId
2. tracking_link.campaign_id
3. utm_campaign khớp campaigns.code (case-insensitive)
4. → null (KHÔNG tự tạo campaign mới; chỉ ghi utm_campaign thô để Admin map sau)
```
Vì sao không auto-tạo campaign: sẽ sinh rác từ typo trong utm. Thay vào đó, màn hình
"Unmapped UTM" liệt kê `utm_campaign` chưa khớp để Admin tạo/map một lần.

## 10.3 Duplicate detection — cây quyết định (§29)

```
Đầu vào: phone_normalized (P), email_normalized (E)

┌─ P hợp lệ và tìm thấy customer C có phone_normalized = P ?
│    → CHẮC CHẮN cùng người
│      · tạo lead mới, lead.customer_id = C.id
│      · ghi touchpoint mới cho C
│      · cập nhật last_touch của C
│      · nếu E khác email của C và C chưa có email → bổ sung (không ghi đè)
│      · nếu E khác và C đã có email khác → thêm vào customer_contacts, KHÔNG ghi đè
│      · duplicateAction = ATTACHED_TO_EXISTING
│
├─ P không có/không hợp lệ, E hợp lệ và tìm thấy C có email_normalized = E ?
│    → CHẮC CHẮN cùng người (email là định danh mạnh thứ 2)
│      · xử lý như trên
│
├─ P hợp lệ nhưng CHƯA có customer nào; E hợp lệ và trùng customer khác C2 ?
│    → XUNG ĐỘT: phone mới + email cũ. Có thể là người mới dùng email chung
│      (email công ty), hoặc cùng người đổi số.
│      · TẠO customer mới
│      · ghi lead_duplicate_reviews (match_type=EMAIL_EXACT, confidence 0.6)
│      · duplicateAction = FLAGGED_FOR_REVIEW
│      · KHÔNG tự merge (§29 "không tự merge khi độ tin cậy thấp")
│
├─ Không trùng gì, nhưng tên gần giống + cùng landing page trong 24h ?
│    → confidence thấp (0.3): tạo customer mới, ghi review queue nếu
│      settings.fuzzy_duplicate_review = true (mặc định false để tránh nhiễu)
│
└─ Không trùng → tạo customer mới, duplicateAction = NONE
```

**Race condition**: hai lead cùng phone đến đồng thời. Chống bằng:
```sql
-- Advisory lock theo phone trong transaction
SELECT pg_advisory_xact_lock(hashtext($phone_normalized));
-- rồi mới SELECT ... INSERT
```
cộng với `uq_customers__phone` làm lưới an toàn cuối (nếu vẫn lọt, INSERT fail → retry
nhánh "đã tồn tại").

**Duplicate ≠ Idempotency** (§68):
| | Duplicate Detection | Idempotency |
|---|---|---|
| Vấn đề | cùng một **người** gửi nhiều lần/nhiều nơi | cùng một **request** bị gửi lặp |
| Kết quả | tạo lead mới, gắn customer cũ | không tạo gì, trả kết quả cũ |
| Cơ chế | so `phone_normalized`/`email_normalized` | so `Idempotency-Key` + `request_hash` |
| Bảng | `customers`, `lead_duplicate_reviews` | `idempotency_records` |

## 10.4 Attribution — trả lời được câu hỏi nào (§53)

`customer_touchpoints` với `sequence_no` tăng dần cho mỗi customer:

```
Customer KH00842
  seq 1  2026-08-12  TikTok    · Landing A · campaign01 · tracking tiktok01  (LEAD_SUBMIT)
  seq 2  2026-08-20  Direct    · Website chính                               (VISIT)
  seq 3  2026-09-01  Google Ads· Landing B · campaign07                      (LEAD_SUBMIT)
  seq 4  2026-09-04  —         · Order DH20260904-0007                       (CONVERSION)

first_touch = seq 1 (TikTok)          → "khách lần đầu đến từ đâu"
last_touch  = seq 3 (Google Ads)      → "lần gần nhất đến từ đâu"
converting_lead = lead của seq 3      → "lead nào tạo conversion"
```

| Câu hỏi (§53) | Truy vấn từ |
|---|---|
| Khách lần đầu đến từ đâu? | `customers.first_touch_id` → touchpoint.source |
| Lần gần nhất từ đâu? | `customers.last_touch_id` |
| Lead nào tạo conversion? | `attribution_snapshots.converting_lead_id` |
| Campaign nào tạo Order? | `orders.campaign_id` + snapshot |
| Website/Landing nào mang Revenue? | `revenue_entries.website_id/landing_page_id` |
| Tracking Link nào hiệu quả? | `revenue_entries.tracking_link_id` |

### Model attribution

| Model | Phase | Cách tính |
|---|---|---|
| **First Touch** | 1 | 100% credit cho `first_touch` |
| **Last Touch** | 1 | 100% credit cho `last_touch` (touchpoint gần nhất trước conversion) |
| **Last Non-Direct** | 2 | bỏ qua touchpoint Direct khi chọn last |
| **Linear** | 2 | chia đều cho n touchpoint |
| **Time Decay** | 2 | trọng số theo `exp(-λ·Δt)`, gần conversion nhiều hơn |
| **Position Based** | 2 | 40% first + 40% last + 20% chia giữa |

Phase 1 chỉ cần First/Last (dùng cột denormalize, query nhanh). Phase 2 thêm bảng
`attribution_credits` (touchpoint × order × model × credit) — **không đổi schema core**.

### Attribution window

`settings.attribution_window_days` (mặc định 30). Touchpoint cũ hơn window không được tính
credit cho conversion. Cần cấu hình vì chu kỳ mua khác nhau theo ngành.

## 10.5 Marketing Funnel (§26) — SQL thực tế

```sql
WITH params AS (SELECT $from::date AS d1, $to::date AS d2, $website_id::uuid AS wid),
-- 1. Traffic
traffic AS (
  SELECT COUNT(DISTINCT v.id) AS unique_visitors, COUNT(DISTINCT s.id) AS sessions
  FROM tracking_sessions s JOIN visitors v ON v.id = s.visitor_id, params p
  WHERE s.started_at::date BETWEEN p.d1 AND p.d2
    AND (p.wid IS NULL OR s.website_id = p.wid)
),
-- 2. Landing page views
landing AS (
  SELECT COUNT(*) AS landing_views FROM page_views pv, params p
  WHERE pv.created_at::date BETWEEN p.d1 AND p.d2
    AND pv.landing_page_id IS NOT NULL
    AND (p.wid IS NULL OR pv.website_id = p.wid)
),
-- 3. Lead
lead_c AS (
  SELECT COUNT(*) AS leads FROM leads l, params p
  WHERE l.created_at::date BETWEEN p.d1 AND p.d2 AND l.deleted_at IS NULL
    AND (p.wid IS NULL OR l.website_id = p.wid)
),
-- 4. Qualified lead
qualified AS (
  SELECT COUNT(*) AS qualified FROM leads l, params p
  WHERE l.created_at::date BETWEEN p.d1 AND p.d2 AND l.status IN ('QUALIFIED','CONVERTED')
    AND (p.wid IS NULL OR l.website_id = p.wid)
),
-- 5. Assigned to sale
assigned AS (
  SELECT COUNT(DISTINCT l.id) AS assigned FROM leads l
  JOIN customers c ON c.id = l.customer_id, params p
  WHERE l.created_at::date BETWEEN p.d1 AND p.d2 AND c.assigned_sale_id IS NOT NULL
    AND (p.wid IS NULL OR l.website_id = p.wid)
),
-- 6/7. Order & paid order
ord AS (
  SELECT COUNT(*) AS orders,
         COUNT(*) FILTER (WHERE o.status IN ('PAID','COMPLETED')) AS paid_orders
  FROM orders o, params p
  WHERE o.ordered_at::date BETWEEN p.d1 AND p.d2 AND o.deleted_at IS NULL
    AND (p.wid IS NULL OR o.website_id = p.wid)
),
-- 8. Revenue
rev AS (
  SELECT COALESCE(SUM(r.amount),0) AS revenue FROM revenue_entries r, params p
  WHERE r.recognized_at::date BETWEEN p.d1 AND p.d2 AND r.entry_type='RECOGNIZED'
    AND (p.wid IS NULL OR r.website_id = p.wid)
)
SELECT * FROM traffic, landing, lead_c, qualified, assigned, ord, rev;
```

Tỷ lệ chuyển đổi tính ở tầng ứng dụng (dễ xử lý chia 0 và hiển thị "—" khi thiếu dữ liệu).
Nếu tracking chưa bật: `traffic`/`landing` trả 0 hàng → API đặt
`dataAvailability.traffic = "NOT_TRACKED"` và FE hiện "Chưa có dữ liệu", **không** hiện 0%
(§52 cấm số liệu giả).

## 10.6 Thống kê nguồn khách (§24)

```sql
SELECT s.id, s.name, s.traffic_type, COUNT(l.id) AS leads,
       ROUND(100.0 * COUNT(l.id) / NULLIF(SUM(COUNT(l.id)) OVER (), 0), 1) AS pct
FROM leads l
LEFT JOIN lead_sources s ON s.id = l.source_id
WHERE l.created_at::date BETWEEN $1 AND $2 AND l.deleted_at IS NULL
GROUP BY s.id, s.name, s.traffic_type
ORDER BY leads DESC;
```
Hiển thị: donut/pie/bar + **bảng** (bảng là bản đọc được không cần màu — nguyên tắc dataviz
đã áp trong prototype archive `docs/archive/legacy-next-fragments/src/components/crm/CrmCharts.tsx.txt`).

## 10.7 So sánh Landing Page (§25)

```sql
SELECT lp.id, lp.name, lp.url, lp.status,
       COALESCE(t.unique_visitors,0) AS traffic,
       COALESCE(lc.leads,0)          AS leads,
       COALESCE(oc.orders,0)         AS orders,
       COALESCE(rv.revenue,0)        AS revenue,
       ROUND(100.0*COALESCE(lc.leads,0)/NULLIF(t.unique_visitors,0),2) AS lead_rate_pct,
       ROUND(100.0*COALESCE(oc.orders,0)/NULLIF(lc.leads,0),2)        AS order_rate_pct,
       ROUND(COALESCE(rv.revenue,0)/NULLIF(lc.leads,0),0)             AS revenue_per_lead
FROM landing_pages lp
LEFT JOIN (SELECT landing_page_id, COUNT(DISTINCT visitor_id) unique_visitors
           FROM tracking_sessions WHERE started_at::date BETWEEN $1 AND $2
           GROUP BY landing_page_id) t ON t.landing_page_id = lp.id
LEFT JOIN (SELECT landing_page_id, COUNT(*) leads FROM leads
           WHERE created_at::date BETWEEN $1 AND $2 AND deleted_at IS NULL
           GROUP BY landing_page_id) lc ON lc.landing_page_id = lp.id
LEFT JOIN (SELECT landing_page_id, COUNT(*) orders FROM orders
           WHERE ordered_at::date BETWEEN $1 AND $2 AND deleted_at IS NULL
           GROUP BY landing_page_id) oc ON oc.landing_page_id = lp.id
LEFT JOIN (SELECT landing_page_id, SUM(amount) revenue FROM revenue_entries
           WHERE recognized_at::date BETWEEN $1 AND $2 AND entry_type='RECOGNIZED'
           GROUP BY landing_page_id) rv ON rv.landing_page_id = lp.id
WHERE lp.deleted_at IS NULL
ORDER BY revenue DESC NULLS LAST;
```
`revenue_per_lead` là `NULL` khi chưa có lead — FE hiện "—", không hiện `0đ`.

## 10.8 Ads API — chỗ móc sẵn (§27)

Phase 1 **không** kết nối, **không** tạo số giả. Nhưng đã chuẩn bị:
- `campaigns.external_platform` + `external_campaign_id` để map với campaign bên Ads.
- `integrations` giữ credential (mã hóa) cho từng platform.
- Phase 2 thêm `ad_campaign_stats` (spend, impressions, clicks theo ngày × campaign).

Khi có spend, các chỉ số tính được:
```
CPL  = spend / leads
CPA  = spend / paid_orders
ROAS = revenue / spend
```
Trước đó, API trả `adSpend: null` + `dataAvailability.adSpend = "NOT_CONNECTED"`, FE hiện
"Chưa kết nối Ads API" — không hiện ROAS bằng 0 hay ∞.

## 10.9 Chống nhiễu dữ liệu tracking

| Rủi ro | Xử lý |
|---|---|
| Bot/crawler | lọc user-agent theo danh sách + bỏ session 1 pageview 0 giây |
| Self-traffic (nhân viên) | `settings.tracking_exclude_ips` |
| Click farm trên tracking link | rate limit theo IP + đếm unique visitor, không chỉ click |
| UTM typo | màn hình "Unmapped UTM", không auto tạo campaign |
| Cookie bị chặn | vẫn nhận lead (visitorKey null) — attribution suy từ UTM trong payload |
| Ad blocker chặn tracking | tracking là tùy chọn; lead vẫn vào qua form → không mất khách |

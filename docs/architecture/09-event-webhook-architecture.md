# 09 — EVENT & WEBHOOK ARCHITECTURE (§80 Bước 9)

## 9.1 Danh mục Domain Event

Tên dạng `<aggregate>.<past_tense>`. Payload luôn có `eventId`, `eventType`, `occurredAt`,
`aggregateType`, `aggregateId`, `actor`, `correlationId`, `websiteId?`, `data`.

| Event | Phát khi | Consumer nội bộ | Gửi webhook ngoài |
|---|---|---|---|
| `lead.created` | Lead ghi nhận xong | Notification, Attribution, Reporting | ✅ |
| `lead.duplicate_flagged` | Match yếu → review queue | Notification (Admin) | — |
| `lead.qualified` | Lead đủ điều kiện | Reporting | ✅ |
| `customer.created` | Customer mới | Notification, Reporting | ✅ |
| `customer.updated` | Sửa thông tin | Timeline, Audit | — |
| `customer.status_changed` | §35/§48 | Notification, Timeline, Reporting | ✅ |
| `customer.assigned` | Giao data | Notification (người nhận), Timeline | ✅ |
| `customer.unassigned` | Thu hồi | Notification, Timeline | — |
| `customer.reassigned` | Chuyển người | Notification (cả 2), Timeline | ✅ |
| `customer.recycled` | Về pool (SLA/nghỉ việc) | Notification (Admin/Leader) | — |
| `customer.merged` | Gộp khách | Timeline, Reporting | — |
| `customer.note_added` | Thêm ghi chú | Timeline | — |
| `task.created` | Tạo follow-up | — | — |
| `task.due` | Đến `remind_at` | Notification (Sale) | — |
| `task.overdue` | Quá `due_at` | Notification (Sale + Leader) | — |
| `task.completed` | Hoàn thành | Reporting, Timeline | — |
| `order.created` | Tạo đơn | Notification, Attribution snapshot, Timeline | ✅ |
| `order.status_changed` | Đổi trạng thái đơn | Notification, Timeline | ✅ |
| `order.cancelled` | Hủy đơn | Revenue reversal, Notification | ✅ |
| `payment.paid` | Payment `SUCCEEDED` | **Revenue**, Notification, Reporting, Timeline | ✅ |
| `payment.refunded` | Refund | Revenue reversal, Notification | ✅ |
| `post.published` | Bài lên sóng | Cache invalidate website | ✅ |
| `api_key.expiring_soon` | Job phát hiện | Notification (Admin) | — |
| `integration.failed` | Lỗi tích hợp | Notification (Admin) | — |
| `webhook.dead_lettered` | Hết retry | Notification (Admin) | — |
| `import.completed` | Import xong | Notification (người tạo) | — |
| `user.role_changed` | Đổi role | Notification, revoke session | — |
| `user.locked` | Khóa tài khoản | revoke session | — |

### Ví dụ `payment.paid` (§67)

```jsonc
{
  "eventId": "01JBQ8F3K2M9XV7T4NRSABCDE",
  "eventType": "payment.paid",
  "occurredAt": "2026-09-04T07:12:33.120Z",
  "aggregateType": "payment",
  "aggregateId": "uuid-payment",
  "correlationId": "01JBQ8...",
  "actor": { "type": "USER", "id": "uuid", "name": "Sale Nguyễn Văn An", "role": "SALE" },
  "websiteId": "uuid-website",
  "data": {
    "paymentId": "uuid", "paymentCode": "TT20260904-0018",
    "orderId": "uuid", "orderCode": "DH20260904-0007",
    "customerId": "uuid", "customerCode": "KH00842",
    "amount": 12000000, "currency": "VND", "method": "BANK_TRANSFER",
    "paidAt": "2026-09-04T07:12:00Z",
    "saleId": "uuid", "teamId": "uuid",
    "attribution": { "sourceCode": "tiktok", "campaignCode": "campaign01",
                     "landingPageCode": "lp-tiktok-01", "trackingLinkSlug": "tiktok01" }
  }
}
```

Handler chạy song song, **độc lập**, mỗi handler idempotent:
```
payment.paid
 ├─► RevenueHandler       → INSERT revenue_entries (UNIQUE payment_id+rule_code chống trùng)
 ├─► NotificationHandler  → notifications cho Leader + Admin theo rule
 ├─► ReportingHandler     → invalidate cache dashboard, cập nhật customers.total_revenue
 ├─► TimelineHandler      → customer_timeline_events (kind=PAYMENT)
 └─► WebhookHandler       → webhook_deliveries cho mọi webhook đăng ký payment.paid
```

## 9.2 Transactional Outbox — cơ chế

Ghi:
```sql
BEGIN;
  UPDATE payments SET status='SUCCEEDED', paid_at=now() WHERE id=$1;
  INSERT INTO audit_logs (...) VALUES (...);
  INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload, metadata)
    VALUES ('payment.paid', 'payment', $1, $payload, $meta);
COMMIT;
```

Đọc (worker, mỗi 1s):
```sql
WITH batch AS (
  SELECT id FROM outbox_events
  WHERE status IN ('PENDING','FAILED') AND available_at <= now()
  ORDER BY created_at
  LIMIT 100
  FOR UPDATE SKIP LOCKED
)
UPDATE outbox_events o SET status='PROCESSING', attempt_count = attempt_count + 1
FROM batch WHERE o.id = batch.id
RETURNING o.*;
```

Xử lý xong: `status='PROCESSED', processed_at=now()`.
Lỗi: `status='FAILED'`, `available_at = now() + backoff(attempt_count)`, `last_error`.
Quá `max_attempts` (5): `status='DEAD_LETTER'` + event `webhook.dead_lettered`/alert.

`SKIP LOCKED` cho phép nhiều worker chạy song song không tranh nhau. Nếu chạy 1 worker
process thì vẫn nên dùng — an toàn khi scale sau này.

## 9.3 Idempotency của handler

Outbox đảm bảo **at-least-once**, không phải exactly-once. Mỗi handler phải chịu được chạy lại:

| Handler | Cách đảm bảo |
|---|---|
| RevenueHandler | `UNIQUE (payment_id, rule_code)` → INSERT trùng bị chặn |
| WebhookHandler | `UNIQUE (webhook_id, event_id)` trên `webhook_deliveries` |
| NotificationHandler | `UNIQUE (recipient_user_id, event_type, entity_id)` cho notification không trùng |
| TimelineHandler | `UNIQUE (customer_id, kind, ref_table, ref_id)` |
| ReportingHandler | phép tính idempotent (recompute, không increment) |

> Quan trọng: **không dùng `UPDATE ... SET count = count + 1`** trong handler. Nếu event
> replay, số sẽ sai. Luôn recompute từ nguồn hoặc dùng unique constraint.

## 9.4 Webhook OUTBOUND (§66)

### Đăng ký
```json
POST /api/v1/webhooks
{ "name": "Đồng bộ sang hệ thống kế toán",
  "url": "https://partner.example.com/hooks/crm",
  "eventTypes": ["order.created","payment.paid"],
  "maxAttempts": 5, "timeoutMs": 10000 }
```
Response trả `secret` **một lần** (như API key).

### Request gửi ra
```http
POST https://partner.example.com/hooks/crm
Content-Type: application/json
X-Crm-Event: payment.paid
X-Crm-Event-Id: 01JBQ8F3K2M9XV7T4NRSABCDE
X-Crm-Delivery-Id: 918273
X-Crm-Timestamp: 1788500753
X-Crm-Signature: sha256=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
X-Crm-Attempt: 1

{ ...payload như 9.1... }
```

Signature: `HMAC-SHA256(secret, "{timestamp}.{raw_body}")`. Bên nhận phải:
1. Kiểm `timestamp` lệch ≤ 5 phút (chống replay).
2. So signature bằng hàm **constant-time**.
3. Dedupe theo `X-Crm-Event-Id`.

### Retry & backoff

| Lần | Chờ | Tích lũy |
|---|---|---|
| 1 | ngay | 0 |
| 2 | 1 phút | 1p |
| 3 | 5 phút | 6p |
| 4 | 15 phút | 21p |
| 5 | 1 giờ | 1g21p |
| 6 | 6 giờ | 7g21p → hết |

Sau lần cuối: `status='DEAD_LETTER'`, `webhooks.consecutive_failures++`. Khi
`consecutive_failures >= 20` → tự `status='PAUSED'` + notification Admin (bảo vệ hệ thống
khỏi endpoint đã chết). Admin có thể `POST /webhooks/deliveries/{id}/retry` thủ công.

Coi là **thành công**: HTTP 2xx. **Không retry**: 4xx (trừ 408, 429) — lỗi phía client, retry
vô nghĩa. **Retry**: 5xx, 408, 429 (tôn trọng `Retry-After`), timeout, lỗi mạng.

`response_body` lưu tối đa 2KB, đã redact. `payload` lưu đầy đủ để retry được.

## 9.5 Webhook INBOUND (§66)

```
POST /api/v1/webhooks/in/{slug}
```
Không dùng JWT. Xác thực theo cấu hình của webhook đó:
- **HMAC signature** (khuyến nghị): verify như trên, secret riêng.
- **Shared token** trong header (cho provider không hỗ trợ HMAC).
- **IP allowlist** bổ sung.

Pipeline:
```
1 Tìm webhook theo slug → nếu DISABLED/không có → 404
2 Verify signature/token → sai → 401 (log integration_logs)
3 Idempotency: dùng event id của provider làm Idempotency-Key
4 Map payload theo adapter của provider (Facebook Lead Ads, TikTok, form builder, custom)
5 Gọi ingestLead(...) — CÙNG pipeline với POST /leads (không có đường tắt)
6 Ghi integration_logs + cập nhật integrations counters
7 Trả 200 nhanh (< 5s). Việc nặng đẩy vào queue.
```

Provider adapter là code riêng cho từng nguồn, nhưng **đích đến luôn là `ingestLead`** — nên
dedupe, attribution, audit không bao giờ bị bỏ qua.

## 9.6 Khi nào cần message broker

MVP: in-process EventBus + Outbox + BullMQ là đủ. Chuyển sang broker (Kafka/RabbitMQ/NATS) khi:
- Cần fan-out cho nhiều service độc lập (đã tách microservice).
- Cần replay event history dài hạn cho hệ thống khác.
- Throughput event > ~10k/s.

Chuẩn bị sẵn: `outbox_events` đã là event log có `event_type` + `payload` + thứ tự → publish
sang broker chỉ là thêm một dispatcher, không đổi code phát event.

## 9.7 Sơ đồ tổng

```
┌──────────────── API request (user hoặc website) ────────────────┐
│  Service (1 transaction)                                         │
│    ├ ghi bảng nghiệp vụ                                          │
│    ├ ghi bảng lịch sử (append-only)                              │
│    ├ ghi audit_logs                                              │
│    └ ghi outbox_events (PENDING)                                 │
│  COMMIT ─────────────────────────────────────────────────────────┤
└──────────────────────────────┬───────────────────────────────────┘
                               │ (worker poll 1s, SKIP LOCKED)
                    ┌──────────▼──────────┐
                    │  OutboxDispatcher   │
                    └──────────┬──────────┘
        ┌───────────┬──────────┼──────────┬────────────┐
        ▼           ▼          ▼          ▼            ▼
  Revenue     Notification  Timeline  Reporting    Webhook
  Handler       Handler     Handler    Handler     Handler
                   │                                  │
                   ▼                                  ▼
             notifications                    webhook_deliveries
                   │                                  │
                   ▼                          ┌───────▼────────┐
              SSE → FE                        │ BullMQ queue   │
                                              │ retry/backoff  │
                                              └───────┬────────┘
                                                      ▼
                                            External System (2xx?)
                                              ├ có → DELIVERED
                                              └ không → FAILED → retry → DEAD_LETTER
```

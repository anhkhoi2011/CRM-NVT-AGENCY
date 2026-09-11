# 06 — ERD (§80 Bước 6)

Chia thành 7 sơ đồ theo domain để đọc được. Ký hiệu Mermaid:
`||--o{` = một-nhiều · `}o--||` = nhiều-một · `||--||` = một-một · `}o--o{` = nhiều-nhiều.

## 6.1 AUTH / RBAC / TEAM

```mermaid
erDiagram
    roles ||--o{ users : "1 role - n users"
    roles ||--o{ role_permissions : has
    permissions ||--o{ role_permissions : granted_in
    permissions ||--o{ user_permission_overrides : overridden_in
    users ||--o{ user_permission_overrides : has
    users ||--o{ auth_sessions : owns
    users ||--o{ password_reset_tokens : requests
    users ||--o{ user_role_history : logged_in
    users ||--o{ team_members : joins
    teams ||--o{ team_members : contains
    users ||--o{ teams : "leads (leader_id)"
    users ||--o{ team_membership_history : logged_in
    teams ||--o{ team_membership_history : from_to

    roles {
        uuid id PK
        text code UK "ADMIN|LEADER|SALE — CHECK khóa 3 giá trị"
        text default_scope "ALL|TEAM|OWN|NONE"
        boolean is_system
    }
    users {
        uuid id PK
        text email_normalized UK "partial: deleted_at IS NULL"
        text phone_normalized UK "partial"
        text password_hash "Argon2id"
        uuid role_id FK
        text scope_override "nullable — ghi đè scope role"
        text status "ACTIVE|LOCKED|INVITED|DISABLED"
        timestamptz deleted_at
    }
    permissions {
        uuid id PK
        text code UK "customer.view, order.create, ..."
        text module
        text action
    }
    user_permission_overrides {
        uuid id PK
        uuid user_id FK
        uuid permission_id FK
        text effect "ALLOW|DENY"
        text scope
        timestamptz expires_at
        timestamptz revoked_at
    }
    teams {
        uuid id PK
        text code UK
        uuid leader_id FK
        text status
    }
    team_members {
        uuid id PK
        uuid team_id FK
        uuid user_id FK "UK partial: WHERE is_active"
        timestamptz joined_at
        timestamptz left_at
        boolean is_active
    }
```

> Sơ đồ trên là bản đọc nhanh. Định nghĩa chuẩn (kèm index, CHECK, partial unique) nằm ở
> `05-database-schema.md`.

## 6.2 CUSTOMER / LEAD / STATUS / TIMELINE

```mermaid
erDiagram
    customer_statuses ||--o{ customers : "current_status_id"
    customer_statuses ||--o{ customer_status_history : old_status
    customer_statuses ||--o{ customer_status_history : new_status
    customers ||--o{ customer_status_history : has
    customers ||--o{ customer_contacts : has
    customers ||--o{ customer_notes : has
    customers ||--o{ customer_timeline_events : has
    customers ||--o{ customer_tasks : has
    customers ||--o{ leads : "n leads - 1 customer"
    customers ||--o{ customer_merge_history : primary
    leads ||--o{ lead_events : logged
    leads ||--o{ lead_duplicate_reviews : flagged
    customers ||--o{ lead_duplicate_reviews : suspected
    customer_status_history ||--o| customer_notes : "note gắn 1 lần đổi status"
    users ||--o{ customer_status_history : changed_by
    users ||--o{ customer_notes : created_by

    customers {
        uuid id PK
        text code UK
        text full_name
        text phone_normalized UK "partial — chống trùng §29"
        text email_normalized UK "partial"
        uuid current_status_id FK
        timestamptz status_updated_at
        uuid assigned_sale_id FK "denormalize"
        uuid assigned_leader_id FK "denormalize"
        uuid assigned_team_id FK "denormalize"
        text pool_state
        bigint first_touch_id FK
        bigint last_touch_id FK
        uuid merged_into_id FK
        timestamptz deleted_at
    }
    customer_statuses {
        uuid id PK
        text code UK
        text name
        text kind "PIPELINE|WON|LOST|NEUTRAL"
        boolean is_funnel_stage
        int funnel_order
        boolean is_default "UK partial"
        boolean is_system
        boolean notify_on_change
    }
    customer_status_history {
        bigserial id PK
        uuid customer_id FK
        uuid old_status_id FK
        uuid new_status_id FK
        uuid changed_by FK
        text changed_by_role
        text note
        text channel "WEB|API|SYSTEM|IMPORT"
        timestamptz created_at
    }
    leads {
        uuid id PK
        text code UK
        uuid customer_id FK "nullable đến khi gắn"
        text raw_phone
        text phone_normalized
        uuid website_id FK
        uuid landing_page_id FK
        uuid source_id FK
        uuid campaign_id FK
        uuid tracking_link_id FK
        jsonb raw_payload
        text status "NEW|QUALIFIED|CONVERTED|DUPLICATE|SPAM"
    }
    customer_tasks {
        uuid id PK
        uuid customer_id FK
        uuid assigned_user_id FK
        text type "CALL|MESSAGE|MEETING|FOLLOW_UP|CUSTOM"
        timestamptz due_at
        timestamptz remind_at
        text status "OPEN|IN_PROGRESS|COMPLETED|CANCELLED|OVERDUE"
    }
```

## 6.3 ASSIGNMENT / DATA POOL

```mermaid
erDiagram
    customers ||--o| customer_assignments : "1 active"
    customers ||--o{ assignment_history : "n lần giao/thu"
    customers ||--o| data_pool_entries : "1 open"
    users ||--o{ customer_assignments : "sale_id / leader_id"
    users ||--o{ assignment_history : "from/to"
    teams ||--o{ customer_assignments : team
    teams ||--o{ assignment_history : "from_team/to_team"
    leads ||--o{ customer_assignments : lead

    customer_assignments {
        uuid id PK
        uuid customer_id FK "UK partial WHERE is_active"
        uuid leader_id FK
        uuid sale_id FK
        uuid team_id FK
        text state "ASSIGNED_TO_LEADER|ASSIGNED_TO_SALE|WORKING"
        uuid assigned_by FK
        timestamptz sla_due_at
        timestamptz first_contacted_at
        timestamptz released_at
        boolean is_active
    }
    assignment_history {
        bigserial id PK
        uuid customer_id FK
        text action "ASSIGN_TO_LEADER|ASSIGN_TO_SALE|REASSIGN|REVOKE|RECYCLE|CLOSE|AUTO_ASSIGN"
        uuid from_sale_id FK
        uuid to_sale_id FK
        uuid from_leader_id FK
        uuid to_leader_id FK
        uuid from_team_id FK
        uuid to_team_id FK
        text reason
        uuid actor_id FK
        uuid batch_id "gom 1 lần assign batch"
        timestamptz created_at
    }
    data_pool_entries {
        uuid id PK
        uuid customer_id FK "UK partial WHERE exited_at IS NULL"
        text state "UNASSIGNED|RESERVED|ASSIGNED|RECYCLED|CLOSED"
        uuid owner_leader_id FK
        int priority
        int recycle_count
        timestamptz entered_at
        timestamptz exited_at
    }
```

## 6.4 WEBSITE / MARKETING / TRACKING / ATTRIBUTION

```mermaid
erDiagram
    websites ||--o{ website_domains : has
    websites ||--o{ landing_pages : has
    websites ||--o{ campaigns : has
    websites ||--o{ tracking_links : has
    websites ||--o{ api_clients : has
    websites ||--o{ visitors : visited
    lead_sources ||--o{ campaigns : source
    lead_sources ||--o{ tracking_links : source
    lead_sources ||--o{ leads : source
    lead_sources ||--o{ customer_touchpoints : source
    campaigns ||--o{ tracking_links : campaign
    campaigns ||--o{ leads : campaign
    campaigns ||--o{ customer_touchpoints : campaign
    landing_pages ||--o{ leads : submitted_on
    landing_pages ||--o{ tracking_sessions : entry
    api_clients ||--o| landing_pages : serves
    visitors ||--o{ tracking_sessions : has
    tracking_sessions ||--o{ page_views : contains
    tracking_sessions ||--o{ tracking_events : contains
    tracking_sessions ||--o| leads : converted
    visitors ||--o| customers : identified_as
    customers ||--o{ customer_touchpoints : "n touchpoints"
    customers ||--o{ customer_source_history : has
    customer_touchpoints ||--o| customer_source_history : recorded_in
    customer_touchpoints ||--o{ attribution_snapshots : first_touch
    customer_touchpoints ||--o{ attribution_snapshots : last_touch

    websites {
        uuid id PK
        text code UK
        text primary_domain
        text timezone
        uuid logo_media_id FK
        text status
    }
    website_domains {
        uuid id PK
        uuid website_id FK
        text domain UK
        text type "PRIMARY|ALIAS|SUBDOMAIN"
        boolean is_verified "CORS chỉ dùng khi verified"
    }
    landing_pages {
        uuid id PK
        uuid website_id FK "nullable = độc lập"
        text code UK
        text url
        uuid api_client_id FK
    }
    lead_sources {
        uuid id PK
        text code UK
        text source_group "SOCIAL|SEARCH|VIDEO|WEBSITE|LANDING|REFERRAL|DIRECT|OTHER"
        text traffic_type "PAID|ORGANIC|REFERRAL|DIRECT|OTHER"
        text_array utm_source_match
    }
    tracking_links {
        uuid id PK
        text slug UK "/go/{slug}"
        text destination_url
        uuid campaign_id FK
        uuid source_id FK
    }
    customer_touchpoints {
        bigserial id PK
        uuid customer_id FK
        uuid lead_id FK
        int sequence_no "UK với customer_id"
        text touch_type "VISIT|CLICK|LEAD_SUBMIT|CONVERSION|MANUAL|IMPORT"
        timestamptz occurred_at
    }
    visitors {
        uuid id PK
        text visitor_key UK "pseudonymous, cookie 1st-party"
        uuid customer_id FK "khi submit form"
        text ip_hash "IP chỉ khi settings cho phép"
    }
```

## 6.5 SALES / BILLING

```mermaid
erDiagram
    customers ||--o{ orders : places
    leads ||--o{ orders : converted_from
    orders ||--o{ order_items : contains
    orders ||--o{ order_status_history : logged
    orders ||--o{ payments : receives
    orders ||--|| attribution_snapshots : "1-1 snapshot"
    orders ||--o{ revenue_entries : recognized_as
    payments ||--o{ revenue_entries : "sinh từ payment"
    products ||--o{ order_items : sold_as
    products ||--o{ product_images : has
    products }o--o{ websites : product_websites
    users ||--o{ orders : "sale_id"
    teams ||--o{ orders : team
    customers ||--o{ payments : pays

    orders {
        uuid id PK
        text code UK
        uuid customer_id FK
        uuid lead_id FK
        uuid website_id FK
        uuid source_id FK
        uuid campaign_id FK
        uuid landing_page_id FK
        uuid tracking_link_id FK
        uuid sale_id FK
        uuid team_id FK
        numeric total_amount
        numeric paid_amount "job đối soát từ payments"
        text status "PENDING|CONFIRMED|PROCESSING|PAID|COMPLETED|CANCELLED|REFUNDED"
    }
    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        text product_code "SNAPSHOT"
        text product_name "SNAPSHOT"
        int quantity
        numeric unit_price "SNAPSHOT giá lúc bán"
        numeric line_total
    }
    payments {
        uuid id PK
        text code UK
        uuid order_id FK
        uuid customer_id FK
        text type "PAYMENT|REFUND|ADJUSTMENT"
        numeric amount "REFUND = số âm"
        text status "PENDING|SUCCEEDED|FAILED|CANCELLED"
        text gateway
        text gateway_txn_id "UK với gateway"
        timestamptz paid_at
    }
    revenue_entries {
        uuid id PK
        uuid order_id FK
        uuid payment_id FK "UK với rule_code"
        numeric amount
        text entry_type "RECOGNIZED|REVERSAL|ADJUSTMENT"
        timestamptz recognized_at
        text rule_code
        boolean is_system_generated
    }
    attribution_snapshots {
        uuid id PK
        uuid order_id FK "UK 1-1"
        text campaign_name "COPY — campaign đổi tên vẫn truy được"
        text source_name "COPY"
        text landing_page_name "COPY"
        jsonb utm
        int touch_count
        numeric days_to_convert
    }
```

## 6.6 CMS / MEDIA

```mermaid
erDiagram
    categories ||--o{ posts : categorizes
    categories ||--o{ categories : parent
    posts }o--o{ tags : post_tags
    posts }o--o{ websites : post_websites
    posts ||--o{ post_revisions : versioned
    users ||--o{ posts : authored
    media ||--o{ posts : thumbnail
    media ||--o{ posts : banner
    media ||--o{ posts : og_image
    media ||--o{ products : image
    media ||--o{ product_images : ref
    media ||--o{ websites : logo
    media ||--o{ users : avatar
    media ||--o{ import_jobs : source_file
    media ||--o{ export_jobs : result_file

    posts {
        uuid id PK
        text title
        text slug "unique THEO website qua post_websites"
        text status "DRAFT|SCHEDULED|PUBLISHED|UNPUBLISHED|ARCHIVED"
        timestamptz published_at
        timestamptz scheduled_at
        text meta_title
        text canonical_url
        boolean robots_index
    }
    post_websites {
        uuid post_id PK_FK
        uuid website_id PK_FK
        text slug "UK (website_id, slug)"
        boolean is_visible
    }
    media {
        uuid id PK
        uuid website_id FK "nullable = dùng chung"
        text storage_provider "S3|R2|LOCAL|EXTERNAL"
        text storage_key
        text public_url
        text mime_type
        text checksum_sha256
        text media_type "IMAGE|VIDEO|DOCUMENT|SPREADSHEET|OTHER"
    }
```

## 6.7 INTEGRATION / EVENT / AUDIT / IMPORT-EXPORT

```mermaid
erDiagram
    api_clients ||--o{ api_keys : issues
    api_clients ||--o{ webhooks : owns
    api_clients ||--o{ integration_logs : logged
    api_clients ||--o{ idempotency_records : scoped_by
    api_clients ||--o{ leads : submitted_via
    websites ||--o{ webhooks : scoped_to
    webhooks ||--o{ webhook_deliveries : delivers
    outbox_events ||--o{ webhook_deliveries : triggers
    integrations ||--o{ integration_logs : logged
    api_keys ||--o{ integration_logs : used_in
    notification_rules ||--o{ notifications : produced
    users ||--o{ notifications : receives
    users ||--o{ audit_logs : acted
    api_clients ||--o{ audit_logs : acted
    users ||--o{ import_jobs : created
    import_jobs ||--o{ import_rows : has
    import_jobs ||--o{ import_errors : has
    import_rows ||--o{ import_errors : detail
    users ||--o{ export_jobs : created
    settings ||--o{ settings_history : versioned

    api_keys {
        uuid id PK
        uuid api_client_id FK
        text key_prefix UK "tra cứu nhanh"
        text key_hash "KHÔNG plaintext"
        text key_last_four "hiển thị UI"
        text_array scopes "lead:create, customer:read,..."
        int rate_limit_per_minute
        timestamptz expires_at
        timestamptz revoked_at
        uuid rotated_from_id FK
    }
    webhooks {
        uuid id PK
        text direction "INBOUND|OUTBOUND"
        text url
        text_array event_types
        bytea secret_enc "HMAC signature"
        int max_attempts
        int consecutive_failures "tự PAUSE khi vượt ngưỡng"
    }
    webhook_deliveries {
        bigserial id PK
        uuid webhook_id FK
        uuid event_id "UK với webhook_id — không gửi trùng"
        int attempt_count
        text status "PENDING|IN_FLIGHT|DELIVERED|FAILED|DEAD_LETTER|CANCELLED"
        int response_code
        timestamptz next_retry_at
    }
    outbox_events {
        uuid id PK
        text event_type
        text aggregate_type
        text aggregate_id
        jsonb payload
        text status "PENDING|PROCESSING|PROCESSED|FAILED|DEAD_LETTER"
        int attempt_count
        timestamptz available_at
    }
    idempotency_records {
        uuid id PK
        text idempotency_key "UK (client|user, key, endpoint)"
        text request_hash "SHA-256 body"
        text state "IN_PROGRESS|COMPLETED|FAILED"
        int response_status
        jsonb response_body
        timestamptz expires_at
    }
    audit_logs {
        bigserial id PK
        uuid actor_user_id FK
        text actor_name "SNAPSHOT"
        text action
        text module
        text entity_type
        text entity_id
        jsonb old_values "đã redact"
        jsonb new_values
        text channel "WEB|API|SYSTEM|IMPORT|JOB"
        uuid correlation_id
    }
```

## 6.8 Quan hệ trọng yếu — diễn giải bằng chữ (§58)

**Chuỗi nghiệp vụ chính**
```
users ──(role_id)──► roles                        1 user = 1 trong 3 role
users ──(team_members)──► teams                   Leader/Sale thuộc team, có lịch sử
customers ──(customer_assignments, is_active)──► users(sale/leader)   1 active
customers ──(assignment_history)──► *             n lần giao/thu, append-only
customers ──(current_status_id)──► customer_statuses                  trạng thái hiện tại
customers ──(customer_status_history)──► *        toàn bộ lịch sử, append-only
customers ──(leads)──► n leads                    1 người có nhiều lần bày tỏ quan tâm
customers ──(orders)──► order_items ──► products
orders ──(payments)──► revenue_entries            tiền → ghi nhận doanh thu
orders ──(attribution_snapshots)──► 1-1           bối cảnh conversion đóng băng
```

**Chuỗi marketing**
```
websites ──► website_domains (CORS/định danh request)
websites ──► landing_pages ──► api_clients ──► api_keys
lead_sources + campaigns ──► tracking_links (/go/{slug})
visitors ──► tracking_sessions ──► page_views / tracking_events
tracking_sessions ──(converted_lead_id)──► leads
customers ──► customer_touchpoints (sequence_no 1..n) ──► first/last touch
```

**Chuỗi tích hợp**
```
Domain change ──► outbox_events (cùng transaction)
outbox_events ──► webhook_deliveries ──► external system (retry/backoff/dead-letter)
outbox_events ──► notifications (qua notification_rules)
mọi thay đổi quan trọng ──► audit_logs (cùng transaction)
```

## 6.9 Điểm cần chú ý khi đọc ERD

1. **`customers.assigned_*` và `customers.current_status_id` là cache**, không phải nguồn sự
   thật — nguồn là `customer_assignments` / `customer_status_history` (xem `05a` mục 2).
2. **Không có FK từ `page_views`/`tracking_events` sang `tracking_sessions`** trong DDL vì
   hai bảng đó partition và write-heavy; toàn vẹn được bảo đảm ở tầng ứng dụng. Nếu bạn muốn
   FK cứng, phải bỏ partition hoặc thêm FK theo từng partition.
3. **`attribution_snapshots` cố tình lưu cả FK và tên dạng TEXT** — trùng lặp có chủ đích để
   Order truy ngược được ngay cả khi campaign/landing bị đổi tên hoặc archive (§74).
4. **`leads.customer_id` nullable** trong khoảnh khắc ingest (trước khi dedupe xong), sau đó
   luôn có giá trị. Job đối soát sẽ báo nếu còn lead treo.

# 05 — DATABASE SCHEMA (§80 Bước 5)

PostgreSQL 16. Quy ước chung áp dụng cho **mọi** bảng:

| Quy ước | Chi tiết |
|---|---|
| Khóa chính | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (pgcrypto). Bảng append-only lớn (`page_views`, `tracking_events`) dùng `BIGSERIAL` để index nhỏ hơn |
| Thời gian | `TIMESTAMPTZ`, luôn lưu **UTC**. Format `dd/MM/yyyy HH:mm` chỉ ở FE |
| Tiền | `NUMERIC(18,2)` + `currency CHAR(3)` (mặc định `VND`). **Không dùng float** |
| Soft delete | `deleted_at TIMESTAMPTZ`, `deleted_by UUID`, `delete_reason TEXT`. Query mặc định `WHERE deleted_at IS NULL` |
| Audit cột | `created_at`, `updated_at`, `created_by`, `updated_by` |
| Đặt tên | bảng `snake_case` số nhiều; FK `<entity>_id`; index `idx_<table>__<cols>`; unique `uq_<table>__<cols>` |
| Enum | Dùng bảng tham chiếu cho thứ có thể cấu hình (status khách, source). Dùng `TEXT + CHECK` cho enum kỹ thuật cố định (order status, webhook state) — dễ migrate hơn native ENUM |
| Bảng lịch sử | Append-only: **không** `UPDATE`, **không** `DELETE`. Enforce bằng REVOKE quyền + trigger chặn |

---

## 5.1 AUTH / USER / RBAC

```sql
-- 3 role cố định. Seed đúng 3 dòng, không hơn.
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE
              CHECK (code IN ('ADMIN','LEADER','SALE')),   -- KHÓA: chỉ 3 role
  name        TEXT NOT NULL,
  description TEXT,
  -- Data scope mặc định của role
  default_scope TEXT NOT NULL CHECK (default_scope IN ('ALL','TEAM','OWN','NONE')),
  is_system   BOOLEAN NOT NULL DEFAULT TRUE,   -- không cho xóa
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Chốt cứng: không thể thêm role thứ 4
CREATE UNIQUE INDEX uq_roles__only_three ON roles (code);

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE,                    -- mã nhân sự nội bộ (tùy chọn)
  full_name      TEXT NOT NULL,
  email          TEXT,
  email_normalized TEXT,                          -- lowercase+trim, dùng để đăng nhập/dedupe
  phone          TEXT,
  phone_normalized TEXT,                          -- E.164
  password_hash  TEXT NOT NULL,                   -- Argon2id
  password_changed_at TIMESTAMPTZ,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_media_id UUID REFERENCES media(id),
  role_id        UUID NOT NULL REFERENCES roles(id),   -- 1 user = 1 role (§3)
  -- Ghi đè scope của role cho user cụ thể (§3: khác biệt quyền không tạo role mới)
  scope_override TEXT CHECK (scope_override IN ('ALL','TEAM','OWN','NONE')),
  status         TEXT NOT NULL DEFAULT 'ACTIVE'
                 CHECK (status IN ('ACTIVE','LOCKED','INVITED','DISABLED')),
  mfa_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_enc BYTEA,                            -- mã hóa at-rest, MFA-ready (§59)
  last_login_at  TIMESTAMPTZ,
  last_login_ip  INET,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until   TIMESTAMPTZ,
  timezone       TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  locale         TEXT NOT NULL DEFAULT 'vi-VN',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES users(id),
  updated_by     UUID REFERENCES users(id),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES users(id),
  delete_reason  TEXT,
  CHECK (email_normalized IS NOT NULL OR phone_normalized IS NOT NULL)
);
CREATE UNIQUE INDEX uq_users__email ON users (email_normalized) WHERE deleted_at IS NULL AND email_normalized IS NOT NULL;
CREATE UNIQUE INDEX uq_users__phone ON users (phone_normalized) WHERE deleted_at IS NULL AND phone_normalized IS NOT NULL;
CREATE INDEX idx_users__role_status ON users (role_id, status) WHERE deleted_at IS NULL;

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,          -- 'customer.view', 'order.create', ...
  module      TEXT NOT NULL,                 -- 'customer', 'order', 'system'
  action      TEXT NOT NULL,                 -- 'view','create','update','assign',...
  description TEXT,
  is_dangerous BOOLEAN NOT NULL DEFAULT FALSE, -- cần xác nhận 2 bước ở UI
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  -- scope riêng cho permission này nếu khác default của role
  scope         TEXT CHECK (scope IN ('ALL','TEAM','OWN','NONE')),
  PRIMARY KEY (role_id, permission_id)
);

-- §3/§5: khác biệt quyền giữa 2 user cùng role
CREATE TABLE user_permission_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect        TEXT NOT NULL CHECK (effect IN ('ALLOW','DENY')),
  scope         TEXT CHECK (scope IN ('ALL','TEAM','OWN','NONE')),
  reason        TEXT,
  expires_at    TIMESTAMPTZ,                 -- cấp quyền tạm thời
  granted_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  revoked_by    UUID REFERENCES users(id)
);
CREATE UNIQUE INDEX uq_upo__active ON user_permission_overrides (user_id, permission_id)
  WHERE revoked_at IS NULL;

CREATE TABLE auth_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,           -- chỉ hash, không plaintext
  family_id         UUID NOT NULL,            -- rotation family, phát hiện reuse
  ip                INET,
  user_agent        TEXT,
  device_label      TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ,
  revoke_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at      TIMESTAMPTZ
);
CREATE INDEX idx_auth_sessions__user ON auth_sessions (user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX uq_auth_sessions__token ON auth_sessions (refresh_token_hash);

CREATE TABLE password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),       -- Admin khởi tạo reset
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §5: lịch sử Role (append-only)
CREATE TABLE user_role_history (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  old_role_id UUID REFERENCES roles(id),
  new_role_id UUID NOT NULL REFERENCES roles(id),
  reason      TEXT,
  changed_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_urh__user ON user_role_history (user_id, created_at DESC);
```

### Seed RBAC (§81)

```sql
INSERT INTO roles (code, name, default_scope) VALUES
  ('ADMIN',  'Admin',  'ALL'),
  ('LEADER', 'Leader', 'TEAM'),
  ('SALE',   'Sale',   'OWN');
-- KHÔNG có SUPER_ADMIN / OWNER / MANAGER / STAFF / EDITOR
```

---

## 5.2 TEAM

```sql
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  leader_id   UUID REFERENCES users(id),     -- Leader chính
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id),
  updated_by  UUID REFERENCES users(id),
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID REFERENCES users(id),
  delete_reason TEXT
);
CREATE UNIQUE INDEX uq_teams__code ON teams (code) WHERE deleted_at IS NULL;
CREATE INDEX idx_teams__leader ON teams (leader_id) WHERE deleted_at IS NULL;

CREATE TABLE team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  role_in_team TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role_in_team IN ('LEADER','MEMBER')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at    TIMESTAMPTZ,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id)
);
-- 1 user chỉ active ở 1 team tại 1 thời điểm (xem 19-open-questions Q7 nếu cần multi-team)
CREATE UNIQUE INDEX uq_team_members__active_user ON team_members (user_id) WHERE is_active;
CREATE INDEX idx_team_members__team ON team_members (team_id) WHERE is_active;

-- §6: không mất lịch sử khi chuyển team (append-only)
CREATE TABLE team_membership_history (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id),
  from_team_id UUID REFERENCES teams(id),
  to_team_id   UUID REFERENCES teams(id),
  action     TEXT NOT NULL CHECK (action IN ('JOIN','LEAVE','MOVE','LEADER_ASSIGNED','LEADER_REMOVED')),
  reason     TEXT,
  changed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tmh__user ON team_membership_history (user_id, created_at DESC);
```

---

## 5.3 WEBSITE / DOMAIN / LANDING PAGE

```sql
CREATE TABLE websites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  code             TEXT NOT NULL,
  primary_domain   TEXT,
  default_language TEXT NOT NULL DEFAULT 'vi-VN',
  timezone         TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  logo_media_id    UUID REFERENCES media(id),
  favicon_media_id UUID REFERENCES media(id),
  brand_color      TEXT,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES users(id),
  updated_by       UUID REFERENCES users(id),
  deleted_at       TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE UNIQUE INDEX uq_websites__code ON websites (code) WHERE deleted_at IS NULL;

CREATE TABLE website_domains (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id          UUID NOT NULL REFERENCES websites(id),
  domain              TEXT NOT NULL,                 -- lowercase, không scheme, không trailing slash
  type                TEXT NOT NULL DEFAULT 'ALIAS'
                      CHECK (type IN ('PRIMARY','ALIAS','SUBDOMAIN')),
  is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  verification_method TEXT CHECK (verification_method IN ('DNS_TXT','FILE','META_TAG','MANUAL')),
  verification_token  TEXT,
  verified_at         TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES users(id)
);
CREATE UNIQUE INDEX uq_website_domains__domain ON website_domains (domain);
CREATE UNIQUE INDEX uq_website_domains__one_primary ON website_domains (website_id)
  WHERE type = 'PRIMARY';
-- CORS allowlist chỉ đọc domain đã verify + active
CREATE INDEX idx_wd__cors ON website_domains (domain) WHERE is_verified AND status='ACTIVE';

CREATE TABLE landing_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    UUID REFERENCES websites(id),   -- NULL = landing độc lập (§16)
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  url           TEXT NOT NULL,
  description   TEXT,
  api_client_id UUID REFERENCES api_clients(id),
  status        TEXT NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at    TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE UNIQUE INDEX uq_landing_pages__code ON landing_pages (code) WHERE deleted_at IS NULL;
CREATE INDEX idx_landing_pages__website ON landing_pages (website_id) WHERE deleted_at IS NULL;
```

---

## 5.4 MARKETING (SOURCE / CAMPAIGN / TRACKING LINK)

```sql
-- §20/§21: Admin tự tạo, KHÔNG hard-code
CREATE TABLE lead_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  code         TEXT NOT NULL,
  source_group TEXT NOT NULL DEFAULT 'OTHER'
               CHECK (source_group IN ('SOCIAL','SEARCH','VIDEO','WEBSITE','LANDING','REFERRAL','DIRECT','OTHER')),
  traffic_type TEXT NOT NULL DEFAULT 'OTHER'
               CHECK (traffic_type IN ('PAID','ORGANIC','REFERRAL','DIRECT','OTHER')),
  -- Map UTM để tự phân loại lead đến từ link có utm_source
  utm_source_match TEXT[],
  color        TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,   -- 'Direct'/'Unknown' không cho xóa
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at   TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE UNIQUE INDEX uq_lead_sources__code ON lead_sources (code) WHERE deleted_at IS NULL;

CREATE TABLE campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  UUID REFERENCES websites(id),
  source_id   UUID REFERENCES lead_sources(id),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  objective   TEXT,
  -- external id để nối Ads API phase 2 (§27) — KHÔNG tạo bảng ads ở MVP
  external_platform TEXT CHECK (external_platform IN ('FACEBOOK','TIKTOK','GOOGLE','YOUTUBE','ZALO','OTHER')),
  external_campaign_id TEXT,
  budget      NUMERIC(18,2), currency CHAR(3) NOT NULL DEFAULT 'VND',
  start_date  DATE, end_date DATE,
  status      TEXT NOT NULL DEFAULT 'ACTIVE'
              CHECK (status IN ('DRAFT','ACTIVE','PAUSED','ENDED','ARCHIVED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at  TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE UNIQUE INDEX uq_campaigns__code ON campaigns (code) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns__website_status ON campaigns (website_id, status) WHERE deleted_at IS NULL;

CREATE TABLE tracking_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id     UUID REFERENCES websites(id),
  campaign_id    UUID REFERENCES campaigns(id),
  source_id      UUID REFERENCES lead_sources(id),
  landing_page_id UUID REFERENCES landing_pages(id),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,               -- 'tiktok01' → /go/tiktok01
  destination_url TEXT NOT NULL,
  -- UTM gắn thêm khi redirect
  utm_source     TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at     TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE UNIQUE INDEX uq_tracking_links__slug ON tracking_links (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_tracking_links__campaign ON tracking_links (campaign_id) WHERE deleted_at IS NULL;
```

> **Counter click/lead/order/revenue của tracking link KHÔNG là cột ở đây.** Chúng là giá trị
> dẫn xuất, đọc từ `tracking_events` / `leads` / `orders` (hoặc `traffic_daily_aggregates`)
> — tránh hai nguồn số liệu lệch nhau (§74 nguyên tắc nguồn sự thật).

---

## 5.5 CUSTOMER

```sql
-- §36/§71: Admin cấu hình hoàn toàn
CREATE TABLE customer_statuses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  color            TEXT NOT NULL DEFAULT '#64748b',
  kind             TEXT NOT NULL DEFAULT 'PIPELINE'
                   CHECK (kind IN ('PIPELINE','WON','LOST','NEUTRAL')),
  is_funnel_stage  BOOLEAN NOT NULL DEFAULT FALSE,   -- có vào biểu đồ funnel (§26/§45)
  funnel_order     INT,                              -- thứ tự trong funnel
  sort_order       INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_default       BOOLEAN NOT NULL DEFAULT FALSE,   -- status khi lead mới vào
  is_system        BOOLEAN NOT NULL DEFAULT FALSE,   -- không cho xóa
  notify_on_change BOOLEAN NOT NULL DEFAULT FALSE,   -- §49
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at       TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE UNIQUE INDEX uq_customer_statuses__code ON customer_statuses (code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_customer_statuses__one_default ON customer_statuses (is_default)
  WHERE is_default AND deleted_at IS NULL;

CREATE TABLE customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL,                     -- KH00001
  full_name         TEXT NOT NULL,
  phone             TEXT,
  phone_normalized  TEXT,                              -- §29 E.164 theo rule cấu hình
  email             TEXT,
  email_normalized  TEXT,                              -- lowercase + trim
  gender            TEXT CHECK (gender IN ('MALE','FEMALE','OTHER','UNKNOWN')),
  birth_date        DATE,
  address           TEXT, province TEXT, country CHAR(2),
  -- §70: first/last touch denormalize để query nhanh; nguồn đầy đủ ở customer_touchpoints
  first_touch_id    UUID,      -- FK thêm sau khi tạo customer_touchpoints (circular)
  last_touch_id     UUID,
  first_website_id  UUID REFERENCES websites(id),
  last_website_id   UUID REFERENCES websites(id),
  -- §71: chỉ current status ở đây, lịch sử ở customer_status_history
  current_status_id UUID NOT NULL REFERENCES customer_statuses(id),
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_updated_by UUID REFERENCES users(id),
  -- Assignment hiện tại (denormalize để list nhanh; nguồn sự thật = customer_assignments)
  assigned_sale_id   UUID REFERENCES users(id),
  assigned_leader_id UUID REFERENCES users(id),
  assigned_team_id   UUID REFERENCES teams(id),
  assigned_at        TIMESTAMPTZ,
  pool_state        TEXT NOT NULL DEFAULT 'UNASSIGNED'
                    CHECK (pool_state IN ('UNASSIGNED','ASSIGNED_TO_LEADER','ASSIGNED_TO_SALE','WORKING','RECYCLED','CLOSED')),
  -- Snapshot ghi chú mới nhất; bản đầy đủ ở customer_notes
  last_note         TEXT,
  last_contacted_at TIMESTAMPTZ,             -- cho SLA recycle + báo cáo response time
  first_contacted_at TIMESTAMPTZ,            -- §46 average first response time
  tags              TEXT[],
  -- Cache tổng hợp (job đối soát định kỳ, KHÔNG nhập tay)
  order_count       INT NOT NULL DEFAULT 0,
  total_revenue     NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- §30: khi bị merge vào customer khác
  merged_into_id    UUID REFERENCES customers(id),
  linked_user_id    UUID REFERENCES users(id),  -- nối tài khoản nền tảng nếu có
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  created_channel   TEXT NOT NULL DEFAULT 'WEB' CHECK (created_channel IN ('WEB','API','IMPORT','SYSTEM')),
  deleted_at        TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT,
  CHECK (phone_normalized IS NOT NULL OR email_normalized IS NOT NULL)
);
CREATE UNIQUE INDEX uq_customers__code ON customers (code);
-- §29 chống trùng: unique trên định danh đã normalize, chỉ với bản còn sống
CREATE UNIQUE INDEX uq_customers__phone ON customers (phone_normalized)
  WHERE deleted_at IS NULL AND phone_normalized IS NOT NULL;
CREATE UNIQUE INDEX uq_customers__email ON customers (email_normalized)
  WHERE deleted_at IS NULL AND email_normalized IS NOT NULL;
CREATE INDEX idx_customers__sale_status  ON customers (assigned_sale_id, current_status_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers__team         ON customers (assigned_team_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers__pool         ON customers (pool_state) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers__created      ON customers (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers__status_upd   ON customers (current_status_id, status_updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers__tags         ON customers USING GIN (tags);
-- Tìm kiếm tên tiếng Việt: pg_trgm + unaccent
CREATE INDEX idx_customers__name_trgm    ON customers USING GIN (full_name gin_trgm_ops);

CREATE TABLE customer_contacts (        -- nhiều số/email cho 1 khách
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('PHONE','EMAIL','ZALO','TELEGRAM','FACEBOOK','OTHER')),
  value        TEXT NOT NULL,
  value_normalized TEXT NOT NULL,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES users(id)
);
CREATE INDEX idx_customer_contacts__norm ON customer_contacts (type, value_normalized);
CREATE UNIQUE INDEX uq_cc__one_primary ON customer_contacts (customer_id, type) WHERE is_primary;

-- §40/§71 APPEND-ONLY. Không có API sửa/xóa.
CREATE TABLE customer_status_history (
  id              BIGSERIAL PRIMARY KEY,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  old_status_id   UUID REFERENCES customer_statuses(id),
  new_status_id   UUID NOT NULL REFERENCES customer_statuses(id),
  changed_by      UUID REFERENCES users(id),          -- NULL nếu SYSTEM/API client
  changed_by_api_client_id UUID REFERENCES api_clients(id),
  changed_by_role TEXT CHECK (changed_by_role IN ('ADMIN','LEADER','SALE','SYSTEM','API')),
  note            TEXT,
  ip              INET,
  channel         TEXT NOT NULL DEFAULT 'WEB' CHECK (channel IN ('WEB','API','SYSTEM','IMPORT')),
  correlation_id  UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (old_status_id IS DISTINCT FROM new_status_id)   -- không ghi history rác
);
CREATE INDEX idx_csh__customer ON customer_status_history (customer_id, created_at DESC);
CREATE INDEX idx_csh__new_status_time ON customer_status_history (new_status_id, created_at DESC);
CREATE INDEX idx_csh__changed_by ON customer_status_history (changed_by, created_at DESC);

CREATE TABLE customer_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  content     TEXT NOT NULL,
  -- Note gắn với 1 lần đổi status (§42)
  status_history_id BIGINT REFERENCES customer_status_history(id),
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID REFERENCES users(id),
  created_by_role TEXT,
  channel     TEXT NOT NULL DEFAULT 'WEB',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Sửa note: giữ bản gốc trong edit_history JSONB, không mất dấu
  edited_at   TIMESTAMPTZ,
  edit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_at  TIMESTAMPTZ, deleted_by UUID REFERENCES users(id)
);
CREATE INDEX idx_customer_notes__customer ON customer_notes (customer_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- §41 Timeline: các event KHÔNG sinh từ status/order/payment (những cái đó join từ bảng gốc),
-- hoặc bản ghi denormalize để timeline query 1 lần. Xem 05a mục "Timeline strategy".
CREATE TABLE customer_timeline_events (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  UUID NOT NULL REFERENCES customers(id),
  kind         TEXT NOT NULL CHECK (kind IN
               ('STATUS','ASSIGNMENT','NOTE','ORDER','PAYMENT','TASK','API','ACTIVITY','SYSTEM','MERGE','IMPORT')),
  title        TEXT NOT NULL,
  detail       TEXT,
  ref_table    TEXT,        -- bảng gốc để mở chi tiết
  ref_id       TEXT,
  actor_user_id UUID REFERENCES users(id),
  actor_api_client_id UUID REFERENCES api_clients(id),
  actor_name   TEXT NOT NULL,
  actor_role   TEXT NOT NULL,
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cte__customer ON customer_timeline_events (customer_id, created_at DESC);
CREATE INDEX idx_cte__kind ON customer_timeline_events (customer_id, kind, created_at DESC);

-- §30
CREATE TABLE customer_merge_history (
  id                 BIGSERIAL PRIMARY KEY,
  primary_customer_id UUID NOT NULL REFERENCES customers(id),
  merged_customer_id  UUID NOT NULL REFERENCES customers(id),
  reason             TEXT NOT NULL,
  -- snapshot toàn bộ dữ liệu customer bị merge TRƯỚC khi merge (audit không mất)
  merged_snapshot    JSONB NOT NULL,
  moved_counts       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"orders":3,"leads":5,...}
  merged_by          UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cmh__primary ON customer_merge_history (primary_customer_id, created_at DESC);
```

---

## 5.6 LEAD

```sql
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL,
  customer_id     UUID REFERENCES customers(id),   -- gắn vào customer (mới hoặc đã tồn tại)
  -- Dữ liệu thô như khách nhập (KHÔNG ghi đè bởi normalize — giữ để đối chiếu)
  raw_name        TEXT, raw_phone TEXT, raw_email TEXT, raw_note TEXT,
  phone_normalized TEXT, email_normalized TEXT,
  -- §15 nguồn gốc
  website_id      UUID REFERENCES websites(id),
  landing_page_id UUID REFERENCES landing_pages(id),
  source_id       UUID REFERENCES lead_sources(id),
  campaign_id     UUID REFERENCES campaigns(id),
  tracking_link_id UUID REFERENCES tracking_links(id),
  visitor_id      UUID,        -- FK tới visitors (nullable, tracking có thể tắt)
  session_id      UUID,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  referrer_url    TEXT, page_url TEXT,
  ip              INET,        -- chỉ ghi nếu settings.tracking_store_ip = true (§52)
  user_agent      TEXT, device_type TEXT, os TEXT, browser TEXT,
  -- Trạng thái xử lý của LEAD (khác customer status)
  status          TEXT NOT NULL DEFAULT 'NEW'
                  CHECK (status IN ('NEW','QUALIFIED','DISQUALIFIED','CONVERTED','DUPLICATE','SPAM')),
  is_duplicate    BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_of_lead_id UUID REFERENCES leads(id),
  assigned_leader_id UUID REFERENCES users(id),
  assigned_sale_id   UUID REFERENCES users(id),
  -- Payload gốc để debug integration
  raw_payload     JSONB,
  api_client_id   UUID REFERENCES api_clients(id),
  channel         TEXT NOT NULL DEFAULT 'API' CHECK (channel IN ('WEB','API','IMPORT','WEBHOOK','MANUAL')),
  converted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES users(id),
  deleted_at      TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE UNIQUE INDEX uq_leads__code ON leads (code);
CREATE INDEX idx_leads__customer  ON leads (customer_id, created_at DESC);
CREATE INDEX idx_leads__created   ON leads (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads__source    ON leads (source_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads__campaign  ON leads (campaign_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads__landing   ON leads (landing_page_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads__website   ON leads (website_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads__phone     ON leads (phone_normalized);
CREATE INDEX idx_leads__status    ON leads (status) WHERE deleted_at IS NULL;

CREATE TABLE lead_events (
  id         BIGSERIAL PRIMARY KEY,
  lead_id    UUID NOT NULL REFERENCES leads(id),
  type       TEXT NOT NULL,        -- 'received','normalized','deduped','converted','flagged',...
  detail     TEXT,
  meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_events__lead ON lead_events (lead_id, created_at);

-- §29: match yếu → hàng chờ review, KHÔNG tự merge
CREATE TABLE lead_duplicate_reviews (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            UUID NOT NULL REFERENCES leads(id),
  suspected_customer_id UUID NOT NULL REFERENCES customers(id),
  created_customer_id   UUID REFERENCES customers(id),
  match_type         TEXT NOT NULL CHECK (match_type IN ('PHONE_EXACT','EMAIL_EXACT','PHONE_FUZZY','NAME_EMAIL','MANUAL')),
  confidence         NUMERIC(5,4) NOT NULL,        -- 0.0000 - 1.0000
  match_detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','MERGED','REJECTED','IGNORED')),
  reviewed_by        UUID REFERENCES users(id),
  reviewed_at        TIMESTAMPTZ,
  review_note        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ldr__pending ON lead_duplicate_reviews (status, created_at DESC) WHERE status='PENDING';
```

---

## 5.7 ASSIGNMENT & DATA POOL

```sql
-- Assignment HIỆN TẠI (1 active / customer)
CREATE TABLE customer_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id),
  lead_id      UUID REFERENCES leads(id),
  leader_id    UUID REFERENCES users(id),
  sale_id      UUID REFERENCES users(id),
  team_id      UUID REFERENCES teams(id),
  state        TEXT NOT NULL
               CHECK (state IN ('ASSIGNED_TO_LEADER','ASSIGNED_TO_SALE','WORKING')),
  assigned_by  UUID NOT NULL REFERENCES users(id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- SLA: phải liên hệ trước thời điểm này, nếu không job sẽ cảnh báo/recycle (§33)
  sla_due_at   TIMESTAMPTZ,
  first_contacted_at TIMESTAMPTZ,
  released_at  TIMESTAMPTZ,           -- khi bị thu hồi/chuyển → dòng này hết active
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (leader_id IS NOT NULL OR sale_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_ca__one_active ON customer_assignments (customer_id) WHERE is_active;
CREATE INDEX idx_ca__sale   ON customer_assignments (sale_id)   WHERE is_active;
CREATE INDEX idx_ca__leader ON customer_assignments (leader_id) WHERE is_active;
CREATE INDEX idx_ca__sla    ON customer_assignments (sla_due_at) WHERE is_active AND first_contacted_at IS NULL;

-- §32 APPEND-ONLY: mọi lần giao / thu hồi / chuyển. Không UPDATE, không DELETE.
CREATE TABLE assignment_history (
  id            BIGSERIAL PRIMARY KEY,
  customer_id   UUID NOT NULL REFERENCES customers(id),
  lead_id       UUID REFERENCES leads(id),
  action        TEXT NOT NULL CHECK (action IN
                ('ASSIGN_TO_LEADER','ASSIGN_TO_SALE','REASSIGN','REVOKE','RECYCLE','CLOSE','AUTO_ASSIGN')),
  from_leader_id UUID REFERENCES users(id),
  to_leader_id   UUID REFERENCES users(id),
  from_sale_id   UUID REFERENCES users(id),
  to_sale_id     UUID REFERENCES users(id),
  from_team_id   UUID REFERENCES teams(id),
  to_team_id     UUID REFERENCES teams(id),
  from_state     TEXT, to_state TEXT,
  reason         TEXT,
  actor_id       UUID REFERENCES users(id),      -- NULL nếu job tự động
  actor_role     TEXT,
  is_system      BOOLEAN NOT NULL DEFAULT FALSE,
  batch_id       UUID,                           -- gom 1 lần assign batch
  correlation_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ah__customer ON assignment_history (customer_id, created_at DESC);
CREATE INDEX idx_ah__to_sale  ON assignment_history (to_sale_id, created_at DESC);
CREATE INDEX idx_ah__batch    ON assignment_history (batch_id);

-- §32 Data Pool: data chưa phân / vừa thu hồi
CREATE TABLE data_pool_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  lead_id       UUID REFERENCES leads(id),
  state         TEXT NOT NULL DEFAULT 'UNASSIGNED'
                CHECK (state IN ('UNASSIGNED','RESERVED','ASSIGNED','RECYCLED','CLOSED')),
  -- Pool có thể thuộc phạm vi 1 leader (Admin giao cả lô cho Leader tự chia)
  owner_leader_id UUID REFERENCES users(id),
  priority      INT NOT NULL DEFAULT 0,
  recycle_count INT NOT NULL DEFAULT 0,
  recycle_reason TEXT,
  entered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at     TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id)
);
CREATE UNIQUE INDEX uq_dpe__one_open ON data_pool_entries (customer_id) WHERE exited_at IS NULL;
CREATE INDEX idx_dpe__state ON data_pool_entries (state, priority DESC, entered_at)
  WHERE exited_at IS NULL;
CREATE INDEX idx_dpe__owner ON data_pool_entries (owner_leader_id) WHERE exited_at IS NULL;
```

---

## 5.8 FOLLOW-UP / TASK

```sql
CREATE TABLE customer_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  lead_id       UUID REFERENCES leads(id),
  assigned_user_id UUID NOT NULL REFERENCES users(id),
  type          TEXT NOT NULL DEFAULT 'FOLLOW_UP'
                CHECK (type IN ('CALL','MESSAGE','MEETING','FOLLOW_UP','CUSTOM')),
  title         TEXT NOT NULL,
  description   TEXT,
  priority      TEXT NOT NULL DEFAULT 'NORMAL'
                CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  due_at        TIMESTAMPTZ NOT NULL,
  remind_at     TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED','OVERDUE')),
  result_note   TEXT,
  completed_at  TIMESTAMPTZ,
  completed_by  UUID REFERENCES users(id),
  reminded_at   TIMESTAMPTZ,               -- đã gửi notification chưa (chống gửi lặp)
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ, deleted_by UUID REFERENCES users(id)
);
CREATE INDEX idx_tasks__user_due   ON customer_tasks (assigned_user_id, due_at)
  WHERE status IN ('OPEN','IN_PROGRESS','OVERDUE') AND deleted_at IS NULL;
CREATE INDEX idx_tasks__customer   ON customer_tasks (customer_id, due_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks__overdue_scan ON customer_tasks (due_at)
  WHERE status IN ('OPEN','IN_PROGRESS') AND deleted_at IS NULL;
CREATE INDEX idx_tasks__remind     ON customer_tasks (remind_at)
  WHERE reminded_at IS NULL AND status IN ('OPEN','IN_PROGRESS');
```

---

## 5.9 ATTRIBUTION / TOUCHPOINT

```sql
-- §28/§53/§70: nguồn sự thật của attribution
CREATE TABLE customer_touchpoints (
  id              BIGSERIAL PRIMARY KEY,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  lead_id         UUID REFERENCES leads(id),
  website_id      UUID REFERENCES websites(id),
  landing_page_id UUID REFERENCES landing_pages(id),
  source_id       UUID REFERENCES lead_sources(id),
  campaign_id     UUID REFERENCES campaigns(id),
  tracking_link_id UUID REFERENCES tracking_links(id),
  visitor_id      UUID, session_id UUID,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  referrer_url    TEXT, page_url TEXT,
  touch_type      TEXT NOT NULL DEFAULT 'LEAD_SUBMIT'
                  CHECK (touch_type IN ('VISIT','CLICK','LEAD_SUBMIT','CONVERSION','MANUAL','IMPORT')),
  -- Vị trí trong chuỗi tiếp xúc của khách (1 = first touch)
  sequence_no     INT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ctp__customer ON customer_touchpoints (customer_id, occurred_at);
CREATE UNIQUE INDEX uq_ctp__seq ON customer_touchpoints (customer_id, sequence_no);
CREATE INDEX idx_ctp__campaign ON customer_touchpoints (campaign_id, occurred_at);
CREATE INDEX idx_ctp__source   ON customer_touchpoints (source_id, occurred_at);

-- FK vòng: thêm sau khi cả 2 bảng tồn tại
ALTER TABLE customers ADD CONSTRAINT fk_customers__first_touch
  FOREIGN KEY (first_touch_id) REFERENCES customer_touchpoints(id);
ALTER TABLE customers ADD CONSTRAINT fk_customers__last_touch
  FOREIGN KEY (last_touch_id)  REFERENCES customer_touchpoints(id);
ALTER TABLE leads ADD CONSTRAINT fk_leads__visitor FOREIGN KEY (visitor_id) REFERENCES visitors(id);

-- §70: lịch sử source ở dạng dễ đọc cho UI "Lịch sử nguồn khách"
CREATE TABLE customer_source_history (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  UUID NOT NULL REFERENCES customers(id),
  touchpoint_id BIGINT REFERENCES customer_touchpoints(id),
  old_source_id UUID REFERENCES lead_sources(id),
  new_source_id UUID REFERENCES lead_sources(id),
  change_kind  TEXT NOT NULL CHECK (change_kind IN ('FIRST_TOUCH','NEW_TOUCH','LAST_TOUCH_UPDATED','MANUAL_CORRECTION')),
  note         TEXT,
  changed_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_csrc__customer ON customer_source_history (customer_id, created_at DESC);

-- §74: đóng băng bối cảnh conversion tại thời điểm tạo Order
CREATE TABLE attribution_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL,        -- FK thêm sau khi có orders
  customer_id     UUID NOT NULL REFERENCES customers(id),
  first_touch_id  BIGINT REFERENCES customer_touchpoints(id),
  last_touch_id   BIGINT REFERENCES customer_touchpoints(id),
  converting_lead_id UUID REFERENCES leads(id),
  -- Giá trị copy (TEXT), không chỉ FK — campaign đổi tên/archive vẫn truy ngược được
  website_id UUID, website_name TEXT,
  source_id UUID, source_name TEXT, traffic_type TEXT,
  campaign_id UUID, campaign_name TEXT,
  landing_page_id UUID, landing_page_name TEXT,
  tracking_link_id UUID, tracking_link_slug TEXT,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  touch_count     INT,
  days_to_convert NUMERIC(8,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_attr_snap__order ON attribution_snapshots (order_id);
```

---

## 5.10 TRACKING (§52)

```sql
CREATE TABLE visitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- pseudonymous id đặt trong cookie 1st-party; KHÔNG phải PII
  visitor_key     TEXT NOT NULL,
  website_id      UUID REFERENCES websites(id),
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_landing_page_id UUID REFERENCES landing_pages(id),
  first_source_id UUID REFERENCES lead_sources(id),
  first_campaign_id UUID REFERENCES campaigns(id),
  first_referrer  TEXT,
  session_count   INT NOT NULL DEFAULT 0,
  page_view_count INT NOT NULL DEFAULT 0,
  -- Nối sang customer khi khách submit form (identity resolution)
  customer_id     UUID REFERENCES customers(id),
  identified_at   TIMESTAMPTZ,
  device_type TEXT, os TEXT, browser TEXT,
  country CHAR(2), region TEXT,
  -- §52: IP chỉ lưu nếu settings.tracking_store_ip=true; mặc định lưu dạng băm
  ip_hash         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_visitors__key ON visitors (visitor_key);
CREATE INDEX idx_visitors__customer ON visitors (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_visitors__website_seen ON visitors (website_id, last_seen_at DESC);

CREATE TABLE tracking_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id      UUID NOT NULL REFERENCES visitors(id),
  website_id      UUID REFERENCES websites(id),
  landing_page_id UUID REFERENCES landing_pages(id),
  entry_url       TEXT, exit_url TEXT, referrer_url TEXT,
  source_id       UUID REFERENCES lead_sources(id),
  campaign_id     UUID REFERENCES campaigns(id),
  tracking_link_id UUID REFERENCES tracking_links(id),
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  duration_seconds INT,
  page_view_count INT NOT NULL DEFAULT 0,
  event_count     INT NOT NULL DEFAULT 0,
  is_bounce       BOOLEAN,
  converted_lead_id UUID REFERENCES leads(id),
  device_type TEXT, os TEXT, browser TEXT
);
CREATE INDEX idx_ts__visitor ON tracking_sessions (visitor_id, started_at DESC);
CREATE INDEX idx_ts__website_started ON tracking_sessions (website_id, started_at DESC);
CREATE INDEX idx_ts__campaign ON tracking_sessions (campaign_id, started_at DESC);

-- Bảng lớn: partition theo tháng (RANGE on created_at)
CREATE TABLE page_views (
  id           BIGSERIAL,
  session_id   UUID NOT NULL,
  visitor_id   UUID NOT NULL,
  website_id   UUID,
  landing_page_id UUID,
  page_url     TEXT NOT NULL,
  page_path    TEXT NOT NULL,
  page_title   TEXT,
  referrer_url TEXT,
  time_on_page_seconds INT,
  scroll_depth_pct SMALLINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_pv__session ON page_views (session_id, created_at);
CREATE INDEX idx_pv__website_path ON page_views (website_id, page_path, created_at DESC);
-- Job tạo partition tháng tới (pg_partman hoặc migration script)

CREATE TABLE tracking_events (
  id           BIGSERIAL,
  session_id   UUID NOT NULL,
  visitor_id   UUID NOT NULL,
  website_id   UUID,
  landing_page_id UUID,
  event_name   TEXT NOT NULL,          -- 'pageview','click','form_view','form_submit','custom:*'
  event_category TEXT,
  page_url     TEXT,
  properties   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- KHÔNG chứa PII
  api_client_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_te__name_time ON tracking_events (event_name, created_at DESC);
CREATE INDEX idx_te__session ON tracking_events (session_id, created_at);

-- Aggregate cho dashboard (§7/§25/§52) — chạy job, KHÔNG nhập tay
CREATE TABLE traffic_daily_aggregates (
  id              BIGSERIAL PRIMARY KEY,
  stat_date       DATE NOT NULL,
  website_id      UUID REFERENCES websites(id),
  landing_page_id UUID REFERENCES landing_pages(id),
  source_id       UUID REFERENCES lead_sources(id),
  campaign_id     UUID REFERENCES campaigns(id),
  tracking_link_id UUID REFERENCES tracking_links(id),
  unique_visitors INT NOT NULL DEFAULT 0,
  sessions        INT NOT NULL DEFAULT 0,
  page_views      INT NOT NULL DEFAULT 0,
  clicks          INT NOT NULL DEFAULT 0,
  leads           INT NOT NULL DEFAULT 0,
  orders          INT NOT NULL DEFAULT 0,
  paid_orders     INT NOT NULL DEFAULT 0,
  revenue         NUMERIC(18,2) NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_tda__dims ON traffic_daily_aggregates
  (stat_date, website_id, landing_page_id, source_id, campaign_id, tracking_link_id);
CREATE INDEX idx_tda__date ON traffic_daily_aggregates (stat_date DESC);
```

---

## 5.11 PRODUCT

```sql
CREATE TABLE products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  slug         TEXT,
  short_description TEXT,
  description  TEXT,
  price        NUMERIC(18,2) NOT NULL DEFAULT 0,
  sale_price   NUMERIC(18,2),
  currency     CHAR(3) NOT NULL DEFAULT 'VND',
  cost_price   NUMERIC(18,2),                 -- cho báo cáo lợi nhuận phase sau
  image_media_id  UUID REFERENCES media(id),
  banner_media_id UUID REFERENCES media(id),
  category     TEXT,
  tags         TEXT[],
  sort_order   INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at   TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT,
  CHECK (sale_price IS NULL OR sale_price <= price),
  CHECK (price >= 0)
);
CREATE UNIQUE INDEX uq_products__code ON products (code) WHERE deleted_at IS NULL;
CREATE INDEX idx_products__status ON products (status) WHERE deleted_at IS NULL;

CREATE TABLE product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id   UUID NOT NULL REFERENCES media(id),
  alt_text   TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_images__product ON product_images (product_id, sort_order);

CREATE TABLE product_websites (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  price_override NUMERIC(18,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, website_id)
);
```

---

## 5.12 SALES / BILLING

```sql
CREATE TABLE orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL,                 -- DH20260904-0001
  customer_id    UUID NOT NULL REFERENCES customers(id),
  lead_id        UUID REFERENCES leads(id),
  -- §74 attribution gắn trực tiếp (FK) + snapshot bất biến ở attribution_snapshots
  website_id     UUID REFERENCES websites(id),
  source_id      UUID REFERENCES lead_sources(id),
  campaign_id    UUID REFERENCES campaigns(id),
  landing_page_id UUID REFERENCES landing_pages(id),
  tracking_link_id UUID REFERENCES tracking_links(id),
  -- Người bán
  sale_id        UUID REFERENCES users(id),
  leader_id      UUID REFERENCES users(id),
  team_id        UUID REFERENCES teams(id),
  -- Tiền
  subtotal       NUMERIC(18,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,   -- tổng payment thành công (job đối soát)
  currency       CHAR(3) NOT NULL DEFAULT 'VND',
  -- §9
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN
                 ('PENDING','CONFIRMED','PROCESSING','PAID','COMPLETED','CANCELLED','REFUNDED')),
  payment_method TEXT,                              -- cấu hình được, không enum cứng
  note           TEXT, internal_note TEXT,
  ordered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at   TIMESTAMPTZ, paid_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ, cancel_reason TEXT,
  channel        TEXT NOT NULL DEFAULT 'WEB' CHECK (channel IN ('WEB','API','IMPORT','SYSTEM')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at     TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT,
  CHECK (total_amount >= 0), CHECK (paid_amount >= 0)
);
CREATE UNIQUE INDEX uq_orders__code ON orders (code);
CREATE INDEX idx_orders__customer ON orders (customer_id, ordered_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders__sale     ON orders (sale_id, ordered_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders__team     ON orders (team_id, ordered_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders__status   ON orders (status, ordered_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders__campaign ON orders (campaign_id, ordered_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders__website  ON orders (website_id, ordered_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE attribution_snapshots ADD CONSTRAINT fk_attr_snap__order
  FOREIGN KEY (order_id) REFERENCES orders(id);

CREATE TABLE order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id),
  -- SNAPSHOT tên/giá tại thời điểm bán: sản phẩm đổi giá sau này không làm sai đơn cũ
  product_code TEXT NOT NULL, product_name TEXT NOT NULL,
  quantity     INT NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(18,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  line_total   NUMERIC(18,2) NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items__order ON order_items (order_id);
CREATE INDEX idx_order_items__product ON order_items (product_id);

CREATE TABLE order_status_history (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES orders(id),
  old_status  TEXT, new_status TEXT NOT NULL,
  note        TEXT,
  changed_by  UUID REFERENCES users(id),
  changed_by_api_client_id UUID REFERENCES api_clients(id),
  channel     TEXT NOT NULL DEFAULT 'WEB',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (old_status IS DISTINCT FROM new_status)
);
CREATE INDEX idx_osh__order ON order_status_history (order_id, created_at DESC);

-- §74: Payment = nguồn sự thật về TIỀN
CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL,
  order_id       UUID REFERENCES orders(id),
  customer_id    UUID NOT NULL REFERENCES customers(id),
  type           TEXT NOT NULL DEFAULT 'PAYMENT'
                 CHECK (type IN ('PAYMENT','REFUND','ADJUSTMENT')),
  amount         NUMERIC(18,2) NOT NULL,       -- REFUND ghi số âm
  currency       CHAR(3) NOT NULL DEFAULT 'VND',
  method         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','SUCCEEDED','FAILED','CANCELLED')),
  gateway        TEXT, gateway_txn_id TEXT,     -- cho Payment Gateway phase 4
  reference      TEXT,                          -- mã chuyển khoản / biên nhận
  paid_at        TIMESTAMPTZ,
  note           TEXT,
  recorded_by    UUID REFERENCES users(id),
  channel        TEXT NOT NULL DEFAULT 'WEB',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE UNIQUE INDEX uq_payments__code ON payments (code);
CREATE UNIQUE INDEX uq_payments__gateway_txn ON payments (gateway, gateway_txn_id)
  WHERE gateway_txn_id IS NOT NULL;
CREATE INDEX idx_payments__order ON payments (order_id, paid_at DESC);
CREATE INDEX idx_payments__customer ON payments (customer_id, paid_at DESC);
CREATE INDEX idx_payments__paid_at ON payments (paid_at DESC) WHERE status='SUCCEEDED';

-- §74: Revenue SINH/ĐỐI SOÁT từ Order+Payment theo rule, không nhập tay tự do
CREATE TABLE revenue_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID REFERENCES orders(id),
  payment_id   UUID REFERENCES payments(id),
  customer_id  UUID NOT NULL REFERENCES customers(id),
  -- Chiều phân tích (copy để báo cáo nhanh, khớp attribution snapshot)
  website_id UUID, source_id UUID, campaign_id UUID, landing_page_id UUID, tracking_link_id UUID,
  sale_id UUID REFERENCES users(id), leader_id UUID REFERENCES users(id), team_id UUID REFERENCES teams(id),
  amount       NUMERIC(18,2) NOT NULL,
  currency     CHAR(3) NOT NULL DEFAULT 'VND',
  entry_type   TEXT NOT NULL DEFAULT 'RECOGNIZED'
               CHECK (entry_type IN ('RECOGNIZED','REVERSAL','ADJUSTMENT')),
  recognized_at TIMESTAMPTZ NOT NULL,          -- ngày ghi nhận doanh thu (theo rule)
  rule_code    TEXT NOT NULL,                  -- rule nào sinh ra dòng này
  is_system_generated BOOLEAN NOT NULL DEFAULT TRUE,
  adjustment_reason TEXT,                      -- bắt buộc nếu entry_type='ADJUSTMENT'
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (entry_type <> 'ADJUSTMENT' OR adjustment_reason IS NOT NULL)
);
CREATE INDEX idx_rev__recognized ON revenue_entries (recognized_at DESC);
CREATE INDEX idx_rev__sale  ON revenue_entries (sale_id, recognized_at DESC);
CREATE INDEX idx_rev__team  ON revenue_entries (team_id, recognized_at DESC);
CREATE INDEX idx_rev__campaign ON revenue_entries (campaign_id, recognized_at DESC);
CREATE UNIQUE INDEX uq_rev__payment_rule ON revenue_entries (payment_id, rule_code)
  WHERE payment_id IS NOT NULL;   -- chống ghi nhận trùng khi retry event
```

---

## 5.13 CMS

```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES categories(id),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  thumbnail_media_id UUID REFERENCES media(id),
  meta_title TEXT, meta_description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at  TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE UNIQUE INDEX uq_categories__slug ON categories (slug) WHERE deleted_at IS NULL;

CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_tags__slug ON tags (slug) WHERE deleted_at IS NULL;

CREATE TABLE posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL,
  excerpt       TEXT,
  content       TEXT,
  content_format TEXT NOT NULL DEFAULT 'HTML' CHECK (content_format IN ('HTML','MARKDOWN','JSON')),
  thumbnail_media_id UUID REFERENCES media(id),
  banner_media_id    UUID REFERENCES media(id),
  category_id   UUID REFERENCES categories(id),
  author_id     UUID REFERENCES users(id),
  author_name_override TEXT,
  status        TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN
                ('DRAFT','SCHEDULED','PUBLISHED','UNPUBLISHED','ARCHIVED')),
  published_at  TIMESTAMPTZ,
  scheduled_at  TIMESTAMPTZ,
  -- SEO (§12)
  meta_title TEXT, meta_description TEXT, canonical_url TEXT,
  robots_index BOOLEAN NOT NULL DEFAULT TRUE,
  robots_follow BOOLEAN NOT NULL DEFAULT TRUE,
  og_image_media_id UUID REFERENCES media(id),
  view_count    BIGINT NOT NULL DEFAULT 0,
  is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at    TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT,
  CHECK (status <> 'SCHEDULED' OR scheduled_at IS NOT NULL)
);
CREATE INDEX idx_posts__status_pub ON posts (status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts__category ON posts (category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts__scheduled ON posts (scheduled_at) WHERE status='SCHEDULED';

-- §12: 1 bài hiện trên nhiều website; slug unique THEO website
CREATE TABLE post_websites (
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,           -- cho phép slug khác nhau theo website
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, website_id)
);
CREATE UNIQUE INDEX uq_post_websites__slug ON post_websites (website_id, slug);

CREATE TABLE post_tags (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX idx_post_tags__tag ON post_tags (tag_id);

CREATE TABLE post_revisions (
  id         BIGSERIAL PRIMARY KEY,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  title      TEXT, content TEXT, excerpt TEXT,
  meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision_no INT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_post_revisions__no ON post_revisions (post_id, revision_no);
```

---

## 5.14 MEDIA (§73)

```sql
CREATE TABLE media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    UUID REFERENCES websites(id),      -- NULL = dùng chung
  file_name     TEXT NOT NULL,                     -- tên đã sinh, KHÔNG dùng tên gốc làm key
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  extension     TEXT NOT NULL,
  file_size     BIGINT NOT NULL CHECK (file_size >= 0),
  media_type    TEXT NOT NULL CHECK (media_type IN ('IMAGE','VIDEO','DOCUMENT','SPREADSHEET','OTHER')),
  storage_provider TEXT NOT NULL DEFAULT 'S3'
                CHECK (storage_provider IN ('S3','R2','LOCAL','EXTERNAL')),
  storage_key   TEXT,                              -- NULL nếu EXTERNAL (chỉ có URL)
  public_url    TEXT,
  width INT, height INT, duration_seconds INT,
  checksum_sha256 TEXT,                            -- chống upload trùng
  alt_text      TEXT, caption TEXT, folder TEXT,
  uploaded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT,
  CHECK (storage_provider <> 'EXTERNAL' OR public_url IS NOT NULL),
  CHECK (storage_provider  = 'EXTERNAL' OR storage_key IS NOT NULL)
);
CREATE INDEX idx_media__type ON media (media_type, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_media__website ON media (website_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_media__checksum ON media (checksum_sha256) WHERE checksum_sha256 IS NOT NULL;
```

---

## 5.15 INTEGRATION (§19/§54/§66/§68)

```sql
CREATE TABLE api_clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id  UUID REFERENCES websites(id),
  landing_page_id UUID REFERENCES landing_pages(id),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'WEBSITE' CHECK (type IN
              ('WEBSITE','LANDING_PAGE','MOBILE_APP','SERVER','THIRD_PARTY','INTERNAL')),
  description TEXT,
  -- CORS: origin được phép; rỗng = suy ra từ website_domains đã verify
  allowed_origins TEXT[],
  allowed_ips   INET[],                      -- tùy chọn siết thêm cho server-to-server
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','DISABLED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at  TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE INDEX idx_api_clients__website ON api_clients (website_id) WHERE deleted_at IS NULL;

CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_client_id UUID NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  environment   TEXT NOT NULL DEFAULT 'PRODUCTION' CHECK (environment IN ('DEVELOPMENT','STAGING','PRODUCTION')),
  -- §19: KHÔNG lưu plaintext. Full key chỉ hiện 1 lần khi tạo.
  key_prefix    TEXT NOT NULL,               -- 'pk_live_ab12' — dùng để tra cứu, indexed
  key_hash      TEXT NOT NULL,               -- Argon2id/HMAC-SHA256 của phần secret
  key_last_four TEXT,                        -- hiển thị '••••cd34' trên UI
  scopes        TEXT[] NOT NULL DEFAULT '{}',-- 'lead:create','customer:read','tracking:write',...
  rate_limit_per_minute INT NOT NULL DEFAULT 60,
  rate_limit_per_day    INT,
  last_used_at  TIMESTAMPTZ, last_used_ip INET,
  request_count BIGINT NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ, revoked_by UUID REFERENCES users(id), revoke_reason TEXT,
  rotated_from_id UUID REFERENCES api_keys(id),
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_api_keys__prefix ON api_keys (key_prefix);
CREATE INDEX idx_api_keys__client ON api_keys (api_client_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys__expiry ON api_keys (expires_at)
  WHERE revoked_at IS NULL AND expires_at IS NOT NULL;   -- job alert key sắp hết hạn (§7)

CREATE TABLE integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN
                ('WEBSITE','LANDING_PAGE','ADS','MESSAGING','EMAIL','SMS','CRM_EXTERNAL','CUSTOM')),
  provider      TEXT NOT NULL,               -- 'FACEBOOK','TIKTOK','GOOGLE','ZALO','CUSTOM',...
  website_id    UUID REFERENCES websites(id),
  api_client_id UUID REFERENCES api_clients(id),
  endpoint      TEXT,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,   -- không chứa secret
  credentials_enc BYTEA,                     -- AES-256-GCM, key từ secret manager
  credentials_key_version INT,
  status        TEXT NOT NULL DEFAULT 'DISABLED' CHECK (status IN
                ('CONNECTED','WARNING','DISCONNECTED','DISABLED')),
  last_sync_at  TIMESTAMPTZ, last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ, last_error TEXT,
  request_count BIGINT NOT NULL DEFAULT 0,
  lead_count    BIGINT NOT NULL DEFAULT 0,
  error_count   BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id), updated_by UUID REFERENCES users(id),
  deleted_at    TIMESTAMPTZ, deleted_by UUID REFERENCES users(id), delete_reason TEXT
);
CREATE INDEX idx_integrations__status ON integrations (status) WHERE deleted_at IS NULL;

CREATE TABLE webhooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_client_id UUID REFERENCES api_clients(id),
  website_id    UUID REFERENCES websites(id),
  name          TEXT NOT NULL,
  direction     TEXT NOT NULL DEFAULT 'OUTBOUND' CHECK (direction IN ('INBOUND','OUTBOUND')),
  url           TEXT,                        -- OUTBOUND: đích gửi
  inbound_path  TEXT,                        -- INBOUND: '/webhooks/in/{slug}'
  event_types   TEXT[] NOT NULL DEFAULT '{}',-- 'lead.created','order.created',...
  secret_enc    BYTEA NOT NULL,              -- dùng cho HMAC signature
  signature_algo TEXT NOT NULL DEFAULT 'HMAC_SHA256',
  headers       JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_attempts  INT NOT NULL DEFAULT 5,
  timeout_ms    INT NOT NULL DEFAULT 10000,
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','DISABLED')),
  consecutive_failures INT NOT NULL DEFAULT 0,   -- tự PAUSE khi vượt ngưỡng
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id),
  deleted_at    TIMESTAMPTZ, deleted_by UUID REFERENCES users(id)
);
CREATE INDEX idx_webhooks__events ON webhooks USING GIN (event_types) WHERE status='ACTIVE';

CREATE TABLE webhook_deliveries (
  id            BIGSERIAL PRIMARY KEY,
  webhook_id    UUID NOT NULL REFERENCES webhooks(id),
  outbox_event_id UUID,
  event_type    TEXT NOT NULL,
  event_id      UUID NOT NULL,
  payload       JSONB NOT NULL,
  payload_size  INT,
  attempt_count INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN
                ('PENDING','IN_FLIGHT','DELIVERED','FAILED','DEAD_LETTER','CANCELLED')),
  response_code INT,
  response_body TEXT,                        -- CẮT còn 2KB, redact secret
  response_headers JSONB,
  duration_ms   INT,
  error_message TEXT,
  next_retry_at TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wd__retry ON webhook_deliveries (next_retry_at)
  WHERE status IN ('PENDING','FAILED');
CREATE INDEX idx_wd__webhook ON webhook_deliveries (webhook_id, created_at DESC);
CREATE UNIQUE INDEX uq_wd__webhook_event ON webhook_deliveries (webhook_id, event_id);  -- không gửi trùng

CREATE TABLE integration_logs (
  id            BIGSERIAL PRIMARY KEY,
  integration_id UUID REFERENCES integrations(id),
  api_client_id UUID REFERENCES api_clients(id),
  api_key_id    UUID REFERENCES api_keys(id),
  direction     TEXT NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
  method        TEXT, endpoint TEXT,
  request_headers JSONB,                     -- đã redact Authorization/X-Api-Key
  request_body  JSONB,
  response_code INT, response_body TEXT,
  duration_ms   INT,
  status        TEXT NOT NULL CHECK (status IN ('SUCCESS','CLIENT_ERROR','SERVER_ERROR','TIMEOUT')),
  error_message TEXT,
  ip            INET,
  correlation_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ilogs__client ON integration_logs (api_client_id, created_at DESC);
CREATE INDEX idx_ilogs__status ON integration_logs (status, created_at DESC);
CREATE INDEX idx_ilogs__corr ON integration_logs (correlation_id);

-- §68: cùng REQUEST gửi lặp (khác duplicate customer)
CREATE TABLE idempotency_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_client_id   UUID REFERENCES api_clients(id),
  user_id         UUID REFERENCES users(id),
  idempotency_key TEXT NOT NULL,
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL,
  request_hash    TEXT NOT NULL,             -- SHA-256 body đã canonical hóa
  state           TEXT NOT NULL DEFAULT 'IN_PROGRESS'
                  CHECK (state IN ('IN_PROGRESS','COMPLETED','FAILED')),
  response_status INT,
  response_body   JSONB,
  resource_type   TEXT, resource_id TEXT,    -- lead/order vừa tạo
  expires_at      TIMESTAMPTZ NOT NULL,      -- mặc định 24h, cấu hình được
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_idem__key ON idempotency_records
  (COALESCE(api_client_id::text, user_id::text), idempotency_key, endpoint);
CREATE INDEX idx_idem__cleanup ON idempotency_records (expires_at);
```

---

## 5.16 NOTIFICATION / AUDIT / EVENT / SYSTEM

```sql
CREATE TABLE notification_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,                 -- 'customer.status_changed', 'lead.created',...
  name        TEXT NOT NULL,
  -- Ai nhận: theo role, theo user cụ thể, hoặc theo quan hệ (leader của sale liên quan)
  recipient_mode TEXT NOT NULL DEFAULT 'RELATED_LEADER' CHECK (recipient_mode IN
                 ('ALL_ADMINS','RELATED_LEADER','RELATED_SALE','SPECIFIC_USERS','ROLE')),
  recipient_role TEXT CHECK (recipient_role IN ('ADMIN','LEADER','SALE')),
  recipient_user_ids UUID[],
  -- Điều kiện thêm, VD chỉ status có notify_on_change=true
  conditions  JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels    TEXT[] NOT NULL DEFAULT '{IN_APP}',  -- IN_APP | EMAIL | ZALO | TELEGRAM (phase 3)
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id), updated_by UUID REFERENCES users(id)
);
CREATE INDEX idx_nrules__event ON notification_rules (event_type) WHERE is_active;

CREATE TABLE notifications (
  id           BIGSERIAL PRIMARY KEY,
  recipient_user_id UUID NOT NULL REFERENCES users(id),
  rule_id      UUID REFERENCES notification_rules(id),
  event_type   TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  severity     TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO','SUCCESS','WARNING','ERROR')),
  -- Liên kết mở nhanh
  entity_type  TEXT, entity_id TEXT, link_url TEXT,
  customer_id  UUID REFERENCES customers(id),
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif__unread ON notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX idx_notif__recipient ON notifications (recipient_user_id, created_at DESC);

-- §56 APPEND-ONLY. Không API sửa/xóa.
CREATE TABLE audit_logs (
  id             BIGSERIAL PRIMARY KEY,
  actor_user_id  UUID REFERENCES users(id),
  actor_api_client_id UUID REFERENCES api_clients(id),
  actor_name     TEXT NOT NULL,              -- snapshot: user có thể bị đổi tên/archive
  actor_role     TEXT,
  action         TEXT NOT NULL,              -- 'customer.status_changed','product.price_updated',...
  module         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  entity_label   TEXT,                       -- 'KH00123 — Nguyễn Văn A'
  old_values     JSONB,                      -- ĐÃ redact secret/password/token
  new_values     JSONB,
  changed_fields TEXT[],
  ip             INET,
  user_agent     TEXT,
  channel        TEXT NOT NULL DEFAULT 'WEB' CHECK (channel IN ('WEB','API','SYSTEM','IMPORT','JOB')),
  correlation_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit__entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit__actor  ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX idx_audit__action ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit__module ON audit_logs (module, created_at DESC);
CREATE INDEX idx_audit__corr   ON audit_logs (correlation_id);

CREATE TABLE activity_logs (            -- hành vi nhẹ: login, xem, export
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id),
  action     TEXT NOT NULL,
  detail     TEXT,
  entity_type TEXT, entity_id TEXT,
  ip INET, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity__user ON activity_logs (user_id, created_at DESC);

-- §67 Transactional Outbox
CREATE TABLE outbox_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,               -- 'customer','order','lead',...
  aggregate_id   TEXT NOT NULL,
  payload        JSONB NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- actor, correlation_id, channel
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN
                 ('PENDING','PROCESSING','PROCESSED','FAILED','DEAD_LETTER')),
  attempt_count  INT NOT NULL DEFAULT 0,
  last_error     TEXT,
  available_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox__dispatch ON outbox_events (available_at)
  WHERE status IN ('PENDING','FAILED');
CREATE INDEX idx_outbox__aggregate ON outbox_events (aggregate_type, aggregate_id, created_at);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  value_type  TEXT NOT NULL CHECK (value_type IN ('STRING','NUMBER','BOOLEAN','JSON','ARRAY')),
  category    TEXT NOT NULL,                  -- 'crm','marketing','security','tracking',...
  label       TEXT NOT NULL,
  description TEXT,
  is_secret   BOOLEAN NOT NULL DEFAULT FALSE, -- không trả về API, không log
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings_history (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT NOT NULL,
  old_value  JSONB, new_value JSONB,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_settings_history__key ON settings_history (key, created_at DESC);
```

---

## 5.17 IMPORT / EXPORT (§50/§51)

```sql
CREATE TABLE import_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    TEXT NOT NULL CHECK (entity_type IN ('CUSTOMER','LEAD','ORDER','PRODUCT')),
  file_media_id  UUID REFERENCES media(id),
  original_filename TEXT NOT NULL,
  total_rows     INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  success_rows   INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  error_rows     INT NOT NULL DEFAULT 0,
  -- Mapping cột do người dùng chọn ở bước Preview
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  options        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {onDuplicate:'SKIP'|'ATTACH_LEAD'|'REVIEW'}
  -- Gán luôn cho ai khi import
  assign_to_leader_id UUID REFERENCES users(id),
  assign_to_sale_id   UUID REFERENCES users(id),
  default_source_id   UUID REFERENCES lead_sources(id),
  default_website_id  UUID REFERENCES websites(id),
  status         TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (status IN
                 ('UPLOADED','PREVIEWING','MAPPED','VALIDATING','READY','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  error_file_media_id UUID REFERENCES media(id),      -- file lỗi tải về
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ,
  error_message TEXT,
  created_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_jobs__creator ON import_jobs (created_by, created_at DESC);

CREATE TABLE import_rows (
  id            BIGSERIAL PRIMARY KEY,
  import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number    INT NOT NULL,
  raw_data      JSONB NOT NULL,
  normalized_data JSONB,
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN
                ('PENDING','VALID','INVALID','DUPLICATE','IMPORTED','SKIPPED','FAILED')),
  created_entity_type TEXT, created_entity_id TEXT,
  matched_customer_id UUID REFERENCES customers(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_rows__job ON import_rows (import_job_id, row_number);
CREATE INDEX idx_import_rows__status ON import_rows (import_job_id, status);

CREATE TABLE import_errors (
  id            BIGSERIAL PRIMARY KEY,
  import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  import_row_id BIGINT REFERENCES import_rows(id) ON DELETE CASCADE,
  row_number    INT NOT NULL,
  field         TEXT,
  error_code    TEXT NOT NULL,
  error_message TEXT NOT NULL,
  raw_value     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_errors__job ON import_errors (import_job_id, row_number);

CREATE TABLE export_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL,
  format        TEXT NOT NULL DEFAULT 'XLSX' CHECK (format IN ('CSV','XLSX')),
  filters       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- lưu để audit ai xuất gì
  columns       TEXT[],
  -- Scope tại thời điểm xuất (audit: Sale không thể xuất data ngoài phạm vi)
  applied_scope TEXT NOT NULL,
  row_count     INT,
  file_media_id UUID REFERENCES media(id),
  download_expires_at TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN
                ('QUEUED','PROCESSING','COMPLETED','FAILED','EXPIRED')),
  error_message TEXT,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ
);
CREATE INDEX idx_export_jobs__creator ON export_jobs (created_by, created_at DESC);
```

---

## 5.18 Bảng PHASE SAU (chưa tạo ở MVP — chỉ khai báo hướng)

Không migrate ở phase 1. Ghi ở đây để chứng minh architecture không chặn (§57, §64).

| Bảng | Phase | Móc vào |
|---|---|---|
| `ad_accounts`, `ad_campaigns`, `ad_campaign_stats` | 2 | `campaigns.external_platform` + `external_campaign_id` đã có sẵn |
| `attribution_models`, `attribution_credits` | 2 | đọc `customer_touchpoints`, không đổi core |
| `automation_rules`, `automation_runs`, `automation_actions` | 3 | subscribe `outbox_events` |
| `message_templates`, `message_logs` | 3 | `notification_rules.channels` đã có chỗ cho EMAIL/ZALO/TELEGRAM |
| `affiliates`, `commissions`, `commission_rules` | 4 | event `payment.paid`, `revenue_entries` |
| `accounting_entries`, `ledger_accounts` | 4 | `payments` + `revenue_entries` |
| `ai_scores`, `ai_interactions` | 4 | read model Customer/Lead/Timeline |
| `warehouses`, `inventory_movements` | 4 (nếu cần) | `products`, `order_items` |

## 5.19 Extension Postgres cần bật

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- tìm kiếm tên/điện thoại gần đúng
CREATE EXTENSION IF NOT EXISTS unaccent;    -- tìm tiếng Việt không dấu
CREATE EXTENSION IF NOT EXISTS btree_gin;   -- index kết hợp
-- pg_partman (tùy chọn) cho partition page_views / tracking_events
```

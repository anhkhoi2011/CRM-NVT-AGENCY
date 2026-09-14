-- NVT AGENCY CRM - MySQL schema
-- Chạy trong cPanel phpMyAdmin sau khi tạo database.
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(96) PRIMARY KEY,
  phone VARCHAR(20) NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(160) NOT NULL,
  role ENUM('ADMIN','LEADER','SALE','UNASSIGNED','MARKETING','ACCOUNTING') NOT NULL DEFAULT 'UNASSIGNED',
  team_id VARCHAR(96) NULL,
  leader_id VARCHAR(96) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_active (role, active),
  INDEX idx_users_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(96) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(254) NULL,
  source VARCHAR(120) NULL,
  campaign VARCHAR(160) NULL,
  website_id VARCHAR(96) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'NEW',
  sale_id VARCHAR(96) NULL,
  leader_id VARCHAR(96) NULL,
  team_id VARCHAR(96) NULL,
  note TEXT NULL,
  custom_fields_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_sale (sale_id), INDEX idx_customers_leader (leader_id),
  INDEX idx_customers_phone (phone), INDEX idx_customers_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(96) PRIMARY KEY,
  sku VARCHAR(60) NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NULL,
  price DECIMAL(18,2) NOT NULL DEFAULT 0,
  type ENUM('SALE','RENTAL') NOT NULL DEFAULT 'SALE',
  rental_months INT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(96) PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  customer_id VARCHAR(96) NOT NULL,
  sale_id VARCHAR(96) NULL,
  leader_id VARCHAR(96) NULL,
  team_id VARCHAR(96) NULL,
  total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  items_json JSON NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_customer (customer_id), INDEX idx_orders_sale (sale_id), INDEX idx_orders_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(160) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crm_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(96) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_expiry (expires_at), INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

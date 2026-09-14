-- Lưu bền vững bản gửi landing page; không xóa dữ liệu khi triển khai.
CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(96) PRIMARY KEY,
  dedupe_key CHAR(64) NOT NULL UNIQUE,
  payload_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

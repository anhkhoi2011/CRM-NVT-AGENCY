-- Chat hỗ trợ nội bộ CRM. An toàn khi chạy lại, không thay đổi dữ liệu hiện có.
CREATE TABLE IF NOT EXISTS support_conversations (
  id VARCHAR(96) PRIMARY KEY,
  requester_user_id VARCHAR(96) NOT NULL UNIQUE,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_preview VARCHAR(255) NOT NULL DEFAULT '',
  admin_read_at DATETIME NULL,
  employee_read_at DATETIME NULL,
  resolved_at DATETIME NULL,
  resolved_by_user_id VARCHAR(96) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_support_conversation_status_time (status, last_message_at),
  INDEX idx_support_conversation_requester (requester_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_messages (
  id VARCHAR(96) PRIMARY KEY,
  conversation_id VARCHAR(96) NOT NULL,
  requester_user_id VARCHAR(96) NOT NULL,
  sender_user_id VARCHAR(96) NULL,
  sender_role VARCHAR(16) NOT NULL,
  content TEXT NULL,
  image_file VARCHAR(160) NULL,
  image_mime VARCHAR(64) NULL,
  telegram_message_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_support_message_conversation_time (conversation_id, created_at),
  INDEX idx_support_message_telegram (telegram_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

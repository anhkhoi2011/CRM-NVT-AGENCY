-- Migration bo sung: khong xoa hay reset du lieu hien co.
CREATE TABLE IF NOT EXISTS crm_documents (collection VARCHAR(64) NOT NULL, id VARCHAR(96) NOT NULL, body JSON NOT NULL, deleted TINYINT NOT NULL DEFAULT 0, PRIMARY KEY(collection,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS crm_changes (id BIGINT AUTO_INCREMENT PRIMARY KEY, request_id VARCHAR(96) NOT NULL, actor_id VARCHAR(96) NOT NULL, changes_json JSON NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY(request_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS crm_write_lock (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT IGNORE INTO crm_write_lock(id) VALUES (1);

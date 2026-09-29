-- Login lookup indexes. The base schema already declares phone/email UNIQUE;
-- these statements are safe for databases created from older schemas.
SET @has_phone_index := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND column_name='phone');
SET @sql_phone := IF(@has_phone_index=0, 'ALTER TABLE users ADD INDEX idx_users_phone_login (phone)', 'SELECT 1');
PREPARE stmt_phone FROM @sql_phone; EXECUTE stmt_phone; DEALLOCATE PREPARE stmt_phone;
SET @has_email_index := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND column_name='email');
SET @sql_email := IF(@has_email_index=0, 'ALTER TABLE users ADD INDEX idx_users_email_login (email)', 'SELECT 1');
PREPARE stmt_email FROM @sql_email; EXECUTE stmt_email; DEALLOCATE PREPARE stmt_email;

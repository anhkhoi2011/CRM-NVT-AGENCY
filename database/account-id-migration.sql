-- NVT AGENCY CRM - bổ sung ID tài khoản hiển thị/đăng nhập.
-- An toàn cho dữ liệu cũ: không đổi users.id và không xóa bất kỳ bản ghi nào.
-- Có thể chạy lại nhiều lần trên MySQL/MariaDB.

SET @account_code_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'account_code'
);

SET @account_code_sql = IF(
  @account_code_exists = 0,
  'ALTER TABLE users ADD COLUMN account_code VARCHAR(64) NULL AFTER id, ADD UNIQUE KEY uq_users_account_code (account_code)',
  'SELECT 1'
);

PREPARE account_code_stmt FROM @account_code_sql;
EXECUTE account_code_stmt;
DEALLOCATE PREPARE account_code_stmt;

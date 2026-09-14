-- Danh mục sản phẩm mặc định NVT Agency CRM.
-- An toàn khi chạy lại: chỉ thêm khi cả ID và SKU đều chưa tồn tại.
START TRANSACTION;

INSERT INTO products (id, sku, name, category, price, type, rental_months, active)
SELECT 'p-kh-hhcb', 'KH-HHCB-09', 'Khóa học đầu tư hàng hóa cơ bản', 'Khóa học', 5000000, 'SALE', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'p-kh-hhcb' OR sku = 'KH-HHCB-09');

INSERT INTO products (id, sku, name, category, price, type, rental_months, active)
SELECT 'p-kh-klcs', 'KH-KLCS-10', 'Khóa học chuyên sâu đầu tư kim loại', 'Khóa học', 10000000, 'SALE', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'p-kh-klcs' OR sku = 'KH-KLCS-10');

INSERT INTO products (id, sku, name, category, price, type, rental_months, active)
SELECT 'p-kh-rsi', 'KH-RSIMA-11', 'Khóa học RSI MA vùng phản ứng chuyên sâu', 'Khóa học', 26000000, 'SALE', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'p-kh-rsi' OR sku = 'KH-RSIMA-11');

INSERT INTO products (id, sku, name, category, price, type, rental_months, active)
SELECT 'p-ind-1m', 'IND-BF-R1M', 'Chỉ báo Breakout + Fake Breakout · thuê 1 tháng · 39$', 'Chỉ báo', 1014000, 'RENTAL', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'p-ind-1m' OR sku = 'IND-BF-R1M');

INSERT INTO products (id, sku, name, category, price, type, rental_months, active)
SELECT 'p-ind-3m', 'IND-BF-R3M', 'Chỉ báo Breakout + Fake Breakout · thuê 3 tháng · 117$', 'Chỉ báo', 3042000, 'RENTAL', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'p-ind-3m' OR sku = 'IND-BF-R3M');

INSERT INTO products (id, sku, name, category, price, type, rental_months, active)
SELECT 'p-ind-6m', 'IND-BF-R6M', 'Chỉ báo Breakout + Fake Breakout · thuê 6 tháng · 234$', 'Chỉ báo', 6084000, 'RENTAL', 6, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'p-ind-6m' OR sku = 'IND-BF-R6M');

INSERT INTO products (id, sku, name, category, price, type, rental_months, active)
SELECT 'p-ind-12m', 'IND-BF-R12M', 'Chỉ báo Breakout + Fake Breakout · thuê 1 năm · 468$', 'Chỉ báo', 12168000, 'RENTAL', 12, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'p-ind-12m' OR sku = 'IND-BF-R12M');

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('product_catalog_20260914_v1', 'true')
ON DUPLICATE KEY UPDATE setting_value = setting_value;

COMMIT;

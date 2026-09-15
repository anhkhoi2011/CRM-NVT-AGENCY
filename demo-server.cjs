'use strict';

// Máy local dùng dữ liệu mẫu trong RAM; không kết nối hoặc ghi vào MySQL thật.
process.env.DEMO_MODE = '1';
require('./app.js');

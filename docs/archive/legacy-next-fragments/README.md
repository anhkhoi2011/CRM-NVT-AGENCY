# Legacy Next.js fragments

Các file trong thư mục này là prototype Next.js/React cũ được giữ nguyên để tham khảo.
Chúng không tạo thành một ứng dụng chạy được: repo ban đầu thiếu `package.json`, cấu hình
Next.js, dependencies và một số module nội bộ (`types`, `data`, `utils`, store).

Đuôi `.ts.txt` / `.tsx.txt` giúp IDE không phân tích nhầm các fragment này như source của
bản CRM hiện tại. Bản demo đang chạy bắt đầu từ `../../../demo.html` và chỉ dùng bộ file
`docs/architecture/14-crm-complete-demo.*`.

Khi triển khai production, hãy tạo ứng dụng Next.js mới trong `apps/crm-admin` rồi port có
chọn lọc các phần còn giá trị; không đổi tên các file archive trở lại trong root.

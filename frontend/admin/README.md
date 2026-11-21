# Frontend Admin (giữ từ dự án gốc)

Đã được chuyển từ thư mục gốc vào `frontend/admin/` để tách với `frontend/client/`.

- URL khi chạy cùng server: `http://localhost:3000/admin/`
- API: dùng chung `http://localhost:3000/api/v1/`
- Cấu hình `js/config.js` có `USE_MOCK: false` theo mặc định.
- Backend triển khai lại hợp đồng API Admin từ `js/mock/server.js` trong `backend/src/adminRoutes.js` và lưu dữ liệu trên server thay vì `localStorage`.
- Thao tác thêm sách, chỉnh sửa trạng thái, phê duyệt Bundle/Event/Coupon, xử lý đơn hàng, người dùng, khiếu nại, audit vẫn sử dụng API `/admin/*`.
- Mục **Sách & PDF → Tải lên phiên bản PDF** nhận file .pdf thực (tối đa 50MB) qua API `/admin/books/:id/pdf`.
- Bản Mock cũ vẫn ở `js/mock/` để tham khảo hợp đồng API; bật `USE_MOCK: true` chỉ khi muốn chạy Admin tách riêng, vì lúc đó sẽ **không chia sẻ dữ liệu** với Client.

Tệp `tests/e2e.js` là bộ kiểm thử giao diện kế thừa của dự án gốc và cần cài thêm `playwright` cho Node.js nếu muốn chạy. Các test tích hợp Backend mới không yêu cầu cài thư viện: chạy `npm test` ở thư mục gốc.

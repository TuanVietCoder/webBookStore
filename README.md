# Web Admin – Nhà sách PDF (v2.0.3)

Website quản trị cho Employee và Manager. Viết bằng JavaScript thuần (ES modules), không cần build, không cần cài thư viện.

## Chạy thử
1. Mở terminal trong thư mục này và chạy một web server tĩnh, ví dụ: `python3 -m http.server 8080`
   (hoặc `npx serve .`). Không mở trực tiếp bằng file:// vì trình duyệt chặn ES modules.
2. Mở http://localhost:8080
3. Tài khoản thử (dữ liệu giả lập):
   - Manager: `manager@nhasach.test` / `Manager@123`
   - Employee: `employee@nhasach.test` / `Employee@123`
4. Nút "Đặt lại dữ liệu mẫu" trên thanh trên cùng đưa dữ liệu về seed ban đầu (mục 12.2 của đặc tả).

## Nối với backend của Phúc
1. Mở `js/config.js`, đặt `USE_MOCK: false` và chỉnh `API_BASE_URL`.
2. Toàn bộ lời gọi API đi qua `js/api.js` (gắn Bearer token, header `If-Match: <Version>`, ném `ApiError` có `status`, `errorCode`, `details.field`).
3. Backend cần trả đúng hợp đồng như mock: xem `js/mock/server.js` (mỗi `route(...)` là một endpoint theo mục 9.2). Phân trang trả `{items,total,page,pageSize}`; lỗi trả `{errorCode,message,details,requestId}`.
4. Phần chỉ có ở mock: `POST /__mock/reset`, `POST /ai/admin/actions/{id}/decline` (spec chưa có endpoint hủy xem trước, nên thêm hoặc bỏ nút Hủy).

## Cấu trúc
- `js/app.js` router + khung giao diện + menu theo quyền
- `js/api.js` lớp gọi API (mock hoặc thật)
- `js/ui.js` thành phần giao diện dùng chung (modal, form, bảng, toast)
- `js/pages/*.js` các màn hình: tổng quan, sách & PDF, danh mục, Bundle/Event/Coupon (revision), đơn hàng, khiếu nại, báo cáo nội dung, tài khoản, nhân sự, báo cáo, audit, tri thức AI, cấu hình, trợ lý AI
- `js/mock/db.js` dữ liệu seed, `js/mock/server.js` API giả lập (quyền, validate, mã lỗi 403/409/422, audit)
- `tests/e2e.js` kiểm thử tự động bằng Playwright (chạy khi web đang phục vụ ở cổng 8765)

## Quy tắc nghiệp vụ đã mô phỏng
- Phân quyền Employee/Manager theo ma trận 2.2; menu và API đều kiểm quyền.
- Bundle/Event/Coupon theo revision: nháp → gửi duyệt → Manager duyệt/từ chối (bắt buộc lý do); Event chồng lịch trả 409; Event có lịch bàn giao khi duyệt revision bắt đầu sau.
- Khóa/mở khóa tài khoản theo role đích; không tự khóa mình; không khóa Manager cuối; thu hồi phiên khi khóa.
- Sách: BookId trùng 409; xuất bản cần file PDF; đình chỉ/mở lại phục vụ cần lý do; xóa mềm/khôi phục.
- Khiếu nại: luồng trạng thái, ghi chú nội bộ, đóng thì không phản hồi được.
- Audit: mọi thay đổi ghi nhật ký, giá trị nhạy cảm bị che; `TableName`/`RecordRowId` có thể NULL.
- AI Admin: xem trước → xác nhận một lần; token hết hạn/đã dùng/dữ liệu đổi thì từ chối; ghi audit nguồn AI.

## Giới hạn hiện tại
- Chưa có CSRF, tải file PDF thật (chỉ giả lập tên và dung lượng), thông báo qua Outbox.
- Trạng thái DISABLED của Bundle/Event/Coupon đang dùng cờ tắt; chờ chốt cách thống nhất trong đặc tả.
- Quyền Employee với Tri thức AI và Cấu hình hệ thống đang tạm chỉ Manager.

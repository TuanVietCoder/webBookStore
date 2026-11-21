# Web Admin – Nhà sách PDF (v2.0.3)

Website quản trị cho Employee và Manager. Viết bằng JavaScript thuần (ES modules), không cần build, không cần cài thư viện.

## Chạy thử
Cách nhanh nhất (có hỗ trợ AI Gemini): `node server/index.js` rồi mở http://localhost:8080 (cần Node 18+, không cần cài thư viện). Dùng `python3 -m http.server` vẫn được nhưng AI chỉ ở chế độ mô phỏng.
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

## Tích hợp AI (Claude hoặc Gemini)
1. Lấy khóa: Claude tại https://console.anthropic.com, hoặc Gemini tại https://aistudio.google.com.
2. Sao chép `.env.example` thành `.env`, đặt `LLM_PROVIDER=claude` (hoặc `gemini`) và điền khóa tương ứng (`ANTHROPIC_API_KEY=...`). File `.env` đã nằm trong `.gitignore`, **không commit khóa**. Tên mô hình đổi bằng `CLAUDE_MODEL` / `GEMINI_MODEL`.
3. Chạy `node server/index.js`. Dòng đầu tiên báo "AI: claude (đã có khóa)" là nhận khóa thành công. Vào menu "Trợ lý AI Admin" để hỏi.
- Khóa chỉ nằm ở server (`server/claude.js`, `server/gemini.js`); trình duyệt gọi `/api/v1/ai/llm`. System prompt và danh sách tool (`server/shared.js`) do server quyết định, theo vai trò (Employee không có tool tài chính/audit).
- Mô hình chỉ chọn tool; tool chạy ở `js/mock/server.js` (`execAiTool`) và tự kiểm quyền. Thao tác ghi (khóa tài khoản) chỉ tạo bản xem trước, người dùng phải bấm xác nhận.
- Không có khóa hoặc nhà cung cấp lỗi thì tự rơi về chế độ mô phỏng cũ (có thông báo).
- Khi backend của Phúc xong: vòng lặp tool (`js/ai/llm.js` + `execAiTool`) chuyển sang backend, tool gọi service thật; xác thực vai trò bằng token phía server thay vì vai trò do trình duyệt gửi (ở giai đoạn mock, vai trò trong yêu cầu chưa được xác thực).
- Kiểm thử không cần khóa thật: chạy `node tests/fake-claude.js 9912` (hoặc `fake-gemini.js 9911`), rồi `LLM_PROVIDER=claude ANTHROPIC_API_KEY=fake-key ANTHROPIC_BASE_URL=http://localhost:9912 PORT=8766 node server/index.js`, rồi `node tests/e2e-ai.js`.

## Test gọn
`npm install` (một lần) rồi `npm test`. Test tự bật server, mở trình duyệt (Chromium của Playwright, hoặc Edge/Chrome có sẵn trên máy) và kiểm tra 8 luồng chính: đăng nhập, phân quyền Manager/Employee, danh sách sách, AI hỏi đáp và AI khóa tài khoản qua bước xác nhận. Test luôn tắt khóa API nên AI chạy chế độ mô phỏng, không tốn tiền. Trên Windows nếu PowerShell chặn `npm`, dùng `npm.cmd install` và `npm.cmd test`.

## Cấu trúc
- `js/app.js` router + khung giao diện + menu theo quyền
- `server/` máy chủ Node nhỏ: web tĩnh + cầu nối Claude/Gemini; `js/ai/llm.js` vòng lặp gọi tool
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

## Cơ sở dữ liệu

- `database/schema.sql`: script tạo CSDL SQL Server (53 bảng, khóa ngoại, index, CHECK, dữ liệu 3 vai trò). Tạo một database trống rồi chạy script.
- `docs/TICH_HOP.md`: hướng dẫn ghép với backend/web của Phúc.
- `docs/ERD.md`: sơ đồ quan hệ thực thể theo từng nhóm (Mermaid), ảnh PNG nằm trong `docs/erd/`.
- Xem sơ đồ trong SSMS: chạy `schema.sql`, rồi Database Diagrams > New Database Diagram.

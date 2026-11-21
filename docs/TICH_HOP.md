# Hướng dẫn ghép web Admin với phần của Phúc

## 1. Lấy code và chạy
1. `git clone https://github.com/TuanVietCoder/webBookStore.git`, vào thư mục rồi chạy `node server/index.js` (Node 18+, không cần cài thư viện), mở http://localhost:8080.
2. Tài khoản thử: `manager@nhasach.test` / `Manager@123`, `employee@nhasach.test` / `Employee@123`.
3. Kiểm tra nhanh: `npm install` rồi `npm test` (8 kiểm tra, AI chạy chế độ mô phỏng).

## 2. Cách sáp nhập
Web Admin là tĩnh (HTML + JS thuần), nên có hai cách:
- **Cách A (khuyên dùng): giữ thư mục riêng.** Chép nguyên `index.html`, `css/`, `js/` vào thư mục `admin/` của dự án chung và cho backend phục vụ tĩnh thư mục đó. Không đụng vào code của Phúc.
- **Cách B: gộp repo.** Đưa repo này vào dự án chung (thư mục `admin/`, `database/`, `docs/`), giữ nguyên lịch sử.
Hai cách đều không cần build.

## 3. Nối backend thật (thay mock)
1. `js/config.js`: đặt `USE_MOCK: false`, chỉnh `API_BASE_URL` (mặc định `/api/v1`).
2. Mọi lời gọi đi qua `js/api.js`: gắn `Authorization: Bearer <token>`, header `If-Match: <Version>` khi sửa. Lỗi cần trả `{errorCode, message, details, requestId}`; danh sách trả `{items, total, page, pageSize}`.
3. Hợp đồng API đầy đủ nằm ở `js/mock/server.js` (mỗi `route(...)` là một endpoint; mã lỗi 401/403/409/422/428 như spec mục 9.2). 47 endpoint chính:
   - Đăng nhập: `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
   - Sách: `/admin/books` (GET, POST, PATCH, `/:id/files`, `/:id/serving-status`)
   - Danh mục (tác giả, danh mục, NXB): `/admin/{catalog}` CRUD + xóa mềm + khôi phục
   - Bundle/Event/Coupon (revision): `/admin/{kind}`, `/revisions`, `/revisions/:rev/{submit|approve|reject}`, `/disable`, `/history`
   - Đơn hàng: `/admin/orders`; Tài khoản: `/admin/users`, `/disable`, `/enable`; Nhân sự: `/admin/staff`
   - Khiếu nại, báo cáo nội dung, audit, báo cáo, tri thức AI, cấu hình
   - AI: `POST /ai/admin/chat`, `/ai/admin/actions/:id/confirm`, `/ai/admin/actions/:id/decline`
4. Chỉ có ở mock: `POST /__mock/reset`. `/ai/admin/actions/:id/decline` chưa có trong spec (thêm hoặc bỏ nút Hủy).
5. CSDL: chạy `database/schema.sql` trên SQL Server (sơ đồ: `docs/ERD.md`).

## 4. Phần AI
- Cầu nối nằm ở `server/` (Node): giữ khóa API, gọi Claude hoặc Gemini (`LLM_PROVIDER`), giới hạn tốc độ, chặn file nhạy cảm. Cấu hình bằng `.env` (mẫu `.env.example`, **không commit khóa**).
- Danh sách tool và system prompt: `server/shared.js`. Phần chạy tool theo từng vai trò: hàm `execAiTool` trong `js/mock/server.js`.
- **Khi có backend thật:** chuyển vòng lặp gọi tool (`js/ai/llm.js` + `execAiTool`) về backend, cho từng tool gọi service thật và xác thực vai trò bằng token phía server (hiện vai trò do trình duyệt gửi, chỉ chấp nhận ở giai đoạn mock). Ghi `AIActionLogs` cho mỗi lần gọi tool.
- **AI Buyer** (web khách hàng) chưa làm: dùng lại `server/` và thêm bộ tool chỉ đọc catalog công khai, phiên khách 24 giờ.

## 5. Việc còn mở
- Cách thống nhất trạng thái DISABLED cho Bundle/Event/Coupon.
- Quyền của Employee với Tri thức AI và Cấu hình hệ thống (tạm chỉ Manager).
- Chưa có CSRF, tải file PDF thật, thông báo qua Outbox.

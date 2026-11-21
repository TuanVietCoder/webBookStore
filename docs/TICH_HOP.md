# Ghi chú sáp nhập: Admin (Việt) + Backend/Client (Phúc)

## Cách đã ghép
Nền là cấu trúc dự án của Phúc (`backend/`, `frontend/admin/`, `frontend/client/`), ghép ba chiều với bản Admin gốc `ace3f8b` nên **không có xung đột file nào**:
- Phúc sửa: `frontend/admin/js/{api,config,ui}.js`, `pages/{books,knowledge,promos}.js`, `css/style.css`, `tests/e2e.js` (ảnh bìa, tải PDF thật, nối API).
- Việt thêm: AI Admin dùng mô hình thật (`frontend/admin/js/pages/ai.js`, `js/mock/server.js`, `js/ai/llm.js` cho chế độ mock), cộng `backend/src/llm/*`, `backend/src/aiLoop.js`, `backend/src/loadEnv.js`, phần AI trong `backend/src/adminRoutes.js`, `database/`, `docs/ERD.md`.
- Chạm vào code của Phúc ở đúng 3 chỗ: `server.js` (thêm 1 dòng `import './loadEnv.js'`), `adminRoutes.js` (thay route `POST /ai/admin/chat`, thêm 1 dòng import), `package.json`/`.env.example`/`docker-compose.yml` (thêm biến AI và script `test:ui`).

## Chạy và kiểm tra
1. `npm start` rồi mở http://localhost:3000/ (Client) và http://localhost:3000/admin/ (Admin).
2. `npm test`: 11 test backend (10 của Phúc + 1 test AI dùng Claude giả) đều đạt.
3. `npm install --no-save playwright` rồi `npm run test:ui`: 8 kiểm tra giao diện Admin trên backend thật, dùng DB tạm.

## AI Admin
Xem mục "Trợ lý AI Admin dùng mô hình thật" trong README. Điểm khác bản mock: vòng lặp gọi tool chạy ở server và vai trò lấy từ phiên đăng nhập, nên đã xử lý xong hai điểm yếu "vai trò do trình duyệt gửi" và "khóa API nằm cạnh web tĩnh".

## Việc còn mở
1. Backend đang lưu bằng file JSON (`backend/data/db.json`); `database/schema.sql` (SQL Server, 53 bảng) chưa được nối. Cần thống nhất lộ trình chuyển.
2. Chatbot Client dùng OpenAI, AI Admin dùng Claude/Gemini: nên thống nhất một nhà cung cấp để quản lý một khóa.
3. AI Admin chưa ghi `AIActionLogs` từng lần gọi tool (mới ghi audit và trạng thái yêu cầu).
4. Trạng thái DISABLED của Bundle/Event/Coupon và quyền Employee với Tri thức AI/Cấu hình vẫn chờ chốt trong đặc tả.
5. Giữ bí mật: `.env`, `backend/data/db.json`, `backend/storage/` đã nằm trong `.gitignore`.

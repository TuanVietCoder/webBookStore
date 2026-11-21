# WebBookStore Full-stack — Admin + Client + AI + Tặng sách + Đọc PDF demo

Dự án được mở rộng từ ZIP `webBookStore-main` (ban đầu **chỉ là Admin frontend + API giả lập localStorage**). Phiên bản này có thêm **Client frontend độc lập**, **Node.js REST API chạy thực**, một kho dữ liệu JSON lưu trên server, lưu trữ file PDF, và kiểm thử tích hợp Admin ↔ Client.

> **Phạm vi:** Bản tham chiếu/lab chạy end-to-end, dùng để tích hợp và kiểm tra nghiệp vụ trước khi kết nối backend production của nhóm. Chưa phải sản phẩm thương mại sẵn sàng triển khai công khai.


## Sự kiện Event chạy theo lịch và hiển thị trên Client (mới)

**Admin → Event → Tạo nháp → Gửi duyệt → Manager duyệt.** Khi đến giờ `startAt`, Client tự đổi banner / hero theo **Event đang chạy**, có màu chủ đề, đồng hồ đếm ngược, trang sự kiện riêng, các sách/combo được giảm giá. Header sẽ có thông báo Event trên mọi trang. Khi Event kết thúc hoặc bị tắt, banner biến mất và giá quay về đúng giá Backend.

- Client `http://localhost:3000/` và `http://localhost:3000/#/events`.
- Trang chi tiết Event `http://localhost:3000/#/events/ID` (ID Event cụ thể).
- Admin có các trường **Tiêu đề banner, Mô tả, Nhãn nổi bật, Chủ đề màu** và nút **Mở Event trên Client** với Event đang diễn ra.
- Có 4 màu: Book Sale xanh, Tết đỏ vàng, Sunset cam, Midnight xanh đêm. Sự kiện chỉ public nếu `APPROVED`, bật và đang trong khung giờ; Client kiểm tra thay đổi mỗi 30 giây.
- Hướng dẫn click từng bước, cấu trúc API và cách nâng cấp dữ liệu cũ: [docs/EVENTS_CLIENT.md](docs/EVENTS_CLIENT.md).

## MỚI: Mua tặng, nhận quà, đọc PDF và chatbot AI nâng cấp

Đã bổ sung 3 luồng kết nối cùng Backend + DB của Admin:

1. **Mua tặng sách (Client):** Mở một cuốn sách → **🎁 Mua tặng** (hoặc Giỏ hàng → **Đây là đơn quà tặng**). Nhập email người nhận và lời nhắn, mỗi dòng sản phẩm chọn **số lượng 1**. Thanh toán mô phỏng như đơn thường. Mở **Đơn hàng** vừa thanh toán → **Sao chép mã nhận quà `GFT-...`** và gửi riêng cho người nhận. Chưa có gửi email tự động.
2. **Người nhận:** Đăng ký/đăng nhập Client với **đúng email được tặng** → **Quà tặng → Nhận sách được tặng** → nhập mã → sách xuất hiện tại **Thư viện của tôi**. Chỉ người mua được xem mã trong hóa đơn; người mua **không** sở hữu quyền đọc của đơn tặng. Mã tạo bằng HMAC dựa trên khóa lưu trong DB, không lưu plaintext, chỉ được nhận một lần; nhập lại của cùng người nhận là idempotent. Đơn tặng xuất hiện trong Admin → Orders.
3. **Đọc sách PDF:** Với sách đã mua hoặc đã nhận quà, Client → **Thư viện của tôi → Đọc ngay**. Trình đọc xem PDF trong website, có thể tải về. Nếu Admin chưa tải file PDF thật, Backend **tạo PDF demo 7 trang** dùng văn bản Latin *Lorem Ipsum* và dấu hiệu cảnh báo **không phải nội dung tác phẩm**, hoạt động cho sách mới lẫn sách seed. Khi Admin upload PDF thật, nội dung upload được ưu tiên. API kiểm quyền Buyer + entitlement ở **mỗi yêu cầu tải/đọc**.

**Chatbot nâng cấp:** Có gợi ý theo ngân sách/sở thích, lựa chọn sách tặng người mới đi làm, so sánh tối đa hai cuốn, nhớ tối đa 6 tin nhắn gần nhất trong tab, hiểu "cuốn thứ 2" và các câu hỏi tiếp theo, giải thích quy trình nhận quà và PDF mẫu, gợi ý lời nhắn tặng sách. Có API key thì AI chọn ý định và ID sách/FAQ công khai; không có key thì dùng quy tắc cục bộ. Backend vẫn dựng câu trả lời từ dữ liệu đáng tin cậy, từ chối ngoài phạm vi, không tiết lộ nội dung Admin nội bộ. Không bảo đảm bộ lọc phạm vi tuyệt đối.

**Hướng dẫn có ảnh chụp luồng thao tác (mô tả theo bước), hợp đồng API và kịch bản kiểm thử:** [docs/GIFTS_READER_AI.md](docs/GIFTS_READER_AI.md), [docs/API.md](docs/API.md), [docs/TESTING.md](docs/TESTING.md).

> **Lưu ý khi nâng cấp từ ZIP cũ:** Tắt server cũ bằng `Ctrl+C`. Sao lưu **`backend/data/db.json` và toàn bộ thư mục `backend/storage/`**, chép vào đúng đường dẫn trong source mới. Backend cập nhật DB tương thích khi khởi động; sách, tài khoản, đơn hàng và ảnh cũ được giữ nguyên. Hãy sao lưu luôn DB sau khi tạo quà tặng vì khóa HMAC được lưu trong đó, mất khóa sẽ không còn xác thực được mã quà tặng cũ.
>
> **Phạm vi bản lab:** chưa có xác minh email của người nhận, chưa có gửi email, chưa có payment gateway thật hay cơ chế thu hồi quà. Không triển khai Internet/production khi chưa có xác minh email, webhook thanh toán, database có transaction, backups, HTTPS và chống lạm dụng. Tên sách seed chỉ là metadata minh họa; PDF demo không sao chép nội dung sách có bản quyền.

---

## MỚI: Tải / thay / xóa ảnh bìa trong Admin

Tại **Admin → Sách & PDF → chọn sách → Tải ảnh bìa / Thay / xóa ảnh bìa** (hoặc dùng **Thêm/Sửa sách**), chọn JPG, PNG hoặc WebP dưới **5MB**, xem trước và nhấn **Lưu sách**. File được lưu tại `backend/storage/covers/`; metadata nằm trong record sách chung. **Client tự hiển thị bìa thật** trên trang chủ, danh mục, chi tiết, giỏ hàng, combo và chatbot khi sách đang xuất bản/phục vụ. Nếu không có ảnh, vẫn dùng bìa CSS như bản cũ. Buyer không được phép sửa ảnh; cover của sách nháp không công khai.

**Nâng cấp mà không mất dữ liệu:** Trước khi giải nén bản này, tắt server (`Ctrl+C`) rồi sao lưu `backend/data/db.json` và **cả thư mục** `backend/storage/` (bao gồm PDF và ảnh). Giải nén ZIP mới, chép hai nguồn dữ liệu này về vị trí tương ứng. Không xóa DB, không đặt lại Demo và không cần tạo lại tài khoản/sách. Hướng dẫn từng bước và các API: **[docs/BOOK_COVERS.md](docs/BOOK_COVERS.md)**.

---

## MỚI: Trợ lý tư vấn sách (Client) và AI tùy chọn

Chatbot nằm ở **góc phải phía dưới trang Client**, hoạt động không cần tài khoản. Trợ lý chỉ phản hồi về sách đang bán và các chức năng mua/đọc ebook của WebBookStore. Ví dụ: **“Mắt biếc giá bao nhiêu?”**, **“Gợi ý sách văn học”**, **“Sách nào đang giảm giá?”**, **“Tải PDF thế nào?”**. Nếu hỏi chủ đề ngoài nhà sách như thời tiết, bóng đá, viết code, chatbot chỉ trả thông báo giới hạn phạm vi và không thực hiện yêu cầu.

- **Không có API key:** chatbot vẫn dùng được ngay, tra cứu sách/giá/khuyến mãi và FAQ theo quy tắc cục bộ, trả `mode: catalog` (đây **không phải mô hình AI**).
- **Có `OPENAI_API_KEY`:** Backend gọi mô hình OpenAI để hiểu ý định và chọn ID sách/FAQ thích hợp, trả `mode: ai` khi gọi thành công. **Không đưa API key ra trình duyệt.** AI không được tự tạo lời giải thích không có căn cứ; Backend biên soạn câu trả lời từ giá và dữ liệu công khai thực tế. Nếu API AI tạm lỗi, hệ thống quay về tra cứu danh mục.
- **Đồng bộ Admin:** chatbot sử dụng cùng quy tắc hiển thị sách, sự kiện khuyến mãi và giá như `/shop/books`. Khi Admin thay đổi giá, xuất bản hoặc ngừng bán sách, chatbot lấy thông tin mới ngay ở lượt hỏi tiếp theo. Chỉ FAQ có **`PUBLISHED` và `Cho phép Client xem`** mới được đọc; dữ liệu quản trị và sách nháp không được gửi đến AI.
- **Giới hạn & quyền riêng tư:** mỗi IP tối đa 15 câu hỏi/phút, câu hỏi tối đa 400 ký tự. Lịch sử không lưu lên Backend, chỉ giữ trong tab hiện tại. Khi bật OpenAI, nội dung câu hỏi cùng một phần danh mục sách công khai được gửi đến dịch vụ AI bên ngoài để chọn sách. Không nhập mật khẩu, số thẻ, hoặc dữ liệu nhạy cảm.

### Bật AI thật trên Windows PowerShell

1. Có **OpenAI API key** còn hiệu lực (việc gọi API có thể phát sinh phí riêng). Không viết key vào `frontend/`.
2. Trong Terminal **tại thư mục `webBookStore-main`**, chạy các lệnh sau rồi **khởi động lại server**:

```powershell
$env:OPENAI_API_KEY="DAN_API_KEY_CUA_BAN_VAO_DAY"
$env:OPENAI_MODEL="gpt-4o-mini"
npm.cmd start
```

Nếu đã chạy `npm start` trước đó, nhấn **Ctrl+C** để tắt tiến trình cũ rồi khởi động lại bằng lệnh trên. Lỗi PowerShell chặn `npm.ps1` được tránh bằng `npm.cmd start`. Không cần `npm install`.

3. Mở `http://localhost:3000/`, nhấn **Hỏi trợ lý sách**. Kiểm tra `http://localhost:3000/api/v1/shop/chat/status` có `"mode":"ai"` khi server đã nhận key. **Chế độ `ai` trong status chỉ cho biết có key; trạng thái AI trong từng câu trả lời mới xác nhận gọi AI thực sự thành công.**

4. **Cập nhật FAQ từ Admin:** Đăng nhập Manager → **Tri thức cho AI Admin & Client** → thêm/sửa bài → chọn `PUBLISHED` và bật **Cho phép Client xem nội dung này**. Không đánh dấu công khai cho hướng dẫn nội bộ hoặc bí mật. Các câu hỏi về thanh toán demo, tải file PDF, hỗ trợ đơn hàng có sẵn FAQ mẫu (dữ liệu cũ được bổ sung một lần khi nâng cấp).

**24/7 có điều kiện:** chatbot có thể nhận câu hỏi bất cứ lúc nào **khi Backend và Internet/dịch vụ AI đang hoạt động**. Chạy `npm.cmd start` trên máy cá nhân không bảo đảm phục vụ 24/7 khi máy tắt. Muốn chạy liên tục, triển khai trên máy chủ luôn bật hoặc Docker với `restart: unless-stopped`, kèm HTTPS, giám sát và bảo mật production. Hệ thống này vẫn chỉ là bản lab, chưa có SLA uptime.

---

### Ghi chú nâng cấp từ bản Fullstack/Chatbot trước

Nếu bạn đã chạy phiên bản `WebBookStore_Fullstack_Admin_Client_Backend.zip` và nhập dữ liệu, hãy **dừng server bằng `Ctrl+C`** và sao lưu `webBookStore-main/backend/data/db.json` cùng thư mục `backend/storage/`. Sau khi giải nén ZIP phiên bản mới, chép các tài nguyên sao lưu trở lại **cùng vị trí** trong project mới rồi chạy `npm.cmd start`. Backend sẽ tự thêm các FAQ mẫu dành cho khách vào DB cũ **một lần**, không xóa đơn hàng/sách/tài khoản đã có. Tệp ZIP mới không chứa DB cá nhân của bạn.

## 1. Chạy ngay (Windows/macOS/Linux)

**Yêu cầu:** Node.js >= 20. Không cần `npm install`, không có dependency bên ngoài.

```bash
cd webBookStore-main
npm start
```

Nếu dùng Windows PowerShell và gặp lỗi `npm.ps1 cannot be loaded`, thay bằng `npm.cmd start`. Nếu không có npm, có thể chạy `node backend/src/server.js`.

Mở trong trình duyệt:

| Địa chỉ | Trang |
|---|---|
| http://localhost:3000/ | Client — khách mua sách |
| http://localhost:3000/admin/ | Admin — quản trị nhà sách |
| http://localhost:3000/health | Kiểm tra Backend |
| http://localhost:3000/api/v1/shop/books | API sách public |

**Đăng nhập thử (seed):**

| Quyền | Email | Mật khẩu |
|---|---|---|
| Manager (Admin) | `manager@nhasach.test` | `Manager@123` |
| Employee (Admin) | `employee@nhasach.test` | `Employee@123` |
| Buyer (Client) | `an@mail.test` | `Buyer@123` |

Có thể tạo một Buyer mới ngay tại Client → Đăng ký. **Tài khoản demo chỉ dùng trên máy lab, phải thay/xóa trước khi triển khai ra Internet.**

## 2. Kiến trúc

```text
                     http://localhost:3000/
                     ┌─────────────────────┐
                     │ frontend/client/    │
                     │ Khách hàng (BUYER)   │
                     └──────────┬──────────┘
                                │ REST/JSON + Bearer
                                ▼
                     ┌─────────────────────┐
                     │ backend/src/server  │
                     │       /api/v1        │
                     ├─────────────────────┤
                     │ authRoutes           │
                     │ shopRoutes           │
                     │ adminRoutes          │
                     │ pdfFiles + demoPdf  │
                     └──────────┬──────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
          data/db.json                 storage/*.pdf + covers/*
          (dữ liệu chung)              (PDF thực)
                 ▲                             ▲
                 └──────────────┬──────────────┘
                                │ REST/JSON + Bearer
                     ┌──────────┴──────────┐
                     │ frontend/admin/     │
                     │ Employee / Manager  │
                     └─────────────────────┘
                     http://localhost:3000/admin/
```

Admin và Client **không gọi API riêng cho từng bản dữ liệu**. Cả hai chỉ truy cập Backend chung. `frontend/admin/js/config.js` đặt `USE_MOCK: false` và `API_BASE_URL: '/api/v1'` để tắt mock. Không cần mở 2 server frontend khi chạy theo hướng dẫn này: Backend đồng thời host 2 bộ static frontend cùng một origin.

## 3. Cấu trúc thư mục

```text
webBookStore-main/
├── frontend/
│   ├── admin/             # Admin UI gốc, giữ các trang và nghiệp vụ
│   │   ├── index.html
│   │   ├── css/ js/       # bao gồm js/mock để tham chiếu
│   │   └── tests/
│   └── client/            # Client UI mới, vanilla JS/CSS/HTML
│       ├── index.html
│       ├── css/{style,chatbot}.css
│       └── js/{app,api,chatbot}.js
├── backend/
│   ├── src/
│   │   ├── server.js      # HTTP server, static assets, routing
│   │   ├── store.js       # DB JSON, mật khẩu scrypt, token
│   │   ├── seed.js        # dữ liệu seed kế thừa Admin
│   │   ├── adminRoutes.js # 50+ API nghiệp vụ Admin từ mock gốc
│   │   ├── authRoutes.js  # đăng ký/đăng nhập/phiên dùng chung
│   │   ├── shopRoutes.js  # catalog, cart, order, review, hỗ trợ
│   │   ├── clientChat.js # AI và giới hạn chủ đề sách
│   │   ├── pdfFiles.js    # upload và tải PDF có phân quyền
│   │   └── coverFiles.js  # upload/thay/xóa ảnh bìa có phân quyền
│   ├── data/              # sinh db.json khi chạy
│   ├── storage/           # PDF và covers/ ảnh bìa do Admin upload
│   └── tests/             # test tích hợp không cần dependency
├── docs/BOOK_COVERS.md
├── docs/CHATBOT.md
├── docs/API.md
├── docs/TESTING.md
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 4. Luồng nghiệp vụ chính

**Đưa sách lên bán:** Admin → Sách & PDF → Thêm sách → (có thể tải lên ảnh bìa JPG/PNG/WebP) → tải lên một file `.pdf` thật → sửa sách sang `PUBLISHED`. Khi `servingStatus=ACTIVE`, khách sẽ thấy sách trong `Client → Khám phá sách`. Khi đình chỉ/ẩn/xóa mềm, sách sẽ không được chào bán hoặc tải.

**Mua sách:** Client → giỏ hàng → đăng nhập Buyer → nhập Coupon nếu có → Backend kiểm tra sách/combo đang bán và tính lại giá → tạo `PENDING_PAYMENT` → bấm **Xác nhận thanh toán demo** → đơn chuyển `PAID`. Admin → Orders và Reports thấy đơn mới. Client → Thư viện có thể đọc/tải PDF demo hoặc PDF thật đã upload của sách đã thanh toán hoặc đã nhận quà.

**Duyệt khuyến mãi:** Admin tạo Bundle/Event/Coupon ở trạng thái DRAFT → Submit → Manager Approve. Client chỉ thấy bản revision đã duyệt và còn hiệu lực. Event giá sale và Coupon được Backend tự tính; Client không được gửi `price` để tự sửa tổng tiền.

**Chăm sóc khách hàng:** Buyer gửi Complaint theo đơn hàng → Admin → Khiếu nại xử lý/nhắn lại → Buyer xem được phản hồi public. Ghi chú `internal` của nhân viên không hiện với Buyer. Buyer báo cáo nội dung → Admin → Báo cáo nội dung tiếp nhận và kiểm duyệt.

## 5. Lưu ý về tính năng demo và an toàn

- **Thanh toán demo:** `POST /shop/orders/:id/demo-pay` chỉ dành cho môi trường lab. Để tắt: đặt biến môi trường `DEMO_PAYMENTS_ENABLED=false`. Chưa tích hợp cổng thanh toán thực, webhook, chữ ký hoặc hoàn tiền. Không sử dụng chế độ demo để bán hàng thật.
- **Dữ liệu:** đang lưu chung một JSON trên server (`backend/data/db.json`). Đã lưu bền vững qua lần chạy lại và có mật khẩu hash scrypt, token phiên lưu hash (hết hạn sau 7 ngày). Để triển khai nhiều instance/production cần chuyển sang PostgreSQL/MySQL, migration, transaction, backup, row-locking, quản lý phiên tập trung.
- **Ảnh bìa:** Giới hạn 5MB, JPG/PNG/WebP; lưu vào `backend/storage/covers`, đường dẫn public chỉ cho sách đang bán. Không thay thế PDF.
- **PDF:** Seed cũ chỉ có tên/dung lượng file **giả**; không có tệp PDF bản quyền để phát. Admin mới có thể upload thật (giới hạn 50MB, kiểm tra signature `%PDF-`). Khi chưa có file thật, Backend tự sinh PDF demo 7 trang. Client chỉ được đọc/tải khi đã mua hoặc nhận quà và sách còn đang phục vụ. Bảo đảm có quyền phân phối PDF trước khi tải lên.
- **Bảo mật:** Có phân quyền server-side, kiểm tra quyền sở hữu đơn, mật khẩu đã hash, token Bearer, giới hạn kích thước request và rate limit cơ bản. Cần bổ sung bảo mật vận hành trước khi công khai: TLS, reverse proxy, rate limit phân tán, xác thực email/đặt lại mật khẩu, giám sát, log, scan PDF độc hại, lưu trữ object storage, HTTPS, data retention và chính sách privacy.
- **Deploy tách origin:** Thiết kế mặc định **cùng origin** để đơn giản và không cần CORS. Nếu Client/Admin được deploy trên domain khác nhau, cấu hình reverse proxy `/api/v1` về chung Backend hoặc thêm CORS đúng whitelist; không bật wildcard credentials.
- **Mock cũ:** thư mục `frontend/admin/js/mock` được giữ để đối chiếu nghiệp vụ. `USE_MOCK` phải là `false` để kết nối API thật; nếu đổi thành `true`, Admin sẽ lưu localStorage và **không còn dùng chung DB với Client**.

## 6. Cấu hình & kiểm thử

Biến môi trường:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `HOST` | `127.0.0.1` | Interface Backend lắng nghe (Docker dùng `0.0.0.0`) |
| `PORT` | `3000` | Cổng HTTP |
| `DATA_FILE` | `backend/data/db.json` | Đường dẫn DB JSON chung |
| `PDF_DIR` | `backend/storage` | Nơi lưu PDF thật |
| `COVER_DIR` | `backend/storage/covers` | Nơi lưu ảnh bìa sách thật |
| `DEMO_PAYMENTS_ENABLED` | `true` trong chạy local | Chặn thanh toán mô phỏng nếu đặt `false` |
| `OPENAI_API_KEY` | rỗng | Bật chọn sách bằng mô hình AI; chỉ nằm trong môi trường Backend |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model hỗ trợ Chat Completions JSON mode |
| `OPENAI_TIMEOUT_MS` | `10000` | Timeout gọi AI (2,5–20 giây) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Override máy chủ API theo chuẩn OpenAI-compatible (chỉ dành cho vận hành/test) |

Trong PowerShell, ví dụ:

```powershell
$env:PORT="3000"
$env:DEMO_PAYMENTS_ENABLED="true"
npm start
```

Kiểm tra API tự động:

```bash
npm test
```

Test bao phủ: upload/thay/xóa ảnh bìa và phân quyền public/private, ảnh trong chatbot, kết xuất template các trang Client, static Client/Admin, role isolation, Admin tạo/xuất bản sách và Client nhìn thấy, PDF upload & entitlement/download, Buyer đặt đơn/checkout và Admin xem được, đánh giá & kiểm duyệt, khiếu nại & ghi chú nội bộ, khóa tài khoản/thu hồi phiên, hash mật khẩu trên disk.

Có thể chạy Docker (nếu máy có Docker):

```bash
docker compose up --build
```

Compose bật demo payment và gắn volumes cho dữ liệu/PDF, dành cho thử nghiệm nội bộ.

**Đặt lại dữ liệu demo:** dừng server, sau đó **xóa `backend/data/db.json` và xóa những tệp PDF/ảnh trong `backend/storage/`** rồi chạy lại. Cẩn thận: thao tác này xóa toàn bộ dữ liệu đã nhập. API `POST /__mock/reset` đã **không được công khai** trong Backend thật.

## 7. Kết nối Backend production của nhóm

Vì ZIP nguồn **không có mã Backend của Phúc**, bản này triển khai Backend tham chiếu dựa trên API contract của Admin. Khi Backend production hoàn thành, **không cần viết lại 2 giao diện** nếu backend giữ hợp đồng như `docs/API.md` và `frontend/admin/js/mock/server.js`.

1. Chốt API v1, DTO (`rowId`, `bookId`, `status`, `version`, `orderId`, `user`...) và role Buyer/Staff.
2. Chuyển các route mới trong `backend/src/authRoutes.js`, `shopRoutes.js`, `pdfFiles.js`, `coverFiles.js` sang backend production (hoặc điều chỉnh các API adapter tại hai frontend).
3. Cho cả Admin và Client dùng chung `/api/v1` qua reverse proxy.
4. Thay JSON store bằng database production và kết nối payment, cloud file storage, callback, e-mail theo thiết kế thật.

Chi tiết request/response: [docs/API.md](docs/API.md). Kịch bản demo thử luồng Admin ↔ Client: [docs/TESTING.md](docs/TESTING.md).

---

## MỚI: Trợ lý AI Admin dùng mô hình thật (Claude hoặc Gemini)

Menu **Admin → Trợ lý AI Admin** hỏi đáp bằng mô hình ngôn ngữ thật, chạy hoàn toàn ở **backend** (`backend/src/llm/`, `backend/src/aiLoop.js`, phần AI trong `backend/src/adminRoutes.js`). Khóa API **không bao giờ** xuống trình duyệt.

1. Tạo file `.env` ở thư mục gốc từ `.env.example`, đặt `LLM_PROVIDER=claude` (hoặc `gemini`) và điền `ANTHROPIC_API_KEY` (hoặc `GEMINI_API_KEY`). Backend tự đọc `.env` khi khởi động. Không có khóa thì AI Admin tự dùng chế độ mô phỏng theo từ khóa.
2. Mô hình chỉ **chọn tool** trong danh sách do server cấp theo vai trò (`backend/src/llm/shared.js`): Employee không có tool doanh thu/audit. Mỗi tool tự kiểm quyền lần nữa và chỉ đọc dữ liệu rút gọn. Vai trò lấy từ phiên đăng nhập phía server, không tin dữ liệu từ trình duyệt.
3. Thao tác thay đổi dữ liệu (khóa tài khoản) chỉ tạo **bản xem trước**; người dùng bấm xác nhận (token dùng một lần, hết hạn sau 5 phút, từ chối nếu dữ liệu đã đổi) thì mới thực thi và ghi audit với nguồn `AI`.
4. Chatbot của **Client** dùng OpenAI (`OPENAI_API_KEY`) hoặc Claude (`ANTHROPIC_API_KEY`, dùng chung khóa với AI Admin): ưu tiên OpenAI nếu có khóa OpenAI thật, ngược lại dùng Claude; ép chọn bằng `CLIENT_CHAT_PROVIDER=openai|claude`. Khóa bắt đầu bằng `sk-ant-` không bao giờ bị gửi tới OpenAI.
5. **Chatbot Client xem đơn hàng:** khi Buyer đã đăng nhập và hỏi kiểu "tôi đã thanh toán những đơn nào", "đơn ORD-2026-0001 của tôi", backend tự tra đơn của chính Buyer đó rồi dựng câu trả lời (không gửi dữ liệu đơn cho nhà cung cấp AI). Chưa đăng nhập hoặc là tài khoản nhân viên thì chatbot yêu cầu đăng nhập; mã đơn của người khác không bao giờ hiện ra. Câu hỏi cách làm ("thanh toán thế nào") vẫn đi đường FAQ.
6. Kiểm thử không cần khóa thật: `npm test` (gồm `backend/tests/ai-admin.test.js` dùng Claude giả) và `npm run test:ui` (Playwright, cần `npm install --no-save playwright`).

## Cơ sở dữ liệu SQL Server và sơ đồ
`database/schema.sql` (53 bảng theo đặc tả v2.0.3) và `docs/ERD.md`. Backend hiện tại lưu bằng file JSON; schema này dành cho bước chuyển sang SQL Server. Chi tiết ghép nối: `docs/TICH_HOP.md`.

// Dữ liệu ban đầu, đồng bộ từ nguồn seed của trang Admin.
// Dữ liệu seed theo mục 12.2 của đặc tả v2.0.3. Lưu trong localStorage để giữ trạng thái giữa các lần tải.

const DAY = 86400000;
const iso = (offsetDays, hour = 9) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

// Bài hỗ trợ dành cho khách; tách khỏi các tài liệu vận hành nội bộ của AI Admin.
export function starterClientFaqs() {
  return [
  { rowId: 5, title: 'Cách mua sách PDF', body: 'Chọn sách trong mục Khám phá sách, nhấn thêm vào giỏ hàng và đăng nhập tài khoản Buyer. Vào Giỏ hàng để xác nhận đơn. Với bản demo, chọn Thanh toán demo (không thu tiền thật). Sau khi thanh toán thành công, sách sẽ xuất hiện trong Thư viện của tôi.', status: 'PUBLISHED', keywords: ['mua sách', 'cách mua', 'giỏ hàng', 'thanh toán', 'đặt hàng'], clientVisible: true, version: 1 },
  { rowId: 6, title: 'Tải file PDF đã mua', body: 'Sau khi thanh toán hoặc nhận quà thành công, mở Thư viện của tôi. Chọn Đọc ngay để xem PDF trực tuyến, hoặc Tải PDF để lưu. Nếu Admin chưa tải PDF thật, website dùng bản PDF mẫu Lorem Ipsum (không chứa nội dung tác phẩm). Khi cần hỗ trợ, mở Chăm sóc khách hàng.', status: 'PUBLISHED', keywords: ['tải pdf', 'tải file', 'thư viện', 'đọc sách', 'download'], clientVisible: true, version: 1 },
  { rowId: 8, title: 'Mua sách để tặng', body: 'Tại trang chi tiết sách chọn Mua tặng, hoặc vào Giỏ hàng chọn Đây là đơn quà tặng. Nhập email người nhận và lời nhắn; sau thanh toán demo, sao chép mã nhận quà GFT từ chi tiết đơn và gửi riêng. Người nhận đăng ký/đăng nhập cùng email, mở Quà tặng, nhập mã để nhận sách. Không tự động gửi email.', status: 'PUBLISHED', keywords: ['mua tặng', 'tặng sách', 'quà tặng', 'mã nhận quà', 'nhận quà'], clientVisible:true, version:1 },
  { rowId: 9, title: 'Đọc PDF mẫu trực tuyến', body: 'Sách đã thanh toán hoặc đã nhận quà sẽ có trong Thư viện của tôi. Bấm Đọc ngay để mở trình đọc PDF trong website, hoặc Tải PDF. Nếu Admin chưa tải file thật, bạn sẽ đọc PDF demo nhiều trang có nội dung Lorem Ipsum, không chứa nội dung tác phẩm.', status:'PUBLISHED', keywords:['đọc sách','đọc pdf','đọc online','lorem ipsum','pdf demo'],clientVisible:true,version:1 },
  { rowId: 7, title: 'Hỗ trợ đơn hàng sách', body: 'Bạn có thể xem các đơn đã đặt trong mục Đơn hàng của tôi. Để được hỗ trợ về đơn hàng hoặc tài khoản đọc ebook, hãy đăng nhập và chọn Chăm sóc khách hàng. Nhân viên sẽ xem và phản hồi yêu cầu trên hệ thống.', status: 'PUBLISHED', keywords: ['đơn hàng', 'khiếu nại', 'hỗ trợ', 'tài khoản', 'chăm sóc khách hàng'], clientVisible: true, version: 1 }
  ].map((k) => ({...k, keywords:[...k.keywords]}));
}

export function seed() {
  let id = 1000;
  const nid = () => ++id;

  const authors = ['Nguyễn Nhật Ánh', 'Tô Hoài', 'Nam Cao', 'Dale Carnegie', 'Yuval Harari', 'Robert Martin', 'Martin Fowler', 'Haruki Murakami']
    .map((n, i) => ({ rowId: i + 1, name: n, isDel: false, version: 1 }));
  const categories = ['Văn học', 'Kỹ năng', 'Lịch sử', 'Công nghệ', 'Kinh tế', 'Thiếu nhi']
    .map((n, i) => ({ rowId: i + 1, name: n, code: 'CAT' + (i + 1), isDel: false, version: 1 }));
  const publishers = ['NXB Trẻ', 'NXB Kim Đồng', 'NXB Lao Động', 'NXB Thế Giới']
    .map((n, i) => ({ rowId: i + 1, name: n, isDel: false, version: 1 }));

  const books = [];
  const titles = ['Mắt biếc', 'Dế Mèn phiêu lưu ký', 'Chí Phèo', 'Đắc nhân tâm', 'Sapiens', 'Clean Code', 'Refactoring', 'Rừng Na Uy',
    'Tôi thấy hoa vàng trên cỏ xanh', 'Lão Hạc', 'Quẳng gánh lo đi', 'Homo Deus', 'Clean Architecture', 'Patterns of Enterprise', 'Kafka bên bờ biển',
    'Cho tôi xin một vé đi tuổi thơ', 'Tắt đèn', 'Nghĩ giàu làm giàu', '21 bài học cho thế kỷ 21', 'The Pragmatic Programmer', 'Kinh tế học vui',
    'Lược sử loài người', 'Cây cam ngọt của tôi', 'Số đỏ', 'Dạy con làm giàu', 'Thế giới phẳng', 'Code Complete', 'Domain-Driven Design', 'Nhà giả kim',
    'Tuổi trẻ đáng giá bao nhiêu', 'Bố già', 'Hai số phận'];
  titles.forEach((t, i) => {
    const status = i < 27 ? 'PUBLISHED' : i < 30 ? 'DRAFT' : 'HIDDEN';
    books.push({
      rowId: i + 1, bookId: 'BK' + String(i + 1).padStart(3, '0'), title: t,
      authorIds: [(i % authors.length) + 1], categoryId: (i % categories.length) + 1, publisherId: (i % publishers.length) + 1,
      price: 60000 + (i % 7) * 20000, status, servingStatus: i === 5 ? 'SUSPENDED' : 'ACTIVE',
      suspendReason: i === 5 ? 'Nghi vấn bản quyền, đang xác minh' : '',
      description: 'Mô tả ngắn cho sách "' + t + '".',
      files: status === 'DRAFT' && i === 29 ? [] : [{ rowId: nid(), version: 1, fileName: 'bk' + (i + 1) + '_v1.pdf', sizeBytes: 1500000 + i * 90000, active: i !== 0 }].concat(i === 0 ? [{ rowId: nid(), version: 2, fileName: 'bk1_v2.pdf', sizeBytes: 1700000, active: true }] : []),
      isDel: false, version: 1, createdAt: iso(-60 + i),
    });
  });

  const mkRev = (no, status, data, extra = {}) => ({ rowId: nid(), no, status, data, createdBy: 3, approvedBy: status === 'APPROVED' ? 1 : null, createdAt: iso(-10), submittedAt: status !== 'DRAFT' ? iso(-9) : null, rejectReason: '', ...extra });

  const bundles = [
    { rowId: 1, code: 'BDL-FIX-01', kind: 'bundles', isActive: true, version: 1, selectedRevNo: 1, scheduledRevNo: null, isDel: false,
      revisions: [mkRev(1, 'APPROVED', { name: 'Combo Văn học Việt', type: 'FIXED', price: 220000, bookIds: [1, 2, 3, 10], pickCount: 4 }), mkRev(2, 'PENDING', { name: 'Combo Văn học Việt', type: 'FIXED', price: 199000, bookIds: [1, 2, 3, 10], pickCount: 4 })] },
    { rowId: 2, code: 'BDL-FLEX-01', kind: 'bundles', isActive: true, version: 1, selectedRevNo: 1, scheduledRevNo: null, isDel: false,
      revisions: [mkRev(1, 'APPROVED', { name: 'Chọn 2 trong 4 sách Công nghệ', type: 'FLEXIBLE', price: 250000, bookIds: [6, 7, 13, 14], pickCount: 2 })] },
    { rowId: 3, code: 'BDL-OLD', kind: 'bundles', isActive: false, version: 2, selectedRevNo: 1, scheduledRevNo: null, isDel: false,
      revisions: [mkRev(1, 'APPROVED', { name: 'Combo cũ ngừng bán', type: 'FIXED', price: 150000, bookIds: [4, 11], pickCount: 2 })] },
  ];
  const events = [
    { rowId: 1, code: 'BOOK_SALE', kind: 'events', isActive: true, version: 1, selectedRevNo: 1, scheduledRevNo: null, isDel: false,
      revisions: [mkRev(1, 'APPROVED', { name: 'Book Sale tháng này', type: 'BOOK_SALE', theme: 'FOREST', badgeText: 'BOOK SALE ĐANG DIỄN RA', headline: 'Mở trang sách. Chạm ưu đãi.', description: 'Những câu chuyện đáng đọc với mức giá đặc biệt chỉ trong thời gian sự kiện.', startAt: iso(-3), endAt: iso(7), bookDiscounts: [{ bookId: 1, salePrice: 48000 }, { bookId: 2, salePrice: 60000 }], bundleIds: [] })] },
    { rowId: 2, code: 'TET_SALE', kind: 'events', isActive: true, version: 1, selectedRevNo: 1, scheduledRevNo: null, isDel: false,
      revisions: [mkRev(1, 'APPROVED', { name: 'Tết Sale', type: 'TET_SALE', theme: 'TET', badgeText: 'RỘN RÀNG HỘI SÁCH TẾT', headline: 'Tết mở sách, năm mới mở điều hay.', description: 'Chọn một cuốn sách hay làm quà cho chính mình hoặc những người thương.', startAt: iso(60), endAt: iso(75), bookDiscounts: [{ bookId: 4, salePrice: 50000 }], bundleIds: [1] })] },
    { rowId: 3, code: 'SUMMER_TEST', kind: 'events', isActive: true, version: 1, selectedRevNo: null, scheduledRevNo: null, isDel: false,
      revisions: [mkRev(1, 'PENDING', { name: 'Sale chồng lịch để thử từ chối', type: 'BOOK_SALE', startAt: iso(2), endAt: iso(9), bookDiscounts: [{ bookId: 5, salePrice: 70000 }], bundleIds: [] })] },
  ];
  const coupons = [
    ['CP10', 'PERCENT', 10, 0, 0, null, 'APPROVED'], ['CP30', 'PERCENT', 30, 100000, 0, 1, 'APPROVED'], ['FIX30K', 'FIXED', 30000, 0, 0, null, 'APPROVED'],
    ['EXPIRED1', 'PERCENT', 15, 0, 0, null, 'APPROVED'], ['QUOTA1', 'PERCENT', 20, 0, 1, 1, 'APPROVED'], ['NEW5', 'PERCENT', 5, 0, 0, null, 'DRAFT'],
  ].map((c, i) => ({
    rowId: i + 1, code: c[0], kind: 'coupons', isActive: true, version: 1, selectedRevNo: c[6] === 'APPROVED' ? 1 : null, scheduledRevNo: null, isDel: false,
    revisions: [mkRev(1, c[6], { code: c[0], type: c[1], value: c[2], minSpend: c[3], quota: c[4], perBuyerLimit: c[5], capAmount: 0, startAt: c[0] === 'EXPIRED1' ? iso(-40) : iso(-5), endAt: c[0] === 'EXPIRED1' ? iso(-20) : iso(30) })],
  }));

  const users = [
    { rowId: 1, email: 'manager@nhasach.test', fullName: 'Trần Quản Lý', role: 'MANAGER', status: 'ACTIVE', password: 'Manager@123', version: 1, createdAt: iso(-200) },
    { rowId: 2, email: 'manager2@nhasach.test', fullName: 'Lê Quản Lý Hai', role: 'MANAGER', status: 'ACTIVE', password: 'Manager@123', version: 1, createdAt: iso(-190) },
    { rowId: 3, email: 'employee@nhasach.test', fullName: 'Phạm Nhân Viên', role: 'EMPLOYEE', status: 'ACTIVE', password: 'Employee@123', version: 1, createdAt: iso(-150) },
    { rowId: 4, email: 'employee2@nhasach.test', fullName: 'Võ Nhân Viên Hai', role: 'EMPLOYEE', status: 'ACTIVE', password: 'Employee@123', version: 1, createdAt: iso(-140) },
    { rowId: 5, email: 'an@mail.test', fullName: 'Nguyễn Văn An', role: 'BUYER', status: 'ACTIVE', version: 1, createdAt: iso(-80) },
    { rowId: 6, email: 'binh@mail.test', fullName: 'Lê Thị Bình', role: 'BUYER', status: 'ACTIVE', version: 1, createdAt: iso(-70) },
    { rowId: 7, email: 'chi@mail.test', fullName: 'Hoàng Chi', role: 'BUYER', status: 'ACTIVE', version: 1, createdAt: iso(-60) },
    { rowId: 8, email: 'dung@mail.test', fullName: 'Đỗ Dũng', role: 'BUYER', status: 'DISABLED', disableReason: 'Vi phạm điều khoản (spam review)', version: 2, createdAt: iso(-50) },
  ];

  const mkOrder = (n, buyer, status, items, extra = {}) => {
    const total = items.reduce((s, i) => s + i.price, 0) - (extra.discount || 0);
    return {
      rowId: n, orderId: 'ORD-2026-' + String(n).padStart(4, '0'), buyerRowId: buyer, recipientUserRowId: extra.recipient || buyer, status,
      subtotal: items.reduce((s, i) => s + i.price, 0), discount: extra.discount || 0, discountSource: extra.src || 'NONE', couponCode: extra.coupon || '',
      total, items, createdAt: iso(-(14 - n), 10 + (n % 8)), paidAt: status === 'PAID' ? iso(-(14 - n), 10 + (n % 8)) : null,
      payment: { method: total === 0 ? 'INTERNAL_FREE' : 'MOCK_GATEWAY', attemptStatus: status === 'PAID' ? 'SUCCEEDED' : status === 'PENDING_PAYMENT' ? 'PENDING' : 'FAILED', failureCode: status === 'PAYMENT_FAILED' ? (extra.fail || 'DECLINED') : status === 'CANCELLED' ? 'CANCELLED' : '' },
      history: [{ at: iso(-(14 - n), 10), status: 'PENDING_PAYMENT' }].concat(status !== 'PENDING_PAYMENT' ? [{ at: iso(-(14 - n), 11), status }] : []),
    };
  };
  const orders = [
    mkOrder(1, 5, 'PAID', [{ type: 'BOOK', name: 'Mắt biếc', price: 60000 }]),
    mkOrder(2, 5, 'PAID', [{ type: 'BUNDLE', name: 'Combo Văn học Việt', price: 220000 }]),
    mkOrder(3, 6, 'PAID', [{ type: 'BOOK', name: 'Clean Code', price: 140000 }, { type: 'BOOK', name: 'Sapiens', price: 120000 }], { discount: 26000, src: 'COUPON', coupon: 'CP10' }),
    mkOrder(4, 6, 'PAYMENT_FAILED', [{ type: 'BOOK', name: 'Refactoring', price: 100000 }], { fail: 'EXPIRED' }),
    mkOrder(5, 7, 'PAID', [{ type: 'BOOK', name: 'Đắc nhân tâm', price: 80000 }], { recipient: 5 }),
    mkOrder(6, 7, 'PENDING_PAYMENT', [{ type: 'BOOK', name: 'Nhà giả kim', price: 90000 }]),
    mkOrder(7, 5, 'PAID', [{ type: 'BOOK', name: 'Mắt biếc', price: 60000 }], { discount: 60000, src: 'COUPON', coupon: 'CP30' }),
    mkOrder(8, 6, 'CANCELLED', [{ type: 'BOOK', name: 'Bố già', price: 110000 }]),
    mkOrder(9, 7, 'PAID', [{ type: 'BOOK', name: 'Mắt biếc', price: 48000 }, { type: 'BOOK', name: 'Dế Mèn phiêu lưu ký', price: 60000 }], { discount: 12000, src: 'EVENT' }),
    mkOrder(10, 5, 'PAID', [{ type: 'BOOK', name: 'Kafka bên bờ biển', price: 100000 }], { discount: 100000, src: 'COUPON', coupon: 'FREE100' }),
  ];

  const complaints = [
    { rowId: 1, code: 'CMP-001', buyerRowId: 6, orderRowId: 4, subject: 'Bị trừ tiền nhưng đơn thất bại', status: 'OPEN', createdAt: iso(-3),
      messages: [{ rowId: 1, from: 'BUYER', body: 'Mình thanh toán xong thì đơn báo thất bại, nhờ kiểm tra.', internal: false, at: iso(-3) }] },
    { rowId: 2, code: 'CMP-002', buyerRowId: 5, orderRowId: 2, subject: 'Không tải được PDF combo', status: 'IN_PROGRESS', createdAt: iso(-5),
      messages: [{ rowId: 2, from: 'BUYER', body: 'Bấm tải thì báo lỗi.', internal: false, at: iso(-5) }, { rowId: 3, from: 'STAFF', body: 'Kiểm tra entitlement: hợp lệ, đang xem file.', internal: true, at: iso(-4) }] },
    { rowId: 3, code: 'CMP-003', buyerRowId: 7, orderRowId: 5, subject: 'Hỏi về quà tặng', status: 'RESOLVED', createdAt: iso(-9),
      messages: [{ rowId: 4, from: 'BUYER', body: 'Người nhận chưa thấy sách.', internal: false, at: iso(-9) }, { rowId: 5, from: 'STAFF', body: 'Đã kiểm tra, quyền đã cấp cho tài khoản nhận.', internal: false, at: iso(-8) }] },
  ];
  const reviews = [
    { rowId: 1, bookRowId: 1, buyerRowId: 5, rating: 5, content: 'Rất hay.', status: 'VISIBLE', editCount: 0 },
    { rowId: 2, bookRowId: 4, buyerRowId: 6, rating: 1, content: 'Nội dung xúc phạm (đã che).', status: 'VISIBLE', editCount: 1 },
    { rowId: 3, bookRowId: 6, buyerRowId: 7, rating: 4, content: 'Tốt cho người mới.', status: 'HIDDEN', editCount: 0 },
  ];
  const contentReports = [
    { rowId: 1, targetType: 'REVIEW', targetRowId: 2, reporterRowId: 7, reason: 'Ngôn từ xúc phạm', status: 'PENDING', createdAt: iso(-2) },
    { rowId: 2, targetType: 'BOOK', targetRowId: 12, reporterRowId: 5, reason: 'Nghi vấn vi phạm bản quyền', status: 'PENDING', createdAt: iso(-1) },
  ];
  const knowledge = [
    { rowId: 1, title: 'Hoàn tất thanh toán', body: 'Sau khi cổng giả lập gọi callback thành công, đơn chuyển PAID và quyền đọc/tải được cấp cho người nhận.', status: 'PUBLISHED', keywords: ['thanh toán', 'callback', 'paid'], version: 1 },
    { rowId: 2, title: 'Xử lý complaint', body: 'Nhân viên nhận complaint, chuyển IN_PROGRESS, phản hồi cho Buyer (ghi chú nội bộ không hiển thị), rồi RESOLVED và CLOSED.', status: 'PUBLISHED', keywords: ['complaint', 'khiếu nại'], version: 1 },
    { rowId: 3, title: 'Phê duyệt Event', body: 'Event gửi duyệt qua revision, Manager duyệt. Hệ thống từ chối nếu lịch chồng với Event đã duyệt.', status: 'PUBLISHED', keywords: ['event', 'phê duyệt', 'chồng lịch'], version: 1 },
    { rowId: 4, title: 'Bản nháp chưa công bố', body: 'Nội dung nháp, AI không được dùng.', status: 'DRAFT', keywords: ['nháp'], version: 1 },
    ...starterClientFaqs(),
  ];
  const settings = [
    { key: 'PAYMENT_TIMEOUT_MINUTES', value: '15', sensitive: false, version: 1, description: 'Thời hạn thanh toán của đơn' },
    { key: 'GUEST_SESSION_HOURS', value: '24', sensitive: false, version: 1, description: 'Thời hạn phiên khách của AI' },
    { key: 'MOCK_GATEWAY_SECRET', value: 'abc123-secret', sensitive: true, version: 1, description: 'Khóa ký callback cổng giả lập' },
    { key: 'REVIEW_MAX_EDIT', value: '1', sensitive: false, version: 1, description: 'Số lần sửa review tối đa' },
  ];

  return { seq: id + 1000, authors, categories, publishers, books, bundles, events, coupons, users, orders, complaints, reviews, contentReports, knowledge, settings,
    auditLogs: [], aiRequests: [], sessions: {} };
}


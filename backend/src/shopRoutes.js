import crypto from 'node:crypto';
import { getDb, saveDb, nextId } from './store.js';
import { fail, assert, buyerOnly, paging, auditBuyer } from './http.js';

const NOW = () => new Date().toISOString();
const matches = (text, q) => String(text || '').toLocaleLowerCase('vi').includes(String(q || '').toLocaleLowerCase('vi').trim());
const num = (n) => Number(n);
const money = (n) => Math.round(Number(n) || 0);
const availableBook = (book) => !!book && !book.isDel && book.status === 'PUBLISHED' && book.servingStatus === 'ACTIVE';
const selectedRev = (entity) => entity?.revisions?.find((r) => r.no === entity.selectedRevNo && r.status === 'APPROVED');
const activeEntity = (entity) => !!entity && !entity.isDel && entity.isActive && !!selectedRev(entity);

// Cả hiển thị Event lẫn tính tiền phải dựa vào cùng một revision đã được duyệt.
// Revision hẹn lịch sẽ bắt đầu áp dụng khi startAt đến, kể cả chưa có ai mở Admin.
function currentEventRevision(entity, at = Date.now()) {
  if (!entity || entity.isDel || !entity.isActive) return null;
  const scheduled = entity.revisions?.find((r) => r.no === entity.scheduledRevNo && r.status === 'APPROVED');
  if (scheduled && Number.isFinite(Date.parse(scheduled.data?.startAt)) && Date.parse(scheduled.data.startAt) <= at) return scheduled;
  return selectedRev(entity);
}
function liveEventEntries(db, at = Date.now()) {
  return db.events.map((event) => ({ event, revision: currentEventRevision(event, at) }))
    .filter(({ revision }) => revision && Number.isFinite(Date.parse(revision.data.startAt)) &&
      Number.isFinite(Date.parse(revision.data.endAt)) && Date.parse(revision.data.startAt) <= at && at < Date.parse(revision.data.endAt))
    .sort((a, b) => Date.parse(b.revision.data.startAt) - Date.parse(a.revision.data.startAt));
}
function eventPrices(db, entries = liveEventEntries(db)) {
  const prices = new Map();
  for (const { revision } of entries) {
    for (const item of revision.data.bookDiscounts || []) {
      const book = db.books.find((b) => b.rowId === num(item.bookId));
      if (!availableBook(book) || !(num(item.salePrice) > 0 && num(item.salePrice) < book.price)) continue;
      prices.set(book.rowId, Math.min(prices.get(book.rowId) || Infinity, money(item.salePrice)));
    }
  }
  return prices;
}
function publicBook(b, db, prices, expanded = false) {
  const salePrice = prices.get(b.rowId) || null;
  const reviewList = db.reviews.filter((r) => r.bookRowId === b.rowId && r.status === 'VISIBLE');
  const rating = reviewList.length ? Math.round(reviewList.reduce((s, r) => s + r.rating, 0) * 10 / reviewList.length) / 10 : 0;
  return {
    rowId: b.rowId, bookId: b.bookId, title: b.title, description: b.description,
    authorNames: b.authorIds.map((id) => db.authors.find((a) => a.rowId === id && !a.isDel)?.name).filter(Boolean),
    categoryId: b.categoryId, categoryName: db.categories.find((c) => c.rowId === b.categoryId)?.name || 'Khác',
    publisherName: db.publishers.find((p) => p.rowId === b.publisherId)?.name || '',
    price: money(b.price), salePrice, currentPrice: salePrice ?? money(b.price), rating, reviewCount: reviewList.length,
    promotionEvent: salePrice != null ? (() => {
      const live = liveEventEntries(db).find(({ revision }) => (revision.data.bookDiscounts || []).some(
        (x) => num(x.bookId) === b.rowId && num(x.salePrice) === salePrice));
      return live ? { rowId: live.event.rowId, name: live.revision.data.name } : null;
    })() : null,
    coverUrl: b.cover?.storageKey ? `/api/v1/shop/books/${b.rowId}/cover?v=${b.version}` : null,
    hasPdfMetadata: b.files.some((f) => f.active), canDownload: true,
    pdfSource: b.files.some((f) => f.active && f.storageKey) ? 'UPLOADED' : 'DEMO',
    ...(expanded ? { reviews: reviewList.map((r) => ({ rowId: r.rowId, rating: r.rating, content: r.content, createdAt: r.createdAt || null, authorName: db.users.find((u) => u.rowId === r.buyerRowId)?.fullName || 'Khách hàng' })) } : {}),
  };
}
function publicBundle(e, db, prices, detail = false) {
  const rev = selectedRev(e);
  const d = rev.data;
  const eligibleBooks = (d.bookIds || []).map((id) => db.books.find((b) => b.rowId === id)).filter(availableBook);
  if (eligibleBooks.length !== (d.bookIds || []).length) return null;
  return {
    rowId: e.rowId, code: e.code, name: d.name, type: d.type, price: money(d.price),
    pickCount: num(d.pickCount) || eligibleBooks.length,
    bookIds: (d.bookIds || []).slice(),
    ...(detail ? { books: eligibleBooks.map((b) => publicBook(b, db, prices)) } : {}),
  };
}
// Payload công khai: không bao giờ trả revision nháp, nội bộ hoặc sự kiện chưa chạy.
const EVENT_THEMES = new Set(['FOREST', 'TET', 'SUNSET', 'MIDNIGHT']);
function publicEvent(entry, db, prices) {
  const { event, revision } = entry;
  const d = revision.data;
  const books = (d.bookDiscounts || []).map((item) => {
    const book = db.books.find((b) => b.rowId === num(item.bookId));
    return availableBook(book) && num(item.salePrice) > 0 && num(item.salePrice) < book.price ? book : null;
  }).filter(Boolean);
  const seen = new Set();
  const publishedBooks = books.filter((b) => !seen.has(b.rowId) && seen.add(b.rowId));
  const bundles = (d.bundleIds || []).map((id) => db.bundles.find((b) => b.rowId === num(id)))
    .filter(activeEntity).map((b) => publicBundle(b, db, prices, true)).filter(Boolean);
  const maxDiscountPercent = publishedBooks.length ? Math.max(...publishedBooks.map((b) =>
    Math.round((1 - (prices.get(b.rowId) || b.price) / b.price) * 100))) : 0;
  const theme = EVENT_THEMES.has(d.theme) ? d.theme : (d.type === 'TET_SALE' ? 'TET' : 'FOREST');
  return { rowId: event.rowId, code: event.code, name: d.name, type: d.type, theme,
    badgeText: d.badgeText || (d.type === 'TET_SALE' ? 'HỘI SÁCH NGÀY TẾT' : 'SỰ KIỆN ĐANG DIỄN RA'),
    headline: d.headline || d.name,
    description: d.description || 'Khám phá những tựa sách được tuyển chọn với ưu đãi dành riêng cho sự kiện.',
    startAt: d.startAt, endAt: d.endAt,
    bookCount: publishedBooks.length, bundleCount: bundles.length,
    maxDiscountPercent, books: publishedBooks.map((b) => publicBook(b, db, prices)), bundles };
}
function publicCoupon(c) {
  if (!activeEntity(c)) return null;
  const d = selectedRev(c).data;
  if (Date.parse(d.startAt) > Date.now() || Date.parse(d.endAt) < Date.now()) return null;
  return { code: d.code, type: d.type, value: num(d.value), minSpend: num(d.minSpend || 0), capAmount: num(d.capAmount || 0) };
}
function saleCategories(db) {
  return db.categories.filter((c) => !c.isDel).map((c) => ({ rowId: c.rowId, name: c.name, count: db.books.filter((b) => availableBook(b) && b.categoryId === c.rowId).length }));
}
function quote(db, data, user) {
  assert(Array.isArray(data.items) && data.items.length > 0 && data.items.length <= 25, 'Giỏ hàng cần từ 1 đến 25 dòng sản phẩm', 'items');
  const prices = eventPrices(db);
  let subtotal = 0, eventDiscount = 0;
  const rows = [];
  for (const input of data.items) {
    const quantity = num(input.quantity || 1);
    assert(Number.isInteger(quantity) && quantity >= 1 && quantity <= 10, 'Số lượng mỗi sản phẩm từ 1 đến 10', 'quantity');
    if (input.type === 'BOOK') {
      const b = db.books.find((x) => x.rowId === num(input.id));
      if (!availableBook(b)) fail(409, 'BOOK_UNAVAILABLE', 'Có sách đã ngừng bán, vui lòng cập nhật giỏ hàng');
      const unitPrice = prices.get(b.rowId) ?? money(b.price);
      subtotal += money(b.price) * quantity;
      eventDiscount += (money(b.price) - unitPrice) * quantity;
      rows.push({ type: 'BOOK', bookRowId: b.rowId, name: b.title, quantity, unitPrice, price: unitPrice * quantity, bookIds: [b.rowId],
        coverUrl: b.cover?.storageKey ? `/api/v1/shop/books/${b.rowId}/cover?v=${b.version}` : null });
    } else if (input.type === 'BUNDLE') {
      const b = db.bundles.find((x) => x.rowId === num(input.id));
      if (!activeEntity(b)) fail(409, 'BUNDLE_UNAVAILABLE', 'Combo đã ngừng bán');
      const offer = publicBundle(b, db, prices, true);
      if (!offer) fail(409, 'BUNDLE_UNAVAILABLE', 'Combo chứa sách đã ngừng bán');
      const selectedBookIds = offer.type === 'FIXED' ? offer.bookIds : [...new Set((input.selectedBookIds || []).map(num))];
      assert(selectedBookIds.length === offer.pickCount && selectedBookIds.every((id) => offer.bookIds.includes(id)), 'Chọn đúng số sách theo yêu cầu của combo', 'selectedBookIds');
      const linePrice = offer.price * quantity; subtotal += linePrice;
      rows.push({ type: 'BUNDLE', bundleRowId: b.rowId, name: offer.name, quantity, unitPrice: offer.price, price: linePrice, bookIds: selectedBookIds });
    } else {
      fail(422, 'VALIDATION_ERROR', 'Loại sản phẩm không hợp lệ', { field: 'type' });
    }
  }
  assert(subtotal > 0 && subtotal <= 100_000_000, 'Tổng đơn hàng không hợp lệ', 'items');
  const afterEvent = subtotal - eventDiscount;
  let couponDiscount = 0;
  const couponCode = String(data.couponCode || '').trim().toUpperCase();
  if (couponCode) {
    const couponEntity = db.coupons.find((c) => c.code.toUpperCase() === couponCode && activeEntity(c));
    const coupon = couponEntity && publicCoupon(couponEntity);
    if (!coupon) fail(422, 'COUPON_INVALID', 'Mã giảm giá không hợp lệ hoặc hết hạn', { field: 'couponCode' });
    if (coupon.minSpend > afterEvent) fail(422, 'COUPON_MIN_SPEND', `Đơn hàng cần tối thiểu ${coupon.minSpend.toLocaleString('vi-VN')}đ`, { field: 'couponCode' });
    const rev = selectedRev(couponEntity); const quota = num(rev.data.quota || 0);
    const uses = db.couponRedemptions.filter((x) => x.code === couponCode);
    if (quota > 0 && uses.length >= quota) fail(409, 'COUPON_SOLD_OUT', 'Mã giảm giá đã hết lượt sử dụng');
    const perBuyerLimit = num(rev.data.perBuyerLimit || 0);
    if (perBuyerLimit > 0 && user && uses.filter((x) => x.buyerRowId === user.rowId).length >= perBuyerLimit) {
      fail(409, 'COUPON_USER_LIMIT', 'Bạn đã sử dụng hết số lượt của mã này');
    }
    couponDiscount = coupon.type === 'PERCENT' ? Math.floor(afterEvent * coupon.value / 100) : coupon.value;
    if (coupon.capAmount > 0) couponDiscount = Math.min(couponDiscount, coupon.capAmount);
    couponDiscount = Math.min(afterEvent, Math.max(0, couponDiscount));
  }
  return {
    items: rows, subtotal, eventDiscount, couponDiscount, couponCode,
    discount: eventDiscount + couponDiscount, total: Math.max(0, subtotal - eventDiscount - couponDiscount),
  };
}
// Ma nhan qua khong luu plain-text: HMAC tao lai khi nguoi mua xem don da thanh toan.
function giftCode(db, order) {
  const digest=crypto.createHmac('sha256',Buffer.from(db.giftCodeSecret,'hex'))
    .update(`${order.rowId}:${order.gift.recipientEmail}`).digest('hex').slice(0,24).toUpperCase();
  return `GFT-${order.rowId.toString(36).toUpperCase()}-${digest}`;
}
function validatedGift(db, body, buyer, quoted) {
  if (body.gift == null || body.gift === false) return null;
  const g=body.gift;
  assert(g && typeof g==='object' && !Array.isArray(g),'Thông tin người nhận quà không hợp lệ','gift');
  const recipientEmail=String(g.recipientEmail||'').trim().toLowerCase();
  const recipientName=String(g.recipientName||'').trim();
  const message=String(g.message||'').trim();
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) && recipientEmail.length<=254,'Nhập email hợp lệ của người nhận quà','recipientEmail');
  assert(recipientEmail!==buyer.email.toLowerCase(),'Không thể tặng sách cho chính email của bạn','recipientEmail');
  assert(recipientName.length<=100,'Tên người nhận tối đa 100 ký tự','recipientName');
  assert(message.length<=300,'Lời nhắn tối đa 300 ký tự','message');
  assert(quoted.items.every((item)=>item.quantity===1),'Mỗi sách/combo trong đơn quà chỉ chọn số lượng 1','items');
  const existing=db.users.find((u)=>u.email.toLowerCase()===recipientEmail);
  if (existing && existing.role!=='BUYER') fail(422,'GIFT_RECIPIENT_INVALID','Email người nhận phải thuộc tài khoản khách hàng','recipientEmail');
  return {recipientEmail,recipientName,message,claimedAt:null};
}
function buyerOrder(db, order) {
  if (!order.gift) return order;
  return {...order,gift:{...order.gift,claimCode:order.status==='PAID'?giftCode(db,order):null}};
}
export function paidBookIds(db, buyerId) {
  const result = new Set();
  for (const order of db.orders) {
    if (order.status !== 'PAID' || order.recipientUserRowId !== buyerId) continue;
    for (const item of order.items) {
      for (const id of item.bookIds || (item.bookRowId ? [item.bookRowId] : [])) result.add(id);
      // Dữ liệu Admin mẫu trước đây lưu tên sản phẩm, chưa lưu bookRowId.
      if (item.type === 'BOOK' && !(item.bookIds?.length) && !item.bookRowId) {
        const b = db.books.find((x) => x.title === item.name); if (b) result.add(b.rowId);
      }
    }
  }
  return result;
}
function ownOrder(db, id, user) {
  const order = db.orders.find((o) => o.rowId === num(id) && o.buyerRowId === user.rowId);
  if (!order) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
  return order;
}
function ownComplaint(db, id, user) {
  const c = db.complaints.find((x) => x.rowId === num(id) && x.buyerRowId === user.rowId);
  if (!c) fail(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu hỗ trợ');
  return c;
}
function publicComplaint(c) {
  return { rowId: c.rowId, code: c.code, subject: c.subject, orderRowId: c.orderRowId, status: c.status, createdAt: c.createdAt,
    messages: c.messages.filter((m) => !m.internal).map((m) => ({ rowId: m.rowId, from: m.from, body: m.body, at: m.at })) };
}

export async function shopRoute(method, path, query, body, user) {
  const db = getDb();
  const activeEntries = liveEventEntries(db);
  const prices = eventPrices(db, activeEntries);
  const activeEvents = activeEntries.map((e) => publicEvent(e, db, prices));
  if (method === 'GET' && path === '/shop/home') {
    return { data: { categories: saleCategories(db), featured: db.books.filter(availableBook).slice(0, 8).map((b) => publicBook(b, db, prices)),
      bundles: db.bundles.filter(activeEntity).map((b) => publicBundle(b, db, prices)).filter(Boolean).slice(0, 4),
      activeEvents } };
  }
  if (method === 'GET' && path === '/shop/events') return { data: { items: activeEvents, serverNow: NOW() } };
  let eventPath = path.match(/^\/shop\/events\/(\d+)$/);
  if (method === 'GET' && eventPath) {
    const item = activeEvents.find((e) => e.rowId === num(eventPath[1]));
    if (!item) fail(404, 'NOT_FOUND', 'Sự kiện chưa diễn ra hoặc đã kết thúc');
    return { data: item };
  }
  if (method === 'GET' && path === '/shop/categories') return { data: { items: saleCategories(db) } };
  if (method === 'GET' && path === '/shop/books') {
    let list = db.books.filter(availableBook);
    if (query.q) list = list.filter((b) => matches(b.title, query.q) || matches(b.bookId, query.q) || b.authorIds.some((id) => matches(db.authors.find((a) => a.rowId === id)?.name, query.q)));
    if (query.categoryId) list = list.filter((b) => b.categoryId === num(query.categoryId));
    const sort = { newest: (a, b) => b.rowId - a.rowId, name: (a, b) => a.title.localeCompare(b.title, 'vi'),
      price_asc: (a, b) => (prices.get(a.rowId) || a.price) - (prices.get(b.rowId) || b.price),
      price_desc: (a, b) => (prices.get(b.rowId) || b.price) - (prices.get(a.rowId) || a.price) };
    list = list.sort(sort[query.sort] || sort.newest);
    const result = paging(list, query); result.items = result.items.map((b) => publicBook(b, db, prices));
    return { data: result };
  }
  let m = path.match(/^\/shop\/books\/(\d+)$/);
  if (m && method === 'GET') {
    const book = db.books.find((b) => b.rowId === num(m[1]));
    if (!availableBook(book)) fail(404, 'NOT_FOUND', 'Không tìm thấy sách');
    return { data: publicBook(book, db, prices, true) };
  }
  if (method === 'GET' && path === '/shop/bundles') return { data: { items: db.bundles.filter(activeEntity).map((b) => publicBundle(b, db, prices, true)).filter(Boolean) } };
  m = path.match(/^\/shop\/bundles\/(\d+)$/);
  if (m && method === 'GET') {
    const bundle = db.bundles.find((b) => b.rowId === num(m[1]));
    const item = activeEntity(bundle) && publicBundle(bundle, db, prices, true);
    if (!item) fail(404, 'NOT_FOUND', 'Combo không tồn tại hoặc đã ngừng bán');
    return { data: item };
  }
  if (method === 'GET' && path === '/shop/coupons') {
    return { data: { items: db.coupons.map(publicCoupon).filter(Boolean) } };
  }
  if (method === 'POST' && path === '/shop/checkout/quote') {
    return { data: quote(db, body, user) };
  }
  if (path === '/shop/orders' && method === 'POST') {
    buyerOnly(user);
    // Không nhận giá/discount từ frontend. Server tự tính lại trên DB hiện tại.
    const q = quote(db, body, user);
    const gift=validatedGift(db,body,user,q);
    const order = {
      rowId: nextId(), orderId: `ORD-${new Date().getFullYear()}-${String(db.seq).padStart(6, '0')}`,
      buyerRowId: user.rowId, recipientUserRowId: gift ? null : user.rowId, gift, status: 'PENDING_PAYMENT',
      subtotal: q.subtotal, discount: q.discount, eventDiscount: q.eventDiscount, couponDiscount: q.couponDiscount,
      discountSource: q.couponCode ? 'COUPON' : q.eventDiscount ? 'EVENT' : 'NONE', couponCode: q.couponCode,
      total: q.total, items: q.items, createdAt: NOW(), paidAt: null,
      payment: { method: 'DEMO_GATEWAY', attemptStatus: 'PENDING', failureCode: '' },
      history: [{ at: NOW(), status: 'PENDING_PAYMENT' }],
    };
    db.orders.unshift(order); auditBuyer(db, user, 'ORDER_CREATE', 'Orders', order.rowId); saveDb();
    return { status: 201, data: buyerOrder(db,order) };
  }
  if (path === '/shop/orders' && method === 'GET') {
    buyerOnly(user);
    const result=paging(db.orders.filter((o) => o.buyerRowId === user.rowId).sort((a,b) => b.rowId-a.rowId), query);
    result.items=result.items.map((o)=>buyerOrder(db,o));return {data:result};
  }
  m = path.match(/^\/shop\/orders\/(\d+)$/);
  if (m && method === 'GET') { buyerOnly(user); return { data: buyerOrder(db,ownOrder(db, m[1], user)) }; }
  m = path.match(/^\/shop\/orders\/(\d+)\/demo-pay$/);
  if (m && method === 'POST') {
    buyerOnly(user);
    if (process.env.DEMO_PAYMENTS_ENABLED === 'false') fail(403, 'DEMO_PAYMENTS_DISABLED', 'Thanh toán mô phỏng đang tắt');
    const order = ownOrder(db, m[1], user);
    if (order.status !== 'PENDING_PAYMENT') fail(409, 'ORDER_NOT_PENDING', 'Đơn hàng không ở trạng thái chờ thanh toán');
    if (order.couponCode) {
      const redemptions = db.couponRedemptions.filter((x) => x.code === order.couponCode);
      const coupon = db.coupons.find((c) => c.code === order.couponCode && activeEntity(c));
      const info = coupon && selectedRev(coupon).data;
      if (!info || (num(info.quota) > 0 && redemptions.length >= num(info.quota)) ||
        (num(info.perBuyerLimit) > 0 && redemptions.filter((x) => x.buyerRowId === user.rowId).length >= num(info.perBuyerLimit))) {
        fail(409, 'COUPON_SOLD_OUT', 'Mã giảm giá đã hết lượt sử dụng. Vui lòng hủy và đặt lại đơn.');
      }
      db.couponRedemptions.push({ code: order.couponCode, buyerRowId: user.rowId, orderRowId: order.rowId });
    }
    order.status = 'PAID'; order.paidAt = NOW(); order.payment.attemptStatus = 'SUCCEEDED';
    order.history.push({ at: NOW(), status: 'PAID' });
    auditBuyer(db, user, 'ORDER_PAID_DEMO', 'Orders', order.rowId); saveDb();
    return { data: buyerOrder(db,order) };
  }
  m = path.match(/^\/shop\/orders\/(\d+)\/cancel$/);
  if (m && method === 'POST') {
    buyerOnly(user);
    const order = ownOrder(db, m[1], user);
    if (order.status !== 'PENDING_PAYMENT') fail(409, 'ORDER_NOT_PENDING', 'Không thể hủy đơn đã xử lý');
    order.status = 'CANCELLED'; order.payment.attemptStatus = 'FAILED'; order.payment.failureCode = 'CANCELLED';
    order.history.push({ at: NOW(), status: 'CANCELLED' }); saveDb();
    return { data: buyerOrder(db,order) };
  }
  if (method==='POST' && path==='/shop/gifts/claim') {
    buyerOnly(user);
    const code=String(body.code||'').trim().toUpperCase();
    assert(code.length<=80,'Mã quà tặng không hợp lệ','code');
    const parsed=/^GFT-([A-Z0-9]+)-([A-F0-9]{24})$/.exec(code);
    const rowId=parsed?parseInt(parsed[1],36):NaN;
    const order=db.orders.find((o)=>o.rowId===rowId && o.gift && o.status==='PAID');
    const invalid=()=>fail(422,'GIFT_INVALID','Mã nhận quà không hợp lệ hoặc không dành cho email này');
    if (!order || !Number.isSafeInteger(rowId) || giftCode(db,order).length!==code.length) invalid();
    const expected=Buffer.from(giftCode(db,order),'ascii');
    const supplied=Buffer.from(code,'ascii');
    if (expected.length!==supplied.length || !crypto.timingSafeEqual(expected,supplied)) invalid();
    if (order.gift.recipientEmail!==user.email.toLowerCase()) invalid();
    if (order.recipientUserRowId && order.recipientUserRowId!==user.rowId) invalid();
    if (!order.recipientUserRowId) {
      order.recipientUserRowId=user.rowId;
      order.gift.claimedAt=NOW();
      order.history.push({at:NOW(),status:'GIFT_CLAIMED'});
      auditBuyer(db,user,'GIFT_CLAIM','Orders',order.rowId);
      saveDb();
    }
    return {data:{orderId:order.orderId,bookCount:[...new Set(order.items.flatMap((i)=>i.bookIds||[]))].length,claimedAt:order.gift.claimedAt}};
  }
  if (method==='GET' && path==='/shop/gifts/received') {
    buyerOnly(user);
    const items=db.orders.filter((o)=>o.gift && o.status==='PAID' && o.recipientUserRowId===user.rowId)
      .sort((a,b)=>b.rowId-a.rowId).map((o)=>({rowId:o.rowId,orderId:o.orderId,claimedAt:o.gift.claimedAt,
        message:o.gift.message,senderName:db.users.find((u)=>u.rowId===o.buyerRowId)?.fullName||'Một người bạn',
        books:[...new Set(o.items.flatMap((i)=>i.bookIds||[]))].map((id)=>db.books.find((b)=>b.rowId===id)).filter(Boolean)
          .map((b)=>publicBook(b,db,prices))}));
    return {data:{items}};
  }
  if (method === 'GET' && path === '/shop/library') {
    buyerOnly(user);
    const ids = paidBookIds(db, user.rowId);
    return { data: { items: [...ids].map((id) => db.books.find((b) => b.rowId === id)).filter(Boolean)
      .map((b) => ({ ...publicBook(b, db, prices), currentlyAvailable: availableBook(b) })) } };
  }
  if (method === 'GET' && path === '/shop/favorites') {
    buyerOnly(user);
    return { data: { items: (user.favoriteBooks || []).map((id) => db.books.find((b) => b.rowId === id)).filter(availableBook).map((b) => publicBook(b, db, prices)) } };
  }
  m = path.match(/^\/shop\/favorites\/(\d+)$/);
  if (m && ['POST','DELETE'].includes(method)) {
    buyerOnly(user);
    const id = num(m[1]);
    if (!availableBook(db.books.find((b) => b.rowId === id))) fail(404, 'NOT_FOUND', 'Không tìm thấy sách');
    user.favoriteBooks ||= [];
    if (method === 'POST' && !user.favoriteBooks.includes(id)) user.favoriteBooks.push(id);
    if (method === 'DELETE') user.favoriteBooks = user.favoriteBooks.filter((x) => x !== id);
    saveDb(); return { data: { ok: true, ids: user.favoriteBooks } };
  }
  if (method === 'POST' && path === '/shop/reviews') {
    buyerOnly(user);
    const bookId = num(body.bookId); const rating = num(body.rating); const content = String(body.content || '').trim();
    assert(Number.isInteger(rating) && rating >= 1 && rating <= 5, 'Điểm đánh giá từ 1 đến 5', 'rating');
    assert(content.length >= 3 && content.length <= 1000, 'Nội dung cần từ 3 đến 1000 ký tự', 'content');
    if (!paidBookIds(db, user.rowId).has(bookId)) fail(403, 'PURCHASE_REQUIRED', 'Chỉ có thể đánh giá sách đã mua');
    if (db.reviews.some((r) => r.bookRowId === bookId && r.buyerRowId === user.rowId)) fail(409, 'ALREADY_REVIEWED', 'Bạn đã đánh giá sách này');
    const review = { rowId: nextId(), bookRowId: bookId, buyerRowId: user.rowId, rating, content, status: 'VISIBLE', editCount: 0, createdAt: NOW() };
    db.reviews.push(review); auditBuyer(db, user, 'REVIEW_CREATE', 'Reviews', review.rowId); saveDb();
    return { status: 201, data: review };
  }
  if (method === 'POST' && path === '/shop/content-reports') {
    buyerOnly(user);
    const targetType = String(body.targetType || ''); const targetRowId = num(body.targetRowId); const reason = String(body.reason || '').trim();
    assert(['BOOK','REVIEW'].includes(targetType), 'Chọn loại nội dung báo cáo', 'targetType');
    assert(reason.length >= 5 && reason.length <= 500, 'Lý do cần từ 5 đến 500 ký tự', 'reason');
    const exists = targetType === 'BOOK' ? db.books.some((b) => b.rowId === targetRowId) : db.reviews.some((r) => r.rowId === targetRowId);
    if (!exists) fail(404, 'NOT_FOUND', 'Không có nội dung cần báo cáo');
    const report = { rowId: nextId(), targetType, targetRowId, reporterRowId: user.rowId, reason, status: 'PENDING', createdAt: NOW() };
    db.contentReports.push(report); auditBuyer(db, user, 'CONTENT_REPORT_CREATE', 'ContentReports', report.rowId); saveDb();
    return { status: 201, data: report };
  }
  if (path === '/shop/complaints' && method === 'POST') {
    buyerOnly(user);
    const subject = String(body.subject || '').trim(); const message = String(body.message || '').trim(); const orderRowId = num(body.orderRowId);
    assert(subject.length >= 5 && subject.length <= 150, 'Tiêu đề cần từ 5 đến 150 ký tự', 'subject');
    assert(message.length >= 5 && message.length <= 2000, 'Nội dung cần từ 5 đến 2000 ký tự', 'message');
    ownOrder(db, orderRowId, user);
    const rowId = nextId();
    const c = { rowId, code: `CMP-${String(rowId).padStart(5,'0')}`, buyerRowId: user.rowId, orderRowId, subject, status: 'OPEN', createdAt: NOW(),
      messages: [{ rowId: nextId(), from: 'BUYER', body: message, internal: false, at: NOW() }] };
    db.complaints.unshift(c); auditBuyer(db, user, 'COMPLAINT_CREATE', 'Complaints', c.rowId); saveDb();
    return { status: 201, data: publicComplaint(c) };
  }
  if (path === '/shop/complaints' && method === 'GET') {
    buyerOnly(user);
    return { data: { items: db.complaints.filter((c) => c.buyerRowId === user.rowId).sort((a,b) => b.rowId-a.rowId).map(publicComplaint) } };
  }
  m = path.match(/^\/shop\/complaints\/(\d+)$/);
  if (m && method === 'GET') { buyerOnly(user); return { data: publicComplaint(ownComplaint(db, m[1], user)) }; }
  m = path.match(/^\/shop\/complaints\/(\d+)\/messages$/);
  if (m && method === 'POST') {
    buyerOnly(user);
    const c = ownComplaint(db, m[1], user);
    if (c.status === 'CLOSED') fail(409, 'COMPLAINT_CLOSED', 'Yêu cầu đã đóng');
    const text = String(body.body || '').trim();
    assert(text.length >= 1 && text.length <= 2000, 'Nội dung từ 1 đến 2000 ký tự', 'body');
    const msg = { rowId: nextId(), from: 'BUYER', body: text, internal: false, at: NOW() };
    c.messages.push(msg); auditBuyer(db, user, 'COMPLAINT_REPLY', 'Complaints', c.rowId); saveDb();
    return { status: 201, data: msg };
  }
  fail(404, 'NOT_FOUND', `Không có endpoint ${method} ${path}`);
}

// Dữ liệu chat lấy cùng bộ lọc/giá với API shop; không expose sách nháp, suspended hoặc bị xóa.
export function publicCatalogForChat() {
  const db = getDb();
  const prices = eventPrices(db);
  return { books: db.books.filter(availableBook).map((b) => publicBook(b, db, prices)),
    bundles: db.bundles.filter(activeEntity).map((b) => publicBundle(b, db, prices)).filter(Boolean),
    categories: saleCategories(db) };
}

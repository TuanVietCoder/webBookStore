// Mock API theo mục 9.2 của đặc tả v2.0.3. Trả đúng mã lỗi (403/409/422) như spec.
import { getDb, saveDb, resetDb, nextId } from './db.js';

class HttpError extends Error {
  constructor(status, errorCode, message, details) { super(message); this.status = status; this.errorCode = errorCode; this.details = details; }
}
const E = (s, c, m, d) => new HttpError(s, c, m, d);
const created = (x) => ({ __http: 201, __body: x });

// ---------- Quyền ----------
const PERMS = {
  EMPLOYEE: ['BOOK_WRITE', 'CONTENT_MODERATE', 'SUPPORT_HANDLE', 'ORDER_SUPPORT_VIEW', 'REVISION_WRITE', 'REPORT_OPERATIONAL', 'ACCOUNT_DISABLE_SCOPE', 'AI_ADMIN_USE', 'BUSINESS_HISTORY', 'SOFT_DELETE'],
  MANAGER: ['BOOK_WRITE', 'CONTENT_MODERATE', 'SUPPORT_HANDLE', 'ORDER_SUPPORT_VIEW', 'REVISION_WRITE', 'REPORT_OPERATIONAL', 'ACCOUNT_DISABLE_SCOPE', 'AI_ADMIN_USE', 'BUSINESS_HISTORY', 'SOFT_DELETE',
    'REVISION_APPROVE', 'REPORT_FINANCIAL', 'AUDIT_GLOBAL', 'STAFF_MANAGE', 'KNOWLEDGE_MANAGE', 'SETTINGS_MANAGE', 'ACCOUNT_VIEW_ALL'],
};
export const permsOf = (role) => PERMS[role] || [];
const need = (u, perm) => { if (!u) throw E(401, 'UNAUTHENTICATED', 'Chưa đăng nhập'); if (!permsOf(u.role).includes(perm)) throw E(403, 'FORBIDDEN', 'Không đủ quyền: ' + perm); };

// ---------- Tiện ích ----------
const clone = (x) => JSON.parse(JSON.stringify(x));
const now = () => new Date().toISOString();
const SENSITIVE_KEYS = ['password', 'passwordHash', 'secret'];
function mask(obj, extra = []) {
  if (obj == null || typeof obj !== 'object') return obj;
  const o = Array.isArray(obj) ? obj.map((x) => mask(x, extra)) : {};
  if (Array.isArray(obj)) return o;
  for (const [k, v] of Object.entries(obj)) {
    o[k] = SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) || extra.includes(k) ? '******' : (typeof v === 'object' ? mask(v, extra) : v);
  }
  return o;
}
function audit(user, action, table, recordRowId, before, after, source = 'WEB', requestId = null, extraMask = []) {
  const db = getDb();
  db.auditLogs.unshift({
    rowId: nextId(), occurredAt: now(), actorUserRowId: user ? user.rowId : null, actorType: user ? 'USER' : 'SYSTEM', actorRoleSnapshot: user ? user.role : null,
    actionSource: source, actionCode: action, tableName: table, recordRowId, oldValues: before ? mask(clone(before), extraMask) : null, newValues: after ? mask(clone(after), extraMask) : null, requestId,
  });
}
function page(items, q) {
  const p = Math.max(1, Number(q.page) || 1), ps = Math.min(100, Math.max(1, Number(q.pageSize) || 10));
  return { items: items.slice((p - 1) * ps, p * ps), total: items.length, page: p, pageSize: ps };
}
const has = (s, t) => String(s || '').toLowerCase().includes(String(t || '').toLowerCase());
function checkVersion(entity, ifMatch) {
  if (ifMatch == null || ifMatch === '') throw E(428, 'IF_MATCH_REQUIRED', 'Thiếu header If-Match: Version');
  if (Number(ifMatch) !== entity.version) throw E(409, 'VERSION_CONFLICT', 'Dữ liệu đã bị người khác thay đổi, hãy tải lại.', { current: entity.version });
}
const must = (cond, field, msg) => { if (!cond) throw E(422, 'VALIDATION_ERROR', msg, { field }); };
function find(list, id, label = 'Bản ghi') {
  const x = list.find((i) => i.rowId === Number(id) && !i.isDel);
  if (!x) throw E(404, 'NOT_FOUND', label + ' không tồn tại');
  return x;
}
function findAny(list, id, label = 'Bản ghi') {
  const x = list.find((i) => i.rowId === Number(id));
  if (!x) throw E(404, 'NOT_FOUND', label + ' không tồn tại');
  return x;
}

// ---------- Xác thực ----------
function sessionUser(token) {
  const db = getDb();
  const rowId = db.sessions[token];
  if (!rowId) return null;
  const u = db.users.find((x) => x.rowId === rowId);
  return u && u.status === 'ACTIVE' ? u : null;
}
const pubUser = (u) => ({ rowId: u.rowId, email: u.email, fullName: u.fullName, role: u.role, status: u.status, disableReason: u.disableReason || '', version: u.version, createdAt: u.createdAt });

// ---------- Revision (Bundle/Event/Coupon) ----------
const KINDS = { bundles: 'Bundles', events: 'Events', coupons: 'Coupons' };
const KIND_FIELD = { bundles: 'name', events: 'name', coupons: 'code' };
function summarize(e) {
  const sel = e.revisions.find((r) => r.no === e.selectedRevNo);
  const open = e.revisions.find((r) => r.status === 'DRAFT' || r.status === 'PENDING');
  const data = (sel || e.revisions[e.revisions.length - 1]).data;
  return { rowId: e.rowId, code: e.code, kind: e.kind, isActive: e.isActive, version: e.version, selectedRevNo: e.selectedRevNo, scheduledRevNo: e.scheduledRevNo,
    title: data.name || data.code, data, hasPending: !!open, openStatus: open ? open.status : null, status: !e.isActive ? 'DISABLED' : sel ? 'APPROVED' : (open ? open.status : 'DRAFT'), revisionCount: e.revisions.length };
}
function validateRev(kind, d, db) {
  if (kind === 'bundles') {
    must(d.name && d.name.trim(), 'name', 'Tên Bundle bắt buộc');
    must(['FIXED', 'FLEXIBLE'].includes(d.type), 'type', 'Loại Bundle không hợp lệ');
    must(Number(d.price) > 0, 'price', 'Giá Bundle phải > 0');
    must(Array.isArray(d.bookIds) && d.bookIds.length >= 2, 'bookIds', 'Bundle cần ít nhất 2 sách');
    d.bookIds.forEach((id) => { const b = db.books.find((x) => x.rowId === id && !x.isDel); must(b && b.status === 'PUBLISHED', 'bookIds', 'Sách #' + id + ' không ở trạng thái bán'); });
    if (d.type === 'FLEXIBLE') must(Number(d.pickCount) >= 1 && Number(d.pickCount) < d.bookIds.length, 'pickCount', 'Số sách được chọn phải nhỏ hơn tổng số sách');
    else d.pickCount = d.bookIds.length;
  } else if (kind === 'events') {
    must(d.name && d.name.trim(), 'name', 'Tên Event bắt buộc');
    must(['BOOK_SALE', 'TET_SALE'].includes(d.type), 'type', 'Loại Event không hợp lệ');
    must(d.startAt && d.endAt && new Date(d.endAt) > new Date(d.startAt), 'endAt', 'Thời gian kết thúc phải sau thời gian bắt đầu');
    must((d.bookDiscounts && d.bookDiscounts.length) || (d.bundleIds && d.bundleIds.length), 'bookDiscounts', 'Event cần ít nhất một sách hoặc Bundle');
    (d.bookDiscounts || []).forEach((x) => { const b = db.books.find((y) => y.rowId === x.bookId); must(b, 'bookDiscounts', 'Sách #' + x.bookId + ' không tồn tại'); must(Number(x.salePrice) > 0 && Number(x.salePrice) < b.price, 'bookDiscounts', 'Giá sale của "' + b.title + '" phải nhỏ hơn giá gốc'); });
  } else {
    must(/^[A-Z0-9_-]{3,30}$/.test(d.code || ''), 'code', 'Mã coupon 3-30 ký tự IN HOA/số/_-');
    must(['PERCENT', 'FIXED'].includes(d.type), 'type', 'Loại coupon không hợp lệ');
    must(Number(d.value) > 0, 'value', 'Giá trị giảm phải > 0');
    if (d.type === 'PERCENT') must(Number(d.value) <= 100, 'value', 'Phần trăm tối đa 100');
    must(d.startAt && d.endAt && new Date(d.endAt) > new Date(d.startAt), 'endAt', 'Thời gian kết thúc phải sau thời gian bắt đầu');
    must(Number(d.quota || 0) >= 0 && Number(d.minSpend || 0) >= 0, 'quota', 'Quota/mức chi tối thiểu không âm');
  }
}
function eventRange(rev) { return [new Date(rev.data.startAt).getTime(), new Date(rev.data.endAt).getTime()]; }
function checkOverlap(db, ev, rev) {
  const [s, e] = eventRange(rev);
  for (const other of db.events) {
    if (other.isDel || !other.isActive || other.rowId === ev.rowId) continue;
    for (const r of other.revisions.filter((x) => x.no === other.selectedRevNo || x.no === other.scheduledRevNo)) {
      const [os, oe] = eventRange(r);
      if (s < oe && os < e) return other;
    }
  }
  return null;
}

// ---------- Định tuyến ----------
const routes = [];
const route = (method, pattern, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, public: !!opts.public });
};

// Auth
route('POST', '/auth/login', ({ body }) => {
  const db = getDb();
  const u = db.users.find((x) => x.email.toLowerCase() === String(body.email || '').trim().toLowerCase());
  if (!u || !['EMPLOYEE', 'MANAGER'].includes(u.role) || u.password !== body.password) {
    audit(null, 'LOGIN_FAIL', null, null, null, { email: body.email }, 'WEB');
    saveDb();
    throw E(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
  }
  if (u.status !== 'ACTIVE') throw E(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa');
  const token = 'mock-' + Math.random().toString(36).slice(2) + Date.now();
  db.sessions[token] = u.rowId;
  audit(u, 'LOGIN', 'Users', u.rowId, null, null);
  saveDb();
  return { accessToken: token, user: pubUser(u), permissions: permsOf(u.role) };
}, { public: true });
route('GET', '/auth/me', ({ user }) => ({ user: pubUser(user), permissions: permsOf(user.role) }));
route('POST', '/auth/logout', ({ token }) => { const db = getDb(); delete db.sessions[token]; saveDb(); return { ok: true }; });

// Sách
const bookView = (b, db) => ({ ...b, authorNames: b.authorIds.map((id) => (db.authors.find((a) => a.rowId === id) || {}).name).filter(Boolean),
  categoryName: (db.categories.find((c) => c.rowId === b.categoryId) || {}).name, publisherName: (db.publishers.find((c) => c.rowId === b.publisherId) || {}).name });
route('GET', '/admin/books', ({ user, query }) => {
  need(user, 'BOOK_WRITE'); const db = getDb();
  let l = db.books.filter((b) => (query.includeDeleted === 'true' ? true : !b.isDel));
  if (query.q) l = l.filter((b) => has(b.title, query.q) || has(b.bookId, query.q));
  if (query.status) l = l.filter((b) => b.status === query.status);
  if (query.servingStatus) l = l.filter((b) => b.servingStatus === query.servingStatus);
  if (query.categoryId) l = l.filter((b) => b.categoryId === Number(query.categoryId));
  const r = page(l, query); r.items = r.items.map((b) => bookView(b, db)); return r;
});
route('GET', '/admin/books/:id', ({ user, params }) => { need(user, 'BOOK_WRITE'); const db = getDb(); return bookView(findAny(db.books, params.id, 'Sách'), db); });
function validateBook(b, db, isNew, selfId) {
  must(b.title && b.title.trim(), 'title', 'Tên sách bắt buộc');
  must(/^[A-Za-z0-9_-]{3,30}$/.test(b.bookId || ''), 'bookId', 'BookId 3-30 ký tự chữ/số/_-');
  if (db.books.some((x) => x.bookId.toLowerCase() === b.bookId.toLowerCase() && x.rowId !== selfId)) throw E(409, 'DUPLICATE_BOOK_ID', 'BookId đã tồn tại', { field: 'bookId' });
  must(Number(b.price) >= 0, 'price', 'Giá không âm');
  must(Array.isArray(b.authorIds) && b.authorIds.length > 0, 'authorIds', 'Chọn ít nhất một tác giả');
  must(db.categories.some((c) => c.rowId === Number(b.categoryId) && !c.isDel), 'categoryId', 'Danh mục không hợp lệ');
  if (b.publisherId) must(db.publishers.some((c) => c.rowId === Number(b.publisherId) && !c.isDel), 'publisherId', 'Nhà xuất bản không hợp lệ');
}
route('POST', '/admin/books', ({ user, body }) => {
  need(user, 'BOOK_WRITE'); const db = getDb(); validateBook(body, db, true, null);
  const b = { rowId: nextId(), bookId: body.bookId.trim(), title: body.title.trim(), authorIds: body.authorIds.map(Number), categoryId: Number(body.categoryId), publisherId: Number(body.publisherId) || null,
    price: Number(body.price), status: 'DRAFT', servingStatus: 'ACTIVE', suspendReason: '', description: body.description || '', files: [], isDel: false, version: 1, createdAt: now() };
  db.books.unshift(b); audit(user, 'BOOK_CREATE', 'Books', b.rowId, null, b); saveDb(); return created(bookView(b, db));
});
route('PATCH', '/admin/books/:id', ({ user, params, body, ifMatch }) => {
  need(user, 'BOOK_WRITE'); const db = getDb(); const b = find(db.books, params.id, 'Sách'); checkVersion(b, ifMatch);
  const before = clone(b); const nb = { ...b, ...body, bookId: body.bookId ?? b.bookId };
  validateBook(nb, db, false, b.rowId);
  if (body.status && body.status !== b.status) {
    must(['DRAFT', 'PUBLISHED', 'HIDDEN'].includes(body.status), 'status', 'Trạng thái không hợp lệ');
    if (body.status === 'PUBLISHED') throw0(!b.files.some((f) => f.active), 422, 'BOOK_NO_FILE', 'Cần ít nhất một file PDF đang dùng trước khi xuất bản');
  }
  Object.assign(b, { bookId: nb.bookId, title: nb.title, authorIds: nb.authorIds.map(Number), categoryId: Number(nb.categoryId), publisherId: Number(nb.publisherId) || null, price: Number(nb.price), description: nb.description || '', status: nb.status });
  b.version++; audit(user, 'BOOK_UPDATE', 'Books', b.rowId, before, b); saveDb(); return bookView(b, db);
});
function throw0(cond, s, c, m) { if (cond) throw E(s, c, m); }
route('POST', '/admin/books/:id/files', ({ user, params, body }) => {
  need(user, 'BOOK_WRITE'); const db = getDb(); const b = find(db.books, params.id, 'Sách');
  must(/\.pdf$/i.test(body.fileName || ''), 'fileName', 'Chỉ nhận file .pdf');
  must(Number(body.sizeBytes) > 0 && Number(body.sizeBytes) <= 50 * 1024 * 1024, 'sizeBytes', 'Dung lượng tối đa 50MB');
  const before = clone(b); b.files.forEach((f) => { f.active = false; });
  b.files.push({ rowId: nextId(), version: b.files.length + 1, fileName: body.fileName, sizeBytes: Number(body.sizeBytes), active: true });
  b.version++; audit(user, 'BOOK_FILE_UPLOAD', 'Books', b.rowId, before, b); saveDb(); return created(bookView(b, db));
});
route('POST', '/admin/books/:id/serving-status', ({ user, params, body }) => {
  need(user, 'CONTENT_MODERATE'); const db = getDb(); const b = find(db.books, params.id, 'Sách');
  must(['ACTIVE', 'SUSPENDED'].includes(body.servingStatus), 'servingStatus', 'Trạng thái phục vụ không hợp lệ');
  must(body.reason && body.reason.trim().length >= 5, 'reason', 'Bắt buộc nhập lý do (≥ 5 ký tự)');
  if (b.servingStatus === body.servingStatus) throw E(409, 'NO_CHANGE', 'Sách đã ở trạng thái này');
  const before = clone(b); b.servingStatus = body.servingStatus; b.suspendReason = body.servingStatus === 'SUSPENDED' ? body.reason : ''; b.version++;
  audit(user, body.servingStatus === 'SUSPENDED' ? 'BOOK_SUSPEND' : 'BOOK_RESUME', 'Books', b.rowId, before, { ...b, reason: body.reason }); saveDb(); return bookView(b, db);
});

// Danh mục tác giả/danh mục/nhà xuất bản
const CATALOGS = { authors: 'Authors', categories: 'Categories', publishers: 'Publishers' };
route('GET', '/admin/:catalog', ({ user, params, query }) => {
  if (!CATALOGS[params.catalog]) return NEXT; need(user, 'BOOK_WRITE'); const db = getDb();
  let l = db[params.catalog].filter((x) => (query.includeDeleted === 'true' ? true : !x.isDel)); if (query.q) l = l.filter((x) => has(x.name, query.q));
  return query.all === 'true' ? { items: l, total: l.length } : page(l, query);
});
route('POST', '/admin/:catalog', ({ user, params, body }) => {
  if (!CATALOGS[params.catalog]) return NEXT; need(user, 'BOOK_WRITE'); const db = getDb();
  must(body.name && body.name.trim(), 'name', 'Tên bắt buộc');
  if (db[params.catalog].some((x) => !x.isDel && x.name.toLowerCase() === body.name.trim().toLowerCase())) throw E(409, 'DUPLICATE', 'Tên đã tồn tại', { field: 'name' });
  const x = { rowId: nextId(), name: body.name.trim(), isDel: false, version: 1 }; if (params.catalog === 'categories') x.code = body.code || 'CAT' + x.rowId;
  db[params.catalog].push(x); audit(user, 'CATALOG_CREATE', CATALOGS[params.catalog], x.rowId, null, x); saveDb(); return created(x);
});
route('PATCH', '/admin/:catalog/:id', ({ user, params, body, ifMatch }) => {
  if (!CATALOGS[params.catalog]) return NEXT; need(user, 'BOOK_WRITE'); const db = getDb(); const x = find(db[params.catalog], params.id); checkVersion(x, ifMatch);
  must(body.name && body.name.trim(), 'name', 'Tên bắt buộc'); const before = clone(x); x.name = body.name.trim(); x.version++;
  audit(user, 'CATALOG_UPDATE', CATALOGS[params.catalog], x.rowId, before, x); saveDb(); return x;
});

// Xóa mềm / khôi phục
const SOFT = { books: 'Books', authors: 'Authors', categories: 'Categories', publishers: 'Publishers', bundles: 'Bundles', coupons: 'Coupons', events: 'Events' };
const NO_SOFT = ['orders', 'entitlement-sources', 'audit-logs'];
route('DELETE', '/admin/:resource/:id', ({ user, params, body }) => {
  if (NO_SOFT.includes(params.resource)) throw E(403, 'SOFT_DELETE_NOT_ALLOWED', 'Không cho phép xóa dữ liệu này');
  if (!SOFT[params.resource]) return NEXT; need(user, 'SOFT_DELETE'); const db = getDb(); const x = find(db[params.resource], params.id);
  must(body && body.reason && body.reason.trim().length >= 5, 'reason', 'Bắt buộc nhập lý do');
  if (params.resource === 'categories' && db.books.some((b) => !b.isDel && b.categoryId === x.rowId)) throw E(409, 'IN_USE', 'Danh mục đang có sách');
  if (params.resource === 'authors' && db.books.some((b) => !b.isDel && b.authorIds.includes(x.rowId))) throw E(409, 'IN_USE', 'Tác giả đang có sách');
  const before = clone(x); x.isDel = true; x.deletedAt = now(); x.version = (x.version || 1) + 1;
  audit(user, 'SOFT_DELETE', SOFT[params.resource], x.rowId, before, { ...x, reason: body.reason }); saveDb(); return { ok: true };
});
route('POST', '/admin/:resource/:id/restore', ({ user, params }) => {
  if (!SOFT[params.resource]) return NEXT; need(user, 'SOFT_DELETE'); const db = getDb(); const x = findAny(db[params.resource], params.id);
  if (!x.isDel) throw E(409, 'NOT_DELETED', 'Bản ghi chưa bị xóa'); const before = clone(x); x.isDel = false; x.deletedAt = null; x.version++;
  audit(user, 'RESTORE', SOFT[params.resource], x.rowId, before, x); saveDb(); return { ok: true };
});

// Revision: bundles / events / coupons
const NEXT = Symbol('next');
const getEntity = (db, kind, id) => findAny(db[kind], id, KINDS[kind].slice(0, -1));
route('GET', '/admin/:kind', ({ user, params, query }) => {
  if (!KINDS[params.kind]) return NEXT; need(user, 'REVISION_WRITE'); const db = getDb();
  let l = db[params.kind].filter((e) => (query.includeDeleted === 'true' ? true : !e.isDel)).map(summarize);
  if (query.q) l = l.filter((e) => has(e.title, query.q) || has(e.code, query.q)); if (query.status) l = l.filter((e) => e.status === query.status);
  return page(l, query);
});
route('GET', '/admin/:kind/:id', ({ user, params }) => {
  if (!KINDS[params.kind]) return NEXT; need(user, 'REVISION_WRITE'); const db = getDb(); const e = getEntity(db, params.kind, params.id);
  return { ...summarize(e), revisions: clone(e.revisions) };
});
route('POST', '/admin/:kind', ({ user, params, body }) => {
  if (!KINDS[params.kind]) return NEXT; need(user, 'REVISION_WRITE'); const db = getDb(); const kind = params.kind;
  const data = body.data || {}; validateRev(kind, data, db);
  const code = kind === 'coupons' ? data.code : (body.code || '').toUpperCase().trim();
  must(/^[A-Z0-9_-]{3,30}$/.test(code), 'code', 'Mã 3-30 ký tự IN HOA/số/_-');
  if (db[kind].some((e) => e.code === code)) throw E(409, 'DUPLICATE_CODE', 'Mã đã tồn tại', { field: 'code' });
  const e = { rowId: nextId(), code, kind, isActive: true, version: 1, selectedRevNo: null, scheduledRevNo: null, isDel: false,
    revisions: [{ rowId: nextId(), no: 1, status: 'DRAFT', data: clone(data), createdBy: user.rowId, approvedBy: null, createdAt: now(), submittedAt: null, rejectReason: '' }] };
  db[kind].unshift(e); audit(user, KINDS[kind].toUpperCase().slice(0, -1) + '_CREATE', KINDS[kind], e.rowId, null, e); saveDb(); return created({ ...summarize(e), revisions: clone(e.revisions) });
});
route('POST', '/admin/:kind/:id/revisions', ({ user, params, body }) => {
  if (!KINDS[params.kind]) return NEXT; need(user, 'REVISION_WRITE'); const db = getDb(); const e = getEntity(db, params.kind, params.id);
  if (!e.isActive) throw E(409, 'ENTITY_DISABLED', 'Đối tượng đã bị tắt');
  if (e.revisions.some((r) => r.status === 'DRAFT' || r.status === 'PENDING')) throw E(409, 'OPEN_REVISION_EXISTS', 'Đã có revision nháp/đang chờ duyệt');
  const base = e.revisions.find((r) => r.no === e.selectedRevNo) || e.revisions[e.revisions.length - 1];
  const rev = { rowId: nextId(), no: Math.max(...e.revisions.map((r) => r.no)) + 1, status: 'DRAFT', data: clone(body.data || base.data), createdBy: user.rowId, approvedBy: null, createdAt: now(), submittedAt: null, rejectReason: '' };
  if (params.kind === 'coupons') rev.data.code = e.code;
  e.revisions.push(rev); e.version++; audit(user, 'REVISION_CREATE', KINDS[params.kind], e.rowId, null, rev); saveDb(); return created({ ...summarize(e), revisions: clone(e.revisions) });
});
route('PATCH', '/admin/:kind/:id/revisions/:rev', ({ user, params, body, ifMatch }) => {
  if (!KINDS[params.kind]) return NEXT; need(user, 'REVISION_WRITE'); const db = getDb(); const e = getEntity(db, params.kind, params.id); checkVersion(e, ifMatch);
  const r = e.revisions.find((x) => x.no === Number(params.rev)); if (!r) throw E(404, 'NOT_FOUND', 'Revision không tồn tại');
  if (r.status !== 'DRAFT') throw E(409, 'REVISION_NOT_EDITABLE', 'Chỉ sửa được revision nháp');
  const data = { ...r.data, ...(body.data || {}) }; if (params.kind === 'coupons') data.code = e.code; validateRev(params.kind, data, db);
  const before = clone(r); r.data = data; e.version++; audit(user, 'REVISION_UPDATE', KINDS[params.kind], e.rowId, before, r); saveDb(); return { ...summarize(e), revisions: clone(e.revisions) };
});
route('POST', '/admin/:kind/:id/revisions/:rev/:action', ({ user, params, body }) => {
  if (!KINDS[params.kind]) return NEXT; const db = getDb(); const kind = params.kind; const e = getEntity(db, kind, params.id);
  const r = e.revisions.find((x) => x.no === Number(params.rev)); if (!r) throw E(404, 'NOT_FOUND', 'Revision không tồn tại');
  if (!['submit', 'approve', 'reject'].includes(params.action)) throw E(404, 'NOT_FOUND', 'Hành động không hợp lệ');
  const before = clone(r);
  if (params.action === 'submit') {
    need(user, 'REVISION_WRITE'); if (r.status !== 'DRAFT') throw E(409, 'INVALID_STATE', 'Chỉ gửi duyệt được revision nháp');
    const d = clone(r.data); validateRev(kind, d, db); r.data = d; r.status = 'PENDING'; r.submittedAt = now();
    audit(user, 'REVISION_SUBMIT', KINDS[kind], e.rowId, before, r);
  } else {
    need(user, 'REVISION_APPROVE'); if (r.status !== 'PENDING') throw E(409, 'INVALID_STATE', 'Chỉ duyệt/từ chối được revision đang chờ');
    if (params.action === 'reject') {
      must(body.reason && body.reason.trim().length >= 5, 'reason', 'Bắt buộc nhập lý do từ chối');
      r.status = 'REJECTED'; r.rejectReason = body.reason; r.approvedBy = user.rowId; audit(user, 'REVISION_REJECT', KINDS[kind], e.rowId, before, r);
    } else {
      validateRev(kind, r.data, db);
      if (kind === 'events') {
        const conflict = checkOverlap(db, e, r);
        if (conflict) throw E(409, 'EVENT_OVERLAP', 'Lịch chồng với Event đã duyệt: ' + conflict.code, { conflictWith: conflict.code });
      }
      r.status = 'APPROVED'; r.approvedBy = user.rowId;
      const startsLater = kind === 'events' && e.selectedRevNo && new Date(r.data.startAt) > new Date();
      if (startsLater) {
        if (e.scheduledRevNo) { const old = e.revisions.find((x) => x.no === e.scheduledRevNo); if (old) old.status = 'APPROVED'; }
        e.scheduledRevNo = r.no;
      } else { e.selectedRevNo = r.no; e.scheduledRevNo = null; }
      audit(user, 'REVISION_APPROVE', KINDS[kind], e.rowId, before, r);
    }
  }
  e.version++; saveDb(); return { ...summarize(e), revisions: clone(e.revisions) };
});
route('POST', '/admin/:kind/:id/disable', ({ user, params, body }) => {
  if (!KINDS[params.kind]) return NEXT; need(user, 'REVISION_APPROVE'); const db = getDb(); const e = getEntity(db, params.kind, params.id);
  must(body.reason && body.reason.trim().length >= 5, 'reason', 'Bắt buộc nhập lý do');
  if (!e.isActive) throw E(409, 'ALREADY_DISABLED', 'Đã tắt trước đó');
  const before = clone(e); e.isActive = false; e.version++; audit(user, 'DISABLE', KINDS[params.kind], e.rowId, before, { ...e, reason: body.reason }); saveDb(); return { ...summarize(e), revisions: clone(e.revisions) };
});
route('GET', '/admin/:kind/:id/history', ({ user, params }) => {
  if (!KINDS[params.kind]) return NEXT; need(user, 'BUSINESS_HISTORY'); const db = getDb(); const e = getEntity(db, params.kind, params.id);
  const who = (id) => { const u = db.users.find((x) => x.rowId === id); return u ? u.fullName : null; };
  return { items: e.revisions.map((r) => ({ no: r.no, status: r.status, createdBy: who(r.createdBy), approvedBy: who(r.approvedBy), createdAt: r.createdAt, submittedAt: r.submittedAt, rejectReason: r.rejectReason })) };
});

// Đơn hàng (hỗ trợ)
const orderView = (o, db) => ({ ...o, buyerName: (db.users.find((u) => u.rowId === o.buyerRowId) || {}).fullName, recipientName: (db.users.find((u) => u.rowId === o.recipientUserRowId) || {}).fullName, isGift: o.recipientUserRowId !== o.buyerRowId });
route('GET', '/admin/orders', ({ user, query }) => {
  need(user, 'ORDER_SUPPORT_VIEW'); const db = getDb(); let l = db.orders.slice().sort((a, b) => b.rowId - a.rowId);
  if (query.status) l = l.filter((o) => o.status === query.status);
  if (query.q) l = l.filter((o) => has(o.orderId, query.q) || has((db.users.find((u) => u.rowId === o.buyerRowId) || {}).email, query.q));
  if (query.gift === 'true') l = l.filter((o) => o.recipientUserRowId !== o.buyerRowId);
  const r = page(l, query); r.items = r.items.map((o) => orderView(o, db)); return r;
});
route('GET', '/admin/orders/:id', ({ user, params }) => { need(user, 'ORDER_SUPPORT_VIEW'); const db = getDb(); return orderView(findAny(db.orders, params.id, 'Đơn'), db); });

// Người dùng & nhân sự
function targetScope(actor, target) {
  if (actor.role === 'MANAGER') return true;
  return target.role === 'BUYER';
}
route('GET', '/admin/users', ({ user, query }) => {
  need(user, 'ACCOUNT_DISABLE_SCOPE'); const db = getDb(); let l = db.users.filter((u) => user.role === 'MANAGER' || u.role === 'BUYER');
  if (query.role) l = l.filter((u) => u.role === query.role); if (query.status) l = l.filter((u) => u.status === query.status);
  if (query.q) l = l.filter((u) => has(u.email, query.q) || has(u.fullName, query.q));
  const r = page(l, query); r.items = r.items.map(pubUser); return r;
});
function activeManagers(db) { return db.users.filter((u) => u.role === 'MANAGER' && u.status === 'ACTIVE'); }
function doDisable(user, target, reason, db, source = 'WEB', requestId = null) {
  must(reason && reason.trim().length >= 5, 'reason', 'Bắt buộc nhập lý do (≥ 5 ký tự)');
  if (!targetScope(user, target)) throw E(403, 'OUT_OF_SCOPE', 'Không đủ quyền khóa vai trò ' + target.role);
  if (target.rowId === user.rowId) throw E(403, 'SELF_LOCK', 'Không được tự khóa chính mình');
  if (target.status === 'DISABLED') throw E(409, 'ALREADY_DISABLED', 'Tài khoản đã bị khóa');
  if (target.role === 'MANAGER' && activeManagers(db).length <= 1) throw E(409, 'LAST_MANAGER', 'Không thể khóa Manager cuối cùng');
  const before = clone(target); target.status = 'DISABLED'; target.disableReason = reason; target.version++;
  for (const [t, id] of Object.entries(db.sessions)) if (id === target.rowId) delete db.sessions[t];
  audit(user, 'ACCOUNT_DISABLE', 'Users', target.rowId, before, { ...target, reason }, source, requestId);
}
route('POST', '/admin/users/:id/disable', ({ user, params, body }) => {
  need(user, 'ACCOUNT_DISABLE_SCOPE'); const db = getDb(); const t = findAny(db.users, params.id, 'Tài khoản');
  doDisable(user, t, body.reason, db); saveDb(); return pubUser(t);
});
route('POST', '/admin/users/:id/enable', ({ user, params, body }) => {
  need(user, 'ACCOUNT_DISABLE_SCOPE'); const db = getDb(); const t = findAny(db.users, params.id, 'Tài khoản');
  must(body.reason && body.reason.trim().length >= 5, 'reason', 'Bắt buộc nhập lý do (≥ 5 ký tự)');
  if (!targetScope(user, t)) throw E(403, 'OUT_OF_SCOPE', 'Không đủ quyền mở khóa vai trò ' + t.role);
  if (t.status === 'ACTIVE') throw E(409, 'ALREADY_ACTIVE', 'Tài khoản đang hoạt động');
  const before = clone(t); t.status = 'ACTIVE'; t.disableReason = ''; t.version++; audit(user, 'ACCOUNT_ENABLE', 'Users', t.rowId, before, { ...t, reason: body.reason }); saveDb(); return pubUser(t);
});
route('POST', '/admin/staff', ({ user, body }) => {
  need(user, 'STAFF_MANAGE'); const db = getDb();
  must(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email || ''), 'email', 'Email không hợp lệ'); must(body.fullName && body.fullName.trim(), 'fullName', 'Họ tên bắt buộc');
  must(['EMPLOYEE', 'MANAGER'].includes(body.role), 'role', 'Vai trò không hợp lệ'); must((body.password || '').length >= 8, 'password', 'Mật khẩu tối thiểu 8 ký tự');
  if (db.users.some((u) => u.email.toLowerCase() === body.email.trim().toLowerCase())) throw E(409, 'DUPLICATE_EMAIL', 'Email đã tồn tại', { field: 'email' });
  const u = { rowId: nextId(), email: body.email.trim(), fullName: body.fullName.trim(), role: body.role, status: 'ACTIVE', password: body.password, version: 1, createdAt: now() };
  db.users.push(u); audit(user, 'STAFF_CREATE', 'Users', u.rowId, null, u); saveDb(); return created(pubUser(u));
});
route('PATCH', '/admin/staff/:id', ({ user, params, body, ifMatch }) => {
  need(user, 'STAFF_MANAGE'); const db = getDb(); const u = findAny(db.users, params.id, 'Nhân sự');
  if (u.role === 'BUYER') throw E(422, 'VALIDATION_ERROR', 'Không phải tài khoản nhân sự');
  checkVersion(u, ifMatch); const before = clone(u);
  if (body.role && body.role !== u.role) {
    must(['EMPLOYEE', 'MANAGER'].includes(body.role), 'role', 'Vai trò không hợp lệ');
    if (u.rowId === user.rowId) throw E(403, 'SELF_CHANGE', 'Không được tự đổi vai trò của mình');
    if (u.role === 'MANAGER' && u.status === 'ACTIVE' && activeManagers(db).length <= 1) throw E(409, 'LAST_MANAGER', 'Không thể hạ vai trò Manager cuối cùng');
    u.role = body.role;
  }
  if (body.fullName) u.fullName = body.fullName.trim();
  if (body.password) { must(body.password.length >= 8, 'password', 'Mật khẩu tối thiểu 8 ký tự'); u.password = body.password; }
  u.version++; audit(user, 'STAFF_UPDATE', 'Users', u.rowId, before, u); saveDb(); return pubUser(u);
});

// Complaints
const buyerName = (db, id) => (db.users.find((u) => u.rowId === id) || {}).fullName;
route('GET', '/admin/complaints', ({ user, query }) => {
  need(user, 'SUPPORT_HANDLE'); const db = getDb(); let l = db.complaints.slice().sort((a, b) => b.rowId - a.rowId);
  if (query.status) l = l.filter((c) => c.status === query.status); if (query.q) l = l.filter((c) => has(c.code, query.q) || has(c.subject, query.q));
  const r = page(l, query); r.items = r.items.map((c) => ({ rowId: c.rowId, code: c.code, subject: c.subject, status: c.status, buyerName: buyerName(db, c.buyerRowId), orderRowId: c.orderRowId, createdAt: c.createdAt, messageCount: c.messages.length })); return r;
});
route('GET', '/admin/complaints/:id', ({ user, params }) => { need(user, 'SUPPORT_HANDLE'); const db = getDb(); const c = findAny(db.complaints, params.id, 'Complaint'); return { ...clone(c), buyerName: buyerName(db, c.buyerRowId) }; });
const FLOW = { OPEN: ['IN_PROGRESS'], IN_PROGRESS: ['RESOLVED'], RESOLVED: ['CLOSED', 'IN_PROGRESS'], CLOSED: [] };
route('PATCH', '/admin/complaints/:id', ({ user, params, body }) => {
  need(user, 'SUPPORT_HANDLE'); const db = getDb(); const c = findAny(db.complaints, params.id, 'Complaint');
  if (c.status === 'CLOSED') throw E(409, 'COMPLAINT_CLOSED', 'Complaint đã đóng, không thể thay đổi');
  must(FLOW[c.status].includes(body.status), 'status', 'Không thể chuyển ' + c.status + ' → ' + body.status);
  const before = clone(c); c.status = body.status; audit(user, 'COMPLAINT_STATUS', 'Complaints', c.rowId, before, c); saveDb(); return clone(c);
});
route('POST', '/complaints/:id/messages', ({ user, params, body }) => {
  need(user, 'SUPPORT_HANDLE'); const db = getDb(); const c = findAny(db.complaints, params.id, 'Complaint');
  if (c.status === 'CLOSED') throw E(409, 'COMPLAINT_CLOSED', 'Complaint đã đóng, không thể phản hồi');
  must(body.body && body.body.trim(), 'body', 'Nội dung bắt buộc'); must(body.body.length <= 2000, 'body', 'Tối đa 2000 ký tự');
  if (body.fileName) must(/\.(png|jpe?g|pdf)$/i.test(body.fileName), 'fileName', 'Chỉ nhận png/jpg/pdf');
  const m = { rowId: nextId(), from: 'STAFF', body: body.body.trim(), internal: !!body.internal, at: now(), fileName: body.fileName || null };
  c.messages.push(m); audit(user, 'COMPLAINT_REPLY', 'Complaints', c.rowId, null, { messageRowId: m.rowId, internal: m.internal }); saveDb(); return created(m);
});

// Content reports
route('GET', '/admin/content-reports', ({ user, query }) => {
  need(user, 'CONTENT_MODERATE'); const db = getDb(); let l = db.contentReports.slice().sort((a, b) => b.rowId - a.rowId); if (query.status) l = l.filter((r) => r.status === query.status);
  const r = page(l, query); r.items = r.items.map((x) => ({ ...x, reporterName: buyerName(db, x.reporterRowId),
    targetLabel: x.targetType === 'REVIEW' ? (() => { const rv = db.reviews.find((y) => y.rowId === x.targetRowId); const b = rv && db.books.find((y) => y.rowId === rv.bookRowId); return rv ? `Review #${rv.rowId} (${b ? b.title : ''}): "${rv.content}"` : '(không còn)'; })()
      : (() => { const b = db.books.find((y) => y.rowId === x.targetRowId); return b ? 'Sách: ' + b.title : '(không còn)'; })() })); return r;
});
route('POST', '/admin/content-reports/:id', ({ user, params, body }) => {
  need(user, 'CONTENT_MODERATE'); const db = getDb(); const r = findAny(db.contentReports, params.id, 'Báo cáo');
  must(['ACCEPT', 'REJECT'].includes(body.decision), 'decision', 'Quyết định không hợp lệ'); must(body.note && body.note.trim().length >= 3, 'note', 'Nhập ghi chú xử lý');
  if (r.status !== 'PENDING') throw E(409, 'ALREADY_PROCESSED', 'Báo cáo đã được xử lý');
  const before = clone(r); r.status = body.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED'; r.note = body.note;
  if (body.decision === 'ACCEPT' && r.targetType === 'REVIEW') { const rv = db.reviews.find((x) => x.rowId === r.targetRowId); if (rv) { audit(user, 'REVIEW_HIDE', 'Reviews', rv.rowId, rv, { ...rv, status: 'HIDDEN' }); rv.status = 'HIDDEN'; } }
  audit(user, 'CONTENT_REPORT_' + r.status, 'ContentReports', r.rowId, before, r); saveDb(); return r;
});

// Audit & lịch sử
route('GET', '/admin/audit-logs', ({ user, query }) => {
  need(user, 'AUDIT_GLOBAL'); const db = getDb(); let l = db.auditLogs;
  if (query.actor) l = l.filter((a) => String(a.actorUserRowId) === String(query.actor)); if (query.table) l = l.filter((a) => a.tableName === query.table);
  if (query.action) l = l.filter((a) => has(a.actionCode, query.action)); if (query.source) l = l.filter((a) => a.actionSource === query.source);
  audit(user, 'AUDIT_VIEW', null, null, null, { filters: query }); saveDb();
  const r = page(l, query); r.items = r.items.map((a) => ({ ...a, actorName: (db.users.find((u) => u.rowId === a.actorUserRowId) || {}).fullName || (a.actorType === 'SYSTEM' ? 'SYSTEM' : null) })); return r;
});
route('GET', '/admin/history/:table/:id', ({ user, params }) => {
  need(user, 'BUSINESS_HISTORY'); const db = getDb();
  const ALLOWED_EMP = ['Books', 'Orders', 'Complaints', 'Bundles', 'Events', 'Coupons', 'ContentReports'];
  if (user.role !== 'MANAGER' && !ALLOWED_EMP.includes(params.table)) throw E(403, 'FORBIDDEN', 'Không có quyền xem lịch sử bảng này');
  const l = db.auditLogs.filter((a) => a.tableName === params.table && String(a.recordRowId) === String(params.id));
  return { items: l.map((a) => ({ ...a, actorName: (db.users.find((u) => u.rowId === a.actorUserRowId) || {}).fullName })) };
});

// Báo cáo
route('GET', '/admin/reports/operational', ({ user }) => {
  need(user, 'REPORT_OPERATIONAL'); const db = getDb(); const by = {}; db.orders.forEach((o) => { by[o.status] = (by[o.status] || 0) + 1; });
  return { ordersByStatus: by, totalOrders: db.orders.length, newBuyers: db.users.filter((u) => u.role === 'BUYER').length, openComplaints: db.complaints.filter((c) => c.status !== 'CLOSED' && c.status !== 'RESOLVED').length,
    pendingRevisions: ['bundles', 'events', 'coupons'].reduce((s, k) => s + db[k].filter((e) => e.revisions.some((r) => r.status === 'PENDING')).length, 0), pendingContentReports: db.contentReports.filter((r) => r.status === 'PENDING').length,
    suspendedBooks: db.books.filter((b) => !b.isDel && b.servingStatus === 'SUSPENDED').length };
});
route('GET', '/admin/reports/financial', ({ user }) => {
  need(user, 'REPORT_FINANCIAL'); const db = getDb(); const paid = db.orders.filter((o) => o.status === 'PAID');
  const byType = { BOOK: 0, BUNDLE: 0 }; paid.forEach((o) => o.items.forEach((i) => { byType[i.type] = (byType[i.type] || 0) + i.price; }));
  const disc = { NONE: 0, COUPON: 0, EVENT: 0 }; paid.forEach((o) => { disc[o.discountSource] = (disc[o.discountSource] || 0) + o.discount; });
  const daily = {}; paid.forEach((o) => { const d = o.paidAt.slice(0, 10); daily[d] = (daily[d] || 0) + o.total; });
  const top = {}; paid.forEach((o) => o.items.forEach((i) => { top[i.name] = (top[i.name] || 0) + 1; }));
  audit(user, 'REPORT_VIEW', null, null, null, { report: 'financial' }); saveDb();
  return { revenue: paid.reduce((s, o) => s + o.total, 0), paidOrders: paid.length, freeOrders: paid.filter((o) => o.total === 0).length, grossBeforeDiscount: paid.reduce((s, o) => s + o.subtotal, 0),
    byType, discountBySource: disc, daily: Object.entries(daily).sort().map(([date, amount]) => ({ date, amount })), topItems: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty })) };
});

// Knowledge articles
route('GET', '/admin/knowledge-articles', ({ user, query }) => {
  need(user, 'KNOWLEDGE_MANAGE'); const db = getDb(); let l = db.knowledge.slice(); if (query.status) l = l.filter((k) => k.status === query.status); if (query.q) l = l.filter((k) => has(k.title, query.q) || has(k.body, query.q)); return page(l, query);
});
function validKA(b) { must(b.title && b.title.trim(), 'title', 'Tiêu đề bắt buộc'); must(b.body && b.body.trim().length >= 10, 'body', 'Nội dung tối thiểu 10 ký tự'); must(['DRAFT', 'PUBLISHED'].includes(b.status || 'DRAFT'), 'status', 'Trạng thái không hợp lệ'); }
route('POST', '/admin/knowledge-articles', ({ user, body }) => {
  need(user, 'KNOWLEDGE_MANAGE'); const db = getDb(); validKA(body);
  const k = { rowId: nextId(), title: body.title.trim(), body: body.body.trim(), status: body.status || 'DRAFT', keywords: (body.keywords || []).map((s) => s.trim()).filter(Boolean), version: 1 };
  db.knowledge.unshift(k); audit(user, 'KNOWLEDGE_CREATE', 'KnowledgeArticles', k.rowId, null, k); saveDb(); return created(k);
});
route('PATCH', '/admin/knowledge-articles/:id', ({ user, params, body, ifMatch }) => {
  need(user, 'KNOWLEDGE_MANAGE'); const db = getDb(); const k = findAny(db.knowledge, params.id, 'Bài tri thức'); checkVersion(k, ifMatch); validKA({ ...k, ...body });
  const before = clone(k); Object.assign(k, { title: (body.title ?? k.title).trim(), body: (body.body ?? k.body).trim(), status: body.status ?? k.status, keywords: body.keywords ?? k.keywords }); k.version++;
  audit(user, 'KNOWLEDGE_UPDATE', 'KnowledgeArticles', k.rowId, before, k); saveDb(); return k;
});

// Settings
route('GET', '/admin/settings', ({ user }) => { need(user, 'SETTINGS_MANAGE'); const db = getDb(); return { items: db.settings.map((s) => ({ ...s, value: s.sensitive ? '******' : s.value })) }; });
route('PATCH', '/admin/settings/:key', ({ user, params, body, ifMatch }) => {
  need(user, 'SETTINGS_MANAGE'); const db = getDb(); const s = db.settings.find((x) => x.key === params.key); if (!s) throw E(404, 'NOT_FOUND', 'Không có cấu hình này'); checkVersion(s, ifMatch);
  must(String(body.value ?? '').trim() !== '', 'value', 'Giá trị bắt buộc');
  if (/_MINUTES$|_HOURS$|_EDIT$/.test(s.key)) must(/^\d+$/.test(String(body.value)) && Number(body.value) > 0, 'value', 'Phải là số nguyên dương');
  const before = clone(s); s.value = String(body.value); s.version++; audit(user, 'SETTING_UPDATE', 'SystemSettings', s.key, before, s, 'WEB', null, s.sensitive ? ['value'] : []); saveDb();
  return { ...s, value: s.sensitive ? '******' : s.value };
});

// AI Admin (mô phỏng: có xem trước, xác nhận một lần, ghi AIActionLogs/Audit cùng RequestId)
route('POST', '/ai/admin/chat', ({ user, body }) => {
  need(user, 'AI_ADMIN_USE'); const db = getDb(); const msg = String(body.message || '').trim(); must(msg, 'message', 'Nhập câu hỏi');
  const low = msg.toLowerCase();
  const m = low.match(/(?:khóa|khoá)\s+(?:tài khoản\s+)?([^\s@]+@[^\s@]+\.[^\s@]+)/);
  if (m) {
    const t = db.users.find((u) => u.email.toLowerCase() === m[1]);
    if (!t) return { type: 'ANSWER', text: 'Không tìm thấy tài khoản ' + m[1] + '.' };
    if (!targetScope(user, t)) return { type: 'ANSWER', text: 'Bạn không đủ quyền khóa vai trò ' + t.role + '. Mình không thực hiện.' };
    const req = { requestId: 'AI-' + nextId(), token: 'ct-' + Math.random().toString(36).slice(2), userRowId: user.rowId, action: 'DISABLE_USER', targetRowId: t.rowId, targetVersion: t.version, status: 'PENDING', expiresAt: new Date(Date.now() + 5 * 60000).toISOString(), summary: `Khóa tài khoản ${t.email} (${t.role})` };
    db.aiRequests.push(req); saveDb();
    return { type: 'PREVIEW', text: 'Mình sẽ thực hiện thao tác sau, cần bạn xác nhận:', requestId: req.requestId, confirmToken: req.token, summary: req.summary, expiresAt: req.expiresAt };
  }
  if (/doanh thu|tài chính/.test(low)) {
    if (!permsOf(user.role).includes('REPORT_FINANCIAL')) return { type: 'ANSWER', text: 'Bạn không có quyền xem báo cáo tài chính.' };
    const paid = db.orders.filter((o) => o.status === 'PAID'); return { type: 'ANSWER', text: `Doanh thu từ ${paid.length} đơn PAID: ${paid.reduce((s, o) => s + o.total, 0).toLocaleString('vi-VN')}đ.` };
  }
  if (/đơn/.test(low) && /(bao nhiêu|số lượng|thống kê)/.test(low)) { const by = {}; db.orders.forEach((o) => { by[o.status] = (by[o.status] || 0) + 1; }); return { type: 'ANSWER', text: 'Số đơn theo trạng thái: ' + Object.entries(by).map(([k, v]) => `${k}=${v}`).join(', ') + '.' }; }
  const hits = db.knowledge.filter((k) => k.status === 'PUBLISHED' && (k.keywords.some((w) => low.includes(w.toLowerCase())) || low.split(/\s+/).some((w) => w.length > 4 && has(k.title + ' ' + k.body, w))));
  if (hits.length) return { type: 'ANSWER', text: hits.slice(0, 2).map((k) => `• ${k.title}: ${k.body}`).join('\n'), sources: hits.slice(0, 2).map((k) => k.title) };
  return { type: 'ANSWER', text: 'Mình chưa có tài liệu đã công bố phù hợp. Bạn có thể hỏi về thanh toán, complaint, Event, hoặc nhờ "khóa tài khoản <email>".' };
});
route('POST', '/ai/admin/actions/:id/confirm', ({ user, params, body }) => {
  need(user, 'AI_ADMIN_USE'); const db = getDb(); const r = db.aiRequests.find((x) => x.requestId === params.id && x.userRowId === user.rowId); if (!r) throw E(404, 'NOT_FOUND', 'Yêu cầu không tồn tại');
  if (r.status !== 'PENDING') throw E(409, 'REQUEST_USED', 'Yêu cầu đã được dùng hoặc đã bị từ chối');
  if (new Date(r.expiresAt) < new Date()) { r.status = 'EXPIRED'; saveDb(); throw E(410, 'REQUEST_EXPIRED', 'Xác nhận đã hết hạn'); }
  if (body.confirmToken !== r.token) throw E(422, 'INVALID_TOKEN', 'Token xác nhận không hợp lệ');
  const t = findAny(db.users, r.targetRowId, 'Tài khoản'); if (t.version !== r.targetVersion) { r.status = 'INVALIDATED'; saveDb(); throw E(409, 'STALE_REQUEST', 'Dữ liệu đã thay đổi sau khi xem trước, hãy yêu cầu lại'); }
  r.status = 'EXECUTED'; doDisable(user, t, 'Khóa qua AI Admin (đã xác nhận)', db, 'AI', r.requestId); saveDb(); return { type: 'ANSWER', text: 'Đã thực hiện: ' + r.summary + '.', requestId: r.requestId };
});
route('POST', '/ai/admin/actions/:id/decline', ({ user, params }) => {
  need(user, 'AI_ADMIN_USE'); const db = getDb(); const r = db.aiRequests.find((x) => x.requestId === params.id && x.userRowId === user.rowId); if (!r) throw E(404, 'NOT_FOUND', 'Yêu cầu không tồn tại');
  if (r.status === 'PENDING') r.status = 'DECLINED'; saveDb(); return { type: 'ANSWER', text: 'Đã hủy, không có thay đổi nào.' };
});
route('POST', '/__mock/reset', () => { resetDb(); return { ok: true }; }, { public: true });

// ---------- Điểm vào ----------
export async function handle({ method, path, query = {}, body = {}, token, ifMatch }) {
  await new Promise((r) => setTimeout(r, (window.__MOCK_LATENCY ?? 120)));
  try {
    const user = token ? sessionUser(token) : null;
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path); if (!m) continue;
      if (!r.public && !user) throw E(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn');
      const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const out = await r.handler({ user, params, query, body: body || {}, token, ifMatch });
      if (out === NEXT) continue;
      if (out && out.__http) return { status: out.__http, data: clone(out.__body) };
      return { status: 200, data: clone(out) };
    }
    throw E(404, 'NOT_FOUND', 'Không có endpoint: ' + method + ' ' + path);
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, error: { errorCode: e.errorCode, message: e.message, details: e.details || null, requestId: 'req-' + Math.random().toString(36).slice(2, 8) } };
    console.error(e); return { status: 500, error: { errorCode: 'INTERNAL', message: 'Lỗi hệ thống (mock): ' + e.message } };
  }
}

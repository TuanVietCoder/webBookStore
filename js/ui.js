// Tiện ích giao diện: dựng DOM an toàn (không dùng innerHTML với dữ liệu), modal, toast, form, bảng.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') value = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['checked', 'disabled', 'selected', 'readOnly'].includes(k)) el[k] = true;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  if (value !== undefined) el.value = value;
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export const money = (n) => (n == null ? '' : new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ');
export const dt = (s) => (s ? new Date(s).toLocaleString('vi-VN', { hour12: false }) : '');
export const dOnly = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '');
export const toLocalInput = (s) => { if (!s) return ''; const d = new Date(s); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const fromLocalInput = (s) => (s ? new Date(s).toISOString() : '');
export const bytes = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');

const STATUS_VI = {
  ACTIVE: 'Hoạt động', DISABLED: 'Đã khóa/tắt', DRAFT: 'Nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', PUBLISHED: 'Đang bán', HIDDEN: 'Ẩn',
  SUSPENDED: 'Đình chỉ phục vụ', PAID: 'Đã thanh toán', PENDING_PAYMENT: 'Chờ thanh toán', PAYMENT_FAILED: 'Thanh toán thất bại', CANCELLED: 'Đã hủy',
  OPEN: 'Mới', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã giải quyết', CLOSED: 'Đã đóng', ACCEPTED: 'Chấp nhận', VISIBLE: 'Hiển thị', SUCCEEDED: 'Thành công', FAILED: 'Thất bại',
};
const TONE = { ACTIVE: 'ok', APPROVED: 'ok', PUBLISHED: 'ok', PAID: 'ok', RESOLVED: 'ok', ACCEPTED: 'ok', VISIBLE: 'ok', SUCCEEDED: 'ok',
  PENDING: 'warn', PENDING_PAYMENT: 'warn', OPEN: 'warn', IN_PROGRESS: 'info', DRAFT: 'muted', HIDDEN: 'muted', CLOSED: 'muted', CANCELLED: 'muted',
  DISABLED: 'bad', REJECTED: 'bad', SUSPENDED: 'bad', PAYMENT_FAILED: 'bad', FAILED: 'bad' };
export const label = (s) => STATUS_VI[s] || s;
export const badge = (s, text) => h('span', { class: 'badge ' + (TONE[s] || 'muted') }, text || label(s));

// Toast
export function toast(msg, type = 'info') {
  let box = $('#toasts'); if (!box) { box = h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + type }, msg); box.append(t); setTimeout(() => t.remove(), type === 'error' ? 6000 : 3200);
}

// Modal
export function modal(title, body, { actions = [], wide = false, onClose } = {}) {
  const prev = document.activeElement;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); if (onClose) onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const foot = h('div', { class: 'modal-foot' }, actions.map((a) => h('button', { class: 'btn ' + (a.kind || ''), type: 'button', onClick: async (e) => { const b = e.currentTarget; b.disabled = true; try { const r = await a.onClick(close); if (r !== false && a.close !== false) close(); } finally { b.disabled = false; } } }, a.label)));
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('h3', null, title), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', onClick: close }, '×')),
    h('div', { class: 'modal-body' }, body), actions.length ? foot : null);
  const overlay = h('div', { class: 'overlay' }, box);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey); document.body.append(overlay);
  const first = box.querySelector('input,select,textarea,button.btn'); if (first) first.focus();
  return close;
}
export function confirmDialog(message, { okLabel = 'Xác nhận', kind = 'primary' } = {}) {
  return new Promise((resolve) => { let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
    modal('Xác nhận', h('p', null, message), { onClose: () => fin(false), actions: [{ label: 'Hủy', onClick: () => { fin(false); } }, { label: okLabel, kind, onClick: () => { fin(true); } }] }); });
}
export function reasonDialog(title, { label: lbl = 'Lý do', okLabel = 'Xác nhận', kind = 'danger', min = 5 } = {}) {
  return new Promise((resolve) => {
    let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const ta = h('textarea', { rows: 3, placeholder: 'Tối thiểu ' + min + ' ký tự' }); const err = h('div', { class: 'field-err' });
    modal(title, h('div', { class: 'field' }, h('label', null, lbl), ta, err), { onClose: () => fin(null), actions: [
      { label: 'Hủy', onClick: () => { fin(null); } },
      { label: okLabel, kind, onClick: () => { const v = ta.value.trim(); if (v.length < min) { err.textContent = 'Cần tối thiểu ' + min + ' ký tự'; return false; } fin(v); } }] });
  });
}

// Form động
export function buildForm(fields, values = {}, ctx = {}) {
  const inputs = {}; const errs = {};
  const rows = fields.map((f) => {
    let input; const v = values[f.name] ?? f.default ?? '';
    if (f.type === 'textarea') input = h('textarea', { rows: f.rows || 3, value: v });
    else if (f.type === 'select') input = h('select', { value: v }, (f.options || []).map((o) => h('option', { value: o.value, selected: String(o.value) === String(v) }, o.label)));
    else if (f.type === 'checkbox') input = h('input', { type: 'checkbox', checked: !!v });
    else if (f.type === 'datetime') input = h('input', { type: 'datetime-local', value: toLocalInput(v) });
    else if (f.type === 'bookpicker') input = bookPicker(ctx.books || [], v || []);
    else if (f.type === 'discounts') input = discountEditor(ctx.books || [], v || []);
    else if (f.type === 'multiselect') input = h('select', { multiple: true, size: Math.min(6, (f.options || []).length) }, (f.options || []).map((o) => h('option', { value: o.value, selected: (v || []).map(Number).includes(Number(o.value)) }, o.label)));
    else input = h('input', { type: f.type || 'text', value: v, placeholder: f.placeholder || '', min: f.min, step: f.step, maxlength: f.maxlength, readOnly: f.readOnly, autocomplete: 'off' });
    if (f.readOnly && input.tagName !== 'DIV') input.setAttribute('readonly', ''); if (f.disabled) input.disabled = true;
    const err = h('div', { class: 'field-err', role: 'alert' }); inputs[f.name] = input; errs[f.name] = err;
    const id = 'f_' + f.name + '_' + Math.random().toString(36).slice(2, 6); if (input.setAttribute && input.tagName !== 'DIV') input.id = id;
    return h('div', { class: 'field' + (f.half ? ' half' : '') }, h('label', { for: id }, f.label, f.required ? h('span', { class: 'req' }, ' *') : null), input, f.help ? h('div', { class: 'help' }, f.help) : null, err);
  });
  const el = h('form', { class: 'form', onSubmit: (e) => e.preventDefault() }, rows);
  const get = () => {
    const out = {};
    for (const f of fields) {
      const i = inputs[f.name];
      if (f.type === 'checkbox') out[f.name] = i.checked;
      else if (f.type === 'number') out[f.name] = i.value === '' ? null : Number(i.value);
      else if (f.type === 'datetime') out[f.name] = fromLocalInput(i.value);
      else if (f.type === 'bookpicker' || f.type === 'discounts') out[f.name] = i.getValue();
      else if (f.type === 'multiselect') out[f.name] = [...i.selectedOptions].map((o) => Number(o.value));
      else if (f.type === 'tags') out[f.name] = i.value.split(',').map((s) => s.trim()).filter(Boolean);
      else out[f.name] = typeof i.value === 'string' && f.type !== 'password' ? i.value.trim() : i.value;
    }
    return out;
  };
  const showErrors = (e) => {
    Object.values(errs).forEach((x) => { x.textContent = ''; });
    const field = e && e.details && e.details.field;
    if (field && errs[field]) { errs[field].textContent = e.message; const i = inputs[field]; if (i && i.focus) i.focus(); return true; }
    return false;
  };
  return { el, get, showErrors };
}
function bookPicker(books, selected) {
  const sel = new Set(selected.map(Number)); const q = h('input', { type: 'search', placeholder: 'Lọc sách...' }); const list = h('div', { class: 'picker-list' }); const count = h('span', { class: 'help' });
  const draw = () => { clear(list); books.filter((b) => !q.value || b.title.toLowerCase().includes(q.value.toLowerCase())).forEach((b) => list.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: sel.has(b.rowId), onChange: (e) => { e.target.checked ? sel.add(b.rowId) : sel.delete(b.rowId); count.textContent = 'Đã chọn ' + sel.size + ' sách'; } }), ' ' + b.title + ' · ' + money(b.price)))); count.textContent = 'Đã chọn ' + sel.size + ' sách'; };
  q.addEventListener('input', draw); draw();
  const box = h('div', { class: 'picker' }, q, list, count); box.getValue = () => [...sel]; return box;
}
function discountEditor(books, initial) {
  const rows = h('div'); const items = initial.map((x) => ({ ...x }));
  const draw = () => { clear(rows); items.forEach((it, idx) => { const b = books.find((x) => x.rowId === it.bookId);
    rows.append(h('div', { class: 'disc-row' }, h('select', { onChange: (e) => { it.bookId = Number(e.target.value); draw(); } }, books.map((x) => h('option', { value: x.rowId, selected: x.rowId === it.bookId }, x.title))),
      h('span', { class: 'help' }, 'Giá gốc ' + (b ? money(b.price) : '')), h('input', { type: 'number', min: 1, value: it.salePrice, placeholder: 'Giá sale', 'aria-label': 'Giá sale', onInput: (e) => { it.salePrice = Number(e.target.value); } }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Xóa dòng', onClick: () => { items.splice(idx, 1); draw(); } }, '×'))); });
    rows.append(h('button', { type: 'button', class: 'btn small', onClick: () => { const used = new Set(items.map((i) => i.bookId)); const nb = books.find((b) => !used.has(b.rowId)); if (nb) { items.push({ bookId: nb.rowId, salePrice: Math.round(nb.price * 0.8) }); draw(); } } }, '+ Thêm sách giảm giá')); };
  draw(); const box = h('div', { class: 'picker' }, rows); box.getValue = () => items.map((i) => ({ bookId: i.bookId, salePrice: Number(i.salePrice) })); return box;
}

// Bảng
export function table(cols, rows, { empty = 'Không có dữ liệu', onRow } = {}) {
  if (!rows.length) return h('div', { class: 'empty' }, empty);
  return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
    h('thead', null, h('tr', null, cols.map((c) => h('th', { scope: 'col', class: c.class || '' }, c.label)))),
    h('tbody', null, rows.map((r) => h('tr', { class: onRow ? 'clickable' : '', onClick: onRow ? () => onRow(r) : null }, cols.map((c) => h('td', { class: c.class || '', 'data-label': c.label }, c.render ? c.render(r) : r[c.key] ?? '')))))));
}
export function pager(p, go) {
  const pages = Math.max(1, Math.ceil(p.total / p.pageSize));
  return h('div', { class: 'pager' }, h('span', null, `${p.total} bản ghi · Trang ${p.page}/${pages}`),
    h('button', { class: 'btn small', disabled: p.page <= 1, onClick: () => go(p.page - 1) }, '‹ Trước'), h('button', { class: 'btn small', disabled: p.page >= pages, onClick: () => go(p.page + 1) }, 'Sau ›'));
}
export function filters(defs, state, onChange) {
  const bar = h('div', { class: 'filters' });
  defs.forEach((d) => {
    let el; const apply = () => { state[d.name] = el.value; state.page = 1; onChange(); };
    if (d.type === 'select') el = h('select', { 'aria-label': d.label, value: state[d.name] || '', onChange: apply }, [h('option', { value: '' }, d.label + ': tất cả')].concat(d.options.map((o) => h('option', { value: o.value }, o.label))));
    else { el = h('input', { type: 'search', placeholder: d.label, 'aria-label': d.label, value: state[d.name] || '' }); let t; el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 300); }); }
    bar.append(el);
  });
  return bar;
}
export const loading = () => h('div', { class: 'loading', role: 'status' }, 'Đang tải...');
export function errorBox(e, retry) { return h('div', { class: 'error-box', role: 'alert' }, h('strong', null, e.status === 403 ? 'Bạn không có quyền xem mục này' : 'Có lỗi xảy ra'), h('p', null, e.message + (e.requestId ? ' (mã: ' + e.requestId + ')' : '')), retry ? h('button', { class: 'btn', onClick: retry }, 'Thử lại') : null); }
export function pageHead(title, ...actions) { return h('div', { class: 'page-head' }, h('h2', null, title), h('div', { class: 'actions' }, actions)); }
export function kv(pairs) { return h('dl', { class: 'kv' }, pairs.filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v ?? '—')])); }
export async function guard(fn, form) {
  try { return await fn(); } catch (e) {
    if (form && form.showErrors && form.showErrors(e)) return undefined;
    toast(e.message || 'Có lỗi xảy ra', 'error'); return undefined;
  }
}

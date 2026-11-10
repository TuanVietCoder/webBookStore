// Bundle / Event / Coupon dùng chung quy trình revision: DRAFT → PENDING → APPROVED/REJECTED.
import { api } from '../api.js';
import { h, clear, table, pager, filters, modal, buildForm, guard, toast, badge, money, dt, kv, reasonDialog, confirmDialog, loading, errorBox, pageHead, label } from '../ui.js';

const TITLES = { bundles: 'Bundle', events: 'Event', coupons: 'Coupon' };

export async function render(root, { can, kind }) {
  const state = { page: 1, pageSize: 10, q: '', status: '' };
  const books = (await api.get('/admin/books', { pageSize: 100, status: 'PUBLISHED' })).items;
  const listBox = h('div');
  const bar = filters([{ name: 'q', label: 'Tìm theo mã/tên' }, { name: 'status', label: 'Trạng thái', type: 'select', options: ['DRAFT', 'PENDING', 'APPROVED', 'DISABLED'].map((v) => ({ value: v, label: label(v) })) }], state, load);
  root.append(pageHead(TITLES[kind], h('button', { class: 'btn primary', onClick: createNew }, '+ Tạo ' + TITLES[kind])), bar, listBox);

  const describe = (d) => kind === 'bundles' ? `${d.type === 'FIXED' ? 'Cố định' : 'Linh hoạt (chọn ' + d.pickCount + '/' + d.bookIds.length + ')'} · ${money(d.price)} · ${d.bookIds.length} sách`
    : kind === 'events' ? `${dt(d.startAt)} → ${dt(d.endAt)} · ${(d.bookDiscounts || []).length} sách giảm` : `${d.type === 'PERCENT' ? d.value + '%' : money(d.value)} · tối thiểu ${money(d.minSpend || 0)} · quota ${d.quota || 'không giới hạn'} · ${dt(d.endAt)}`;

  async function load() {
    clear(listBox).append(loading());
    try {
      const p = await api.get('/admin/' + kind, state); clear(listBox);
      listBox.append(table([{ label: 'Mã', key: 'code' }, { label: 'Tên / nội dung', render: (e) => h('div', null, h('strong', null, e.title), h('div', { class: 'help' }, describe(e.data))) },
        { label: 'Trạng thái', render: (e) => h('span', null, badge(e.status), e.hasPending && e.status === 'APPROVED' ? h('span', null, ' ', badge('PENDING', 'Có bản chờ duyệt')) : null, e.scheduledRevNo ? h('span', null, ' ', badge('INFO', 'Có lịch bàn giao')) : null) },
        { label: 'Số revision', key: 'revisionCount', class: 'num' }], p.items, { onRow: (e) => detail(e.rowId), empty: 'Chưa có dữ liệu' }), pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(listBox).append(errorBox(e, load)); }
  }

  function fields(isNew, entity) {
    if (kind === 'bundles') return [
      isNew ? { name: 'code', label: 'Mã Bundle', required: true, placeholder: 'BDL-TET-01' } : null, { name: 'name', label: 'Tên Bundle', required: true },
      { name: 'type', label: 'Loại', type: 'select', options: [{ value: 'FIXED', label: 'Cố định (mua trọn bộ)' }, { value: 'FLEXIBLE', label: 'Linh hoạt (chọn N sách)' }] },
      { name: 'price', label: 'Giá Bundle (đ) — cố định, không đổi theo Event/Coupon', type: 'number', min: 1000, step: 1000, required: true },
      { name: 'pickCount', label: 'Số sách được chọn (chỉ Linh hoạt)', type: 'number', min: 1 }, { name: 'bookIds', label: 'Sách trong Bundle (≥ 2)', type: 'bookpicker' }].filter(Boolean);
    if (kind === 'events') return [
      isNew ? { name: 'code', label: 'Mã Event', required: true, placeholder: 'TET_SALE_2027' } : null, { name: 'name', label: 'Tên Event', required: true },
      { name: 'type', label: 'Loại', type: 'select', options: [{ value: 'BOOK_SALE', label: 'Book Sale' }, { value: 'TET_SALE', label: 'Tết Sale' }] },
      { name: 'startAt', label: 'Bắt đầu', type: 'datetime', half: true, required: true }, { name: 'endAt', label: 'Kết thúc', type: 'datetime', half: true, required: true },
      { name: 'bookDiscounts', label: 'Sách giảm giá (giá sale phải thấp hơn giá gốc)', type: 'discounts' }].filter(Boolean);
    return [
      isNew ? { name: 'code', label: 'Mã Coupon', required: true, placeholder: 'SALE10' } : { name: 'code', label: 'Mã Coupon', readOnly: true },
      { name: 'type', label: 'Loại giảm', type: 'select', options: [{ value: 'PERCENT', label: 'Phần trăm' }, { value: 'FIXED', label: 'Số tiền cố định' }] },
      { name: 'value', label: 'Giá trị (% hoặc đ)', type: 'number', min: 1, required: true, half: true }, { name: 'capAmount', label: 'Trần giảm (đ, 0 = không)', type: 'number', min: 0, half: true },
      { name: 'minSpend', label: 'Chi tối thiểu (đ)', type: 'number', min: 0, half: true }, { name: 'quota', label: 'Tổng lượt (0 = không giới hạn)', type: 'number', min: 0, half: true },
      { name: 'perBuyerLimit', label: 'Giới hạn mỗi Buyer', type: 'number', min: 1, half: true },
      { name: 'startAt', label: 'Bắt đầu', type: 'datetime', half: true, required: true }, { name: 'endAt', label: 'Kết thúc', type: 'datetime', half: true, required: true }];
  }
  const defaults = () => ({ bundles: { type: 'FIXED', pickCount: 2, bookIds: [] }, events: { type: 'BOOK_SALE', bookDiscounts: [] }, coupons: { type: 'PERCENT', value: 10, minSpend: 0, quota: 0, capAmount: 0, startAt: new Date().toISOString(), endAt: new Date(Date.now() + 30 * 864e5).toISOString() } })[kind];

  function formModal(title, entity, rev, onSave) {
    const form = buildForm(fields(!entity), { ...(rev ? rev.data : defaults()), code: entity ? entity.code : '' }, { books });
    modal(title, form.el, { wide: true, actions: [{ label: 'Hủy', onClick: () => {} }, { label: 'Lưu nháp', kind: 'primary', onClick: async () => {
      const v = form.get(); const code = v.code; delete v.code; if (kind === 'coupons') v.code = entity ? entity.code : code;
      if (kind === 'bundles') v.pickCount = v.type === 'FIXED' ? (v.bookIds || []).length : v.pickCount;
      const r = await guard(async () => { await onSave(code, v); return true; }, form); return !!r; } }] });
  }
  function createNew() {
    formModal('Tạo ' + TITLES[kind] + ' mới', null, null, async (code, data) => { await api.post('/admin/' + kind, { code, data }); toast('Đã tạo bản nháp', 'ok'); load(); });
  }

  async function detail(id) {
    const body = h('div'); let close;
    const draw = (e) => {
      const open = e.revisions.find((r) => r.status === 'DRAFT' || r.status === 'PENDING');
      clear(body).append(kv([['Mã', e.code], ['Trạng thái', badge(e.status)], ['Revision đang áp dụng', e.selectedRevNo ? '#' + e.selectedRevNo : 'Chưa có'], ['Lịch bàn giao', e.scheduledRevNo ? 'Revision #' + e.scheduledRevNo + ' sẽ áp dụng khi đến thời điểm bắt đầu' : '—']]),
        h('div', { class: 'row-actions' }, can('REVISION_WRITE') && e.isActive && !open ? h('button', { class: 'btn small primary', onClick: () => newRev(e) }, '+ Tạo revision mới') : null,
          can('REVISION_APPROVE') && e.isActive ? h('button', { class: 'btn small danger', onClick: () => disable(e) }, 'Tắt (ngừng áp dụng cho giao dịch mới)') : null,
          can('BUSINESS_HISTORY') ? h('button', { class: 'btn small', onClick: () => hist(e) }, 'Lịch sử duyệt') : null,
          can('SOFT_DELETE') ? h('button', { class: 'btn small danger', onClick: () => softDel(e) }, 'Xóa mềm') : null),
        h('h4', null, 'Các revision'), ...e.revisions.slice().reverse().map((r) => h('div', { class: 'rev' + (r.no === e.selectedRevNo ? ' current' : '') },
          h('div', { class: 'rev-head' }, h('strong', null, 'Revision #' + r.no), ' ', badge(r.status), r.no === e.selectedRevNo ? h('span', null, ' ', badge('ACTIVE', 'Đang áp dụng')) : null, r.no === e.scheduledRevNo ? h('span', null, ' ', badge('INFO', 'Chờ bàn giao')) : null),
          h('div', { class: 'help' }, describe(r.data)), r.rejectReason ? h('div', { class: 'field-err' }, 'Lý do từ chối: ' + r.rejectReason) : null,
          h('div', { class: 'row-actions' },
            r.status === 'DRAFT' && can('REVISION_WRITE') ? [h('button', { class: 'btn small', onClick: () => editRev(e, r) }, 'Sửa nháp'), h('button', { class: 'btn small primary', onClick: () => act(e, r, 'submit') }, 'Gửi duyệt')] : null,
            r.status === 'PENDING' && can('REVISION_APPROVE') ? [h('button', { class: 'btn small primary', onClick: () => act(e, r, 'approve') }, 'Duyệt'), h('button', { class: 'btn small danger', onClick: () => reject(e, r) }, 'Từ chối')] : null,
            r.status === 'PENDING' && !can('REVISION_APPROVE') ? h('span', { class: 'help' }, 'Đang chờ Manager duyệt') : null))));
    };
    const reload = async () => { const e = await api.get('/admin/' + kind + '/' + id); draw(e); load(); return e; };
    const e0 = await api.get('/admin/' + kind + '/' + id); draw(e0); close = modal(TITLES[kind] + ': ' + e0.title, body, { wide: true });
    function newRev(e) { const cur = e.revisions.find((r) => r.no === e.selectedRevNo) || e.revisions[e.revisions.length - 1]; formModal('Revision mới cho ' + e.code, e, cur, async (_c, data) => { const x = await api.post('/admin/' + kind + '/' + e.rowId + '/revisions', { data }); toast('Đã tạo revision nháp', 'ok'); await reload(); }); }
    function editRev(e, r) { formModal('Sửa revision #' + r.no, e, r, async (_c, data) => { await api.patch('/admin/' + kind + '/' + e.rowId + '/revisions/' + r.no, { data }, e.version); toast('Đã lưu nháp', 'ok'); await reload(); }); }
    async function act(e, r, action) { const ok = await guard(async () => { await api.post(`/admin/${kind}/${e.rowId}/revisions/${r.no}/${action}`, {}); return true; }); if (ok) { toast(action === 'submit' ? 'Đã gửi duyệt' : 'Đã duyệt', 'ok'); await reload(); } }
    async function reject(e, r) { const reason = await reasonDialog('Từ chối revision #' + r.no); if (!reason) return; const ok = await guard(async () => { await api.post(`/admin/${kind}/${e.rowId}/revisions/${r.no}/reject`, { reason }); return true; }); if (ok) { toast('Đã từ chối', 'ok'); await reload(); } }
    async function disable(e) { const reason = await reasonDialog('Tắt ' + e.code); if (!reason) return; const ok = await guard(async () => { await api.post(`/admin/${kind}/${e.rowId}/disable`, { reason }); return true; }); if (ok) { toast('Đã tắt', 'ok'); await reload(); } }
    async function softDel(e) { const reason = await reasonDialog('Xóa mềm ' + e.code); if (!reason) return; const ok = await guard(async () => { await api.del(`/admin/${kind}/${e.rowId}`, { reason }); return true; }); if (ok) { toast('Đã xóa mềm', 'ok'); close(); load(); } }
    async function hist(e) { const hh = await guard(() => api.get(`/admin/${kind}/${e.rowId}/history`)); if (hh) modal('Lịch sử duyệt ' + e.code, table([{ label: 'Rev', render: (r) => '#' + r.no }, { label: 'Trạng thái', render: (r) => badge(r.status) }, { label: 'Người tạo', key: 'createdBy' }, { label: 'Người duyệt', render: (r) => r.approvedBy || '—' }, { label: 'Gửi duyệt', render: (r) => dt(r.submittedAt) }], hh.items), { wide: true }); }
  }
  await load();
}

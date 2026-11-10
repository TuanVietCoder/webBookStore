import { api } from '../api.js';
import { h, clear, table, pager, filters, modal, buildForm, guard, toast, badge, money, bytes, dt, kv, reasonDialog, confirmDialog, loading, errorBox, pageHead } from '../ui.js';

export async function render(root, { can, query }) {
  const state = { page: 1, pageSize: 10, q: '', status: query.status || '', servingStatus: query.servingStatus || '' };
  const [cats, auths, pubs] = await Promise.all(['categories', 'authors', 'publishers'].map((c) => api.get('/admin/' + c, { all: 'true' })));
  const lookups = { cats: cats.items, auths: auths.items, pubs: pubs.items };
  const listBox = h('div'); const bar = filters([
    { name: 'q', label: 'Tìm theo tên/BookId' }, { name: 'status', label: 'Trạng thái', type: 'select', options: ['DRAFT', 'PUBLISHED', 'HIDDEN'].map((v) => ({ value: v, label: v })) },
    { name: 'servingStatus', label: 'Phục vụ', type: 'select', options: [{ value: 'ACTIVE', label: 'Đang phục vụ' }, { value: 'SUSPENDED', label: 'Đình chỉ' }] }], state, load);
  root.append(pageHead('Sách & file PDF', h('button', { class: 'btn primary', onClick: () => edit() }, '+ Thêm sách')), bar, listBox);
  await load();

  async function load() {
    clear(listBox).append(loading());
    try {
      const p = await api.get('/admin/books', state); clear(listBox);
      listBox.append(table([
        { label: 'BookId', key: 'bookId' }, { label: 'Tên sách', render: (b) => h('strong', null, b.title) }, { label: 'Tác giả', render: (b) => b.authorNames.join(', ') }, { label: 'Giá', render: (b) => money(b.price), class: 'num' },
        { label: 'Trạng thái', render: (b) => badge(b.status) }, { label: 'Phục vụ', render: (b) => badge(b.servingStatus) }, { label: 'File PDF', render: (b) => b.files.filter((f) => f.active).length + '/' + b.files.length },
      ], p.items, { onRow: (b) => detail(b.rowId), empty: 'Không có sách phù hợp' }), pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(listBox).append(errorBox(e, load)); }
  }

  function fields(b) {
    return [
      { name: 'bookId', label: 'BookId', required: true, help: '3-30 ký tự chữ/số/_-, không trùng' }, { name: 'title', label: 'Tên sách', required: true },
      { name: 'authorIds', label: 'Tác giả', type: 'multiselect', options: lookups.auths.map((a) => ({ value: a.rowId, label: a.name })), required: true, help: 'Giữ Ctrl/Cmd để chọn nhiều' },
      { name: 'categoryId', label: 'Danh mục', type: 'select', required: true, options: lookups.cats.map((c) => ({ value: c.rowId, label: c.name })) },
      { name: 'publisherId', label: 'Nhà xuất bản', type: 'select', options: [{ value: '', label: '— Không —' }].concat(lookups.pubs.map((c) => ({ value: c.rowId, label: c.name }))) },
      { name: 'price', label: 'Giá (đ)', type: 'number', min: 0, step: 1000, required: true }, { name: 'description', label: 'Mô tả', type: 'textarea' },
      b ? { name: 'status', label: 'Trạng thái bán', type: 'select', options: ['DRAFT', 'PUBLISHED', 'HIDDEN'].map((v) => ({ value: v, label: v })), help: 'PUBLISHED cần ít nhất một file PDF đang dùng' } : null].filter(Boolean);
  }
  function edit(b) {
    const form = buildForm(fields(b), b ? { ...b, publisherId: b.publisherId || '' } : { price: 80000, categoryId: lookups.cats[0].rowId });
    modal(b ? 'Sửa sách ' + b.bookId : 'Thêm sách', form.el, { actions: [{ label: 'Hủy', onClick: () => {} }, { label: 'Lưu', kind: 'primary', onClick: async () => {
      const v = form.get(); v.categoryId = Number(v.categoryId); v.publisherId = v.publisherId ? Number(v.publisherId) : null;
      const r = await guard(async () => { if (b) await api.patch('/admin/books/' + b.rowId, v, b.version); else await api.post('/admin/books', v); return true; }, form);
      if (r) { toast('Đã lưu sách', 'ok'); load(); } return !!r; } }] });
  }
  async function detail(id) {
    const b = await api.get('/admin/books/' + id); const body = h('div');
    const draw = (bk) => { clear(body).append(
      kv([['BookId', bk.bookId], ['Tên', bk.title], ['Tác giả', bk.authorNames.join(', ')], ['Danh mục', bk.categoryName], ['NXB', bk.publisherName], ['Giá', money(bk.price)], ['Trạng thái bán', badge(bk.status)], ['Phục vụ', h('span', null, badge(bk.servingStatus), bk.suspendReason ? ' — ' + bk.suspendReason : '')], ['Mô tả', bk.description], ['Đã xóa mềm', bk.isDel ? 'Có' : 'Không']]),
      h('h4', null, 'File PDF'), table([{ label: 'Phiên bản', render: (f) => 'v' + f.version }, { label: 'Tên file', key: 'fileName' }, { label: 'Dung lượng', render: (f) => bytes(f.sizeBytes) }, { label: 'Đang dùng', render: (f) => (f.active ? badge('ACTIVE', 'Có') : 'Không') }], bk.files, { empty: 'Chưa có file PDF' }),
      can('BOOK_WRITE') ? h('div', { class: 'row-actions' }, h('button', { class: 'btn small', onClick: () => upload(bk) }, '+ Tải lên phiên bản PDF'), h('button', { class: 'btn small', onClick: () => { close(); edit(bk); } }, 'Sửa thông tin'),
        can('CONTENT_MODERATE') ? h('button', { class: 'btn small ' + (bk.servingStatus === 'ACTIVE' ? 'danger' : ''), onClick: () => serving(bk) }, bk.servingStatus === 'ACTIVE' ? 'Đình chỉ phục vụ' : 'Mở lại phục vụ') : null,
        can('SOFT_DELETE') ? h('button', { class: 'btn small ' + (bk.isDel ? '' : 'danger'), onClick: () => softDel(bk) }, bk.isDel ? 'Khôi phục' : 'Xóa mềm') : null,
        can('BUSINESS_HISTORY') ? h('button', { class: 'btn small', onClick: () => history(bk) }, 'Lịch sử thay đổi') : null) : null); };
    draw(b);
    const close = modal('Chi tiết sách', body, { wide: true });
    async function refresh() { draw(await api.get('/admin/books/' + id)); load(); }
    function upload(bk) {
      const form = buildForm([{ name: 'fileName', label: 'Tên file (.pdf)', required: true, placeholder: 'ten-sach_v2.pdf' }, { name: 'sizeMB', label: 'Dung lượng (MB)', type: 'number', min: 0.1, step: 0.1, default: 2, required: true, help: 'Mô phỏng: backend thật nhận multipart file' }]);
      modal('Tải lên PDF', form.el, { actions: [{ label: 'Hủy', onClick: () => {} }, { label: 'Tải lên', kind: 'primary', onClick: async () => { const v = form.get();
        const r = await guard(async () => { await api.post('/admin/books/' + bk.rowId + '/files', { fileName: v.fileName, sizeBytes: Math.round(v.sizeMB * 1048576) }); return true; }, form); if (r) { toast('Đã tải lên', 'ok'); refresh(); } return !!r; } }] });
    }
    async function serving(bk) {
      const to = bk.servingStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'; const reason = await reasonDialog(to === 'SUSPENDED' ? 'Đình chỉ phục vụ PDF' : 'Mở lại phục vụ PDF', { kind: to === 'SUSPENDED' ? 'danger' : 'primary' });
      if (reason) { const r = await guard(async () => { await api.post('/admin/books/' + bk.rowId + '/serving-status', { servingStatus: to, reason }); return true; }); if (r) { toast('Đã cập nhật', 'ok'); refresh(); } }
    }
    async function softDel(bk) {
      if (bk.isDel) { const r = await guard(async () => { await api.post('/admin/books/' + bk.rowId + '/restore'); return true; }); if (r) { toast('Đã khôi phục', 'ok'); refresh(); } return; }
      const reason = await reasonDialog('Xóa mềm sách'); if (reason) { const r = await guard(async () => { await api.del('/admin/books/' + bk.rowId, { reason }); return true; }); if (r) { toast('Đã xóa mềm', 'ok'); refresh(); } }
    }
    async function history(bk) {
      const hist = await guard(() => api.get('/admin/history/Books/' + bk.rowId)); if (!hist) return;
      modal('Lịch sử: ' + bk.title, table([{ label: 'Thời điểm', render: (a) => dt(a.occurredAt) }, { label: 'Người thao tác', render: (a) => a.actorName || a.actorType }, { label: 'Hành động', key: 'actionCode' }, { label: 'Nguồn', key: 'actionSource' }], hist.items, { empty: 'Chưa có thay đổi nào được ghi' }), { wide: true });
    }
  }
}

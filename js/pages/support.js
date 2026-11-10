// Khiếu nại (complaints) và báo cáo nội dung (content reports).
import { api } from '../api.js';
import { h, clear, table, pager, filters, modal, buildForm, guard, toast, badge, dt, kv, loading, errorBox, pageHead, label } from '../ui.js';

export async function render(root, ctx) { return ctx.kind === 'complaints' ? complaints(root) : contentReports(root); }

const NEXT = { OPEN: [['IN_PROGRESS', 'Nhận xử lý']], IN_PROGRESS: [['RESOLVED', 'Đánh dấu đã giải quyết']], RESOLVED: [['CLOSED', 'Đóng khiếu nại'], ['IN_PROGRESS', 'Mở lại xử lý']], CLOSED: [] };

async function complaints(root) {
  const state = { page: 1, pageSize: 10, q: '', status: '' }; const box = h('div');
  root.append(pageHead('Khiếu nại'), filters([{ name: 'q', label: 'Tìm mã/tiêu đề' }, { name: 'status', label: 'Trạng thái', type: 'select', options: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((v) => ({ value: v, label: label(v) })) }], state, load), box);
  await load();
  async function load() {
    clear(box).append(loading());
    try { const p = await api.get('/admin/complaints', state); clear(box);
      box.append(table([{ label: 'Mã', key: 'code' }, { label: 'Tiêu đề', render: (c) => h('strong', null, c.subject) }, { label: 'Buyer', key: 'buyerName' }, { label: 'Trạng thái', render: (c) => badge(c.status) }, { label: 'Tin nhắn', key: 'messageCount', class: 'num' }, { label: 'Tạo lúc', render: (c) => dt(c.createdAt) }], p.items, { onRow: (c) => open(c.rowId), empty: 'Không có khiếu nại' }), pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }
  async function open(id) {
    const body = h('div');
    const draw = (c) => {
      const form = buildForm([{ name: 'body', label: 'Phản hồi', type: 'textarea', maxlength: 2000 }, { name: 'internal', label: 'Ghi chú nội bộ (Buyer không thấy)', type: 'checkbox' }, { name: 'fileName', label: 'Tệp đính kèm (tùy chọn, tối đa 1: png/jpg/pdf)', placeholder: 'anh-chup.png' }]);
      clear(body).append(kv([['Mã', c.code], ['Buyer', c.buyerName], ['Đơn liên quan', c.orderRowId ? '#' + c.orderRowId : '—'], ['Trạng thái', badge(c.status)]]),
        h('div', { class: 'row-actions' }, NEXT[c.status].map(([s, t]) => h('button', { class: 'btn small', onClick: async () => { const ok = await guard(async () => { await api.patch('/admin/complaints/' + id, { status: s }); return true; }); if (ok) { toast('Đã cập nhật trạng thái', 'ok'); refresh(); } } }, t))),
        h('h4', null, 'Hội thoại'), h('div', { class: 'chat' }, c.messages.map((m) => h('div', { class: 'msg ' + (m.from === 'STAFF' ? 'me' : '') + (m.internal ? ' internal' : '') }, h('div', { class: 'msg-meta' }, (m.from === 'STAFF' ? 'Nhân viên' : 'Buyer') + (m.internal ? ' · NỘI BỘ' : '') + ' · ' + dt(m.at)), m.body, m.fileName ? h('div', { class: 'help' }, '📎 ' + m.fileName) : null))),
        c.status === 'CLOSED' ? h('p', { class: 'muted' }, 'Khiếu nại đã đóng, không thể phản hồi thêm.') : h('div', null, form.el, h('button', { class: 'btn primary', onClick: async () => { const v = form.get();
          const ok = await guard(async () => { await api.post('/complaints/' + id + '/messages', v); return true; }, form); if (ok) { toast('Đã gửi', 'ok'); refresh(); } } }, 'Gửi phản hồi')));
    };
    const refresh = async () => { draw(await api.get('/admin/complaints/' + id)); load(); };
    draw(await api.get('/admin/complaints/' + id)); modal('Khiếu nại', body, { wide: true });
  }
}

async function contentReports(root) {
  const state = { page: 1, pageSize: 10, status: 'PENDING' }; const box = h('div');
  root.append(pageHead('Báo cáo nội dung vi phạm'), filters([{ name: 'status', label: 'Trạng thái', type: 'select', options: ['PENDING', 'ACCEPTED', 'REJECTED'].map((v) => ({ value: v, label: label(v) })) }], state, load), box);
  await load();
  async function load() {
    clear(box).append(loading());
    try { const p = await api.get('/admin/content-reports', state); clear(box);
      box.append(table([{ label: '#', key: 'rowId' }, { label: 'Đối tượng', render: (r) => h('div', null, h('div', null, r.targetLabel), h('div', { class: 'help' }, r.targetType)) }, { label: 'Lý do', key: 'reason' }, { label: 'Người báo cáo', key: 'reporterName' }, { label: 'Trạng thái', render: (r) => badge(r.status) },
        { label: 'Xử lý', render: (r) => (r.status === 'PENDING' ? h('button', { class: 'btn small primary', onClick: () => decide(r) }, 'Xử lý') : r.note || '—') }], p.items, { empty: 'Không có báo cáo' }), pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }
  function decide(r) {
    const form = buildForm([{ name: 'decision', label: 'Quyết định', type: 'select', options: [{ value: 'ACCEPT', label: 'Chấp nhận (ẩn nội dung vi phạm)' }, { value: 'REJECT', label: 'Bác bỏ báo cáo' }] }, { name: 'note', label: 'Ghi chú xử lý', type: 'textarea', required: true }]);
    modal('Xử lý báo cáo #' + r.rowId, h('div', null, h('p', null, r.targetLabel), form.el), { actions: [{ label: 'Hủy', onClick: () => {} }, { label: 'Lưu quyết định', kind: 'primary', onClick: async () => {
      const ok = await guard(async () => { await api.post('/admin/content-reports/' + r.rowId, form.get()); return true; }, form); if (ok) { toast('Đã xử lý', 'ok'); load(); } return !!ok; } }] });
  }
}

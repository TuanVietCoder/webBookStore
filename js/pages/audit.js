import { api } from '../api.js';
import { h, clear, table, pager, filters, modal, dt, loading, errorBox, pageHead, kv } from '../ui.js';

export async function render(root) {
  const state = { page: 1, pageSize: 15, action: '', table: '', source: '' }; const box = h('div');
  root.append(pageHead('Nhật ký Audit (toàn hệ thống)'), h('p', { class: 'muted' }, 'Giá trị nhạy cảm (mật khẩu, khóa cấu hình) luôn được che. Mở nhật ký này cũng được ghi lại (AUDIT_VIEW).'),
    filters([{ name: 'action', label: 'Mã hành động' }, { name: 'table', label: 'Bảng (VD: Books)' }, { name: 'source', label: 'Nguồn', type: 'select', options: ['WEB', 'AI', 'SYSTEM', 'API'].map((v) => ({ value: v, label: v })) }], state, load), box);
  await load();
  async function load() {
    clear(box).append(loading());
    try { const p = await api.get('/admin/audit-logs', state); clear(box);
      box.append(table([{ label: 'Thời điểm', render: (a) => dt(a.occurredAt) }, { label: 'Người thao tác', render: (a) => (a.actorName || '—') + (a.actorRoleSnapshot ? ' (' + a.actorRoleSnapshot + ')' : '') }, { label: 'Hành động', key: 'actionCode' }, { label: 'Nguồn', key: 'actionSource' },
        { label: 'Bảng', render: (a) => a.tableName || '—' }, { label: 'Bản ghi', render: (a) => (a.recordRowId ?? '—') }], p.items, { onRow: (a) => modal('Chi tiết audit', h('div', null, kv([['Hành động', a.actionCode], ['Nguồn', a.actionSource], ['RequestId', a.requestId || '—']]), h('h4', null, 'Trước'), h('pre', null, JSON.stringify(a.oldValues, null, 2) || 'null'), h('h4', null, 'Sau'), h('pre', null, JSON.stringify(a.newValues, null, 2) || 'null')), { wide: true }), empty: 'Chưa có bản ghi' }),
        pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }
}

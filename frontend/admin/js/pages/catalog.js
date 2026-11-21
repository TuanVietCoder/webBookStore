import { api } from '../api.js';
import { h, clear, table, pager, modal, buildForm, guard, toast, loading, errorBox, pageHead, reasonDialog, filters, badge } from '../ui.js';

const TABS = [['authors', 'Tác giả'], ['categories', 'Danh mục'], ['publishers', 'Nhà xuất bản']];
export async function render(root, { can }) {
  let tab = 'authors'; const state = { page: 1, pageSize: 10, q: '', includeDeleted: 'true' };
  const tabs = h('div', { class: 'tabs', role: 'tablist' }); const box = h('div');
  root.append(pageHead('Tác giả / Danh mục / Nhà xuất bản'), tabs, box);
  const drawTabs = () => { clear(tabs); TABS.forEach(([k, t]) => tabs.append(h('button', { class: 'tab' + (k === tab ? ' on' : ''), role: 'tab', 'aria-selected': k === tab, onClick: () => { tab = k; state.page = 1; state.q = ''; drawTabs(); load(); } }, t))); };
  drawTabs(); await load();
  async function load() {
    clear(box).append(loading());
    try {
      const p = await api.get('/admin/' + tab, state); clear(box);
      box.append(h('div', { class: 'toolbar' }, filters([{ name: 'q', label: 'Tìm theo tên' }], state, load), h('button', { class: 'btn primary', onClick: () => edit() }, '+ Thêm')),
        table([{ label: 'Tên', render: (x) => h('span', null, x.name, x.isDel ? h('span', null, ' ', badge('DISABLED', 'Đã xóa mềm')) : null) }, { label: 'Hành động', render: (x) => h('span', { class: 'row-actions' },
          !x.isDel ? h('button', { class: 'btn small', onClick: (e) => { e.stopPropagation(); edit(x); } }, 'Sửa') : null,
          can('SOFT_DELETE') ? h('button', { class: 'btn small ' + (x.isDel ? '' : 'danger'), onClick: (e) => { e.stopPropagation(); toggle(x); } }, x.isDel ? 'Khôi phục' : 'Xóa mềm') : null) }], p.items), pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }
  function edit(x) {
    const form = buildForm([{ name: 'name', label: 'Tên', required: true }], x || {});
    modal(x ? 'Sửa' : 'Thêm', form.el, { actions: [{ label: 'Hủy', onClick: () => {} }, { label: 'Lưu', kind: 'primary', onClick: async () => { const v = form.get();
      const r = await guard(async () => { if (x) await api.patch('/admin/' + tab + '/' + x.rowId, v, x.version); else await api.post('/admin/' + tab, v); return true; }, form); if (r) { toast('Đã lưu', 'ok'); load(); } return !!r; } }] });
  }
  async function toggle(x) {
    if (x.isDel) { const r = await guard(async () => { await api.post('/admin/' + tab + '/' + x.rowId + '/restore'); return true; }); if (r) { toast('Đã khôi phục', 'ok'); load(); } return; }
    const reason = await reasonDialog('Xóa mềm "' + x.name + '"'); if (!reason) return;
    const r = await guard(async () => { await api.del('/admin/' + tab + '/' + x.rowId, { reason }); return true; }); if (r) { toast('Đã xóa mềm', 'ok'); load(); }
  }
}

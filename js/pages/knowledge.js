import { api } from '../api.js';
import { h, clear, table, pager, filters, modal, buildForm, guard, toast, badge, loading, errorBox, pageHead } from '../ui.js';

export async function render(root) {
  const state = { page: 1, pageSize: 10, q: '', status: '' }; const box = h('div');
  root.append(pageHead('Tri thức cho AI Admin', h('button', { class: 'btn primary', onClick: () => edit() }, '+ Thêm bài')), h('p', { class: 'muted' }, 'AI chỉ dùng các bài đã công bố (PUBLISHED).'),
    filters([{ name: 'q', label: 'Tìm bài' }, { name: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'DRAFT', label: 'Nháp' }, { value: 'PUBLISHED', label: 'Đã công bố' }] }], state, load), box);
  await load();
  async function load() {
    clear(box).append(loading());
    try { const p = await api.get('/admin/knowledge-articles', state); clear(box);
      box.append(table([{ label: 'Tiêu đề', render: (k) => h('strong', null, k.title) }, { label: 'Từ khóa', render: (k) => k.keywords.join(', ') }, { label: 'Trạng thái', render: (k) => badge(k.status) }], p.items, { onRow: edit }), pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }
  function edit(k) {
    const form = buildForm([{ name: 'title', label: 'Tiêu đề', required: true }, { name: 'body', label: 'Nội dung', type: 'textarea', rows: 6, required: true }, { name: 'keywords', label: 'Từ khóa (cách nhau bằng dấu phẩy)', type: 'tags' },
      { name: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'DRAFT', label: 'Nháp' }, { value: 'PUBLISHED', label: 'Công bố cho AI' }] }], k ? { ...k, keywords: k.keywords.join(', ') } : { status: 'DRAFT' });
    modal(k ? 'Sửa bài' : 'Thêm bài', form.el, { wide: true, actions: [{ label: 'Hủy', onClick: () => {} }, { label: 'Lưu', kind: 'primary', onClick: async () => { const v = form.get();
      const ok = await guard(async () => { if (k) await api.patch('/admin/knowledge-articles/' + k.rowId, v, k.version); else await api.post('/admin/knowledge-articles', v); return true; }, form); if (ok) { toast('Đã lưu', 'ok'); load(); } return !!ok; } }] });
  }
}

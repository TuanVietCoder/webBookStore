import { api } from '../api.js';
import { h, clear, table, modal, buildForm, guard, toast, pageHead, badge } from '../ui.js';

export async function render(root) {
  const box = h('div'); root.append(pageHead('Cấu hình hệ thống'), h('p', { class: 'muted' }, 'Giá trị nhạy cảm được che; thay đổi đều được ghi audit (giá trị đã che).'), box); await load();
  async function load() {
    const r = await api.get('/admin/settings'); clear(box).append(table([{ label: 'Khóa', render: (s) => h('code', null, s.key) }, { label: 'Mô tả', key: 'description' }, { label: 'Giá trị', render: (s) => (s.sensitive ? h('span', null, s.value, ' ', badge('PENDING', 'Nhạy cảm')) : s.value) },
      { label: 'Thao tác', render: (s) => h('button', { class: 'btn small', onClick: () => edit(s) }, 'Sửa') }], r.items));
  }
  function edit(s) {
    const form = buildForm([{ name: 'value', label: s.key, required: true, type: s.sensitive ? 'password' : 'text', help: s.sensitive ? 'Nhập giá trị mới (giá trị cũ không hiển thị)' : '' }], { value: s.sensitive ? '' : s.value });
    modal('Sửa cấu hình', form.el, { actions: [{ label: 'Hủy', onClick: () => {} }, { label: 'Lưu', kind: 'primary', onClick: async () => { const ok = await guard(async () => { await api.patch('/admin/settings/' + s.key, form.get(), s.version); return true; }, form); if (ok) { toast('Đã lưu', 'ok'); load(); } return !!ok; } }] });
  }
}

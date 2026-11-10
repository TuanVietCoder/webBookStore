// Tài khoản (khóa/mở khóa theo phạm vi role) và nhân sự (Manager).
import { api } from '../api.js';
import { h, clear, table, pager, filters, modal, buildForm, guard, toast, badge, dt, loading, errorBox, pageHead, reasonDialog, label } from '../ui.js';

export async function render(root, ctx) {
  const staff = ctx.kind === 'staff'; const state = { page: 1, pageSize: 10, q: '', role: '', status: '' }; const box = h('div');
  const ROLE = { BUYER: 'Buyer', EMPLOYEE: 'Employee', MANAGER: 'Manager' };
  const roleOpts = (ctx.can('ACCOUNT_VIEW_ALL') ? ['BUYER', 'EMPLOYEE', 'MANAGER'] : ['BUYER']).map((v) => ({ value: v, label: ROLE[v] }));
  root.append(pageHead(staff ? 'Nhân sự (Employee / Manager)' : 'Tài khoản người dùng', staff ? h('button', { class: 'btn primary', onClick: () => edit() }, '+ Thêm nhân sự') : null),
    !staff && !ctx.can('ACCOUNT_VIEW_ALL') ? h('p', { class: 'muted' }, 'Employee chỉ được xem và khóa/mở khóa tài khoản Buyer.') : null,
    filters([{ name: 'q', label: 'Tìm email/họ tên' }, { name: 'role', label: 'Vai trò', type: 'select', options: staff ? roleOpts.filter((o) => o.value !== 'BUYER') : roleOpts }, { name: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'ACTIVE', label: 'Hoạt động' }, { value: 'DISABLED', label: 'Đã khóa' }] }], state, load), box);
  await load();
  async function load() {
    clear(box).append(loading());
    try {
      const p = await api.get('/admin/users', state); clear(box);
      const rows = staff && !state.role ? p.items.filter((u) => u.role !== 'BUYER') : p.items;
      box.append(table([{ label: 'Email', key: 'email' }, { label: 'Họ tên', key: 'fullName' }, { label: 'Vai trò', render: (u) => ROLE[u.role] }, { label: 'Trạng thái', render: (u) => h('span', null, badge(u.status), u.disableReason ? h('div', { class: 'help' }, u.disableReason) : null) }, { label: 'Tạo lúc', render: (u) => dt(u.createdAt) },
        { label: 'Thao tác', render: (u) => h('span', { class: 'row-actions' }, staff ? h('button', { class: 'btn small', onClick: () => edit(u) }, 'Sửa') : null,
          u.status === 'ACTIVE' ? h('button', { class: 'btn small danger', onClick: () => lock(u, true) }, 'Khóa') : h('button', { class: 'btn small', onClick: () => lock(u, false) }, 'Mở khóa')) }], rows, { empty: 'Không có tài khoản' }),
        pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }
  async function lock(u, disable) {
    const reason = await reasonDialog((disable ? 'Khóa ' : 'Mở khóa ') + u.email, { kind: disable ? 'danger' : 'primary', okLabel: disable ? 'Khóa tài khoản' : 'Mở khóa' }); if (!reason) return;
    const ok = await guard(async () => { await api.post('/admin/users/' + u.rowId + (disable ? '/disable' : '/enable'), { reason }); return true; }); if (ok) { toast(disable ? 'Đã khóa, mọi phiên đăng nhập bị thu hồi' : 'Đã mở khóa', 'ok'); load(); }
  }
  function edit(u) {
    const form = buildForm([{ name: 'email', label: 'Email', type: 'email', required: true, readOnly: !!u }, { name: 'fullName', label: 'Họ tên', required: true },
      { name: 'role', label: 'Vai trò', type: 'select', options: [{ value: 'EMPLOYEE', label: 'Employee' }, { value: 'MANAGER', label: 'Manager' }] }, { name: 'password', label: u ? 'Mật khẩu mới (bỏ trống nếu không đổi)' : 'Mật khẩu (≥ 8 ký tự)', type: 'password', required: !u }], u || { role: 'EMPLOYEE' });
    modal(u ? 'Sửa nhân sự' : 'Thêm nhân sự', form.el, { actions: [{ label: 'Hủy', onClick: () => {} }, { label: 'Lưu', kind: 'primary', onClick: async () => { const v = form.get(); if (u && !v.password) delete v.password;
      const ok = await guard(async () => { if (u) await api.patch('/admin/staff/' + u.rowId, v, u.version); else await api.post('/admin/staff', v); return true; }, form); if (ok) { toast('Đã lưu', 'ok'); load(); } return !!ok; } }] });
  }
}

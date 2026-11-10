import { api } from '../api.js';
import { h, buildForm, guard } from '../ui.js';
import { CONFIG } from '../config.js';

export function render(root, { onLogin }) {
  const form = buildForm([
    { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'manager@nhasach.test' },
    { name: 'password', label: 'Mật khẩu', type: 'password', required: true },
  ]);
  const err = h('div', { class: 'field-err', role: 'alert' });
  const submit = async () => {
    err.textContent = '';
    const v = form.get(); if (!v.email || !v.password) { err.textContent = 'Nhập email và mật khẩu'; return; }
    try { await onLogin(await api.post('/auth/login', v)); } catch (e) { err.textContent = e.message; }
  };
  form.el.addEventListener('submit', submit);
  root.append(h('div', { class: 'login' }, h('div', { class: 'login-card' },
    h('h1', null, 'Quản trị Nhà sách PDF'), h('p', { class: 'muted' }, 'Dành cho Employee và Manager'), form.el, err,
    h('button', { class: 'btn primary block', type: 'button', onClick: submit }, 'Đăng nhập'),
    CONFIG.USE_MOCK ? h('div', { class: 'demo' }, h('strong', null, 'Tài khoản thử (dữ liệu giả lập)'),
      h('ul', null, h('li', null, 'Manager: manager@nhasach.test / Manager@123'), h('li', null, 'Employee: employee@nhasach.test / Employee@123'))) : null)));
}

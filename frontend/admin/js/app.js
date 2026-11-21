import { CONFIG } from './config.js';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import { h, clear, toast, loading, errorBox } from './ui.js';

const NAV = [
  ['', 'Tổng quan', 'REPORT_OPERATIONAL', 'dashboard'],
  ['books', 'Sách & PDF', 'BOOK_WRITE', 'books'],
  ['catalog', 'Tác giả / Danh mục / NXB', 'BOOK_WRITE', 'catalog'],
  ['bundles', 'Bundle', 'REVISION_WRITE', 'promos'],
  ['events', 'Event', 'REVISION_WRITE', 'promos'],
  ['coupons', 'Coupon', 'REVISION_WRITE', 'promos'],
  ['orders', 'Đơn hàng (hỗ trợ)', 'ORDER_SUPPORT_VIEW', 'orders'],
  ['complaints', 'Khiếu nại', 'SUPPORT_HANDLE', 'support'],
  ['content-reports', 'Báo cáo nội dung', 'CONTENT_MODERATE', 'support'],
  ['users', 'Tài khoản', 'ACCOUNT_DISABLE_SCOPE', 'users'],
  ['staff', 'Nhân sự', 'STAFF_MANAGE', 'users'],
  ['reports', 'Báo cáo', 'REPORT_OPERATIONAL', 'reports'],
  ['audit', 'Nhật ký Audit', 'AUDIT_GLOBAL', 'audit'],
  ['knowledge', 'Tri thức AI', 'KNOWLEDGE_MANAGE', 'knowledge'],
  ['settings', 'Cấu hình hệ thống', 'SETTINGS_MANAGE', 'settings'],
  ['ai', 'Trợ lý AI Admin', 'AI_ADMIN_USE', 'ai'],
];

const session = { user: null, permissions: [] };
const can = (p) => session.permissions.includes(p);
const root = document.getElementById('app');

setUnauthorizedHandler(() => { if (session.user) { session.user = null; setToken(null); toast('Phiên đăng nhập đã hết hạn', 'error'); location.hash = '#/login'; } });

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [path, qs] = raw.split('?'); const [name = '', ...rest] = path.split('/').filter(Boolean).length ? path.split('/').filter(Boolean) : [''];
  return { name, args: rest, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

async function boot() {
  if (getToken()) {
    try { const me = await api.get('/auth/me'); session.user = me.user; session.permissions = me.permissions; } catch { setToken(null); }
  }
  window.addEventListener('hashchange', route);
  route();
}

async function route() {
  const r = parseHash();
  if (r.name === 'login' || !session.user) {
    if (session.user && r.name === 'login') { location.hash = '#/'; return; }
    if (!session.user && r.name !== 'login') { location.hash = '#/login'; return; }
    const m = await import('./pages/login.js'); clear(root); m.render(root, { onLogin: async (res) => { session.user = res.user; session.permissions = res.permissions; setToken(res.accessToken); location.hash = '#/'; } }); return;
  }
  const item = NAV.find((n) => n[0] === r.name);
  const shell = ensureShell(r.name);
  const main = shell.main; clear(main); main.append(loading());
  if (!item) { clear(main); main.append(errorBox({ status: 404, message: 'Trang không tồn tại' })); return; }
  if (!can(item[2])) { clear(main); main.append(errorBox({ status: 403, message: 'Vai trò ' + session.user.role + ' không có quyền truy cập mục này.' })); return; }
  try {
    const m = await import('./pages/' + item[3] + '.js'); const body = h('div', { class: 'page' }); clear(main); main.append(body);
    await m.render(body, { user: session.user, can, kind: r.name, args: r.args, query: r.query, navigate: (hash) => { location.hash = hash; } });
    main.focus();
  } catch (e) { clear(main); main.append(errorBox(e, route)); }
}

function ensureShell(active) {
  let shell = root.querySelector('.shell');
  if (!shell) {
    clear(root);
    const side = h('nav', { class: 'side', 'aria-label': 'Điều hướng chính' }, h('div', { class: 'brand' }, h('span', { class: 'logo' }, 'N'), h('div', null, h('strong', null, 'Nhà sách PDF'), h('small', null, 'Quản trị viên'))), h('ul', { id: 'navlist' }));
    const top = h('header', { class: 'top' }, h('button', { class: 'icon-btn menu', 'aria-label': 'Mở menu', onClick: () => shell.classList.toggle('open') }, '☰'),
      h('span', { class: 'mode' }, CONFIG.USE_MOCK ? 'Dữ liệu giả lập' : 'Kết nối API thật'),
      CONFIG.USE_MOCK ? h('button', { class: 'btn small', onClick: async () => { await api.post('/__mock/reset'); toast('Đã đặt lại dữ liệu mẫu'); location.reload(); } }, 'Đặt lại dữ liệu mẫu') : null,
      h('div', { class: 'who' }, h('span', null, session.user.fullName, ' · ', h('em', null, session.user.role === 'MANAGER' ? 'Manager' : 'Employee')),
        h('button', { class: 'btn small', onClick: async () => { try { await api.post('/auth/logout'); } catch { /* bỏ qua */ } setToken(null); session.user = null; clear(root); location.hash = '#/login'; route(); } }, 'Đăng xuất')));
    const main = h('main', { class: 'main', tabindex: '-1', id: 'main' });
    shell = h('div', { class: 'shell' }, side, h('div', { class: 'content' }, top, main)); shell.main = main; root.append(shell);
    shell.addEventListener('click', (e) => { if (e.target.closest('a')) shell.classList.remove('open'); });
  }
  const list = shell.querySelector('#navlist'); clear(list);
  NAV.filter((n) => can(n[2])).forEach((n) => list.append(h('li', null, h('a', { href: '#/' + n[0], class: n[0] === active ? 'active' : '', 'aria-current': n[0] === active ? 'page' : null }, n[1]))));
  shell.main = shell.querySelector('#main'); return shell;
}

boot();

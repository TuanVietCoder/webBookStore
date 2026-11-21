import { getDb, saveDb, hashPassword, verifyPassword, createSession, revokeSession, publicUser } from './store.js';
import { permsOf } from './adminRoutes.js';
import { fail, assert, auditBuyer } from './http.js';

export async function authRoute(method, path, body, user, token) {
  const db = getDb();
  if (method === 'POST' && path === '/auth/register') {
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    const password = String(body.password || '');
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254, 'Email không hợp lệ', 'email');
    assert(fullName.length >= 2 && fullName.length <= 100, 'Họ tên cần từ 2 đến 100 ký tự', 'fullName');
    assert(password.length >= 8 && password.length <= 128, 'Mật khẩu cần từ 8 đến 128 ký tự', 'password');
    if (db.users.some((u) => u.email.toLowerCase() === email)) fail(409, 'DUPLICATE_EMAIL', 'Email đã được đăng ký');
    const newUser = { rowId: db.seq++, fullName, email, passwordHash: hashPassword(password), role: 'BUYER', status: 'ACTIVE', version: 1, favoriteBooks: [], createdAt: new Date().toISOString() };
    db.users.push(newUser);
    auditBuyer(db, newUser, 'BUYER_REGISTER', 'Users', newUser.rowId);
    saveDb();
    return { status: 201, data: { accessToken: createSession(newUser.rowId), user: publicUser(newUser), permissions: [] } };
  }
  if (method === 'POST' && path === '/auth/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const audience = body.audience === 'BUYER' ? 'BUYER' : 'STAFF';
    const found = db.users.find((u) => u.email.toLowerCase() === email);
    if (!found || (audience === 'BUYER' ? found.role !== 'BUYER' : !['EMPLOYEE','MANAGER'].includes(found.role)) || !verifyPassword(password, found.passwordHash)) {
      fail(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
    }
    if (found.status !== 'ACTIVE') fail(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa');
    const accessToken = createSession(found.rowId);
    auditBuyer(db, found, 'LOGIN', 'Users', found.rowId); saveDb();
    return { data: { accessToken, user: publicUser(found), permissions: permsOf(found.role) } };
  }
  if (method === 'GET' && path === '/auth/me') {
    if (!user) fail(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn');
    return { data: { user: publicUser(user), permissions: permsOf(user.role) } };
  }
  if (method === 'POST' && path === '/auth/logout') {
    revokeSession(token); return { data: { ok: true } };
  }
  if (method === 'PATCH' && path === '/auth/me') {
    if (!user) fail(401, 'UNAUTHENTICATED', 'Bạn cần đăng nhập');
    const fullName = String(body.fullName || '').trim();
    assert(fullName.length >= 2 && fullName.length <= 100, 'Họ tên cần từ 2 đến 100 ký tự', 'fullName');
    user.fullName = fullName; user.version++; saveDb();
    return { data: { user: publicUser(user) } };
  }
  fail(404, 'NOT_FOUND', `Không có endpoint ${method} ${path}`);
}

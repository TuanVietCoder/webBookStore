import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed, starterClientFaqs } from './seed.js';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.resolve(process.env.DATA_FILE || path.join(base, 'data', 'db.json'));
let state;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${crypto.scryptSync(String(password), salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt:')) return false;
  const [, salt, digest] = stored.split(':');
  if (!salt || !/^[0-9a-f]{128}$/.test(digest || '')) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(digest, 'hex'));
}
export const tokenHash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  getDb().sessions[tokenHash(token)] = { rowId: userId, expiresAt: Date.now() + 7 * 86400_000 };
  saveDb();
  return token;
}
export function resolveSession(token) {
  if (!token) return null;
  const db = getDb();
  const entry = db.sessions[tokenHash(token)];
  if (!entry) return null;
  const id = typeof entry === 'object' ? entry.rowId : entry;
  if (typeof entry === 'object' && entry.expiresAt < Date.now()) {
    delete db.sessions[tokenHash(token)]; saveDb(); return null;
  }
  const u = db.users.find((x) => x.rowId === id);
  return u && u.status === 'ACTIVE' ? u : null;
}
export function revokeSession(token) {
  if (!token) return;
  delete getDb().sessions[tokenHash(token)];
  saveDb();
}
export function publicUser(u) {
  const { rowId, email, fullName, role, status, disableReason, version, createdAt } = u;
  return { rowId, email, fullName, role, status, disableReason: disableReason || '', version, createdAt };
}
export function getDb() {
  if (state) return state;
  if (fs.existsSync(dataPath)) {
    // Không reset khi dữ liệu lỗi: dừng server để tránh mất dữ liệu.
    state = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } else {
    state = seed();
  }
  state.sessions ||= {};
  state.giftCodeSecret ||= crypto.randomBytes(32).toString('hex');
  // Tương thích dữ liệu JSON cũ: thêm FAQ công khai đúng một lần, không ghi đè nội dung Admin.
  state.knowledge ||= [];
  if (!state.clientChatFaqsV1Migrated) {
    for (const faq of starterClientFaqs()) {
      if (!state.knowledge.some((k) => k.title === faq.title)) state.knowledge.push({...faq,rowId:state.seq++});
    }
    state.clientChatFaqsV1Migrated = true;
  }
  for (const article of state.knowledge) article.clientVisible ??= false;
  if(!state.clientChatFaqsV2Migrated) {
    for(const faq of starterClientFaqs().filter((k)=>[8,9].includes(k.rowId))) {
      if(!state.knowledge.some((k)=>k.title===faq.title)) state.knowledge.push({...faq,rowId:state.seq++});
    }
    const old=state.knowledge.find((k)=>k.title==='Tải file PDF đã mua');
    if(old?.body?.includes('Nếu sách chưa có tệp PDF thật, chức năng tải sẽ chưa khả dụng')) {
      old.body='Đã thanh toán hoặc nhận quà xong, mở Thư viện của tôi rồi bấm Đọc ngay để xem PDF trong trình duyệt hoặc Tải PDF để lưu. Nếu Admin chưa tải bản PDF thật, hệ thống tạo PDF mẫu Lorem Ipsum. Bản mẫu không chứa nội dung của tác phẩm.';
    }
    state.clientChatFaqsV2Migrated=true;
  }
  if (!state.couponRedemptions) {
    // Kế thừa lượt sử dụng coupon từ những đơn đã thanh toán trong dữ liệu cũ.
    state.couponRedemptions = state.orders.filter((o) => o.status === 'PAID' && o.couponCode && state.coupons.some((c) => c.code === o.couponCode))
      .map((o) => ({ code: o.couponCode, buyerRowId: o.buyerRowId, orderRowId: o.rowId }));
  }
  state.reviewSeq ||= 10000;
  for (const user of state.users) {
    if (user.password && !user.passwordHash) {
      user.passwordHash = hashPassword(user.password);
      delete user.password;
    }
    if (user.role === 'BUYER' && !user.passwordHash) {
      user.passwordHash = hashPassword('Buyer@123');
    }
    if (user.role === 'BUYER') user.favoriteBooks ||= [];
  }
  saveDb();
  return state;
}
export function saveDb() {
  if (!state) return;
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  const tmp = `${dataPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, dataPath);
}
export function nextId() { return getDb().seq++; }
export const getDataPath = () => dataPath;

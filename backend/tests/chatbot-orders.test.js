import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Chatbot Client trả lời về đơn hàng: chỉ của CHÍNH người đăng nhập, chưa đăng nhập thì yêu cầu đăng nhập, không lộ đơn người khác.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webbook-orders-'));
const PORT = 38000 + Math.floor(Math.random() * 500); const O = `http://127.0.0.1:${PORT}/api/v1`;

test('Chatbot xem đơn hàng theo quyền sở hữu', async (t) => {
  const server = spawn(process.execPath, ['src/server.js'], { cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_FILE: path.join(temp, 'db.json'), OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' }, stdio: 'ignore' });
  t.after(() => { server.kill(); fs.rmSync(temp, { recursive: true, force: true }); });
  let up = false; for (let i = 0; i < 80 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${PORT}/health`)).ok; } catch { await delay(100); } }
  assert.ok(up);
  const post = async (url, body, token) => (await fetch(O + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })).json();
  const ask = (message, token) => post('/shop/chat', { message }, token);

  // Chưa đăng nhập
  let r = await ask('tôi đã thanh toán những đơn hàng nào rồi');
  assert.equal(r.mode, 'account'); assert.equal(r.needsLogin, true); assert.doesNotMatch(r.answer, /ORD-/);

  // Buyer An đăng nhập
  const an = (await post('/auth/login', { email: 'an@mail.test', password: 'Buyer@123', audience: 'BUYER' })).accessToken; assert.ok(an);
  const mine = await (await fetch(O + '/shop/orders?pageSize=100', { headers: { Authorization: 'Bearer ' + an } })).json();
  const paid = mine.items.filter((o) => o.status === 'PAID');
  r = await ask('tôi đã thanh toán những đơn hàng nào rồi', an);
  assert.equal(r.mode, 'account'); assert.ok(paid.length > 0, 'seed phải có đơn đã thanh toán của An');
  for (const o of paid) assert.ok(r.answer.includes(o.orderId), 'thiếu ' + o.orderId);
  for (const o of mine.items.filter((x) => x.status !== 'PAID')) assert.ok(!r.answer.includes(o.orderId), 'lẫn đơn chưa thanh toán ' + o.orderId);

  // Hỏi mã đơn của người khác -> không thấy
  const all = JSON.parse(fs.readFileSync(path.join(temp, 'db.json'), 'utf8')).orders;
  const other = all.find((o) => o.buyerRowId !== mine.items[0].buyerRowId);
  if (other) { r = await ask('đơn ' + other.orderId + ' của tôi sao rồi', an); assert.doesNotMatch(r.answer, new RegExp(other.orderId + ' —')); assert.match(r.answer, /không thấy đơn/i); }

  // Câu hỏi cách làm vẫn đi đường FAQ, không bị coi là hỏi đơn cá nhân
  r = await ask('hướng dẫn thanh toán đơn hàng thế nào', an); assert.notEqual(r.mode, 'account');
  // Tài khoản nhân viên không dùng được tính năng này
  const mgr = (await post('/auth/login', { email: 'manager@nhasach.test', password: 'Manager@123', audience: 'STAFF' })).accessToken;
  r = await ask('tôi đã mua những đơn hàng nào', mgr); assert.equal(r.needsLogin, true);
});

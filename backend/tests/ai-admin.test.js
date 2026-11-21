import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Kiểm thử AI Admin ở backend bằng Claude GIẢ (không tốn tiền, không cần Internet):
// phân quyền tool theo vai trò, xem trước -> xác nhận một lần, rơi về mô phỏng khi AI lỗi.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webbook-ai-'));
const PORT = 32000 + Math.floor(Math.random() * 1000);
const FAKE_PORT = 33000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://127.0.0.1:${PORT}`;

// ---- Claude giả (Anthropic Messages API), kiểm đúng quy tắc ghép tool_use/tool_result ----
const fakeClaude = http.createServer((req, res) => {
  let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => {
    const out = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url !== '/v1/messages') return out(404, { error: { message: 'not found' } });
    if (req.headers['x-api-key'] !== 'fake-key' || req.headers['anthropic-version'] !== '2023-06-01') return out(401, { error: { type: 'authentication_error', message: 'bad key' } });
    const b = JSON.parse(s); const msgs = b.messages; const last = msgs[msgs.length - 1];
    // Kiểm tra đúng quy tắc của Anthropic: bắt đầu bằng user, xen kẽ vai trò, tool_result phải khớp tool_use ngay trước đó.
    if (msgs[0].role !== 'user') return out(400, { error: { message: 'first message must be user' } });
    for (let i = 1; i < msgs.length; i++) if (msgs[i].role === msgs[i - 1].role) return out(400, { error: { message: 'roles must alternate' } });
    const uses = []; msgs.forEach((m, i) => m.content.forEach((c) => { if (c.type === 'tool_use') uses.push([i, c.id]); }));
    for (const [i, id] of uses) if (!msgs[i + 1] || !msgs[i + 1].content.some((c) => c.type === 'tool_result' && c.tool_use_id === id)) return out(400, { error: { message: 'tool_use ' + id + ' không có tool_result' } });
    if (!b.system || !b.max_tokens || !b.model) return out(400, { error: { message: 'thiếu system/max_tokens/model' } });
    const tools = (b.tools || []).map((t) => t.name); if ((b.tools || []).some((t) => t.input_schema.type !== 'object' || (t.input_schema.required !== undefined && !Array.isArray(t.input_schema.required)) || (t.input_schema.properties && Object.values(t.input_schema.properties).some((v) => v.type !== 'string')))) return out(400, { error: { message: 'input_schema sai' } });
    const text = (r) => out(200, { content: [{ type: 'text', text: r }], stop_reason: 'end_turn' });
    const tr = last.content.find((c) => c.type === 'tool_result');
    if (tr) return text('KẾT QUẢ TOOL: ' + tr.content.slice(0, 300) + ' | tools=' + tools.join(','));
    const t = (last.content.find((c) => c.type === 'text') || { text: '' }).text.toLowerCase();
    const call = (name, input) => out(200, { content: [{ type: 'text', text: 'Để mình kiểm tra.' }, { type: 'tool_use', id: 'toolu_01' + Math.random().toString(36).slice(2, 10), name, input }], stop_reason: 'tool_use' });
    if (t.includes('boom')) return out(529, { error: { type: 'overloaded_error', message: 'quá tải' } });
    if (t.includes('khóa')) return call('propose_disable_user', { email: (t.match(/\S+@\S+/) || [''])[0] });
    if (t.includes('sách')) return call('search_books', { query: 'Dế Mèn' });
    if (t.includes('quy trình')) return call('search_knowledge', { query: 'thanh toán' });
    if (t.includes('doanh thu')) return call('get_revenue', {});
    text('Xin chào từ LLM giả (claude). tools=' + tools.join(','));
  });
});

async function call(method, url, body, token) {
  const r = await fetch(ORIGIN + '/api/v1' + url, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
const login = async (email, password) => (await call('POST', '/auth/login', { email, password, audience: 'STAFF' }, null)).data.accessToken;

test('AI Admin: Claude (giả) gọi tool, phân quyền theo vai trò, xem trước rồi xác nhận một lần', async (t) => {
  await new Promise((r) => fakeClaude.listen(FAKE_PORT, '127.0.0.1', r));
  const server = spawn(process.execPath, ['src/server.js'], { cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_FILE: path.join(temp, 'db.json'), LLM_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'fake-key', ANTHROPIC_BASE_URL: `http://127.0.0.1:${FAKE_PORT}`, GEMINI_API_KEY: '' }, stdio: ['ignore', 'ignore', 'pipe'] });
  let output = ''; server.stderr.on('data', (d) => (output += d.toString()));
  t.after(() => { server.kill(); fakeClaude.close(); fs.rmSync(temp, { recursive: true, force: true }); });
  let up = false; for (let i = 0; i < 80 && !up; i++) { try { up = (await fetch(ORIGIN + '/health')).ok; } catch { await delay(100); } }
  assert.ok(up, 'Không khởi động được backend: ' + output);

  const emp = await login('employee@nhasach.test', 'Employee@123'); const mgr = await login('manager@nhasach.test', 'Manager@123');
  assert.ok(emp && mgr);
  const chat = (token, message) => call('POST', '/ai/admin/chat', { message }, token);

  let r = await chat(emp, 'xin chào');
  assert.equal(r.data.type, 'ANSWER'); assert.match(r.data.text, /LLM giả \(claude\)/);
  assert.doesNotMatch(r.data.text, /get_revenue|get_recent_audit/, 'Employee không được cấp tool tài chính/audit');
  r = await chat(mgr, 'xin chào'); assert.match(r.data.text, /get_revenue/); assert.match(r.data.text, /get_recent_audit/);

  r = await chat(emp, 'hướng dẫn quy trình');
  assert.ok(r.data.sources.includes('Hoàn tất thanh toán'), 'phải có nguồn bài tri thức');
  r = await chat(emp, 'doanh thu'); assert.match(r.data.text, /Thiếu quyền/, 'tool tài chính phải tự chặn Employee dù AI gọi');
  r = await chat(mgr, 'doanh thu'); assert.match(r.data.text, /revenueVnd/);
  r = await chat(emp, 'có sách nào không'); assert.match(r.data.text, /"bookId":"BK\d+"/);

  // Thao tác ghi: chỉ xem trước, chưa khóa
  const prev = (await chat(emp, 'khóa tài khoản an@mail.test')).data;
  assert.equal(prev.type, 'PREVIEW'); assert.ok(prev.confirmToken);
  const before = (await call('GET', '/admin/users?q=an@mail.test', null, emp)).data.items[0];
  assert.equal(before.status, 'ACTIVE', 'chưa xác nhận thì chưa được khóa');
  assert.equal((await call('POST', `/ai/admin/actions/${prev.requestId}/confirm`, { confirmToken: 'sai' }, emp)).status, 422);
  const done = await call('POST', `/ai/admin/actions/${prev.requestId}/confirm`, { confirmToken: prev.confirmToken }, emp);
  assert.equal(done.status, 200); assert.match(done.data.text, /Đã thực hiện/);
  assert.notEqual((await call('GET', '/admin/users?q=an@mail.test', null, emp)).data.items[0].status, 'ACTIVE');
  assert.equal((await call('POST', `/ai/admin/actions/${prev.requestId}/confirm`, { confirmToken: prev.confirmToken }, emp)).status, 409, 'token chỉ dùng một lần');

  // Employee không được khóa Manager qua AI
  r = await chat(emp, 'khóa tài khoản manager@nhasach.test'); assert.match(r.data.text, /không đủ quyền|Không đủ quyền/i);

  // Nhà cung cấp AI lỗi -> chế độ mô phỏng, có thông báo
  r = await chat(emp, 'boom'); assert.match(r.data.text, /chế độ mô phỏng/);
  // Chưa đăng nhập -> 401
  assert.equal((await call('POST', '/ai/admin/chat', { message: 'xin chào' }, null)).status, 401);
});

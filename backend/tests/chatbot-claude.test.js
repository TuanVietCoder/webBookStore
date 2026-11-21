import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

// Chatbot Client dùng Claude (giả lập). Kiểm tra: gọi đúng API Anthropic, và khóa "sk-ant-" lỡ điền vào OPENAI_API_KEY không bao giờ bị gửi tới OpenAI.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webbook-chat-'));
const PORT = 35000 + Math.floor(Math.random() * 500), FAKE = 36000 + Math.floor(Math.random() * 500), TRAP = 37000 + Math.floor(Math.random() * 500);
let bookId = 0; const seen = { anthropic: 0, openai: 0, key: '' };
const fakeClaude = http.createServer((req, res) => {
  let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => {
    seen.anthropic++; seen.key = req.headers['x-api-key'];
    const b = JSON.parse(s); assert.ok(b.system && b.messages[0].role === 'user' && b.max_tokens);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content: [{ type: 'text', text: 'Đây là kết quả:\n{"inScope":true,"bookIds":[' + bookId + '],"faqId":null,"intent":"FIND"}' }], stop_reason: 'end_turn' }));
  });
});
const trap = http.createServer((req, res) => { seen.openai++; res.writeHead(500); res.end('{}'); });

test('Chatbot Client dùng Claude; khóa sk-ant- không bị gửi tới OpenAI', async (t) => {
  await new Promise((r) => fakeClaude.listen(FAKE, '127.0.0.1', r)); await new Promise((r) => trap.listen(TRAP, '127.0.0.1', r));
  const server = spawn(process.execPath, ['src/server.js'], { cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_FILE: path.join(temp, 'db.json'), ANTHROPIC_API_KEY: 'fake-claude-key', ANTHROPIC_BASE_URL: `http://127.0.0.1:${FAKE}`, OPENAI_API_KEY: 'sk-ant-nham-vao-day', OPENAI_BASE_URL: `http://127.0.0.1:${TRAP}`, CLIENT_CHAT_PROVIDER: '' }, stdio: 'ignore' });
  t.after(() => { server.kill(); fakeClaude.close(); trap.close(); fs.rmSync(temp, { recursive: true, force: true }); });
  const O = `http://127.0.0.1:${PORT}/api/v1`;
  let up = false; for (let i = 0; i < 80 && !up; i++) { try { up = (await fetch(`http://127.0.0.1:${PORT}/health`)).ok; } catch { await delay(100); } }
  assert.ok(up);
  const books = (await (await fetch(O + '/shop/books')).json()).items; bookId = books[0].rowId;
  assert.equal((await (await fetch(O + '/shop/chat/status')).json()).mode, 'ai');
  const r = await (await fetch(O + '/shop/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'cho mình xem sách ' + books[0].title }) })).json();
  assert.equal(seen.anthropic, 1, 'phải gọi Claude'); assert.equal(seen.key, 'fake-claude-key'); assert.equal(seen.openai, 0, 'không được gọi OpenAI');
  assert.equal(r.mode, 'ai'); assert.ok(r.books.some((b) => b.rowId === bookId));
});

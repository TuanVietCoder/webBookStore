// Máy chủ nhỏ, không cần cài thư viện: phục vụ web tĩnh + cầu nối an toàn tới Gemini.
// Chạy: node server/index.js   (đọc khóa từ file .env hoặc biến môi trường)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callGemini, hasKey, isRole } from './gemini.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Nạp .env (KEY=VALUE), không ghi đè biến môi trường đã có.
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* không có .env */ }

const PORT = Number(process.env.PORT) || 8080;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };
const PRIVATE = /^\/(\.|server\/|node_modules\/|database\/|tests\/)/; // không phục vụ file nhạy cảm

const hits = new Map();
const limited = (ip) => { const t = Date.now(), a = (hits.get(ip) || []).filter((x) => t - x < 60000); a.push(t); hits.set(ip, a); return a.length > 20; };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const readBody = (req, max = 40000) => new Promise((ok, bad) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > max) { bad(new Error('TOO_LARGE')); req.destroy(); } }); req.on('end', () => ok(s)); req.on('error', bad); });

// Hội thoại do trình duyệt gửi: chỉ nhận đúng dạng text / functionCall / functionResponse, tối đa 24 lượt.
function cleanContents(c) {
  if (!Array.isArray(c) || !c.length || c.length > 24) return null;
  const out = [];
  for (const m of c) {
    if (!m || !['user', 'model'].includes(m.role) || !Array.isArray(m.parts) || !m.parts.length) return null;
    const parts = [];
    for (const p of m.parts) {
      // thoughtSignature do Gemini sinh ra, phải trả lại nguyên vẹn thì các mô hình mới mới cho phép gọi tool tiếp.
      const sig = typeof p.thoughtSignature === 'string' && p.thoughtSignature.length < 8000 ? { thoughtSignature: p.thoughtSignature } : {};
      if (typeof p.text === 'string') parts.push({ text: p.text.slice(0, 4000), ...sig });
      else if (p.functionCall && typeof p.functionCall.name === 'string') parts.push({ functionCall: { name: p.functionCall.name, args: p.functionCall.args || {} }, ...sig });
      else if (p.functionResponse && typeof p.functionResponse.name === 'string') parts.push({ functionResponse: { name: p.functionResponse.name, response: p.functionResponse.response || {} } });
      else return null;
    }
    out.push({ role: m.role, parts });
  }
  return out[0].role === 'user' ? out : null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/api/v1/ai/status' && req.method === 'GET') return send(res, 200, { llm: hasKey() });
    if (p === '/api/v1/ai/llm' && req.method === 'POST') {
      if (!hasKey()) return send(res, 503, { errorCode: 'LLM_DISABLED', message: 'Chưa cấu hình khóa Gemini' });
      if (limited(req.socket.remoteAddress)) return send(res, 429, { errorCode: 'RATE_LIMIT', message: 'Gửi quá nhanh, thử lại sau ít phút' });
      let body; try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { errorCode: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' }); }
      const contents = cleanContents(body.contents);
      if (!isRole(body.role) || !contents) return send(res, 422, { errorCode: 'VALIDATION_ERROR', message: 'Vai trò hoặc hội thoại không hợp lệ' });
      try { return send(res, 200, { parts: await callGemini(body.role, contents) }); }
      catch (e) { return send(res, e.code === 'UPSTREAM' ? 502 : 500, { errorCode: 'LLM_ERROR', message: e.message }); }
    }
    if (p.startsWith('/api/')) return send(res, 404, { errorCode: 'NOT_FOUND', message: 'Không có endpoint' });
    // Tệp tĩnh
    const rel = p === '/' ? '/index.html' : p;
    const file = path.resolve(ROOT, '.' + rel);
    if (!file.startsWith(ROOT + path.sep) || PRIVATE.test(rel)) { res.writeHead(404); return res.end('Not found'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data);
    });
  } catch (e) { send(res, 500, { errorCode: 'INTERNAL', message: 'Lỗi máy chủ' }); }
}).listen(PORT, () => console.log(`Web Admin: http://localhost:${PORT}  |  Gemini: ${hasKey() ? 'ĐÃ có khóa' : 'CHƯA có khóa (AI dùng chế độ mô phỏng)'}`));

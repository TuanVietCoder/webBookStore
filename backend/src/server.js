import './loadEnv.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { handle as adminRoute } from './adminRoutes.js';
import { authRoute } from './authRoutes.js';
import { shopRoute } from './shopRoutes.js';
import { getDb, resolveSession, getDataPath } from './store.js';
import { uploadPdf, streamPdf } from './pdfFiles.js';
import { uploadCover, deleteCover, streamCover } from './coverFiles.js';
import { chatStatus, clientChat } from './clientChat.js';
import { HttpError, fail } from './http.js';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = path.join(base, 'frontend');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const LIMIT = 1024 * 1024;
const attempts = new Map();
const chatAttempts = new Map();
const giftAttempts = new Map();
function limitGift(req,user) {
  const now=Date.now(); const key=String(user.rowId)+':'+String(req.socket.remoteAddress || 'unknown');
  let entry=giftAttempts.get(key);
  if(!entry || now>=entry.expires) entry={count:0,expires:now+10*60_000};
  entry.count++;giftAttempts.set(key,entry);
  if(giftAttempts.size>5000) for(const [k,v] of giftAttempts) if(now>=v.expires)giftAttempts.delete(k);
  if(entry.count>12) fail(429,'GIFT_RATE_LIMITED','Bạn đã thử mã quá nhiều lần. Vui lòng thử lại sau.');
}
function limitChat(req) {
  const now=Date.now();
  const key=String(req.socket.remoteAddress || 'unknown');
  let entry=chatAttempts.get(key);
  if (!entry || now>=entry.expires) entry={count:0,expires:now+60_000};
  entry.count++;
  chatAttempts.set(key,entry);
  if (chatAttempts.size>5000) for (const [k,v] of chatAttempts) if (now>=v.expires) chatAttempts.delete(k);
  if (entry.count>15) fail(429,'CHAT_RATE_LIMITED','Bạn đã gửi nhiều câu hỏi, vui lòng thử lại sau một phút.');
}
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon' };

function headers(res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'self' blob:; base-uri 'self'; frame-ancestors 'none'");
}
function json(res, status, object) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
  res.end(JSON.stringify(object));
}
async function parseBody(req) {
  if (!['POST','PATCH','PUT','DELETE'].includes(req.method)) return {};
  const contentType = String(req.headers['content-type'] || '');
  if (contentType && !contentType.startsWith('application/json')) fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Chỉ hỗ trợ application/json');
  let size = 0; const parts = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > LIMIT) fail(413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên vượt quá 1MB');
    parts.push(chunk);
  }
  if (!size) return {};
  try {
    const result = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('object required');
    return result;
  } catch { fail(400, 'INVALID_JSON', 'JSON không hợp lệ'); }
}
function limitAuth(req) {
  const key = String(req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  let state = attempts.get(key);
  if (!state || state.expires < now) state = { count:0, expires:now + 10 * 60_000 };
  state.count++;
  attempts.set(key, state);
  if (state.count > 60) fail(429, 'RATE_LIMITED', 'Thao tác quá nhiều, vui lòng thử lại sau');
}
function staticFile(req, res, pathname) {
  if (pathname === '/admin') { res.writeHead(308, { Location:'/admin/' }); res.end(); return; }
  if (pathname === '/client') { res.writeHead(308, { Location:'/' }); res.end(); return; }
  let name, scope;
  if (pathname === '/') { scope = path.join(frontend,'client'); name = path.join(scope,'index.html'); }
  else if (pathname.startsWith('/client/')) { scope = path.join(frontend,'client'); name = path.join(scope,decodeURIComponent(pathname.slice(8))); }
  else if (pathname === '/admin/') { scope = path.join(frontend,'admin'); name = path.join(scope,'index.html'); }
  else if (pathname.startsWith('/admin/')) { scope = path.join(frontend,'admin'); name = path.join(scope,decodeURIComponent(pathname.slice(7))); }
  else { json(res,404,{ errorCode:'NOT_FOUND', message:'Trang không tồn tại' }); return; }
  const resolved = path.resolve(name);
  if (!(resolved.startsWith(scope + path.sep))) { json(res,403,{ errorCode:'FORBIDDEN',message:'Không được phép' }); return; }
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) throw Error('not a file');
    res.writeHead(200, { 'Content-Type': mime[path.extname(resolved)] || 'application/octet-stream', 'Cache-Control':'no-cache' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(resolved).pipe(res);
  } catch { json(res,404,{ errorCode:'NOT_FOUND', message:'Tệp không tồn tại' }); }
}

getDb(); // Nạp DB trước khi bắt đầu tiếp nhận request.
const server = http.createServer(async (req,res) => {
  headers(res);
  try {
    if (!['GET','HEAD','POST','PATCH','DELETE'].includes(req.method)) fail(405,'METHOD_NOT_ALLOWED','Phương thức không được hỗ trợ');
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    if (pathname === '/health' && req.method === 'GET') {
      json(res,200,{ status:'ok', service:'web-book-store-api', version:'1.0.0' }); return;
    }
    if (!pathname.startsWith('/api/v1/')) {
      if (!['GET','HEAD'].includes(req.method)) fail(405,'METHOD_NOT_ALLOWED','Chỉ hỗ trợ GET/HEAD cho tệp tĩnh');
      staticFile(req,res,pathname); return;
    }
    const routePath = pathname.slice('/api/v1'.length);
    if (/\/\./.test(routePath)) fail(400,'INVALID_PATH','Đường dẫn không hợp lệ');
    const query = Object.fromEntries(url.searchParams.entries());
    const auth = req.headers.authorization?.match(/^Bearer (\S+)$/i);
    const token = auth?.[1] || '';
    const user = resolveSession(token);
    const pdfUpload = routePath.match(/^\/admin\/books\/(\d+)\/pdf$/);
    const pdfDownload = routePath.match(/^\/shop\/library\/(\d+)\/pdf$/);
    const coverAdmin = routePath.match(/^\/admin\/books\/(\d+)\/cover$/);
    const coverShop = routePath.match(/^\/shop\/books\/(\d+)\/cover$/);
    if (coverAdmin && ['GET','HEAD'].includes(req.method)) { streamCover(res,user,coverAdmin[1],true,req.method==='HEAD'); return; }
    if (coverShop && ['GET','HEAD'].includes(req.method)) { streamCover(res,user,coverShop[1],false,req.method==='HEAD'); return; }
    if (coverAdmin && req.method === 'POST') { const response=await uploadCover(req,user,coverAdmin[1]); json(res,response.status,response.data); return; }
    if (coverAdmin && req.method === 'DELETE') { const response=deleteCover(user,coverAdmin[1],req.headers['if-match']); json(res,response.status,response.data); return; }
    if (pdfUpload && req.method === 'POST') {
      const response = await uploadPdf(req, user, pdfUpload[1]);
      json(res, response.status, response.data); return;
    }
    if (pdfDownload && req.method === 'GET') { streamPdf(res, user, pdfDownload[1], { inline: query.view === '1' }); return; }
    if (routePath==='/shop/chat/status' && req.method==='GET') { json(res,200,chatStatus()); return; }
    if (routePath==='/shop/chat' && req.method==='POST') {
      limitChat(req);
      const answer=await clientChat(req.method,routePath,await parseBody(req),user);
      json(res,answer.status||200,answer.data); return;
    }
    if (routePath==='/shop/gifts/claim' && req.method==='POST' && user) limitGift(req,user);
    const body = await parseBody(req);
    if (['/auth/login','/auth/register'].includes(routePath) && req.method === 'POST') limitAuth(req);
    let result;
    if (routePath.startsWith('/auth/')) result = await authRoute(req.method, routePath, body, user, token);
    else if (routePath.startsWith('/shop/')) result = await shopRoute(req.method, routePath, query, body, user);
    else result = await adminRoute({ method:req.method, path:routePath, query, body, token, ifMatch:req.headers['if-match'] });
    if (result.error) json(res, result.status || 500, result.error);
    else json(res, result.status || 200, result.data === undefined ? { ok: true } : result.data);
    // API error from legacy Admin router sets status, body error; no hidden 2xx.
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error('Server error', error);
    json(res,status,{errorCode:error instanceof HttpError ? error.errorCode:'INTERNAL', message:error instanceof HttpError ? error.message:'Lỗi hệ thống',
      details:error instanceof HttpError ? error.details:null, requestId:crypto.randomUUID()});
  }
});
server.listen(port,host,()=>{
  console.log(`Client: http://${host}:${port}/`);
  console.log(`Admin:  http://${host}:${port}/admin/`);
  console.log(`API:    http://${host}:${port}/api/v1/`);
  console.log(`Data:   ${getDataPath()}`);
  console.log(`Demo payment: ${process.env.DEMO_PAYMENTS_ENABLED !== 'false' ? 'ENABLED (lab only)' : 'DISABLED'}`);
});

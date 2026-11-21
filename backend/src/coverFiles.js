// Ảnh bìa sách: lưu file riêng, metadata trong DB chung cho Admin và Client.
// Không cho phép truy cập trực tiếp thư mục storage; Client chỉ xem bìa của sách công khai.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getDb, nextId, saveDb } from './store.js';
import { permsOf } from './adminRoutes.js';
import { fail } from './http.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.resolve(process.env.COVER_DIR || path.join(backendRoot, 'storage', 'covers'));
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function adminBook(user, id) {
  if (!user) fail(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập Admin');
  if (!permsOf(user.role).includes('BOOK_WRITE')) fail(403, 'FORBIDDEN', 'Không có quyền quản lý ảnh bìa');
  const book = getDb().books.find((b) => b.rowId === Number(id) && !b.isDel);
  if (!book) fail(404, 'NOT_FOUND', 'Sách không tồn tại');
  return book;
}
function requireVersion(book, ifMatch) {
  if (!/^\d+$/.test(String(ifMatch ?? ''))) fail(428, 'IF_MATCH_REQUIRED', 'Thiếu If-Match phiên bản của sách');
  if (Number(ifMatch) !== book.version) fail(409, 'VERSION_CONFLICT', 'Sách đã được thay đổi, vui lòng tải lại.', { current: book.version });
}
function cleanName(header, ext) {
  let value;
  try { value = decodeURIComponent(String(header || `cover.${ext}`)); }
  catch { fail(400, 'INVALID_FILE_NAME', 'Tên ảnh không hợp lệ'); }
  const name = value.replace(/[\\/\x00-\x1f\x7f"<>:|?*]+/g, '_').trim().slice(0, 120);
  if (!name || !new RegExp(`\\.${ext === 'jpg' ? '(jpg|jpeg)' : ext}$`, 'i').test(name)) {
    fail(422, 'INVALID_FILE_NAME', 'Tên file phải có đuôi JPG, JPEG, PNG hoặc WebP phù hợp nội dung');
  }
  return name;
}
function validateDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 6000 || height > 6000 || width * height > 24_000_000) {
    fail(422, 'INVALID_IMAGE', 'Kích thước ảnh không hợp lệ (tối đa 6000px/cạnh và 24MP)');
  }
  return { width, height };
}
function detectImage(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && buffer.toString('ascii', 12, 16) === 'IHDR') {
    return { type: 'image/png', ...validateDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20)) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length-2] === 0xff && buffer[buffer.length-1] === 0xd9) {
    // Lấy kích thước từ marker SOF, kể cả JPEG progressive.
    let p = 2;
    while (p < buffer.length - 9) {
      if (buffer[p] !== 0xff) { p++; continue; }
      while (buffer[p] === 0xff) p++;
      const marker = buffer[p++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (p + 2 > buffer.length) break;
      const len = buffer.readUInt16BE(p);
      if (len < 2 || p + len > buffer.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && len >= 7) {
        return { type: 'image/jpeg', ...validateDimensions(buffer.readUInt16BE(p+3), buffer.readUInt16BE(p+5)) };
      }
      p += len;
    }
  }
  if (buffer.length >= 30 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') {
    if (buffer.readUInt32LE(4) + 8 !== buffer.length) fail(422, 'INVALID_IMAGE', 'File WebP không đầy đủ');
    const kind = buffer.toString('ascii',12,16);
    if (kind === 'VP8X' && buffer.length >= 30) {
      return { type:'image/webp', ...validateDimensions(buffer.readUIntLE(24,3)+1, buffer.readUIntLE(27,3)+1) };
    }
    if (kind === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return { type:'image/webp', ...validateDimensions(buffer.readUInt16LE(26)&0x3fff, buffer.readUInt16LE(28)&0x3fff) };
    }
    if (kind === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const w = 1 + (buffer[21] | ((buffer[22] & 0x3f) << 8));
      const h = 1 + ((buffer[22] >> 6) | (buffer[23] << 2) | ((buffer[24] & 0x0f) << 10));
      return { type:'image/webp', ...validateDimensions(w, h) };
    }
  }
  fail(422, 'INVALID_IMAGE', 'Ảnh không hợp lệ; chỉ nhận JPG, PNG, WebP thực sự');
}
function audit(user, action, book, before, after) {
  getDb().auditLogs.unshift({ rowId: nextId(), occurredAt:new Date().toISOString(), actorUserRowId:user.rowId,
    actorType:'USER', actorRoleSnapshot:user.role, actionSource:'WEB', actionCode:action, tableName:'Books',recordRowId:book.rowId,
    oldValues: before ? { fileName:before.fileName, sizeBytes:before.sizeBytes } : null,
    newValues: after ? { fileName:after.fileName, sizeBytes:after.sizeBytes, width:after.width, height:after.height } : null,
    requestId:null });
}
function dataFor(book) {
  return { rowId: book.rowId, bookId: book.bookId, version: book.version, hasCover: !!book.cover, coverUpdatedAt: book.cover?.uploadedAt || null,
    coverUrl: book.cover ? `/api/v1/shop/books/${book.rowId}/cover?v=${book.version}` : null };
}

export async function uploadCover(req, user, id) {
  const book = adminBook(user, id);
  requireVersion(book, req.headers['if-match']);
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!Object.hasOwn(EXTENSIONS,type)) fail(415,'UNSUPPORTED_MEDIA_TYPE','Chỉ hỗ trợ JPG, PNG và WebP');
  const fileName = cleanName(req.headers['x-file-name'],EXTENSIONS[type]);
  if (Number(req.headers['content-length']) > MAX_COVER_BYTES) fail(413,'FILE_TOO_LARGE','Ảnh bìa tối đa 5MB');
  const parts=[];let length=0;
  for await (const chunk of req) {
    length+=chunk.length;
    if (length>MAX_COVER_BYTES) fail(413,'FILE_TOO_LARGE','Ảnh bìa tối đa 5MB');
    parts.push(chunk);
  }
  const bytes=Buffer.concat(parts);
  if (!bytes.length) fail(422,'INVALID_IMAGE','Vui lòng chọn ảnh không rỗng');
  const detected=detectImage(bytes);
  if (detected.type !== type) fail(422,'INVALID_IMAGE','Định dạng ảnh không khớp với loại file đã gửi');
  fs.mkdirSync(folder,{recursive:true});
  const storageKey = crypto.randomUUID()+'.'+EXTENSIONS[type];
  const fullPath = path.join(folder,storageKey);
  fs.writeFileSync(fullPath,bytes,{flag:'wx',mode:0o600});
  const oldCover=book.cover || null, oldVersion=book.version;
  const cover={ storageKey, fileName, mimeType:type, sizeBytes:length, width:detected.width, height:detected.height, uploadedAt:new Date().toISOString() };
  const auditLen=getDb().auditLogs.length;
  try {
    book.cover=cover;
    book.version++;
    audit(user,'BOOK_COVER_UPLOAD',book,oldCover,cover);
    saveDb();
  } catch(error) {
    if (oldCover) book.cover=oldCover; else delete book.cover;
    book.version=oldVersion;
    getDb().auditLogs.splice(0,getDb().auditLogs.length-auditLen);
    fs.rmSync(fullPath,{force:true});
    throw error;
  }
  if (oldCover?.storageKey) fs.rmSync(path.join(folder,path.basename(oldCover.storageKey)),{force:true});
  return {status:201,data:dataFor(book)};
}

export function deleteCover(user, id, ifMatch) {
  const book=adminBook(user,id);
  requireVersion(book,ifMatch);
  if (!book.cover) fail(404,'COVER_NOT_FOUND','Sách chưa có ảnh bìa');
  const oldCover=book.cover, oldVersion=book.version;
  const auditLen=getDb().auditLogs.length;
  try {
    delete book.cover;
    book.version++;
    audit(user,'BOOK_COVER_REMOVE',book,oldCover,null);
    saveDb();
  } catch(error) {
    book.cover=oldCover;
    book.version=oldVersion;
    getDb().auditLogs.splice(0,getDb().auditLogs.length-auditLen);
    throw error;
  }
  if (oldCover.storageKey) fs.rmSync(path.join(folder,path.basename(oldCover.storageKey)),{force:true});
  return {status:200,data:dataFor(book)};
}

export function streamCover(res, user, id, isAdmin=false, headOnly=false) {
  let book;
  if (isAdmin) book=adminBook(user,id);
  else {
    book=getDb().books.find((b)=>b.rowId===Number(id) && !b.isDel && b.status==='PUBLISHED' && b.servingStatus==='ACTIVE');
    if (!book) fail(404,'NOT_FOUND','Không tìm thấy ảnh bìa');
  }
  if (!book.cover?.storageKey) fail(404,'COVER_NOT_FOUND','Sách chưa có ảnh bìa');
  const fullPath=path.join(folder,path.basename(book.cover.storageKey));
  if (!fs.existsSync(fullPath)) fail(404,'COVER_NOT_FOUND','File ảnh không còn trên máy chủ');
  const length=fs.statSync(fullPath).size;
  res.writeHead(200,{ 'Content-Type':book.cover.mimeType,'Content-Length':length,'Content-Disposition':'inline',
    'Cache-Control': isAdmin ? 'private, no-cache' : 'public, no-cache', 'X-Content-Type-Options':'nosniff' });
  if (headOnly) { res.end(); return; }
  fs.createReadStream(fullPath).pipe(res);
}

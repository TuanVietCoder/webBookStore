import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getDb, saveDb, nextId } from './store.js';
import { paidBookIds } from './shopRoutes.js';
import { fail } from './http.js';
import { demoPdf } from './demoPdf.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.resolve(process.env.PDF_DIR || path.join(root, 'storage'));
const MAX_PDF = 50 * 1024 * 1024;

const safeName = (name) => String(name || 'book.pdf').replace(/[\\/\x00-\x1f\x7f"<>:|?*]+/g, '_').slice(0, 150);
export async function uploadPdf(req, user, id) {
  if (!user) fail(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập Admin');
  if (!['EMPLOYEE','MANAGER'].includes(user.role)) fail(403, 'FORBIDDEN', 'Chỉ nhân sự được tải file PDF');
  if (!String(req.headers['content-type'] || '').startsWith('application/pdf')) fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Chỉ nhận application/pdf');
  const filename = safeName(decodeURIComponent(req.headers['x-file-name'] || 'book.pdf'));
  if (!filename.toLowerCase().endsWith('.pdf')) fail(422, 'VALIDATION_ERROR', 'Tên file phải có đuôi .pdf', { field: 'fileName' });
  const db=getDb();
  const book=db.books.find((b)=>b.rowId===Number(id)&&!b.isDel);
  if (!book) fail(404,'NOT_FOUND','Không tìm thấy sách');
  const parts=[];let length=0;
  for await (const chunk of req) {
    length+=chunk.length;
    if (length>MAX_PDF) fail(413,'FILE_TOO_LARGE','Kích thước PDF tối đa 50MB');
    parts.push(chunk);
  }
  const data=Buffer.concat(parts);
  if (data.length<8 || data.subarray(0,5).toString('ascii')!=='%PDF-') fail(422,'INVALID_PDF','Tệp tải lên không có định dạng PDF hợp lệ');
  fs.mkdirSync(folder,{recursive:true});
  const storageKey=crypto.randomUUID()+'.pdf';
  fs.writeFileSync(path.join(folder,storageKey),data,{flag:'wx',mode:0o600});
  book.files.forEach((f)=>{ f.active=false; });
  const file={rowId:nextId(),version:book.files.length+1,fileName:filename,sizeBytes:data.length,active:true,storageKey};
  book.files.push(file);book.version++;
  db.auditLogs.unshift({rowId:nextId(),occurredAt:new Date().toISOString(),actorUserRowId:user.rowId,actorType:'USER',actorRoleSnapshot:user.role,
    actionSource:'WEB',actionCode:'BOOK_FILE_UPLOAD',tableName:'Books',recordRowId:book.rowId,oldValues:null,newValues:{fileName:filename,sizeBytes:data.length},requestId:null});
  saveDb();
  return {status:201,data:{...book,authorNames:book.authorIds.map((a)=>db.authors.find((v)=>v.rowId===a)?.name).filter(Boolean),categoryName:db.categories.find((c)=>c.rowId===book.categoryId)?.name,publisherName:db.publishers.find((p)=>p.rowId===book.publisherId)?.name}};
}

export function streamPdf(res,user,id,{inline=false}={}) {
  if (!user) fail(401,'UNAUTHENTICATED','Bạn cần đăng nhập để tải sách');
  if (user.role!=='BUYER') fail(403,'FORBIDDEN','Chỉ khách hàng được tải sách đã mua');
  const db=getDb();const book=db.books.find((b)=>b.rowId===Number(id));
  if (!book || book.isDel || book.status!=='PUBLISHED' || book.servingStatus!=='ACTIVE') fail(404,'BOOK_UNAVAILABLE','Sách hiện không được phục vụ');
  if (!paidBookIds(db,user.rowId).has(book.rowId)) fail(403,'PURCHASE_REQUIRED','Bạn chưa có quyền tải cuốn sách này');
  const file=book.files.find((f)=>f.active&&f.storageKey);
  const asciiName=`book-${book.rowId}.pdf`;
  if (file) {
    const fullPath=path.join(folder,path.basename(file.storageKey));
    if (!fs.existsSync(fullPath)) fail(404,'PDF_NOT_FOUND','Tệp PDF của sách hiện không khả dụng; vui lòng liên hệ hỗ trợ');
    const unicodeName=encodeURIComponent(file.fileName);
    const length=fs.statSync(fullPath).size;
    res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':length,
      'Content-Disposition':`${inline?'inline':'attachment'}; filename="${asciiName}"; filename*=UTF-8''${unicodeName}`,
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff', 'X-Book-Content':'uploaded'});
    fs.createReadStream(fullPath).pipe(res);
    return;
  }
  // Neu Admin chua tai PDF that, sinh PDF demo rieng cho cuon sach dang duoc phep doc.
  const sample=demoPdf(book);
  res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':sample.length,
    'Content-Disposition':`${inline?'inline':'attachment'}; filename="demo-${asciiName}"`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff', 'X-Book-Content':'demo'});
  res.end(sample);
}

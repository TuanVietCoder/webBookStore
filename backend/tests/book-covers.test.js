import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const dir=path.dirname(fileURLToPath(import.meta.url));
const fixtures=(name)=>fs.readFileSync(path.join(dir,'fixtures',name));

test('Admin uploads/replaces/deletes real covers; Client receives only published covers; old databases remain compatible',async(t)=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'webbook-covers-'));
  const port=39000+Math.floor(Math.random()*1000);
  const host=`http://127.0.0.1:${port}`;
  const storage=path.join(tmp,'storage');
  const dbPath=path.join(tmp,'data','db.json');
  const child=spawn(process.execPath,['src/server.js'],{cwd:path.resolve(dir,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_FILE:dbPath,COVER_DIR:storage,OPENAI_API_KEY:''},stdio:'pipe'});
  let stderr='';child.stderr.on('data',(c)=>stderr+=c.toString());
  t.after(()=>{child.kill();fs.rmSync(tmp,{recursive:true,force:true});});
  let ready=false;
  for(let i=0;i<100;i++) {
    try { if((await fetch(host+'/health')).ok){ready=true;break;} }catch{}
    await delay(80);
  }
  assert(ready,'Cannot start backend: '+stderr);

  async function json(method,route,body,token,version) {
    const res=await fetch(host+'/api/v1'+route,{method,headers:{
      ...(token?{Authorization:'Bearer '+token}:{}),...(version!=null?{'If-Match':String(version)}:{}),
      ...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:res.status,data:await res.json()};
  }
  const upload=(id,token,version,mime,name,bytes)=>fetch(`${host}/api/v1/admin/books/${id}/cover`,{
    method:'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(version!=null?{'If-Match':String(version)}:{}),
      'Content-Type':mime,'X-File-Name':encodeURIComponent(name)},body:bytes});
  const get=(route,token)=>fetch(host+'/api/v1'+route,{headers:token?{Authorization:'Bearer '+token}:{}});
  const login=await json('POST','/auth/login',{email:'manager@nhasach.test',password:'Manager@123',audience:'STAFF'});
  assert.equal(login.status,200,JSON.stringify(login.data));
  const manager=login.data.accessToken;
  const buyer=(await json('POST','/auth/login',{email:'an@mail.test',password:'Buyer@123',audience:'BUYER'})).data.accessToken;
  const first=await json('GET','/admin/books/1',null,manager);
  assert.equal(first.status,200);
  assert.equal(first.data.hasCover,false,'Old demo books work without a cover field');
  assert.equal((await json('GET','/shop/books/1')).data.coverUrl,null);
  assert.equal((await get('/shop/books/1/cover')).status,404);
  assert.equal((await get('/admin/books/1/cover')).status,401);
  assert.equal((await get('/admin/books/1/cover',buyer)).status,403);
  const source=fixtures('cover-first.png');
  assert.equal((await upload(1,null,first.data.version,'image/png','cover-first.png',source)).status,401);
  assert.equal((await upload(1,buyer,first.data.version,'image/png','cover-first.png',source)).status,403);
  assert.equal((await upload(1,manager,null,'image/png','cover-first.png',source)).status,428);
  assert.equal((await upload(1,manager,first.data.version+1,'image/png','cover-first.png',source)).status,409);
  assert.equal((await upload(1,manager,first.data.version,'image/svg+xml','cover.svg',Buffer.from('<svg onload=alert(1)>'))).status,415);
  assert.equal((await upload(1,manager,first.data.version,'image/png','cover-first.png',Buffer.from('not a PNG'))).status,422);
  assert.equal((await upload(1,manager,first.data.version,'image/jpeg','cover.jpg',source)).status,422,'MIME does not match image signature');
  assert.equal((await upload(1,manager,first.data.version,'image/png','cover.svg',source)).status,422,'Bad filename extension');
  assert.equal((await upload(1,manager,first.data.version,'image/png','cover-first.png',Buffer.alloc(5*1024*1024+1,0x41))).status,413,'Over 5MB rejected');
  assert.equal(fs.existsSync(storage),false,'Rejected uploads must not create image files');
  const initial=await upload(1,manager,first.data.version,'image/png','cover-first.png',source);
  assert.equal(initial.status,201,await initial.text());
  const initialBody=await json('GET','/admin/books/1',null,manager);
  assert.equal(initialBody.data.hasCover,true);
  assert.equal(initialBody.data.cover.mimeType,'image/png');
  assert.equal(initialBody.data.cover.width,360);
  assert.equal(initialBody.data.cover.height,520);
  const initialPath=path.join(storage,initialBody.data.cover.storageKey);
  assert(fs.existsSync(initialPath));
  const publicBook=(await json('GET','/shop/books/1')).data;
  assert.equal(publicBook.coverUrl,`/api/v1/shop/books/1/cover?v=${initialBody.data.version}`);
  assert(!Object.hasOwn(publicBook,'storageKey'));
  const publicImage=await get('/shop/books/1/cover');
  assert.equal(publicImage.status,200);
  assert.equal(publicImage.headers.get('content-type'),'image/png');
  assert.equal(publicImage.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()),source);
  const quoted=await json('POST','/shop/checkout/quote',{items:[{type:'BOOK',id:1,quantity:1}]});
  assert.equal(quoted.status,200);
  assert.equal(quoted.data.items[0].coverUrl,publicBook.coverUrl,'Cart quote includes the same cover as the catalogue');
  assert.equal((await get('/admin/books/1/cover',manager)).status,200);
  assert.equal((await fetch(host+'/api/v1/shop/books/1/cover',{method:'HEAD'})).status,200);
  const question=await json('POST','/shop/chat',{message:'Mắt biếc giá bao nhiêu?'});
  assert.equal(question.status,200);
  assert.equal(question.data.books[0].coverUrl,publicBook.coverUrl,'Chatbot cover is same as Client catalogue');

  const second=fixtures('cover-second.jpg');
  const replaced=await upload(1,manager,initialBody.data.version,'image/jpeg','cover-second.jpg',second);
  assert.equal(replaced.status,201,await replaced.text());
  const afterReplace=(await json('GET','/admin/books/1',null,manager)).data;
  assert.equal(afterReplace.cover.mimeType,'image/jpeg');
  assert.notEqual(afterReplace.version,initialBody.data.version);
  assert.equal(fs.existsSync(initialPath),false,'Old cover file removed after successful replacement');
  assert.deepEqual(Buffer.from(await (await get('/shop/books/1/cover')).arrayBuffer()),second);
  assert.equal((await upload(1,manager,initialBody.data.version,'image/png','cover-first.png',source)).status,409,'Cannot overwrite with stale version');
  const third=fixtures('cover-third.webp');
  const webp=await upload(1,manager,afterReplace.version,'image/webp','cover-third.webp',third);
  assert.equal(webp.status,201,await webp.text());
  const webpPreview=await get('/shop/books/1/cover');
  assert.equal(webpPreview.headers.get('content-type'),'image/webp');
  assert.deepEqual(Buffer.from(await webpPreview.arrayBuffer()),third);

  const beforeHide=(await json('GET','/admin/books/1',null,manager)).data;
  const hide=await json('PATCH','/admin/books/1',{status:'HIDDEN'},manager,beforeHide.version);
  assert.equal(hide.status,200);
  assert.equal((await get('/shop/books/1/cover')).status,404,'Unpublished book cover is private');
  assert.equal((await get('/admin/books/1/cover',manager)).status,200,'Staff can still preview hidden book');
  assert.equal((await json('PATCH','/admin/books/1',{status:'PUBLISHED'},manager,hide.data.version)).status,200);
  const beforeDelete=(await json('GET','/admin/books/1',null,manager)).data;
  const oldPath=path.join(storage,beforeDelete.cover.storageKey);
  assert.equal((await json('DELETE','/admin/books/1/cover',null,buyer,beforeDelete.version)).status,403);
  assert.equal((await json('DELETE','/admin/books/1/cover',null,manager,beforeDelete.version-1)).status,409);
  const removed=await json('DELETE','/admin/books/1/cover',null,manager,beforeDelete.version);
  assert.equal(removed.status,200);
  assert.equal(removed.data.hasCover,false);
  assert.equal(fs.existsSync(oldPath),false);
  assert.equal((await json('GET','/shop/books/1')).data.coverUrl,null,'Client falls back to CSS if image deleted');
  assert.equal((await get('/shop/books/1/cover')).status,404);

  const draft=await json('POST','/admin/books',{bookId:'BKCOVERDRAFT',title:'Sách thử ảnh nháp',authorIds:[1],categoryId:1,publisherId:1,price:89000},manager);
  assert.equal(draft.status,201);
  const newCover=await upload(draft.data.rowId,manager,draft.data.version,'image/png','cover-first.png',source);
  assert.equal(newCover.status,201);
  assert.equal((await get(`/shop/books/${draft.data.rowId}/cover`)).status,404,'Draft book images are not public');
  assert.equal((await get(`/admin/books/${draft.data.rowId}/cover`,manager)).status,200);
  const db=JSON.parse(fs.readFileSync(dbPath));
  assert.equal(db.books.find(b=>b.rowId===draft.data.rowId).cover.mimeType,'image/png','Cover metadata persists in shared JSON database');
  assert(db.auditLogs.some((a)=>a.actionCode==='BOOK_COVER_UPLOAD'));
  assert(db.auditLogs.some((a)=>a.actionCode==='BOOK_COVER_REMOVE'));
});

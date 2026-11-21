import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { seed } from '../src/seed.js';
import { eventHero, eventRibbon, eventPreview, eventOffers } from '../../frontend/client/js/eventUI.js';

const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAY=86400000;
const iso=(offset)=>new Date(Date.now()+offset*DAY).toISOString();
const port=49000+Math.floor(Math.random()*6000);

test('Approved running events take over Client banners, apply prices, and disappear when disabled',async(t)=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'webbook-live-event-'));
  const server=spawn(process.execPath,['src/server.js'],{cwd:backend,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_FILE:path.join(temp,'db.json'),PDF_DIR:path.join(temp,'storage'),OPENAI_API_KEY:''},stdio:'pipe'});
  let stderr='';server.stderr.on('data',(c)=>{stderr+=String(c)});
  t.after(()=>{server.kill();fs.rmSync(temp,{recursive:true,force:true});});
  const root=`http://127.0.0.1:${port}`;
  let ok=false;for(let i=0;i<100;i++){try{if((await fetch(root+'/health')).ok){ok=true;break;}}catch{}await delay(65);}
  assert(ok,'Server failed: '+stderr);
  const call=async(method,url,body,token)=>{
    const r=await fetch(root+'/api/v1'+url,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  };
  const g=(uri,token)=>call('GET',uri,null,token);
  const post=(uri,body,token)=>call('POST',uri,body,token);
  const staff=await post('/auth/login',{email:'manager@nhasach.test',password:'Manager@123',audience:'STAFF'});
  const manager=staff.data.accessToken;
  const buyer=await post('/auth/register',{email:'eventbuyer@example.com',fullName:'Khách thử Event',password:'TestSecure1234!'});
  const buyerToken=buyer.data.accessToken;
  assert.equal((await g('/admin/events',buyerToken)).status,403);

  const initial=await g('/shop/events');
  assert.equal(initial.status,200);
  assert.equal(initial.data.items.length,1,'Only approved & currently running seed Event is public');
  const campaign=initial.data.items[0];
  assert.equal(campaign.code,'BOOK_SALE');
  assert.equal(campaign.theme,'FOREST');
  assert.equal(campaign.headline,'Mở trang sách. Chạm ưu đãi.');
  assert(campaign.bookCount>=1 && campaign.books.some((x)=>x.rowId===1));
  assert(!JSON.stringify(initial.data).includes('selectedRevNo'));
  assert(!JSON.stringify(initial.data).includes('Sale chồng lịch để thử từ chối'));
  assert.equal((await g('/shop/events/2')).status,404,'Scheduled TET cannot leak early');
  assert.equal((await g('/shop/events/3')).status,404,'Pending Event cannot leak');
  const home=await g('/shop/home');
  assert.deepEqual(home.data.activeEvents[0].rowId,campaign.rowId);
  const book=(await g('/shop/books/1')).data;
  assert.equal(book.currentPrice,48000);
  assert.deepEqual(book.promotionEvent,{rowId:1,name:'Book Sale tháng này'});
  const quote=await post('/shop/checkout/quote',{items:[{type:'BOOK',id:1,quantity:1}]},buyerToken);
  assert.equal(quote.data.total,48000);
  assert.equal(quote.data.eventDiscount,12000);

  // Approved Event after date start, as well as valid theme and customer copy.
  assert.equal((await post('/admin/events/1/disable',{reason:'Dừng sự kiện cũ để test chương trình mới'},manager)).status,200);
  assert.equal((await g('/shop/events')).data.items.length,0);
  assert.equal((await g('/shop/books/1')).data.currentPrice,60000);
  assert.equal((await post('/shop/checkout/quote',{items:[{type:'BOOK',id:1,quantity:1}]},buyerToken)).data.total,60000);
  const payload={name:'Midnight Reading Night',type:'BOOK_SALE',headline:'Một đêm, ngàn câu chuyện',description:'Ưu đãi tối nay dành cho người yêu sách.',badgeText:'CHỈ CÓ TRONG EVENT',theme:'MIDNIGHT',startAt:iso(-.01),endAt:iso(.75),bookDiscounts:[{bookId:1,salePrice:35000}]};
  assert.equal((await post('/admin/events',{code:'XSS_BAD',data:{...payload,headline:'x'.repeat(101)}},manager)).status,422);
  assert.equal((await post('/admin/events',{code:'THEME_BAD',data:{...payload,theme:'HACK_STYLE'}},manager)).status,422);
  const draft=await post('/admin/events',{code:'EVENT_NIGHT',data:payload},manager);
  assert.equal(draft.status,201,JSON.stringify(draft.data));
  const id=draft.data.rowId;
  assert.equal((await g('/shop/events')).data.items.length,0,'Draft invisible');
  assert.equal((await post(`/admin/events/${id}/revisions/1/submit`,{},manager)).status,200);
  assert.equal((await g('/shop/events')).data.items.length,0,'Pending invisible');
  const approved=await post(`/admin/events/${id}/revisions/1/approve`,{},manager);
  assert.equal(approved.status,200,JSON.stringify(approved.data));
  const nowLive=await g('/shop/events');
  assert.equal(nowLive.data.items.length,1);
  const campaign2=nowLive.data.items[0];
  assert.equal(campaign2.code,'EVENT_NIGHT');assert.equal(campaign2.theme,'MIDNIGHT');
  assert.equal(campaign2.headline,payload.headline);
  assert.equal(campaign2.books[0].currentPrice,35000);
  assert.equal((await g('/shop/events/'+id)).data.headline,payload.headline);
  assert.equal((await post('/shop/checkout/quote',{items:[{type:'BOOK',id:1,quantity:1}]},buyerToken)).data.total,35000);
  assert.equal((await post(`/admin/events/${id}/disable`,{reason:'Dừng sự kiện thử nghiệm'},buyerToken)).status,403);
  assert.equal((await post(`/admin/events/${id}/disable`,{reason:'Dừng sự kiện thử nghiệm'},manager)).status,200);
  assert.equal((await g('/shop/events/'+id)).status,404);
  assert.equal((await g('/shop/events')).data.items.length,0);
  assert.equal((await g('/shop/home')).data.activeEvents.length,0);

  // Static assets are available without a framework/build step.
  for(const resource of ['/client/js/eventUI.js','/client/css/events.css']) {
    assert.equal((await fetch(root+resource)).status,200,resource);
  }
});

test('Scheduled approved revision becomes live at start while future/expired revisions stay private',async(t)=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'webbook-event-revisions-'));
  const data=seed();
  data.events[0].selectedRevNo=1;
  data.events[0].scheduledRevNo=2;
  data.events[0].revisions[0].data.startAt=iso(-20);
  data.events[0].revisions[0].data.endAt=iso(-10);
  data.events[0].revisions.push({...data.events[0].revisions[0],no:2,rowId:999901,data:{...data.events[0].revisions[0].data,
    name:'Đã đến giờ bàn giao',headline:'Sự kiện thay thế đã chạy',theme:'SUNSET',startAt:iso(-1),endAt:iso(1),bookDiscounts:[{bookId:1,salePrice:42000}]}});
  data.events[1].isActive=false;
  const dbfile=path.join(temp,'db.json');fs.writeFileSync(dbfile,JSON.stringify(data));
  const secondPort=port+1;
  const server=spawn(process.execPath,['src/server.js'],{cwd:backend,env:{...process.env,PORT:String(secondPort),HOST:'127.0.0.1',DATA_FILE:dbfile,PDF_DIR:path.join(temp,'storage'),OPENAI_API_KEY:''},stdio:'pipe'});
  t.after(()=>{server.kill();fs.rmSync(temp,{recursive:true,force:true});});
  const root=`http://127.0.0.1:${secondPort}`;
  let running=false;for(let i=0;i<90;i++){try{if((await fetch(root+'/health')).ok){running=true;break;}}catch{}await delay(70);}
  assert(running,'Could not start scheduled test server');
  const res=await (await fetch(root+'/api/v1/shop/events')).json();
  assert.equal(res.items.length,1);
  assert.equal(res.items[0].headline,'Sự kiện thay thế đã chạy');
  assert.equal(res.items[0].theme,'SUNSET');
  assert.equal((await (await fetch(root+'/api/v1/shop/books/1')).json()).currentPrice,42000);
});

test('Event UI escapes Admin-supplied HTML, themes are allowlisted, and customer links stay internal',()=>{
  const event={rowId:3,name:'X<svg onload=alert(1)>',headline:'Ưu đãi <script>alert(1)</script>',description:'<img src=x onerror=alert(1)>',badgeText:'EVENT',theme:'evil-css',startAt:iso(-1),endAt:iso(1),maxDiscountPercent:20,bookCount:1,bundleCount:0,books:[{rowId:1,title:'Sách mẫu'}],bundles:[]};
  const hero=eventHero(event,(b)=>`<div>${b.title}</div>`);
  const ribbon=eventRibbon(event);
  const preview=eventPreview(event);
  assert(hero.includes('theme-forest'));
  assert(!hero.includes('<script>'));
  assert(!hero.includes('<img src=x'));
  assert(hero.includes('&lt;script&gt;'));
  assert(!ribbon.includes('<svg'));
  assert(ribbon.includes('#/events/3'));
  assert(!preview.includes('<svg'));
  const offers=eventOffers(event,()=>'<article>Test</article>',()=>'<article>Bundle</article>');
  assert.match(offers,/Sách nổi bật/);
  assert.match(offers,/Test/);
});

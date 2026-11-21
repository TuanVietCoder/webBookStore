import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const temp = fs.mkdtempSync(path.join(os.tmpdir(),'webbook-'));
const PORT = 31000 + Math.floor(Math.random()*1000);
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server;
async function call(method, url, body, token) {
  const response=await fetch(ORIGIN+'/api/v1'+url,{method,headers:{ ...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}) },body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  return {status:response.status,data};
}
const get=(p,t)=>call('GET',p,null,t),post=(p,b,t)=>call('POST',p,b,t),patch=(p,b,t,version)=>fetch(ORIGIN+'/api/v1'+p,{method:'PATCH',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json','If-Match':String(version)},body:JSON.stringify(b)}).then(async res=>({status:res.status,data:await res.json()}));

test('Admin and Client share one persistent, role-separated API', async (t)=>{
  server=spawn(process.execPath,['src/server.js'],{cwd:path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',DATA_FILE:path.join(temp,'database.json'),DEMO_PAYMENTS_ENABLED:'true',PDF_DIR:path.join(temp,'storage')},stdio:'pipe'});
  let output='';server.stderr.on('data',(d)=>output+=d.toString());
  t.after(()=>{server?.kill();fs.rmSync(temp,{recursive:true,force:true});});
  let running=false;
  for(let i=0;i<80;i++){
    try{const r=await fetch(ORIGIN+'/health');if(r.ok){running=true;break;}}catch{}
    await delay(100);
  }
  assert.equal(running,true,'Cannot start backend: '+output);
  const [clientPage,adminPage,adminJS]=await Promise.all([fetch(ORIGIN+'/'),fetch(ORIGIN+'/admin/'),fetch(ORIGIN+'/admin/js/app.js')]);
  assert.equal(clientPage.status,200);assert.equal(adminPage.status,200);assert.equal(adminJS.status,200);
  assert.match(await clientPage.text(),/client\/js\/app/);
  assert.match(await adminPage.text(),/Quản trị Nhà sách PDF/);

  const initial=await get('/shop/books',{ });
  assert.equal(initial.status,200);
  assert(initial.data.items.length>0);
  assert(initial.data.items.every((b)=>!Object.hasOwn(b,'passwordHash')&&b.status===undefined));
  assert(!initial.data.items.some((b)=>b.title==='Nhà giả kim'));
  const staff=await post('/auth/login',{email:'manager@nhasach.test',password:'Manager@123',audience:'STAFF'});
  assert.equal(staff.status,200,JSON.stringify(staff.data));
  const adminToken=staff.data.accessToken;
  assert.equal(staff.data.user.role,'MANAGER');
  assert.equal((await post('/auth/login',{email:'manager@nhasach.test',password:'Manager@123',audience:'BUYER'})).status,401);

  const buyer=await post('/auth/register',{email:'testbuyer@example.com',fullName:'Khách hàng thử nghiệm',password:'MySecure123!'});
  assert.equal(buyer.status,201,JSON.stringify(buyer.data));
  const token=buyer.data.accessToken;
  assert.equal(buyer.data.user.role,'BUYER');
  assert.equal((await get('/admin/books',token)).status,403,'Buyer cannot use Admin APIs');
  assert.equal((await get('/shop/orders',adminToken)).status,403,'Staff cannot use Buyer APIs');
  assert.equal((await get('/auth/me',token)).data.user.email,'testbuyer@example.com');

  const code='BKTEST'+Date.now();
  const created=await post('/admin/books',{bookId:code,title:'Sách tích hợp Admin và Client',authorIds:[1],categoryId:1,publisherId:1,price:99000,description:'Quyển sách được thêm bởi Admin trên cùng backend.'},adminToken);
  assert.equal(created.status,201,JSON.stringify(created.data));
  const id=created.data.rowId;
  assert.equal((await get('/shop/books?q=S%C3%A1ch%20t%C3%ADch%20h%E1%BB%A3p')).data.total,0,'Draft not public');
  const file=await post('/admin/books/'+id+'/files',{fileName:'newbook.pdf',sizeBytes:90000},adminToken);
  assert.equal(file.status,201,JSON.stringify(file.data));
  const published=await patch('/admin/books/'+id,{status:'PUBLISHED'},adminToken,file.data.version);
  assert.equal(published.status,200,JSON.stringify(published.data));
  const visible=await get('/shop/books/'+id);
  assert.equal(visible.status,200);
  assert.equal(visible.data.title,'Sách tích hợp Admin và Client');
  assert.equal(visible.data.currentPrice,99000);
  assert.equal((await get('/shop/library/'+id+'/pdf',token)).status,403,'Not purchased cannot download');
  const pdfContent=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
  const uploadedResponse=await fetch(ORIGIN+'/api/v1/admin/books/'+id+'/pdf',{ method:'POST',headers:{Authorization:'Bearer '+adminToken,'Content-Type':'application/pdf','X-File-Name':encodeURIComponent('tai-lieu.pdf')},body:pdfContent });
  assert.equal(uploadedResponse.status,201,await uploadedResponse.text());
  assert.equal((await get('/shop/books/'+id)).data.canDownload,true);


  const favorited=await post('/shop/favorites/'+id,{},token);
  assert.equal(favorited.status,200);
  assert.equal((await get('/shop/favorites',token)).data.items[0].rowId,id);
  const quote=await post('/shop/checkout/quote',{items:[{type:'BOOK',id,quantity:2}]},token);
  assert.equal(quote.status,200);assert.equal(quote.data.total,198000);
  const order=await post('/shop/orders',{items:[{type:'BOOK',id,quantity:2}],total:1},token);
  assert.equal(order.status,201,JSON.stringify(order.data));
  assert.equal(order.data.total,198000,'Client cannot spoof prices');
  assert.equal(order.data.status,'PENDING_PAYMENT');
  const paid=await post('/shop/orders/'+order.data.rowId+'/demo-pay',{},token);
  assert.equal(paid.status,200); assert.equal(paid.data.status,'PAID');
  assert.equal((await get('/shop/library',token)).data.items.find((b)=>b.rowId===id).title,'Sách tích hợp Admin và Client');
  const download=await fetch(ORIGIN+'/api/v1/shop/library/'+id+'/pdf',{headers:{Authorization:'Bearer '+token}});
  assert.equal(download.status,200,'Buyer can download paid PDF');
  assert.match(download.headers.get('content-type'),/application\/pdf/);
  assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0,5).toString(),'%PDF-');

  const adminOrders=await get('/admin/orders?q='+order.data.orderId,adminToken);
  assert.equal(adminOrders.status,200);assert.equal(adminOrders.data.total,1,'Admin sees Client order');
  assert.equal(adminOrders.data.items[0].total,198000);

  const review=await post('/shop/reviews',{bookId:id,rating:5,content:'Rất tốt cho việc thử tích hợp.'},token);
  assert.equal(review.status,201,JSON.stringify(review.data));
  assert.equal((await get('/shop/books/'+id)).data.reviews[0].rating,5);
  const report=await post('/shop/content-reports',{targetType:'REVIEW',targetRowId:review.data.rowId,reason:'Kiểm tra kiểm duyệt'},token);
  assert.equal(report.status,201);
  assert.equal((await get('/admin/content-reports?status=PENDING',adminToken)).data.items.some((r)=>r.rowId===report.data.rowId),true);
  const moderated=await post('/admin/content-reports/'+report.data.rowId,{decision:'ACCEPT',note:'Duyệt ẩn để test'},adminToken);
  assert.equal(moderated.status,200);assert.equal((await get('/shop/books/'+id)).data.reviews.length,0);

  const complaint=await post('/shop/complaints',{orderRowId:order.data.rowId,subject:'Thắc mắc về việc giao sách',message:'Tôi cần được hỗ trợ truy cập sách.'},token);
  assert.equal(complaint.status,201,JSON.stringify(complaint.data));
  assert.equal((await get('/admin/complaints?status=OPEN',adminToken)).data.items.some((x)=>x.rowId===complaint.data.rowId),true);
  const internal=await post('/complaints/'+complaint.data.rowId+'/messages',{body:'Lưu ý nội bộ',internal:true},adminToken);
  assert.equal(internal.status,201);
  const staffReply=await post('/complaints/'+complaint.data.rowId+'/messages',{body:'Đã tiếp nhận và đang kiểm tra.',internal:false},adminToken);
  assert.equal(staffReply.status,201);
  const buyerView=await get('/shop/complaints/'+complaint.data.rowId,token);
  assert.equal(buyerView.data.messages.some((x)=>x.body==='Lưu ý nội bộ'),false,'Internal notes stay private');
  assert.equal(buyerView.data.messages.some((x)=>x.body==='Đã tiếp nhận và đang kiểm tra.'),true);
  assert.equal((await get('/shop/orders/'+order.data.rowId,adminToken)).status,403);
  const other=await post('/auth/register',{email:'other@example.com',fullName:'Người mua khác',password:'MySecure123!'});
  assert.equal((await get('/shop/orders/'+order.data.rowId,other.data.accessToken)).status,404,'Other buyer cannot see order');
  assert.equal((await get('/shop/library/'+id+'/pdf',other.data.accessToken)).status,403,'Other buyer cannot download paid PDF');


  const disabled=await post('/admin/users/'+buyer.data.user.rowId+'/disable',{reason:'Khóa test theo nghiệp vụ'},adminToken);
  assert.equal(disabled.status,200);
  assert.equal((await get('/auth/me',token)).status,401,'Disabled user session revoked');
  assert.equal((await get('/shop/orders',token)).status,401);
  const stored=JSON.parse(fs.readFileSync(path.join(temp,'database.json')));
  assert(!JSON.stringify(stored.users).includes('MySecure123!'),'Passwords hashed at rest');
  assert(!JSON.stringify(stored.users).includes('Manager@123'),'Seed passwords hashed at rest');
  assert.equal(stored.orders.some((o)=>o.rowId===order.data.rowId&&o.status==='PAID'),true);
});

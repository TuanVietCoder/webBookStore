import test from 'node:test';
import assert from 'node:assert/strict';

const sampleBook={rowId:1,bookId:'BK001',title:'Mắt biếc',description:'Sách kiểm thử',authorNames:['Nguyễn Nhật Ánh'],categoryName:'Văn học',categoryId:1,
  publisherName:'NXB Trẻ',price:60000,currentPrice:48000,salePrice:48000,rating:4.5,reviewCount:1,reviews:[{rowId:1,authorName:'Khách',rating:5,content:'Rất hay'}]};
const sampleBundle={rowId:1,code:'BDL-1',name:'Combo Văn học',type:'FIXED',price:100000,pickCount:2,bookIds:[1,2],books:[sampleBook,{...sampleBook,rowId:2,title:'Sách thứ hai'}]};
const activeEvent={rowId:1,code:'BOOK_SALE',name:'Tháng đọc sách',type:'BOOK_SALE',theme:'SUNSET',
  headline:'Khám phá tháng sách ưu đãi',description:'Được chọn và giảm giá trong thời gian giới hạn.',
  badgeText:'SÁCH HAY - GIÁ TỐT',startAt:new Date(Date.now()-86400000).toISOString(),endAt:new Date(Date.now()+86400000).toISOString(),
  bookCount:1,bundleCount:0,maxDiscountPercent:20,books:[sampleBook],bundles:[]};
const endpoints={
  '/shop/events':{items:[activeEvent]},
  '/shop/events/1':activeEvent,
  '/shop/home':{categories:[{rowId:1,name:'Văn học',count:8}],featured:[sampleBook],bundles:[sampleBundle]},
  '/shop/categories':{items:[{rowId:1,name:'Văn học',count:8}]},
  '/shop/books':{items:[sampleBook],total:1,page:1,pageSize:12},
  '/shop/books/1':sampleBook,
  '/shop/bundles':{items:[sampleBundle]},
  '/shop/bundles/1':sampleBundle,
};
async function until(predicate) { for (let i=0;i<30;i++) { if(predicate()) return;await new Promise((r)=>setTimeout(r,10)); } throw Error('Client render did not finish'); }

test('Client templates render from API data without syntax/runtime errors',async()=>{
  const map=new Map();
  const storage={getItem:(k)=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:(k)=>map.delete(k)};
  const main={innerHTML:''};const root={innerHTML:''};
  const handlers={};
  globalThis.sessionStorage=storage;globalThis.localStorage=storage;
  globalThis.location={hash:'#/'};
  globalThis.window={location:globalThis.location,addEventListener:(name,fn)=>{handlers[name]=fn;},scrollTo:()=>{}};
  globalThis.document={getElementById:(id)=>id==='app'?root:main,addEventListener:(name,fn)=>{handlers['document:'+name]=fn;},querySelectorAll:()=>[]};
  globalThis.fetch=async(url)=>{
    const endpoint=String(url).replace('/api/v1','').split('?')[0];
    const data=endpoints[endpoint];
    if (!data) return {ok:false,status:404,json:async()=>({errorCode:'NOT_FOUND',message:'Route not mocked: '+endpoint})};
    return {ok:true,status:200,json:async()=>data};
  };
  await import('../../frontend/client/js/app.js');
  await until(()=>main.innerHTML.includes('Mỗi trang sách.'));
  assert.match(main.innerHTML,/Mắt biếc/);
  for(const [route,text] of [
    ['#/books','Tủ sách của chúng mình'],
    ['#/book/1','Đánh giá &amp; cảm nhận'],
    ['#/bundles','Combo sách hay'],
    ['#/bundle/1','Combo Văn học'],
    ['#/events','Sự kiện tại Nhà sách PDF'],
    ['#/events/1','Khám phá tháng sách ưu đãi'],
    ['#/cart','Giỏ hàng đang trống'],
    ['#/login','Chào mừng trở lại'],
    ['#/register','Tạo tài khoản'],
    ['#/does-not-exist','Trang không tồn tại'],
  ]){
    globalThis.location.hash=route;
    handlers.hashchange();
    try { await until(()=>main.innerHTML.includes(text)); } catch { throw new Error('Failed route '+route+': '+main.innerHTML.slice(0,500)); }
    assert.match(main.innerHTML,new RegExp(text));
  }
  // Home takes on the approved running campaign; once absent it restores the regular hero.
  endpoints['/shop/home'].activeEvents=[activeEvent];
  globalThis.location.hash='#/';handlers.hashchange();
  await until(()=>main.innerHTML.includes('Khám phá tháng sách ưu đãi'));
  assert.match(main.innerHTML,/event-hero/);
  assert.match(main.innerHTML,/Sách đang có giá đặc biệt/);
  endpoints['/shop/home'].activeEvents=[];
  globalThis.location.hash='#/books';handlers.hashchange();
  await until(()=>main.innerHTML.includes('Tủ sách của chúng mình'));
  globalThis.location.hash='#/';handlers.hashchange();
  await until(()=>main.innerHTML.includes('Mỗi trang sách.'));
  assert.doesNotMatch(main.innerHTML,/Sách đang có giá đặc biệt/);
});

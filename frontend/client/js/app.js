import { api, getToken, setToken } from './api.js';
import { eventRibbon, eventHero, eventOffers, eventPreview, eventLink, updateEventClocks } from './eventUI.js';

const app = document.getElementById('app');
const CART_KEY = 'ntv_client_cart_v1';
const state = { user: null, cart: readCart(), couponCode: '', favoriteIds: new Set(), requestId: 0,
  giftMode:false, gift:{recipientEmail:'',recipientName:'',message:''}, readerUrl:null,
  events:[], homeFeatured:[], eventsSig:'' };
const VND = (value) => new Intl.NumberFormat('vi-VN',{ style:'currency',currency:'VND',maximumFractionDigits:0 }).format(Number(value)||0);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch]);
const val = (v) => encodeURIComponent(String(v));
const cleanId = (id) => Number.isSafeInteger(Number(id)) && Number(id)>0 ? Number(id) : 0;
const icon = (code) => ({cart:'◫',heart:'♡',user:'♙',arrow:'↗'}[code] || code);
function readCart() { try { const x = JSON.parse(localStorage.getItem(CART_KEY)||'[]'); return Array.isArray(x)?x:[]; } catch { return []; } }
function saveCart() { localStorage.setItem(CART_KEY,JSON.stringify(state.cart)); updateCartCount(); }
function cartCount() { return state.cart.reduce((n,r)=>n+(r.quantity||1),0); }
function updateCartCount() { document.querySelectorAll('.cart-count').forEach((el)=>{ el.textContent=cartCount(); }); }
function flash(message,type='success') { const e=document.createElement('div'); e.className='toast '+(type==='error'?'toast-error':''); e.textContent=message; e.setAttribute('role','status'); document.body.append(e); setTimeout(()=>e.remove(),3600); }
function navigate(route) { window.location.hash = route; }
function routeInfo() { const raw=(location.hash||'#/').slice(1); const i=raw.indexOf('?'); return { segments: (i<0?raw:raw.slice(0,i)).split('/').filter(Boolean),query:Object.fromEntries(new URLSearchParams(i<0?'':raw.slice(i+1))) }; }
function cover(book, size='') {
  const id = book.rowId || 1;
  // Đường dẫn ảnh do backend tạo từ ID/version, không dùng URL người dùng tùy ý.
  const url = book.coverUrl && /^\/api\/v1\/shop\/books\/\d+\/cover\?v=\d+$/.test(book.coverUrl) ? book.coverUrl : '';
  return `<div class="cover cover-${id%6} ${size}" ${url?'':'aria-hidden="true"'}><span class="cover-ridge" aria-hidden="true"></span><div class="cover-logo" aria-hidden="true">NHÀ SÁCH PDF</div><div class="cover-name" aria-hidden="true">${esc(book.title||book.name)}</div><div class="cover-decoration" aria-hidden="true">✦</div><span class="cover-footer" aria-hidden="true">DIGITAL EDITION</span>${url?`<img class="cover-photo" src="${esc(url)}" alt="Bìa sách ${esc(book.title||book.name)}" loading="lazy">`:''}</div>`;
}
function productCard(book) {
  const price=Number(book.currentPrice??book.price), discount=book.salePrice != null && book.salePrice < book.price;
  return `<article class="product-card"><a href="#/book/${book.rowId}" aria-label="Xem ${esc(book.title)}" class="product-visual">${cover(book)}${discount?'<span class="discount-pill">'+(book.promotionEvent?'GIÁ EVENT':'ĐANG GIẢM')+'</span>':''}</a>
    <div class="product-info"><p class="eyebrow">${esc(book.categoryName||'Sách điện tử')}</p><a class="product-title" href="#/book/${book.rowId}">${esc(book.title)}</a><p class="author">${esc((book.authorNames||[]).join(', ')||'Nhà sách PDF')}</p>
    <div class="product-bottom"><div><b>${VND(price)}</b>${discount?`<del>${VND(book.price)}</del>`:''}</div><button class="quick-add" data-action="add-book" data-id="${book.rowId}" aria-label="Thêm ${esc(book.title)} vào giỏ">+</button></div></div></article>`;
}
function cartCover(row) {
  const url=row.coverUrl && /^\/api\/v1\/shop\/books\/\d+\/cover\?v=\d+$/.test(row.coverUrl) ? row.coverUrl : '';
  return `<div class="cart-symbol">${url?`<img class="cart-cover-photo" src="${esc(url)}" alt="Bìa sách ${esc(row.name)}" loading="lazy">`:row.type==='BOOK'?'✦':'◇'}</div>`;
}
function bundleCard(bundle) {
  return `<article class="bundle-card"><div class="bundle-mark"><span>CURATED<br>COLLECTION</span><strong>0${bundle.rowId}</strong></div><div class="bundle-info"><span class="eyebrow">${bundle.type==='FLEXIBLE'?'TỰ CHỌN SÁCH':'COMBO CÓ SẴN'}</span><h3>${esc(bundle.name)}</h3><p>${bundle.type==='FLEXIBLE'?`Chọn ${bundle.pickCount} trong ${bundle.bookIds.length} tựa sách`:`Gồm ${bundle.bookIds.length} tựa sách`}</p><div class="bundle-foot"><b>${VND(bundle.price)}</b><a href="#/bundle/${bundle.rowId}" class="text-link">Khám phá →</a></div></div></article>`;
}
function linkClass(active, target) { return active===target ? 'active' : ''; }
function eventNav(active, mobile = false) {
  const event = state.events[0];
  return event ? `<a class="${mobile ? 'mobile-live-event' : 'nav-live-event'} ${linkClass(active,'events')}" href="${eventLink(event)}" title="${esc(event.name)}">✦ Sự kiện</a>` : '';
}
function standardHero(featured) {
  return `<section class="hero"><div class="container hero-grid"><div class="hero-copy"><span class="hero-kicker">CHÀO MỪNG ĐẾN VỚI NHÀ SÁCH SỐ</span><h1>Mỗi trang sách.<br><em>Một chân trời mới.</em></h1><p>Một góc nhỏ dành cho những tâm hồn yêu chữ. Khám phá sách hay, chọn điều mình thích và bắt đầu hành trình đọc ngay hôm nay.</p><form id="hero-search" class="hero-search"><label class="sr-only" for="home-query">Tìm sách</label><input id="home-query" name="q" placeholder="Tìm tên sách, tác giả, chủ đề..." required><button type="submit">Tìm sách ↗</button></form><div class="hero-proof"><span>✦ Tuyển chọn kỹ lưỡng</span><span>✦ Sách điện tử tiện lợi</span></div></div><div class="hero-art"><span class="art-caption">YOUR NEXT<br>FAVORITE READ</span><div class="hero-book hero-book-back">${cover(featured[1]||{title:'Một hành trình',rowId:3})}</div><div class="hero-book hero-book-front">${cover(featured[0]||{title:'Sách mỗi ngày',rowId:1})}</div><span class="art-stamp">READ<br>MORE ✻</span></div></div></section>`;
}
function applyLiveEvents(events) {
  // Không hiển thị event hết hạn từ cache hay API cũ.
  state.events = (Array.isArray(events) ? events : []).filter((event) => Number(event.rowId)>0 &&
    Date.parse(event.startAt)<=Date.now() && Date.now()<Date.parse(event.endAt));
  const live = state.events[0];
  const ribbon = document.querySelector?.('#event-ribbon'); if(ribbon)ribbon.innerHTML=eventRibbon(live);
  const desktop = document.querySelector?.('#event-nav-desktop'); if(desktop)desktop.innerHTML=eventNav('events');
  const mobile = document.querySelector?.('#event-nav-mobile'); if(mobile)mobile.innerHTML=eventNav('events',true);
  const hero = document.querySelector?.('#home-event-hero-slot');
  if(hero)hero.innerHTML=live?eventHero(live,cover):standardHero(state.homeFeatured);
  const offers = document.querySelector?.('#home-event-offers-slot');
  if(offers)offers.innerHTML=live?eventOffers(live,productCard,bundleCard,{inHome:true}):'';
  const detail = document.querySelector?.('#event-detail-live-content');
  if(detail && !state.events.some((e)=>Number(e.rowId)===Number(detail.dataset.eventId))) navigate('#/events');
  updateEventClocks();
}
async function refreshLiveEvents() {
  try {
    const data = await api.get('/shop/events');
    const next = Array.isArray(data.items) ? data.items : [];
    const signature = JSON.stringify(next);
    // Khi sự kiện bắt đầu/kết thúc hoặc Admin thay revision thì cập nhật ngay trên UI.
    if(signature !== state.eventsSig || state.events.some((e)=>Date.parse(e.endAt)<=Date.now())) {
      state.eventsSig=signature;applyLiveEvents(next);
    }
  } catch { // Mất mạng không làm trang Client bị trắng; Backend vẫn tính giá ở checkout.
    if(state.events.some((e)=>Date.parse(e.endAt)<=Date.now())) applyLiveEvents([]);
  }
}
function siteShell(active) {
  return `<div id="event-ribbon">${eventRibbon(state.events[0])}</div><header class="site-header"><div class="container header-line"><a href="#/" class="brand" aria-label="Trang chủ Nhà sách PDF"><span class="brand-icon">N<span class="brand-dot">•</span></span><span><strong>NHÀ SÁCH</strong><small>PDF DIGITAL BOOKSTORE</small></span></a>
  <nav class="desktop-nav" aria-label="Điều hướng"><a class="${linkClass(active,'home')}" href="#/">Trang chủ</a><a class="${linkClass(active,'books')}" href="#/books">Khám phá sách</a><a class="${linkClass(active,'bundles')}" href="#/bundles">Combo sách</a><span id="event-nav-desktop">${eventNav(active)}</span><a class="${linkClass(active,'library')}" href="#/library">Thư viện của tôi</a><a class="${linkClass(active,'gifts')}" href="#/gifts">Quà tặng</a></nav>
  <div class="header-actions"><a class="header-action" href="${state.user?'#/account':'#/login'}" aria-label="Tài khoản">${icon('user')} <span class="user-label">${esc(state.user?.fullName?.split(' ').slice(-1)[0] || 'Đăng nhập')}</span></a><a class="cart-link" href="#/cart" aria-label="Giỏ hàng">${icon('cart')} <span>Giỏ hàng</span><em class="cart-count">${cartCount()}</em></a></div></div><nav class="mobile-nav" aria-label="Điều hướng di động"><a href="#/">Trang chủ</a><a href="#/books">Sách</a><a href="#/bundles">Combo</a><span id="event-nav-mobile">${eventNav(active,true)}</span><a href="#/library">Thư viện</a><a href="#/gifts">Quà tặng</a><a href="#/support">Hỗ trợ</a></nav></header><main id="main" tabindex="-1"></main>
  <footer class="site-footer"><div class="container footer-grid"><div><div class="footer-brand">N<span>•</span> NHÀ SÁCH PDF</div><p>Những câu chuyện hay, ở ngay trong tầm tay.<br>Kho sách điện tử dành cho người yêu tri thức.</p></div><div><b>Khám phá</b><a href="#/books">Danh mục sách</a><a href="#/bundles">Combo tuyển chọn</a></div><div><b>Tài khoản</b><a href="#/orders">Đơn hàng của tôi</a><a href="#/support">Chăm sóc khách hàng</a></div><div class="footer-note">© ${new Date().getFullYear()} Nhà sách PDF<br>Ứng dụng minh họa dùng thanh toán demo.</div></div></footer>`;
}
function sectionHead(kicker,title,link) { return `<div class="section-heading"><div><span class="eyebrow">${esc(kicker)}</span><h2>${esc(title)}</h2></div>${link?`<a class="text-link" href="${link[1]}">${esc(link[0])} →</a>`:''}</div>`; }
function empty(iconText,title,message,cta='Khám phá sách',url='#/books') { return `<div class="empty-state"><div class="empty-icon">${iconText}</div><h2>${esc(title)}</h2><p>${esc(message)}</p><a class="button primary" href="${url}">${esc(cta)} →</a></div>`; }
function withUser() { if (!state.user) { navigate('#/login?next='+val(location.hash.slice(1))); return false; } return true; }
function statusText(s) { return ({PAID:'Đã thanh toán',PENDING_PAYMENT:'Chờ thanh toán',PAYMENT_FAILED:'Thanh toán lỗi',CANCELLED:'Đã hủy',GIFT_CLAIMED:'Đã nhận quà',OPEN:'Mới tạo',IN_PROGRESS:'Đang xử lý',RESOLVED:'Đã giải quyết',CLOSED:'Đã đóng'})[s] || s; }
function statusBadge(s) { const level=s==='PAID'||s==='RESOLVED'?'positive':s==='CANCELLED'||s==='CLOSED'||s==='PAYMENT_FAILED'?'negative':'pending';return `<span class="status ${level}">${esc(statusText(s))}</span>`; }
function renderError(e) { return `<div class="error-panel"><strong>Không tải được nội dung</strong><p>${esc(e.message||'Đã có lỗi xảy ra.')}</p><button class="button small" data-action="retry">Thử lại</button></div>`; }
function infoPage(title,subtitle,content) { return `<section class="container interior"><div class="page-intro"><span class="eyebrow">NHÀ SÁCH PDF</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${content}</section>`; }
function setBody(html,nonce) { if (nonce===state.requestId) { const main=document.getElementById('main'); if(main) main.innerHTML=html; updateCartCount(); } }

async function home(nonce) {
  const data=await api.get('/shop/home');
  if(nonce!==state.requestId)return;
  state.homeFeatured=data.featured;
  state.eventsSig=JSON.stringify(data.activeEvents || []);
  applyLiveEvents(data.activeEvents || []);
  setBody(`<div id="home-event-hero-slot">${state.events[0]?eventHero(state.events[0],cover):standardHero(data.featured)}</div>
  <div id="home-event-offers-slot">${state.events[0]?eventOffers(state.events[0],productCard,bundleCard,{inHome:true}):''}</div>
  <section class="container home-section">${sectionHead('ĐỌC THEO CẢM HỨNG','Chọn chủ đề bạn yêu thích',['Xem tất cả sách','#/books'])}<div class="category-list">${data.categories.map((c,i)=>`<a class="category-chip" href="#/books?categoryId=${c.rowId}"><span class="cat-icon cat-${i%6}">${['✦','☘','◇','⌘','✳','❋'][i%6]}</span><span>${esc(c.name)}<small>${c.count} đầu sách</small></span><b>↗</b></a>`).join('')}</div></section>
  <section class="container home-section">${sectionHead('DÀNH RIÊNG CHO BẠN','Những cuốn sách đáng đọc',['Khám phá thêm','#/books'])}<div class="products-grid">${data.featured.map(productCard).join('')}</div></section>
  ${data.bundles.length?`<section class="container home-section">${sectionHead('CHỌN NHIỀU, THƯỞNG THỨC NHIỀU','Combo sách tuyển chọn',['Xem combo','#/bundles'])}<div class="bundles-grid">${data.bundles.slice(0,2).map(bundleCard).join('')}</div></section>`:''}
  <section class="container"><div class="closing-promo"><div><span class="eyebrow">THƯ VIỆN CỦA RIÊNG BẠN</span><h2>Sách hay sẽ luôn<br>ở cạnh bạn.</h2><p>Mua sách, lưu vào thư viện và theo dõi lịch sử đơn hàng chỉ với một tài khoản.</p><a class="button light" href="${state.user?'#/library':'#/register'}">${state.user?'Mở thư viện':'Tạo tài khoản miễn phí'} ↗</a></div><span class="promo-seal">STORIES<br>THAT<br>STAY.</span></div></section>`,nonce);
}
async function eventsIndex(nonce) {
  const data=await api.get('/shop/events');
  if(nonce!==state.requestId)return;
  applyLiveEvents(data.items);
  const content=data.items.length?`<div class="event-preview-grid">${data.items.map(eventPreview).join('')}</div>`:
    empty('✦','Chưa có sự kiện đang diễn ra','Các chương trình được hiển thị sau khi Manager duyệt và đến thời gian chạy.','Khám phá sách','#/books');
  setBody(`<section class="container event-listing"><div class="event-listing-heading"><span class="eyebrow">CHƯƠNG TRÌNH KHUYẾN MÃI</span><h1>Sự kiện tại Nhà sách PDF</h1><p>Ưu đãi đang có hiệu lực, được cập nhật trực tiếp từ Admin.</p></div>${content}</section>`,nonce);
}
async function eventDetail(nonce,id) {
  const event=await api.get('/shop/events/'+id);
  setBody(`<div class="event-detail-page" id="event-detail-live-content" data-event-id="${cleanId(event.rowId)}"><div class="container event-back"><a class="text-link" href="#/events">← Các sự kiện đang diễn ra</a></div>${eventHero(event,cover)}${eventOffers(event,productCard,bundleCard)}</div>`,nonce);
  updateEventClocks();
}
async function books(nonce,query) {
  const q={q:query.q||'',categoryId:query.categoryId||'',sort:query.sort||'newest',page:query.page||1,pageSize:12};
  const [books,cats]=await Promise.all([api.get('/shop/books',q),api.get('/shop/categories')]);
  const content=`<div class="catalog-controls"><form id="catalog-form" class="catalog-form"><input type="search" name="q" value="${esc(q.q)}" placeholder="Tìm tên sách hoặc tác giả"><select name="categoryId" aria-label="Danh mục"><option value="">Tất cả danh mục</option>${cats.items.map((c)=>`<option value="${c.rowId}" ${String(q.categoryId)===String(c.rowId)?'selected':''}>${esc(c.name)}</option>`).join('')}</select><select name="sort" aria-label="Sắp xếp">${[['newest','Mới cập nhật'],['name','Tên A–Z'],['price_asc','Giá thấp đến cao'],['price_desc','Giá cao đến thấp']].map(([v,label])=>`<option value="${v}" ${q.sort===v?'selected':''}>${label}</option>`).join('')}</select><button type="submit" class="button primary small">Lọc sách</button></form><span>${books.total} kết quả</span></div>
    ${books.items.length?`<div class="products-grid">${books.items.map(productCard).join('')}</div>`:empty('⌕','Chưa có sách phù hợp','Hãy thử đổi từ khóa hoặc chọn danh mục khác.','Xóa bộ lọc','#/books')}
    ${books.total>books.pageSize?`<div class="pagination"><button data-action="page" data-page="${Math.max(1,books.page-1)}" ${books.page<=1?'disabled':''}>← Trước</button><span>Trang ${books.page} / ${Math.ceil(books.total/books.pageSize)}</span><button data-action="page" data-page="${books.page+1}" ${books.page>=Math.ceil(books.total/books.pageSize)?'disabled':''}>Tiếp →</button></div>`:''}`;
  setBody(infoPage('Tủ sách của chúng mình','Tìm một cuốn sách hợp với tâm trạng của bạn hôm nay.',content),nonce);
}
async function bookDetail(nonce,id) {
  const book=await api.get('/shop/books/'+id); const discount=book.salePrice!=null&&book.salePrice<book.price;
  const reviews=(book.reviews||[]).map((r)=>`<article class="review"><div class="review-header"><strong>${esc(r.authorName)}</strong><span>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div><p>${esc(r.content)}</p></article>`).join('');
  setBody(`<div class="container detail-wrap"><a class="breadcrumb" href="#/books">← Tất cả sách</a><div class="detail-grid"><div class="detail-art">${cover(book,'cover-large')}</div><div class="detail-copy"><span class="eyebrow">${esc(book.categoryName)}</span><h1>${esc(book.title)}</h1><p class="detail-author">Tác giả: <b>${esc(book.authorNames.join(', '))}</b></p><p class="detail-description">${esc(book.description||'Một cuốn sách thú vị dành cho bạn.')}</p><div class="detail-meta"><span>✦ ${esc(book.publisherName||'Sách điện tử')}</span><span>★ ${book.rating?book.rating+' / 5':'Chưa có đánh giá'}</span></div><div class="detail-price"><strong>${VND(book.currentPrice)}</strong>${discount?`<del>${VND(book.price)}</del><span class="sale-tag">Ưu đãi</span>${book.promotionEvent?`<a class="event-book-link" href="#/events/${cleanId(book.promotionEvent.rowId)}">✦ ${esc(book.promotionEvent.name)} →</a>`:''}`:''}</div><div class="detail-actions"><button class="button primary" data-action="add-book" data-id="${book.rowId}">+ Thêm vào giỏ hàng</button><button class="button outline gift-button" data-action="gift-book" data-id="${book.rowId}">🎁 Mua tặng</button><button class="button outline" data-action="favorite" data-id="${book.rowId}">♡ Yêu thích</button></div><div class="purchase-note">Thanh toán trong bản demo không thu tiền thật. Sau khi mua, bạn được đọc PDF mẫu Lorem Ipsum (hoặc PDF thật nếu Admin đã tải lên).</div></div></div>
    <div class="review-section"><div>${sectionHead('BẠN ĐỌC NÓI GÌ','Đánh giá & cảm nhận')}<div class="review-list">${reviews||'<p class="muted">Hãy là người đầu tiên chia sẻ cảm nhận về sách.</p>'}</div></div><div class="review-side"><h3>Đã đọc cuốn này?</h3><p>Đánh giá của bạn giúp mọi người chọn được sách hay. Chỉ tài khoản đã mua mới có quyền đánh giá.</p><form id="review-form" data-book="${book.rowId}"><label>Số sao<select name="rating"><option value="5">★★★★★ (5)</option><option value="4">★★★★☆ (4)</option><option value="3">★★★☆☆ (3)</option><option value="2">★★☆☆☆ (2)</option><option value="1">★☆☆☆☆ (1)</option></select></label><label>Cảm nhận của bạn<textarea name="content" minlength="3" maxlength="1000" rows="4" placeholder="Điều bạn thích ở cuốn sách này..." required></textarea></label><button class="button primary" type="submit">Gửi đánh giá</button></form><button class="text-link report-link" data-action="report-book" data-id="${book.rowId}">Báo cáo nội dung sách</button></div></div></div>`,nonce);
}
async function bundles(nonce) {
  const data=await api.get('/shop/bundles');
  setBody(infoPage('Combo sách hay','Những tuyển tập được chọn lọc, đọc càng nhiều càng thú vị.',data.items.length?`<div class="bundles-grid all">${data.items.map(bundleCard).join('')}</div>`:empty('◇','Chưa có combo đang bán','Các combo được duyệt từ trang Admin sẽ hiển thị tại đây.')),nonce);
}
async function bundleDetail(nonce,id) {
  const bundle=await api.get('/shop/bundles/'+id);
  setBody(`<div class="container detail-wrap"><a class="breadcrumb" href="#/bundles">← Tất cả combo</a><div class="bundle-detail"><div class="bundle-banner"><span class="eyebrow">${bundle.type==='FIXED'?'COMBO CỐ ĐỊNH':'COMBO TỰ CHỌN'}</span><h1>${esc(bundle.name)}</h1><p>${bundle.type==='FLEXIBLE'?`Hãy chọn đúng ${bundle.pickCount} trong ${bundle.bookIds.length} cuốn sách bên dưới.`:`Combo gồm ${bundle.bookIds.length} cuốn sách.`}</p><div class="bundle-detail-foot"><strong>${VND(bundle.price)}</strong><button class="button light" data-action="add-bundle" data-id="${bundle.rowId}">+ Thêm combo vào giỏ</button></div></div><div class="bundle-select"><h2>${bundle.type==='FLEXIBLE'?'Chọn những cuốn bạn thích':'Sách trong combo'}</h2><div class="bundle-books">${bundle.books.map((b)=>`<label class="bundle-book">${bundle.type==='FLEXIBLE'?`<input type="checkbox" class="bundle-choice" value="${b.rowId}">`:''}${cover(b,'cover-mini')}<span><strong>${esc(b.title)}</strong><small>${esc(b.authorNames.join(', '))}</small></span></label>`).join('')}</div></div></div></div>`,nonce);
}
async function cart(nonce) {
  if (!state.cart.length) {setBody(infoPage('Giỏ hàng','Những điều thú vị bạn sắp mang về.',empty('◫','Giỏ hàng đang trống','Một cuốn sách hay luôn là khởi đầu đẹp.')),nonce);return;}
  try {
    const q=await api.post('/shop/checkout/quote',{items:state.cart,couponCode:state.couponCode});
    const html=`<div class="checkout-grid"><div><div class="cart-items">${q.items.map((r,i)=>`<div class="cart-row">${cartCover(r)}<div class="cart-name"><b>${esc(r.name)}</b><small>${r.type==='BOOK'?'Sách điện tử':'Combo sách'}</small></div><div class="quantity"><button data-action="qty" data-index="${i}" data-delta="-1" aria-label="Giảm số lượng">−</button><span>${r.quantity}</span><button data-action="qty" data-index="${i}" data-delta="1" aria-label="Tăng số lượng">+</button></div><b>${VND(r.price)}</b><button class="remove" data-action="remove" data-index="${i}" aria-label="Xóa khỏi giỏ">×</button></div>`).join('')}</div><a class="text-link back-shopping" href="#/books">← Tiếp tục chọn sách</a></div>
    <div class="summary-box"><h2>Thông tin đơn hàng</h2><div class="gift-option"><label class="gift-toggle-label"><input type="checkbox" id="gift-toggle" ${state.giftMode?'checked':''}><span><b>🎁 Đây là đơn quà tặng</b><small>Mua sách cho người thân hoặc bạn bè</small></span></label><div class="gift-fields" id="gift-fields" ${state.giftMode?'':'hidden'}><label>Email người nhận <span class="required-star">*</span><input id="gift-recipient-email" data-gift-field name="recipientEmail" type="email" autocomplete="off" maxlength="254" placeholder="banbe@example.com" value="${esc(state.gift.recipientEmail)}"></label><label>Tên người nhận (tùy chọn)<input data-gift-field name="recipientName" maxlength="100" placeholder="Ví dụ: Minh" value="${esc(state.gift.recipientName)}"></label><label>Lời nhắn (tùy chọn)<textarea data-gift-field name="message" maxlength="300" rows="3" placeholder="Chúc bạn đọc sách vui vẻ!"></textarea></label><p class="gift-help-note">Sau khi thanh toán, bạn nhận mã GFT để gửi riêng. Người nhận cần đăng nhập đúng email và nhập mã tại mục Quà tặng. Hệ thống chưa gửi email tự động. Mỗi dòng sản phẩm quà tặng chỉ chọn số lượng 1.</p></div></div><form id="coupon-form"><label>Mã ưu đãi</label><div class="coupon-row"><input name="coupon" placeholder="Nhập mã giảm giá" value="${esc(state.couponCode)}"><button class="button outline small" type="submit">Áp dụng</button></div></form><div class="summary-lines"><p><span>Tạm tính</span><b>${VND(q.subtotal)}</b></p><p><span>Ưu đãi sự kiện</span><b>−${VND(q.eventDiscount)}</b></p><p><span>Mã giảm giá</span><b>−${VND(q.couponDiscount)}</b></p><p class="summary-total"><span>Tổng cộng</span><strong>${VND(q.total)}</strong></p></div><button class="button primary checkout-btn" data-action="checkout">${state.user?'Tạo đơn hàng':'Đăng nhập để đặt hàng'} →</button><p class="summary-note">Thanh toán sẽ thực hiện ở bước tiếp theo bằng cổng giả lập.</p></div></div>`;
    setBody(infoPage('Giỏ hàng','Kiểm tra lại những cuốn sách trước khi tiếp tục.',html),nonce);
    const message=document.querySelector('[data-gift-field][name=message]');if(message)message.value=state.gift.message;
  } catch(e) {
    setBody(infoPage('Giỏ hàng','Hãy kiểm tra lại sản phẩm trong giỏ.',`<div class="error-panel">${esc(e.message)}<div><button class="button outline small" data-action="clear-coupon">Xóa mã ưu đãi</button> <button class="button outline small" data-action="empty-cart">Xóa toàn bộ giỏ</button></div></div>`),nonce);
  }
}
async function login(nonce,isRegister,query) {
  if (state.user) {navigate('#/account');return;}
  const next=query.next||'';
  setBody(`<section class="auth-page"><div class="auth-visual"><div><span class="eyebrow">WELCOME HOME, READER</span><h2>Chạm vào<br>một câu chuyện mới.</h2><p>Không gian nhỏ cho những ngày muốn đọc một điều gì đó hay ho.</p></div><span class="auth-flower">✳</span></div><div class="auth-form-wrap"><a href="#/" class="breadcrumb">← Về trang chủ</a><h1>${isRegister?'Tạo tài khoản':'Chào mừng trở lại'}</h1><p>${isRegister?'Bắt đầu xây dựng thư viện của riêng bạn.':'Đăng nhập để tiếp tục hành trình đọc sách.'}</p><form id="auth-form" data-next="${esc(next)}" data-mode="${isRegister?'register':'login'}">${isRegister?'<label>Họ và tên<input type="text" name="fullName" autocomplete="name" minlength="2" required placeholder="Tên của bạn"></label>':''}<label>Địa chỉ email<input type="email" name="email" autocomplete="email" required placeholder="email@example.com"></label><label>Mật khẩu<input type="password" name="password" autocomplete="${isRegister?'new-password':'current-password'}" minlength="8" required placeholder="Ít nhất 8 ký tự"></label><div class="form-error" role="alert"></div><button type="submit" class="button primary block">${isRegister?'Tạo tài khoản':'Đăng nhập'} →</button></form><div class="auth-switch">${isRegister?'Đã có tài khoản?':'Chưa có tài khoản?'} <a href="${isRegister?'#/login':'#/register'}">${isRegister?'Đăng nhập':'Đăng ký ngay'}</a></div><p class="demo-tip">Tài khoản khách dùng thử: <b>an@mail.test</b> / <b>Buyer@123</b></p></div></section>`,nonce);
}
async function account(nonce) {
  if (!withUser()) return;
  setBody(infoPage('Tài khoản của tôi','Rất vui vì bạn đã trở lại!',`<div class="account-grid"><div class="profile-box"><div class="profile-avatar">${esc((state.user.fullName||'B').trim()[0])}</div><span class="eyebrow">THÀNH VIÊN NHÀ SÁCH PDF</span><h2>${esc(state.user.fullName)}</h2><p>${esc(state.user.email)}</p><form id="profile-form"><label>Họ và tên<input name="fullName" value="${esc(state.user.fullName)}" minlength="2" maxlength="100" required></label><button class="button outline" type="submit">Lưu thông tin</button></form><button class="text-link logout-link" data-action="logout">Đăng xuất khỏi tài khoản ↗</button></div><div class="account-links"><a href="#/orders"><span>◫</span><b>Đơn hàng của tôi</b><small>Kiểm tra trạng thái đơn đã đặt</small><em>→</em></a><a href="#/library"><span>▤</span><b>Thư viện của tôi</b><small>Quản lý những sách đã sở hữu</small><em>→</em></a><a href="#/gifts"><span>🎁</span><b>Quà tặng của tôi</b><small>Nhập mã nhận quà và xem sách được tặng</small><em>→</em></a><a href="#/favorites"><span>♡</span><b>Sách yêu thích</b><small>Lưu lại những tựa sách đáng chú ý</small><em>→</em></a><a href="#/support"><span>✉</span><b>Trung tâm hỗ trợ</b><small>Liên hệ nhân viên nhà sách</small><em>→</em></a></div></div>`),nonce);
}
async function orders(nonce) {
  if (!withUser())return;
  const data=await api.get('/shop/orders',{pageSize:50});
  const content=data.items.length?`<div class="order-list">${data.items.map((o)=>`<a class="order-row" href="#/orders/${o.rowId}"><span class="order-mark">◫</span><span><b>${esc(o.orderId)}</b><small>${new Date(o.createdAt).toLocaleDateString('vi-VN')} · ${o.items.length} sản phẩm${o.gift?' · 🎁 Mua tặng':''}</small></span>${statusBadge(o.status)}<strong>${VND(o.total)}</strong><span class="row-arrow">→</span></a>`).join('')}</div>`:empty('▤','Chưa có đơn hàng nào','Mỗi đơn hàng là một câu chuyện mới để khám phá.');
  setBody(infoPage('Lịch sử đơn hàng','Theo dõi mọi đơn hàng của bạn tại một nơi.',content),nonce);
}
async function orderDetail(nonce,id) {
  if (!withUser())return;
  const o=await api.get('/shop/orders/'+id);
  setBody(`<div class="container interior"><a href="#/orders" class="breadcrumb">← Danh sách đơn hàng</a><div class="order-title"><div><span class="eyebrow">ĐƠN HÀNG CỦA BẠN</span><h1>${esc(o.orderId)}</h1><p>Tạo ngày ${new Date(o.createdAt).toLocaleString('vi-VN')}</p>${o.gift?`<p class="gift-order-recipient">🎁 Tặng đến: ${esc(o.gift.recipientEmail)}${o.gift.recipientName?` (${esc(o.gift.recipientName)})`: ''}</p>`:''}</div>${statusBadge(o.status)}</div><div class="checkout-grid"><div><h2>Chi tiết sản phẩm</h2><div class="cart-items">${o.items.map((i)=>`<div class="cart-row">${cartCover(i)}<div class="cart-name"><b>${esc(i.name)}</b><small>${i.type==='BOOK'?'Sách điện tử':'Combo sách'} · SL ${i.quantity||1}</small></div><strong>${VND(i.price)}</strong></div>`).join('')}</div><h3>Tiến trình đơn hàng</h3><div class="timeline">${o.history.map((x)=>`<div><b>${esc(statusText(x.status))}</b><small>${new Date(x.at).toLocaleString('vi-VN')}</small></div>`).join('')}</div></div><div class="summary-box"><h2>Tổng thanh toán</h2><div class="summary-lines"><p><span>Tạm tính</span><b>${VND(o.subtotal)}</b></p><p><span>Khuyến mãi</span><b>−${VND(o.discount)}</b></p><p class="summary-total"><span>Tổng cộng</span><strong>${VND(o.total)}</strong></p></div>${o.status==='PENDING_PAYMENT'?`<div class="demo-warning"><b>Chế độ thanh toán thử nghiệm</b><p>Không phát sinh thanh toán thật. Bấm xác nhận để mô phỏng giao dịch thành công.</p></div><button class="button primary block" data-action="demo-pay" data-id="${o.rowId}">Xác nhận thanh toán demo</button><button class="button outline block" data-action="cancel-order" data-id="${o.rowId}">Hủy đơn hàng</button>`:o.status==='PAID'?`${o.gift?`<div class="gift-code-panel"><b>🎁 Đơn quà đã thanh toán</b><p>${o.gift.claimedAt?'Người nhận đã sử dụng mã và nhận sách.':'Hãy gửi mã dưới đây riêng cho người nhận:'}</p><code id="order-gift-code">${esc(o.gift.claimCode||'')}</code><button class="button outline small block" data-action="copy-gift-code">Sao chép mã nhận quà</button><small>Người nhận đăng nhập bằng ${esc(o.gift.recipientEmail)}, mở Quà tặng và nhập mã. Không gửi email tự động.</small></div>`:`<div class="paid-message">✓ Thanh toán thử nghiệm thành công.<br><a href="#/library">Đọc sách trong thư viện →</a></div>`}`:''}<a class="text-link support-link" href="#/support">Cần hỗ trợ đơn này? →</a></div></div></div>`,nonce);
}
async function library(nonce) {
  if (!withUser())return;
  const data=await api.get('/shop/library');
  setBody(infoPage('Thư viện của tôi','Đọc sách đã mua hoặc được tặng ngay trên website.',`<div class="info-strip">ℹ Tất cả sách chưa có PDF thật sẽ có bản PDF mẫu Lorem Ipsum nhiều trang. Đây không phải nội dung gốc của tác phẩm. Thanh toán chỉ là mô phỏng.</div>${data.items.length?`<div class="products-grid">${data.items.map((b)=>`<div>${productCard(b)}${!b.currentlyAvailable?'<p class="unavailable">Tạm ngừng phục vụ</p>':`<div class="library-actions"><span class="pdf-kind">${b.pdfSource==='DEMO'?'PDF mẫu Lorem Ipsum':'PDF từ Admin'}</span><button class="button primary small" data-action="read-pdf" data-id="${b.rowId}">📖 Đọc ngay</button><button class="button outline small" data-action="download-pdf" data-id="${b.rowId}" data-title="${esc(b.title)}">↓ Tải PDF</button></div>`}</div>`).join('')}</div>`:empty('▤','Thư viện chưa có sách','Sách đã mua hoặc đã nhận quà sẽ xuất hiện tại đây.')}`),nonce);
}
async function gifts(nonce) {
  if(!withUser())return;
  const received=await api.get('/shop/gifts/received');
  const list=received.items.length?received.items.map((o)=>`<article class="received-gift"><div class="gift-received-header"><b>🎁 Quà từ ${esc(o.senderName)}</b><small>${o.claimedAt?new Date(o.claimedAt).toLocaleDateString('vi-VN'):''}</small></div>${o.message?`<blockquote>“${esc(o.message)}”</blockquote>`:''}<p>${o.books.map((b)=>`<a href="#/book/${b.rowId}">${esc(b.title)}</a>`).join(' · ')}</p><a class="text-link" href="#/library">Đọc trong thư viện →</a></article>`).join(''):'<p class="muted">Bạn chưa nhận quà nào. Khi có mã nhận quà, nhập ở ô bên cạnh.</p>';
  setBody(infoPage('Quà tặng của tôi','Nhận sách từ bạn bè và bắt đầu đọc ngay.',`<div class="gift-page-grid"><div class="gift-received-list"><h2>Những món quà đã nhận</h2>${list}</div><div class="summary-box gift-claim-box"><h2>🎁 Nhận sách được tặng</h2><p>Người tặng sẽ gửi mã GFT sau khi thanh toán. Hãy đăng nhập đúng địa chỉ email mà người tặng đã nhập.</p><form id="gift-claim-form"><label>Mã nhận quà<input name="code" maxlength="80" placeholder="GFT-..." required autocomplete="off"></label><div class="form-error" role="alert"></div><button class="button primary block" type="submit">Xác nhận nhận quà</button></form><small>Không cần thanh toán lần nữa. Sách được nhận sẽ xuất hiện trong Thư viện của tôi.</small></div></div>`),nonce);
}
async function readBook(nonce,id) {
  if(!withUser())return;
  // Khong co endpoint doc cong khai. Lay PDF voi Bearer token, chi giu trong bo nho phien dang nhap.
  const data=await api.get('/shop/library');
  const book=data.items.find((b)=>b.rowId===Number(id));
  if(!book)throw new Error('Bạn cần mua hoặc nhận sách trước khi đọc.');
  if(!book.currentlyAvailable)throw new Error('Sách đang tạm ngừng phục vụ.');
  setBody(`<section class="container reader-page"><a class="breadcrumb" href="#/library">← Quay lại thư viện</a><div class="reader-head"><div><span class="eyebrow">TRÌNH ĐỌC PDF</span><h1>${esc(book.title)}</h1><p>${book.pdfSource==='DEMO'?'Bản đọc mẫu sử dụng Lorem Ipsum, không chứa nội dung gốc của sách.':'PDF được Admin tải lên.'}</p></div><button class="button outline small" data-action="download-pdf" data-id="${book.rowId}" data-title="${esc(book.title)}">↓ Tải PDF</button></div><div class="reader-container" id="reader-container"><div class="reader-loading">Đang mở PDF đã mua…</div><iframe id="book-reader-frame" class="pdf-reader-frame" title="Đọc sách PDF: ${esc(book.title)}" referrerpolicy="no-referrer"></iframe></div></section>`,nonce);
  const blob=await api.readPdf(id);
  if(nonce!==state.requestId)return;
  const uri=URL.createObjectURL(blob);
  state.readerUrl=uri;
  const frame=document.getElementById('book-reader-frame');
  if(frame) { frame.src=uri; document.querySelector('.reader-loading')?.remove(); }
  else {URL.revokeObjectURL(uri);state.readerUrl=null;}
}
async function favorites(nonce) {
  if (!withUser())return;
  const data=await api.get('/shop/favorites'); state.favoriteIds=new Set(data.items.map((b)=>b.rowId));
  setBody(infoPage('Sách đã lưu','Để dành những cuốn bạn chưa kịp đọc.',data.items.length?`<div class="products-grid">${data.items.map(productCard).join('')}</div>`:empty('♡','Chưa lưu cuốn sách nào','Dùng nút yêu thích ở trang chi tiết sách để lưu lại.')),nonce);
}
async function support(nonce) {
  if (!withUser())return;
  const [complaints,orders]=await Promise.all([api.get('/shop/complaints'),api.get('/shop/orders',{pageSize:50})]);
  const list=complaints.items.length?complaints.items.map((c)=>`<details class="support-item"><summary><span><b>${esc(c.subject)}</b><small>${esc(c.code)} · ${new Date(c.createdAt).toLocaleDateString('vi-VN')}</small></span>${statusBadge(c.status)}</summary><div class="messages">${c.messages.map((m)=>`<div class="message ${m.from==='BUYER'?'buyer-message':''}"><span>${m.from==='BUYER'?'Bạn':'Nhà sách'}</span><p>${esc(m.body)}</p><small>${new Date(m.at).toLocaleString('vi-VN')}</small></div>`).join('')}</div>${c.status!=='CLOSED'?`<form class="reply-form" data-id="${c.rowId}"><textarea name="body" placeholder="Nhập tin nhắn phản hồi..." maxlength="2000" required></textarea><button class="button primary small" type="submit">Gửi phản hồi</button></form>`:''}</details>`).join(''):'<p class="muted">Bạn chưa gửi yêu cầu hỗ trợ nào.</p>';
  setBody(infoPage('Trung tâm hỗ trợ','Cùng chúng mình giải quyết mọi vấn đề về đơn hàng.',`<div class="support-grid"><div><h2>Yêu cầu đã gửi</h2>${list}</div><div class="summary-box"><h2>Tạo yêu cầu mới</h2>${orders.items.length?`<form id="support-form"><label>Đơn hàng<select name="orderRowId" required>${orders.items.map((o)=>`<option value="${o.rowId}">${esc(o.orderId)} — ${VND(o.total)}</option>`).join('')}</select></label><label>Chủ đề<input name="subject" minlength="5" maxlength="150" required placeholder="Ví dụ: Cần kiểm tra đơn hàng"></label><label>Nội dung<textarea name="message" minlength="5" maxlength="2000" rows="5" placeholder="Mô tả vấn đề bạn gặp phải..." required></textarea></label><button class="button primary block" type="submit">Gửi yêu cầu hỗ trợ</button></form>`:'<p>Bạn cần có ít nhất một đơn hàng để gửi yêu cầu hỗ trợ.</p><a class="button outline" href="#/books">Khám phá sách</a>'}</div></div>`),nonce);
}

async function render() {
  const myId=++state.requestId; if(state.readerUrl){URL.revokeObjectURL(state.readerUrl);state.readerUrl=null;} const {segments,query}=routeInfo(); const [name='', id]=segments;
  const active=['book','books'].includes(name)?'books':['bundle','bundles'].includes(name)?'bundles':['event','events'].includes(name)?'events':name==='library'?'library':name==='gifts'?'gifts':name?'':'home';
  app.innerHTML=siteShell(active);
  const main=document.getElementById('main'); main.innerHTML='<div class="page-loading"><div class="loading-dot"></div>Đang mở trang sách...</div>';
  try {
    if (!name) return await home(myId);
    if (name==='events' && cleanId(id)) return await eventDetail(myId,id);
    if (name==='events') return await eventsIndex(myId);
    if (name==='books') return await books(myId,query);
    if (name==='book' && cleanId(id)) return await bookDetail(myId,id);
    if (name==='bundles') return await bundles(myId);
    if (name==='bundle' && cleanId(id)) return await bundleDetail(myId,id);
    if (name==='cart') return await cart(myId);
    if (name==='login') return await login(myId,false,query);
    if (name==='register') return await login(myId,true,query);
    if (name==='account') return await account(myId);
    if (name==='orders' && cleanId(id)) return await orderDetail(myId,id);
    if (name==='orders') return await orders(myId);
    if (name==='library') return await library(myId);
    if (name==='gifts') return await gifts(myId);
    if (name==='read' && cleanId(id)) return await readBook(myId,id);
    if (name==='favorites') return await favorites(myId);
    if (name==='support') return await support(myId);
    setBody(infoPage('Trang không tồn tại','Đường dẫn bạn đang tìm không có tại nhà sách.',empty('?', 'Bạn lạc đường rồi!', 'Về trang chủ để tiếp tục.','Trang chủ','#/')),myId);
  } catch(e) {
    if(e.status===401 && !['login','register'].includes(name)) { state.user=null; setToken(null); flash('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.','error');navigate('#/login');return; }
    setBody(`<div class="container interior">${renderError(e)}</div>`,myId);
  }
  window.scrollTo(0,0);
}

function addToCart(row) {
  const current=state.cart.find((x)=>x.type===row.type&&x.id===row.id&&JSON.stringify(x.selectedBookIds||[])===JSON.stringify(row.selectedBookIds||[]));
  if(current) { current.quantity=Math.min(10,current.quantity+1); } else state.cart.push({ ...row,quantity:1 });
  saveCart(); flash('Đã thêm vào giỏ hàng ♡');
}
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
async function handleSubmit(e) {
  const form=e.target; if (!(form instanceof HTMLFormElement)) return;
  if (!['hero-search','catalog-form','coupon-form','auth-form','profile-form','review-form','support-form','gift-claim-form'].includes(form.id) && !form.classList.contains('reply-form'))return;
  e.preventDefault(); const v=formData(form); const button=form.querySelector('button[type=submit]'); if(button) button.disabled=true;
  try {
    switch(form.id) {
      case 'hero-search': navigate('#/books?q='+val(v.q));break;
      case 'catalog-form': { const qp=new URLSearchParams(Object.entries(v).filter(([,value])=>value)); navigate('#/books?'+qp.toString()); render();break; }
      case 'coupon-form': state.couponCode=String(v.coupon||'').trim().toUpperCase(); await render();break;
      case 'auth-form': {
        const data=form.dataset.mode==='register'?await api.post('/auth/register',v):await api.post('/auth/login',{...v,audience:'BUYER'});
        state.user=data.user;setToken(data.accessToken);try { const f=await api.get('/shop/favorites'); state.favoriteIds=new Set(f.items.map((b)=>b.rowId)); } catch {} flash(form.dataset.mode==='register'?'Đăng ký thành công!':'Đăng nhập thành công!');
        const next=form.dataset.next;
        navigate(next.startsWith('/')&&!next.startsWith('//')?'#'+next:'#/account'); render();break;
      }
      case 'profile-form': { const result=await api.patch('/auth/me',{fullName:v.fullName});state.user=result.user;flash('Đã cập nhật hồ sơ');render();break; }
      case 'review-form': if (!withUser())return; await api.post('/shop/reviews',{bookId:Number(form.dataset.book),rating:Number(v.rating),content:v.content});flash('Cảm ơn bạn đã đánh giá!');render();break;
      case 'gift-claim-form': {if(!withUser())return;const got=await api.post('/shop/gifts/claim',{code:v.code});flash(`Đã nhận ${got.bookCount} cuốn sách! Mở Thư viện để đọc nhé.`);render();break;}
      case 'support-form': await api.post('/shop/complaints',{orderRowId:Number(v.orderRowId),subject:v.subject,message:v.message});flash('Đã gửi yêu cầu hỗ trợ!');render();break;
      default: if(form.classList.contains('reply-form')){await api.post('/shop/complaints/'+form.dataset.id+'/messages',{body:v.body});flash('Đã gửi phản hồi!');render();}break;
    }
  } catch(error) { const field=form.querySelector('.form-error');if(field)field.textContent=error.message;else flash(error.message,'error'); }
  finally { if(button)button.disabled=false; }
}
async function handleAction(e) {
  const button=e.target.closest('[data-action]');if(!button)return;
  e.preventDefault(); const action=button.dataset.action,id=cleanId(button.dataset.id);
  if(button.disabled)return;button.disabled=true;
  try {
    switch(action) {
      case 'add-book': addToCart({type:'BOOK',id});break;
      case 'gift-book': {addToCart({type:'BOOK',id});state.giftMode=true;navigate('#/cart');render();break;}
      case 'add-bundle': {
        const bundle=await api.get('/shop/bundles/'+id);
        const selection=[...document.querySelectorAll('.bundle-choice:checked')].map((x)=>Number(x.value));
        if(bundle.type==='FLEXIBLE'&&selection.length!==bundle.pickCount) {flash(`Bạn cần chọn đúng ${bundle.pickCount} cuốn sách.`,'error');break;}
        addToCart({type:'BUNDLE',id,selectedBookIds:bundle.type==='FLEXIBLE'?selection:bundle.bookIds});break;
      }
      case 'remove': state.cart.splice(Number(button.dataset.index),1);saveCart();render();break;
      case 'qty': { const index=Number(button.dataset.index);const item=state.cart[index];if(item){item.quantity=Math.max(1,Math.min(10,item.quantity+Number(button.dataset.delta)));saveCart();render();}break; }
      case 'checkout': {
        if(!withUser())break;
        if(state.giftMode && state.cart.some((x)=>x.quantity!==1)){flash('Đơn tặng chỉ cho phép 1 bản mỗi sách/combo. Hãy giảm số lượng về 1.','error');break;}
        const gift=state.giftMode?{...state.gift}:null;
        const o=await api.post('/shop/orders',{items:state.cart,couponCode:state.couponCode,...(gift?{gift}:{})});state.cart=[];state.couponCode='';state.giftMode=false;state.gift={recipientEmail:'',recipientName:'',message:''};saveCart();flash(gift?'Đã tạo đơn mua tặng!':'Đơn hàng đã được tạo.');navigate('#/orders/'+o.rowId);render();break;
      }
      case 'demo-pay': { if(!confirm('Xác nhận thanh toán DEMO (không trừ tiền thật)?'))break;await api.post('/shop/orders/'+id+'/demo-pay',{});flash('Thanh toán mô phỏng thành công.');render();break; }
      case 'read-pdf': navigate('#/read/'+id);render();break;
      case 'copy-gift-code': {const code=document.getElementById('order-gift-code')?.textContent;if(!code)break;try{await navigator.clipboard.writeText(code);flash('Đã sao chép mã quà tặng!');}catch{prompt('Sao chép mã này để gửi cho người nhận:',code);}break;}
      case 'download-pdf': {
        const file=await api.downloadPdf(id);const uri=URL.createObjectURL(file);const a=document.createElement('a');
        a.href=uri;a.download=(button.dataset.title||'book').replace(/[\\/:*?"<>|]/g,'_')+'.pdf';document.body.append(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(uri),1500);flash('Đang tải tệp PDF đã mua.');break;
      }
      case 'cancel-order': { if(!confirm('Bạn muốn hủy đơn đang chờ thanh toán?'))break;await api.post('/shop/orders/'+id+'/cancel',{});flash('Đã hủy đơn hàng.');render();break; }
      case 'favorite': { if(!withUser())break;const existing=state.favoriteIds.has(id);await (existing?api.del('/shop/favorites/'+id):api.post('/shop/favorites/'+id,{}));existing?state.favoriteIds.delete(id):state.favoriteIds.add(id);flash(existing?'Đã bỏ khỏi yêu thích':'Đã lưu sách vào yêu thích');break; }
      case 'report-book': { if(!withUser())break;const reason=prompt('Vui lòng mô tả lý do báo cáo (ít nhất 5 ký tự):');if(reason===null)break;await api.post('/shop/content-reports',{targetType:'BOOK',targetRowId:id,reason});flash('Đã gửi báo cáo để Nhà sách xem xét');break; }
      case 'logout': await api.post('/auth/logout',{}).catch(()=>{});state.user=null;setToken(null);state.favoriteIds.clear();flash('Đã đăng xuất');navigate('#/');render();break;
      case 'page': { const {query}=routeInfo();query.page=button.dataset.page;const q=new URLSearchParams(query);navigate('#/books?'+q.toString());render();break; }
      case 'clear-coupon':state.couponCode='';render();break;
      case 'empty-cart':state.cart=[];saveCart();render();break;
      case 'retry':render();break;
    }
  } catch(error) {flash(error.message,'error');}
  finally {button.disabled=false;}
}

async function boot() {
  if (getToken()) {
    try { const res=await api.get('/auth/me'); if(res.user.role==='BUYER') { state.user=res.user; const f=await api.get('/shop/favorites'); state.favoriteIds=new Set(f.items.map((b)=>b.rowId)); } else setToken(null); }
    catch {setToken(null);}
  }
  // Nếu file ảnh bị mất/corrupt, bỏ lớp ảnh để bìa minh họa CSS phía dưới hiện ra.
  document.addEventListener('error',(event)=>{
    if(event.target instanceof HTMLImageElement && event.target.classList.contains('cover-photo')) event.target.remove();
    if(event.target instanceof HTMLImageElement && event.target.classList.contains('cart-cover-photo')) {const container=event.target.parentElement;event.target.remove();if(container)container.textContent='✦';}
  },true);
  document.addEventListener('change',(e)=>{if(e.target?.id==='gift-toggle'){state.giftMode=e.target.checked;const fields=document.getElementById('gift-fields');if(fields)fields.hidden=!state.giftMode;}});
  document.addEventListener('input',(e)=>{if(e.target?.matches?.('[data-gift-field]'))state.gift[e.target.name]=e.target.value;});
  document.addEventListener('click',handleAction);
  document.addEventListener('submit',handleSubmit);
  window.addEventListener('hashchange',()=>{ refreshLiveEvents().finally(()=>render());window.scrollTo(0,0); });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshLiveEvents();});
  await refreshLiveEvents();
  await render();
  const clockTimer=setInterval(()=>{
    updateEventClocks();
    if(state.events.some((event)=>Date.parse(event.endAt)<=Date.now())){
      applyLiveEvents(state.events);refreshLiveEvents();
    }
  },1000);
  const eventTimer=setInterval(()=>{refreshLiveEvents();},30000);
  clockTimer.unref?.();eventTimer.unref?.();
}
boot();

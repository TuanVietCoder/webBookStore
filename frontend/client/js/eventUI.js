// Các mẫu hiển thị sự kiện lấy từ API công khai; nội dung Admin nhập luôn được escape.
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeId = (id) => Number.isSafeInteger(Number(id)) && Number(id)>0 ? Number(id) : 0;
const themes = new Set(['FOREST','TET','SUNSET','MIDNIGHT']);
const cssTheme = (event) => 'theme-' + (themes.has(event?.theme) ? event.theme.toLowerCase() : 'forest');
const dateText = (raw) => {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
};
export const eventLink = (event) => `#/events/${safeId(event?.rowId)}`;

export function eventRibbon(event) {
  if (!event) return '<div class="announcement">Thêm tri thức vào mỗi ngày ✦ Sách điện tử, đọc mọi lúc</div>';
  return `<a class="event-ribbon ${cssTheme(event)}" href="${eventLink(event)}" aria-label="Xem sự kiện ${esc(event.name)}">
    <span class="event-ribbon-dot" aria-hidden="true"></span>
    <strong>ĐANG DIỄN RA</strong><span class="event-ribbon-divider" aria-hidden="true">✦</span>
    <span class="event-ribbon-title">${esc(event.name)}</span>
    ${event.maxDiscountPercent > 0 ? `<span class="event-ribbon-off">Giảm đến ${Number(event.maxDiscountPercent)}%</span>` : ''}
    <span class="event-ribbon-cta">Xem ưu đãi →</span></a>`;
}

function eventDates(event) {
  return `<div class="event-period"><span aria-hidden="true">◷</span> ${esc(dateText(event.startAt))} — ${esc(dateText(event.endAt))}</div>`;
}
function clock(event) {
  return `<div class="event-countdown"><span>Chương trình kết thúc sau</span><strong class="event-clock" data-event-end="${esc(event.endAt)}">Đang tính...</strong></div>`;
}
export function eventHero(event, cover) {
  const books = Array.isArray(event.books) ? event.books : [];
  return `<section class="event-hero ${cssTheme(event)}" aria-labelledby="live-event-title">
    <div class="event-hero-decoration" aria-hidden="true">✳</div>
    <div class="container event-hero-grid">
      <div class="event-hero-copy">
        <div class="event-live-badge"><span class="live-dot" aria-hidden="true"></span> ĐANG DIỄN RA <span>·</span> ${esc(event.badgeText)}</div>
        <p class="event-edition">SỰ KIỆN ĐẶC BIỆT · NHÀ SÁCH PDF</p>
        <h1 id="live-event-title">${esc(event.headline || event.name)}</h1>
        <p class="event-hero-description">${esc(event.description)}</p>
        <div class="event-hero-actions"><a href="${eventLink(event)}" class="event-cta-primary">${Number(event.bookCount || 0) + Number(event.bundleCount || 0) ? `Khám phá ${Number(event.bookCount || 0) + Number(event.bundleCount || 0)} ưu đãi` : 'Xem chương trình'} <span aria-hidden="true">↗</span></a><a class="event-cta-secondary" href="#/books">Xem tất cả sách →</a></div>
        ${clock(event)}${eventDates(event)}
      </div>
      <div class="event-hero-art" aria-hidden="true">
        <div class="event-art-orbit"></div><div class="event-art-spark star-one">✳</div><div class="event-art-spark star-two">✦</div>
        ${books[1] ? `<div class="event-art-book book-back">${cover(books[1])}</div>` : ''}
        ${books[0] ? `<div class="event-art-book book-front">${cover(books[0])}</div>` : '<div class="event-placeholder-book">NHÀ SÁCH<br>PDF <span>✦</span></div>'}
        <div class="event-art-seal"><small>${event.maxDiscountPercent > 0 ? 'GIẢM ĐẾN' : 'CHỈ TRONG'}</small><strong>${event.maxDiscountPercent > 0 ? Number(event.maxDiscountPercent)+'%' : 'EVENT'}</strong><span>ƯU ĐÃI ĐANG DIỄN RA</span></div>
      </div>
    </div>
  </section>`;
}
export function eventOffers(event, productCard, bundleCard, { inHome = false } = {}) {
  const books = Array.isArray(event.books) ? event.books : [];
  const bundles = Array.isArray(event.bundles) ? event.bundles : [];
  return `<section class="container event-offers ${inHome ? 'event-offers-home' : ''}">
    <div class="event-section-heading"><div><span class="eyebrow">ƯU ĐÃI TRONG CHƯƠNG TRÌNH</span><h2>${inHome ? 'Sách đang có giá đặc biệt' : 'Sách nổi bật của sự kiện'}</h2><p>${esc(event.name)} · Ưu đãi được tự động áp dụng trong giỏ hàng</p></div>${inHome?`<a class="text-link" href="${eventLink(event)}">Xem sự kiện →</a>`:''}</div>
    ${books.length ? `<div class="products-grid">${books.slice(0,inHome?4:40).map(productCard).join('')}</div>` : '<p class="event-empty">Hiện chưa có sách giảm giá trực tiếp trong chương trình.</p>'}
    ${bundles.length ? `<div class="event-bundles-title"><h3>Combo tham gia sự kiện</h3><p>Giá combo hiển thị là giá đã được Admin công bố.</p></div><div class="bundles-grid">${bundles.map(bundleCard).join('')}</div>` : ''}
  </section>`;
}
export function eventPreview(event) {
  return `<article class="event-preview ${cssTheme(event)}"><div><span class="event-preview-status">● ĐANG DIỄN RA</span><h2>${esc(event.name)}</h2><p>${esc(event.description)}</p><div class="event-preview-end">Kết thúc: ${esc(dateText(event.endAt))}</div></div><a class="event-cta-primary" href="${eventLink(event)}">Xem ưu đãi ↗</a></article>`;
}
export function updateEventClocks(root = document) {
  for (const el of root.querySelectorAll?.('.event-clock[data-event-end]') || []) {
    const left = Date.parse(el.dataset.eventEnd) - Date.now();
    if (!Number.isFinite(left) || left <= 0) { el.textContent = 'Đã kết thúc'; continue; }
    const seconds = Math.floor(left/1000);
    const days = Math.floor(seconds/86400);
    const hours = Math.floor(seconds%86400/3600);
    const minutes = Math.floor(seconds%3600/60);
    const secs = seconds%60;
    el.textContent = `${days ? days+' ngày · ' : ''}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }
}

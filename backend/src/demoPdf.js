// PDF doc mau tu tao cho LAB. Chi chua van ban placeholder, khong sao chep tac pham that.
// Khong can thu vien ben ngoai: PDF 1.4, font Helvetica chuan, co xref de trinh doc mo duoc.
const LATIN = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean vitae nibh et neque pretium malesuada. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.',
  'Curabitur placerat, magna eu facilisis lacinia, justo magna interdum augue, vitae ultricies ipsum lorem at risus. Donec aliquam nunc eu purus sollicitudin sagittis.',
  'Praesent a neque condimentum, dictum mi sed, consequat arcu. Vivamus volutpat ex id dolor commodo, at sagittis nibh tristique. Pellentesque habitant morbi tristique senectus.',
  'Integer tempor nulla nec finibus elementum. Proin fermentum, nulla vel dictum laoreet, neque magna porta eros, ac malesuada velit arcu eget massa. Morbi nec magna id lectus.',
  'Aliquam erat volutpat. Sed volutpat, magna sed viverra ultrices, velit nisl laoreet mi, ac egestas turpis eros ac massa. Phasellus egestas sapien et dolor consequat ultricies.',
  'Quisque eleifend eros ut urna volutpat feugiat. Maecenas at tellus efficitur, convallis dui vitae, pulvinar metus. Suspendisse potenti. In hac habitasse platea dictumst.',
];
const normalized = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
const escapePdf = (s) => normalized(s).replace(/[\\()]/g, (c) => '\\' + c);
const line = (s, size, x, y) => `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdf(s)}) Tj ET\n`;
function wrap(input, width = 95) {
  const words = normalized(input).split(' ');
  const lines = []; let current = '';
  for (const word of words) {
    if (!word) continue;
    if ((current + ' ' + word).trim().length > width && current) { lines.push(current); current = word; }
    else current = (current + ' ' + word).trim();
  }
  if (current) lines.push(current);
  return lines;
}
export function demoPdf(book) {
  const title = normalized(book?.title || 'Sach dien tu') || 'Sach dien tu';
  const pages = [];
  for (let page = 0; page < 7; page++) {
    let stream = '';
    stream += line('NHA SACH PDF / DEMONSTRATION READER', 10, 44, 796);
    stream += line(title.slice(0, 65), 17, 44, 765);
    stream += line(`CHUONG MAU ${page + 1} / 7`, 11, 44, 744);
    stream += line('NOI DUNG GIA LAP - KHONG PHAI NOI DUNG CUA SACH THAT', 9, 44, 720);
    let y = 688;
    for (let block = 0; block < 7; block++) {
      const paragraph = LATIN[(page * 3 + block) % LATIN.length] + ' ' + LATIN[(page * 3 + block + 2) % LATIN.length];
      for (const text of wrap(paragraph)) {
        if (y < 64) break;
        stream += line(text, 10, 44, y);
        y -= 14;
      }
      y -= 13;
    }
    stream += line(`SAMPLE PDF | Trang ${page + 1} / 7 | Du lieu lorem ipsum, chi de test website`, 9, 44, 40);
    pages.push(stream);
  }
  const objs = [null, '<< /Type /Catalog /Pages 2 0 R >>'];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objs[2] = `<< /Type /Pages /Kids [ ${kids} ] /Count ${pages.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((stream, i) => {
    const pageId = 4 + i * 2;
    const contentId = pageId + 1;
    objs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objs[contentId] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`;
  });
  const chunks = ['%PDF-1.4\n'];
  const offsets = [0]; let position = Buffer.byteLength(chunks[0], 'ascii');
  for (let i = 1; i < objs.length; i++) {
    offsets.push(position);
    const object = `${i} 0 obj\n${objs[i]}\nendobj\n`;
    chunks.push(object);
    position += Buffer.byteLength(object, 'ascii');
  }
  const startXref = position;
  chunks.push(`xref\n0 ${objs.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < objs.length; i++) chunks.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  chunks.push(`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);
  return Buffer.from(chunks.join(''), 'ascii');
}

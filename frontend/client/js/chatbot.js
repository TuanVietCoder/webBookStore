import { api } from './api.js';

// Chat widget độc lập với router Client, nên không bị reset khi chuyển trang.
const QUICK = ['Gợi ý sách dưới 100k', 'Mua tặng sách thế nào?', 'Cách đọc PDF đã mua?'];
const MAX_LENGTH = 400;
const INTRO = 'Chào bạn! 🌿 Mình có thể gợi ý sách theo sở thích/ngân sách, so sánh các cuốn, hướng dẫn mua tặng và đọc PDF sau khi mua. Mình chỉ trả lời về sách và dịch vụ tại cửa hàng nhé!';

const el = (tag, className = '', content = '') => {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (content) item.textContent = content;
  return item;
};
const add = (parent, child) => { parent.append(child); return child; };
const money = (number) => `${Number(number || 0).toLocaleString('vi-VN')}đ`;

function mount() {
  if (document.getElementById('book-chat-root')) return;
  const root = add(document.body, el('div','book-chat-root'));
  root.id = 'book-chat-root';
  const trigger = add(root, el('button','book-chat-trigger'));
  trigger.type = 'button'; trigger.id = 'book-chat-trigger';
  trigger.setAttribute('aria-label','Mở trợ lý tư vấn sách');
  trigger.setAttribute('aria-controls','book-chat-panel');
  trigger.setAttribute('aria-expanded','false');
  const star = add(trigger, el('span','book-chat-trigger-icon','✦'));
  star.setAttribute('aria-hidden','true');
  add(trigger, el('span','book-chat-trigger-text','Hỏi trợ lý sách'));
  add(trigger, el('span','book-chat-online-dot')).setAttribute('aria-hidden','true');

  const panel = add(root, el('section','book-chat-panel'));
  panel.id = 'book-chat-panel'; panel.hidden = true;
  panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Trợ lý tư vấn sách PDF');
  const header = add(panel, el('header','book-chat-header'));
  const identity = add(header, el('div','book-chat-identity'));
  add(identity, el('div','book-chat-avatar','✦'));
  const info = add(identity, el('div','book-chat-identity-text'));
  add(info, el('strong','', 'Trợ lý Nhà sách'));
  const status = add(info, el('small','', 'Đang kiểm tra kết nối...'));
  const controls = add(header, el('div','book-chat-controls'));
  const clear = add(controls,el('button','book-chat-icon-btn','↺'));
  clear.type='button'; clear.title='Xóa hội thoại'; clear.setAttribute('aria-label','Xóa hội thoại');
  const close = add(controls,el('button','book-chat-icon-btn','×'));
  close.type='button'; close.title='Đóng chat'; close.setAttribute('aria-label','Đóng chat');

  const introStrip = add(panel, el('div','book-chat-scope','Chỉ tư vấn sách và dịch vụ sách của website. Không trả lời chủ đề khác.'));
  introStrip.setAttribute('role','note');
  const log = add(panel, el('div','book-chat-log'));
  log.id = 'book-chat-log'; log.setAttribute('role','log'); log.setAttribute('aria-live','polite'); log.setAttribute('aria-relevant','additions');
  const suggestions = add(panel, el('div','book-chat-suggestions'));
  const form = add(panel, el('form','book-chat-form'));
  const label = add(form, el('label','book-chat-sr','Nhập câu hỏi về sách'));
  label.htmlFor = 'book-chat-input';
  const input = add(form, el('textarea','book-chat-input'));
  input.id='book-chat-input';input.rows=1;input.maxLength=MAX_LENGTH;input.placeholder='Hỏi về sách, tác giả, giá tiền...';
  input.setAttribute('aria-label','Nhập câu hỏi về sách');
  const submit = add(form, el('button','book-chat-send','➤'));
  submit.type='submit';submit.setAttribute('aria-label','Gửi câu hỏi');
  add(panel, el('p','book-chat-disclaimer','Trợ lý dùng dữ liệu công khai của nhà sách; khi bạn đăng nhập, trợ lý chỉ xem được đơn hàng của chính bạn. Nếu cần xử lý đơn hàng, hãy vào mục Hỗ trợ.'));

  let lastBookIds=[];
  let lastTurns=[];
  let busy=false;
  function scrollToLatest() { log.scrollTop=log.scrollHeight; requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight;}); }
  function addMessage(kind,text,books=[]) {
    const message = add(log,el('div',`book-chat-message ${kind==='user'?'book-chat-user':'book-chat-assistant'}`));
    const bubble=add(message,el('div','book-chat-bubble',text));
    if(kind==='assistant' && books.length) {
      const list = add(message, el('div','book-chat-book-list'));
      for (const book of books.slice(0,3)) {
        if (!Number.isSafeInteger(book.rowId)||book.rowId<=0) continue;
        const card = add(list,el('a','book-chat-book-card'));
        card.href=`#/book/${book.rowId}`;
        const symbol=add(card,el('span','book-chat-book-icon','▤'));symbol.setAttribute('aria-hidden','true');
        if (book.coverUrl && /^\/api\/v1\/shop\/books\/\d+\/cover\?v=\d+$/.test(book.coverUrl)) {
          symbol.textContent='';
          const coverImg=add(symbol,el('img','book-chat-cover-img'));
          coverImg.src=book.coverUrl;coverImg.alt='';coverImg.loading='lazy';
          coverImg.addEventListener('error',()=>{coverImg.remove();symbol.textContent='▤';});
        }
        const details=add(card,el('span','book-chat-book-details'));
        add(details,el('strong','',book.title));
        add(details,el('small','',`${(book.authorNames||[]).join(', ') || book.categoryName} · ${money(book.currentPrice)}`));
        const arrow=add(card,el('span','book-chat-book-arrow','↗'));arrow.setAttribute('aria-hidden','true');
        card.addEventListener('click',()=>setOpen(false));
      }
    }
    scrollToLatest();
    return bubble;
  }
  function quickReplies(prompts = QUICK) {
    suggestions.replaceChildren();
    prompts.slice(0,3).forEach((prompt) => {
      const chip=add(suggestions,el('button','book-chat-chip',prompt));
      chip.type='button'; chip.disabled=busy;
      chip.addEventListener('click',()=>sendMessage(prompt));
    });
  }
  function setOpen(shouldOpen) {
    panel.hidden=!shouldOpen;
    trigger.setAttribute('aria-expanded', String(shouldOpen));
    trigger.classList.toggle('is-open',shouldOpen);
    if (shouldOpen) { input.focus(); scrollToLatest(); }
    else trigger.focus();
  }
  function setBusy(value) {
    busy=value; submit.disabled=value; input.disabled=value;
    suggestions.querySelectorAll('button').forEach((b)=>{b.disabled=value;});
  }
  async function sendMessage(question) {
    const message=String(question || '').trim();
    if (!message || busy) return;
    if (message.length>MAX_LENGTH) { addMessage('assistant','Câu hỏi tối đa 400 ký tự, bạn hãy rút gọn giúp mình nhé.');return; }
    suggestions.replaceChildren();
    addMessage('user',message);
    input.value='';setBusy(true);
    const waiting=addMessage('assistant','Đang kiểm tra danh mục sách...');
    waiting.classList.add('book-chat-waiting');
    try {
      const response=await api.post('/shop/chat',{message,contextBookIds:lastBookIds,history:lastTurns.slice(-6)});
      waiting.parentElement.remove();
      addMessage('assistant',response.answer || 'Mình chưa có thông tin cho câu hỏi này.',Array.isArray(response.books)?response.books:[]);
      lastBookIds=(response.books||[]).map((b)=>b.rowId).filter(Number.isSafeInteger).slice(0,3);
      lastTurns.push({role:'user',content:message},{role:'assistant',content:String(response.answer||'').slice(0,400)});
      lastTurns=lastTurns.slice(-6);
      if (!response.inScope) lastBookIds=[];
      status.textContent=response.mode==='ai'?'AI kết nối · Chỉ tư vấn sách':'Tư vấn theo danh mục sách';
    } catch(error) {
      waiting.parentElement.remove();
      addMessage('assistant',error.status===429 ? error.message : 'Hiện mình không thể kết nối với máy chủ nhà sách. Bạn thử lại sau hoặc vào mục Hỗ trợ nhé.');
      status.textContent='Không kết nối được';
    } finally { setBusy(false);
      const followups=lastBookIds.length>1?['So sánh hai cuốn này','Cuốn thứ 2 giá bao nhiêu?','Mua tặng sách thế nào?']:lastBookIds.length?['Giá bao nhiêu?','Nội dung cuốn này?','Cách mua tặng sách?']:QUICK;
      quickReplies(followups); scrollToLatest(); input.focus(); }
  }
  trigger.addEventListener('click',()=>setOpen(panel.hidden));
  close.addEventListener('click',()=>setOpen(false));
  clear.addEventListener('click',()=>{
    lastBookIds=[];lastTurns=[]; log.replaceChildren(); addMessage('assistant',INTRO); quickReplies(); input.focus();
  });
  input.addEventListener('keydown',(event)=>{
    if (event.key==='Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
    if (event.key==='Escape') { event.preventDefault(); setOpen(false); }
  });
  form.addEventListener('submit',(event)=>{event.preventDefault();sendMessage(input.value);});
  document.addEventListener('keydown',(event)=>{ if(event.key==='Escape'&&!panel.hidden) setOpen(false); });
  addMessage('assistant', INTRO);
  quickReplies();
  api.get('/shop/chat/status').then((r)=>{
    status.textContent=r.mode==='ai'?'AI kết nối · Chỉ tư vấn sách':'Tư vấn theo danh mục sách';
  }).catch(()=>{status.textContent='Chưa kết nối được';});
}
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
else mount();

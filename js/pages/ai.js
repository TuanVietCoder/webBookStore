// Trợ lý AI Admin: hỏi đáp có nguồn, thao tác ghi luôn qua bước xem trước + xác nhận một lần.
import { api } from '../api.js';
import { h, clear, guard, toast, pageHead } from '../ui.js';

export async function render(root) {
  const log = h('div', { class: 'chat tall', 'aria-live': 'polite' }); const input = h('input', { type: 'text', placeholder: 'VD: Quy trình hoàn tất thanh toán? / Khóa tài khoản an@mail.test', 'aria-label': 'Câu hỏi' });
  const add = (who, el) => { log.append(h('div', { class: 'msg ' + (who === 'me' ? 'me' : '') }, el)); log.scrollTop = log.scrollHeight; };
  const send = async () => {
    const text = input.value.trim(); if (!text) return; input.value = ''; add('me', text);
    const r = await guard(() => api.post('/ai/admin/chat', { message: text })); if (!r) return; reply(r);
  };
  function reply(r) {
    if (r.type === 'PREVIEW') {
      const box = h('div', null, h('strong', null, r.text), h('p', null, r.summary), h('div', { class: 'help' }, 'Hết hạn lúc ' + new Date(r.expiresAt).toLocaleTimeString('vi-VN')));
      const ok = h('button', { class: 'btn primary small', onClick: async () => { ok.disabled = no.disabled = true; const x = await guard(() => api.post('/ai/admin/actions/' + r.requestId + '/confirm', { confirmToken: r.confirmToken })); if (x) reply(x); } }, 'Xác nhận thực hiện');
      const no = h('button', { class: 'btn small', onClick: async () => { ok.disabled = no.disabled = true; const x = await guard(() => api.post('/ai/admin/actions/' + r.requestId + '/decline')); if (x) reply(x); } }, 'Hủy');
      box.append(h('div', { class: 'row-actions' }, ok, no)); add('ai', box);
    } else add('ai', h('div', null, r.text.split('\n').map((l) => h('div', null, l)), r.sources ? h('div', { class: 'help' }, 'Nguồn: ' + r.sources.join('; ')) : null));
  }
  add('ai', 'Xin chào! Mình trả lời theo tài liệu đã công bố, số liệu theo quyền của bạn. Thao tác ghi (như khóa tài khoản) luôn cần bạn xác nhận.');
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  root.append(pageHead('Trợ lý AI Admin'), log, h('div', { class: 'chat-input' }, input, h('button', { class: 'btn primary', onClick: send }, 'Gửi')));
}

import { api } from '../api.js';
import { h, clear, table, pager, filters, modal, badge, money, dt, kv, loading, errorBox, pageHead } from '../ui.js';

export async function render(root, { query }) {
  const state = { page: 1, pageSize: 10, q: '', status: query.status || '', gift: '' };
  const box = h('div');
  const bar = filters([{ name: 'q', label: 'Mã đơn / email Buyer' }, { name: 'status', label: 'Trạng thái', type: 'select', options: ['PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELLED'].map((v) => ({ value: v, label: v })) },
    { name: 'gift', label: 'Quà tặng', type: 'select', options: [{ value: 'true', label: 'Chỉ đơn quà tặng' }] }], state, load);
  root.append(pageHead('Đơn hàng (chỉ xem để hỗ trợ)'), h('p', { class: 'muted' }, 'Hệ thống tự xử lý thanh toán giả lập, không có bước duyệt đơn. Trang này không hiển thị dữ liệu thanh toán nhạy cảm.'), bar, box);
  await load();
  async function load() {
    clear(box).append(loading());
    try {
      const p = await api.get('/admin/orders', state); clear(box);
      box.append(table([{ label: 'Mã đơn', key: 'orderId' }, { label: 'Buyer', key: 'buyerName' }, { label: 'Người nhận', render: (o) => (o.isGift ? o.recipientName + ' (quà)' : '—') }, { label: 'Tổng', render: (o) => money(o.total), class: 'num' },
        { label: 'Giảm', render: (o) => (o.discount ? money(o.discount) + ' · ' + o.discountSource : '—'), class: 'num' }, { label: 'Trạng thái', render: (o) => badge(o.status) }, { label: 'Tạo lúc', render: (o) => dt(o.createdAt) }], p.items, { onRow: (o) => detail(o.rowId), empty: 'Không có đơn phù hợp' }),
        pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(box).append(errorBox(e, load)); }
  }
  async function detail(id) {
    const o = await api.get('/admin/orders/' + id);
    modal('Đơn ' + o.orderId, h('div', null, kv([['Buyer', o.buyerName], ['Người nhận', o.recipientName + (o.isGift ? ' (quà tặng)' : '')], ['Trạng thái', badge(o.status)], ['Tạm tính', money(o.subtotal)], ['Giảm giá', o.discount ? money(o.discount) + ' (' + o.discountSource + (o.couponCode ? ' · ' + o.couponCode : '') + ')' : 'Không'], ['Tổng thanh toán', h('strong', null, money(o.total))],
      ['Thanh toán', o.payment.method + ' · ' + o.payment.attemptStatus + (o.payment.failureCode ? ' · ' + o.payment.failureCode : '')]]),
      h('h4', null, 'Sản phẩm'), table([{ label: 'Loại', key: 'type' }, { label: 'Tên', key: 'name' }, { label: 'Giá', render: (i) => money(i.price), class: 'num' }], o.items),
      h('h4', null, 'Lịch sử trạng thái'), table([{ label: 'Thời điểm', render: (x) => dt(x.at) }, { label: 'Trạng thái', render: (x) => badge(x.status) }], o.history)), { wide: true });
  }
}

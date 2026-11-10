import { api } from '../api.js';
import { h, table, money, kv, pageHead, badge } from '../ui.js';

export async function render(root, { can }) {
  const op = await api.get('/admin/reports/operational');
  root.append(pageHead('Báo cáo'), h('div', { class: 'card' }, h('h3', null, 'Vận hành'), kv([['Tổng đơn', op.totalOrders], ['Số Buyer', op.newBuyers], ['Khiếu nại cần xử lý', op.openComplaints], ['Revision chờ duyệt', op.pendingRevisions], ['Báo cáo nội dung chờ', op.pendingContentReports], ['Sách bị đình chỉ phục vụ', op.suspendedBooks]]),
    table([{ label: 'Trạng thái đơn', render: (r) => badge(r[0]) }, { label: 'Số đơn', render: (r) => r[1], class: 'num' }], Object.entries(op.ordersByStatus))));
  if (!can('REPORT_FINANCIAL')) { root.append(h('div', { class: 'card muted' }, 'Báo cáo tài chính chỉ dành cho Manager.')); return; }
  const f = await api.get('/admin/reports/financial'); const max = Math.max(1, ...f.daily.map((d) => d.amount));
  root.append(h('div', { class: 'card' }, h('h3', null, 'Tài chính (đơn đã thanh toán)'), kv([['Doanh thu', h('strong', null, money(f.revenue))], ['Tổng trước giảm giá', money(f.grossBeforeDiscount)], ['Số đơn PAID', f.paidOrders], ['Đơn 0đ (INTERNAL_FREE)', f.freeOrders],
    ['Doanh thu sách lẻ (BOOK)', money(f.byType.BOOK)], ['Doanh thu BUNDLE', money(f.byType.BUNDLE)], ['Giảm bởi Coupon', money(f.discountBySource.COUPON)], ['Giảm bởi Event', money(f.discountBySource.EVENT)]]),
    h('h4', null, 'Doanh thu theo ngày'), h('div', { class: 'bars', role: 'img', 'aria-label': 'Biểu đồ doanh thu theo ngày' }, f.daily.map((d) => h('div', { class: 'bar-col', title: d.date + ': ' + money(d.amount) }, h('div', { class: 'bar', style: 'height:' + Math.max(4, (d.amount / max) * 100) + '%' }), h('small', null, d.date.slice(5))))),
    h('h4', null, 'Mặt hàng bán chạy'), table([{ label: 'Tên', key: 'name' }, { label: 'Số lượng', key: 'qty', class: 'num' }], f.topItems)));
}

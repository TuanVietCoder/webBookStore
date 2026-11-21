import { api } from '../api.js';
import { h, money, kv } from '../ui.js';

export async function render(root, { can }) {
  const op = await api.get('/admin/reports/operational');
  const card = (t, v, href, tone = '') => h('a', { class: 'stat ' + tone, href }, h('span', { class: 'stat-v' }, v), h('span', { class: 'stat-t' }, t));
  root.append(h('div', { class: 'page-head' }, h('h2', null, 'Tổng quan')),
    h('div', { class: 'stats' },
      card('Tổng số đơn', op.totalOrders, '#/orders'), card('Đơn chờ thanh toán', op.ordersByStatus.PENDING_PAYMENT || 0, '#/orders?status=PENDING_PAYMENT', 'warn'),
      card('Khiếu nại cần xử lý', op.openComplaints, '#/complaints', op.openComplaints ? 'warn' : ''), card('Revision chờ duyệt', op.pendingRevisions, '#/bundles', op.pendingRevisions ? 'warn' : ''),
      card('Báo cáo nội dung chờ xử lý', op.pendingContentReports, '#/content-reports', op.pendingContentReports ? 'warn' : ''), card('Sách bị đình chỉ phục vụ', op.suspendedBooks, '#/books?servingStatus=SUSPENDED', op.suspendedBooks ? 'bad' : '')),
    h('div', { class: 'card' }, h('h3', null, 'Đơn theo trạng thái'), kv(Object.entries(op.ordersByStatus).map(([k, v]) => [k, v]))));
  if (can('REPORT_FINANCIAL')) {
    const f = await api.get('/admin/reports/financial');
    root.append(h('div', { class: 'card' }, h('h3', null, 'Doanh thu (đơn đã thanh toán)'), kv([['Tổng doanh thu', money(f.revenue)], ['Số đơn PAID', f.paidOrders], ['Đơn 0đ', f.freeOrders]])));
  }
}

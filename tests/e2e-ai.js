// Kiểm thử luồng AI thật (qua server/index.js + Gemini giả). Chạy: xem README mục "Kiểm thử AI".
const { chromium } = require('playwright');
(async () => { const res = []; const errs = []; let b;
  try {
    b = await chromium.launch(); const page = await (await b.newContext()).newPage();
    page.on('pageerror', (e) => errs.push(e.message));
    const base = process.env.BASE || 'http://localhost:8766/index.html'; const ok = (n, c, x = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x));
    const login = async (e, p) => { await page.goto(base + '#/login'); await page.evaluate(() => sessionStorage.clear()); await page.reload(); await page.waitForSelector('.login-card'); await page.fill('input[type=email]', e); await page.fill('input[type=password]', p); await page.click('button:has-text("Đăng nhập")'); await page.waitForSelector('.shell'); };
    const ask = async (t) => { const n = await page.$$eval('.msg', (m) => m.length); await page.fill('.chat-input input', t); await page.click('.chat-input .btn.primary'); await page.waitForFunction((n) => document.querySelectorAll('.msg').length >= n + 2, n); return page.$$eval('.msg', (m) => m[m.length - 1].innerText); };
    await login('employee@nhasach.test', 'Employee@123'); await page.goto(base + '#/ai'); await page.waitForSelector('.chat');
    let t = await ask('xin chào'); ok('có trả lời từ mô hình AI', t.includes('LLM giả'), t);
    ok('Employee không được cấp tool tài chính/audit', t.includes('tools=') && !t.includes('get_revenue') && !t.includes('get_recent_audit'), t);
    t = await ask('hướng dẫn quy trình thanh toán'); ok('tool search_knowledge chạy và có nguồn', t.includes('Hoàn tất thanh toán') && t.includes('Nguồn'), t);
    t = await ask('doanh thu hôm nay'); ok('tool tài chính bị chặn với Employee', /Thiếu quyền|chưa|Mình/.test(t), t);
    t = await ask('khóa tài khoản an@mail.test'); ok('thao tác ghi dừng ở PREVIEW, có nút xác nhận', (await page.$('text=Xác nhận thực hiện')) !== null, t);
    const before = await page.evaluate(async () => (await (await import('/js/api.js')).api.get('/admin/users', { q: 'an@mail.test' })).items[0]);
    ok('chưa xác nhận thì tài khoản chưa bị khóa', before && before.status === 'ACTIVE', JSON.stringify(before));
    await page.click('text=Xác nhận thực hiện'); await page.waitForFunction(() => document.body.innerText.includes('Đã thực hiện'));
    const after = await page.evaluate(async () => (await (await import('/js/api.js')).api.get('/admin/users', { q: 'an@mail.test' })).items[0]);
    ok('sau xác nhận thì khóa', after.status !== 'ACTIVE', after.status);
    t = await ask('boom'); ok('AI lỗi -> rơi về mô phỏng, có thông báo', t.includes('chế độ mô phỏng'), t);
    await login('manager@nhasach.test', 'Manager@123'); await page.goto(base + '#/ai'); await page.waitForSelector('.chat');
    t = await ask('xin chào'); ok('Manager được cấp thêm tool', t.includes('get_revenue') && t.includes('get_recent_audit'), t);
    t = await ask('doanh thu'); ok('Manager xem được doanh thu', t.includes('revenueVnd'), t);
    ok('không có lỗi JS', errs.length === 0, errs.join('|'));
  } catch (e) { res.push('FAIL exception ' + e.message); } finally { if (b) await b.close(); }
  console.log(res.join('\n')); process.exit(res.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();

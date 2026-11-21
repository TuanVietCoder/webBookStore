// Test giao diện gọn (smoke test) bằng Playwright, chạy trên backend thật của dự án gộp.
// Chạy: npm install --no-save playwright && node tests/smoke.js
// Dùng DB tạm và tắt khóa API (AI chạy chế độ mô phỏng) nên không đụng dữ liệu thật, không tốn tiền.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const os = require('node:os'); const path = require('node:path'); const fs = require('node:fs');
const PORT = process.env.TEST_PORT || 8799; const BASE = `http://localhost:${PORT}/admin/`;

async function launch() { // thử trình duyệt đi kèm Playwright, rồi tới Edge/Chrome có sẵn trên máy
  for (const opt of [{}, { channel: 'msedge' }, { channel: 'chrome' }]) { try { return await chromium.launch(opt); } catch { /* thử tiếp */ } }
  throw new Error('Không mở được trình duyệt. Chạy: npx playwright install chromium');
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-'));
  const server = spawn(process.execPath, ['backend/src/server.js'], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_FILE: path.join(tmp, 'db.json'), ANTHROPIC_API_KEY: '', GEMINI_API_KEY: '', OPENAI_API_KEY: '' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const results = []; const errs = []; let browser;
  const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + extra}`);
  try {
    browser = await launch(); const page = await browser.newPage(); page.on('pageerror', (e) => errs.push(e.message));
    const login = async (email, pw) => {
      await page.goto(BASE + '#/login'); await page.evaluate(() => sessionStorage.clear()); await page.reload(); await page.waitForSelector('.login-card');
      await page.fill('input[type=email]', email); await page.fill('input[type=password]', pw); await page.click('button:has-text("Đăng nhập")');
    };
    const menu = () => page.$$eval('#navlist a', (a) => a.map((x) => x.textContent));
    const ask = async (q) => { const n = await page.$$eval('.msg', (m) => m.length); await page.fill('.chat-input input', q); await page.click('.chat-input .btn.primary'); await page.waitForFunction((n) => document.querySelectorAll('.msg').length >= n + 2, n); return page.$$eval('.msg', (m) => m[m.length - 1].innerText); };

    await login('manager@nhasach.test', 'sai'); await page.waitForSelector('.field-err:not(:empty)');
    ok('Đăng nhập sai mật khẩu bị từ chối', true);

    await login('manager@nhasach.test', 'Manager@123'); await page.waitForSelector('.shell');
    ok('Manager thấy menu Audit và Nhân sự', (await menu()).some((t) => /Audit/.test(t)) && (await menu()).some((t) => /Nhân sự/.test(t)));
    await page.goto(BASE + '#/books'); await page.waitForSelector('table tbody tr');
    ok('Trang Sách hiển thị danh sách', (await page.$$('table tbody tr')).length > 0);
    await page.goto(BASE + '#/ai'); await page.waitForSelector('.chat');
    ok('AI trả lời quy trình từ bài tri thức', (await ask('quy trình thanh toán')).includes('Hoàn tất thanh toán'));
    await ask('khóa tài khoản an@mail.test'); await page.click('text=Xác nhận thực hiện'); await page.waitForFunction(() => document.body.innerText.includes('Đã thực hiện'));
    ok('AI khóa tài khoản: xem trước rồi xác nhận mới thực hiện', true);

    await login('employee@nhasach.test', 'Employee@123'); await page.waitForSelector('.shell');
    ok('Employee không thấy menu Audit', !(await menu()).some((t) => /Audit/.test(t)));
    await page.goto(BASE + '#/audit'); await page.waitForSelector('.error-box');
    ok('Employee vào trang Audit bị chặn', (await page.textContent('.error-box')).includes('không có quyền'));
    ok('Không có lỗi JavaScript', errs.length === 0, errs.join(' | '));
  } catch (e) { results.push('FAIL  Lỗi khi chạy test  -> ' + e.message.split('\n')[0]); }
  finally { if (browser) await browser.close(); server.kill(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* bỏ qua */ } }
  console.log(results.join('\n')); const bad = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(bad ? `\n${bad} lỗi` : `\nTất cả ${results.length} kiểm tra đều đạt`); process.exit(bad ? 1 : 0);
})();

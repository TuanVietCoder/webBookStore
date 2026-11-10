const { chromium } = require('playwright');
(async () => { let results=[]; let errs=[]; let page,b;
 try {
  b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); page = await ctx.newPage();
   page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const base = 'http://localhost:8765/index.html'; const ok = (n, c, extra = '') => { results.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + extra)); };
  await page.goto(base); await page.waitForSelector('.login-card');
  ok('redirect to login', page.url().endsWith('#/login'));
  // wrong password
  await page.fill('input[type=email]', 'manager@nhasach.test'); await page.fill('input[type=password]', 'sai'); await page.click('text=Đăng nhập');
  await page.waitForSelector('.field-err:not(:empty)'); ok('wrong password message', (await page.textContent('.login-card .field-err:not(:empty)')).includes('không đúng'));
  const login = async (email, pw) => { await page.goto(base + '#/login'); await page.waitForSelector('.login-card'); await page.fill('input[type=email]', email); await page.fill('input[type=password]', pw); await page.click('button:has-text("Đăng nhập")'); await page.waitForSelector('.shell'); };
  await login('employee@nhasach.test', 'Employee@123');
  const navE = await page.$$eval('#navlist a', (a) => a.map((x) => x.textContent)); ok('employee nav hides Audit/Nhân sự/Cấu hình', !navE.some((t) => /Audit|Nhân sự|Cấu hình|Tri thức/.test(t)), navE.join('|'));
  await page.goto(base + '#/audit'); await page.waitForSelector('.error-box'); ok('employee blocked from audit page', (await page.textContent('.error-box')).includes('không có quyền'));
  // api-level rule tests as employee
  const call = (fn) => page.evaluate(async (src) => { const { api } = await import('/js/api.js'); try { return { ok: await eval('(async()=>{' + src + '})()') }; } catch (e) { return { status: e.status, code: e.errorCode, msg: e.message }; } }, fn);
  let r = await call("return await api.post('/admin/users/1/disable',{reason:'khóa thử nghiệm'})"); ok('employee cannot disable manager (403)', r.status === 403, JSON.stringify(r));
  r = await call("return await api.get('/admin/audit-logs')"); ok('employee audit-logs 403', r.status === 403);
  r = await call("return await api.get('/admin/reports/financial')"); ok('employee financial 403', r.status === 403);
  r = await call("return await api.post('/admin/users/8/enable',{reason:'xác minh lại'})"); ok('employee enable buyer ok', !r.status, JSON.stringify(r));
  r = await call("return await api.post('/admin/coupons',{code:'TEST15',data:{code:'TEST15',type:'PERCENT',value:15,startAt:new Date().toISOString(),endAt:new Date(Date.now()+864e5).toISOString()}})"); ok('create coupon draft', !r.status, JSON.stringify(r)); await page.evaluate((i)=>{window.__cid=i},r.ok.rowId);
  r = await call("return await api.post('/admin/coupons/'+((await api.get('/admin/coupons',{q:'TEST15'})).items[0].rowId)+'/revisions/1/approve',{})"); ok('employee cannot approve (403)', r.status === 403, JSON.stringify(r));
  r = await call("return await api.post('/admin/coupons/'+((await api.get('/admin/coupons',{q:'TEST15'})).items[0].rowId)+'/revisions/1/submit',{})"); ok('submit revision', !r.status, JSON.stringify(r));
  r = await call("return await api.post('/admin/coupons',{code:'TEST15',data:{}})"); ok('duplicate/validation error', r.status === 422 || r.status === 409, JSON.stringify(r));
  r = await call("return await api.post('/admin/books',{bookId:'BK001',title:'x',authorIds:[1],categoryId:1,price:1000})"); ok('duplicate BookId 409', r.status === 409 && r.code === 'DUPLICATE_BOOK_ID', JSON.stringify(r));
  r = await call("const b=await api.get('/admin/books/30'); return await api.patch('/admin/books/30',{status:'PUBLISHED'},b.version)"); ok('publish w/o file 422', r.status === 422 && r.code === 'BOOK_NO_FILE', JSON.stringify(r));
  r = await call("return await api.patch('/admin/books/1',{title:'Y'},999)"); ok('stale version 409', r.status === 409 && r.code === 'VERSION_CONFLICT', JSON.stringify(r));
  r = await call("return await api.get('/admin/history/Users/1')"); ok('employee history Users 403', r.status === 403, JSON.stringify(r));
  r = await call("return await api.post('/complaints/3/messages',{body:'thử'})"); ok('reply on RESOLVED ok', !r.status, JSON.stringify(r));
  r = await call("await api.patch('/admin/complaints/3',{status:'CLOSED'}); return await api.post('/complaints/3/messages',{body:'thử'})"); ok('reply on CLOSED 409', r.status === 409, JSON.stringify(r));
  // manager
  await page.click('button:has-text("Đăng xuất")'); await page.waitForSelector('.login-card');
  await login('manager@nhasach.test', 'Manager@123');
  r = await call("return await api.post('/admin/coupons/'+((await api.get('/admin/coupons',{q:'TEST15'})).items[0].rowId)+'/revisions/1/approve',{})"); ok('manager approve coupon', !r.status, JSON.stringify(r));
  r = await call("return await api.post('/admin/events/3/revisions/1/approve',{})"); ok('event overlap 409', r.status === 409 && r.code === 'EVENT_OVERLAP', JSON.stringify(r));
  r = await call("return await api.post('/admin/events/3/revisions/1/reject',{reason:'x'})"); ok('reject needs reason 422', r.status === 422, JSON.stringify(r));
  r = await call("return await api.post('/admin/events/3/revisions/1/reject',{reason:'Chồng lịch với Book Sale'})"); ok('reject ok', !r.status, JSON.stringify(r));
  r = await call("return await api.post('/admin/users/1/disable',{reason:'tự khóa thử'})"); ok('self lock 403', r.status === 403 && r.code === 'SELF_LOCK', JSON.stringify(r));
  r = await call("await api.post('/admin/users/2/disable',{reason:'khóa manager hai'}); return await api.post('/admin/users/1/disable',{reason:'khóa manager cuối'})"); ok('last manager rule', r.status === 403 || r.status === 409, JSON.stringify(r));
  r = await call("await api.post('/admin/users/2/enable',{reason:'mở lại manager hai'}); return 1"); ok('enable manager', !r.status, JSON.stringify(r));
  r = await call("return await api.patch('/admin/settings/PAYMENT_TIMEOUT_MINUTES',{value:'abc'},1)"); ok('setting validation 422', r.status === 422, JSON.stringify(r));
  r = await call("await api.patch('/admin/settings/MOCK_GATEWAY_SECRET',{value:'new-secret'},1); const l=await api.get('/admin/audit-logs',{action:'SETTING_UPDATE'}); return JSON.stringify(l.items[0])"); ok('sensitive setting masked in audit', r.ok && !r.ok.includes('new-secret') && !r.ok.includes('abc123'), JSON.stringify(r).slice(0, 300));
  r = await call("const a=await api.post('/ai/admin/chat',{message:'khóa tài khoản chi@mail.test'}); const b=await api.post('/ai/admin/actions/'+a.requestId+'/confirm',{confirmToken:a.confirmToken}); let again; try{await api.post('/ai/admin/actions/'+a.requestId+'/confirm',{confirmToken:a.confirmToken});}catch(e){again=e.status} return JSON.stringify({t:a.type,b:b.text,again})"); ok('AI preview→confirm once', r.ok && r.ok.includes('PREVIEW') && r.ok.includes('409'), JSON.stringify(r));
  r = await call("const a=await api.post('/ai/admin/chat',{message:'khóa tài khoản binh@mail.test'}); await api.post('/ai/admin/actions/'+a.requestId+'/decline'); const u=await api.get('/admin/users',{q:'binh'}); return u.items[0].status"); ok('AI decline no mutation', r.ok === 'ACTIVE', JSON.stringify(r));
  // UI smoke all pages
  const pages = ['', 'books', 'catalog', 'bundles', 'events', 'coupons', 'orders', 'complaints', 'content-reports', 'users', 'staff', 'reports', 'audit', 'knowledge', 'settings', 'ai'];
  for (const p of pages) { await page.goto(base + '#/' + p); await page.waitForSelector('.page', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(350); const bad = await page.$('.error-box'); const empty = (await page.$$('.page *')).length < 3; ok('page /' + p, !bad && !empty, bad ? await bad.textContent() : 'empty'); }
  // UI flows
  await page.goto(base + '#/books'); await page.waitForSelector('.tbl'); await page.click('.tbl tbody tr:first-child'); await page.waitForSelector('.modal'); ok('book detail modal', (await page.textContent('.modal')).includes('File PDF'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); ok('esc closes modal', (await page.$('.modal')) === null);
  await page.screenshot({ path: '/tmp/t/books.png' });
  await page.goto(base + '#/events'); await page.waitForSelector('.tbl'); await page.click('.tbl tbody tr:first-child'); await page.waitForSelector('.modal .rev'); await page.screenshot({ path: '/tmp/t/event.png' });
  await page.keyboard.press('Escape');
  await page.goto(base + '#/'); await page.waitForSelector('.stats'); await page.screenshot({ path: '/tmp/t/dash.png' });
  await page.setViewportSize({ width: 390, height: 800 }); await page.goto(base + '#/orders'); await page.waitForSelector('.tbl'); await page.screenshot({ path: '/tmp/t/mobile.png' });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); ok('mobile no horizontal scroll', sw);
  } catch (e) { console.log('EXC', e.message.split('\n')[0]); if (page) await page.screenshot({ path: '/tmp/t/fail.png' }); } finally { console.log(results.join('\n')); console.log('ERRORS:', errs.length ? errs.join('\n') : 'none'); if (b) await b.close(); }
})();

// Claude giả (Anthropic Messages API) để kiểm thử luồng tool-use và việc ghép tool_use/tool_result. Chạy: node tests/fake-claude.js [cổng]
import http from 'node:http';
const port = Number(process.argv[2]) || 9912;
http.createServer((req, res) => {
  let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => {
    const out = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url !== '/v1/messages') return out(404, { error: { message: 'not found' } });
    if (req.headers['x-api-key'] !== 'fake-key' || req.headers['anthropic-version'] !== '2023-06-01') return out(401, { error: { type: 'authentication_error', message: 'bad key' } });
    const b = JSON.parse(s); const msgs = b.messages; const last = msgs[msgs.length - 1];
    // Kiểm tra đúng quy tắc của Anthropic: bắt đầu bằng user, xen kẽ vai trò, tool_result phải khớp tool_use ngay trước đó.
    if (msgs[0].role !== 'user') return out(400, { error: { message: 'first message must be user' } });
    for (let i = 1; i < msgs.length; i++) if (msgs[i].role === msgs[i - 1].role) return out(400, { error: { message: 'roles must alternate' } });
    const uses = []; msgs.forEach((m, i) => m.content.forEach((c) => { if (c.type === 'tool_use') uses.push([i, c.id]); }));
    for (const [i, id] of uses) if (!msgs[i + 1] || !msgs[i + 1].content.some((c) => c.type === 'tool_result' && c.tool_use_id === id)) return out(400, { error: { message: 'tool_use ' + id + ' không có tool_result' } });
    if (!b.system || !b.max_tokens || !b.model) return out(400, { error: { message: 'thiếu system/max_tokens/model' } });
    const tools = (b.tools || []).map((t) => t.name); if ((b.tools || []).some((t) => t.input_schema.type !== 'object')) return out(400, { error: { message: 'input_schema sai' } });
    const text = (r) => out(200, { content: [{ type: 'text', text: r }], stop_reason: 'end_turn' });
    const tr = last.content.find((c) => c.type === 'tool_result');
    if (tr) return text('KẾT QUẢ TOOL: ' + tr.content.slice(0, 300) + ' | tools=' + tools.join(','));
    const t = (last.content.find((c) => c.type === 'text') || { text: '' }).text.toLowerCase();
    const call = (name, input) => out(200, { content: [{ type: 'text', text: 'Để mình kiểm tra.' }, { type: 'tool_use', id: 'toolu_01' + Math.random().toString(36).slice(2, 10), name, input }], stop_reason: 'tool_use' });
    if (t.includes('boom')) return out(529, { error: { type: 'overloaded_error', message: 'quá tải' } });
    if (t.includes('khóa')) return call('propose_disable_user', { email: (t.match(/\S+@\S+/) || [''])[0] });
    if (t.includes('quy trình')) return call('search_knowledge', { query: 'thanh toán' });
    if (t.includes('doanh thu')) return call('get_revenue', {});
    text('Xin chào từ LLM giả (claude). tools=' + tools.join(','));
  });
}).listen(port, () => console.log('fake claude :' + port));

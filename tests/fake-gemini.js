// Gemini giả để kiểm thử luồng tool-calling mà không cần khóa thật. Chạy: node tests/fake-gemini.js [cổng]
import http from 'node:http';
const port = Number(process.argv[2]) || 9911;
http.createServer((req, res) => {
  let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => {
    const b = JSON.parse(s || '{}'); const last = b.contents[b.contents.length - 1];
    const tools = (b.tools[0].functionDeclarations || []).map((d) => d.name);
    const reply = (parts) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ candidates: [{ content: { role: 'model', parts } }] })); };
    if (req.headers['x-goog-api-key'] !== 'fake-key') { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'bad key' } })); }
    if (last.parts[0].functionResponse) return reply([{ text: 'KẾT QUẢ TOOL: ' + JSON.stringify(last.parts[0].functionResponse.response).slice(0, 300) + ' | tools=' + tools.join(',') }]);
    const t = last.parts[0].text.toLowerCase();
    if (t.includes('boom')) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'sập' } })); }
    if (t.includes('khóa')) return reply([{ functionCall: { name: 'propose_disable_user', args: { email: (t.match(/\S+@\S+/) || [''])[0] } } }]);
    if (t.includes('sách')) return reply([{ functionCall: { name: 'search_books', args: { query: 'Dế Mèn' } } }]);
    if (t.includes('quy trình')) return reply([{ functionCall: { name: 'search_knowledge', args: { query: 'thanh toán' } } }]);
    if (t.includes('doanh thu')) return reply([{ functionCall: { name: 'get_revenue', args: {} } }]);
    reply([{ text: 'Xin chào từ LLM giả (gemini). tools=' + tools.join(',') }]);
  });
}).listen(port, () => console.log('fake gemini :' + port));

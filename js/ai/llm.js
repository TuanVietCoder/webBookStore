// Vòng lặp hỏi đáp với Gemini qua cầu nối /api/v1/ai/llm (khóa API nằm ở server, không ở trình duyệt).
// Mô hình chỉ chọn tool; việc chạy tool và kiểm quyền do execTool (backend/mock) thực hiện.
const MAX_STEPS = 4;
let statusCache = null;

export async function llmAvailable() {
  if (statusCache && Date.now() - statusCache.at < 30000) return statusCache.ok;
  let ok = false;
  try { const r = await fetch('/api/v1/ai/status', { cache: 'no-store' }); ok = r.ok && (await r.json()).llm === true; } catch { ok = false; }
  statusCache = { ok, at: Date.now() };
  return ok;
}

// history: [{role:'user'|'model', text}] các lượt trước. Trả {text} | {preview} ; ném lỗi nếu cầu nối hỏng.
export async function askLlm({ role, history = [], message, execTool }) {
  const contents = history.slice(-8).filter((h) => h && h.text && (h.role === 'user' || h.role === 'model')).map((h) => ({ role: h.role, parts: [{ text: String(h.text).slice(0, 1500) }] }));
  while (contents.length && contents[0].role !== 'user') contents.shift();
  contents.push({ role: 'user', parts: [{ text: message }] });
  const sources = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    const r = await fetch('/api/v1/ai/llm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, contents }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || 'Cầu nối AI lỗi ' + r.status);
    const calls = data.parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const text = data.parts.map((p) => p.text || '').join('').trim();
      return { text: text || 'Mình chưa có câu trả lời phù hợp.', sources: [...new Set(sources)] };
    }
    contents.push({ role: 'model', parts: data.parts });
    const responses = [];
    for (const c of calls) {
      const out = await execTool(c.functionCall.name, c.functionCall.args || {});
      if (out.preview) return { preview: out.preview };          // thao tác ghi: dừng ở bước xem trước
      if (out.sources) sources.push(...out.sources);
      responses.push({ functionResponse: { name: c.functionCall.name, response: out.result } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return { text: 'Mình chưa hoàn tất được yêu cầu này. Bạn thử hỏi cụ thể hơn.', sources: [] };
}

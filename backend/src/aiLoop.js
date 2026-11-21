// Vòng lặp hỏi đáp AI Admin chạy ở backend: mô hình chỉ chọn tool, tool do execTool chạy và tự kiểm quyền.
import { callLlm, hasKey } from './llm/index.js';

const MAX_STEPS = 4;
export const llmAvailable = async () => hasKey();

// history: [{role:'user'|'model', text}]. Trả {text, sources} hoặc {preview}; ném lỗi nếu nhà cung cấp AI lỗi.
export async function askLlm({ role, history = [], message, execTool }) {
  const contents = (Array.isArray(history) ? history : []).slice(-8).filter((h) => h && h.text && (h.role === 'user' || h.role === 'model')).map((h) => ({ role: h.role, parts: [{ text: String(h.text).slice(0, 1500) }] }));
  while (contents.length && contents[0].role !== 'user') contents.shift();
  contents.push({ role: 'user', parts: [{ text: String(message).slice(0, 2000) }] });
  const sources = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    const parts = await callLlm(role, contents);
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const text = parts.map((p) => p.text || '').join('').trim();
      return { text: text || 'Mình chưa có câu trả lời phù hợp.', sources: [...new Set(sources)] };
    }
    contents.push({ role: 'model', parts });
    const responses = [];
    for (const c of calls) {
      const out = await execTool(c.functionCall.name, c.functionCall.args || {});
      if (out.preview) return { preview: out.preview };
      if (out.sources) sources.push(...out.sources);
      responses.push({ functionResponse: { id: c.functionCall.id, name: c.functionCall.name, response: out.result } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return { text: 'Mình chưa hoàn tất được yêu cầu này. Bạn thử hỏi cụ thể hơn.', sources: [] };
}

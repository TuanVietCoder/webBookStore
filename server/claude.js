import { SYSTEM_PROMPT, jsonSchemaTools } from './shared.js';

// Gọi Claude (Anthropic Messages API) phía server. Khóa chỉ ở biến môi trường ANTHROPIC_API_KEY.
const MODEL = () => process.env.CLAUDE_MODEL || 'claude-haiku-5-5';
const BASE = () => process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
export const hasClaudeKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Hội thoại trung lập (parts: text / functionCall{id} / functionResponse{id}) -> messages của Anthropic.
function toMessages(contents) {
  const out = [];
  const push = (role, blocks) => { const last = out[out.length - 1]; if (last && last.role === role) last.content.push(...blocks); else out.push({ role, content: blocks }); };
  for (const m of contents) {
    const blocks = [];
    for (const p of m.parts) {
      if (typeof p.text === 'string' && p.text) blocks.push({ type: 'text', text: p.text });
      else if (p.functionCall) blocks.push({ type: 'tool_use', id: p.functionCall.id, name: p.functionCall.name, input: p.functionCall.args || {} });
      else if (p.functionResponse) blocks.push({ type: 'tool_result', tool_use_id: p.functionResponse.id, content: JSON.stringify(p.functionResponse.response || {}) });
    }
    if (blocks.length) push(m.role === 'model' ? 'assistant' : 'user', blocks);
  }
  return out;
}

export async function callClaude(role, contents) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { const e = new Error('Chưa cấu hình ANTHROPIC_API_KEY'); e.code = 'NO_KEY'; throw e; }
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(`${BASE()}/v1/messages`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL(), max_tokens: 800, temperature: 0.2, system: SYSTEM_PROMPT, messages: toMessages(contents), tools: jsonSchemaTools(role) }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((data.error && data.error.message) || 'Claude trả lỗi ' + r.status); e.code = 'UPSTREAM'; e.status = r.status; throw e; }
    const parts = (data.content || []).map((b) => (b.type === 'text' ? { text: b.text } : b.type === 'tool_use' ? { functionCall: { id: b.id, name: b.name, args: b.input || {} } } : null)).filter(Boolean);
    if (!parts.length) { const e = new Error('Claude không trả nội dung'); e.code = 'EMPTY'; throw e; }
    return parts;
  } finally { clearTimeout(timer); }
}

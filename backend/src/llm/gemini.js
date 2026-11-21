import { SYSTEM_PROMPT, declarationsFor } from './shared.js';

// Gọi Gemini phía server. Khóa chỉ ở biến môi trường GEMINI_API_KEY.
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const BASE = () => process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
export const hasGeminiKey = () => Boolean(process.env.GEMINI_API_KEY);

export async function callGemini(role, rawContents) {
  // Gemini không dùng id của tool call
  const contents = rawContents.map((m) => ({ role: m.role, parts: m.parts.map((p) => { if (p.functionCall) { const { id, ...fc } = p.functionCall; return { ...p, functionCall: fc }; } if (p.functionResponse) { const { id, ...fr } = p.functionResponse; return { ...p, functionResponse: fr }; } return p; }) }));
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('Chưa cấu hình GEMINI_API_KEY'); e.code = 'NO_KEY'; throw e; }
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(`${BASE()}/models/${MODEL()}:generateContent`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: [{ functionDeclarations: declarationsFor(role) }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((data.error && data.error.message) || 'Gemini trả lỗi ' + r.status); e.code = 'UPSTREAM'; e.status = r.status; throw e; }
    const cand = data.candidates && data.candidates[0];
    if (!cand || !cand.content || !cand.content.parts) { const e = new Error('Gemini không trả nội dung (có thể bị chặn an toàn)'); e.code = 'EMPTY'; throw e; }
    return cand.content.parts;
  } finally { clearTimeout(timer); }
}

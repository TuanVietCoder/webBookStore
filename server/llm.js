import { callGemini, hasGeminiKey } from './gemini.js';
import { callClaude, hasClaudeKey } from './claude.js';
export { isRole } from './shared.js';

// Chọn nhà cung cấp: LLM_PROVIDER=claude|gemini; không đặt thì ưu tiên Claude nếu có khóa Claude.
export function provider() {
  const want = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (want === 'claude') return hasClaudeKey() ? 'claude' : null;
  if (want === 'gemini') return hasGeminiKey() ? 'gemini' : null;
  return hasClaudeKey() ? 'claude' : hasGeminiKey() ? 'gemini' : null;
}
export const hasKey = () => provider() !== null;
export const callLlm = (role, contents) => (provider() === 'claude' ? callClaude : callGemini)(role, contents);

// Nạp file .env (KEY=VALUE) ở thư mục gốc dự án hoặc backend/. Không ghi đè biến môi trường đã có.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
for (const dir of [path.resolve(here, '../..'), path.resolve(here, '..')]) {
  try {
    for (const line of fs.readFileSync(path.join(dir, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* không có .env */ }
}

import fs from 'node:fs';
import path from 'node:path';

function loadSimpleEnv(filename) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

// iPhone 기본 파일 앱은 점(.)으로 시작하는 파일명을 만들기 어려우므로
// 표준 .env.local 외에 env.local도 허용합니다.
loadSimpleEnv('env.local');

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

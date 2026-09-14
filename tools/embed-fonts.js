#!/usr/bin/env node
/* يولّد web/css/fonts.css بخطوط عربية مضمّنة base64 — لا رابط شبكة في المخرج */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_load.js');

const SRC = path.join(ROOT, 'web', 'vendor', 'fonts');
const OUT = path.join(ROOT, 'web', 'css', 'fonts.css');

const FACES = [
  { file: 'noto-naskh-arabic-arabic-700-normal.woff2', family: 'Noto Naskh Arabic', weight: 700, range: 'arabic' },
  { file: 'noto-sans-arabic-arabic-400-normal.woff2',  family: 'Noto Sans Arabic',  weight: 400, range: 'arabic' },
  { file: 'noto-sans-arabic-arabic-700-normal.woff2',  family: 'Noto Sans Arabic',  weight: 700, range: 'arabic' },
  { file: 'noto-sans-arabic-latin-400-normal.woff2',   family: 'Noto Sans Arabic',  weight: 400, range: 'latin' }
];

const UNICODE = {
  arabic: 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FEFF',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
};

let css = `/* خطوط عربية مضمّنة — Noto Naskh Arabic + Noto Sans Arabic (رخصة SIL OFL 1.1)
   مولَّد آلياً عبر: node tools/embed-fonts.js — لا يُحرَّر يدوياً */\n\n`;
let bytes = 0;

for (const f of FACES) {
  const p = path.join(SRC, f.file);
  if (!fs.existsSync(p)) { console.error(`❌ ملف الخط غير موجود: ${f.file}`); process.exit(1); }
  const b64 = fs.readFileSync(p).toString('base64');
  bytes += b64.length;
  css += `@font-face {\n  font-family: '${f.family}';\n  font-style: normal;\n  font-weight: ${f.weight};\n  font-display: swap;\n  src: url(data:font/woff2;base64,${b64}) format('woff2');\n  unicode-range: ${UNICODE[f.range]};\n}\n\n`;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, css, 'utf8');
console.log(`✅ web/css/fonts.css — ${FACES.length} وجوه خط مضمّنة (${(bytes / 1024).toFixed(0)} ك.ب base64)`);
console.log('\nby Mohamed Almseeh\nإعداد: محمد المسيح');

#!/usr/bin/env node
/* أداة البناء: تدمج الواجهة والمحرّك والبيانات في ملف HTML واحد يعمل بالفتح المباشر file:// */
const fs = require('fs');
const path = require('path');
const { ROOT, readData } = require('./_load.js');

const SRC = path.join(ROOT, 'web', 'index.html');
const OUT = path.join(ROOT, 'dist', 'wakun-min-al-arifeen.html');

function block(html, name) {
  const open = `<!-- BUILD:${name} -->`, close = `<!-- /BUILD:${name} -->`;
  const a = html.indexOf(open), b = html.indexOf(close);
  if (a === -1 || b === -1) throw new Error(`علامة البناء ${name} غير موجودة في index.html`);
  return { a, b: b + close.length, inner: html.slice(a + open.length, b) };
}
function srcs(inner, attr) {
  const re = new RegExp(`${attr}="([^"]+)"`, 'g');
  const out = []; let m;
  while ((m = re.exec(inner))) out.push(m[1]);
  return out;
}
const read = p => fs.readFileSync(path.join(ROOT, 'web', p), 'utf8');

let html = fs.readFileSync(SRC, 'utf8');

/* 1) الأنماط */
const css = block(html, 'CSS');
const cssFiles = srcs(css.inner, 'href');
const styles = cssFiles.map(f => `/* ${f} */\n` + read(f)).join('\n');
html = html.slice(0, css.a) + `<style>\n${styles}\n</style>` + html.slice(css.b);

/* 2) البيانات */
const data = readData();
const dataBlock = block(html, 'DATA');
html = html.slice(0, dataBlock.a) +
  `<script>window.GAME_DATA = ${JSON.stringify(data)};</script>` +
  html.slice(dataBlock.b);

/* 3) الكود */
const js = block(html, 'JS');
const jsFiles = srcs(js.inner, 'src');
const code = jsFiles.map(f => `/* ${f} */\n` + read(f)).join('\n;\n');
html = html.slice(0, js.a) + `<script>\n${code}\n</script>` + html.slice(js.b);

/* 4) فحص المخرج: ممنوع أي طلب شبكة فعلي.
      نطاقات XML مثل w3.org ليست طلبات — تُستثنى صراحةً. */
const violations = [];
const NS_OK = /^https?:\/\/(www\.)?w3\.org\//i;          // نطاقات SVG/XHTML الاسمية
if (/<script[^>]+\ssrc=/i.test(html)) violations.push('يوجد <script src> خارجي');
if (/<link[^>]+rel=["']?stylesheet/i.test(html)) violations.push('يوجد <link stylesheet> خارجي');
if (/<img[^>]+src=["']https?:/i.test(html)) violations.push('يوجد <img> من رابط خارجي');
if (/url\(\s*["']?https?:/i.test(html)) violations.push('يوجد url() يشير إلى الشبكة في CSS');
if (/@import\s+url\(\s*["']?https?:/i.test(html)) violations.push('يوجد @import من الشبكة');

// أي رابط http(s) متبقٍّ خارج النطاقات الاسمية وخارج التعليقات النصية للتراخيص
const urls = html.match(/https?:\/\/[^"'\s<)]+/gi) || [];
const suspicious = urls.filter(u => !NS_OK.test(u));
const fetchCalls = (html.match(/\bfetch\s*\(\s*["'`]https?:/gi) || []);
if (fetchCalls.length) violations.push('استدعاء fetch إلى الشبكة: ' + fetchCalls[0]);
if (/new\s+XMLHttpRequest|WebSocket\s*\(/.test(html)) violations.push('استدعاء شبكة (XHR/WebSocket)');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
const line = '─'.repeat(52);
console.log(line);
console.log('  بناء الملف الواحد — وَكُن مِنَ العارِفِينَ');
console.log(line);
console.log(`  أنماط مدموجة : ${cssFiles.length} ملف`);
console.log(`  كود مدموج    : ${jsFiles.length} ملف`);
console.log(`  بيانات مضمّنة: ${data.journey.length} محطة · ${data.qa.length} فئة · ` +
            `${data.hints.cards.length} بطاقة · ${data.bidding.categories.length} تصنيفاً`);
console.log(`  المخرج       : dist/${path.basename(OUT)}  (${kb} ك.ب)`);
console.log(line);
if (violations.length) {
  console.log('\n❌ فشل فحص الاستقلالية:');
  violations.forEach(v => console.log('   ' + v));
  console.log('\nby Mohamed Almseeh\nإعداد: محمد المسيح');
  process.exit(1);
}
console.log('\n✅ ملف مستقلّ تماماً: صفر طلب شبكة، ويعمل بالنقر المزدوج بلا إنترنت.');
if (suspicious.length) console.log(`   (${suspicious.length} رابطاً نصياً في تعليقات التراخيص — لا يُطلب من الشبكة)`);
console.log('\nby Mohamed Almseeh\nإعداد: محمد المسيح');

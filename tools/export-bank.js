#!/usr/bin/env node
/* تصدير بنك الأسئلة إلى صيغة مقروءة يعتمد عليها الحَكَم الآلي (prompts/question-bank.md) */
const fs = require('fs');
const path = require('path');
const { ROOT, readData } = require('./_load.js');

const D = readData();
const OUT = path.join(ROOT, 'prompts', 'question-bank.md');
const DIFF = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const AB = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const L = [];
const src = s => `${s.book} — ${s.author}${s.ref ? ' (' + s.ref + ')' : ''}`;

function question(q) {
  L.push(`**[${q.id}] (${DIFF[q.difficulty]} · ${q.type === 'mcq' ? 'خيارات' : q.type === 'tf' ? 'صح/خطأ' : 'مفتوح'})** ${q.text}`);
  if (q.type === 'mcq') {
    L.push(q.options.map((o, i) => `${AB[i]}) ${o}${i === q.answer ? ' ✅' : ''}`).join('   '));
  } else if (q.type === 'tf') {
    L.push(`الإجابة: **${q.answer ? 'صحيح ✅' : 'خطأ ✅'}**`);
  } else {
    L.push(`الإجابة: **${q.answer}**` + (q.accept ? ` _(يُقبل: ${q.accept.join('، ')})_` : ''));
  }
  if (q.explanation) L.push(`> ${q.explanation}`);
  if (q.note) L.push(`> ⚠️ ${q.note}`);
  L.push(`> 📚 ${src(q.source)}`);
  L.push('');
}

L.push('# 📚 بنك أسئلة «وَكُن مِنَ العارِفِينَ» — النسخة 1');
L.push('');
L.push('> **ملف مولَّد آلياً** من `data/` عبر `node tools/export-bank.js` — لا يُحرَّر يدوياً.');
L.push('> يعتمد عليه الحَكَم الآلي: **يطرح من هذا البنك ولا يخترع أسئلة من عنده.**');
L.push('');

L.push('## 🕋 أولاً: رحلة السفر (7 محطات)');
L.push('');
D.journey.forEach(st => {
  const meta = D.config.stations.find(s => s.id === st.station);
  L.push(`### المحطة ${meta.order}: ${meta.name}`);
  L.push(`_${meta.theme}_`);
  L.push('');
  ['easy', 'medium', 'hard'].forEach(d => st.questions.filter(q => q.difficulty === d).forEach(question));
});

L.push('## ❓ ثانياً: اسأل وجاوب');
L.push('');
D.qa.forEach(cat => {
  L.push(`### ${cat.name}`);
  if (cat.note) L.push(`> ⚠️ ${cat.note}`);
  L.push('');
  ['easy', 'medium', 'hard'].forEach(d => cat.questions.filter(q => q.difficulty === d).forEach(question));
});

L.push('## 💡 ثالثاً: لَمِّح إليّ');
L.push('');
L.push('| المعرّف | الصعوبة | الكلمات الثلاث | الإجابة | التلميح الإضافي | المصدر |');
L.push('|---|---|---|---|---|---|');
D.hints.cards.forEach(c => {
  L.push(`| ${c.id} | ${DIFF[c.difficulty]} | ${c.keywords.join(' · ')} | **${c.answer}** | ${c.extra_hint || '—'} | ${src(c.source)} |`);
});
L.push('');
L.push('**صيغ مقبولة إضافية:** ' + D.hints.cards.filter(c => c.accept && c.accept.length)
  .map(c => `${c.id}: ${c.accept.join('، ')}`).join(' · '));
L.push('');

L.push('## 🎲 رابعاً: مَن يزيّد؟');
L.push('');
D.bidding.categories.forEach(c => {
  L.push(`### [${c.id}] ${c.title} — (${DIFF[c.difficulty]}) · العدد الكامل: **${c.items.length}**`);
  L.push(c.items.map((it, i) => `${i + 1}. ${typeof it === 'string' ? it : it.name}`).join('  ·  '));
  if (c.note) L.push(`> ⚠️ ${c.note}`);
  L.push(`> 📚 ${src(c.source)}`);
  L.push('');
});

const counts = {
  journey: D.journey.reduce((a, s) => a + s.questions.length, 0),
  qa: D.qa.reduce((a, c) => a + c.questions.length, 0),
  hints: D.hints.cards.length,
  bidding: D.bidding.categories.length
};
L.push('---');
L.push('');
L.push(`**إجمالي البنك:** ${counts.journey} سؤال رحلة · ${counts.qa} سؤال مباشر · ${counts.hints} بطاقة تلميح · ${counts.bidding} تصنيف مزايدة.`);
L.push('');
L.push('by Mohamed Almseeh');
L.push('إعداد: محمد المسيح');

fs.writeFileSync(OUT, L.join('\n'), 'utf8');
console.log(`✅ صُدِّر البنك إلى prompts/question-bank.md (${L.length} سطراً، ` +
            `${counts.journey + counts.qa + counts.hints + counts.bidding} عنصراً)`);
console.log('\nby Mohamed Almseeh\nإعداد: محمد المسيح');

#!/usr/bin/env node
/* تقرير إحصائي عن بنك الأسئلة: التوزيع والسعة والمصادر */
const { readData, loadEngine } = require('./_load.js');
const W = loadEngine(); const D = readData();
W.Bank.load(D);

const line = (c = '─') => c.repeat(58);
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - [...String(s)].length));
const DIFF = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

console.log(line('═'));
console.log('  تقرير بنك «وَكُن مِنَ العارِفِينَ»');
console.log(line('═'));

/* 1) التوزيع العام */
const s = W.Bank.stats();
console.log('\n■ التوزيع العام');
console.log(`  رحلة السفر : ${s.games.journey || 0}`);
console.log(`  اسأل وجاوب : ${s.games.qa || 0}`);
console.log(`  لَمِّح إليّ  : ${s.games.hints || 0}`);
console.log(`  مَن يزيّد؟  : ${s.games.bidding || 0} تصنيفاً`);
console.log(`  المجموع    : ${s.total}`);

/* 2) المحطات */
console.log('\n■ رحلة السفر — لكل محطة');
D.config.stations.forEach(st => {
  const qs = (D.journey.find(j => j.station === st.id) || { questions: [] }).questions;
  const by = { easy: 0, medium: 0, hard: 0 };
  qs.forEach(q => by[q.difficulty]++);
  console.log(`  ${pad(st.name, 20)} ${pad(qs.length, 4)} (سهل ${by.easy} · متوسط ${by.medium} · صعب ${by.hard})`);
});

/* 3) الفئات */
console.log('\n■ اسأل وجاوب — لكل فئة');
D.qa.forEach(c => {
  const by = { easy: 0, medium: 0, hard: 0 };
  c.questions.forEach(q => by[q.difficulty]++);
  console.log(`  ${pad(c.name, 20)} ${pad(c.questions.length, 4)} (سهل ${by.easy} · متوسط ${by.medium} · صعب ${by.hard})`);
});

/* 4) الأنواع والصعوبة */
console.log('\n■ حسب النوع والصعوبة');
const types = {};
W.Bank.all().forEach(q => { if (q.type) types[q.type] = (types[q.type] || 0) + 1; });
console.log('  الأنواع    : ' + Object.entries(types).map(([k, v]) =>
  `${k === 'mcq' ? 'خيارات' : k === 'tf' ? 'صح/خطأ' : k} ${v}`).join(' · '));
console.log('  الصعوبة    : ' + Object.entries(s.difficulty).map(([k, v]) => `${DIFF[k] || k} ${v}`).join(' · '));

/* 5) المصادر */
console.log('\n■ المصادر الأكثر استعمالاً');
const books = {};
W.Bank.all().forEach(q => { if (q.source) books[q.source.book] = (books[q.source.book] || 0) + 1; });
Object.entries(books).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, v]) => console.log(`  ${pad(k, 34)} ${v}`));
console.log(`  (${Object.keys(books).length} مصدراً مختلفاً)`);

/* 6) السعة: كم جلسة كاملة يحتمل البنك */
console.log('\n■ سعة البنك');
const perStationDiff = {};
D.journey.forEach(j => j.questions.forEach(q => {
  const k = j.station + ':' + q.difficulty;
  perStationDiff[k] = (perStationDiff[k] || 0) + 1;
}));
const minPer = Math.min(...Object.values(perStationDiff));
console.log(`  رحلة كاملة تستوعب حتى ${minPer} فرق دون تكرار في جلسة واحدة.`);
[2, 3, 4, 6].forEach(n => {
  console.log(`  بـ${n} فرق: ${Math.floor(minPer / n)} جلسة رحلة كاملة متتالية بلا تكرار` +
              ` (${n * 21} سؤالاً للجلسة)`);
});
const qaRounds = Math.floor((s.games.qa || 0) / 3);
console.log(`  اسأل وجاوب : ${qaRounds} جولة لكل فريق بلا تكرار (3 أسئلة/فريق في الجلسة)`);
console.log(`  لَمِّح إليّ  : ${Math.floor((s.games.hints || 0) / 8)} جلسة (8 جولات للجلسة)`);
console.log(`  مَن يزيّد؟  : ${Math.floor((s.games.bidding || 0) / 6)} جلسة (6 جولات للجلسة)`);

console.log('\n' + line());
console.log('by Mohamed Almseeh');
console.log('إعداد: محمد المسيح');

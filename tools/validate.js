#!/usr/bin/env node
/* التحقّق من بنك الأسئلة: صحة البنية · تفرّد المعرّفات · وجود المصادر · كشف التكرار */
const { readData, loadEngine } = require('./_load.js');

const errors = [];
const warnings = [];
const err = (id, msg) => errors.push(`[${id}] ${msg}`);
const warn = (id, msg) => warnings.push(`[${id}] ${msg}`);

const W = loadEngine();
const D = readData();
const N = W.Arabic.normalize;

const ids = new Map();
const texts = new Map();
const VALID_DIFF = ['easy', 'medium', 'hard'];
const VALID_TYPE = ['mcq', 'tf', 'open'];
const stationIds = D.config.stations.map(s => s.id);

function checkSource(item) {
  const s = item.source;
  if (!s || !s.book || !s.author) err(item.id, 'المصدر ناقص: يجب ذكر الكتاب والمؤلف');
}
function checkUnique(item, text) {
  if (ids.has(item.id)) err(item.id, `معرّف مكرر (موجود أيضاً في ${ids.get(item.id)})`);
  ids.set(item.id, item.id);
  if (text) {
    const k = N(text);
    if (texts.has(k)) err(item.id, `نص مكرر مع ${texts.get(k)}`);
    else texts.set(k, item.id);
  }
}
function checkQuestion(q, ctx) {
  if (!q.id) return err('?', `سؤال بلا معرّف في ${ctx}`);
  checkUnique(q, q.text);
  if (!q.text || q.text.length < 10) err(q.id, 'نص السؤال قصير أو مفقود');
  if (!VALID_DIFF.includes(q.difficulty)) err(q.id, `صعوبة غير صالحة: ${q.difficulty}`);
  if (!VALID_TYPE.includes(q.type)) err(q.id, `نوع غير صالح: ${q.type}`);
  if (q.type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length < 2) err(q.id, 'سؤال خيارات بلا خيارات كافية');
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)
      err(q.id, `فهرس الإجابة خارج نطاق الخيارات: ${q.answer}`);
    else if (new Set(q.options.map(N)).size !== q.options.length) err(q.id, 'خيارات متكررة');
  }
  if (q.type === 'tf' && typeof q.answer !== 'boolean') err(q.id, 'سؤال صح/خطأ يجب أن تكون إجابته منطقية');
  if (!q.explanation) warn(q.id, 'بلا شرح بعد الإجابة');
  checkSource(q);
}

/* رحلة السفر */
const perStation = {};
D.journey.forEach(st => {
  if (!stationIds.includes(st.station)) err(st.station, 'محطة غير معرّفة في config.json');
  perStation[st.station] = { easy: 0, medium: 0, hard: 0 };
  st.questions.forEach(q => {
    checkQuestion(q, st.station);
    if (q.station !== st.station) err(q.id, `المحطة في السؤال (${q.station}) لا تطابق الملف (${st.station})`);
    if (q.game !== 'journey') err(q.id, 'حقل game يجب أن يكون journey');
    if (perStation[st.station][q.difficulty] !== undefined) perStation[st.station][q.difficulty]++;
  });
});
stationIds.forEach(id => {
  if (!perStation[id]) return err(id, 'لا يوجد ملف أسئلة لهذه المحطة');
  VALID_DIFF.forEach(d => {
    if (perStation[id][d] < 3) warn(id, `عدد أسئلة (${d}) أقل من 3: ${perStation[id][d]}`);
  });
});

/* اسأل وجاوب */
D.qa.forEach(cat => cat.questions.forEach(q => {
  checkQuestion(q, cat.category);
  if (q.game !== 'qa') err(q.id, 'حقل game يجب أن يكون qa');
  if (q.category !== cat.category) err(q.id, 'الفئة لا تطابق الملف');
  if (cat.category === 'fiqh' && !q.note && !cat.note) warn(q.id, 'سؤال فقهي بلا تنبيه الرجوع للمرجع');
}));

/* لَمِّح إليّ */
D.hints.cards.forEach(c => {
  checkUnique(c, c.answer + '|' + c.keywords.join('|'));
  if (!Array.isArray(c.keywords) || c.keywords.length !== 3) err(c.id, 'يجب أن تكون الكلمات المفتاحية ثلاثاً بالضبط');
  if (!c.answer) err(c.id, 'بلا إجابة');
  if (!VALID_DIFF.includes(c.difficulty)) err(c.id, `صعوبة غير صالحة: ${c.difficulty}`);
  if (!c.extra_hint) warn(c.id, 'بلا تلميح إضافي');
  (c.keywords || []).forEach(k => {
    if (N(c.answer).includes(N(k)) && N(k).length > 3) warn(c.id, `الكلمة المفتاحية «${k}» تكشف الإجابة`);
  });
  checkSource(c);
});

/* مَن يزيّد؟ */
D.bidding.categories.forEach(c => {
  checkUnique(c, c.title);
  if (!c.title) err(c.id, 'بلا عنوان تصنيف');
  if (!Array.isArray(c.items) || c.items.length < 3) err(c.id, 'قائمة العناصر أقل من 3');
  else if (new Set(c.items.map(i => N(typeof i === 'string' ? i : i.name))).size !== c.items.length)
    err(c.id, 'عناصر مكررة داخل التصنيف');
  if (!VALID_DIFF.includes(c.difficulty)) err(c.id, `صعوبة غير صالحة: ${c.difficulty}`);
  checkSource(c);
});

/* التقرير */
const total = ids.size;
const line = '─'.repeat(52);
console.log(line);
console.log('  تقرير التحقّق من بنك «وَكُن مِنَ العارِفِينَ»');
console.log(line);
console.log(`  رحلة السفر : ${D.journey.reduce((a, s) => a + s.questions.length, 0)} سؤالاً في ${D.journey.length} محطات`);
console.log(`  اسأل وجاوب : ${D.qa.reduce((a, c) => a + c.questions.length, 0)} سؤالاً في ${D.qa.length} فئات`);
console.log(`  لَمِّح إليّ  : ${D.hints.cards.length} بطاقة`);
console.log(`  مَن يزيّد؟  : ${D.bidding.categories.length} تصنيفاً (${D.bidding.categories.reduce((a, c) => a + c.items.length, 0)} عنصراً)`);
console.log(`  المجموع    : ${total} عنصراً`);
console.log(line);
if (warnings.length) { console.log(`\n⚠️  تنبيهات (${warnings.length}):`); warnings.forEach(w => console.log('   ' + w)); }
if (errors.length) {
  console.log(`\n❌ أخطاء (${errors.length}):`);
  errors.forEach(e => console.log('   ' + e));
  console.log('\nby Mohamed Almseeh\nإعداد: محمد المسيح');
  process.exit(1);
}
console.log('\n✅ لا أخطاء: كل المعرّفات فريدة، وكل عنصر يحمل مصدره، ولا تكرار في النصوص.');
console.log('\nby Mohamed Almseeh\nإعداد: محمد المسيح');

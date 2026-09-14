#!/usr/bin/env node
/* اختبار المحرّك: تشغيل رحلة كاملة بفريقين والتحقّق من النقاط والكروت ومنع التكرار */
const { loadEngine, readData } = require('./_load.js');

const W = loadEngine();
const D = readData();
W.Bank.load(D);
W.Dedupe.reset();

const fails = [];
const ok = [];
function assert(cond, msg) { (cond ? ok : fails).push(msg); }

const SEED = 2026;
const rng = W.RNG.create(SEED);
W.State.init(D.config, ['فريق الغدير', 'فريق الكوثر'], 'journey', SEED);
const [A, B] = W.State.teams();

/* نمط إجابات ثابت للاختبار: الفريق الأول يصيب السهل والمتوسط، والثاني يصيب السهل والصعب */
const pattern = { 't1': { easy: true, medium: true, hard: false },
                  't2': { easy: true, medium: false, hard: true } };
const DIFFS = ['easy', 'medium', 'hard'];
const seen = new Set();
let expected = { t1: 0, t2: 0 };
let asked = 0;

console.log('═'.repeat(56));
console.log('  اختبار رحلة السفر الكاملة — فريقان × 7 محطات');
console.log('═'.repeat(56));

for (let st = 0; st < D.config.stations.length; st++) {
  const station = W.State.station();
  let stationLine = [];
  for (const team of W.State.teams()) {
    let perfect = true;
    for (const diff of DIFFS) {
      const q = W.Bank.pick({ game: 'journey', station: station.id, difficulty: diff }, rng);
      assert(q !== null, `توفّر سؤال (${diff}) في محطة ${station.name}`);
      if (!q) { perfect = false; continue; }
      assert(!seen.has(q.id), `عدم تكرار السؤال ${q.id}`);
      seen.add(q.id); W.Dedupe.markUsed(q.id); asked++;

      const correct = pattern[team.id][diff];
      if (correct) {
        const pts = W.Score.forQuestion(diff);
        W.State.award(team.id, pts, `${station.id}/${diff}`);
        expected[team.id] += pts;
      } else { perfect = false; }
      W.State.record(team.id, correct);
      W.State.markStationQuestion(team.id);
    }
    if (perfect) {
      const bonus = W.Score.stationBonus();
      W.State.award(team.id, bonus, `${station.id}/bonus`);
      expected[team.id] += bonus;
      stationLine.push(`${team.name}: مكافأة محطة +${bonus}`);
    }
  }
  assert(W.State.stationDone(), `اكتمال محطة ${station.name} للفريقين`);
  console.log(`  ${st + 1}. ${station.name.padEnd(18)} ` +
              `${A.name} ${A.score} | ${B.name} ${B.score}` +
              (stationLine.length ? '   ← ' + stationLine.join('، ') : ''));
  W.State.advanceStation();
}

console.log('─'.repeat(56));
assert(asked === 42, `عدد الأسئلة المطروحة 42 (الفعلي: ${asked})`);
assert(A.score === expected.t1, `نقاط ${A.name} = ${expected.t1} (الفعلي: ${A.score})`);
assert(B.score === expected.t2, `نقاط ${B.name} = ${expected.t2} (الفعلي: ${B.score})`);
assert(seen.size === 42, `42 سؤالاً مختلفاً بلا تكرار (الفعلي: ${seen.size})`);

/* اختبار كرت [خليها لغيري]: صح ⟵ للمنافس · خطأ ⟵ للمحوِّل */
const used = W.Cards.use(A, 'journey', 'pass');
assert(used.ok === true, 'استخدام كرت [خليها لغيري] أول مرة');
assert(W.Cards.use(A, 'journey', 'pass').ok === false, 'منع استخدام الكرت مرتين');
const r1 = W.Score.resolvePass(true, A.id, B.id);
assert(r1.teamId === B.id, 'المنافس أجاب صح ⟵ النقاط له');
const r2 = W.Score.resolvePass(false, A.id, B.id);
assert(r2.teamId === A.id, 'المنافس أجاب خطأ ⟵ النقاط للمحوِّل');

/* اختبار 50:50 */
const mcq = W.Bank.all().find(q => q.type === 'mcq' && q.options);
const half = W.Cards.fiftyFifty(mcq, rng);
assert(half.filter(x => x !== null).length === 2, 'حذف إجابتين يُبقي خيارين فقط');
assert(half[mcq.answer] !== null, 'حذف إجابتين لا يحذف الإجابة الصحيحة');

/* اختبار مَن يزيّد؟ */
const cat = D.bidding.categories.find(c => c.id === 'bd-01');
const inputs = ['التوحيد', 'العدل', 'النبوه', 'الامامه', 'المعاد'];
const matched = new Set(inputs.map(i => W.Arabic.matchItem(i, cat.items)).filter(i => i >= 0));
assert(matched.size === 5, `مطابقة 5 عناصر رغم اختلاف الإملاء (الفعلي: ${matched.size})`);
assert(W.Score.forBidding(5, 5) === 25, 'مزايدة 5 وتعداد 5 ⟵ 25 نقطة');
assert(W.Score.forBidding(5, 3) === 0, 'الفشل في التعداد ⟵ 0 (والنقاط للمنافس)');

/* اختبار التعادل */
const tieCheck = A.score === B.score;
assert(W.State.isTie() === tieCheck, 'كشف التعادل يطابق الحالة الفعلية');

/* اختبار التصدير والاستيراد */
const snapshot = W.State.exportJSON();
assert(W.State.importJSON(snapshot) === true, 'تصدير الجلسة واستيرادها');

/* سعة البنك */
const perStationDiff = {};
D.journey.forEach(s => s.questions.forEach(q => {
  const k = s.station + ':' + q.difficulty;
  perStationDiff[k] = (perStationDiff[k] || 0) + 1;
}));
const minPer = Math.min(...Object.values(perStationDiff));

console.log('\n  النتيجة النهائية:');
W.State.standings().forEach((t, i) => console.log(`    ${i + 1}. ${t.name}: ${t.score} نقطة  ` +
  `(صحيحة ${t.stats.correct} / خاطئة ${t.stats.wrong})`));
console.log(`\n  سعة البنك الحالية: رحلة كاملة تستوعب حتى ${minPer} فرق دون تكرار.`);
console.log('─'.repeat(56));
console.log(`  ✅ نجح ${ok.length} اختباراً` + (fails.length ? `  ❌ فشل ${fails.length}` : ''));
if (fails.length) { fails.forEach(f => console.log('    ❌ ' + f)); }
console.log('\nby Mohamed Almseeh\nإعداد: محمد المسيح');
W.Dedupe.reset();
process.exit(fails.length ? 1 : 0);

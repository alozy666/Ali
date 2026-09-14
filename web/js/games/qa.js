/* لعبة «اسأل وجاوب» — أسئلة مباشرة مفتوحة، وثلاثة كروت تفتحها تدريجياً */
window.WKM = window.WKM || {};
WKM.QA = (function () {
  var s = null, rng = null, cfg = null;

  /* opts.game: 'qa' (افتراضي) أو 'journey' لسحب سؤال محطة في النمط الشامل */
  function start(config, seed, teamId, category, opts) {
    cfg = config; rng = rng || WKM.RNG.create(seed || Date.now());
    opts = opts || {};
    var q = WKM.Bank.pick({ game: opts.game || 'qa', category: category }, rng);
    if (!q) q = WKM.Bank.pick({ game: 'qa' }, rng);
    if (!q) return { type: 'exhausted' };
    WKM.Dedupe.markUsed(q.id);
    s = { question: q, teamId: teamId || WKM.State.current().id,
          showOptions: false, removed: [], hintShown: false,
          extraTime: 0, revealed: false, from: opts.game || 'qa' };
    return { type: 'question', view: view() };
  }

  function view() {
    if (!s) return null;
    return {
      question: s.question, team: WKM.State.team(s.teamId), teamId: s.teamId,
      difficulty: s.question.difficulty, points: WKM.Score.forQuestion(s.question.difficulty),
      showOptions: s.showOptions, removed: s.removed.slice(),
      hintShown: s.hintShown, hint: s.hintShown ? buildHint() : null, from: s.from,
      extraTime: s.extraTime, revealed: s.revealed
    };
  }

  /* تلميح لا يكشف الإجابة: المصدر والموضوع */
  function buildHint() {
    var q = s.question;
    var tags = (q.tags || []).slice(0, 2).join(' · ');
    return 'المصدر: ' + q.source.book + ' — ' + q.source.author + (tags ? ' | الموضوع: ' + tags : '');
  }

  function useCard(card) {
    if (!s || s.revealed) return { ok: false, reason: 'انتهت الجولة' };
    var team = WKM.State.team(s.teamId);
    if (card === 'fifty' && !s.showOptions) return { ok: false, reason: 'استعمل [خيارات للسؤال] أولاً' };
    if (card === 'options' && s.showOptions) return { ok: false, reason: 'الخيارات معروضة' };
    if (card === 'fifty' && s.question.type !== 'mcq') return { ok: false, reason: 'لا ينفع في سؤال صح/خطأ' };
    var res = WKM.Cards.use(team, 'qa', card);
    if (!res.ok) return res;

    if (card === 'options') s.showOptions = true;
    else if (card === 'ask_help') { s.hintShown = true; s.extraTime = 30; }
    else if (card === 'fifty') {
      var wrong = [];
      s.question.options.forEach(function (_, i) { if (i !== s.question.answer) wrong.push(i); });
      s.removed = rng.shuffle(wrong).slice(0, Math.max(0, wrong.length - 1));
    }
    return { ok: true, card: card, label: res.label, view: view() };
  }

  function answer(value, timedOut) {
    if (!s || s.revealed) return null;
    var q = s.question, correct;
    if (timedOut) correct = false;
    else if (typeof value === 'boolean') correct = value;                 // حكم الحَكَم على سؤال مفتوح
    else if (q.type === 'tf') correct = (value === 0) === (q.answer === true);
    else correct = value === q.answer;

    s.revealed = true;
    var pts = correct ? WKM.Score.forQuestion(q.difficulty) : 0;
    if (correct) WKM.State.award(s.teamId, pts, 'qa:' + q.id);
    WKM.State.record(s.teamId, correct);
    return { correct: correct, points: pts, awardedTo: correct ? s.teamId : null,
             question: q, picked: typeof value === 'number' ? value : -1, timedOut: !!timedOut };
  }

  function reset() { s = null; }
  return { start: start, view: view, useCard: useCard, answer: answer, reset: reset,
           isDone: function () { return !s || s.revealed; } };
})();

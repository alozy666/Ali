/* لعبة «لَمِّح إليّ» — ثلاث كلمات مفتاحية، والأسرع في الاستنتاج الصحيح يحصد النقاط */
window.WKM = window.WKM || {};
WKM.Hints = (function () {
  var s = null, rng = null, cfg = null;

  function start(config, seed) {
    cfg = config; rng = rng || WKM.RNG.create(seed || Date.now());
    var card = WKM.Bank.pick({ game: 'hints' }, rng);
    if (!card) return { type: 'exhausted' };
    WKM.Dedupe.markUsed(card.id);
    s = { card: card, revealed: 1, extraUsed: false, buzzed: null,
          blocked: [], done: false, result: null };
    return { type: 'hint', view: view() };
  }

  function view() {
    if (!s) return null;
    return {
      id: s.card.id, keywords: s.card.keywords.slice(0, s.revealed),
      totalKeywords: s.card.keywords.length, revealed: s.revealed,
      extraUsed: s.extraUsed, extraHint: s.extraUsed ? s.card.extra_hint : null,
      hasExtra: !!s.card.extra_hint,
      buzzed: s.buzzed, blocked: s.blocked.slice(), done: s.done,
      points: WKM.Score.forHint(s.extraUsed), answer: s.done ? s.card.answer : null,
      source: s.card.source, difficulty: s.card.difficulty
    };
  }

  function revealNext() {
    if (!s || s.revealed >= s.card.keywords.length) return null;
    s.revealed += 1; return view();
  }
  function useExtraHint() {
    if (!s || s.extraUsed || !s.card.extra_hint) return null;
    s.extraUsed = true; return view();
  }
  function buzz(teamId) {
    if (!s || s.done || s.buzzed) return { ok: false };
    if (s.blocked.indexOf(teamId) !== -1) return { ok: false, reason: 'هذا الفريق جرّب بالفعل' };
    s.buzzed = teamId; return { ok: true, view: view() };
  }

  /* حكم الحَكَم على الإجابة المنطوقة */
  function judge(correct) {
    if (!s || !s.buzzed || s.done) return null;
    var team = s.buzzed;
    if (correct) {
      var pts = WKM.Score.forHint(s.extraUsed);
      WKM.State.award(team, pts, 'hint:' + s.card.id);
      WKM.State.record(team, true);
      s.done = true;
      s.result = { correct: true, points: pts, awardedTo: team, answer: s.card.answer, card: s.card };
      return s.result;
    }
    WKM.State.record(team, false);
    s.blocked.push(team);
    s.buzzed = null;
    var left = WKM.State.teams().filter(function (t) { return s.blocked.indexOf(t.id) === -1; });
    if (!left.length) return timeout();
    return { correct: false, continues: true, blockedTeam: team, view: view() };
  }

  function timeout() {
    if (!s || s.done) return s && s.result;
    s.done = true; s.buzzed = null;
    s.result = { correct: false, points: 0, awardedTo: null, answer: s.card.answer, card: s.card, timedOut: true };
    return s.result;
  }

  function reset() { s = null; }
  return { start: start, view: view, revealNext: revealNext, useExtraHint: useExtraHint,
           buzz: buzz, judge: judge, timeout: timeout, reset: reset,
           isDone: function () { return !s || s.done; } };
})();

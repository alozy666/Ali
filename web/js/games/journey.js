/* لعبة «رحلة السفر» — 7 محطات، 3 أسئلة لكل فريق في كل محطة، وثلاثة كروت */
window.WKM = window.WKM || {};
WKM.Journey = (function () {
  var DIFFS = ['easy', 'medium', 'hard'];
  var q = null;      // حالة الجولة الحالية
  var queue = [];    // ترتيب الأدوار داخل المحطة
  var rng = null;
  var cfg = null;

  /* يبني ترتيب المحطة: كل صعوبة بالتناوب بين الفرق حتى لا يمل أحد */
  function buildQueue() {
    queue = [];
    var teams = WKM.State.teams();
    DIFFS.forEach(function (d) {
      teams.forEach(function (t) { queue.push({ teamId: t.id, difficulty: d }); });
    });
  }

  function start(config, seed) {
    cfg = config;
    rng = WKM.RNG.create(seed || Date.now());
    buildQueue();
    q = null;
    return next();
  }

  /* هل يُطرح السؤال مفتوحاً بلا خيارات؟ الأسئلة الصعبة تُطرح مفتوحة ليصبح
     كرت [خيارات للسؤال] ذا معنى، والحَكَم يحكم على الإجابة المنطوقة. */
  function isOpenMode(item) {
    return cfg.rules.open_hard_questions !== false && item.difficulty === 'hard' && item.question.type === 'mcq';
  }

  function draw(difficulty, excludeId) {
    var st = WKM.State.station();
    var pick = WKM.Bank.pick({ game: 'journey', station: st.id, difficulty: difficulty }, rng);
    if (pick && excludeId && pick.id === excludeId) {
      pick = WKM.Bank.pick({ game: 'journey', station: st.id, difficulty: difficulty }, rng) || pick;
    }
    if (!pick) {   // نفدت الفئة: البنك ثابت ولا يُولّد — نأخذ من صعوبة مجاورة
      for (var i = 0; i < DIFFS.length && !pick; i++) {
        pick = WKM.Bank.pick({ game: 'journey', station: st.id, difficulty: DIFFS[i] }, rng);
      }
    }
    if (pick) WKM.Dedupe.markUsed(pick.id);
    return pick;
  }

  function next() {
    if (!queue.length) return { type: 'station-end' };
    var slot = queue.shift();
    var question = draw(slot.difficulty);
    if (!question) return { type: 'exhausted' };
    q = {
      teamId: slot.teamId, answeringTeamId: slot.teamId, difficulty: slot.difficulty,
      question: question, revealed: false, passedFrom: null,
      showOptions: true, removed: [], usedExtraTime: false
    };
    q.showOptions = !isOpenMode(q);
    return { type: 'question', round: view() };
  }

  function view() {
    if (!q) return null;
    var st = WKM.State.station();
    return {
      station: st, stationIndex: WKM.State.get().stationIndex,
      teamId: q.teamId, answeringTeamId: q.answeringTeamId,
      team: WKM.State.team(q.answeringTeamId),
      difficulty: q.difficulty, question: q.question,
      showOptions: q.showOptions, removed: q.removed.slice(),
      passedFrom: q.passedFrom, revealed: q.revealed,
      points: WKM.Score.forQuestion(q.difficulty),
      remainingInStation: queue.length
    };
  }

  /* تقييم الإجابة: بالفهرس (خيارات) أو بحكم الحَكَم (مفتوح) */
  function answer(value) {
    if (!q || q.revealed) return null;
    var correct;
    if (typeof value === 'boolean') correct = value;                      // حكم الحَكَم في السؤال المفتوح
    else if (q.question.type === 'tf') correct = (value === 0) === (q.question.answer === true);  // 0=صحيح · 1=خطأ
    else correct = value === q.question.answer;

    q.revealed = true;
    var pts = WKM.Score.forQuestion(q.difficulty);
    /* سبب الإحراز: «معرّف المحطة/الصعوبة/معرّف السؤال» ليُحسب تفصيل المحطات في النتائج */
    var reason = WKM.State.station().id + '/' + q.difficulty + '/' + q.question.id;
    var target;
    if (q.passedFrom) {
      // كرت [خليها لغيري]: صح ⟵ للمُحال إليه · خطأ ⟵ للمحوِّل
      target = WKM.Score.resolvePass(correct, q.passedFrom, q.answeringTeamId).teamId;
      WKM.State.award(target, pts, reason + '/pass');
    } else {
      target = correct ? q.answeringTeamId : null;
      if (target) WKM.State.award(target, pts, reason);
    }
    WKM.State.record(q.answeringTeamId, correct);
    WKM.State.markStationQuestion(q.teamId);
    if (correct) markStationStreak(q.teamId, true); else markStationStreak(q.teamId, false);

    return { correct: correct, points: target ? pts : 0, awardedTo: target,
             question: q.question, passedFrom: q.passedFrom };
  }

  /* تتبّع «كل أسئلة المحطة صحيحة» لمكافأة المحطة */
  var streak = {};
  function markStationStreak(teamId, ok) {
    var key = WKM.State.station().id + ':' + teamId;
    if (!(key in streak)) streak[key] = true;
    if (!ok) streak[key] = false;
  }
  function stationBonuses() {
    var st = WKM.State.station(), out = [];
    WKM.State.teams().forEach(function (t) {
      if (streak[st.id + ':' + t.id]) {
        var b = WKM.Score.stationBonus();
        WKM.State.award(t.id, b, st.id + ':bonus');
        out.push({ team: t, bonus: b });
      }
    });
    return out;
  }

  function useCard(card, targetTeamId) {
    if (!q || q.revealed) return { ok: false, reason: 'انتهت الجولة' };
    var team = WKM.State.team(q.answeringTeamId);
    var res = WKM.Cards.use(team, 'journey', card);
    if (!res.ok) return res;

    if (card === 'swap') {
      var fresh = draw(q.difficulty, q.question.id);
      if (!fresh) { team.cards.journey[card] += 1; return { ok: false, reason: 'لا يوجد سؤال بديل بنفس الصعوبة' }; }
      q.question = fresh; q.removed = []; q.showOptions = !isOpenMode(q);
    } else if (card === 'options') {
      q.showOptions = true;
    } else if (card === 'pass') {
      var teams = WKM.State.teams();
      var to = targetTeamId ? WKM.State.team(targetTeamId) : WKM.State.opponentOf(q.answeringTeamId);
      if (!to || to.id === q.answeringTeamId) { team.cards.journey[card] += 1; return { ok: false, reason: 'اختر فريقاً آخر' }; }
      q.passedFrom = q.answeringTeamId;
      q.answeringTeamId = to.id;
      q.showOptions = true;   // المنافس يرى الخيارات ليتمكّن من الإجابة
    }
    return { ok: true, card: card, label: res.label, round: view() };
  }

  function advanceStation() {
    var bonuses = stationBonuses();
    var nextSt = WKM.State.advanceStation();
    if (!nextSt) return { type: 'end', bonuses: bonuses };
    buildQueue();
    return { type: 'station', station: nextSt, bonuses: bonuses };
  }

  function reset() { q = null; queue = []; streak = {}; }

  return { start: start, next: next, view: view, answer: answer, useCard: useCard,
           advanceStation: advanceStation, reset: reset,
           isOpen: function () { return q ? !q.showOptions : false; },
           removeTwo: function () {
             if (!q || q.question.type !== 'mcq' || !q.showOptions) return null;
             var wrong = [];
             q.question.options.forEach(function (_, i) { if (i !== q.question.answer) wrong.push(i); });
             wrong = rng.shuffle(wrong).slice(0, Math.max(0, wrong.length - 1));
             q.removed = wrong; return q.removed;
           } };
})();

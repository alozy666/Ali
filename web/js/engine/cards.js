/* كروت المساعدة — 3 كروت لكل فريق في كل لعبة، كل كرت مرة واحدة */
window.WKM = window.WKM || {};
WKM.Cards = (function () {
  var LABELS = {
    pass: 'خليها لغيري', swap: 'تغيير السؤال', options: 'خيارات للسؤال',
    ask_help: 'اسأل الجمهور أو صديق', fifty: 'حذف إجابتين'
  };
  var cfg = null;
  function init(config) { cfg = config.cards; return cfg; }

  function freshSet() {
    var out = {};
    Object.keys(cfg).forEach(function (game) {
      if (!Array.isArray(cfg[game])) return;
      out[game] = {};
      cfg[game].forEach(function (c) { out[game][c] = cfg.uses_per_card; });
    });
    return out;
  }

  function has(team, game, card) {
    return !!(team.cards && team.cards[game] && team.cards[game][card] > 0);
  }
  function use(team, game, card) {
    if (!has(team, game, card)) return { ok: false, reason: 'الكرت غير متاح أو استُهلك' };
    team.cards[game][card] -= 1;
    return { ok: true, card: card, label: LABELS[card] };
  }
  function remaining(team, game) {
    var out = [];
    var set = (team.cards && team.cards[game]) || {};
    Object.keys(set).forEach(function (c) { if (set[c] > 0) out.push({ id: c, label: LABELS[c] }); });
    return out;
  }
  /* خاصية 50:50 — تُبقي الإجابة الصحيحة وخياراً خاطئاً واحداً */
  function fiftyFifty(question, rng) {
    if (question.type !== 'mcq' || !question.options) return null;
    var wrong = [];
    question.options.forEach(function (_, i) { if (i !== question.answer) wrong.push(i); });
    var keep = (rng || WKM.RNG.create(1)).pick(wrong);
    return question.options.map(function (opt, i) {
      return (i === question.answer || i === keep) ? opt : null;
    });
  }
  /* تحويل سؤال مفتوح أو صح/خطأ إلى خيارات */
  function toOptions(question) {
    if (question.type === 'tf') return ['صحيح', 'خطأ'];
    return question.options || null;
  }

  return { init: init, freshSet: freshSet, has: has, use: use, remaining: remaining,
           fiftyFifty: fiftyFifty, toOptions: toOptions, LABELS: LABELS };
})();

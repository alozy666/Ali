/* احتساب النقاط — كل القيم تُقرأ من data/config.json ولا تُكتب هنا */
window.WKM = window.WKM || {};
WKM.Score = (function () {
  var cfg = null;
  function init(config) { cfg = config.points; return cfg; }
  function P() { if (!cfg) throw new Error('WKM.Score: لم تُهيَّأ الإعدادات'); return cfg; }

  return {
    init: init,
    /* سؤال حسب الصعوبة (رحلة السفر · اسأل وجاوب) */
    forQuestion: function (difficulty) { return P().difficulty[difficulty] || 0; },
    /* مَن يزيّد؟ — نجاح كامل بالمزايدة، مع مكافأة لكل عنصر فوق العدد الملتزم به */
    forBidding: function (bid, correctCount) {
      var p = P().bidding;
      if (correctCount < bid) return 0;
      return p.base + Math.max(0, correctCount - bid) * p.per_extra_item;
    },
    /* لَمِّح إليّ — تنقص النقاط عند كشف التلميح الإضافي */
    forHint: function (usedExtraHint) {
      var p = P().hint;
      return usedExtraHint ? Math.max(0, p.base - p.extra_hint_penalty) : p.base;
    },
    stationBonus: function () { return P().station_bonus; },
    /* كرت [خليها لغيري]: صح ⟵ للمنافس · خطأ ⟵ للمحوِّل */
    resolvePass: function (correct, fromTeamId, toTeamId) {
      return { teamId: correct ? toTeamId : fromTeamId, correct: correct };
    }
  };
})();

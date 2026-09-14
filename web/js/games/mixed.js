/* النمط الشامل — جولات متنوعة عشوائياً بين الألعاب الأربع مع توازن الأدوار */
window.WKM = window.WKM || {};
WKM.Mixed = (function () {
  var plan = [], idx = -1, rng = null;

  /* يبني خطة جولات متوازنة: لا تتكرر اللعبة نفسها ثلاث مرات متتالية */
  function build(config, seed) {
    rng = WKM.RNG.create(seed || Date.now());
    var games = ['journey', 'bidding', 'hints', 'qa'];
    var n = config.rounds.mixed, out = [];
    while (out.length < n) {
      var g = rng.pick(games);
      var len = out.length;
      if (len >= 2 && out[len - 1] === g && out[len - 2] === g) continue;
      out.push(g);
    }
    plan = out; idx = -1;
    return plan.slice();
  }

  function next() {
    idx += 1;
    if (idx >= plan.length) return null;
    return { game: plan[idx], round: idx + 1, total: plan.length };
  }
  function current() { return idx >= 0 && idx < plan.length ? { game: plan[idx], round: idx + 1, total: plan.length } : null; }
  function reset() { plan = []; idx = -1; }

  return { build: build, next: next, current: current, reset: reset,
           progress: function () { return { round: idx + 1, total: plan.length }; } };
})();

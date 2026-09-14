/* لعبة «مَن يزيّد؟» — مزاد على عدد ما يستطيع الفريق سرده، ثم تعداد في 30 ثانية */
window.WKM = window.WKM || {};
WKM.Bidding = (function () {
  var s = null, rng = null, cfg = null;

  function start(config, seed) {
    cfg = config; rng = rng || WKM.RNG.create(seed || Date.now());
    var cat = WKM.Bank.pick({ game: 'bidding' }, rng);
    if (!cat) return { type: 'exhausted' };
    WKM.Dedupe.markUsed(cat.id);
    s = {
      category: cat, phase: 'bid', bids: {}, winner: null, bid: 0,
      matched: [], entries: [], done: false
    };
    WKM.State.teams().forEach(function (t) { s.bids[t.id] = 0; });
    return { type: 'bid', view: view() };
  }

  function view() {
    if (!s) return null;
    return {
      phase: s.phase, category: { id: s.category.id, title: s.category.title,
        difficulty: s.category.difficulty, max: s.category.items.length, source: s.category.source,
        note: s.category.note },
      bids: s.bids, winner: s.winner, bid: s.bid,
      matched: s.matched.map(function (i) { return itemName(i); }),
      entries: s.entries.slice(), count: s.matched.length,
      remaining: s.bid - s.matched.length
    };
  }
  function itemName(i) {
    var it = s.category.items[i];
    return typeof it === 'string' ? it : it.name;
  }

  function setBid(teamId, n) {
    if (!s || s.phase !== 'bid') return null;
    var max = s.category.items.length;
    s.bids[teamId] = Math.max(0, Math.min(max, n | 0));
    return s.bids[teamId];
  }

  /* أعلى مزايدة تلتزم بالتعداد؛ عند التساوي الأسبق في ترتيب الفرق */
  function lockBids() {
    if (!s || s.phase !== 'bid') return { ok: false };
    var best = null;
    WKM.State.teams().forEach(function (t) {
      if (!best || s.bids[t.id] > s.bids[best.id]) best = t;
    });
    if (!best || s.bids[best.id] < 1) return { ok: false, reason: 'لا بدّ من مزايدة فريق واحد على الأقل' };
    s.winner = best.id; s.bid = s.bids[best.id]; s.phase = 'count';
    return { ok: true, view: view() };
  }

  /* يتحقّق من عنصر مُدخل ويقبله إن كان صحيحاً وغير مكرر */
  function submit(text) {
    if (!s || s.phase !== 'count') return { ok: false };
    var t = (text || '').trim();
    if (!t) return { ok: false, reason: 'empty' };
    var i = WKM.Arabic.matchItem(t, s.category.items);
    if (i === -1) { s.entries.push({ text: t, ok: false }); return { ok: false, reason: 'wrong', text: t, view: view() }; }
    if (s.matched.indexOf(i) !== -1) { s.entries.push({ text: t, ok: false, dup: true });
      return { ok: false, reason: 'dup', text: t, view: view() }; }
    s.matched.push(i);
    s.entries.push({ text: itemName(i), ok: true });
    var full = s.matched.length >= s.bid;
    return { ok: true, name: itemName(i), count: s.matched.length, full: full, view: view() };
  }

  /* انتهاء الجولة: نجح ⟵ نقاطه · فشل ⟵ النقاط للمنافس تلقائياً */
  function finish() {
    if (!s || s.done) return null;
    s.done = true; s.phase = 'done';
    var success = s.matched.length >= s.bid && s.bid > 0;
    var pts, target;
    if (success) {
      pts = WKM.Score.forBidding(s.bid, s.matched.length);
      target = s.winner;
    } else {
      pts = cfg.points.bidding.base;
      var opp = WKM.State.opponentOf(s.winner);
      target = opp ? opp.id : null;
    }
    if (target) WKM.State.award(target, pts, 'bidding:' + s.category.id);
    WKM.State.record(s.winner, success);
    return {
      success: success, points: pts, awardedTo: target, bid: s.bid,
      matchedCount: s.matched.length,
      matchedNames: s.matched.map(itemName),
      missed: s.category.items.map(function (_, i) { return i; })
        .filter(function (i) { return s.matched.indexOf(i) === -1; }).map(itemName),
      category: s.category
    };
  }

  function reset() { s = null; }
  return { start: start, view: view, setBid: setBid, lockBids: lockBids,
           submit: submit, finish: finish, reset: reset,
           isDone: function () { return !s || s.done; } };
})();

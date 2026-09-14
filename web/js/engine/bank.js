/* بنك الأسئلة: الفهرسة والاختيار — بنك ثابت بالكامل، بلا توليد لحظي */
window.WKM = window.WKM || {};
WKM.Bank = (function () {
  var all = [];         // كل الأسئلة والبطاقات والتصنيفات
  var byGame = {};

  function add(item) { all.push(item); (byGame[item.game] = byGame[item.game] || []).push(item); }

  function load(data) {
    all = []; byGame = {};
    (data.journey || []).forEach(function (st) {
      (st.questions || []).forEach(function (q) { add(q); });
    });
    (data.qa || []).forEach(function (cat) {
      (cat.questions || []).forEach(function (q) { add(q); });
    });
    ((data.hints && data.hints.cards) || []).forEach(function (c) {
      c.game = 'hints'; add(c);
    });
    ((data.bidding && data.bidding.categories) || []).forEach(function (c) {
      c.game = 'bidding'; add(c);
    });
    return all.length;
  }

  function filter(opts) {
    opts = opts || {};
    var used = opts.exclude || WKM.Dedupe;
    return (byGame[opts.game] || []).filter(function (q) {
      if (opts.station && q.station !== opts.station) return false;
      if (opts.difficulty && q.difficulty !== opts.difficulty) return false;
      if (opts.category && q.category !== opts.category) return false;
      if (opts.type && q.type !== opts.type) return false;
      if (opts.skipUsed !== false && used.isUsed(q.id)) return false;
      return true;
    });
  }

  /* يختار سؤالاً غير مستهلك؛ فإن نفدت الفئة أعاد null (البنك ثابت ولا يُولّد) */
  function pick(opts, rng) {
    var pool = filter(opts);
    if (!pool.length) return null;
    var r = rng || WKM.RNG.create(Date.now());
    return r.pick(pool);
  }

  function byId(id) {
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function stats() {
    var s = { total: all.length, games: {}, difficulty: {}, stations: {}, categories: {} };
    all.forEach(function (q) {
      s.games[q.game] = (s.games[q.game] || 0) + 1;
      if (q.difficulty) s.difficulty[q.difficulty] = (s.difficulty[q.difficulty] || 0) + 1;
      if (q.station) s.stations[q.station] = (s.stations[q.station] || 0) + 1;
      if (q.category) s.categories[q.category] = (s.categories[q.category] || 0) + 1;
    });
    s.remaining = all.filter(function (q) { return !WKM.Dedupe.isUsed(q.id); }).length;
    return s;
  }

  return { load: load, filter: filter, pick: pick, byId: byId, stats: stats,
           all: function () { return all; } };
})();

/* حالة الجلسة: الفرق والنقاط والأدوار والتقدّم — قابلة للتصدير والاستيراد */
window.WKM = window.WKM || {};
WKM.State = (function () {
  var s = null;
  var config = null;

  function init(cfg, teamNames, mode, seed) {
    config = cfg;
    WKM.Score.init(cfg);
    WKM.Cards.init(cfg);
    s = {
      mode: mode || 'journey',
      seed: seed || (Date.now() >>> 0),
      teams: (teamNames || []).map(function (name, i) {
        return { id: 't' + (i + 1), name: name, score: 0,
                 cards: WKM.Cards.freshSet(), stats: { correct: 0, wrong: 0, asked: 0 } };
      }),
      turn: 0,
      stationIndex: 0,
      stationProgress: {},
      log: [],
      startedAt: new Date().toISOString(),
      finished: false
    };
    if (s.teams.length < (cfg.rules.min_teams || 2)) {
      throw new Error('يجب تسجيل فريقين على الأقل');
    }
    return s;
  }

  function get() { return s; }
  function teams() { return s.teams; }
  function team(id) { return s.teams.filter(function (t) { return t.id === id; })[0] || null; }
  function current() { return s.teams[s.turn % s.teams.length]; }
  function nextTurn() { s.turn += 1; return current(); }
  function opponentOf(id) {
    var i = s.teams.findIndex(function (t) { return t.id === id; });
    return s.teams[(i + 1) % s.teams.length];
  }

  function award(teamId, points, reason) {
    var t = team(teamId);
    if (!t) return null;
    t.score += points;
    s.log.push({ at: Date.now(), teamId: teamId, points: points, reason: reason || '' });
    return t.score;
  }
  function record(teamId, correct) {
    var t = team(teamId); if (!t) return;
    t.stats.asked += 1;
    if (correct) t.stats.correct += 1; else t.stats.wrong += 1;
  }

  function standings() {
    return s.teams.slice().sort(function (a, b) { return b.score - a.score; });
  }
  function isTie() {
    var st = standings();
    return st.length > 1 && st[0].score === st[1].score;
  }
  function station() { return config.stations[s.stationIndex] || null; }
  function advanceStation() {
    s.stationIndex += 1;
    if (s.stationIndex >= config.stations.length) { s.finished = true; s.stationIndex = config.stations.length - 1; return null; }
    return station();
  }
  function markStationQuestion(teamId) {
    var key = station().id + ':' + teamId;
    s.stationProgress[key] = (s.stationProgress[key] || 0) + 1;
    return s.stationProgress[key];
  }
  function stationDone() {
    var per = config.rules.questions_per_station_per_team;
    var st = station();
    return s.teams.every(function (t) { return (s.stationProgress[st.id + ':' + t.id] || 0) >= per; });
  }

  function exportJSON() { return JSON.stringify({ state: s, used: WKM.Dedupe.exportJSON() }); }
  function importJSON(json) {
    try {
      var o = JSON.parse(json);
      s = o.state; if (o.used) WKM.Dedupe.importJSON(o.used);
      return true;
    } catch (e) { return false; }
  }

  return { init: init, get: get, teams: teams, team: team, current: current, nextTurn: nextTurn,
           opponentOf: opponentOf, award: award, record: record, standings: standings, isTie: isTie,
           station: station, advanceStation: advanceStation, markStationQuestion: markStationQuestion,
           stationDone: stationDone, exportJSON: exportJSON, importJSON: importJSON };
})();

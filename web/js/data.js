/* محمّل البيانات: في الملف المدموج تكون البيانات مضمّنة، وفي التطوير تُجلب عبر خادم محلي */
window.WKM = window.WKM || {};
WKM.Data = (function () {
  var FILES = {
    config: ['data/config.json'],
    journey: ['data/journey/mecca.json', 'data/journey/medina.json', 'data/journey/najaf.json',
              'data/journey/karbala.json', 'data/journey/kadhimiya.json', 'data/journey/mashhad.json',
              'data/journey/samarra.json'],
    qa: ['data/qa/aqaid.json', 'data/qa/fiqh.json', 'data/qa/quran.json',
         'data/qa/history.json', 'data/qa/books.json'],
    hints: ['data/hints/hints.json'],
    bidding: ['data/bidding/bidding.json']
  };

  function load() {
    if (window.GAME_DATA) return Promise.resolve(window.GAME_DATA);   // الملف المدموج
    var keys = Object.keys(FILES);
    return Promise.all(keys.map(function (k) {
      return Promise.all(FILES[k].map(function (f) {
        return fetch('../' + f).then(function (r) { return r.json(); });
      }));
    })).then(function (res) {
      var out = {};
      keys.forEach(function (k, i) {
        out[k] = (k === 'config' || k === 'hints' || k === 'bidding') ? res[i][0] : res[i];
      });
      window.GAME_DATA = out;
      return out;
    });
  }
  return { load: load, isEmbedded: function () { return !!window.GAME_DATA; } };
})();

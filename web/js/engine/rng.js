/* عشوائية قابلة للبذر — تُمكّن الحَكَم من إعادة إنتاج الجلسة نفسها */
window.WKM = window.WKM || {};
WKM.RNG = (function () {
  function create(seed) {
    var s = seed >>> 0 || (Date.now() >>> 0);
    function next() {                       // mulberry32
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      int: function (n) { return Math.floor(next() * n); },
      pick: function (arr) { return arr.length ? arr[Math.floor(next() * arr.length)] : null; },
      shuffle: function (arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      seed: s
    };
  }
  return { create: create };
})();

/* سجلّ الأسئلة المستهلكة — يمنع التكرار عبر الجولات والجلسات */
window.WKM = window.WKM || {};
WKM.Dedupe = (function () {
  var KEY = 'wkm.used.v1';
  var memory = {};            // بديل آمن إن كان التخزين معطّلاً (file:// أحياناً)
  var storageOK = true;

  function read() {
    if (!storageOK) return memory;
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { storageOK = false; return memory; }
  }
  function write(obj) {
    memory = obj;
    if (!storageOK) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(obj)); }
    catch (e) { storageOK = false; }
  }

  return {
    isUsed: function (id) { return !!read()[id]; },
    markUsed: function (id) { var o = read(); o[id] = 1; write(o); },
    usedIds: function () { return Object.keys(read()); },
    count: function () { return Object.keys(read()).length; },
    reset: function () { write({}); },
    exportJSON: function () { return JSON.stringify(read()); },
    importJSON: function (json) {
      try { write(JSON.parse(json) || {}); return true; } catch (e) { return false; }
    },
    storageAvailable: function () { return storageOK; }
  };
})();

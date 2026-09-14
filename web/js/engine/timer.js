/* المؤقّت التنازلي — دقيق بالاعتماد على الساعة لا على عدّ النبضات */
window.WKM = window.WKM || {};
WKM.Timer = (function () {
  function create(opts) {
    opts = opts || {};
    var total = 0, endAt = 0, remaining = 0, handle = null, running = false, warned = false;
    var warnAt = opts.warnAt || 5;

    function tick() {
      remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      if (opts.onTick) opts.onTick(remaining, total);
      if (!warned && remaining <= warnAt && remaining > 0) { warned = true; if (opts.onWarn) opts.onWarn(remaining); }
      if (remaining <= 0) { stop(); if (opts.onEnd) opts.onEnd(); }
    }
    function start(seconds) {
      stop();
      total = seconds; remaining = seconds; warned = false;
      endAt = Date.now() + seconds * 1000; running = true;
      if (opts.onTick) opts.onTick(remaining, total);
      handle = setInterval(tick, 250);
    }
    function pause() {
      if (!running) return;
      remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      clearInterval(handle); handle = null; running = false;
    }
    function resume() {
      if (running || remaining <= 0) return;
      endAt = Date.now() + remaining * 1000; running = true;
      handle = setInterval(tick, 250);
    }
    function stop() { if (handle) clearInterval(handle); handle = null; running = false; }

    return { start: start, pause: pause, resume: resume, stop: stop,
             remaining: function () { return remaining; },
             isRunning: function () { return running; } };
  }
  return { create: create };
})();

/* مؤثرات صوتية مولَّدة برمجياً عبر Web Audio — بلا ملفات صوتية ولا زيادة في حجم الملف */
window.WKM = window.WKM || {};
WKM.Sound = (function () {
  var ctx = null, muted = false, ready = false;

  try { muted = window.localStorage.getItem('wkm.muted') === '1'; } catch (e) {}

  function ensure() {
    if (ctx || muted) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      ready = true;
    } catch (e) { ctx = null; }
    return ctx;
  }

  /* نغمة واحدة: تردد، مدة، شكل الموجة، وقت البدء، وشدّة */
  function tone(freq, dur, type, at, gain) {
    var c = ensure();
    if (!c || muted) return;
    var t0 = c.currentTime + (at || 0);
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function resume() { var c = ensure(); if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} } }

  return {
    unlock: resume,
    tick:    function () { tone(880, 0.06, 'sine', 0, 0.07); },
    warn:    function () { tone(660, 0.12, 'square', 0, 0.12); tone(660, 0.12, 'square', 0.18, 0.12); },
    correct: function () { tone(659.25, 0.13, 'sine', 0); tone(783.99, 0.13, 'sine', 0.11); tone(1046.5, 0.24, 'sine', 0.22); },
    wrong:   function () { tone(196, 0.20, 'sawtooth', 0, 0.12); tone(146.83, 0.28, 'sawtooth', 0.14, 0.11); },
    card:    function () { tone(523.25, 0.08, 'triangle', 0, 0.12); tone(698.46, 0.10, 'triangle', 0.07, 0.12); },
    station: function () { tone(523.25, 0.14, 'sine', 0); tone(659.25, 0.14, 'sine', 0.12); tone(783.99, 0.22, 'sine', 0.24); },
    win:     function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.22, 'sine', i * 0.14, 0.2); });
      tone(1318.5, 0.5, 'sine', 0.62, 0.16);
    },
    isMuted: function () { return muted; },
    toggle:  function () {
      muted = !muted;
      try { window.localStorage.setItem('wkm.muted', muted ? '1' : '0'); } catch (e) {}
      if (!muted) { ensure(); resume(); tone(880, 0.09, 'sine', 0, 0.12); }
      return muted;
    }
  };
})();

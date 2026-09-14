/* طبقة المؤثرات الحركية — anime.js مضمَّن محلياً + canvas للاحتفال
   كل شيء يحترم prefers-reduced-motion ويتحوّل إلى فوري عند طلبه */
window.WKM = window.WKM || {};
WKM.FX = (function () {
  var A = window.anime;
  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function has() { return !!A && !reduced(); }

  /* دخول عناصر بتتابع لطيف */
  function enter(selector, opts) {
    opts = opts || {};
    var els = typeof selector === 'string'
      ? Array.prototype.slice.call(document.querySelectorAll(selector)) : [selector];
    if (!els.length) return;
    if (!has()) { els.forEach(function (e) { e.style.opacity = ''; e.style.transform = ''; }); return; }
    A.remove(els);
    A({
      targets: els,
      opacity: [0, 1],
      translateY: [opts.from === 'down' ? -18 : 18, 0],
      scale: opts.scale ? [0.94, 1] : [1, 1],
      delay: A.stagger(opts.stagger || 55, { start: opts.delay || 0 }),
      duration: opts.duration || 460,
      easing: 'cubicBezier(.22,.68,.36,1)'
    });
  }

  /* عدّاد رقمي متحرّك */
  function countUp(el, from, to, dur) {
    if (!el) return;
    if (!has()) { el.textContent = to; return; }
    var o = { v: from };
    A({
      targets: o, v: to, duration: dur || 900, easing: 'easeOutExpo',
      update: function () { el.textContent = Math.round(o.v); }
    });
  }

  function shake(el) {
    if (!el || !has()) return;
    A.remove(el);
    A({ targets: el, translateX: [0, -9, 8, -6, 4, 0], duration: 460, easing: 'easeOutQuad' });
  }

  function pop(el, scale) {
    if (!el || !has()) return;
    A.remove(el);
    A({ targets: el, scale: [1, scale || 1.08, 1], duration: 460, easing: 'easeOutBack' });
  }

  function glow(el) {
    if (!el || !has()) return;
    el.classList.add('fx-glow');
    setTimeout(function () { el.classList.remove('fx-glow'); }, 1100);
  }

  /* تموّج عند الضغط (ripple) */
  function ripple(btn, ev) {
    if (!btn || reduced()) return;
    var r = btn.getBoundingClientRect();
    var s = Math.max(r.width, r.height) * 1.6;
    var d = document.createElement('span');
    d.className = 'fx-ripple';
    d.style.width = d.style.height = s + 'px';
    d.style.left = ((ev && ev.clientX !== undefined ? ev.clientX - r.left : r.width / 2) - s / 2) + 'px';
    d.style.top = ((ev && ev.clientY !== undefined ? ev.clientY - r.top : r.height / 2) - s / 2) + 'px';
    btn.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 620);
  }

  /* احتفال: جسيمات ذهبية وزمردية تتساقط */
  var confCanvas = null, confRAF = null;
  function confetti(opts) {
    opts = opts || {};
    if (reduced()) return;
    stopConfetti();
    var c = document.createElement('canvas');
    c.className = 'fx-confetti';
    c.width = window.innerWidth; c.height = window.innerHeight;
    document.body.appendChild(c);
    confCanvas = c;
    var x = c.getContext('2d');
    var colors = ['#D4AF37', '#E8C96A', '#F0D98A', '#2FA37A', '#F5EFE0'];
    var n = opts.count || 130, parts = [];
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * c.width,
        y: -20 - Math.random() * c.height * 0.5,
        w: 5 + Math.random() * 7, h: 8 + Math.random() * 10,
        vy: 1.8 + Math.random() * 3.4, vx: (Math.random() - 0.5) * 1.6,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.18,
        col: colors[(Math.random() * colors.length) | 0], a: 1
      });
    }
    var t0 = performance.now(), life = opts.duration || 2600;
    function frame(now) {
      var el = now - t0;
      x.clearRect(0, 0, c.width, c.height);
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        p.vy += 0.028;
        if (el > life * 0.62) p.a = Math.max(0, 1 - (el - life * 0.62) / (life * 0.38));
        x.save(); x.translate(p.x, p.y); x.rotate(p.rot);
        x.globalAlpha = p.a; x.fillStyle = p.col;
        x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        x.restore();
      });
      if (el < life) confRAF = requestAnimationFrame(frame); else stopConfetti();
    }
    confRAF = requestAnimationFrame(frame);
  }
  function stopConfetti() {
    if (confRAF) cancelAnimationFrame(confRAF);
    confRAF = null;
    if (confCanvas && confCanvas.parentNode) confCanvas.parentNode.removeChild(confCanvas);
    confCanvas = null;
  }

  /* نقاط تطير من الزرّ إلى لوحة النقاط */
  function floatPoints(text, anchor) {
    if (!anchor || reduced()) return;
    var r = anchor.getBoundingClientRect();
    var d = document.createElement('div');
    d.className = 'fx-float';
    d.textContent = text;
    d.style.left = (r.left + r.width / 2) + 'px';
    d.style.top = (r.top + 6) + 'px';
    document.body.appendChild(d);
    if (has()) {
      A({ targets: d, translateY: -70, opacity: [1, 0], scale: [0.85, 1.25], duration: 1100, easing: 'easeOutQuad',
          complete: function () { if (d.parentNode) d.parentNode.removeChild(d); } });
    } else setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 900);
  }

  function screenIn(id) {
    var sc = document.getElementById(id);
    if (!sc) return;
    enter(sc.querySelectorAll('.fx-in'), { stagger: 62, duration: 500, scale: true });
  }

  return { enter: enter, countUp: countUp, shake: shake, pop: pop, glow: glow, ripple: ripple,
           confetti: confetti, stopConfetti: stopConfetti, floatPoints: floatPoints,
           screenIn: screenIn, reduced: reduced };
})();

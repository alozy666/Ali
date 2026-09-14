/* مساعدات DOM صغيرة — الألعاب لا تلمس الـDOM إلا عبر هذه الطبقة */
window.WKM = window.WKM || {};
WKM.Dom = (function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function html(el, s) { if (el) el.innerHTML = s; return el; }
  function on(root, sel, ev, fn) {
    root.addEventListener(ev, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* يُظهر شاشة ويُفرغ ما سواها (عدا الرئيسية لأنها تحمل مشهد 3D حياً)
     حتى لا تبقى عناصر قديمة مخفية تلتقطها المُحدِّدات أو تستهلك الذاكرة */
  function show(id) {
    $$('.screen').forEach(function (s) {
      var on = s.id === id;
      s.classList.toggle('active', on);
      if (!on && s.id !== 'sc-welcome') s.innerHTML = '';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  return { $: $, $$: $$, html: html, on: on, esc: esc, show: show };
})();

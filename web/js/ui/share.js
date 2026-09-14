/* تصدير نتيجة الجلسة: نصّاً للنسخ، وصورةً PNG قابلة للمشاركة */
window.WKM = window.WKM || {};
WKM.Share = (function () {
  var SIG_EN = 'by Mohamed Almseeh', SIG_AR = 'إعداد: محمد المسيح';

  function summaryText() {
    var st = WKM.State.standings();
    var L = ['🏆 نتيجة جلسة «وَكُن مِنَ العارِفِينَ»', ''];
    st.forEach(function (t, i) {
      var medal = ['🥇', '🥈', '🥉'][i] || '▫️';
      L.push(medal + ' ' + t.name + ' — ' + t.score + ' نقطة' +
             ' (دقة ' + WKM.State.accuracy(t) + '٪ · ' + t.stats.correct + ' صحيحة من ' + t.stats.asked + ')');
      var best = WKM.State.bestStation(t.id);
      if (best) L.push('     أفضل محطة: ' + best.name + ' (' + best.points + ' نقطة)');
      var un = WKM.State.unusedCards(t);
      if (un.length) L.push('     كروت لم تُستخدم: ' + un.map(function (c) { return c.label; }).join(' · '));
    });
    L.push('', SIG_EN, SIG_AR);
    return L.join('\n');
  }

  function copyText() {
    var text = summaryText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* يرسم بطاقة نتيجة على canvas ويُنزّلها PNG */
  function drawCard() {
    var teams = WKM.State.standings().slice(0, 6);
    var W = 1080, H = Math.max(900, 470 + teams.length * 152 + 210);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    var FH = "700 54px 'Noto Naskh Arabic', serif";
    var FB = "400 30px 'Noto Sans Arabic', sans-serif";
    var FBB = "700 34px 'Noto Sans Arabic', sans-serif";

    var grd = x.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#0A1A3C'); grd.addColorStop(0.55, '#0B3D2E'); grd.addColorStop(1, '#07132C');
    x.fillStyle = grd; x.fillRect(0, 0, W, H);

    var glow = x.createRadialGradient(W * 0.5, 240, 20, W * 0.5, 240, 520);
    glow.addColorStop(0, 'rgba(212,175,55,.22)'); glow.addColorStop(1, 'rgba(212,175,55,0)');
    x.fillStyle = glow; x.fillRect(0, 0, W, 640);

    x.strokeStyle = 'rgba(212,175,55,.45)'; x.lineWidth = 3;
    x.strokeRect(34, 34, W - 68, H - 68);

    x.direction = 'rtl'; x.textAlign = 'center';

    /* الشعار: حلقة وقبّة */
    x.save();
    x.translate(W / 2, 168);
    x.strokeStyle = '#D4AF37'; x.lineWidth = 3.4;
    x.beginPath(); x.arc(0, 0, 62, 0, Math.PI * 2); x.stroke();
    x.globalAlpha = 0.5;
    x.beginPath(); x.ellipse(0, 0, 62, 23, 0, 0, Math.PI * 2); x.stroke();
    x.globalAlpha = 1;
    x.fillStyle = '#D4AF37';
    x.beginPath(); x.moveTo(0, -34); x.quadraticCurveTo(-20, -10, -19, 6);
    x.lineTo(19, 6); x.quadraticCurveTo(20, -10, 0, -34); x.fill();
    x.fillRect(-24, 10, 48, 6);
    x.globalAlpha = 0.55; x.fillRect(-19, 20, 38, 24); x.globalAlpha = 1;
    x.restore();

    x.fillStyle = '#E8C96A'; x.font = FH;
    x.fillText('وَكُن مِنَ العارِفِينَ', W / 2, 300);
    x.fillStyle = 'rgba(245,239,224,.72)'; x.font = FB;
    x.fillText('نتيجة الجلسة', W / 2, 352);

    var y = 440;
    teams.forEach(function (t, i) {
      var lead = i === 0;
      x.fillStyle = lead ? 'rgba(212,175,55,.14)' : 'rgba(255,255,255,.045)';
      roundRect(x, 70, y, W - 140, 132, 18); x.fill();
      x.strokeStyle = lead ? 'rgba(212,175,55,.65)' : 'rgba(212,175,55,.2)'; x.lineWidth = 2;
      roundRect(x, 70, y, W - 140, 132, 18); x.stroke();

      x.textAlign = 'right';
      x.fillStyle = lead ? '#F0D98A' : '#F5EFE0'; x.font = FBB;
      x.fillText((i + 1) + '. ' + t.name, W - 110, y + 52);
      x.fillStyle = 'rgba(245,239,224,.66)'; x.font = "400 26px 'Noto Sans Arabic', sans-serif";
      var best = WKM.State.bestStation(t.id);
      x.fillText('دقة ' + WKM.State.accuracy(t) + '٪ · ' + t.stats.correct + ' صحيحة من ' + t.stats.asked +
                 (best ? ' · أفضل محطة: ' + best.name : ''), W - 110, y + 96);

      x.textAlign = 'left';
      x.fillStyle = '#D4AF37'; x.font = "700 62px 'Noto Naskh Arabic', serif";
      x.fillText(String(t.score), 110, y + 82);
      y += 152;
    });

    x.textAlign = 'center';
    x.fillStyle = 'rgba(212,175,55,.92)'; x.font = "400 28px 'Noto Sans Arabic', sans-serif";
    x.fillText(SIG_EN, W / 2, H - 96);
    x.fillText(SIG_AR, W / 2, H - 56);
    return c;
  }

  function roundRect(x, a, b, w, h, r) {
    x.beginPath();
    x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r);
    x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r);
    x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath();
  }

  function downloadImage() {
    var go = function () {
      try {
        var c = drawCard();
        c.toBlob(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = 'wakun-result.png';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        }, 'image/png');
        return true;
      } catch (e) { return false; }
    };
    if (document.fonts && document.fonts.ready) return document.fonts.ready.then(go);
    return Promise.resolve(go());
  }

  return { summaryText: summaryText, copyText: copyText, downloadImage: downloadImage, drawCard: drawCard };
})();

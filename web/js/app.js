/* التشغيل وربط الأحداث — وَكُن مِنَ العارِفِينَ */
(function () {
  var D = WKM.Dom, I = WKM.Icons, cfg = null;

  /* ── الشاشة الرئيسية ── */
  function renderWelcome() {
    D.$('#sc-welcome').innerHTML =
      '<div class="wrap">' +
        '<div class="hero" id="hero">' +
          '<canvas id="hero-canvas"></canvas>' +
          '<div class="fallback"></div>' +
          '<div class="veil"></div>' +
          '<div class="title"><h1>وَكُن مِنَ العارِفِينَ</h1>' +
            '<div class="sub">لعبة مسابقات ومعارف إسلامية</div></div>' +
        '</div>' +
        '<p class="lead">طريقٌ من نور يمتدّ من الكعبة المشرفة في مكة إلى القباب الذهبية في سامراء المقدسة… ' +
          'سبع محطات، وأربع ألعاب، وبنك معرفة موثّق بمصادره.</p>' +
        '<div class="btn-row">' +
          '<button class="btn btn-primary btn-lg" id="start-game">' + I.get('play') + ' ابدأ الجلسة</button>' +
        '</div>' +
        '<div class="grid">' +
          '<div class="card">' + I.get('dice') + '<h3>مَن يزيّد؟</h3><p>مزاد على عدد ما تستطيع سرده، ' +
            cfg.timers.bidding_count + ' ثانية للتعداد. الفشل يُحوّل النقاط للمنافس.</p></div>' +
          '<div class="card">' + I.get('map') + '<h3>رحلة السفر</h3><p>7 محطات، 3 أسئلة لكل فريق في كل محطة، ' +
            cfg.timers.question + ' ثانية للسؤال، و3 كروت مساعدة.</p></div>' +
          '<div class="card">' + I.get('bulb') + '<h3>لَمِّح إليّ</h3><p>ثلاث كلمات مفتاحية، ' +
            'والأسرع في الاستنتاج الصحيح يحصد النقاط.</p></div>' +
          '<div class="card">' + I.get('question') + '<h3>اسأل وجاوب</h3><p>عقائد وفقه وقرآن وتاريخ، ' +
            'وكروت: خيارات، ومساعدة، وحذف إجابتين.</p></div>' +
        '</div>' +
        '<p class="section-note" style="margin-top:var(--sp-6)">بنك الأسئلة: ' +
          '<strong>' + WKM.Bank.stats().total + '</strong> عنصراً، كلٌّ منها موثّق بمصدره.</p>' +
      '</div>';
    mountHero();
  }

  function mountHero() {
    var canvas = D.$('#hero-canvas'), hero = D.$('#hero');
    if (!canvas) return;
    var ok = WKM.Scene3D.mount(canvas);
    if (!ok) hero.classList.add('no3d');
  }

  /* ── كرت [خليها لغيري] مع أكثر من فريقين: اختيار الهدف ── */
  function askPassTarget() {
    var r = WKM.Journey.view();
    var others = WKM.State.teams().filter(function (t) { return t.id !== r.answeringTeamId; });
    if (others.length === 1) return applyCard('pass', others[0].id);
    D.$('#cards-bar').innerHTML = '<div class="label">إلى أي فريق تُحوّل السؤال؟</div>' +
      others.map(function (t) {
        return '<button class="helpcard pass-to" data-team="' + t.id + '">' + I.get('pass') + ' ' + D.esc(t.name) + '</button>';
      }).join('') + '<button class="helpcard" id="cancel-pass">إلغاء</button>';
  }

  function applyCard(card, target) {
    var res = WKM.Journey.useCard(card, target);
    if (!res.ok) { flash(res.reason || 'تعذّر استخدام الكرت'); return; }
    WKM.Screens.timer().stop();
    WKM.Screens.step({ type: 'question', round: res.round });
  }

  function flash(msg) {
    var bar = D.$('#cards-bar');
    if (!bar) return;
    var n = document.createElement('div');
    n.className = 'label';
    n.style.color = 'var(--color-danger)';
    n.textContent = msg;
    bar.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 2600);
  }

  /* ── السمة ── */
  function currentTheme() {
    try { return localStorage.getItem('wkm.theme') || ''; } catch (e) { return ''; }
  }
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('wkm.theme', t); } catch (e) {}
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'light' ? 'dark' : 'light');
  }

  /* ── ربط الأحداث ── */
  function wire() {
    var app = D.$('#app');

    D.on(document, '#theme-toggle', 'click', toggleTheme);
    D.on(app, '#start-game', 'click', function () { WKM.Screens.renderTeams(); D.show('sc-teams'); });

    D.on(app, '#add-team', 'click', function () {
      var names = WKM.Screens.teamNames();
      if (names.length >= 6) return;
      names.push('فريق ' + (names.length + 1));
      WKM.Screens.paintTeamRows(names);
    });
    D.on(app, '.del-team', 'click', function (e, btn) {
      var rows = D.$$('.team-row'), idx = rows.indexOf(btn.closest('.team-row'));
      var names = WKM.Screens.teamNames();
      names.splice(idx, 1);
      WKM.Screens.paintTeamRows(names);
    });
    D.on(app, '#to-modes', 'click', function () {
      var names = WKM.Screens.teamNames();
      if (names.length < 2) { alert('سجّل فريقين على الأقل'); return; }
      WKM.State.init(cfg, names, 'journey', Date.now() >>> 0);
      WKM.Screens.renderModes();
      D.show('sc-modes');
    });

    D.on(app, '.mode', 'click', function (e, btn) {
      if (btn.disabled || btn.dataset.mode !== 'journey') return;
      WKM.Screens.startJourney();
    });

    D.on(app, '.opt', 'click', function (e, btn) {
      if (btn.disabled || btn.classList.contains('gone')) return;
      WKM.Screens.onAnswer(+btn.dataset.i);
    });
    D.on(app, '.verdict-btn', 'click', function (e, btn) {
      if (btn.disabled) return;
      WKM.Screens.onAnswer(btn.dataset.ok === '1');
    });
    D.on(app, '#next-q', 'click', function () { WKM.Screens.step(WKM.Journey.next()); });
    D.on(app, '#next-station', 'click', function () { WKM.Screens.step(WKM.Journey.next()); });
    D.on(app, '#to-results', 'click', function () { WKM.Screens.renderResults(); });
    D.on(app, '#play-again', 'click', function () {
      WKM.Dedupe.reset(); WKM.Journey.reset();
      WKM.Screens.renderTeams(WKM.State.teams().map(function (t) { return t.name; }));
      D.show('sc-teams');
    });
    D.on(app, '#go-home', 'click', function () { D.show('sc-welcome'); });

    D.on(app, '.helpcard[data-card]', 'click', function (e, btn) {
      if (btn.disabled) return;
      var card = btn.dataset.card;
      if (card === 'pass') askPassTarget(); else applyCard(card);
    });
    D.on(app, '.pass-to', 'click', function (e, btn) { applyCard('pass', btn.dataset.team); });
    D.on(app, '#cancel-pass', 'click', function () {
      WKM.Screens.step({ type: 'question', round: WKM.Journey.view() });
    });
  }

  /* ── الإقلاع ── */
  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(currentTheme());
    WKM.Data.load().then(function (data) {
      cfg = data.config;
      WKM.Bank.load(data);
      WKM.Score.init(cfg); WKM.Cards.init(cfg);
      WKM.Screens.init(cfg);
      renderWelcome();
      wire();
      D.show('sc-welcome');
    }).catch(function (err) {
      D.$('#app').innerHTML = '<div class="wrap"><div class="card"><h3>تعذّر تحميل البيانات</h3><p>' +
        D.esc(err.message) + '</p></div></div>';
    });
  });
})();

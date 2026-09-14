/* التشغيل وربط الأحداث — وَكُن مِنَ العارِفِينَ */
(function () {
  var D = WKM.Dom, I = WKM.Icons, cfg = null;

  /* ── الشاشة الرئيسية ── */
  function renderWelcome() {
    D.$('#sc-welcome').innerHTML =
      '<div class="wrap">' +
        '<div class="hero fx-in" id="hero">' +
          '<canvas id="hero-canvas"></canvas>' +
          '<div class="fallback"></div>' +
          '<div class="veil"></div>' +
          '<div class="title"><h1>وَكُن مِنَ العارِفِينَ</h1>' +
            '<div class="sub">لعبة مسابقات ومعارف إسلامية</div></div>' +
        '</div>' +
        '<p class="lead fx-in">طريقٌ من نور يمتدّ من الكعبة المشرفة في مكة إلى القباب الذهبية في سامراء المقدسة… ' +
          'سبع محطات، وأربع ألعاب، وبنك معرفة موثّق بمصادره.</p>' +
        '<div class="btn-row fx-in">' +
          '<button class="btn btn-primary btn-lg" id="start-game">' + I.get('play') + ' ابدأ الجلسة</button>' +
        '</div>' +
        '<div class="grid">' +
          '<div class="card fx-in">' + I.get('dice') + '<h3>مَن يزيّد؟</h3><p>مزاد على عدد ما تستطيع سرده، ' +
            cfg.timers.bidding_count + ' ثانية للتعداد. الفشل يُحوّل النقاط للمنافس.</p></div>' +
          '<div class="card fx-in">' + I.get('map') + '<h3>رحلة السفر</h3><p>7 محطات، 3 أسئلة لكل فريق في كل محطة، ' +
            cfg.timers.question + ' ثانية للسؤال، و3 كروت مساعدة.</p></div>' +
          '<div class="card fx-in">' + I.get('bulb') + '<h3>لَمِّح إليّ</h3><p>ثلاث كلمات مفتاحية، ' +
            'والأسرع في الاستنتاج الصحيح يحصد النقاط.</p></div>' +
          '<div class="card fx-in">' + I.get('question') + '<h3>اسأل وجاوب</h3><p>عقائد وفقه وقرآن وتاريخ، ' +
            'وكروت: خيارات، ومساعدة، وحذف إجابتين.</p></div>' +
        '</div>' +
        toolsMarkup() +
      '</div>';
    mountHero();
    WKM.FX.enter('#sc-welcome .fx-in', { stagger: 85, duration: 560, scale: true });
  }

  /* أدوات الحَكَم: حالة البنك وتصفيره وتصدير الجلسة واستيرادها */
  function toolsMarkup() {
    var st = WKM.Bank.stats();
    var used = st.total - st.remaining;
    return '<div class="card fx-in" id="tools-card" style="margin-top:var(--sp-6)">' +
      '<h3>' + I.get('book') + ' بنك الأسئلة وأدوات الحَكَم</h3>' +
      '<p><strong style="color:var(--color-primary)">' + st.remaining + '</strong> عنصراً متاحاً من ' +
        st.total + '، كلٌّ منها موثّق بمصدره' + (used ? ' (استُهلك ' + used + ')' : '') + '.' +
        (WKM.Dedupe.storageAvailable() ? '' : ' <span style="color:var(--color-warning)">التخزين المحلي معطّل — السجلّ في الذاكرة فقط.</span>') + '</p>' +
      '<div class="btn-row" style="justify-content:flex-start;margin-top:var(--sp-3)">' +
        '<button class="btn btn-sm" id="reset-bank">' + I.get('refresh') + ' تصفير سجلّ الأسئلة المستهلكة</button>' +
        '<button class="btn btn-sm" id="export-session">' + I.get('flag') + ' تصدير الجلسة</button>' +
        '<label class="btn btn-sm" for="import-file">' + I.get('plus') + ' استيراد جلسة</label>' +
        '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
      '</div><div id="tools-msg"></div></div>';
  }

  function refreshTools() {
    var host = D.$('#tools-card');
    if (host) host.outerHTML = toolsMarkup();
  }

  function download(name, text) {
    try {
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      return true;
    } catch (e) { return false; }
  }

  function toolsMsg(text, danger) {
    var m = D.$('#tools-msg');
    if (m) m.innerHTML = '<div class="label" style="color:var(--color-' + (danger ? 'danger' : 'success') + ')">' +
      D.esc(text) + '</div>';
  }

  function hideSplash() {
    var sp = D.$('#splash');
    if (!sp) return;
    setTimeout(function () {
      sp.classList.add('hidden');
      setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 900);
    }, WKM.FX.reduced() ? 0 : 620);
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

    /* تموّج لمسي على كل الأزرار */
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.btn, .helpcard, .opt, .icon-btn, .mode');
      if (b && !b.disabled) WKM.FX.ripple(b, e);
    });

    D.on(document, '#theme-toggle', 'click', toggleTheme);
    D.on(document, '#mute-toggle', 'click', function (e, btn) {
      var m = WKM.Sound.toggle();
      btn.setAttribute('aria-pressed', m ? 'true' : 'false');
      btn.classList.toggle('muted', m);
      btn.title = m ? 'تشغيل الصوت' : 'كتم الصوت';
    });
    /* سياسة المتصفحات تمنع الصوت قبل تفاعل المستخدم */
    document.addEventListener('pointerdown', function once() {
      WKM.Sound.unlock();
      document.removeEventListener('pointerdown', once);
    });

    D.on(app, '#copy-result', 'click', function () {
      Promise.resolve(WKM.Share.copyText()).then(function (ok) {
        var m = D.$('#share-msg');
        if (m) m.innerHTML = '<div class="label" style="color:var(--color-' + (ok ? 'success' : 'danger') + ')">' +
          (ok ? 'نُسخت النتيجة إلى الحافظة.' : 'تعذّر النسخ — انسخها يدوياً.') + '</div>';
      });
    });
    D.on(app, '#image-result', 'click', function () {
      Promise.resolve(WKM.Share.downloadImage()).then(function () {
        var m = D.$('#share-msg');
        if (m) m.innerHTML = '<div class="label" style="color:var(--color-success)">جارٍ تنزيل صورة النتيجة…</div>';
      });
    });
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
      if (btn.disabled) return;
      if (btn.dataset.mode === 'journey') WKM.Screens.startJourney();
      else WKM.GameScreens.startMode(btn.dataset.mode);
    });

    /* ── مَن يزيّد؟ ── */
    D.on(app, '.bid-step', 'click', function (e, btn) {
      var id = btn.dataset.team, d = +btn.dataset.d;
      var v = WKM.Bidding.view(); if (!v || v.phase !== 'bid') return;
      var n = WKM.Bidding.setBid(id, (v.bids[id] || 0) + d);
      var cell = D.$('.bid-val[data-team="' + id + '"]');
      if (cell) cell.textContent = n;
    });
    D.on(app, '#lock-bids', 'click', function () {
      var r = WKM.Bidding.lockBids();
      if (!r.ok) { var m = D.$('#bid-msg'); if (m) m.innerHTML =
        '<div class="label" style="color:var(--color-danger)">' + D.esc(r.reason) + '</div>'; return; }
      WKM.GameScreens.renderBidding(r.view);
    });
    function bidSubmit() {
      var inp = D.$('#bid-entry'); if (!inp || inp.disabled) return;
      var r = WKM.Bidding.submit(inp.value);
      inp.value = ''; inp.focus();
      if (r.reason === 'empty') return;
      var box = D.$('#bid-progress');
      if (box) box.innerHTML = WKM.GameScreens.progressMarkup(r.view || WKM.Bidding.view());
      if (r.ok && r.full) WKM.GameScreens.revealBidding(WKM.Bidding.finish());
    }
    D.on(app, '#bid-add', 'click', bidSubmit);
    app.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'bid-entry') { e.preventDefault(); bidSubmit(); }
    });
    D.on(app, '#bid-stop', 'click', function () { WKM.GameScreens.revealBidding(WKM.Bidding.finish()); });

    /* ── لَمِّح إليّ ── */
    D.on(app, '.buzz', 'click', function (e, btn) {
      if (btn.disabled) return;
      var r = WKM.Hints.buzz(btn.dataset.team);
      if (r.ok) WKM.GameScreens.renderHints(r.view);
    });
    D.on(app, '.hint-judge', 'click', function (e, btn) {
      if (btn.disabled) return;
      var r = WKM.Hints.judge(btn.dataset.ok === '1');
      if (!r) return;
      if (r.continues) WKM.GameScreens.renderHints(WKM.Hints.view());
      else WKM.GameScreens.revealHints(r);
    });
    D.on(app, '#reveal-kw', 'click', function () {
      var v = WKM.Hints.revealNext(); if (v) WKM.GameScreens.renderHints(v);
    });
    D.on(app, '#extra-hint', 'click', function () {
      var v = WKM.Hints.useExtraHint(); if (v) WKM.GameScreens.renderHints(v);
    });

    /* ── اسأل وجاوب ── */
    D.on(app, '.qa-opt', 'click', function (e, btn) {
      if (btn.disabled || btn.classList.contains('gone')) return;
      var v = WKM.QA.view();
      WKM.GameScreens.revealQA(WKM.QA.answer(+btn.dataset.i), v);
    });
    D.on(app, '.qa-verdict', 'click', function (e, btn) {
      if (btn.disabled) return;
      var v = WKM.QA.view();
      WKM.GameScreens.revealQA(WKM.QA.answer(btn.dataset.ok === '1'), v);
    });
    D.on(app, '.qa-card', 'click', function (e, btn) {
      if (btn.disabled) return;
      var r = WKM.QA.useCard(btn.dataset.card);
      if (!r.ok) {
        var m = D.$('#qa-msg');
        if (m) m.innerHTML = '<div class="label" style="color:var(--color-danger)">' + D.esc(r.reason) + '</div>';
        return;
      }
      var t = WKM.GameScreens.timer();
      if (btn.dataset.card === 'ask_help') {
        var rem = t.remaining(); t.stop(); WKM.GameScreens.renderQA(r.view); t.start(rem + 30);
      } else WKM.GameScreens.renderQA(r.view);
    });

    D.on(app, '#next-round', 'click', function () { WKM.GameScreens.nextRound(); });

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
      WKM.Bidding.reset(); WKM.Hints.reset(); WKM.QA.reset(); WKM.Mixed.reset();
      WKM.GameScreens.timer().stop(); WKM.Screens.timer().stop();
      WKM.Screens.renderTeams(WKM.State.teams().map(function (t) { return t.name; }));
      D.show('sc-teams');
    });
    D.on(app, '#go-home', 'click', function () { D.show('sc-welcome'); refreshTools(); });

    /* ── أدوات الحَكَم ── */
    D.on(app, '#reset-bank', 'click', function () {
      if (!window.confirm('سيُمسح سجلّ الأسئلة المستهلكة ويعود البنك كاملاً. متابعة؟')) return;
      WKM.Dedupe.reset();
      refreshTools();
      toolsMsg('تم تصفير السجلّ — البنك متاح كاملاً.');
    });
    D.on(app, '#export-session', 'click', function () {
      var state = WKM.State.get();
      var payload = JSON.stringify({
        app: 'wakun-min-al-arifeen', version: cfg.version,
        savedAt: new Date().toISOString(),
        state: state || null, used: WKM.Dedupe.exportJSON()
      });
      if (download('wakun-session-' + Date.now() + '.json', payload))
        toolsMsg('صُدّرت الجلسة إلى ملف.');
      else toolsMsg('تعذّر التصدير في هذا المتصفح.', true);
    });
    app.addEventListener('change', function (e) {
      if (!e.target || e.target.id !== 'import-file' || !e.target.files || !e.target.files[0]) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var o = JSON.parse(reader.result);
          if (o.used) WKM.Dedupe.importJSON(o.used);
          if (o.state) WKM.State.importJSON(JSON.stringify({ state: o.state, used: o.used }));
          refreshTools();
          toolsMsg('استُوردت الجلسة بنجاح.');
        } catch (err) { toolsMsg('ملف غير صالح.', true); }
      };
      reader.readAsText(e.target.files[0]);
    });

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
    var brand = D.$('#brand'); if (brand) brand.innerHTML = I.emblem(34, 'brand');
    var sp = D.$('#splash-emblem'); if (sp) sp.innerHTML = I.emblem(96, 'splash');
    var mute = D.$('#mute-toggle');
    if (mute && WKM.Sound.isMuted()) { mute.classList.add('muted'); mute.setAttribute('aria-pressed', 'true'); }
    WKM.Data.load().then(function (data) {
      cfg = data.config;
      WKM.Bank.load(data);
      WKM.Score.init(cfg); WKM.Cards.init(cfg);
      WKM.Screens.init(cfg);
      WKM.GameScreens.init(cfg);
      renderWelcome();
      wire();
      D.show('sc-welcome');
      hideSplash();
    }).catch(function (err) {
      D.$('#app').innerHTML = '<div class="wrap"><div class="card"><h3>تعذّر تحميل البيانات</h3><p>' +
        D.esc(err.message) + '</p></div></div>';
    });
  });
})();

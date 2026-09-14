/* الشاشات والمكوّنات — الطبقة الوحيدة التي تلمس الـDOM */
window.WKM = window.WKM || {};
WKM.Screens = (function () {
  var D = WKM.Dom, I = WKM.Icons, E = null, cfg = null, timer = null, pendingPass = false;
  var KEYS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

  function init(config) {
    cfg = config;
    E = {
      app: D.$('#app'),
      welcome: D.$('#sc-welcome'), teams: D.$('#sc-teams'), modes: D.$('#sc-modes'),
      play: D.$('#sc-play'), board: D.$('#sc-board'), results: D.$('#sc-results')
    };
    timer = WKM.Timer.create({
      onTick: paintTimer,
      onWarn: function () { var t = D.$('#timer'); if (t) t.classList.add('warn'); if (WKM.Sound) WKM.Sound.warn(); },
      onEnd: function () { onAnswer(-1, true); },
      warnAt: cfg.timers.warn_at
    });
  }

  /* ───────── مكوّنات مشتركة ───────── */

  function stationsStrip(currentIdx, showAll) {
    return cfg.stations.map(function (s, i) {
      var cls = i < currentIdx ? 'st done' : (i === currentIdx ? 'st now' : 'st');
      var name = (!showAll && Math.abs(i - currentIdx) > 2) ? '·' : D.esc(s.name);
      return '<span class="' + cls + '">' + name + '</span>' +
             (i < cfg.stations.length - 1 ? '<span class="st-sep">◂</span>' : '');
    }).join('');
  }

  function timerMarkup() {
    return '<div class="timer" id="timer"><svg viewBox="0 0 84 84">' +
      '<circle class="track" cx="42" cy="42" r="36"/>' +
      '<circle class="fill" id="timer-fill" cx="42" cy="42" r="36" stroke-dasharray="226.2" stroke-dashoffset="0"/>' +
      '</svg><div class="num" id="timer-num">--</div></div>';
  }
  function paintTimer(remaining, total) {
    var fill = D.$('#timer-fill'), num = D.$('#timer-num');
    if (!fill || !num) return;
    var C = 226.2;
    fill.setAttribute('stroke-dashoffset', String(C * (1 - (total ? remaining / total : 0))));
    num.textContent = remaining;
  }

  function scoresTable(highlightId) {
    var rows = WKM.State.standings().map(function (t, i) {
      var cards = WKM.Cards.remaining(t, 'journey').map(function (c) { return c.label; });
      return '<tr class="' + (i === 0 ? 'lead' : '') + (t.id === highlightId ? ' now' : '') + '">' +
        '<td>' + (i === 0 ? I.get('crown') + ' ' : '') + D.esc(t.name) + '</td>' +
        '<td class="pts">' + t.score + '</td>' +
        '<td class="mini">' + (cards.length ? cards.join(' · ') : 'لا كروت متبقية') + '</td>' +
        '<td class="mini">' + t.stats.correct + ' صحيحة · ' + t.stats.wrong + ' خاطئة</td></tr>';
    }).join('');
    return '<table class="scores"><thead><tr><th>الفريق</th><th>النقاط</th>' +
           '<th>الكروت المتبقية</th><th>الإحصاء</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ───────── شاشة تسجيل الفرق ───────── */

  function renderTeams(names) {
    names = names || ['فريق الغدير', 'فريق الكوثر'];
    E.teams.innerHTML =
      '<div class="wrap">' +
        '<h2 class="section-title">' + I.get('users') + ' مَن يتنافس الليلة؟</h2>' +
        '<p class="section-note">سجّل أسماء الفرق — فريقان على الأقل.</p>' +
        '<div class="team-list" id="team-list"></div>' +
        '<div class="btn-row">' +
          '<button class="btn" id="add-team">' + I.get('plus') + ' إضافة فريق</button>' +
          '<button class="btn btn-primary btn-lg" id="to-modes">' + I.get('play') + ' متابعة</button>' +
        '</div>' +
      '</div>';
    paintTeamRows(names);
  }
  function paintTeamRows(names) {
    D.$('#team-list').innerHTML = names.map(function (n, i) {
      return '<div class="team-row">' +
        '<span class="idx">' + (i + 1) + '</span>' +
        '<input class="input team-name" value="' + D.esc(n) + '" maxlength="24" placeholder="اسم الفريق">' +
        (names.length > 2 ? '<button class="icon-btn del-team" title="حذف">' + I.get('trash') + '</button>' : '') +
        '</div>';
    }).join('');
  }
  function teamNames() {
    return D.$$('.team-name').map(function (i) { return i.value.trim(); }).filter(Boolean);
  }

  /* ───────── شاشة الأنماط ───────── */

  function renderModes() {
    E.modes.innerHTML =
      '<div class="wrap">' +
        '<h2 class="section-title">' + I.get('map') + ' اختر نمط الجلسة</h2>' +
        '<p class="section-note">الفرق: ' + D.esc(WKM.State.teams().map(function (t) { return t.name; }).join(' · ')) + '</p>' +
        '<div class="modes">' +
          '<button class="card mode" data-mode="journey">' + I.get('map') +
            '<h3>رحلة السفر الكاملة</h3><p>سبع محطات من مكة المكرمة إلى سامراء المقدسة، ' +
            '3 أسئلة لكل فريق في كل محطة، و3 كروت مساعدة.</p></button>' +
          '<button class="card mode" data-mode="mixed">' + I.get('star') +
            '<h3>النمط الشامل</h3><p>' + cfg.rounds.mixed + ' جولة متنوعة عشوائياً بين الألعاب الأربع.</p></button>' +
          '<button class="card mode" data-mode="bidding">' + I.get('dice') +
            '<h3>مَن يزيّد؟</h3><p>مزاد على عدد ما تستطيع سرده، ' + cfg.timers.bidding_count +
            ' ثانية للتعداد. الفشل يُحوّل النقاط للمنافس. (' + cfg.rounds.bidding + ' جولات)</p></button>' +
          '<button class="card mode" data-mode="hints">' + I.get('bulb') +
            '<h3>لَمِّح إليّ</h3><p>ثلاث كلمات مفتاحية، والأسرع في الاستنتاج يفوز. (' +
            cfg.rounds.hints + ' جولات)</p></button>' +
          '<button class="card mode" data-mode="qa">' + I.get('question') +
            '<h3>اسأل وجاوب</h3><p>أسئلة مباشرة في العقائد والفقه والقرآن والتاريخ، ' +
            cfg.timers.question + ' ثانية، و3 كروت. (' + cfg.rounds.qa_per_team + ' أسئلة لكل فريق)</p></button>' +
        '</div>' +
      '</div>';
  }

  /* ───────── شاشة اللعب ───────── */

  function renderPlay(r) {
    pendingPass = false;
    var team = r.team;
    var diffName = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' }[r.difficulty];
    var passNote = r.passedFrom
      ? '<div class="chip" style="border-color:var(--color-warning);color:var(--color-warning)">سؤال محوَّل من ' +
        D.esc(WKM.State.team(r.passedFrom).name) + '</div>' : '';

    E.play.innerHTML =
      '<div class="wrap">' +
        '<div class="stations">' + stationsStrip(r.stationIndex) + '</div>' +
        '<div class="card">' +
          '<div class="hud">' +
            '<div><div class="who">' + I.get('flag') + ' ' + D.esc(team.name) + '</div>' +
              '<div class="meta">' + D.esc(r.station.name) + ' — المحطة ' + (r.stationIndex + 1) + ' من ' + cfg.stations.length + '</div></div>' +
            '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">' + passNote +
              '<span class="chip ' + r.difficulty + '">' + diffName + ' · ' + r.points + ' نقطة</span>' +
              timerMarkup() + '</div>' +
          '</div>' +
          '<p class="question">' + D.esc(r.question.text) + '</p>' +
          '<div id="answers">' + answersMarkup(r) + '</div>' +
          '<div id="reveal"></div>' +
          '<div class="cards-bar" id="cards-bar">' + cardsBarMarkup(team, r) + '</div>' +
        '</div>' +
      '</div>';
    D.show('sc-play');
    timer.start(cfg.timers.question);
  }

  function answersMarkup(r) {
    var q = r.question;
    if (!r.showOptions) {
      return '<p class="section-note" style="text-align:right;margin:0 0 var(--sp-4)">' +
        'سؤال مفتوح — يجيب الفريق شفهياً، والحَكَم يحكم:</p>' +
        '<div class="btn-row" style="justify-content:flex-start;margin:0">' +
          '<button class="btn verdict-btn" data-ok="1" style="border-color:var(--color-success)">' +
            I.get('check') + ' أجاب صح</button>' +
          '<button class="btn verdict-btn" data-ok="0" style="border-color:var(--color-danger)">' +
            I.get('x') + ' أجاب خطأ</button>' +
        '</div>';
    }
    var opts = q.type === 'tf' ? ['صحيح', 'خطأ'] : q.options;
    return '<div class="options">' + opts.map(function (o, i) {
      var gone = r.removed.indexOf(i) !== -1 ? ' gone' : '';
      return '<button class="opt' + gone + '" data-i="' + i + '">' +
        '<span class="key">' + KEYS[i] + '</span><span>' + D.esc(o) + '</span></button>';
    }).join('') + '</div>';
  }

  function cardsBarMarkup(team, r) {
    var avail = WKM.Cards.remaining(team, 'journey');
    var icons = { pass: 'pass', swap: 'swap', options: 'options' };
    var all = cfg.cards.journey.map(function (c) {
      var has = avail.some(function (a) { return a.id === c; });
      var label = WKM.Cards.LABELS[c];
      var dis = !has || (c === 'options' && r.showOptions) || (c === 'pass' && r.passedFrom);
      return '<button class="helpcard" data-card="' + c + '"' + (dis ? ' disabled' : '') + '>' +
        I.get(icons[c]) + ' ' + label + '</button>';
    }).join('');
    return '<div class="label">كروت ' + D.esc(team.name) + ' (كل كرت مرة واحدة طوال الرحلة):</div>' + all;
  }

  function showReveal(res, r) {
    timer.stop();
    var q = res.question;
    var correctText = q.type === 'tf' ? (q.answer ? 'صحيح' : 'خطأ') : q.options[q.answer];
    if (r.showOptions) {
      D.$$('#answers .opt').forEach(function (b) {
        var i = +b.dataset.i;
        var isRight = q.type === 'tf' ? (i === 0) === (q.answer === true) : i === q.answer;
        if (isRight) b.classList.add('correct');
        else if (i === res.picked) b.classList.add('wrong');   // اختيار الفريق الخاطئ يُعلَّم أحمر
        b.disabled = true;
      });
    } else {
      D.$$('.verdict-btn').forEach(function (b) { b.disabled = true; });
    }
    var who = res.awardedTo ? WKM.State.team(res.awardedTo) : null;
    var line = res.correct ? 'إجابة صحيحة' : (res.timedOut ? 'انتهى الوقت' : 'إجابة غير صحيحة');
    if (res.passedFrom) {
      line += res.correct ? ' — النقاط للفريق المُحال إليه' : ' — النقاط للفريق المحوِّل';
    }
    D.$('#reveal').innerHTML =
      '<div class="reveal ' + (res.correct ? 'good' : 'bad') + '">' +
        '<div class="verdict">' + I.get(res.correct ? 'check' : 'x') + ' ' + line +
          (who ? ' <span style="color:var(--color-primary)">(+' + res.points + ' لـ' + D.esc(who.name) + ')</span>' : '') + '</div>' +
        '<div style="margin:.3rem 0 .5rem"><strong>الإجابة:</strong> ' + D.esc(correctText) + '</div>' +
        (q.explanation ? '<div class="why">' + D.esc(q.explanation) + '</div>' : '') +
        (q.note ? '<div class="note">' + D.esc(q.note) + '</div>' : '') +
        '<div class="src">' + I.get('book') + ' ' + D.esc(q.source.book) + ' — ' + D.esc(q.source.author) +
          (q.source.ref ? ' (' + D.esc(q.source.ref) + ')' : '') + '</div>' +
        '<div class="btn-row" style="justify-content:flex-start"><button class="btn btn-primary" id="next-q">' +
          I.get('play') + ' التالي</button></div>' +
      '</div>';
    D.$$('#cards-bar .helpcard').forEach(function (b) { b.disabled = true; });
    if (WKM.Sound) (res.correct ? WKM.Sound.correct() : WKM.Sound.wrong());
  }

  /* ───────── لوحة النقاط بين المحطات ───────── */

  function renderBoard(info) {
    var bonusHtml = (info.bonuses || []).map(function (b) {
      return '<div class="chip" style="border-color:var(--color-success);color:var(--color-success)">' +
        D.esc(b.team.name) + ': مكافأة محطة كاملة +' + b.bonus + '</div>';
    }).join(' ');
    var isEnd = info.type === 'end';
    E.board.innerHTML =
      '<div class="wrap">' +
        '<div class="stations">' + stationsStrip(WKM.State.get().stationIndex, true) + '</div>' +
        '<div class="card">' +
          '<h3>' + I.get('flag') + ' ' + (isEnd ? 'انتهت الرحلة' : 'اكتملت المحطة') + '</h3>' +
          (bonusHtml ? '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.6rem 0">' + bonusHtml + '</div>' : '') +
          scoresTable() +
          '<div class="btn-row">' +
            (isEnd
              ? '<button class="btn btn-primary btn-lg" id="to-results">' + I.get('crown') + ' النتيجة النهائية</button>'
              : '<button class="btn btn-primary btn-lg" id="next-station">' + I.get('map') + ' إلى ' +
                D.esc(info.station.name) + '</button>') +
          '</div>' +
        '</div>' +
      '</div>';
    D.show('sc-board');
    if (WKM.Sound && !isEnd) WKM.Sound.station();
  }

  /* ───────── النتائج ───────── */

  function renderResults() {
    var st = WKM.State.standings();
    var tie = WKM.State.isTie();
    var cards = st.map(function (t, i) {
      var best = WKM.State.bestStation(t.id);
      var un = WKM.State.unusedCards(t);
      var acc = WKM.State.accuracy(t);
      return '<div class="card result-row' + (i === 0 && !tie ? ' champ' : '') + '">' +
        '<div class="rank">' + (i === 0 && !tie ? I.get('crown') : (i + 1)) + '</div>' +
        '<div class="who2"><div class="nm">' + D.esc(t.name) + '</div>' +
          '<div class="meta">' + t.stats.correct + ' صحيحة · ' + t.stats.wrong + ' خاطئة · ' +
            'دقة ' + acc + '٪' + (best ? ' · أفضل محطة: ' + D.esc(best.name) + ' (' + best.points + ')' : '') + '</div>' +
          (un.length ? '<div class="meta">كروت لم تُستخدم: ' + D.esc(un.map(function (c) { return c.label; }).join(' · ')) + '</div>' : '') +
          '<div class="bar"><span style="width:' + acc + '%"></span></div>' +
        '</div>' +
        '<div class="pts2">' + t.score + '</div></div>';
    }).join('');

    E.results.innerHTML =
      '<div class="wrap">' +
        '<div class="card winner">' + I.emblem(96, 'res') +
          (tie ? '<div class="name">تعادل!</div><p class="section-note">القاعدة: سؤال «موت مفاجئ» من فئة صعب حتى الحسم.</p>'
               : '<div class="sub-t">الفائز</div><div class="name">' + D.esc(st[0].name) + '</div>' +
                 '<div class="pts">' + st[0].score + '</div>') +
        '</div>' +
        '<div class="results-list">' + cards + '</div>' +
        '<div class="card" style="margin-top:var(--sp-4)">' +
          '<div class="btn-row" style="margin:0">' +
            '<button class="btn" id="copy-result">' + I.get('book') + ' نسخ النتيجة</button>' +
            '<button class="btn" id="image-result">' + I.get('star') + ' تنزيل صورة</button>' +
            '<button class="btn btn-primary" id="play-again">' + I.get('refresh') + ' جولة جديدة</button>' +
            '<button class="btn" id="go-home">' + I.get('home') + ' الشاشة الرئيسية</button>' +
          '</div><div id="share-msg"></div>' +
        '</div>' +
      '</div>';
    D.show('sc-results');
    if (WKM.Sound) WKM.Sound.win();
  }

  /* ───────── تدفّق اللعب ───────── */

  function step(res) {
    if (res.type === 'question') renderPlay(res.round);
    else if (res.type === 'station-end') {
      var adv = WKM.Journey.advanceStation();
      renderBoard(adv);
    } else if (res.type === 'exhausted') {
      alert('نفدت أسئلة هذه المحطة في البنك. سيُوسَّع البنك في المرحلة M7.');
      renderBoard(WKM.Journey.advanceStation());
    }
  }

  function onAnswer(value, timedOut) {
    var r = WKM.Journey.view();
    if (!r || r.revealed) return;
    var res = WKM.Journey.answer(timedOut ? false : value);
    if (!res) return;
    res.picked = (typeof value === 'number' && !timedOut) ? value : -1;
    res.timedOut = !!timedOut;
    showReveal(res, r);
  }

  function startJourney() {
    WKM.State.setCardGames(['journey']);
    WKM.Journey.reset();
    step(WKM.Journey.start(cfg, WKM.State.get().seed));
  }

  return {
    init: init, renderTeams: renderTeams, paintTeamRows: paintTeamRows, teamNames: teamNames,
    renderModes: renderModes, renderResults: renderResults, renderBoard: renderBoard,
    startJourney: startJourney, step: step, onAnswer: onAnswer,
    setPendingPass: function (v) { pendingPass = v; }, isPendingPass: function () { return pendingPass; },
    timer: function () { return timer; }, scoresTable: scoresTable
  };
})();

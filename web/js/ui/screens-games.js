/* واجهات الألعاب الثلاث + منظّم الجولات (النمط الشامل والأنماط المنفردة) */
window.WKM = window.WKM || {};
WKM.GameScreens = (function () {
  var D = WKM.Dom, I = WKM.Icons, cfg = null, timer = null;
  var KEYS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
  var DIFF = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
  var flow = { mode: null, round: 0, total: 0, game: null };

  function init(config) {
    cfg = config;
    timer = WKM.Timer.create({
      onTick: paintTimer,
      onWarn: function () { var t = D.$('#timer'); if (t) t.classList.add('warn'); if (WKM.Sound) WKM.Sound.warn(); },
      onEnd: onTimeout,
      warnAt: cfg.timers.warn_at
    });
  }
  function paintTimer(rem, total) {
    var f = D.$('#timer-fill'), n = D.$('#timer-num');
    if (!f || !n) return;
    f.setAttribute('stroke-dashoffset', String(226.2 * (1 - (total ? rem / total : 0))));
    n.textContent = rem;
  }
  function timerMarkup() {
    return '<div class="timer" id="timer"><svg viewBox="0 0 84 84">' +
      '<circle class="track" cx="42" cy="42" r="36"/>' +
      '<circle class="fill" id="timer-fill" cx="42" cy="42" r="36" stroke-dasharray="226.2" stroke-dashoffset="0"/>' +
      '</svg><div class="num" id="timer-num">--</div></div>';
  }
  function head(title, sub, right) {
    return '<div class="hud"><div><div class="who">' + title + '</div>' +
      '<div class="meta">' + sub + '</div></div>' +
      '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">' + (right || '') + '</div></div>';
  }
  function roundChip() {
    if (!flow.total) return '';
    return '<span class="chip">الجولة ' + flow.round + ' من ' + flow.total + '</span>';
  }
  function srcLine(src) {
    return '<div class="src">' + I.get('book') + ' ' + D.esc(src.book) + ' — ' + D.esc(src.author) +
      (src.ref ? ' (' + D.esc(src.ref) + ')' : '') + '</div>';
  }
  function nextBtn(label) {
    return '<div class="btn-row" style="justify-content:flex-start">' +
      '<button class="btn btn-primary" id="next-round">' + I.get('play') + ' ' + (label || 'الجولة التالية') + '</button></div>';
  }

  /* ═══════════ مَن يزيّد؟ ═══════════ */

  function renderBidding(v) {
    var teams = WKM.State.teams();
    if (v.phase === 'bid') {
      D.$('#sc-play').innerHTML = '<div class="wrap"><div class="card">' +
        head(I.get('dice') + ' مَن يزيّد؟', 'زايدوا على عدد ما تستطيعون سرده — أعلى مزايدة تلتزم بالتعداد',
             roundChip() + '<span class="chip ' + v.category.difficulty + '">' + DIFF[v.category.difficulty] + '</span>') +
        '<p class="question">' + D.esc(v.category.title) + '</p>' +
        '<div class="team-list">' + teams.map(function (t) {
          return '<div class="team-row"><span class="idx">' + D.esc(t.name.slice(0, 2)) + '</span>' +
            '<span style="flex:1;min-width:0">' + D.esc(t.name) + '</span>' +
            '<button class="icon-btn bid-step" data-team="' + t.id + '" data-d="-1">−</button>' +
            '<span class="chip bid-val" data-team="' + t.id + '" style="min-width:3.2rem;text-align:center;font-weight:700">' +
              v.bids[t.id] + '</span>' +
            '<button class="icon-btn bid-step" data-team="' + t.id + '" data-d="1">+</button></div>';
        }).join('') + '</div>' +
        '<div class="btn-row"><button class="btn btn-primary btn-lg" id="lock-bids">' +
          I.get('check') + ' اعتمد المزايدة وابدأ التعداد</button></div>' +
        '<div id="bid-msg"></div></div></div>';
      D.show('sc-play');
      return;
    }
    // طور التعداد
    var team = WKM.State.team(v.winner);
    D.$('#sc-play').innerHTML = '<div class="wrap"><div class="card">' +
      head(I.get('flag') + ' ' + D.esc(team.name), 'التزم بتعداد ' + v.bid + ' عنصراً خلال ' +
           cfg.timers.bidding_count + ' ثانية', roundChip() + timerMarkup()) +
      '<p class="question">' + D.esc(v.category.title) + '</p>' +
      '<div class="team-row"><input class="input" id="bid-entry" placeholder="اكتب عنصراً ثم اضغط Enter" autocomplete="off">' +
        '<button class="btn" id="bid-add">' + I.get('plus') + ' أضف</button></div>' +
      '<div id="bid-progress" style="margin-top:var(--sp-3)">' + progressMarkup(v) + '</div>' +
      '<div class="btn-row" style="justify-content:flex-start">' +
        '<button class="btn" id="bid-stop">' + I.get('flag') + ' أنهيت التعداد</button></div>' +
      '</div></div>';
    D.show('sc-play');
    timer.start(cfg.timers.bidding_count);
    var inp = D.$('#bid-entry'); if (inp) inp.focus();
  }

  function progressMarkup(v) {
    var chips = v.entries.map(function (e) {
      var color = e.ok ? 'var(--color-success)' : 'var(--color-danger)';
      return '<span class="chip" style="border-color:' + color + ';color:' + color + '">' +
        (e.ok ? '✓ ' : '✕ ') + D.esc(e.text) + (e.dup ? ' (مكرر)' : '') + '</span>';
    }).join(' ');
    return '<div class="meta">أُحصيت <strong style="color:var(--color-primary);font-size:1.3em">' +
      v.count + '</strong> من ' + v.bid + '</div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem">' + chips + '</div>';
  }

  function revealBidding(res) {
    timer.stop();
    var who = res.awardedTo ? WKM.State.team(res.awardedTo) : null;
    var verdict = res.success ? 'نجح التعداد' : 'لم يكتمل التعداد — النقاط للمنافس';
    D.$('#sc-play').insertAdjacentHTML('beforeend', '');
    var box = '<div class="reveal ' + (res.success ? 'good' : 'bad') + '">' +
      '<div class="verdict">' + I.get(res.success ? 'check' : 'x') + ' ' + verdict +
        (who ? ' <span style="color:var(--color-primary)">(+' + res.points + ' لـ' + D.esc(who.name) + ')</span>' : '') + '</div>' +
      '<div style="margin:.4rem 0"><strong>سُرد ' + res.matchedCount + ' من ' + res.bid + ':</strong> ' +
        (res.matchedNames.length ? D.esc(res.matchedNames.join('، ')) : '—') + '</div>' +
      (res.missed.length ? '<div class="why"><strong>بقية القائمة (' + res.missed.length + '):</strong> ' +
        D.esc(res.missed.join('، ')) + '</div>' : '') +
      (res.category.note ? '<div class="note">' + D.esc(res.category.note) + '</div>' : '') +
      srcLine(res.category.source) + nextBtn() + '</div>';
    var card = D.$('#sc-play .card');
    card.insertAdjacentHTML('beforeend', box);
    D.$$('#bid-entry, #bid-add, #bid-stop').forEach(function (e) { e.disabled = true; });
    if (WKM.Sound) (res.success ? WKM.Sound.correct() : WKM.Sound.wrong());
  }

  /* ═══════════ لَمِّح إليّ ═══════════ */

  function renderHints(v) {
    var kw = v.keywords.map(function (k, i) {
      return '<div class="opt" style="cursor:default"><span class="key">' + (i + 1) + '</span><span>' + D.esc(k) + '</span></div>';
    }).join('');
    var hidden = v.totalKeywords - v.revealed;
    var buzzers = WKM.State.teams().map(function (t) {
      var blocked = v.blocked.indexOf(t.id) !== -1;
      var active = v.buzzed === t.id;
      return '<button class="btn buzz' + (active ? ' btn-primary' : '') + '" data-team="' + t.id + '"' +
        (blocked || v.buzzed ? ' disabled' : '') + '>' + I.get('bulb') + ' ' + D.esc(t.name) +
        (blocked ? ' (جرّب)' : '') + '</button>';
    }).join('');

    D.$('#sc-play').innerHTML = '<div class="wrap"><div class="card">' +
      head(I.get('bulb') + ' لَمِّح إليّ', 'الأسرع في الاستنتاج الصحيح يحصد ' + v.points + ' نقطة',
           roundChip() + '<span class="chip ' + v.difficulty + '">' + DIFF[v.difficulty] + '</span>' + timerMarkup()) +
      '<div class="options">' + kw + '</div>' +
      (hidden > 0 ? '<div class="btn-row" style="justify-content:flex-start">' +
        '<button class="btn btn-sm" id="reveal-kw">' + I.get('plus') + ' اكشف كلمة أخرى (' + hidden + ' متبقية)</button></div>' : '') +
      (v.extraUsed ? '<div class="reveal"><strong>تلميح إضافي:</strong> ' + D.esc(v.extraHint) + '</div>' : '') +
      '<div class="cards-bar">' +
        '<div class="label">' + (v.buzzed ? 'الفريق الذي ضغط: <strong>' + D.esc(WKM.State.team(v.buzzed).name) +
          '</strong> — احكم على إجابته:' : 'اضغط زرّ فريقك فور معرفة الإجابة:') + '</div>' +
        (v.buzzed
          ? '<button class="btn hint-judge" data-ok="1" style="border-color:var(--color-success)">' +
              I.get('check') + ' أجاب صح</button>' +
            '<button class="btn hint-judge" data-ok="0" style="border-color:var(--color-danger)">' +
              I.get('x') + ' أجاب خطأ</button>'
          : buzzers +
            (v.hasExtra && !v.extraUsed ? '<button class="helpcard" id="extra-hint">' + I.get('help') +
              ' تلميح إضافي (−' + cfg.points.hint.extra_hint_penalty + ')</button>' : '')) +
      '</div></div></div>';
    D.show('sc-play');
    if (!timer.isRunning()) timer.start(cfg.timers.hint);
  }

  function revealHints(res) {
    timer.stop();
    var who = res.awardedTo ? WKM.State.team(res.awardedTo) : null;
    D.$('#sc-play .card').insertAdjacentHTML('beforeend',
      '<div class="reveal ' + (res.correct ? 'good' : 'bad') + '">' +
        '<div class="verdict">' + I.get(res.correct ? 'check' : 'x') + ' ' +
          (res.correct ? 'استنتاج صحيح' : (res.timedOut ? 'انتهى الوقت' : 'لم يُصب أحد')) +
          (who ? ' <span style="color:var(--color-primary)">(+' + res.points + ' لـ' + D.esc(who.name) + ')</span>' : '') + '</div>' +
        '<div style="margin:.3rem 0"><strong>الإجابة:</strong> ' + D.esc(res.answer) + '</div>' +
        srcLine(res.card.source) + nextBtn() + '</div>');
    D.$$('.buzz, .hint-judge, #reveal-kw, #extra-hint').forEach(function (e) { e.disabled = true; });
    if (WKM.Sound) (res.correct ? WKM.Sound.correct() : WKM.Sound.wrong());
  }

  /* ═══════════ اسأل وجاوب ═══════════ */

  function renderQA(v) {
    var q = v.question;
    var body;
    if (v.showOptions) {
      var opts = q.type === 'tf' ? ['صحيح', 'خطأ'] : q.options;
      body = '<div class="options">' + opts.map(function (o, i) {
        return '<button class="opt qa-opt' + (v.removed.indexOf(i) !== -1 ? ' gone' : '') + '" data-i="' + i + '">' +
          '<span class="key">' + KEYS[i] + '</span><span>' + D.esc(o) + '</span></button>';
      }).join('') + '</div>';
    } else {
      body = '<p class="section-note" style="text-align:right;margin:0 0 var(--sp-4)">' +
        'سؤال مباشر — يجيب الفريق شفهياً، والحَكَم يحكم:</p>' +
        '<div class="btn-row" style="justify-content:flex-start;margin:0">' +
          '<button class="btn qa-verdict" data-ok="1" style="border-color:var(--color-success)">' +
            I.get('check') + ' أجاب صح</button>' +
          '<button class="btn qa-verdict" data-ok="0" style="border-color:var(--color-danger)">' +
            I.get('x') + ' أجاب خطأ</button></div>';
    }
    var icons = { options: 'options', ask_help: 'help', fifty: 'fifty' };
    var cards = cfg.cards.qa.map(function (c) {
      var has = WKM.Cards.has(v.team, 'qa', c);
      var dis = !has || (c === 'options' && v.showOptions) || (c === 'fifty' && (!v.showOptions || q.type !== 'mcq'));
      return '<button class="helpcard qa-card" data-card="' + c + '"' + (dis ? ' disabled' : '') + '>' +
        I.get(icons[c]) + ' ' + WKM.Cards.LABELS[c] + '</button>';
    }).join('');

    var origin = v.from === 'journey' ? 'سؤال محطة' : 'سؤال مباشر';
    D.$('#sc-play').innerHTML = '<div class="wrap"><div class="card">' +
      head(I.get('flag') + ' ' + D.esc(v.team.name), origin + ' — ' + cfg.title,
           roundChip() + '<span class="chip ' + v.difficulty + '">' + DIFF[v.difficulty] + ' · ' + v.points + ' نقطة</span>' +
           timerMarkup()) +
      '<p class="question">' + D.esc(q.text) + '</p>' + body +
      (v.hintShown ? '<div class="reveal"><strong>مساعدة:</strong> ' + D.esc(v.hint) +
        ' <span class="mini">(+30 ثانية)</span></div>' : '') +
      '<div class="cards-bar" id="qa-cards"><div class="label">كروت ' + D.esc(v.team.name) +
        ' (كل كرت مرة واحدة):</div>' + cards + '<div id="qa-msg"></div></div>' +
      '</div></div>';
    D.show('sc-play');
    if (!timer.isRunning()) timer.start(cfg.timers.question + (v.extraTime || 0));
  }

  function revealQA(res, v) {
    timer.stop();
    var q = res.question;
    var correctText = q.type === 'tf' ? (q.answer ? 'صحيح' : 'خطأ') : q.options[q.answer];
    if (v.showOptions) {
      D.$$('.qa-opt').forEach(function (b) {
        var i = +b.dataset.i;
        var right = q.type === 'tf' ? (i === 0) === (q.answer === true) : i === q.answer;
        if (right) b.classList.add('correct');
        else if (i === res.picked) b.classList.add('wrong');
        b.disabled = true;
      });
    }
    D.$$('.qa-verdict, .qa-card').forEach(function (b) { b.disabled = true; });
    if (WKM.Sound) (res.correct ? WKM.Sound.correct() : WKM.Sound.wrong());
    var who = res.awardedTo ? WKM.State.team(res.awardedTo) : null;
    D.$('#sc-play .card').insertAdjacentHTML('beforeend',
      '<div class="reveal ' + (res.correct ? 'good' : 'bad') + '">' +
        '<div class="verdict">' + I.get(res.correct ? 'check' : 'x') + ' ' +
          (res.correct ? 'إجابة صحيحة' : (res.timedOut ? 'انتهى الوقت' : 'إجابة غير صحيحة')) +
          (who ? ' <span style="color:var(--color-primary)">(+' + res.points + ' لـ' + D.esc(who.name) + ')</span>' : '') + '</div>' +
        '<div style="margin:.3rem 0"><strong>الإجابة:</strong> ' + D.esc(correctText) + '</div>' +
        (q.explanation ? '<div class="why">' + D.esc(q.explanation) + '</div>' : '') +
        (q.note ? '<div class="note">' + D.esc(q.note) + '</div>' : '') +
        srcLine(q.source) + nextBtn() + '</div>');
  }

  /* ═══════════ منظّم الجولات ═══════════ */

  function startMode(mode) {
    flow.mode = mode; flow.round = 0;
    WKM.Bidding.reset(); WKM.Hints.reset(); WKM.QA.reset(); WKM.Mixed.reset();
    var teams = WKM.State.teams().length;
    /* مَن يزيّد؟ ولَمِّح إليّ بلا كروت؛ واسأل وجاوب والشامل بكروت اسأل وجاوب */
    WKM.State.setCardGames(mode === 'bidding' || mode === 'hints' ? [] : ['qa']);
    if (mode === 'bidding') flow.total = cfg.rounds.bidding;
    else if (mode === 'hints') flow.total = cfg.rounds.hints;
    else if (mode === 'qa') flow.total = teams * cfg.rounds.qa_per_team;
    else if (mode === 'mixed') { WKM.Mixed.build(cfg, WKM.State.get().seed); flow.total = cfg.rounds.mixed; }
    nextRound();
  }

  function nextRound() {
    timer.stop();
    if (flow.round >= flow.total) { WKM.Screens.renderResults(); return; }
    flow.round += 1;
    var game = flow.mode;
    if (flow.mode === 'mixed') {
      var m = WKM.Mixed.next();
      game = m ? m.game : 'qa';
    }
    flow.game = game;
    var seed = WKM.State.get().seed + flow.round;
    var r;
    if (game === 'bidding') {
      r = WKM.Bidding.start(cfg, seed);
      if (r.type === 'exhausted') return skip('نفدت تصنيفات المزايدة');
      renderBidding(r.view);
    } else if (game === 'hints') {
      r = WKM.Hints.start(cfg, seed);
      if (r.type === 'exhausted') return skip('نفدت بطاقات التلميح');
      renderHints(r.view);
    } else {
      var team = WKM.State.current(); WKM.State.nextTurn();
      r = WKM.QA.start(cfg, seed, team.id, null, { game: game === 'journey' ? 'journey' : 'qa' });
      if (r.type === 'exhausted') return skip('نفدت الأسئلة المباشرة');
      renderQA(r.view);
    }
  }

  function skip(msg) {
    D.$('#sc-play').innerHTML = '<div class="wrap"><div class="card"><h3>' + D.esc(msg) + '</h3>' +
      '<p>سيُوسَّع البنك في المرحلة M7.</p>' + nextBtn('تجاوز') + '</div></div>';
    D.show('sc-play');
  }

  function onTimeout() {
    if (flow.game === 'bidding' && !WKM.Bidding.isDone()) revealBidding(WKM.Bidding.finish());
    else if (flow.game === 'hints' && !WKM.Hints.isDone()) revealHints(WKM.Hints.timeout());
    else if (!WKM.QA.isDone()) {
      var v = WKM.QA.view(); if (!v) return;
      revealQA(WKM.QA.answer(null, true), v);
    }
  }

  return { init: init, startMode: startMode, nextRound: nextRound,
           renderBidding: renderBidding, revealBidding: revealBidding, progressMarkup: progressMarkup,
           renderHints: renderHints, revealHints: revealHints,
           renderQA: renderQA, revealQA: revealQA,
           timer: function () { return timer; }, flow: function () { return flow; } };
})();

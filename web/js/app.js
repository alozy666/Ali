/* قشرة التطبيق — المرحلة M3: تهيئة المحرّك وعرض حالة البنك. الواجهة الكاملة في M4 */
(function () {
  var $ = function (sel) { return document.querySelector(sel); };

  function stationsPath(config) {
    return config.stations.map(function (s, i) {
      var cls = i === 0 ? 'node first' : (i === config.stations.length - 1 ? 'node last' : 'node');
      return '<span class="' + cls + '">' + s.name + '</span>' +
             (i < config.stations.length - 1 ? '<span class="sep">◂</span>' : '');
    }).join('');
  }

  function selfCheck(data) {
    var items = [];
    function t(label, cond) { items.push({ label: label, ok: !!cond }); }
    try {
      var total = WKM.Bank.load(data);
      t('تحميل بنك الأسئلة (' + total + ' عنصراً)', total > 200);
      WKM.State.init(data.config, ['فريق تجريبي أ', 'فريق تجريبي ب'], 'journey', 1);
      t('تهيئة الحالة والفرق والكروت', WKM.State.teams().length === 2);
      var q = WKM.Bank.pick({ game: 'journey', station: 'mecca', difficulty: 'easy' }, WKM.RNG.create(1));
      t('سحب سؤال من محطة مكة', !!q);
      t('مطابقة الإجابات العربية رغم اختلاف الإملاء',
        WKM.Arabic.isCorrect('ابو الفضل العباس', 'أبو الفضل العباس (ع)', []));
      t('احتساب النقاط من الإعدادات', WKM.Score.forQuestion('hard') === data.config.points.difficulty.hard);
      t('كروت المساعدة تعمل مرة واحدة',
        WKM.Cards.use(WKM.State.teams()[0], 'journey', 'swap').ok &&
        !WKM.Cards.use(WKM.State.teams()[0], 'journey', 'swap').ok);
      t('سجلّ منع التكرار' + (WKM.Dedupe.storageAvailable() ? '' : ' (بالذاكرة — التخزين المحلي معطّل)'), true);
    } catch (e) {
      items.push({ label: 'خطأ: ' + e.message, ok: false });
    }
    return items;
  }

  function render(data) {
    var checks = selfCheck(data);   // يُحمّل البنك أولاً ثم تُقرأ الإحصاءات
    var s = WKM.Bank.stats();
    $('#app').innerHTML =
      '<div class="wrap">' +
        '<div class="hero">' +
          '<h1>وَكُن مِنَ العارِفِينَ</h1>' +
          '<p class="lead">طريقٌ من نور يمتدّ من الكعبة المشرفة في مكة إلى القباب الذهبية في سامراء، ' +
          'يحفّه كتابٌ مضمّخ بالأنوار وإسطرلابٌ ذهبي… سبع محطات، وأربع ألعاب، وبنك معرفة موثّق بمصادره.</p>' +
          '<div class="path">' + stationsPath(data.config) + '</div>' +
        '</div>' +
        '<div class="stats">' +
          '<div class="stat"><b>' + s.total + '</b><span>عنصراً في البنك</span></div>' +
          '<div class="stat"><b>' + (s.games.journey || 0) + '</b><span>رحلة السفر</span></div>' +
          '<div class="stat"><b>' + (s.games.qa || 0) + '</b><span>اسأل وجاوب</span></div>' +
          '<div class="stat"><b>' + (s.games.hints || 0) + '</b><span>لَمِّح إليّ</span></div>' +
          '<div class="stat"><b>' + (s.games.bidding || 0) + '</b><span>مَن يزيّد؟</span></div>' +
        '</div>' +
        '<div class="grid">' +
          '<div class="card"><h3>مَن يزيّد؟</h3><p>مزاد على عدد ما تستطيع سرده، ' +
            data.config.timers.bidding_count + ' ثانية للتعداد. الفشل يُحوّل النقاط للمنافس.</p></div>' +
          '<div class="card"><h3>رحلة السفر</h3><p>7 محطات، 3 أسئلة لكل فريق في كل محطة، ' +
            data.config.timers.question + ' ثانية للسؤال، و3 كروت مساعدة.</p></div>' +
          '<div class="card"><h3>لَمِّح إليّ</h3><p>ثلاث كلمات مفتاحية، والأسرع في الاستنتاج الصحيح يحصد النقاط.</p></div>' +
          '<div class="card"><h3>اسأل وجاوب</h3><p>عقائد وفقه وقرآن وتاريخ، ' +
            data.config.timers.question + ' ثانية، و3 كروت: خيارات، ومساعدة، وحذف إجابتين.</p></div>' +
        '</div>' +
        '<div class="check"><strong>فحص المحرّك الذاتي</strong><ul>' +
          checks.map(function (c) { return '<li class="' + (c.ok ? 'ok' : 'no') + '">' + c.label + '</li>'; }).join('') +
        '</ul></div>' +
        '<div class="note">هذه المرحلة <strong>M3</strong>: المحرّك وبنك الأسئلة وأداة البناء. ' +
          'شاشات اللعب الكاملة (تسجيل الفرق، والمؤقّت، والكروت، ولوحة النقاط) تأتي في المرحلتين <strong>M4</strong> و<strong>M5</strong>.</div>' +
      '</div>';
  }

  function fail(msg) {
    $('#app').innerHTML = '<div class="wrap"><div class="note">تعذّر تحميل البيانات: ' + msg +
      '<br>في وضع التطوير شغّل خادماً محلياً، أو استخدم الملف المدموج من مجلد dist.</div></div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    WKM.Data.load().then(render).catch(function (e) { fail(e.message); });
  });
})();

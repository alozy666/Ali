/* مُطبِّع النص العربي ومطابقة الإجابات — وَكُن مِنَ العارِفِينَ */
window.WKM = window.WKM || {};
WKM.Arabic = (function () {
  var TASHKEEL = /[ً-ْٰـ]/g;          // الحركات والتطويل
  var HONORIFIC = /\((?:ع|ص|عج|رض|ره|عليه السلام|صلى الله عليه وآله)\)/g;
  var PUNCT = /[.,،؛;:!؟?"'«»\[\]{}()\-_/\\]/g;

  function normalize(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(HONORIFIC, ' ')
      .replace(TASHKEEL, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(PUNCT, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /* يحذف "ال" التعريف من بداية كل كلمة للمقارنة المتساهلة */
  function stripAl(s) {
    return s.split(' ').map(function (w) {
      return w.length > 3 && w.indexOf('ال') === 0 ? w.slice(2) : w;
    }).join(' ');
  }

  function equals(a, b) {
    var na = normalize(a), nb = normalize(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    return stripAl(na) === stripAl(nb);
  }

  /* هل الإجابة صحيحة؟ يقبل النص الصحيح وكل صيغه البديلة */
  function isCorrect(input, correct, accept) {
    if (equals(input, correct)) return true;
    var list = accept || [];
    for (var i = 0; i < list.length; i++) if (equals(input, list[i])) return true;
    /* تساهل: إن احتوت إجابة اللاعب النص الصحيح كاملاً */
    var ni = stripAl(normalize(input));
    if (ni.length >= 3) {
      var nc = stripAl(normalize(correct));
      if (nc.length >= 3 && ni.indexOf(nc) !== -1) return true;
      for (var j = 0; j < list.length; j++) {
        var na = stripAl(normalize(list[j]));
        if (na.length >= 3 && ni.indexOf(na) !== -1) return true;
      }
    }
    return false;
  }

  /* يطابق مدخلاً واحداً مع قائمة عناصر (لعبة مَن يزيّد؟) ويعيد الفهرس أو -1 */
  function matchItem(input, items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var name = typeof it === 'string' ? it : it.name;
      var aliases = typeof it === 'string' ? [] : (it.aliases || []);
      if (isCorrect(input, name, aliases)) return i;
    }
    return -1;
  }

  return { normalize: normalize, stripAl: stripAl, equals: equals, isCorrect: isCorrect, matchItem: matchItem };
})();

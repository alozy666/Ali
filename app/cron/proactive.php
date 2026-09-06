<?php

declare(strict_types=1);

// التشغيل الاستباقي — «العقل النشط» (قسم ٤ و١٢ و٣٦).
//
// هذا الملف هو جوهر الإجابة على سؤال «هل ينفع بدون VPS؟».
// وثيقتك افترضت أن الاستباقية تحتاج خدمة دائمة ٢٤/٧، لكن قسم ٣٦ حسم أن
// التشغيل يكون «مرتان يومياً (صباح ومساء) + عند أحداث محددة — لا فحص مستمر
// كل ساعة». ومرتان يومياً وظيفة cron، لا خدمة دائمة. والاستضافة المشتركة
// شغّالة ٢٤/٧ سواء كان جهازك مفتوحاً أو لا.
//
// إعداد cron:
//   0 6 * * *   /usr/bin/php /home/USER/lifeos/app/cron/proactive.php morning
//   0 20 * * *  /usr/bin/php /home/USER/lifeos/app/cron/proactive.php evening

require dirname(__DIR__) . '/autoload.php';

use App\Kernel;

$mode = $argv[1] ?? 'morning';
$kernel = Kernel::boot();

// السقف الصارم (قسم ٣٦): عند الاقتراب من حد الميزانية يتوقف الاستباقي وحده.
// الترتيب مقصود — الالتقاط والرد المباشر يبقيان، لأن أسوأ ما يحصل أن تفقد
// المبادرة لا أن تعجز عن تسجيل ملاحظة.
if ($kernel->costs()->budgetExceeded()) {
    printf(
        "[%s] تخطّي التشغيل الاستباقي — التكلفة الشهرية %.2f\$ قاربت السقف\n",
        date('Y-m-d H:i:s'),
        $kernel->costs()->monthToDateUsd(),
    );
    exit(0);
}

$questions = $kernel->questions();
$stats = $kernel->queue()->stats();

// ── الإيجاز الصباحي (قسم ١٢) ────────────────────────────────────────────
// «بدل انتظاره يفتح التطبيق، مهمة مجدولة تولّد ملخص شاشة اليوم وتدفعه له».
//
// المرحلة ١ تكتفي بملخص واقعي من الحالة الفعلية بلا استدعاء نموذج. توليد
// ملخص ذكي يحتاج شبكة معرفية فيها محتوى — وهي فاضية أول أسبوعين. الدفع
// المبكر لملخص فاضٍ يعلّمك تجاهل الإشعار، وهو أسوأ ضرر ممكن على ميزة
// قيمتها كلها بأن تُقرأ.
//
// عند امتلاء الشبكة، هنا يُستبدل النص بمخرج نموذج فوق الاسترجاع
// ($kernel->retriever() ثم $kernel->llm() بطبقة standard).

$openQuestions = $questions->openCount();

$lines = [];

if ($mode === 'morning') {
    $title = 'إيجاز الصباح';
    $lines[] = 'صباح الخير.';
} else {
    $title = 'إيجاز المساء';
    $lines[] = 'مساء الخير.';
}

if ($openQuestions > 0) {
    $lines[] = "عندك {$openQuestions} سؤال معلّق ينتظر قرارك.";
}

if ($stats['pending'] > 0) {
    $lines[] = "{$stats['pending']} مدخل بالطابور قيد المعالجة.";
}

if ($stats['failed'] > 0) {
    $lines[] = "تنبيه: {$stats['failed']} مهمة فاشلة تحتاج مراجعة.";
}

if (count($lines) === 1) {
    $lines[] = 'لا شيء يحتاج قرارك الآن.';
}

$body = implode(' ', array_slice($lines, 1));

$delivered = $kernel->push()->send($title, $body, ['mode' => $mode]);

printf(
    "[%s] %s — أُرسل إلى %d جهاز | التكلفة هذا الشهر: %.2f\$\n",
    date('Y-m-d H:i:s'),
    $title,
    $delivered,
    $kernel->costs()->monthToDateUsd(),
);

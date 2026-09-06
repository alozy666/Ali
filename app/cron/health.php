<?php

declare(strict_types=1);

// فحص الصحة الأسبوعي (قسم ٣٨).
//
// إعداد cron:
//   0 4 * * 0  /usr/bin/php /home/USER/lifeos/app/cron/health.php
//
// الثغرة التي يسدّها: مراقبة السلوك الغريب (قسم ٢٠) واختبار الجودة (قسم ٢١)
// لا يغطيان الصحة التشغيلية — وهذي تفشل بهدوء ولا تُكتشف إلا وقت الحاجة،
// وهو أسوأ توقيت. نسخة احتياطية توقفت قبل شهر تبدو كلا شيء حتى تحتاجها.

require dirname(__DIR__) . '/autoload.php';

use App\Kernel;
use App\Support\Config;

$kernel = Kernel::boot();
$pdo = $kernel->pdo();

$report = [];
$alerts = [];

// ١. النسخ الاحتياطي نُفِّذ فعلاً؟
$backupDir = (string) Config::get('runtime.storage_path', dirname(__DIR__) . '/storage') . '/backups';
$backups = glob("{$backupDir}/dump_*.sql.enc") ?: [];
$latestBackup = $backups === [] ? null : max(array_map('filemtime', $backups));

if ($latestBackup === null) {
    $alerts[] = 'لا توجد أي نسخة احتياطية.';
} elseif ($latestBackup < strtotime('-2 days')) {
    $alerts[] = 'آخر نسخة احتياطية أقدم من يومين: ' . date('Y-m-d', $latestBackup);
} else {
    $report[] = 'النسخ الاحتياطي: ' . date('Y-m-d H:i', $latestBackup);
}

// ٢. الطابور سليم؟
$stats = $kernel->queue()->stats();
$report[] = "الطابور: {$stats['pending']} منتظرة، {$stats['failed']} فاشلة";

if ($stats['failed'] > 0) {
    $alerts[] = "{$stats['failed']} مهمة فاشلة — مدخلات لم تدخل الشبكة المعرفية.";
}

// ٣. حجم الشبكة وزمن الاسترجاع (قسم ٣١: نمو البيانات على المدى الطويل)
$entities = (int) $pdo->query('SELECT COUNT(*) FROM entities')->fetchColumn();
$edges = (int) $pdo->query('SELECT COUNT(*) FROM edges')->fetchColumn();

$startedAt = microtime(true);
$kernel->retriever()->retrieve('اختبار زمن الاسترجاع');
$retrievalMs = (microtime(true) - $startedAt) * 1000;

$report[] = sprintf('الشبكة: %d عقدة، %d علاقة', $entities, $edges);
$report[] = sprintf('زمن الاسترجاع: %.0f مللي ثانية', $retrievalMs);

// العتبة إنذار مبكر لا حد أقصى: قسم ٣١ يقترح التلخيص التدريجي حين تصير
// الاستراتيجية لازمة فعلياً، «بدل تطبيقها مبكراً بلا داعٍ».
if ($retrievalMs > 500) {
    $alerts[] = sprintf('الاسترجاع بطيء (%.0f ms) — راجع استراتيجية التلخيص التدريجي.', $retrievalMs);
}

// ٤. التكلفة ضمن السقف (قسم ٣٦)
$spent = $kernel->costs()->monthToDateUsd();
$budget = (float) Config::get('llm.monthly_budget_usd', 25.0);
$report[] = sprintf('التكلفة هذا الشهر: %.2f$ من %.2f$', $spent, $budget);

if ($spent > $budget * 0.8) {
    $alerts[] = sprintf('التكلفة بلغت %.0f%% من السقف.', ($spent / max($budget, 0.01)) * 100);
}

// ٥. أسئلة معلّقة متراكمة — إشارة أن النظام يسأل أكثر مما ينفع (قسم ٢٠)
$open = $kernel->questions()->openCount();
$report[] = "أسئلة معلّقة: {$open}";

if ($open > 20) {
    $alerts[] = "{$open} سؤالاً معلّقاً — النظام يسأل أكثر مما يفيد.";
}

// ٦. مقياس النجاح الأساسي (قسم ٣٣): عدد الأفعال الروتينية المنفَّذة تلقائياً
// أسبوعياً. يجب أن يرتفع مع الوقت؛ ثباته أو انخفاضه إنذار مبكر بأن النظام
// لا يتعلم الاستقلال — قبل أن يفقد صاحبه الحماس.
$autoActions = (int) $pdo->query(
    "SELECT COUNT(*) FROM actions
     WHERE decision = 'executed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
)->fetchColumn();

$report[] = "أفعال تلقائية هذا الأسبوع: {$autoActions}";

$title = $alerts === [] ? 'الفحص الأسبوعي: كل شيء سليم' : 'الفحص الأسبوعي: ' . count($alerts) . ' تنبيه';
$body = implode("\n", [...$alerts, ...$report]);

echo "[" . date('Y-m-d H:i:s') . "] {$title}\n{$body}\n";

$kernel->push()->send($title, implode(' | ', $alerts === [] ? $report : $alerts));

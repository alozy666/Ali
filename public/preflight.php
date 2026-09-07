<?php

declare(strict_types=1);

/**
 * فحص جاهزية الاستضافة — بوابة م٠.
 *
 * ملف مستقل تماماً: لا يعتمد على autoload ولا Composer ولا أي شيء بالمشروع،
 * لأنه يعمل **قبل** أن يُركَّب شيء. ارفعه وحده لجذر الموقع وافتحه بالمتصفح.
 *
 * ⚠ احذفه بعد الفحص. لا يعرض أسراراً، لكنه يكشف تفاصيل بيئتك لأي زائر.
 *
 * التشغيل: افتحه بالمتصفح، أو عبر SSH:  php preflight.php
 */

// ═══════════════════════════════════════════════════════════════════
// أدوات الفحص
// ═══════════════════════════════════════════════════════════════════

/** @var list<array{status:string,name:string,detail:string,fatal:bool}> */
$results = [];

const OK = 'ok';
const WARN = 'warn';
const FAIL = 'fail';

function check(string $status, string $name, string $detail, bool $fatal = false): void
{
    global $results;
    $results[] = ['status' => $status, 'name' => $name, 'detail' => $detail, 'fatal' => $fatal];
}

// ═══════════════════════════════════════════════════════════════════
// ١. إصدار PHP
// ═══════════════════════════════════════════════════════════════════

$phpOk = version_compare(PHP_VERSION, '8.1.0', '>=');
check(
    $phpOk ? OK : FAIL,
    'إصدار PHP',
    PHP_VERSION . ($phpOk ? '' : ' — المطلوب ٨.١ فأعلى. غيّره من hPanel'),
    fatal: true
);

// ═══════════════════════════════════════════════════════════════════
// ٢. الامتدادات المطلوبة
// ═══════════════════════════════════════════════════════════════════

$extensions = [
    'pdo_mysql' => 'الاتصال بقاعدة البيانات',
    'json'      => 'ترميز الحقول المرنة',
    'mbstring'  => 'معالجة النصوص العربية',
    'curl'      => 'الاتصال بـ Claude وDeepgram',
    'sodium'    => 'تشفير الحقول الحساسة (قسم ٩)',
];

foreach ($extensions as $ext => $why) {
    $loaded = extension_loaded($ext);
    check(
        $loaded ? OK : FAIL,
        "امتداد {$ext}",
        $loaded ? $why : "غير محمّل — {$why}",
        fatal: true
    );
}

// ═══════════════════════════════════════════════════════════════════
// ٣. حدود التشغيل — تحدد حجم دفعة الطابور
// ═══════════════════════════════════════════════════════════════════

$maxExec = (int) ini_get('max_execution_time');

if ($maxExec === 0) {
    check(OK, 'مهلة التنفيذ', 'بلا حد (وضع CLI غالباً)');
} elseif ($maxExec >= 30) {
    $batch = max(1, (int) floor(($maxExec * 0.7) / 8));
    check(OK, 'مهلة التنفيذ', "{$maxExec} ثانية — اضبط queue_batch_size ≈ {$batch}");
} else {
    check(WARN, 'مهلة التنفيذ', "{$maxExec} ثانية — قصيرة. اضبط queue_batch_size = 1");
}

check(OK, 'حد الذاكرة', (string) ini_get('memory_limit'));

// ═══════════════════════════════════════════════════════════════════
// ٤. الاتصالات الصادرة — البند الحاسم
// ═══════════════════════════════════════════════════════════════════
//
// أي رمز HTTP (حتى 401) يعني أن الطلب وصل والشبكة سالكة.
// الفشل هو 0 مع خطأ اتصال.

$endpoints = [
    'api.anthropic.com' => 'https://api.anthropic.com/v1/models',
    'api.deepgram.com'  => 'https://api.deepgram.com/v1/projects',
];

foreach ($endpoints as $host => $url) {
    $ch = curl_init($url);

    if ($ch === false) {
        check(FAIL, "الاتصال بـ {$host}", 'تعذّر تهيئة cURL', fatal: true);
        continue;
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_NOBODY => true,
    ]);

    $started = microtime(true);
    curl_exec($ch);
    $ms = (int) ((microtime(true) - $started) * 1000);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($code > 0) {
        check(OK, "الاتصال بـ {$host}", "سالك — رمز {$code}، زمن {$ms}ms");
    } else {
        check(
            FAIL,
            "الاتصال بـ {$host}",
            "محجوب: {$err} — راسل دعم هوستنقر لفتح النطاق، وإلا انتقل لـ VPS (ق-١)",
            fatal: true
        );
    }
}

// ═══════════════════════════════════════════════════════════════════
// ٥. قاعدة البيانات — تُفحص فقط إن وُجد ملف إعدادات
// ═══════════════════════════════════════════════════════════════════

$configPaths = [
    __DIR__ . '/../app/config/config.php',
    __DIR__ . '/../lifeos/app/config/config.php',
];

$config = null;
foreach ($configPaths as $p) {
    if (is_file($p)) {
        /** @var array<string,mixed> $config */
        $config = require $p;
        break;
    }
}

if (!is_array($config) || !isset($config['db'])) {
    check(WARN, 'قاعدة البيانات', 'لم يُفحص — أنشئ app/config/config.php ثم أعد التشغيل');
} else {
    $db = $config['db'];

    try {
        $pdo = new PDO(
            sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $db['host'] ?? 'localhost',
                (int) ($db['port'] ?? 3306),
                $db['name'] ?? ''
            ),
            (string) ($db['user'] ?? ''),
            (string) ($db['pass'] ?? ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );

        $version = (string) $pdo->query('SELECT VERSION()')->fetchColumn();
        $major = (int) $version;

        check(
            $major >= 8 ? OK : FAIL,
            'إصدار MySQL',
            $version . ($major >= 8 ? '' : ' — المطلوب ٨.٠ فأعلى لأجل WITH RECURSIVE'),
            fatal: $major < 8
        );

        // التنقل عبر العلاقات يعتمد على هذي كلياً — تُختبر لا تُفترض
        try {
            $cte = $pdo->query(
                'WITH RECURSIVE t (n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM t WHERE n < 3)
                 SELECT SUM(n) FROM t'
            )->fetchColumn();

            check(
                (int) $cte === 6 ? OK : FAIL,
                'WITH RECURSIVE',
                (int) $cte === 6 ? 'يعمل — التنقل عبر العلاقات مدعوم' : 'نتيجة غير متوقعة',
                fatal: (int) $cte !== 6
            );
        } catch (Throwable $e) {
            check(FAIL, 'WITH RECURSIVE', 'غير مدعوم: ' . $e->getMessage(), fatal: true);
        }

        // اختبار ذهاب وعودة للعربية — يكشف سوء ضبط الترميز قبل أن يفسد
        // الشبكة المعرفية بصمت. النص المشكّل هو الحالة الأصعب.
        try {
            $pdo->exec('CREATE TEMPORARY TABLE _pf (v VARCHAR(64)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
            $sample = 'ناشِر — زينب ٢٠٢٦';
            $ins = $pdo->prepare('INSERT INTO _pf (v) VALUES (?)');
            $ins->execute([$sample]);
            $back = (string) $pdo->query('SELECT v FROM _pf')->fetchColumn();
            $pdo->exec('DROP TEMPORARY TABLE _pf');

            check(
                $back === $sample ? OK : FAIL,
                'ترميز العربية',
                $back === $sample
                    ? 'utf8mb4 سليم — النص المشكّل يعود كما دخل'
                    : "تلف بالترميز: أُدخل «{$sample}» وعاد «{$back}»",
                fatal: $back !== $sample
            );
        } catch (Throwable $e) {
            check(WARN, 'ترميز العربية', 'تعذّر الفحص: ' . $e->getMessage());
        }

        // نوع JSON — مرونة الخصائص تعتمد عليه (ق-٣)
        try {
            $pdo->query("SELECT JSON_EXTRACT('{\"a\":1}', '$.a')")->fetchColumn();
            check(OK, 'نوع JSON', 'مدعوم — مرونة خصائص العقد');
        } catch (Throwable) {
            check(FAIL, 'نوع JSON', 'غير مدعوم', fatal: true);
        }
    } catch (Throwable $e) {
        check(FAIL, 'الاتصال بقاعدة البيانات', $e->getMessage(), fatal: true);
    }
}

// ═══════════════════════════════════════════════════════════════════
// ٦. فحص أمني: هل app/ مكشوف على الويب؟
// ═══════════════════════════════════════════════════════════════════
//
// أهم إجراء أمني بالمشروع (ق-١٥). نتحقق منه بطلب فعلي لا بافتراض.

if (PHP_SAPI !== 'cli' && isset($_SERVER['HTTP_HOST'])) {
    $scheme = (($_SERVER['HTTPS'] ?? '') === 'on') ? 'https' : 'http';
    $base = $scheme . '://' . $_SERVER['HTTP_HOST'];
    $exposed = [];

    foreach (['/app/config/config.php', '/app/config/config.sample.php', '/app/autoload.php'] as $path) {
        $ch = curl_init($base . $path);

        if ($ch === false) {
            continue;
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_NOBODY => true,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($code === 200) {
            $exposed[] = $path;
        }
    }

    check(
        $exposed === [] ? OK : FAIL,
        'عزل مجلد app/',
        $exposed === []
            ? 'غير مكشوف على الويب — سليم'
            : '⛔ مكشوف: ' . implode('، ', $exposed) . ' — انقل app/ خارج جذر الموقع فوراً',
        fatal: $exposed !== []
    );
} else {
    check(WARN, 'عزل مجلد app/', 'لا يُفحص من سطر الأوامر — افتح الملف بالمتصفح');
}

// ═══════════════════════════════════════════════════════════════════
// ٧. مجلدات التخزين
// ═══════════════════════════════════════════════════════════════════

$storage = null;
foreach ([__DIR__ . '/../app/storage', __DIR__ . '/../lifeos/app/storage'] as $p) {
    if (is_dir($p)) {
        $storage = $p;
        break;
    }
}

if ($storage === null) {
    check(WARN, 'مجلد التخزين', 'غير موجود — يُنشأ عند أول رفع للمشروع');
} else {
    $writable = is_writable($storage);
    check(
        $writable ? OK : FAIL,
        'مجلد التخزين',
        $writable ? 'قابل للكتابة' : "غير قابل للكتابة: {$storage} — نفّذ chmod 700"
    );
}

// ═══════════════════════════════════════════════════════════════════
// ٨. المنطقة الزمنية — تؤثر على جدولة cron والإيجاز الصباحي
// ═══════════════════════════════════════════════════════════════════

check(
    OK,
    'وقت السيرفر',
    date('Y-m-d H:i:s') . ' (' . date_default_timezone_get() . ') — قارنه بوقتك المحلي'
);

// ═══════════════════════════════════════════════════════════════════
// الحكم النهائي
// ═══════════════════════════════════════════════════════════════════

$fatals = array_filter($results, static fn (array $r): bool => $r['status'] === FAIL && $r['fatal']);
$fails = array_filter($results, static fn (array $r): bool => $r['status'] === FAIL);
$warns = array_filter($results, static fn (array $r): bool => $r['status'] === WARN);

$passed = $fatals === [];

$verdict = $passed
    ? ($warns === [] ? 'م٠ مجتازة — ابدأ م١' : 'م٠ مجتازة مع تنبيهات — راجعها ثم ابدأ م١')
    : 'م٠ لم تُجتَز — ' . count($fatals) . ' عائق حاسم';

// ═══════════════════════════════════════════════════════════════════
// العرض
// ═══════════════════════════════════════════════════════════════════

$icon = ['ok' => '✅', 'warn' => '⚠️', 'fail' => '❌'];

if (PHP_SAPI === 'cli') {
    echo "\n╔══ فحص جاهزية الاستضافة ══╗\n\n";

    foreach ($results as $r) {
        printf("%s  %-24s %s\n", $icon[$r['status']], $r['name'], $r['detail']);
    }

    printf(
        "\n%s\n%s\n\n",
        str_repeat('─', 60),
        ($passed ? '✅ ' : '❌ ') . $verdict
    );

    if (!$passed) {
        echo "احذف هذا الملف بعد الإصلاح وأعد الرفع.\n\n";
    }

    exit($passed ? 0 : 1);
}

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>فحص جاهزية الاستضافة</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif;
    max-width: 46rem; margin: 0 auto; padding: 1.5rem;
    line-height: 1.7; background: #fbfbfa; color: #1a1a1a;
  }
  @media (prefers-color-scheme: dark) { body { background: #16181c; color: #e8e8e6; } }
  h1 { font-size: 1.35rem; margin-bottom: .25rem; }
  .sub { opacity: .65; font-size: .9rem; margin-bottom: 1.5rem; }
  .verdict { padding: 1rem 1.25rem; border-radius: .6rem; font-weight: 600; margin-bottom: 1.5rem; }
  .pass { background: #e7f5ec; color: #10502c; }
  .nopass { background: #fdeaea; color: #7a1c1c; }
  @media (prefers-color-scheme: dark) {
    .pass { background: #14331f; color: #9fe0b8; }
    .nopass { background: #3a1414; color: #f0a8a8; }
  }
  table { width: 100%; border-collapse: collapse; }
  td { padding: .6rem .5rem; border-bottom: 1px solid rgba(128,128,128,.22); vertical-align: top; }
  td:first-child { width: 1.6rem; }
  .name { font-weight: 600; white-space: nowrap; }
  .detail { opacity: .8; font-size: .9rem; word-break: break-word; }
  .note { margin-top: 1.75rem; padding: .85rem 1.1rem; border-inline-start: 3px solid #c99a2e;
          background: rgba(201,154,46,.09); font-size: .9rem; border-radius: .3rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85em; }
</style>
</head>
<body>
  <h1>فحص جاهزية الاستضافة</h1>
  <div class="sub">بوابة م٠ — Personal Life OS</div>

  <div class="verdict <?= $passed ? 'pass' : 'nopass' ?>">
    <?= $passed ? '✅' : '❌' ?> <?= htmlspecialchars($verdict, ENT_QUOTES, 'UTF-8') ?>
  </div>

  <table>
    <?php foreach ($results as $r): ?>
    <tr>
      <td><?= $icon[$r['status']] ?></td>
      <td class="name"><?= htmlspecialchars($r['name'], ENT_QUOTES, 'UTF-8') ?></td>
      <td class="detail"><?= htmlspecialchars($r['detail'], ENT_QUOTES, 'UTF-8') ?></td>
    </tr>
    <?php endforeach; ?>
  </table>

  <div class="note">
    <strong>احذف <code>preflight.php</code> بعد الفحص.</strong>
    لا يعرض أسراراً، لكنه يكشف تفاصيل بيئتك لأي زائر.
    <?php if (!$passed): ?>
      <br><br>راجع <code>docs/00-decision-no-vps.md</code> ← ق-١ لمعرفة ما يترتب على فشل الاتصالات الصادرة.
    <?php endif; ?>
  </div>
</body>
</html>

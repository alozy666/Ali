<?php

declare(strict_types=1);

// النسخ الاحتياطي المشفّر (قسم ٩ وشرط قسم ٣٧ الثاني).
//
// إعداد cron:
//   0 3 * * *  /usr/bin/php /home/USER/lifeos/app/cron/backup.php
//
// تحذير صريح: هذا السكربت يكتب النسخة على نفس الاستضافة فقط. قسم ٩ يشترط أن
// تكون النسخة «مشفّرة ومنفصلة جغرافياً عن السيرفر الأساسي» — ونسخة تجلس بجانب
// الأصل لا تحميك من فقدان الحساب أو خطأ يمسح المجلد. أكمل الخطوة الثانية
// (الرفع لتخزين خارجي) قبل أن تبدأ التغذية الفعلية، لا بعدها: تتراكم أسابيع
// من بياناتك الشخصية العميقة بمكان واحد، وأي عطل يعني إعادة التأسيس من الصفر.

require dirname(__DIR__) . '/autoload.php';

use App\Support\Config;

Config::all();

$storage = (string) Config::get('runtime.storage_path', dirname(__DIR__) . '/storage');
$dir = $storage . '/backups';

if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
    fwrite(STDERR, "تعذّر إنشاء مجلد النسخ: {$dir}\n");
    exit(1);
}

$stamp = date('Y-m-d_His');
$plain = "{$dir}/dump_{$stamp}.sql";

// mysqldump متاح على أغلب خطط الاستضافة عبر SSH/cron. إن لم يكن متاحاً بخطتك،
// البديل تصدير عبر PHP بجولة على الجداول — أبطأ لكنه يعمل دائماً.
$command = sprintf(
    'mysqldump --host=%s --port=%d --user=%s --password=%s --single-transaction --default-character-set=utf8mb4 %s > %s 2>&1',
    escapeshellarg((string) Config::get('db.host', 'localhost')),
    (int) Config::get('db.port', 3306),
    escapeshellarg((string) Config::require('db.user')),
    escapeshellarg((string) Config::get('db.pass', '')),
    escapeshellarg((string) Config::require('db.name')),
    escapeshellarg($plain),
);

exec($command, $output, $exitCode);

if ($exitCode !== 0 || !is_file($plain) || filesize($plain) === 0) {
    fwrite(STDERR, "فشل mysqldump: " . implode("\n", $output) . "\n");
    exit(1);
}

// التشفير قبل أي شيء آخر: النسخة غير المشفّرة تحتوي كل شيء دفعة واحدة —
// المالية والعلاقات والحالة النفسية — بلا تشفير الحقول الذي يحمي الجدول الحي.
$key = base64_decode((string) Config::require('security.field_key_base64'), true);

if ($key === false || strlen($key) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES) {
    unlink($plain);
    fwrite(STDERR, "مفتاح التشفير غير صالح — يجب أن يكون 32 بايت بصيغة base64\n");
    exit(1);
}

$nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
$contents = (string) file_get_contents($plain);
$cipher = sodium_crypto_secretbox($contents, $nonce, $key);

$encrypted = "{$dir}/dump_{$stamp}.sql.enc";
file_put_contents($encrypted, $nonce . $cipher);
chmod($encrypted, 0600);

// الحذف الآمن للنسخة الواضحة
sodium_memzero($contents);
unlink($plain);

// الاحتفاظ بآخر ١٤ نسخة محلياً
$backups = glob("{$dir}/dump_*.sql.enc") ?: [];
sort($backups);

foreach (array_slice($backups, 0, max(0, count($backups) - 14)) as $old) {
    unlink($old);
}

printf(
    "[%s] نسخة مشفّرة: %s (%.1f كيلوبايت)\n",
    date('Y-m-d H:i:s'),
    basename($encrypted),
    filesize($encrypted) / 1024,
);

// الخطوة الناقصة — أكملها بنفسك حسب ما يناسبك:
// ارفع $encrypted لتخزين خارجي (Google Drive أو Dropbox أو S3 متوافق)
// عبر API الخدمة. بدونها لا تتحقق «الفصل الجغرافي» المطلوب بقسم ٩.
fwrite(STDERR, "تذكير: النسخة لم تُرفع خارجياً بعد — راجع نهاية backup.php\n");

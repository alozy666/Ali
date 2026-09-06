<?php

declare(strict_types=1);

// مستهلك الطابور — بديل عامل Celery (قسم ٦ و١٠).
//
// إعداد cron المقترح (اضبط الفاصل حسب أقل فاصل تسمح به خطتك):
//   */5 * * * *  /usr/bin/php /home/USER/lifeos/app/cron/worker.php >> /home/USER/lifeos/app/storage/logs/worker.log 2>&1
//
// التشغيل اليدوي للاختبار:
//   php app/cron/worker.php

require dirname(__DIR__) . '/autoload.php';

use App\Kernel;

$kernel = Kernel::boot();
$result = $kernel->worker()->run();

printf(
    "[%s] عولجت: %d | فشلت: %d | مستعادة: %d\n",
    date('Y-m-d H:i:s'),
    $result['processed'],
    $result['failed'],
    $result['recovered'],
);

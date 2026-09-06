<?php

declare(strict_types=1);

namespace App\Providers\Push;

/**
 * الطبقة الوسيطة للتنبيهات (قسم ٣٨).
 *
 * تبدأ بـ Web Push، وتقبل لاحقاً قناة ثانية (تليقرام، إشعار تطبيق أندرويد بعد
 * تغليف Capacitor بقسم ١٤) بلا تغيير أي مستدعٍ.
 */
interface PushProvider
{
    /**
     * @param array<string,mixed> $data حمولة إضافية يقرأها الـ service worker
     * @return int عدد الأجهزة التي وصلها الإشعار
     */
    public function send(string $title, string $body, array $data = []): int;
}

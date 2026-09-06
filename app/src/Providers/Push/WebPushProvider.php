<?php

declare(strict_types=1);

namespace App\Providers\Push;

use App\Support\Config;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use PDO;
use Throwable;

/**
 * إشعارات الويب بمعيار Web Push + VAPID.
 *
 * يتطلب: composer require minishlink/web-push
 *
 * يطبّق ضابط قسم ٢٢ («خطر الإرهاق من كثرة التنبيهات حقيقي»): سقف يومي صارم
 * يُفحص قبل كل إرسال، بغض النظر عن كم إشعار «يستحق» الإرسال نظرياً.
 *
 * ملاحظة تخص iPhone: إشعارات الويب على iOS تعمل فقط بعد إضافة الموقع للشاشة
 * الرئيسية (كتطبيق ويب PWA)، لا من تبويب سفاري عادي. على أندرويد وويندوز
 * تعمل من المتصفح مباشرة. جرّبها على جهازك قبل الاعتماد عليها لتنبيه مهم.
 */
final class WebPushProvider implements PushProvider
{
    public function __construct(
        private readonly PDO $pdo,
    ) {
    }

    public function send(string $title, string $body, array $data = []): int
    {
        if ($this->sentToday() >= (int) Config::get('push.max_per_day', 6)) {
            // ليس خطأً — هذا الضابط يعمل كما صُمّم
            return 0;
        }

        $subscriptions = $this->pdo
            ->query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions')
            ->fetchAll();

        if ($subscriptions === []) {
            return 0;
        }

        $webPush = new WebPush([
            'VAPID' => [
                'subject' => (string) Config::require('push.vapid_subject'),
                'publicKey' => (string) Config::require('push.vapid_public_key'),
                'privateKey' => (string) Config::require('push.vapid_private_key'),
            ],
        ]);

        $payload = json_encode(
            ['title' => $title, 'body' => $body, 'data' => $data],
            JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );

        foreach ($subscriptions as $row) {
            $webPush->queueNotification(
                Subscription::create([
                    'endpoint' => $row['endpoint'],
                    'keys' => ['p256dh' => $row['p256dh'], 'auth' => $row['auth']],
                ]),
                $payload
            );
        }

        $delivered = 0;

        foreach ($webPush->flush() as $report) {
            if ($report->isSuccess()) {
                $delivered++;
                continue;
            }

            // 404/410 = اشتراك منتهٍ. حذفه يمنع تراكم أجهزة ميتة تبطّئ كل إرسال.
            if ($report->isSubscriptionExpired()) {
                $this->forget($report->getEndpoint());
            }
        }

        if ($delivered > 0) {
            $this->logSend($title);
        }

        return $delivered;
    }

    private function sentToday(): int
    {
        $stmt = $this->pdo->query(
            'SELECT COUNT(*) FROM notification_log WHERE day = CURDATE()'
        );

        return $stmt === false ? 0 : (int) $stmt->fetchColumn();
    }

    private function logSend(string $title): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO notification_log (day, title) VALUES (CURDATE(), ?)'
        );
        $stmt->execute([mb_substr($title, 0, 255)]);
    }

    private function forget(string $endpoint): void
    {
        try {
            $stmt = $this->pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
            $stmt->execute([$endpoint]);
        } catch (Throwable) {
            // تنظيف اختياري — فشله لا يبرر إسقاط عملية إرسال ناجحة
        }
    }
}

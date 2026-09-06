<?php

declare(strict_types=1);

namespace App\Queue;

use PDO;

/**
 * الطابور — بديل Celery + Redis (قسم ٦ و١٠).
 *
 * صف بجدول = مهمة، وcron هو المستهلك. الفكرة أن الطابور ليس خدمة دائمة بل
 * جدول تُقرأ منه دفعة كل تشغيل، وهذا بالضبط ما يجعله ممكناً على استضافة
 * مشتركة لا تسمح بعمليات خلفية دائمة.
 *
 * الحد الأقصى للمحاولات ٣ ثم تُعلَّم فاشلة. الفشل الدائم لا يُحذف: المهمة
 * الفاشلة تعني مدخلاً خاماً لم يدخل الشبكة، ولا بد أن يبقى ظاهراً بالفحص
 * الأسبوعي (قسم ٣٨) بدل أن يختفي بصمت.
 */
final class JobQueue
{
    private const MAX_ATTEMPTS = 3;

    public function __construct(
        private readonly PDO $pdo,
    ) {
    }

    /**
     * @param array<string,mixed> $payload
     */
    public function enqueue(string $type, array $payload, int $delaySeconds = 0): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO jobs (type, payload, run_after)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
        );

        $stmt->execute([
            $type,
            json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            max(0, $delaySeconds),
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * يحجز دفعة مهام للتشغيل الحالي.
     *
     * الحجز يتم صفاً صفاً بشرط `status = 'pending'`، ونتحقق من rowCount.
     * السبب: cron قد يتداخل تشغيلان منه إذا طال أحدهما أكثر من الفاصل الزمني،
     * وبلا هذا الشرط ينفّذ التشغيلان نفس المهمة مرتين — أي عقد مكررة بالشبكة.
     *
     * @return list<Job>
     */
    public function claim(int $limit): array
    {
        $limit = max(1, min($limit, 50));

        $candidates = $this->pdo->query(
            "SELECT id, type, payload, attempts
             FROM jobs
             WHERE status = 'pending' AND run_after <= NOW()
             ORDER BY id ASC
             LIMIT {$limit}"
        )->fetchAll();

        $claim = $this->pdo->prepare(
            "UPDATE jobs
             SET status = 'running', locked_at = NOW(), attempts = attempts + 1
             WHERE id = ? AND status = 'pending'"
        );

        $jobs = [];

        foreach ($candidates as $row) {
            $claim->execute([$row['id']]);

            if ($claim->rowCount() !== 1) {
                continue; // خطفها تشغيل آخر
            }

            /** @var array<string,mixed> $payload */
            $payload = json_decode((string) $row['payload'], true) ?? [];

            $jobs[] = new Job(
                id: (int) $row['id'],
                type: (string) $row['type'],
                payload: $payload,
                attempts: (int) $row['attempts'] + 1,
            );
        }

        return $jobs;
    }

    public function complete(int $jobId): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE jobs SET status = 'done', locked_at = NULL WHERE id = ?"
        );
        $stmt->execute([$jobId]);
    }

    /**
     * يعيد المهمة للطابور بتأخير متصاعد، أو يعلّمها فاشلة بعد استنفاد المحاولات.
     */
    public function fail(Job $job, string $error): void
    {
        if ($job->attempts >= self::MAX_ATTEMPTS) {
            $stmt = $this->pdo->prepare(
                "UPDATE jobs SET status = 'failed', last_error = ?, locked_at = NULL WHERE id = ?"
            );
            $stmt->execute([mb_substr($error, 0, 2000), $job->id]);

            return;
        }

        // تأخير متصاعد: ٥ ثم ٢٠ دقيقة. مناسب لانقطاع API مؤقت (قسم ١٠).
        $delayMinutes = 5 * ($job->attempts ** 2);

        $stmt = $this->pdo->prepare(
            "UPDATE jobs
             SET status = 'pending',
                 last_error = ?,
                 locked_at = NULL,
                 run_after = DATE_ADD(NOW(), INTERVAL ? MINUTE)
             WHERE id = ?"
        );
        $stmt->execute([mb_substr($error, 0, 2000), $delayMinutes, $job->id]);
    }

    /**
     * يستعيد المهام العالقة بحالة running.
     *
     * ضروري على استضافة مشتركة تحديداً: السيرفر قد يقتل تشغيل cron عند تجاوز
     * حد الموارد أو المهلة، فتبقى المهمة «قيد التشغيل» للأبد ولا يلمسها أحد.
     */
    public function recoverStuck(int $olderThanMinutes = 15): int
    {
        $stmt = $this->pdo->prepare(
            "UPDATE jobs
             SET status = 'pending', locked_at = NULL
             WHERE status = 'running'
               AND locked_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)"
        );
        $stmt->execute([$olderThanMinutes]);

        return $stmt->rowCount();
    }

    /** @return array{pending:int,running:int,failed:int} */
    public function stats(): array
    {
        $rows = $this->pdo->query(
            'SELECT status, COUNT(*) AS n FROM jobs GROUP BY status'
        )->fetchAll();

        $stats = ['pending' => 0, 'running' => 0, 'failed' => 0];

        foreach ($rows as $row) {
            $status = (string) $row['status'];
            if (array_key_exists($status, $stats)) {
                $stats[$status] = (int) $row['n'];
            }
        }

        return $stats;
    }
}

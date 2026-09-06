<?php

declare(strict_types=1);

namespace App\Queue;

use Throwable;

/**
 * مستهلك الطابور. يُستدعى من cron.
 *
 * محكوم بميزانية زمنية لا بعدد المهام وحده. السبب أن الاستضافة المشتركة تفرض
 * `max_execution_time`، وتجاوزه يقتل العملية في منتصف مهمة — فنتوقف بأنفسنا
 * قبل ذلك ونترك الباقي للتشغيل القادم، بدل أن يقطعنا السيرفر بلا تنظيف.
 */
final class Worker
{
    /** @var array<string,JobHandler> */
    private array $handlers = [];

    public function __construct(
        private readonly JobQueue $queue,
        private readonly int $batchSize = 5,
        private readonly int $timeBudgetSeconds = 45,
    ) {
    }

    public function register(JobHandler $handler): void
    {
        $this->handlers[$handler->type()] = $handler;
    }

    /**
     * @return array{processed:int,failed:int,recovered:int}
     */
    public function run(): array
    {
        $recovered = $this->queue->recoverStuck();
        $startedAt = microtime(true);

        $processed = 0;
        $failed = 0;

        foreach ($this->queue->claim($this->batchSize) as $job) {
            if ((microtime(true) - $startedAt) > $this->timeBudgetSeconds) {
                // أعِد المهمة للطابور بدل تركها محجوزة حتى تنتهي مهلة الاستعادة
                $this->queue->fail($job, 'انتهت الميزانية الزمنية للتشغيل — أُعيدت للطابور');
                break;
            }

            $handler = $this->handlers[$job->type] ?? null;

            if ($handler === null) {
                $this->queue->fail($job, "لا معالج لنوع المهمة: {$job->type}");
                $failed++;
                continue;
            }

            try {
                $handler->handle($job);
                $this->queue->complete($job->id);
                $processed++;
            } catch (Throwable $e) {
                $this->queue->fail($job, $e->getMessage());
                $failed++;
            }
        }

        return ['processed' => $processed, 'failed' => $failed, 'recovered' => $recovered];
    }
}

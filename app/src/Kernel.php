<?php

declare(strict_types=1);

namespace App;

use App\Capture\CaptureService;
use App\Memory\EntityResolver;
use App\Memory\GraphStore;
use App\Memory\MySqlGraphStore;
use App\Memory\Retriever;
use App\Meta\DecisionEngine;
use App\Meta\PermissionRegistry;
use App\Meta\QuestionBox;
use App\Providers\Llm\ClaudeProvider;
use App\Providers\Llm\LlmProvider;
use App\Providers\Push\PushProvider;
use App\Providers\Push\WebPushProvider;
use App\Providers\Stt\DeepgramProvider;
use App\Providers\Stt\SttProvider;
use App\Queue\Handlers\ExtractEntitiesHandler;
use App\Queue\Handlers\TranscribeHandler;
use App\Queue\JobQueue;
use App\Queue\Worker;
use App\Support\Config;
use App\Support\CostTracker;
use App\Support\Db;
use PDO;

/**
 * تجميع المكوّنات وربطها.
 *
 * حاوية يدوية بسيطة بدل إطار عمل: النظام يعمل بمعظمه من cron على استضافة
 * مشتركة، وكل ميلي ثانية من زمن الإقلاع تتكرر بكل تشغيل. البناء الكسول هنا
 * يعني أن مهمة تفريغ صوت لا تُنشئ اتصال نماذج أصلاً.
 */
final class Kernel
{
    private ?PDO $pdo = null;
    private ?GraphStore $store = null;
    private ?LlmProvider $llm = null;
    private ?SttProvider $stt = null;
    private ?PushProvider $push = null;
    private ?JobQueue $queue = null;
    private ?CostTracker $costs = null;

    public function pdo(): PDO
    {
        return $this->pdo ??= Db::pdo();
    }

    public function store(): GraphStore
    {
        return $this->store ??= new MySqlGraphStore($this->pdo());
    }

    public function llm(): LlmProvider
    {
        return $this->llm ??= new ClaudeProvider($this->costs());
    }

    public function stt(): SttProvider
    {
        return $this->stt ??= new DeepgramProvider();
    }

    public function push(): PushProvider
    {
        return $this->push ??= new WebPushProvider($this->pdo());
    }

    public function queue(): JobQueue
    {
        return $this->queue ??= new JobQueue($this->pdo());
    }

    public function costs(): CostTracker
    {
        return $this->costs ??= new CostTracker($this->pdo());
    }

    public function resolver(): EntityResolver
    {
        return new EntityResolver($this->store());
    }

    public function retriever(): Retriever
    {
        return new Retriever($this->pdo());
    }

    public function questions(): QuestionBox
    {
        return new QuestionBox($this->pdo());
    }

    public function permissions(): PermissionRegistry
    {
        return new PermissionRegistry($this->pdo());
    }

    public function decisions(): DecisionEngine
    {
        return new DecisionEngine($this->pdo(), $this->permissions());
    }

    public function capture(): CaptureService
    {
        return new CaptureService($this->pdo(), $this->queue());
    }

    /** العامل مع كل معالجاته مسجّلة */
    public function worker(): Worker
    {
        $worker = new Worker(
            queue: $this->queue(),
            batchSize: (int) Config::get('runtime.queue_batch_size', 5),
            timeBudgetSeconds: (int) Config::get('runtime.worker_time_budget_seconds', 45),
        );

        $worker->register(new TranscribeHandler($this->pdo(), $this->stt(), $this->queue()));
        $worker->register(new ExtractEntitiesHandler(
            $this->pdo(),
            $this->llm(),
            $this->resolver(),
            $this->store(),
            $this->questions(),
        ));

        return $worker;
    }

    /** تهيئة مشتركة لكل نقاط الدخول */
    public static function boot(): self
    {
        date_default_timezone_set((string) Config::get('runtime.timezone', 'Asia/Bahrain'));
        mb_internal_encoding('UTF-8');

        return new self();
    }
}

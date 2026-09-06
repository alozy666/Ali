<?php

declare(strict_types=1);

namespace App\Support;

use App\Providers\Llm\ClaudeProvider;
use App\Providers\Llm\LlmResponse;
use PDO;

/**
 * مؤشر التكلفة الظاهر من اليوم الأول (قسم ٣٦).
 *
 * الغرض أن يرى أثر كل ميزة يضيفها فوراً بدل اكتشافه بالفاتورة آخر الشهر،
 * ومعه سقف صارم: عند الاقتراب من الحد يخفّ التشغيل الاستباقي تلقائياً.
 */
final class CostTracker
{
    public function __construct(
        private readonly PDO $pdo,
    ) {
    }

    public function record(LlmResponse $response, string $purpose): void
    {
        $usd = ClaudeProvider::estimateUsd(
            $response->model,
            $response->inputTokens,
            $response->outputTokens,
            $response->cacheReadTokens
        );

        $stmt = $this->pdo->prepare(
            'INSERT INTO cost_log
                (day, model, purpose, input_tokens, output_tokens, cache_read_tokens, usd)
             VALUES (CURDATE(), ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $response->model,
            $purpose,
            $response->inputTokens,
            $response->outputTokens,
            $response->cacheReadTokens,
            $usd,
        ]);
    }

    /** إجمالي الشهر الجاري بالدولار */
    public function monthToDateUsd(): float
    {
        $stmt = $this->pdo->query(
            'SELECT COALESCE(SUM(usd), 0) AS total
             FROM cost_log
             WHERE day >= DATE_FORMAT(CURDATE(), \'%Y-%m-01\')'
        );

        return (float) ($stmt === false ? 0.0 : $stmt->fetchColumn());
    }

    /**
     * هل تجاوزنا نسبة من الميزانية؟
     *
     * يُستدعى قبل التشغيل الاستباقي: عند ٩٠٪ يتوقف الاستباقي وحده ويبقى
     * الالتقاط والرد على الطلب المباشر شغّالين. الترتيب مقصود — الاستباقية
     * أغلى بند وأقل إلحاحاً من ألا يستطيع تسجيل ملاحظة.
     */
    public function budgetExceeded(float $ratio = 0.9): bool
    {
        $budget = (float) Config::get('llm.monthly_budget_usd', 25.0);

        if ($budget <= 0) {
            return false;
        }

        return $this->monthToDateUsd() >= ($budget * $ratio);
    }
}

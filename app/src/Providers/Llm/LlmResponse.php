<?php

declare(strict_types=1);

namespace App\Providers\Llm;

use JsonException;

final class LlmResponse
{
    public function __construct(
        public readonly string $text,
        public readonly string $model,
        public readonly int $inputTokens = 0,
        public readonly int $outputTokens = 0,
        public readonly int $cacheReadTokens = 0,
    ) {
    }

    /**
     * يقرأ JSON من رد النموذج بتسامح.
     *
     * النماذج تحيط JSON أحياناً بسياج ```json أو بجملة تمهيدية رغم التعليمات.
     * التعامل مع هذا هنا مرة واحدة أفضل من تكراره بكل مستدعٍ، ومن الاعتماد
     * على أن النموذج «سيلتزم».
     *
     * @return array<string,mixed>|null  null عند فشل القراءة — والمستدعي يقرر
     *                                    ماذا يفعل، فلا يُبتلع الخطأ بصمت
     */
    public function json(): ?array
    {
        $text = trim($this->text);

        // إزالة سياج الكود إن وُجد
        if (str_starts_with($text, '```')) {
            $text = (string) preg_replace('/^```[a-zA-Z]*\s*|\s*```$/', '', $text);
        }

        // اقتطاع أول كائن JSON كامل — يتجاوز أي تمهيد نصي قبل القوس
        $start = strpos($text, '{');
        $end = strrpos($text, '}');

        if ($start === false || $end === false || $end < $start) {
            return null;
        }

        try {
            /** @var array<string,mixed> $decoded */
            $decoded = json_decode(
                substr($text, $start, $end - $start + 1),
                true,
                512,
                JSON_THROW_ON_ERROR
            );

            return $decoded;
        } catch (JsonException) {
            return null;
        }
    }
}

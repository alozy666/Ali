<?php

declare(strict_types=1);

namespace App\Providers\Llm;

use Anthropic\Client;
use App\Support\Config;
use App\Support\CostTracker;
use RuntimeException;

/**
 * مزوّد النماذج عبر SDK الرسمي: composer require "anthropic-ai/sdk"
 *
 * على استضافة بلا SSH، تُبنى مجلد vendor/ محلياً وتُرفع كما هي — الحزمة
 * محضة PHP ولا تحتاج بناءً أصلياً.
 *
 * توزيع النماذج (قسم ٣٦) مطبَّق هنا: المستدعي يطلب «طبقة» لا نموذجاً بعينه،
 * فيستحيل أن يتسرب استخدام نموذج قوي لمهمة فرز — وهو ما يحرق الميزانية.
 */
final class ClaudeProvider implements LlmProvider
{
    /**
     * تسعير الدولار لكل مليون توكن (إدخال، إخراج).
     *
     * يُستخدم لمؤشر التكلفة الظاهر (قسم ٣٦) كإنذار مبكر لا كمحاسبة. راجعه
     * مقابل الفاتورة الفعلية أول شهر، وحدّثه إن تغيّر التسعير.
     *
     * @var array<string,array{in:float,out:float}>
     */
    private const PRICING = [
        'claude-haiku-4-5' => ['in' => 1.00, 'out' => 5.00],
        'claude-sonnet-5'  => ['in' => 2.00, 'out' => 10.00],
        'claude-opus-5'    => ['in' => 5.00, 'out' => 25.00],
    ];

    /** قراءة الذاكرة المخزّنة مؤقتاً تُسعَّر أقل بكثير من الإدخال الطازج */
    private const CACHE_READ_DISCOUNT = 0.1;

    private ?Client $client = null;

    public function __construct(
        private readonly ?CostTracker $costTracker = null,
    ) {
    }

    public function complete(
        string $system,
        string $user,
        string $tier = 'light',
        int $maxTokens = 4096,
        string $purpose = 'extract',
    ): LlmResponse {
        $model = $this->modelFor($tier);

        $message = $this->client()->messages->create(
            model: $model,
            maxTokens: $maxTokens,
            // system كمصفوفة كتل مع cacheControl: التعليمات والذاكرة الأساسية
            // (قسم ٧) ثابتة عبر الطلبات، فتخزينها المؤقت يقصّ جزءاً حقيقياً من
            // الفاتورة. الشرط أن يبقى هذا الجزء ثابتاً بايتاً ببايت — فلا تضع
            // فيه وقتاً أو معرّفاً متغيّراً، وإلا بطل التخزين بصمت.
            system: [
                ['type' => 'text', 'text' => $system, 'cacheControl' => ['type' => 'ephemeral']],
            ],
            messages: [
                ['role' => 'user', 'content' => $user],
            ],
        );

        $text = '';
        foreach ($message->content as $block) {
            if (($block->type ?? null) === 'text') {
                $text .= $block->text;
            }
        }

        $usage = $this->readUsage($message);

        $response = new LlmResponse(
            text: $text,
            model: $model,
            inputTokens: $usage['in'],
            outputTokens: $usage['out'],
            cacheReadTokens: $usage['cache_read'],
        );

        $this->costTracker?->record($response, $purpose);

        return $response;
    }

    public static function estimateUsd(string $model, int $in, int $out, int $cacheRead = 0): float
    {
        $price = self::PRICING[$model] ?? null;

        if ($price === null) {
            return 0.0;
        }

        return ($in * $price['in']
                + $out * $price['out']
                + $cacheRead * $price['in'] * self::CACHE_READ_DISCOUNT) / 1_000_000;
    }

    private function modelFor(string $tier): string
    {
        $model = Config::get("llm.models.{$tier}");

        if (!is_string($model) || $model === '') {
            throw new RuntimeException("طبقة نموذج غير معرّفة: {$tier}");
        }

        return $model;
    }

    private function client(): Client
    {
        return $this->client ??= new Client(apiKey: (string) Config::require('llm.api_key'));
    }

    /**
     * قراءة عدادات الاستهلاك بتحوّط.
     *
     * أسماء حقول usage قد تختلف بين إصدارات الـ SDK، وفشل القراءة هنا يجب ألا
     * يُسقط عملية استخراج ناجحة — أسوأ ما يحدث أن يكون مؤشر التكلفة ناقصاً،
     * وهذا أهون من ضياع المدخل نفسه.
     *
     * @return array{in:int,out:int,cache_read:int}
     */
    private function readUsage(object $message): array
    {
        $usage = $message->usage ?? null;

        if (!is_object($usage)) {
            return ['in' => 0, 'out' => 0, 'cache_read' => 0];
        }

        $read = static function (object $o, string ...$names): int {
            foreach ($names as $name) {
                if (isset($o->{$name}) && is_numeric($o->{$name})) {
                    return (int) $o->{$name};
                }
            }

            return 0;
        };

        return [
            'in' => $read($usage, 'inputTokens', 'input_tokens'),
            'out' => $read($usage, 'outputTokens', 'output_tokens'),
            'cache_read' => $read($usage, 'cacheReadInputTokens', 'cache_read_input_tokens'),
        ];
    }
}

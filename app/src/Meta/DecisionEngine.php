<?php

declare(strict_types=1);

namespace App\Meta;

use PDO;

enum Decision: string
{
    case Execute = 'executed';
    case Ask = 'asked';
}

/**
 * منطق قرار العقل الميتا (قسم ٥).
 *
 * وثيقتك تنص على أن القرار يعتمد على أربعة مكوّنات مجتمعة، «مو الثقة وحدها»:
 * التصنيف، درجة الثقة، قابلية التراجع، وحداثة المعلومة. المنطق منقول حرفياً:
 *
 *     تصنيف حساس            → اسأل دائماً (بدون استثناء)
 *     معلومة قديمة/ناقصة     → اسأل (حتى لو الثقة عالية)
 *     غير قابل للتراجع       → اسأل (حتى لو الثقة عالية)
 *     عادي + ثقة + تراجع + حداثة → نفّذ وسجّل
 *     غير ذلك                → اسأل
 *
 * كل قرار يُكتب بسجل الأفعال مع سببه: أي مكوّن رجّح ماذا، ودرجة الثقة وقتها،
 * وأي عقد استُند عليها. قسم ٢٠ يشترط هذا تحديداً ليصير أي تصرف غريب قابلاً
 * للتتبع لسببه الحقيقي «لا لغزاً».
 */
final class DecisionEngine
{
    private const MIN_CONFIDENCE = 0.7;

    /** المعلومة الأقدم من هذا تُعد قديمة وتوجب السؤال */
    private const FRESHNESS_DAYS = 30;

    public function __construct(
        private readonly PDO $pdo,
        private readonly PermissionRegistry $permissions,
    ) {
    }

    /**
     * @param list<int> $evidenceEntityIds العقد التي بُني عليها القرار
     * @param array<string,mixed> $payload
     */
    public function decide(
        string $actionType,
        float $confidence,
        array $evidenceEntityIds = [],
        array $payload = [],
    ): Decision {
        $type = $this->permissions->get($actionType);
        $stale = $this->hasStaleEvidence($evidenceEntityIds);

        $reasons = [
            'tier' => $type->tier,
            'tier_confirmed' => $type->tierConfirmed,
            'confidence' => $confidence,
            'confidence_threshold' => self::MIN_CONFIDENCE,
            'reversible' => $type->reversible,
            'evidence_stale' => $stale,
            'auto_exec' => $type->autoExec,
        ];

        $decision = $this->evaluate($type, $confidence, $stale, $reasons);

        $this->journal($type, $decision, $confidence, $reasons, $evidenceEntityIds, $payload);

        return $decision;
    }

    /**
     * @param array<string,mixed> $reasons
     */
    private function evaluate(ActionType $type, float $confidence, bool $stale, array &$reasons): Decision
    {
        if ($type->isSensitive()) {
            $reasons['rule'] = 'sensitive_always_asks';

            return Decision::Ask;
        }

        if (!$type->reversible) {
            $reasons['rule'] = 'irreversible_always_asks';

            return Decision::Ask;
        }

        if ($stale) {
            $reasons['rule'] = 'stale_evidence';

            return Decision::Ask;
        }

        if (!$type->autoExec) {
            $reasons['rule'] = 'not_yet_promoted';

            return Decision::Ask;
        }

        if ($confidence < self::MIN_CONFIDENCE) {
            $reasons['rule'] = 'low_confidence';

            return Decision::Ask;
        }

        $reasons['rule'] = 'all_conditions_met';

        return Decision::Execute;
    }

    /**
     * حداثة المعلومة — المكوّن الرابع بقرار العقل الميتا.
     *
     * @param list<int> $entityIds
     */
    private function hasStaleEvidence(array $entityIds): bool
    {
        if ($entityIds === []) {
            return false; // قرار لا يستند لعقد ليس قراراً «على معلومة قديمة»
        }

        $placeholders = implode(',', array_fill(0, count($entityIds), '?'));

        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM entities
             WHERE id IN ({$placeholders})
               AND last_seen_at < DATE_SUB(NOW(), INTERVAL ? DAY)"
        );
        $stmt->execute([...array_values($entityIds), self::FRESHNESS_DAYS]);

        return ((int) $stmt->fetchColumn()) > 0;
    }

    /**
     * سجل الأفعال (قسم ٥) — كل فعل تلقائي نُفّذ فعلياً، لا الأسئلة فقط.
     *
     * حتى الأفعال الصامتة تُسجَّل هنا: هي لا تظهر بالملخص اليومي (لأن عرضها
     * يعيد تشغيل ذهنه بما أراد التخلص منه)، لكنها موجودة بالسجل العميق ليقدر
     * يراجعها بأي وقت.
     *
     * @param array<string,mixed> $reasons
     * @param list<int> $evidence
     * @param array<string,mixed> $payload
     */
    private function journal(
        ActionType $type,
        Decision $decision,
        float $confidence,
        array $reasons,
        array $evidence,
        array $payload,
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO actions
                (action_type, decision, tier, confidence, reasons, evidence, payload, visibility, executed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $type->type,
            $decision->value,
            $type->tier,
            $confidence,
            json_encode($reasons, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            json_encode($evidence, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            $payload === [] ? null : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            $type->visibility,
            $decision === Decision::Execute ? date('Y-m-d H:i:s') : null,
        ]);
    }
}

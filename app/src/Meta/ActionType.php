<?php

declare(strict_types=1);

namespace App\Meta;

/**
 * تصنيف نوع فعل، كما يُقرأ من جدول action_types.
 */
final class ActionType
{
    public function __construct(
        public readonly string $type,
        public readonly string $tier,
        public readonly bool $reversible,
        public readonly bool $autoExec,
        public readonly bool $tierConfirmed,
        public readonly string $visibility,
        public readonly int $consecutiveApprovals,
        public readonly bool $promotionFrozen,
    ) {
    }

    public function isSensitive(): bool
    {
        return $this->tier === 'sensitive';
    }

    /**
     * @param array<string,mixed> $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            type: (string) $row['type'],
            tier: (string) $row['tier'],
            reversible: (bool) $row['reversible'],
            autoExec: (bool) $row['auto_exec'],
            tierConfirmed: (bool) $row['tier_confirmed'],
            visibility: (string) $row['visibility'],
            consecutiveApprovals: (int) $row['consecutive_approvals'],
            promotionFrozen: (bool) $row['promotion_frozen'],
        );
    }
}

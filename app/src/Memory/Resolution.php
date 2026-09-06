<?php

declare(strict_types=1);

namespace App\Memory;

/**
 * نتيجة محاولة دمج كيان.
 *
 * ثلاث حالات لا اثنتان. الحالة الثالثة (الغموض) هي جوهر التصميم: النظام لا
 * يخمّن أي «علي» تقصد، بل يسأل — تطبيقاً لقاعدة الحذر الافتراضي (قسم ٤).
 */
enum ResolutionStatus: string
{
    /** وُجد كيان واحد مطابق */
    case Resolved = 'resolved';

    /** لا كيان مطابق — أُنشئ جديد */
    case Created = 'created';

    /** أكثر من مرشّح — يحتاج قراره (قسم ٥) */
    case Ambiguous = 'ambiguous';
}

final class Resolution
{
    /**
     * @param list<array{id:int,type:string,canonical_name:string}> $candidates
     */
    private function __construct(
        public readonly ResolutionStatus $status,
        public readonly ?int $entityId,
        public readonly array $candidates = [],
    ) {
    }

    public static function resolved(int $entityId): self
    {
        return new self(ResolutionStatus::Resolved, $entityId);
    }

    public static function created(int $entityId): self
    {
        return new self(ResolutionStatus::Created, $entityId);
    }

    /**
     * @param list<array{id:int,type:string,canonical_name:string}> $candidates
     */
    public static function ambiguous(array $candidates): self
    {
        return new self(ResolutionStatus::Ambiguous, null, $candidates);
    }

    /** هل نتج عن هذي المحاولة كيان صالح للربط؟ */
    public function hasEntity(): bool
    {
        return $this->entityId !== null;
    }
}

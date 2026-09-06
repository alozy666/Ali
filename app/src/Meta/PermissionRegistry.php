<?php

declare(strict_types=1);

namespace App\Meta;

use PDO;

/**
 * منظومة الصلاحيات والتعلم (قسم ٤) ومراقبة التصرف الغريب (قسم ٢٠).
 *
 * ثلاث قواعد غير قابلة للتفاوض مطبَّقة هنا:
 *
 * 1. الأفعال الحساسة (مال + تواصل خارجي) لا تترقى أبداً، مهما تكرر نجاحها.
 * 2. الصمت لا يُحسب موافقة — العداد يتحرك بالموافقة الصريحة وحدها.
 * 3. تصحيحان متتاليان يرجّعان الفعل لطبقة «يسأل» ويجمّدان ترقيته (قسم ٢٠).
 */
final class PermissionRegistry
{
    /** عدد الموافقات الصريحة المتتالية اللازمة للترقية */
    private const PROMOTION_THRESHOLD = 5;

    /** عدد التصحيحات المتتالية التي تُسقط الفعل لطبقة «يسأل» */
    private const DEMOTION_THRESHOLD = 2;

    public function __construct(
        private readonly PDO $pdo,
    ) {
    }

    /**
     * قاعدة الحذر الافتراضي (قسم ٤): أي فعل غير مصنّف بعد يُسجَّل تلقائياً
     * كـ«عادي غير مؤكَّد» ويبقى بطبقة «يسأل» — لا يُنفَّذ لمجرد أنه مجهول.
     */
    public function get(string $type): ActionType
    {
        $stmt = $this->pdo->prepare('SELECT * FROM action_types WHERE type = ?');
        $stmt->execute([$type]);
        $row = $stmt->fetch();

        if ($row === false) {
            $this->registerUnknown($type);
            $stmt->execute([$type]);
            $row = $stmt->fetch();
        }

        /** @var array<string,mixed> $row */
        return ActionType::fromRow($row);
    }

    /** موافقة صريحة منه — هي وحدها ما يحرّك عداد الترقية */
    public function approve(string $type): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE action_types
             SET approvals = approvals + 1,
                 consecutive_approvals = consecutive_approvals + 1,
                 consecutive_corrections = 0
             WHERE type = ?'
        );
        $stmt->execute([$type]);

        $this->promoteIfEarned($type);
    }

    public function reject(string $type): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE action_types
             SET rejections = rejections + 1,
                 consecutive_approvals = 0
             WHERE type = ?'
        );
        $stmt->execute([$type]);
    }

    /**
     * تصحيحه لفعل نُفّذ تلقائياً (قسم ٢٠).
     *
     * التجميد مقصود ولا يُرفع تلقائياً: تكرار التصحيح يعني أن فهم النظام لهذا
     * الفعل خاطئ، وإعادة الترقية بعد بضع موافقات تعيد المشكلة نفسها. الرفع
     * يكون بقرار صريح منه عبر unfreeze().
     */
    public function correct(string $type): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE action_types
             SET consecutive_corrections = consecutive_corrections + 1,
                 consecutive_approvals = 0
             WHERE type = ?'
        );
        $stmt->execute([$type]);

        $demote = $this->pdo->prepare(
            'UPDATE action_types
             SET auto_exec = 0, promotion_frozen = 1
             WHERE type = ? AND consecutive_corrections >= ?'
        );
        $demote->execute([$type, self::DEMOTION_THRESHOLD]);
    }

    public function unfreeze(string $type): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE action_types
             SET promotion_frozen = 0, consecutive_corrections = 0
             WHERE type = ?'
        );
        $stmt->execute([$type]);
    }

    /** تأكيد التصنيف منه (قسم ٤: حتى الفئات الحساسة تُتعلَّم وتُؤكَّد) */
    public function confirmTier(string $type, string $tier): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE action_types SET tier = ?, tier_confirmed = 1 WHERE type = ?'
        );
        $stmt->execute([$tier, $type]);
    }

    /**
     * الترقية مشروطة بأربعة شروط مجتمعة. الشرط الأول وحده يحمي المال والتواصل
     * الخارجي مهما بلغت الثقة — وهو ما تصفه وثيقتك بأنه «لا يترقى أبداً».
     */
    private function promoteIfEarned(string $type): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE action_types
             SET auto_exec = 1
             WHERE type = ?
               AND tier = 'normal'
               AND reversible = 1
               AND promotion_frozen = 0
               AND consecutive_approvals >= ?"
        );
        $stmt->execute([$type, self::PROMOTION_THRESHOLD]);
    }

    private function registerUnknown(string $type): void
    {
        $stmt = $this->pdo->prepare(
            "INSERT IGNORE INTO action_types
                (type, label_ar, tier, reversible, auto_exec, tier_confirmed)
             VALUES (?, ?, 'normal', 1, 0, 0)"
        );
        $stmt->execute([$type, $type]);
    }
}

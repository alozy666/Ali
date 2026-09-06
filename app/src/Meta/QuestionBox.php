<?php

declare(strict_types=1);

namespace App\Meta;

use PDO;

/**
 * قائمة الأسئلة المعلّقة (قسم ٥).
 *
 * وثيقتك تفرّق بين تسليمين: العاجل يُدفع كإشعار فوري، وغير العاجل يتجمع
 * بقائمة يراجعها بوقته «بدل مقاطعته المستمرة». التفريق مطبَّق بعمود urgency،
 * وناتج الفرق أن استيضاحاً عن اسم متكرر لا يقطع عليه اجتماعاً.
 */
final class QuestionBox
{
    public function __construct(
        private readonly PDO $pdo,
    ) {
    }

    /**
     * @param array<string,mixed> $context
     */
    public function ask(string $question, string $kind = 'clarification', array $context = [], bool $urgent = false): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO pending_questions (question, kind, context, urgency)
             VALUES (?, ?, ?, ?)'
        );

        $stmt->execute([
            $question,
            $kind,
            $context === [] ? null : json_encode($context, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            $urgent ? 'urgent' : 'normal',
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function open(int $limit = 20): array
    {
        $limit = max(1, min($limit, 100));

        return $this->pdo->query(
            "SELECT id, question, kind, context, urgency, created_at
             FROM pending_questions
             WHERE status = 'open'
             ORDER BY FIELD(urgency, 'urgent', 'normal'), created_at ASC
             LIMIT {$limit}"
        )->fetchAll();
    }

    public function openCount(): int
    {
        $stmt = $this->pdo->query(
            "SELECT COUNT(*) FROM pending_questions WHERE status = 'open'"
        );

        return $stmt === false ? 0 : (int) $stmt->fetchColumn();
    }

    public function answer(int $id, string $answer): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE pending_questions
             SET status = 'answered', answer = ?, answered_at = NOW()
             WHERE id = ?"
        );
        $stmt->execute([$answer, $id]);
    }
}

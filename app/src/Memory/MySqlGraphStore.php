<?php

declare(strict_types=1);

namespace App\Memory;

use PDO;

/**
 * تنفيذ الشبكة المعرفية على MySQL — بديل Neo4j.
 *
 * قسم ٦ بوثيقتك اختار Neo4j لسببين: مرونة الخصائص، والفهرسة المتجهية الأصلية.
 * على استضافة مشتركة كلاهما متاح بشكل كافٍ لمستخدم واحد: عمود JSON يعطي مرونة
 * إضافة خاصية لأي عقدة بلا تعديل هيكلي (نفس حجة JSONB بالوثيقة)، والاسترجاع
 * يبدأ بـ FULLTEXT ثم يُضاف التشابه المتجهي بالمرحلة ٢.
 *
 * ما يُفقد فعلياً: أداء التنقل العميق (٥+ قفزات) على شبكات ضخمة. لمستخدم واحد
 * بعشرات آلاف العقد (السقف المتوقع بقسم ٣١) وبعمق ٢-٣ قفزات، الفرق غير محسوس.
 */
final class MySqlGraphStore implements GraphStore
{
    public function __construct(
        private readonly PDO $pdo,
    ) {
    }

    public function findEntityIdsByAlias(string $aliasNorm): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT entity_id FROM entity_aliases WHERE alias_norm = ?'
        );
        $stmt->execute([$aliasNorm]);

        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    public function createEntity(
        string $type,
        string $canonicalName,
        array $attrs = [],
        string $searchText = '',
        ?int $episodeId = null,
    ): int {
        $stmt = $this->pdo->prepare(
            'INSERT INTO entities (type, canonical_name, attrs, search_text, episode_id)
             VALUES (?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $type,
            $canonicalName,
            $attrs === [] ? null : self::encodeJson($attrs),
            $searchText,
            $episodeId,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function addAlias(int $entityId, string $alias, string $aliasNorm, string $lang): void
    {
        // INSERT IGNORE يعتمد على UNIQUE(alias_norm, entity_id): إعادة تسجيل
        // نفس الصيغة لنفس العقدة عملية طبيعية متكررة، لا خطأ.
        $stmt = $this->pdo->prepare(
            'INSERT IGNORE INTO entity_aliases (entity_id, alias, alias_norm, lang)
             VALUES (?, ?, ?, ?)'
        );

        $stmt->execute([$entityId, $alias, $aliasNorm, $lang]);
    }

    public function getEntity(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, type, canonical_name FROM entities WHERE id = ?'
        );
        $stmt->execute([$id]);

        $row = $stmt->fetch();

        return $row === false ? null : self::castEntity($row);
    }

    public function getEntities(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->pdo->prepare(
            "SELECT id, type, canonical_name FROM entities WHERE id IN ({$placeholders})"
        );
        $stmt->execute(array_values($ids));

        return array_map(self::castEntity(...), $stmt->fetchAll());
    }

    public function addEdge(
        int $srcId,
        string $relType,
        int $dstId,
        array $attrs = [],
        ?int $episodeId = null,
    ): void {
        if ($srcId === $dstId) {
            return; // حلقة ذاتية بلا معنى دلالي
        }

        // `valid_from = NOW()` هو أفضل تقدير متاح: نعرف متى **علمنا** بالحقيقة،
        // لا متى صارت صحيحة بالواقع. العمود يقبل تاريخاً أدق لاحقاً لو استُخرج
        // من النص («من السنة الماضية»)، وهذي قدرة مؤجّلة لا مفقودة.
        //
        // عند التكرار: الوزن يتراكم، والعلاقة **تُستعاد** لو كانت مُبطَلة —
        // فذكرها من جديد تأكيد لصحتها.
        $stmt = $this->pdo->prepare(
            'INSERT INTO edges (src_id, rel_type, dst_id, attrs, episode_id, valid_from)
             VALUES (?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                 weight         = weight + 0.1,
                 valid_until    = NULL,
                 invalidated_by = NULL'
        );

        $stmt->execute([
            $srcId,
            $relType,
            $dstId,
            $attrs === [] ? null : self::encodeJson($attrs),
            $episodeId,
        ]);
    }

    public function invalidateEdge(
        int $srcId,
        string $relType,
        int $dstId,
        ?int $byEpisodeId = null,
    ): bool {
        // الشرط `valid_until IS NULL` يجعل العملية مُتكرِّرة الاستدعاء بأمان:
        // إبطال ما هو مُبطَل أصلاً لا يغيّر تاريخ الإبطال الأول.
        $stmt = $this->pdo->prepare(
            'UPDATE edges
             SET valid_until = NOW(), invalidated_by = ?
             WHERE src_id = ? AND rel_type = ? AND dst_id = ? AND valid_until IS NULL'
        );

        $stmt->execute([$byEpisodeId, $srcId, $relType, $dstId]);

        return $stmt->rowCount() === 1;
    }

    public function edgesOf(int $entityId, bool $includeInvalidated = false): array
    {
        $filter = $includeInvalidated ? '' : ' AND valid_until IS NULL';

        $stmt = $this->pdo->prepare(
            "SELECT src_id, rel_type, dst_id, valid_until, episode_id
             FROM edges
             WHERE (src_id = ? OR dst_id = ?){$filter}
             ORDER BY id ASC"
        );
        $stmt->execute([$entityId, $entityId]);

        return array_map(
            static fn (array $row): array => [
                'src_id' => (int) $row['src_id'],
                'rel_type' => (string) $row['rel_type'],
                'dst_id' => (int) $row['dst_id'],
                'valid_until' => $row['valid_until'] === null ? null : (string) $row['valid_until'],
                'episode_id' => $row['episode_id'] === null ? null : (int) $row['episode_id'],
            ],
            $stmt->fetchAll()
        );
    }

    public function touchEntity(int $id): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE entities SET last_seen_at = NOW(), state = \'active\' WHERE id = ?'
        );
        $stmt->execute([$id]);
    }

    /**
     * @param array<string,mixed> $value
     */
    private static function encodeJson(array $value): string
    {
        // JSON_UNESCAPED_UNICODE ضروري: بدونه يُخزَّن العربي كـ زي...
        // فينتفخ الحجم ويصير الفحص اليدوي للبيانات غير مقروء.
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    /**
     * @param array<string,mixed> $row
     * @return array{id:int,type:string,canonical_name:string}
     */
    private static function castEntity(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'type' => (string) $row['type'],
            'canonical_name' => (string) $row['canonical_name'],
        ];
    }
}

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

    public function createEntity(string $type, string $canonicalName, array $attrs = [], string $searchText = ''): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO entities (type, canonical_name, attrs, search_text)
             VALUES (?, ?, ?, ?)'
        );

        $stmt->execute([
            $type,
            $canonicalName,
            $attrs === [] ? null : self::encodeJson($attrs),
            $searchText,
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

    public function addEdge(int $srcId, string $relType, int $dstId, array $attrs = []): void
    {
        if ($srcId === $dstId) {
            return; // حلقة ذاتية بلا معنى دلالي
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO edges (src_id, rel_type, dst_id, attrs)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE weight = weight + 0.1'
        );

        // تكرار ذكر نفس العلاقة يقوّي وزنها بدل أن يُهمَل — إشارة أن الرابط حقيقي
        $stmt->execute([
            $srcId,
            $relType,
            $dstId,
            $attrs === [] ? null : self::encodeJson($attrs),
        ]);
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

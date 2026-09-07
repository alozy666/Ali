<?php

declare(strict_types=1);

namespace App\Memory;

use App\Support\ArabicNormalizer;
use PDO;

/**
 * الاسترجاع من الشبكة المعرفية — مكافئ GraphRAG (قسم ٧) على MySQL.
 *
 * وثيقتك تصف الاسترجاع بخطوتين: بحث دلالي يلقى أقرب عقدة، ثم تنقل عبر
 * العلاقات لعقد مجاورة ذات صلة منطقية «حتى لو ما تشابهت بالنص». الخطوة
 * الثانية — وهي التي تعطي القدرة على ربط فكرة قديمة بمشروع جديد — محفوظة
 * كما هي هنا عبر WITH RECURSIVE.
 *
 * الفرق الوحيد بالمرحلة ١ هو الخطوة الأولى: FULLTEXT بدل التشابه المتجهي.
 * يعني الاسترجاع يمسك التطابق اللفظي والصرفي (بفضل التطبيع) لا الدلالي —
 * «سيارة» لا تجد «مركبة». يُسدّ هذا بالمرحلة ٢ بإضافة المتجهات، وقتها يصير
 * هذا الصنف هو المكان الوحيد الذي يتغيّر.
 */
final class Retriever
{
    private const MAX_DEPTH = 2;

    public function __construct(
        private readonly PDO $pdo,
    ) {
    }

    /**
     * المرحلة ١: إيجاد عقد البذرة من نص الاستعلام.
     *
     * @return list<array{id:int,type:string,canonical_name:string,score:float}>
     */
    public function seedsByText(string $query, int $limit = 5): array
    {
        $normalized = ArabicNormalizer::normalize($query);

        if ($normalized === '') {
            return [];
        }

        // ملاحظة على LIMIT: مع PDO::ATTR_EMULATE_PREPARES = false تُرسل
        // الوسائط كسلاسل، فـ `LIMIT ?` تصير `LIMIT '5'` وهو خطأ صياغة بـ MySQL.
        // الحل المعتمد هنا: إقحام عدد صحيح تحقّقنا منه، لا وسيط محضّر.
        $limit = max(1, min($limit, 100));

        // المطابقة بالاسم البديل أولاً — الأدق حين يذكر اسماً صريحاً
        $byAlias = $this->pdo->prepare(
            "SELECT e.id, e.type, e.canonical_name, 100.0 AS score
             FROM entity_aliases a
             JOIN entities e ON e.id = a.entity_id
             WHERE a.alias_norm = ?
             LIMIT {$limit}"
        );
        $byAlias->execute([$normalized]);
        $results = $byAlias->fetchAll();

        if (count($results) >= $limit) {
            return array_map(self::castSeed(...), $results);
        }

        $remaining = $limit - count($results);

        // ثم البحث النصي الكامل على النص المطبّع
        $byText = $this->pdo->prepare(
            "SELECT id, type, canonical_name,
                    MATCH(search_text) AGAINST(? IN NATURAL LANGUAGE MODE) AS score
             FROM entities
             WHERE MATCH(search_text) AGAINST(? IN NATURAL LANGUAGE MODE)
             ORDER BY score DESC
             LIMIT {$remaining}"
        );
        $byText->execute([$normalized, $normalized]);

        $seen = [];
        foreach ($results as $row) {
            $seen[(int) $row['id']] = true;
        }

        foreach ($byText->fetchAll() as $row) {
            if (!isset($seen[(int) $row['id']])) {
                $results[] = $row;
            }
        }

        return array_map(self::castSeed(...), $results);
    }

    /**
     * المرحلة ٢: التنقل عبر العلاقات من عقد البذرة.
     *
     * العلاقات تُعبر باتجاهيها — «مشروع يخص شخصاً» يجب أن يصل من الشخص للمشروع
     * ومن المشروع للشخص. لذا شرط الوصل يفحص src_id وdst_id معاً.
     *
     * حد العمق ضروري لا تجميلي: MySQL لا يدعم شرط CYCLE، فالشبكة التي فيها
     * دورة (وهي طبيعية هنا: شخص ← مشروع ← قرار ← نفس الشخص) تتوسع بلا نهاية
     * دون هذا الحد.
     *
     * **النموذج ثنائي الزمن:** الاسترجاع الافتراضي يعبر العلاقات **القائمة**
     * فقط. العلاقة المُبطَلة تختفي من الجوار بلا أن تُحذف — فلا يبني النظام
     * قراراً على حقيقة يعرف أنها بطلت.
     *
     * @param string|null $asOf لقطة زمنية (`Y-m-d H:i:s`): ما كانت الشبكة عليه
     *                          بذلك التاريخ. يخدم مراجعة دقة التوقعات (قسم ٣٠)
     *                          — «على أي معلومات بنيتُ قراري وقتها؟»
     *
     * @param list<int> $seedIds
     * @return list<array{id:int,type:string,canonical_name:string,depth:int}>
     */
    public function neighborhood(
        array $seedIds,
        int $depth = self::MAX_DEPTH,
        int $limit = 40,
        ?string $asOf = null,
    ): array {
        if ($seedIds === []) {
            return [];
        }

        $depth = max(1, min($depth, self::MAX_DEPTH));
        $limit = max(1, min($limit, 200));
        $placeholders = implode(',', array_fill(0, count($seedIds), '?'));

        if ($asOf === null) {
            $temporal = 'e.valid_until IS NULL';
            $temporalParams = [];
        } else {
            $temporal = '(e.valid_from IS NULL OR e.valid_from <= ?)'
                . ' AND (e.valid_until IS NULL OR e.valid_until > ?)';
            $temporalParams = [$asOf, $asOf];
        }

        // CAST بالجزء غير التكراري ضروري: MySQL يشتق نوع عمود الـ CTE من أول
        // SELECT، وبدون تحديد صريح قد يُقتطع المعرّف عند القيم الكبيرة.
        $sql = "
            WITH RECURSIVE reachable (id, depth) AS (
                SELECT CAST(id AS UNSIGNED), 0
                FROM entities
                WHERE id IN ({$placeholders})

                UNION ALL

                SELECT
                    CAST(IF(e.src_id = r.id, e.dst_id, e.src_id) AS UNSIGNED),
                    r.depth + 1
                FROM reachable r
                JOIN edges e
                  ON (e.src_id = r.id OR e.dst_id = r.id)
                 AND {$temporal}
                WHERE r.depth < {$depth}
            )
            SELECT e.id, e.type, e.canonical_name, MIN(r.depth) AS depth
            FROM reachable r
            JOIN entities e ON e.id = r.id
            WHERE e.state = 'active'
            GROUP BY e.id, e.type, e.canonical_name
            ORDER BY depth ASC, e.last_seen_at DESC
            LIMIT {$limit}
        ";

        // ترتيب الوسائط يتبع ترتيب ظهورها بالنص: بذور الجزء غير التكراري أولاً،
        // ثم وسائط الشرط الزمني داخل الجزء التكراري.
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([...array_values($seedIds), ...$temporalParams]);

        return array_map(
            static fn (array $row): array => [
                'id' => (int) $row['id'],
                'type' => (string) $row['type'],
                'canonical_name' => (string) $row['canonical_name'],
                'depth' => (int) $row['depth'],
            ],
            $stmt->fetchAll()
        );
    }

    /**
     * الاسترجاع الكامل: بذرة ثم جوار. هذا ما يُغذّى للنموذج كسياق.
     *
     * @param string|null $asOf لقطة زمنية — راجع neighborhood()
     * @return list<array{id:int,type:string,canonical_name:string,depth:int}>
     */
    public function retrieve(string $query, int $limit = 40, ?string $asOf = null): array
    {
        $seeds = $this->seedsByText($query);

        if ($seeds === []) {
            return [];
        }

        $seedIds = array_map(static fn (array $s): int => $s['id'], $seeds);

        return $this->neighborhood($seedIds, self::MAX_DEPTH, $limit, $asOf);
    }

    /**
     * @param array<string,mixed> $row
     * @return array{id:int,type:string,canonical_name:string,score:float}
     */
    private static function castSeed(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'type' => (string) $row['type'],
            'canonical_name' => (string) $row['canonical_name'],
            'score' => (float) $row['score'],
        ];
    }
}

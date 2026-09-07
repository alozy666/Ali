<?php

declare(strict_types=1);

namespace App\Memory;

/**
 * واجهة تخزين الشبكة المعرفية.
 *
 * وجود الواجهة تطبيق لقسم ٣٨ (طبقة وسيطة لكل مكوّن خارجي): قاعدة البيانات
 * أكبر مكوّن قابل للاستبدال بالنظام. لو انتقلت لاحقاً من MySQL على استضافة
 * مشتركة إلى Neo4j على VPS (كما بوثيقتك الأصلية)، يُكتب صنف جديد يحقق هذي
 * الواجهة ولا يتغيّر شيء بمنطق الذاكرة ولا بالعقل الميتا.
 */
interface GraphStore
{
    /**
     * كل العقد التي يشير إليها مفتاح المطابقة.
     *
     * ترجع مصفوفة لا معرّفاً واحداً بشكل مقصود: الاسم الواحد قد يخص أكثر من
     * كيان (علي الصديق وعلي العميل)، والغموض يُعرض كسؤال لا يُخمَّن.
     *
     * @return list<int>
     */
    public function findEntityIdsByAlias(string $aliasNorm): array;

    /**
     * @param array<string,mixed> $attrs
     * @param int|null $episodeId معرّف المدخل الخام الذي أنشأ العقدة — تتبّع المصدر (قسم ٢٠)
     */
    public function createEntity(
        string $type,
        string $canonicalName,
        array $attrs = [],
        string $searchText = '',
        ?int $episodeId = null,
    ): int;

    public function addAlias(int $entityId, string $alias, string $aliasNorm, string $lang): void;

    /**
     * @return array{id:int,type:string,canonical_name:string}|null
     */
    public function getEntity(int $id): ?array;

    /**
     * @param list<int> $ids
     * @return list<array{id:int,type:string,canonical_name:string}>
     */
    public function getEntities(array $ids): array;

    /**
     * يثبت علاقة كقائمة الآن.
     *
     * إعادة تأكيد علاقة مُبطَلة سابقاً **تعيد تفعيلها** — لأن ذكرها من جديد
     * تأكيد لصحتها. الوزن يتراكم مع التكرار كإشارة أن الرابط حقيقي.
     *
     * @param array<string,mixed> $attrs
     * @param int|null $episodeId المدخل الخام الذي أثبتها
     */
    public function addEdge(
        int $srcId,
        string $relType,
        int $dstId,
        array $attrs = [],
        ?int $episodeId = null,
    ): void;

    /**
     * يُبطل علاقة قائمة — لا يحذفها.
     *
     * هذا جوهر النموذج ثنائي الزمن: «القديم يُنسَخ لا يُمحى». العلاقة المُبطَلة
     * تختفي من الاسترجاع الافتراضي، وتبقى قابلة للاستدعاء بلقطة زمنية (قسم ٣٠)
     * وتصلح كعقدة ظل تنبّهك لتكرار نمط سابق (قسم ٧).
     *
     * @param int|null $byEpisodeId المدخل الخام الذي كشف أنها بطلت
     * @return bool هل كانت هناك علاقة قائمة فأُبطلت فعلاً
     */
    public function invalidateEdge(
        int $srcId,
        string $relType,
        int $dstId,
        ?int $byEpisodeId = null,
    ): bool;

    /**
     * العلاقات الخارجة من عقدة والداخلة إليها.
     *
     * @param bool $includeInvalidated true لعرض المُبطَلة أيضاً (المراجعة والتدقيق)
     * @return list<array{src_id:int,rel_type:string,dst_id:int,valid_until:string|null,episode_id:int|null}>
     */
    public function edgesOf(int $entityId, bool $includeInvalidated = false): array;

    /** يحدّث last_seen_at — مكوّن «حداثة المعلومة» بقرار العقل الميتا (قسم ٥) */
    public function touchEntity(int $id): void;
}

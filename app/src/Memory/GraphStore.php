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
     */
    public function createEntity(string $type, string $canonicalName, array $attrs = [], string $searchText = ''): int;

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
     * @param array<string,mixed> $attrs
     */
    public function addEdge(int $srcId, string $relType, int $dstId, array $attrs = []): void;

    /** يحدّث last_seen_at — مكوّن «حداثة المعلومة» بقرار العقل الميتا (قسم ٥) */
    public function touchEntity(int $id): void;
}

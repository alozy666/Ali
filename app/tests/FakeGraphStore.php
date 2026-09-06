<?php

declare(strict_types=1);

namespace App\Tests;

use App\Memory\GraphStore;

/**
 * مخزن في الذاكرة لاختبار منطق دمج الكيانات بلا قاعدة بيانات.
 *
 * وجوده هو الفائدة العملية من واجهة GraphStore (قسم ٣٨): منطق الدمج — أخطر
 * جزء بالنظام — يُختبر بمللي ثانية وبلا إعداد، على جهازك أو على الاستضافة.
 */
final class FakeGraphStore implements GraphStore
{
    private int $nextId = 1;

    /** @var array<int,array{id:int,type:string,canonical_name:string}> */
    private array $entities = [];

    /** @var array<string,list<int>> */
    private array $aliases = [];

    /** @var list<array{src:int,rel:string,dst:int}> */
    private array $edges = [];

    /** @var list<int> */
    public array $touched = [];

    public function findEntityIdsByAlias(string $aliasNorm): array
    {
        return $this->aliases[$aliasNorm] ?? [];
    }

    public function createEntity(string $type, string $canonicalName, array $attrs = [], string $searchText = ''): int
    {
        $id = $this->nextId++;
        $this->entities[$id] = [
            'id' => $id,
            'type' => $type,
            'canonical_name' => $canonicalName,
        ];

        return $id;
    }

    public function addAlias(int $entityId, string $alias, string $aliasNorm, string $lang): void
    {
        $existing = $this->aliases[$aliasNorm] ?? [];

        if (!in_array($entityId, $existing, true)) {
            $existing[] = $entityId;
        }

        $this->aliases[$aliasNorm] = $existing;
    }

    public function getEntity(int $id): ?array
    {
        return $this->entities[$id] ?? null;
    }

    public function getEntities(array $ids): array
    {
        $found = [];

        foreach ($ids as $id) {
            if (isset($this->entities[$id])) {
                $found[] = $this->entities[$id];
            }
        }

        return $found;
    }

    public function addEdge(int $srcId, string $relType, int $dstId, array $attrs = []): void
    {
        $this->edges[] = ['src' => $srcId, 'rel' => $relType, 'dst' => $dstId];
    }

    public function touchEntity(int $id): void
    {
        $this->touched[] = $id;
    }

    public function entityCount(): int
    {
        return count($this->entities);
    }

    /** @return list<array{src:int,rel:string,dst:int}> */
    public function edges(): array
    {
        return $this->edges;
    }
}

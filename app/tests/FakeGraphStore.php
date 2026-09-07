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

    /** @var list<array{src:int,rel:string,dst:int,valid_until:string|null,episode_id:int|null}> */
    private array $edges = [];

    /** @var array<int,int|null> */
    private array $entityEpisodes = [];

    /** @var list<int> */
    public array $touched = [];

    public function findEntityIdsByAlias(string $aliasNorm): array
    {
        return $this->aliases[$aliasNorm] ?? [];
    }

    public function createEntity(
        string $type,
        string $canonicalName,
        array $attrs = [],
        string $searchText = '',
        ?int $episodeId = null,
    ): int {
        $id = $this->nextId++;
        $this->entities[$id] = [
            'id' => $id,
            'type' => $type,
            'canonical_name' => $canonicalName,
        ];
        $this->entityEpisodes[$id] = $episodeId;

        return $id;
    }

    public function episodeOf(int $entityId): ?int
    {
        return $this->entityEpisodes[$entityId] ?? null;
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

    public function addEdge(
        int $srcId,
        string $relType,
        int $dstId,
        array $attrs = [],
        ?int $episodeId = null,
    ): void {
        if ($srcId === $dstId) {
            return;
        }

        // يحاكي ON DUPLICATE KEY بـ MySQL: صف واحد لكل ثلاثية، وإعادة
        // التأكيد تستعيد العلاقة المُبطَلة
        foreach ($this->edges as $i => $edge) {
            if ($edge['src'] === $srcId && $edge['rel'] === $relType && $edge['dst'] === $dstId) {
                $this->edges[$i]['valid_until'] = null;
                return;
            }
        }

        $this->edges[] = [
            'src' => $srcId,
            'rel' => $relType,
            'dst' => $dstId,
            'valid_until' => null,
            'episode_id' => $episodeId,
        ];
    }

    public function invalidateEdge(
        int $srcId,
        string $relType,
        int $dstId,
        ?int $byEpisodeId = null,
    ): bool {
        foreach ($this->edges as $i => $edge) {
            if ($edge['src'] !== $srcId || $edge['rel'] !== $relType || $edge['dst'] !== $dstId) {
                continue;
            }

            if ($edge['valid_until'] !== null) {
                return false; // مُبطَلة أصلاً
            }

            $this->edges[$i]['valid_until'] = date('Y-m-d H:i:s');

            return true;
        }

        return false;
    }

    public function edgesOf(int $entityId, bool $includeInvalidated = false): array
    {
        $found = [];

        foreach ($this->edges as $edge) {
            if ($edge['src'] !== $entityId && $edge['dst'] !== $entityId) {
                continue;
            }

            if (!$includeInvalidated && $edge['valid_until'] !== null) {
                continue;
            }

            $found[] = [
                'src_id' => $edge['src'],
                'rel_type' => $edge['rel'],
                'dst_id' => $edge['dst'],
                'valid_until' => $edge['valid_until'],
                'episode_id' => $edge['episode_id'],
            ];
        }

        return $found;
    }

    public function touchEntity(int $id): void
    {
        $this->touched[] = $id;
    }

    public function entityCount(): int
    {
        return count($this->entities);
    }

    /** @return list<array{src:int,rel:string,dst:int,valid_until:string|null,episode_id:int|null}> */
    public function edges(): array
    {
        return $this->edges;
    }
}

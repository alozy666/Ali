<?php

declare(strict_types=1);

namespace App\Queue;

final class Job
{
    /**
     * @param array<string,mixed> $payload
     */
    public function __construct(
        public readonly int $id,
        public readonly string $type,
        public readonly array $payload,
        public readonly int $attempts,
    ) {
    }

    public function int(string $key): int
    {
        return (int) ($this->payload[$key] ?? 0);
    }
}

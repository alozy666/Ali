<?php

declare(strict_types=1);

namespace App\Support;

use RuntimeException;

/**
 * قراءة الإعدادات من app/config/config.php بمسارات منقّطة.
 */
final class Config
{
    /** @var array<string,mixed>|null */
    private static ?array $data = null;

    /**
     * @param array<string,mixed> $data
     */
    public static function set(array $data): void
    {
        self::$data = $data;
    }

    public static function get(string $path, mixed $default = null): mixed
    {
        $data = self::all();
        $cursor = $data;

        foreach (explode('.', $path) as $segment) {
            if (!is_array($cursor) || !array_key_exists($segment, $cursor)) {
                return $default;
            }
            $cursor = $cursor[$segment];
        }

        return $cursor;
    }

    /**
     * مثل get() لكن ترمي استثناءً بدل إرجاع قيمة افتراضية.
     * تُستخدم للمفاتيح التي يكون غيابها خطأ إعداد لا حالة طبيعية.
     */
    public static function require(string $path): mixed
    {
        $value = self::get($path);

        if ($value === null || $value === '') {
            throw new RuntimeException("إعداد ناقص: {$path} — راجع app/config/config.php");
        }

        return $value;
    }

    /**
     * @return array<string,mixed>
     */
    public static function all(): array
    {
        if (self::$data !== null) {
            return self::$data;
        }

        $file = dirname(__DIR__, 2) . '/config/config.php';

        if (!is_file($file)) {
            throw new RuntimeException(
                'ملف الإعدادات غير موجود. انسخ app/config/config.sample.php إلى app/config/config.php'
            );
        }

        /** @var array<string,mixed> $loaded */
        $loaded = require $file;
        self::$data = $loaded;

        return self::$data;
    }
}

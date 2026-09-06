<?php

declare(strict_types=1);

namespace App\Support;

use PDO;

/**
 * اتصال PDO واحد مشترك.
 *
 * ERRMODE_EXCEPTION مقصود: الفشل الصامت بطبقة التخزين يعني عقداً ناقصة بالشبكة
 * المعرفية دون أن يلاحظ أحد — وهو أسوأ من التوقف بخطأ ظاهر.
 */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $host = (string) Config::get('db.host', 'localhost');
        $port = (int) Config::get('db.port', 3306);
        $name = (string) Config::require('db.name');
        $charset = (string) Config::get('db.charset', 'utf8mb4');

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset);

        self::$pdo = new PDO(
            $dsn,
            (string) Config::require('db.user'),
            (string) Config::get('db.pass', ''),
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                // false = عبارات محضّرة حقيقية بالسيرفر، لا محاكاة بالعميل.
                // يمنع فئة كاملة من ثغرات الحقن عند الوسائط الرقمية.
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );

        return self::$pdo;
    }

    public static function setPdo(PDO $pdo): void
    {
        self::$pdo = $pdo;
    }
}

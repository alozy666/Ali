<?php

declare(strict_types=1);

/**
 * محمّل الأصناف (Autoloader).
 *
 * يفضّل محمّل Composer إن وُجد، وإلا يرجع لمحمّل PSR-4 بسيط مكتوب هنا.
 * السبب: بعض خطط الاستضافة المشتركة بلا SSH، فلا يمكن تشغيل `composer install`
 * على السيرفر. عندها تُبنى `vendor/` محلياً وتُرفع — لكن حتى لو ما تيسّر ذلك،
 * كود المشروع نفسه (App\*) يبقى شغّالاً بلا Composer، ويسقط فقط ما يعتمد على
 * حزم خارجية (SDK النماذج ودفع الإشعارات).
 */

$vendorAutoload = dirname(__DIR__) . '/vendor/autoload.php';

if (is_file($vendorAutoload)) {
    require $vendorAutoload;
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/src/';

    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $path = $baseDir . str_replace('\\', '/', $relative) . '.php';

    if (is_file($path)) {
        require $path;
    }
});

<?php

declare(strict_types=1);

/**
 * واجهة HTTP الرفيعة — الملف الوحيد المكشوف على الويب.
 *
 * كل المنطق بـ app/ خارج جذر الموقع. هذا أهم إجراء أمني على استضافة مشتركة
 * (قسم ٩): ملفات الإعدادات والمفاتيح لا يمكن طلبها من المتصفح أصلاً، لا لأن
 * قاعدة إعادة كتابة تمنعها بل لأنها ليست تحت الجذر.
 *
 * بنية النشر المفترضة على hPanel:
 *   /home/USER/lifeos/app/          ← الكود (خارج الجذر)
 *   /home/USER/public_html/         ← محتويات هذا المجلد (public/)
 *
 * عدّل APP_PATH أدناه ليطابق مسارك الفعلي.
 */

const APP_PATH = __DIR__ . '/../app';

require APP_PATH . '/autoload.php';

use App\Kernel;
use App\Support\Config;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

/**
 * @param array<string,mixed> $payload
 */
function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * مصادقة مبدئية برمز ثابت.
 *
 * ⚠ غير كافية للإنتاج. قسم ٩ يشترط 2FA إلزامياً على كل نقطة دخول وانتهاء
 * صلاحية الجلسة بعد فترة عدم استخدام. أكمل هذا قبل إدخال أي بيانات حقيقية —
 * الشبكة المعرفية هنا تحتوي وضعك المالي وعلاقاتك، لا مجرد ملاحظات.
 */
function authenticate(): void
{
    $expected = (string) Config::get('security.api_token', '');
    $provided = $_SERVER['HTTP_X_API_TOKEN'] ?? '';

    if ($expected === '' || !is_string($provided) || !hash_equals($expected, $provided)) {
        respond(['error' => 'غير مصرّح'], 401);
    }
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rtrim($path, '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $kernel = Kernel::boot();

    // ── التقاط نص ────────────────────────────────────────────────────────
    // يرجع فوراً بعد الكتابة بقاعدة البيانات. لا انتظار لاستدعاء نموذج —
    // هذا ما يجعل الالتقاط لا يفشل حتى لو تعطّل كل مزوّد خارجي (قسم ١٠).
    if ($method === 'POST' && $path === '/api/capture/text') {
        authenticate();

        $input = json_decode(file_get_contents('php://input') ?: '{}', true);
        $body = is_array($input) ? (string) ($input['body'] ?? '') : '';

        if (trim($body) === '') {
            respond(['error' => 'النص فارغ'], 422);
        }

        $rawId = $kernel->capture()->captureText($body);

        respond(['ok' => true, 'raw_input_id' => $rawId, 'message' => 'تم الالتقاط'], 201);
    }

    // ── التقاط صوت ───────────────────────────────────────────────────────
    if ($method === 'POST' && $path === '/api/capture/voice') {
        authenticate();

        if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
            respond(['error' => 'لم يصل ملف صوتي'], 422);
        }

        $storage = (string) Config::get('runtime.storage_path', APP_PATH . '/storage');
        $dir = $storage . '/audio';

        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            respond(['error' => 'تعذّر تجهيز مجلد الصوت'], 500);
        }

        // اسم عشوائي: اسم الملف القادم من العميل لا يُوثق به إطلاقاً
        $target = sprintf('%s/%s.webm', $dir, bin2hex(random_bytes(16)));

        if (!move_uploaded_file($_FILES['audio']['tmp_name'], $target)) {
            respond(['error' => 'تعذّر حفظ التسجيل'], 500);
        }

        $rawId = $kernel->capture()->captureVoice($target);

        // التأكيد فوري (قسم ٨: «اهتزازتان كافيتان») — التفريغ يجري بالطابور
        respond(['ok' => true, 'raw_input_id' => $rawId, 'message' => 'تم استلام التسجيل'], 201);
    }

    // ── شاشة «اليوم» (قسم ١٢) ────────────────────────────────────────────
    if ($method === 'GET' && $path === '/api/today') {
        authenticate();

        $pdo = $kernel->pdo();

        // الأفعال الظاهرة فقط. الصامتة تبقى بالسجل العميق ولا تُعرض هنا —
        // قسم ٥: عرضها يعيد تشغيل ذهنه بما أراد التخلص منه.
        $recent = $pdo->query(
            "SELECT action_type, decision, created_at
             FROM actions
             WHERE visibility = 'visible'
               AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
             ORDER BY created_at DESC
             LIMIT 20"
        )->fetchAll();

        respond([
            'questions' => $kernel->questions()->open(10),
            'recent_actions' => $recent,
            'queue' => $kernel->queue()->stats(),
            // مؤشر التكلفة بزاوية الشاشة، من اليوم الأول (قسم ٣٦)
            'cost_month_usd' => round($kernel->costs()->monthToDateUsd(), 2),
            'cost_budget_usd' => (float) Config::get('llm.monthly_budget_usd', 25.0),
        ]);
    }

    // ── الإجابة على سؤال معلّق ───────────────────────────────────────────
    if ($method === 'POST' && $path === '/api/questions/answer') {
        authenticate();

        $input = json_decode(file_get_contents('php://input') ?: '{}', true);
        $id = is_array($input) ? (int) ($input['id'] ?? 0) : 0;
        $answer = is_array($input) ? (string) ($input['answer'] ?? '') : '';

        if ($id <= 0 || trim($answer) === '') {
            respond(['error' => 'معرّف أو إجابة ناقصة'], 422);
        }

        $kernel->questions()->answer($id, $answer);

        respond(['ok' => true]);
    }

    // ── تسجيل جهاز لإشعارات الويب ────────────────────────────────────────
    if ($method === 'POST' && $path === '/api/push/subscribe') {
        authenticate();

        $input = json_decode(file_get_contents('php://input') ?: '{}', true);

        $endpoint = is_array($input) ? (string) ($input['endpoint'] ?? '') : '';
        $p256dh = is_array($input) ? (string) ($input['keys']['p256dh'] ?? '') : '';
        $auth = is_array($input) ? (string) ($input['keys']['auth'] ?? '') : '';

        if ($endpoint === '' || $p256dh === '' || $auth === '') {
            respond(['error' => 'بيانات الاشتراك ناقصة'], 422);
        }

        $stmt = $kernel->pdo()->prepare(
            'INSERT INTO push_subscriptions (endpoint, p256dh, auth, device)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth)'
        );

        $stmt->execute([
            $endpoint,
            $p256dh,
            $auth,
            mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 64),
        ]);

        respond(['ok' => true], 201);
    }

    respond(['error' => 'المسار غير موجود'], 404);
} catch (Throwable $e) {
    // لا تُسرَّب تفاصيل الاستثناء للعميل — قد تكشف بنية القاعدة أو المسارات.
    error_log('[lifeos] ' . $e->getMessage());
    respond(['error' => 'خطأ داخلي'], 500);
}

<?php

declare(strict_types=1);

namespace App\Capture;

use App\Queue\JobQueue;
use PDO;
use RuntimeException;

/**
 * طبقة الالتقاط (قسم ١٠).
 *
 * المبدأ الجوهري بوثيقتك: «الالتقاط ما يفشل أبداً، حتى لو الذكاء فشل مؤقتاً».
 * لذلك هذا الصنف لا يستدعي Claude ولا Deepgram ولا أي API خارجي — كتابة
 * بقاعدة البيانات ثم مهمة بالطابور، وانتهى. لو كان Claude معطّلاً بالكامل،
 * تبقى كل مدخلاتك محفوظة وتُعالَج دفعة واحدة عند عودته.
 *
 * هذا هو الفصل الصارم الذي يجعل الطابور ضرورة معمارية لا تحسين أداء.
 */
final class CaptureService
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly JobQueue $queue,
    ) {
    }

    /** يلتقط نصاً ويعيد معرّف المدخل الخام */
    public function captureText(string $body, string $source = 'web'): int
    {
        $body = trim($body);

        if ($body === '') {
            throw new RuntimeException('نص فارغ');
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO raw_inputs (kind, body, source) VALUES (\'text\', ?, ?)'
        );
        $stmt->execute([$body, $source]);

        $rawId = (int) $this->pdo->lastInsertId();

        $this->queue->enqueue('extract_entities', ['raw_input_id' => $rawId]);

        return $rawId;
    }

    /**
     * يلتقط تسجيلاً صوتياً. لا تفريغ هنا — يُجدول كمهمة.
     *
     * ملاحظة قسم ٨: التأكيد للمستخدم يكون فورياً («تلقيت التسجيل») بمجرد
     * نجاح هذي الدالة، لا بعد اكتمال التفريغ. الانتظار حتى يرد Deepgram يحوّل
     * الالتقاط السريع إلى وقفة.
     */
    public function captureVoice(string $audioPath, string $source = 'web'): int
    {
        if (!is_readable($audioPath)) {
            throw new RuntimeException("ملف صوتي غير مقروء: {$audioPath}");
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO raw_inputs (kind, audio_path, source) VALUES (\'voice\', ?, ?)'
        );
        $stmt->execute([$audioPath, $source]);

        $rawId = (int) $this->pdo->lastInsertId();

        $this->queue->enqueue('transcribe', ['raw_input_id' => $rawId]);

        return $rawId;
    }
}

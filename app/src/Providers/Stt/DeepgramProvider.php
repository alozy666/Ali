<?php

declare(strict_types=1);

namespace App\Providers\Stt;

use App\Support\Config;
use RuntimeException;

/**
 * Deepgram Nova-3 عبر REST مباشرة (قسم ٨).
 *
 * لماذا الوضع الدفعي (pre-recorded) لا البث المباشر: قسم ٨ حسم أن التسجيل
 * بضغطة زر لا تسجيل محيطي مستمر، فالملف يصل كاملاً ولا حاجة لاتصال دائم.
 * وهذا ما يجعل الصوت ممكناً على استضافة مشتركة أصلاً — البث المباشر يتطلب
 * WebSocket مفتوحاً، وهو غير متاح هناك.
 *
 * فائدة جانبية: الوضع الدفعي أرخص من البث (~٠.٠٠٤٣$ مقابل ~٠.٠٠٧٧$ للدقيقة).
 */
final class DeepgramProvider implements SttProvider
{
    private const ENDPOINT = 'https://api.deepgram.com/v1/listen';

    public function transcribe(string $audioPath): string
    {
        if (!is_readable($audioPath)) {
            throw new RuntimeException("ملف صوتي غير مقروء: {$audioPath}");
        }

        $audio = file_get_contents($audioPath);

        if ($audio === false || $audio === '') {
            throw new RuntimeException("ملف صوتي فارغ: {$audioPath}");
        }

        $query = http_build_query([
            'model' => (string) Config::get('stt.model', 'nova-3'),
            // 'multi' يسمح بتبديل اللغة داخل الجملة الواحدة — وهو النمط الفعلي
            // للكلام هنا: لهجة خليجية بمصطلحات إنجليزية متداخلة (قسم ٣٢).
            'language' => (string) Config::get('stt.language', 'multi'),
            'smart_format' => 'true',
            'punctuate' => 'true',
        ]);

        $ch = curl_init(self::ENDPOINT . '?' . $query);

        if ($ch === false) {
            throw new RuntimeException('تعذّر تهيئة cURL');
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $audio,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_HTTPHEADER => [
                'Authorization: Token ' . (string) Config::require('stt.api_key'),
                'Content-Type: ' . self::mimeFor($audioPath),
            ],
        ]);

        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            throw new RuntimeException("فشل الاتصال بـ Deepgram: {$error}");
        }

        if ($status !== 200) {
            throw new RuntimeException("Deepgram أرجع {$status}: " . substr((string) $body, 0, 200));
        }

        /** @var array<string,mixed>|null $decoded */
        $decoded = json_decode((string) $body, true);

        return self::extractTranscript($decoded);
    }

    /**
     * @param array<string,mixed>|null $payload
     */
    private static function extractTranscript(?array $payload): string
    {
        $transcript = $payload['results']['channels'][0]['alternatives'][0]['transcript'] ?? '';

        return is_string($transcript) ? trim($transcript) : '';
    }

    private static function mimeFor(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'wav' => 'audio/wav',
            'mp3' => 'audio/mpeg',
            'm4a', 'mp4' => 'audio/mp4',
            'ogg', 'opus' => 'audio/ogg',
            default => 'audio/webm', // ما يسجّله المتصفح افتراضياً
        };
    }
}

<?php

declare(strict_types=1);

namespace App\Queue\Handlers;

use App\Providers\Stt\SttProvider;
use App\Queue\Job;
use App\Queue\JobHandler;
use App\Queue\JobQueue;
use PDO;
use RuntimeException;

/**
 * تفريغ التسجيل الصوتي ثم تمريره لاستخراج الكيانات (قسم ٨).
 *
 * مهمتان منفصلتان لا واحدة: لو نجح التفريغ وفشل الاستخراج (انقطاع Claude
 * مثلاً)، لا نُعيد دفع الصوت لـ Deepgram ونُحاسَب عليه مرة أخرى. الفصل هنا
 * يوفّر مالاً حقيقياً عند كل إعادة محاولة.
 */
final class TranscribeHandler implements JobHandler
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly SttProvider $stt,
        private readonly JobQueue $queue,
    ) {
    }

    public function type(): string
    {
        return 'transcribe';
    }

    public function handle(Job $job): void
    {
        $rawId = $job->int('raw_input_id');

        $stmt = $this->pdo->prepare('SELECT audio_path FROM raw_inputs WHERE id = ?');
        $stmt->execute([$rawId]);
        $audioPath = $stmt->fetchColumn();

        if ($audioPath === false || !is_string($audioPath) || $audioPath === '') {
            throw new RuntimeException("لا مسار صوتي للمدخل {$rawId}");
        }

        $transcript = $this->stt->transcribe($audioPath);

        if ($transcript === '') {
            // تسجيل صامت أو ضجيج. نعلّمه معالَجاً ولا نُدخله الشبكة —
            // قسم ٣٤: لا يُخزَّن كل ما يمر، بل ما له صلة فعلية.
            $done = $this->pdo->prepare(
                'UPDATE raw_inputs SET processed_at = NOW() WHERE id = ?'
            );
            $done->execute([$rawId]);

            return;
        }

        $update = $this->pdo->prepare('UPDATE raw_inputs SET body = ? WHERE id = ?');
        $update->execute([$transcript, $rawId]);

        $this->queue->enqueue('extract_entities', ['raw_input_id' => $rawId]);
    }
}

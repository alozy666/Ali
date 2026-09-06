<?php

declare(strict_types=1);

namespace App\Providers\Stt;

/**
 * الطبقة الوسيطة لتحويل الصوت لنص (قسم ٣٨).
 *
 * قسم ٨ يرشّح Deepgram Nova-3 ويذكر Munsit كبديل خليجي يستاهل المتابعة «لو
 * ظهرت تعابير بحرينية محددة يتعثر فيها». هذي الواجهة هي ما يجعل تلك التجربة
 * تبديل صنف واحد بدل إعادة كتابة، وتسمح بتشغيل الاثنين جنباً لجنب للمقارنة.
 */
interface SttProvider
{
    /**
     * @param string $audioPath مسار الملف الصوتي على القرص
     * @return string النص المفرَّغ (سلسلة فارغة إن لم يُستخرج شيء)
     */
    public function transcribe(string $audioPath): string;
}

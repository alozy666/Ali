<?php

declare(strict_types=1);

namespace App\Providers\Llm;

/**
 * الطبقة الوسيطة لمزوّد النماذج (قسم ٣٨).
 *
 * لا يستدعي أي جزء من النظام مزوّد النماذج مباشرة. الفائدة ليست نظرية:
 * قسم ٣٦ يجعل توزيع النماذج شرطاً إلزامياً، وهذي الواجهة هي المكان الوحيد
 * الذي يعرف أي نموذج لأي مهمة — فتغيير التوزيع تعديل بملف إعدادات واحد.
 */
interface LlmProvider
{
    /**
     * @param 'light'|'standard'|'deep' $tier
     *        light    = استخراج وتصنيف وفرز (~٩٠٪ من العمل)
     *        standard = ردود ومحادثة
     *        deep     = قرارات مركّبة وتحليل مالي
     */
    public function complete(
        string $system,
        string $user,
        string $tier = 'light',
        int $maxTokens = 4096,
        string $purpose = 'extract',
    ): LlmResponse;
}

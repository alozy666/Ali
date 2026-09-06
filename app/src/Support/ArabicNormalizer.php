<?php

declare(strict_types=1);

namespace App\Support;

/**
 * تطبيع النصوص العربية والإنجليزية لأغراض المطابقة.
 *
 * هذا الصنف هو حجر الأساس لدمج الكيانات (قسم ٧: «أصعب نقطة تقنياً») ولثنائية
 * اللغة (قسم ٣٢: «أخطر نقطة»). وظيفته توليد مفتاح مطابقة ثابت، بحيث تعطي كل
 * الصيغ الإملائية لنفس الاسم مفتاحاً واحداً.
 *
 * ما يفعله ولا يفعله — تمييز مهم:
 * - يوحّد صيغ الكتابة داخل اللغة الواحدة: «ناشِر» و«نَاشِر» و«ناشر» ← مفتاح واحد.
 * - لا يوحّد عبر اللغتين: «زينب» و«Zainab» يبقيان مفتاحين مختلفين، لأن ربطهما
 *   ترجمة لا تطبيع. الربط بينهما وظيفة جدول entity_aliases: كلا المفتاحين
 *   يشيران لنفس entity_id. هذا هو الحل المذكور بقسم ٣٢ حرفياً: «اسم أساسي
 *   واحد + قائمة أسماء بديلة بكل صيغها ولغاتها».
 *
 * التطبيع مُتعمَّد العدوانية (حذف الهمزة، توحيد التاء المربوطة). سببه أن الخطأ
 * الأسوأ هنا هو تكرار العقدة لا دمجها: العقد المكررة تكسر الشبكة بصمت، بينما
 * الدمج الخاطئ يظهر للمستخدم بسرعة ويُصحَّح.
 */
final class ArabicNormalizer
{
    /** تطويل الحروف — بلا أي معنى دلالي */
    private const TATWEEL = "\u{0640}";

    /**
     * علامات التشكيل: الفتحة والضمة والكسرة والتنوين والشدة والسكون،
     * بالإضافة للألف الخنجرية وعلامات التلاوة.
     */
    private const DIACRITICS = '/[\x{064B}-\x{065F}\x{0670}\x{06D6}-\x{06ED}]/u';

    /** كل صور الألف: آ أ إ ٱ */
    private const ALEF_FORMS = '/[\x{0622}\x{0623}\x{0625}\x{0671}]/u';

    private const ALEF = "\u{0627}";
    private const YA = "\u{064A}";
    private const HA = "\u{0647}";
    private const WAW = "\u{0648}";

    /**
     * يولّد مفتاح المطابقة. النتيجة صالحة للتخزين بعمود `alias_norm`
     * والبحث عليه بفهرس.
     */
    public static function normalize(string $text): string
    {
        $t = $text;

        // ترتيب الخطوات مقصود: التشكيل يُحذف قبل توحيد الحروف، وإلا بقيت
        // الحركة ملتصقة بحرف تغيّر شكله فاختلف المفتاح.
        $t = str_replace(self::TATWEEL, '', $t);
        $t = self::pregReplace(self::DIACRITICS, '', $t);

        // توحيد صور الألف: «إبراهيم» و«ابراهيم» ← مفتاح واحد
        $t = self::pregReplace(self::ALEF_FORMS, self::ALEF, $t);

        // الألف المقصورة ← ياء: «مصطفى» و«مصطفي»
        $t = str_replace("\u{0649}", self::YA, $t);

        // التاء المربوطة ← هاء: «مكتبة» و«مكتبه»
        $t = str_replace("\u{0629}", self::HA, $t);

        // حاملات الهمزة ← أصولها: «مؤسسة»/«موسسة»، «رئيس»/«رييس»
        $t = str_replace(["\u{0624}", "\u{0626}"], [self::WAW, self::YA], $t);

        // الهمزة المفردة تُحذف: «أسماء» و«اسما» ← مفتاح واحد
        $t = str_replace("\u{0621}", '', $t);

        $t = self::toAsciiDigits($t);

        // الترقيم والرموز تصير فواصل، لا تُحذف — وإلا التصق ما حولها.
        // «مشروع-ناشر» و«مشروع ناشر» ← مفتاح واحد.
        $t = self::pregReplace('/[\p{P}\p{S}]+/u', ' ', $t);

        $t = mb_strtolower($t, 'UTF-8');

        $t = self::pregReplace('/\s+/u', ' ', $t);

        return trim($t);
    }

    /**
     * تخمين لغة النص لتسجيلها بعمود `lang`. تخمين إرشادي فقط — التخزين
     * الداخلي موحّد بالإنجليزية على أي حال (قسم ٣٢، النقطة ٢).
     */
    public static function detectLanguage(string $text): string
    {
        if (preg_match('/\p{Arabic}/u', $text) === 1) {
            return 'ar';
        }

        if (preg_match('/[A-Za-z]/', $text) === 1) {
            return 'en';
        }

        return 'other';
    }

    /**
     * يبني نص البحث المخزَّن بعمود `entities.search_text`، وهو المرحلة الأولى
     * من الاسترجاع قبل تفعيل المتجهات.
     *
     * @param list<string> $parts
     */
    public static function buildSearchText(array $parts): string
    {
        $normalized = [];

        foreach ($parts as $part) {
            $value = self::normalize($part);
            if ($value !== '') {
                $normalized[$value] = true;
            }
        }

        return implode(' ', array_keys($normalized));
    }

    /** يحوّل الأرقام العربية-الهندية بصيغتيها إلى أرقام لاتينية */
    private static function toAsciiDigits(string $text): string
    {
        $from = [];
        $to = [];

        for ($i = 0; $i <= 9; $i++) {
            // ٠-٩ (U+0660..U+0669) و ۰-۹ (U+06F0..U+06F9)
            $from[] = mb_chr(0x0660 + $i, 'UTF-8');
            $to[] = (string) $i;
            $from[] = mb_chr(0x06F0 + $i, 'UTF-8');
            $to[] = (string) $i;
        }

        return str_replace($from, $to, $text);
    }

    /**
     * preg_replace ترجع null عند فشل الـ regex. الفشل هنا يعني مفتاح مطابقة
     * خاطئ، وهو يلوّث الشبكة بصمت — فنُبقي النص الأصلي بدل تمرير null.
     */
    private static function pregReplace(string $pattern, string $replacement, string $subject): string
    {
        $result = preg_replace($pattern, $replacement, $subject);

        return $result ?? $subject;
    }
}

<?php

declare(strict_types=1);

namespace App\Memory;

use App\Support\ArabicNormalizer;

/**
 * دمج الكيانات بالشبكة الموجودة (قسم ٧، الخطوة ٣ من خط الإدخال).
 *
 * وثيقتك تصف هذي بأنها «أصعب نقطة تقنياً وتستاهل اهتماماً خاصاً، لأن الخطأ
 * فيها يلوّث الشبكة بعقد مكررة بدل موحدة». وقسم ٣٢ يضاعفها: نفس الشخص يُذكر
 * بالعربي مرة وبالإنجليزي مرة.
 *
 * الآلية:
 *   1. كل صيغة اسم (الأساسي + البدائل) تُطبَّع لمفتاح مطابقة.
 *   2. تُجمع كل العقد التي تشير إليها هذي المفاتيح.
 *   3. تُصفّى بالنوع — «زينب» الشخص لا تُدمج مع «زينب» المشروع.
 *   4. صفر ← إنشاء | واحد ← ربط | أكثر ← سؤال.
 *
 * الربط عبر اللغتين يحصل هنا: حين يستخرج النموذج «زينب (Zainab)» تصل الصيغتان
 * معاً، فتُسجّلان أليساً لنفس العقدة. وبعدها أي ذكر لأي منهما منفرداً يصل لنفس
 * الكيان. هذا يعني أن جودة الشبكة تعتمد على تمرير الأسماء البديلة عند أول ذكر
 * — لذلك تطلبها موجّهات الاستخراج صراحةً.
 */
final class EntityResolver
{
    public function __construct(
        private readonly GraphStore $store,
    ) {
    }

    /**
     * @param list<string> $aliases صيغ إضافية للاسم نفسه (ترجمة، اختصار، كنية)
     * @param array<string,mixed> $attrs
     */
    public function resolve(string $name, string $type, array $aliases = [], array $attrs = []): Resolution
    {
        $forms = $this->normalizedForms($name, $aliases);

        if ($forms === []) {
            // اسم فارغ أو ترقيم فقط — لا يصلح عقدة
            return Resolution::ambiguous([]);
        }

        $candidateIds = [];
        foreach ($forms as $normalized) {
            foreach ($this->store->findEntityIdsByAlias($normalized) as $id) {
                $candidateIds[$id] = true;
            }
        }

        /** @var list<int> $ids */
        $ids = array_map('intval', array_keys($candidateIds));

        if ($ids === []) {
            return Resolution::created($this->create($name, $type, $aliases, $attrs));
        }

        // التصفية بالنوع تحل أغلب الغموض بلا إزعاجه: مشروع اسمه «ناشِر» وشخص
        // اسمه «ناشر» كيانان مختلفان، والنوع يفرّقهما بلا سؤال.
        $matching = array_values(array_filter(
            $this->store->getEntities($ids),
            static fn (array $entity): bool => $entity['type'] === $type
        ));

        if (count($matching) === 1) {
            $entityId = $matching[0]['id'];
            $this->store->touchEntity($entityId);
            $this->attachMissingAliases($entityId, $name, $aliases);

            return Resolution::resolved($entityId);
        }

        if ($matching === []) {
            // المفتاح موجود لكن لنوع آخر — كيان جديد، لا دمج
            return Resolution::created($this->create($name, $type, $aliases, $attrs));
        }

        return Resolution::ambiguous($matching);
    }

    /**
     * يضيف صيغة اسم جديدة لعقدة معروفة. يُستخدم عند حسم غموض سابق، أو حين
     * يكتشف النظام لاحقاً أن «Nashir» و«ناشِر» شيء واحد.
     */
    public function attachAlias(int $entityId, string $alias): void
    {
        $normalized = ArabicNormalizer::normalize($alias);

        if ($normalized === '') {
            return;
        }

        $this->store->addAlias(
            $entityId,
            $alias,
            $normalized,
            ArabicNormalizer::detectLanguage($alias)
        );
    }

    /**
     * @param list<string> $aliases
     * @param array<string,mixed> $attrs
     */
    private function create(string $name, string $type, array $aliases, array $attrs): int
    {
        $rawForms = [$name, ...$aliases];

        $searchText = ArabicNormalizer::buildSearchText($rawForms);
        $entityId = $this->store->createEntity($type, $name, $attrs, $searchText);

        // كل صيغة تُسجَّل أليساً، لا الاسم الأساسي وحده.
        // إغفال هذا يعني أن «زينب (Zainab)» تُنشئ عقدة يصلها العربي فقط، ثم
        // يُنشئ أول ذكر إنجليزي عقدة ثانية — وهو بالضبط تلويث الشبكة بعقد
        // مكررة الذي تحذّر منه وثيقتك بقسم ٧.
        foreach ($rawForms as $form) {
            $this->attachAlias($entityId, $form);
        }

        return $entityId;
    }

    /**
     * @param list<string> $aliases
     */
    private function attachMissingAliases(int $entityId, string $name, array $aliases): void
    {
        // addAlias يعتمد على UNIQUE(alias_norm, entity_id) فالتكرار لا يضر
        foreach ([$name, ...$aliases] as $form) {
            $this->attachAlias($entityId, $form);
        }
    }

    /**
     * @param list<string> $aliases
     * @return list<string>
     */
    private function normalizedForms(string $name, array $aliases): array
    {
        $forms = [];

        foreach ([$name, ...$aliases] as $form) {
            $normalized = ArabicNormalizer::normalize($form);
            if ($normalized !== '') {
                $forms[$normalized] = true;
            }
        }

        return array_keys($forms);
    }
}

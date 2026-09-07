<?php

declare(strict_types=1);

/**
 * مشغّل اختبارات بسيط بلا أي حزمة خارجية.
 *
 * التشغيل:  php app/tests/run_tests.php
 *
 * لا PHPUnit عمداً: يجب أن تبقى هذي الاختبارات قابلة للتشغيل على الاستضافة
 * المشتركة نفسها عبر SSH، حيث قد لا يتوفر Composer. الاختبار الذي لا يمكن
 * تشغيله بالبيئة الحقيقية لا يطمئنك عليها.
 */

require __DIR__ . '/../autoload.php';
require __DIR__ . '/FakeGraphStore.php';

use App\Memory\EntityResolver;
use App\Memory\ResolutionStatus;
use App\Providers\Llm\LlmResponse;
use App\Support\ArabicNormalizer;
use App\Tests\FakeGraphStore;

$passed = 0;
$failed = 0;

function check(string $label, mixed $actual, mixed $expected): void
{
    global $passed, $failed;

    if ($actual === $expected) {
        $passed++;
        echo "  \u{2713} {$label}\n";

        return;
    }

    $failed++;
    echo "  \u{2717} {$label}\n";
    echo "      المتوقع: " . var_export($expected, true) . "\n";
    echo "      الناتج : " . var_export($actual, true) . "\n";
}

function section(string $title): void
{
    echo "\n{$title}\n";
}

// ═══════════════════════════════════════════════════════════════════════
section('تطبيع النص — توحيد صيغ الكتابة داخل اللغة الواحدة');

$sameKey = static fn (string $a, string $b): bool
    => ArabicNormalizer::normalize($a) === ArabicNormalizer::normalize($b);

// حالات من وثيقتك مباشرة (قسم ٣٢): ناشِر / Nashir
check('«ناشِر» = «ناشر» (كسرة)', $sameKey('ناشِر', 'ناشر'), true);
check('«نَاشِر» = «ناشر» (فتحة وكسرة)', $sameKey('نَاشِر', 'ناشر'), true);
check('«زَيْنَب» = «زينب» (تشكيل كامل)', $sameKey('زَيْنَب', 'زينب'), true);
check('«عليّ» = «علي» (شدة)', $sameKey('عليّ', 'علي'), true);

check('«إبراهيم» = «ابراهيم» (همزة تحت الألف)', $sameKey('إبراهيم', 'ابراهيم'), true);
check('«أحمد» = «احمد» (همزة فوق الألف)', $sameKey('أحمد', 'احمد'), true);
check('«آمال» = «امال» (ألف ممدودة)', $sameKey('آمال', 'امال'), true);

check('«مصطفى» = «مصطفي» (ألف مقصورة)', $sameKey('مصطفى', 'مصطفي'), true);
check('«مكتبة» = «مكتبه» (تاء مربوطة)', $sameKey('مكتبة', 'مكتبه'), true);
check('«مؤسسة» = «موسسه» (همزة على واو)', $sameKey('مؤسسة', 'موسسه'), true);

check('التطويل يُحذف', $sameKey("نــــاشر", 'ناشر'), true);
check('«مشروع-ناشر» = «مشروع ناشر» (شرطة)', $sameKey('مشروع-ناشر', 'مشروع ناشر'), true);
check('المسافات الزائدة تُهمل', ArabicNormalizer::normalize('  ناشر   الجديد  '), 'ناشر الجديد');

check('«Nashir» = «nashir» (حالة الأحرف)', $sameKey('Nashir', 'nashir  '), true);
check('«UpMedia» تُطبَّع', ArabicNormalizer::normalize('UpMedia'), 'upmedia');
check('الأرقام العربية تصير لاتينية', ArabicNormalizer::normalize('مشروع ٢٠٢٦'), 'مشروع 2026');

// ═══════════════════════════════════════════════════════════════════════
section('حدود التطبيع — ما لا يفعله عمداً');

// هذي ليست عيباً بل تصميماً: ربط العربي بالإنجليزي ترجمة لا تطبيع،
// ووظيفة جدول entity_aliases لا وظيفة هذا الصنف (قسم ٣٢).
check('«زينب» ≠ «Zainab» بالتطبيع وحده', $sameKey('زينب', 'Zainab'), false);
check('اسمان مختلفان يبقيان مختلفين', $sameKey('ناشر', 'باسم'), false);
check('نص فارغ يعطي مفتاحاً فارغاً', ArabicNormalizer::normalize('   '), '');
check('الترقيم وحده يعطي مفتاحاً فارغاً', ArabicNormalizer::normalize('!!! ---'), '');

check('كشف اللغة: عربي', ArabicNormalizer::detectLanguage('ناشر'), 'ar');
check('كشف اللغة: إنجليزي', ArabicNormalizer::detectLanguage('Nashir'), 'en');

// ═══════════════════════════════════════════════════════════════════════
section('دمج الكيانات — الحالة الحاسمة بقسم ٧ و٣٢');

$store = new FakeGraphStore();
$resolver = new EntityResolver($store);

// أول ذكر: الاسم بالعربي مع صيغته الإنجليزية كأليس
$first = $resolver->resolve('زينب', 'person', ['Zainab']);
check('أول ذكر ينشئ عقدة', $first->status, ResolutionStatus::Created);

// ذكر لاحق بالإنجليزي وحده — يجب أن يصل لنفس العقدة، لا ينشئ ثانية
$second = $resolver->resolve('Zainab', 'person');
check('الذكر الإنجليزي يصل لنفس العقدة', $second->status, ResolutionStatus::Resolved);
check('نفس المعرّف عبر اللغتين', $second->entityId, $first->entityId);
check('لم تُنشأ عقدة مكررة', $store->entityCount(), 1);

// ذكر ثالث بالعربي بتشكيل مختلف
$third = $resolver->resolve('زَيْنَب', 'person');
check('التشكيل لا يكسر الربط', $third->entityId, $first->entityId);
check('العدد ما زال واحداً', $store->entityCount(), 1);

// حالة «ناشِر» من وثيقتك — مشروع لا شخص
$projectAr = $resolver->resolve('ناشِر', 'project', ['Nashir', 'نشر']);
check('المشروع كيان جديد', $projectAr->status, ResolutionStatus::Created);
$projectEn = $resolver->resolve('Nashir', 'project');
check('«Nashir» يصل لعقدة المشروع', $projectEn->entityId, $projectAr->entityId);
check('المجموع عقدتان فقط', $store->entityCount(), 2);

// ═══════════════════════════════════════════════════════════════════════
section('فصل الأنواع — الاسم نفسه لنوعين مختلفين');

$personNashir = $resolver->resolve('ناشر', 'person');
check(
    'شخص اسمه «ناشر» لا يُدمج مع مشروع «ناشِر»',
    $personNashir->status,
    ResolutionStatus::Created
);
check('صارت ثلاث عقد', $store->entityCount(), 3);
check(
    'ولا يزال المشروع يُسترجع صحيحاً',
    $resolver->resolve('Nashir', 'project')->entityId,
    $projectAr->entityId
);

// ═══════════════════════════════════════════════════════════════════════
section('الغموض — أكثر من مرشّح لنفس النوع');

$ambiguousStore = new FakeGraphStore();
$ambiguousResolver = new EntityResolver($ambiguousStore);

$friend = $ambiguousResolver->resolve('علي', 'person');
$clientId = $ambiguousStore->createEntity('person', 'علي العميل');
$ambiguousStore->addAlias($clientId, 'علي', ArabicNormalizer::normalize('علي'), 'ar');

$ambiguous = $ambiguousResolver->resolve('علي', 'person');
check('مرشّحان لنفس النوع ← غموض', $ambiguous->status, ResolutionStatus::Ambiguous);
check('لا يُختار كيان بالتخمين', $ambiguous->hasEntity(), false);
check('يُعرض المرشّحان للقرار', count($ambiguous->candidates), 2);

// ═══════════════════════════════════════════════════════════════════════
section('ربط أليس لاحقاً — بعد حسم غموض أو اكتشاف ترجمة');

$lateStore = new FakeGraphStore();
$lateResolver = new EntityResolver($lateStore);

$upmedia = $lateResolver->resolve('UpMedia', 'project');

// الفحص «قبل» يقرأ المخزن مباشرة ولا يمر بـ resolve — لأن resolve تنشئ عقدة
// عند عدم الإيجاد، فتصنع بنفسها التكرار الذي نختبر منعه.
check(
    'قبل الربط: لا أليس عربي لهذي العقدة',
    $lateStore->findEntityIdsByAlias(ArabicNormalizer::normalize('أب ميديا')),
    []
);

$lateResolver->attachAlias($upmedia->entityId ?? 0, 'أب ميديا');

check(
    'بعد الربط: العربي يصل للعقدة الإنجليزية',
    $lateResolver->resolve('اب ميديا', 'project')->entityId,
    $upmedia->entityId
);
check('ولم تُنشأ عقدة ثانية', $lateStore->entityCount(), 1);

// ═══════════════════════════════════════════════════════════════════════
section('النموذج ثنائي الزمن — الحقيقة تُنسخ ولا تُمحى');

$biStore = new FakeGraphStore();
$biResolver = new EntityResolver($biStore);

// المدخل الخام ٧ يذكر أن علياً يعمل بمشروع «ناشر»
$person = $biResolver->resolve('علي', 'person', [], [], 7);
$projectA = $biResolver->resolve('ناشر', 'project', [], [], 7);

check('العقدة تحفظ مصدرها الخام', $biStore->episodeOf($person->entityId ?? 0), 7);

$biStore->addEdge($person->entityId ?? 0, 'belongs_to', $projectA->entityId ?? 0, [], 7);

$active = $biStore->edgesOf($person->entityId ?? 0);
check('العلاقة قائمة بعد إثباتها', count($active), 1);
check('العلاقة تحفظ مصدرها', $active[0]['episode_id'], 7);
check('العلاقة القائمة بلا تاريخ إبطال', $active[0]['valid_until'], null);

// لاحقاً — المدخل ٩ يكشف أنه ترك المشروع
$invalidated = $biStore->invalidateEdge(
    $person->entityId ?? 0,
    'belongs_to',
    $projectA->entityId ?? 0,
    9
);
check('الإبطال نجح', $invalidated, true);
check('اختفت من الاسترجاع الافتراضي', count($biStore->edgesOf($person->entityId ?? 0)), 0);
check(
    'لكنها لم تُحذف — تظهر بالمراجعة',
    count($biStore->edgesOf($person->entityId ?? 0, true)),
    1
);

// إبطال ما هو مُبطَل أصلاً لا يغيّر شيئاً (آمن عند التكرار)
check(
    'إبطال المُبطَل يرجع false',
    $biStore->invalidateEdge($person->entityId ?? 0, 'belongs_to', $projectA->entityId ?? 0, 9),
    false
);

// إعادة التأكيد تستعيد العلاقة — ذكرها من جديد تأكيد لصحتها
$biStore->addEdge($person->entityId ?? 0, 'belongs_to', $projectA->entityId ?? 0, [], 11);
check(
    'إعادة التأكيد تستعيد العلاقة',
    count($biStore->edgesOf($person->entityId ?? 0)),
    1
);
check('ولا تُنشئ صفاً مكرراً', count($biStore->edges()), 1);

// ═══════════════════════════════════════════════════════════════════════
section('قراءة رد النموذج — التسامح مع مخرجات غير نظيفة');

// النماذج تخالف تعليمة «JSON فقط» أحياناً. التعامل مع هذا مرة واحدة بمكان
// واحد أفضل من انهيار مهمة استخراج بسبب سياج كود.
$clean = new LlmResponse('{"entities":[],"relations":[]}', 'test');
check('JSON نظيف', $clean->json(), ['entities' => [], 'relations' => []]);

$fenced = new LlmResponse("```json\n{\"entities\":[]}\n```", 'test');
check('محاط بسياج ```json', $fenced->json(), ['entities' => []]);

$chatty = new LlmResponse("تفضل النتيجة:\n{\"entities\":[]}\nأتمنى أن تفيدك.", 'test');
check('مع تمهيد وخاتمة نصية', $chatty->json(), ['entities' => []]);

$arabicValues = new LlmResponse('{"name":"ناشِر"}', 'test');
check('يحافظ على العربية', $arabicValues->json(), ['name' => 'ناشِر']);

$broken = new LlmResponse('عذراً، لا أستطيع.', 'test');
check('نص بلا JSON ← null لا انهيار', $broken->json(), null);

$malformed = new LlmResponse('{"entities": [', 'test');
check('JSON ناقص ← null', $malformed->json(), null);

// ═══════════════════════════════════════════════════════════════════════
echo "\n" . str_repeat('─', 56) . "\n";
echo "نجح: {$passed}   فشل: {$failed}\n";

exit($failed === 0 ? 0 : 1);

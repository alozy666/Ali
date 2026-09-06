-- Personal Life OS — المخطط الأولي (MySQL 8.0+)
--
-- يغطي المرحلتين ٠-١ من تسلسل البناء (قسم ١٥): البنية التحتية، ثم الالتقاط
-- والذاكرة. جداول الصلاحيات وسجل الأفعال موجودة من الآن لأن قسم ٢٠ يشترط أن
-- يُخزَّن سبب كل فعل معه لحظة تنفيذه — إضافتها لاحقاً تعني أفعالاً بلا سبب مسجّل.
--
-- المتطلبات: MySQL 8.0+ (لأجل WITH RECURSIVE بالتنقل عبر العلاقات).
-- التحقق: SELECT VERSION();

SET NAMES utf8mb4;
SET time_zone = '+03:00';

-- ═════════════════════════════════════════════════════════════════════════
-- طبقة الالتقاط (قسم ١٠)
-- هذي الجداول لا تعتمد على أي API خارجي. الكتابة فيها تنجح حتى لو تعطّل
-- Claude وDeepgram معاً — وهذا نص المبدأ الجوهري: «الالتقاط ما يفشل أبداً».
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE raw_inputs (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    kind         ENUM('text','voice') NOT NULL,
    body         MEDIUMTEXT NULL COMMENT 'النص، أو التفريغ بعد وصوله',
    audio_path   VARCHAR(255) NULL COMMENT 'مسار الملف الصوتي قبل التفريغ',
    source       VARCHAR(32) NOT NULL DEFAULT 'web',
    captured_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL COMMENT 'NULL = لم يدخل الشبكة المعرفية بعد',
    PRIMARY KEY (id),
    KEY idx_unprocessed (processed_at, captured_at),
    FULLTEXT KEY ft_body (body)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- الطابور الوسيط الذي يفصل الالتقاط عن المعالجة الذكية (قسم ١٠).
-- بديل Celery+Redis: صف واحد = مهمة واحدة، وcron هو المستهلك.
CREATE TABLE jobs (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    type        VARCHAR(48) NOT NULL,
    payload     JSON NOT NULL,
    status      ENUM('pending','running','done','failed') NOT NULL DEFAULT 'pending',
    attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    last_error  TEXT NULL,
    run_after   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at   DATETIME NULL COMMENT 'لاستعادة المهام العالقة إذا قُتل التشغيل',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_claimable (status, run_after, id),
    KEY idx_stuck (status, locked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═════════════════════════════════════════════════════════════════════════
-- الشبكة المعرفية (قسم ٧)
-- بديل Neo4j. العقد والعلاقات جداول عادية، والتنقل عبر WITH RECURSIVE.
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE entities (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    type           VARCHAR(32) NOT NULL COMMENT 'person|project|task|decision|financial_event|skill|note',
    canonical_name VARCHAR(255) NOT NULL COMMENT 'الاسم الأساسي — الأسماء البديلة بجدول entity_aliases',
    attrs          JSON NULL COMMENT 'خصائص مرنة؛ يقابل مرونة Graph DB بلا تعديل هيكلي',
    search_text    TEXT NULL COMMENT 'نص مطبّع للبحث — المرحلة ١ من الاسترجاع',

    -- الذاكرة المضيئة والمظلمة (قسم ٧): العقد لا تُحذف، يقلّ وزنها.
    weight         FLOAT NOT NULL DEFAULT 1.0,
    state          ENUM('active','shadow') NOT NULL DEFAULT 'active',

    -- حداثة المعلومة — أحد مكوّنات قرار العقل الميتا الأربعة (قسم ٥)
    last_seen_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_type_state (type, state),
    KEY idx_freshness (last_seen_at),
    FULLTEXT KEY ft_search (search_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- قلب دمج الكيانات (قسم ٧ «أصعب نقطة تقنياً» + قسم ٣٢ ثنائية اللغة).
--
-- قرار تصميم مقصود: `alias_norm` ليس فريداً على مستوى الجدول.
-- لو جعلناه فريداً عالمياً، أي اسم متكرر (علي الصديق مقابل علي العميل) يُدمج
-- قسراً بعقدة واحدة — وهذا بالضبط «تلويث الشبكة بعقد مكررة» معكوساً: دمج خاطئ
-- بدل تكرار خاطئ. البديل المعتمد: البحث قد يرجع أكثر من مرشّح، والغموض يُعرض
-- كسؤال (قاعدة الحذر الافتراضي، قسم ٤) بدل أن يخمّن النظام.
CREATE TABLE entity_aliases (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_id  BIGINT UNSIGNED NOT NULL,
    alias      VARCHAR(255) NOT NULL COMMENT 'الصيغة كما وردت',
    alias_norm VARCHAR(255) NOT NULL COMMENT 'بعد التطبيع — مفتاح البحث',
    lang       ENUM('ar','en','other') NOT NULL DEFAULT 'other',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_alias_entity (alias_norm, entity_id),
    KEY idx_lookup (alias_norm),
    CONSTRAINT fk_alias_entity FOREIGN KEY (entity_id)
        REFERENCES entities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE edges (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    src_id     BIGINT UNSIGNED NOT NULL,
    rel_type   VARCHAR(32) NOT NULL COMMENT 'belongs_to|related_to|led_to|develops|mentions',
    dst_id     BIGINT UNSIGNED NOT NULL,
    attrs      JSON NULL,
    weight     FLOAT NOT NULL DEFAULT 1.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_edge (src_id, rel_type, dst_id),
    KEY idx_reverse (dst_id, rel_type),
    CONSTRAINT fk_edge_src FOREIGN KEY (src_id) REFERENCES entities (id) ON DELETE CASCADE,
    CONSTRAINT fk_edge_dst FOREIGN KEY (dst_id) REFERENCES entities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- المتجهات: الجدول جاهز، لكن لا يُعبَّأ بالمرحلة ١.
-- السبب (قسم ٢١): الـ embeddings تعني مزوّد دفع ثالث. تُضاف بالمرحلة ٢ بعد
-- قياس هل تحسّن الاسترجاع فعلاً فوق FULLTEXT + الأسماء البديلة + العلاقات.
CREATE TABLE embeddings (
    entity_id  BIGINT UNSIGNED NOT NULL,
    model      VARCHAR(64) NOT NULL,
    dim        SMALLINT UNSIGNED NOT NULL,
    vec        BLOB NOT NULL COMMENT 'float32 متتابعة — pack("g*", ...)',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_id),
    CONSTRAINT fk_emb_entity FOREIGN KEY (entity_id)
        REFERENCES entities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═════════════════════════════════════════════════════════════════════════
-- الصلاحيات وسجل الأفعال (أقسام ٤، ٥، ٢٠)
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE action_types (
    type                  VARCHAR(64) NOT NULL,
    label_ar              VARCHAR(128) NOT NULL,
    tier                  ENUM('normal','sensitive') NOT NULL DEFAULT 'normal',
    -- قسم ٤: حتى الفئات الحساسة ليست قائمة ثابتة — تُتعلَّم وتُؤكَّد منه
    tier_confirmed        TINYINT(1) NOT NULL DEFAULT 0,
    reversible            TINYINT(1) NOT NULL DEFAULT 1,
    auto_exec             TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = ينفّذ بلا سؤال',
    -- قسم ٥: مستويان لظهور الأفعال المنفَّذة، لا مستوى واحد
    visibility            ENUM('silent','visible') NOT NULL DEFAULT 'visible',

    -- عدادات الترقية (قسم ٤) — الصمت لا يُحسب موافقة، فنعدّ الموافقات الصريحة
    approvals             INT UNSIGNED NOT NULL DEFAULT 0,
    rejections            INT UNSIGNED NOT NULL DEFAULT 0,
    consecutive_approvals INT UNSIGNED NOT NULL DEFAULT 0,
    -- قسم ٢٠: تصحيحان متتاليان يرجّعان الفعل لطبقة «يسأل» ويوقفان الترقية
    consecutive_corrections INT UNSIGNED NOT NULL DEFAULT 0,
    promotion_frozen      TINYINT(1) NOT NULL DEFAULT 0,

    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- سجل الأفعال (قسم ٥) — كل فعل تلقائي نُفّذ فعلياً، لا الأسئلة المعلّقة فقط.
-- قسم ٢٠ يشترط تخزين سبب الفعل معه: العقد المستند عليها ودرجة الثقة وقتها،
-- فيصير أي تصرف غريب قابلاً للتتبع لا لغزاً.
CREATE TABLE actions (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    action_type  VARCHAR(64) NOT NULL,
    decision     ENUM('executed','asked','deferred','blocked') NOT NULL,
    tier         ENUM('normal','sensitive') NOT NULL,
    confidence   FLOAT NULL,
    reasons      JSON NULL COMMENT 'مكوّنات القرار الأربعة وقيمها لحظة اتخاذه',
    evidence     JSON NULL COMMENT 'معرّفات العقد التي استند عليها',
    payload      JSON NULL,
    visibility   ENUM('silent','visible') NOT NULL DEFAULT 'visible',
    executed_at  DATETIME NULL,
    reverted_at  DATETIME NULL,
    corrected    TINYINT(1) NOT NULL DEFAULT 0,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_journal (created_at),
    KEY idx_by_type (action_type, created_at),
    KEY idx_visible (visibility, created_at),
    CONSTRAINT fk_action_type FOREIGN KEY (action_type)
        REFERENCES action_types (type) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- قسم ٥: الأسئلة غير العاجلة تتجمع بقائمة يراجعها بوقته، بدل مقاطعته المستمرة
CREATE TABLE pending_questions (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    question    TEXT NOT NULL,
    kind        VARCHAR(48) NOT NULL DEFAULT 'clarification'
                COMMENT 'clarification|entity_ambiguity|tier_confirmation|preference_gap',
    context     JSON NULL,
    urgency     ENUM('urgent','normal') NOT NULL DEFAULT 'normal',
    status      ENUM('open','answered','dismissed') NOT NULL DEFAULT 'open',
    answer      TEXT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answered_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_open (status, urgency, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- اشتراكات إشعارات الويب (قسم ١٢: الإيجاز الصباحي، قسم ٢٢: التنبيهات).
-- بديل خدمة الإشعارات على VPS: معيار Web Push يعمل من PHP عادي عبر cron.
CREATE TABLE push_subscriptions (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    endpoint   VARCHAR(512) NOT NULL,
    p256dh     VARCHAR(255) NOT NULL,
    auth       VARCHAR(255) NOT NULL,
    device     VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_ok_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_endpoint (endpoint(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- عدّاد ضابط التنبيهات (قسم ٢٢): حد أقصى باليوم مهما «استحق» الإرسال نظرياً،
-- لئلا تصير الأداة نفسها مصدر إزعاج بدل مساعدة.
CREATE TABLE notification_log (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    day        DATE NOT NULL,
    title      VARCHAR(255) NOT NULL,
    sent_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═════════════════════════════════════════════════════════════════════════
-- التكلفة (قسم ٣٦) — مؤشر ظاهر من اليوم الأول، لا اكتشاف بالفاتورة
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE cost_log (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    day           DATE NOT NULL,
    provider      VARCHAR(32) NOT NULL DEFAULT 'anthropic',
    model         VARCHAR(64) NOT NULL,
    purpose       VARCHAR(48) NOT NULL COMMENT 'extract|answer|proactive|decide',
    input_tokens  INT UNSIGNED NOT NULL DEFAULT 0,
    output_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    cache_read_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    usd           DECIMAL(12,6) NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═════════════════════════════════════════════════════════════════════════
-- البذرة: نطاق الأفعال التلقائية من اليوم الأول (قسم ٤)
--
-- قسم ٣٣ يقول إن النظام «فاشل» لو ظل ينتظر أوامره. فلو بدأ كل شيء بطبقة
-- «يسأل» لأشهر، يفقد الحماس قبل أن يستحق النظام الثقة. لذلك هذي الأفعال
-- الداخلية القابلة للتراجع تبدأ تلقائية.
--
-- تنبيه — تعارض داخل الوثيقة الأصلية: «حجز أوقات التركيز بالتقويم» مذكور
-- بقسم ٤ ضمن المسموح تلقائياً من اليوم الأول، لكن قسم ١٢ يقول صراحةً إنه
-- «يدخل بطبقة يسأل ويترقى بمرور الوقت». اعتُمدت هنا القراءة الأحذر (يسأل)
-- عملاً بقاعدة الحذر الافتراضي بنفس القسم ٤. عدّل auto_exec إلى 1 إن أردت
-- القراءة الأخرى — وهذا قرار لك أنت لا للنظام.
-- ═════════════════════════════════════════════════════════════════════════

INSERT INTO action_types
    (type, label_ar, tier, reversible, auto_exec, visibility, tier_confirmed)
VALUES
    ('classify_input',   'تنظيم وتصنيف المدخلات',      'normal',    1, 1, 'silent',  1),
    ('link_to_graph',    'ربط المدخل بالشبكة المعرفية', 'normal',    1, 1, 'silent',  1),
    ('draft_task',       'إنشاء مسودة مهمة',            'normal',    1, 1, 'visible', 1),
    ('suggest_day_order','اقتراح ترتيب اليوم',          'normal',    1, 1, 'visible', 1),
    ('block_focus_time', 'حجز وقت تركيز بالتقويم',      'normal',    1, 0, 'visible', 0),
    ('send_message',     'إرسال رسالة خارجية',          'sensitive', 0, 0, 'visible', 1),
    ('financial_action', 'أي فعل مالي',                  'sensitive', 0, 0, 'visible', 1);

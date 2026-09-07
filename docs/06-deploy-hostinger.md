# النشر على هوستنقر — أوامر جاهزة

مكتوبة بقيم الحساب الفعلية، لا بمتغيرات تُعبّأ. الصقها كما هي.

> **قابل للتنفيذ آلياً:** افتح كلود كود على جهازك بمجلد المشروع وقل له
> «نفّذ `docs/06-deploy-hostinger.md`» — الأوامر صريحة بما يكفي ليمشي بلا
> تدخل، عدا ما هو معلّم **يدوي**.

---

## القيم المعتمدة

| | |
|---|---|
| المستخدم | `u882715874` |
| الدومين | `bahrio.com` |
| السابدومين | `os.bahrio.com` |
| جذر السابدومين | `~/domains/bahrio.com/public_html/Os` |
| مجلد الكود | `~/lifeos` |
| المستودع | `alozy666/Ali` فرع `claude/idea-without-vps-1m1gie` |

---

## البنية المعتمدة — ولماذا

جذر السابدومين وقع **داخل** `public_html`، وهذا يعني أن أي شيء نضعه فيه قابل
للطلب من المتصفح. فلا نضع المشروع فيه.

```
~/lifeos/                                    🔒 خارج جذر الويب
   ├── app/            الكود والإعدادات والمفاتيح — لا يُطلب عبر HTTP
   ├── vendor/
   └── public/         المرجع الأصلي

~/domains/bahrio.com/public_html/Os/         🌐 جذر السابدومين
   ├── index.php       نسخة، بـ APP_PATH مطلق
   └── .htaccess       نسخة
```

**ملفان فقط** بالمنطقة المكشوفة، وكلاهما لا يحوي سرّاً. هذا يحقق ق-١٥ بدون
تغيير إعدادات السابدومين.

**الثمن:** عند تحديث `public/index.php` أو `public/.htaccess` لاحقاً، تُنسخ
يدوياً. وهما ملفان شبه ثابتين، فالكلفة نادرة.

---

## ١. الاتصال

بيانات SSH من hPanel ← Advanced ← SSH Access (هوستنقر تستخدم منفذاً غير ٢٢).

```bash
ssh -p 65002 u882715874@82.198.227.205
```

---

## ٢. جلب المشروع

```bash
cd ~
git clone -b claude/idea-without-vps-1m1gie https://github.com/alozy666/Ali.git lifeos
cd ~/lifeos
php -v          # يجب أن يكون 8.1+
composer install --no-dev --optimize-autoloader
```

> **لو `composer` غير موجود:**
> ```bash
> cd ~ && curl -sS https://getcomposer.org/installer | php
> php ~/composer.phar install -d ~/lifeos --no-dev --optimize-autoloader
> ```

---

## ٣. ربط جذر السابدومين

```bash
DOCROOT=~/domains/bahrio.com/public_html/Os

cp ~/lifeos/public/index.php  "$DOCROOT/index.php"
cp ~/lifeos/public/.htaccess  "$DOCROOT/.htaccess"

# توجيه الملف المنشور للكود خارج جذر الويب
sed -i "s|__DIR__ . '/../app'|'/home/u882715874/lifeos/app'|" "$DOCROOT/index.php"

grep APP_PATH "$DOCROOT/index.php"     # تحقق: يجب أن يظهر المسار المطلق
```

---

## ٤. الفحص المسبق — بوابة م٠

يُشغَّل **مرتين**، وكل تشغيل يفحص ما لا يفحصه الآخر:

```bash
# (أ) من المتصفح — يفحص عزل app/ عبر طلب HTTP فعلي
cp ~/lifeos/public/preflight.php ~/domains/bahrio.com/public_html/Os/
```

افتح `https://os.bahrio.com/preflight.php`

```bash
# (ب) من سطر الأوامر داخل public/ — يفحص قاعدة البيانات
cd ~/lifeos/public && php preflight.php
```

> **لماذا مرتين:** فحص عزل `app/` يحتاج طلب HTTP حقيقي فلا يعمل من الطرفية.
> وفحص قاعدة البيانات يبحث عن `../app/config/config.php` نسبةً لموقع الملف —
> فلا يجده إلا من داخل `~/lifeos/public`.

**احذفه بعد الاجتياز:**

```bash
rm ~/domains/bahrio.com/public_html/Os/preflight.php
```

---

## ٥. الإعدادات

**⚠ يدوي — الأسرار تُولَّد على جهازك ولا تمر بأي محادثة.**

```bash
cd ~/lifeos
cp app/config/config.sample.php app/config/config.php
chmod 600 app/config/config.php
chmod 700 app/storage app/config
```

ولّد المفتاحين **على جهازك** ثم الصقهما بالملف:

```bash
php -r "echo 'field_key_base64: ' . base64_encode(random_bytes(32)) . PHP_EOL;"
php -r "echo 'api_token: ' . bin2hex(random_bytes(32)) . PHP_EOL;"
```

بيانات قاعدة البيانات من hPanel ← Databases ← MySQL Databases (أنشئ قاعدة
ومستخدماً إن لم يوجدا).

> 🔑 احفظ نسخة من `field_key_base64` **خارج الاستضافة**. لو ضاع، البيانات
> المشفّرة لا تُسترجع.

---

## ٦. المخطط

```bash
cd ~/lifeos
mysql -u USER -p DBNAME < app/db/migrations/001_initial_schema.sql
mysql -u USER -p DBNAME -e "SHOW TABLES;"     # يجب أن تظهر ١٢ جدولاً
```

> بلا صلاحية `mysql` بالطرفية: hPanel ← phpMyAdmin ← Import ← ارفع ملف الـSQL.

أعد تشغيل الفحص للتأكد من `WITH RECURSIVE` وترميز العربية:

```bash
cd ~/lifeos/public && php preflight.php
```

---

## ٧. وظائف cron

hPanel ← Advanced ← Cron Jobs. أضف الخمسة:

```
*/5 * * * *   /usr/bin/php /home/u882715874/lifeos/app/cron/worker.php >> /home/u882715874/lifeos/app/storage/logs/worker.log 2>&1
0 6 * * *     /usr/bin/php /home/u882715874/lifeos/app/cron/proactive.php morning
0 20 * * *    /usr/bin/php /home/u882715874/lifeos/app/cron/proactive.php evening
0 3 * * *     /usr/bin/php /home/u882715874/lifeos/app/cron/backup.php >> /home/u882715874/lifeos/app/storage/logs/backup.log 2>&1
0 4 * * 0     /usr/bin/php /home/u882715874/lifeos/app/cron/health.php >> /home/u882715874/lifeos/app/storage/logs/health.log 2>&1
```

**تأكد من مسار PHP أولاً** — قد لا يكون `/usr/bin/php`:

```bash
which php
```

استبدل الناتج بكل الأسطر إن اختلف.

**اختبر يدوياً قبل الاعتماد على الجدولة:**

```bash
php ~/lifeos/app/cron/worker.php
```

---

## ٨. التحقق النهائي

```bash
# ١. الاختبارات تمر على السيرفر نفسه
cd ~/lifeos && php app/tests/run_tests.php        # ٥٦/٥٦

# ٢. الواجهة ترد
curl -s -o /dev/null -w '%{http_code}\n' https://os.bahrio.com/api/today   # 401 = سليم

# ٣. ⛔ الأهم: الكود غير مكشوف — الثلاثة يجب أن تفشل
curl -s -o /dev/null -w '%{http_code} ' https://os.bahrio.com/app/config/config.php
curl -s -o /dev/null -w '%{http_code} ' https://os.bahrio.com/../lifeos/app/config/config.php
curl -s -o /dev/null -w '%{http_code}\n' https://os.bahrio.com/index.php/../app/config/config.php
```

`401` بالثاني نتيجة **ناجحة** — الواجهة تعمل وترفض بلا رمز.
أي `200` بالثالث **عطل أمني حرج** — أوقف كل شيء وراجع البنية.

---

## التحديث لاحقاً

```bash
cd ~/lifeos && git pull
composer install --no-dev --optimize-autoloader

# فقط إذا تغيّر أحد ملفَّي الجذر
cp ~/lifeos/public/.htaccess ~/domains/bahrio.com/public_html/Os/
cp ~/lifeos/public/index.php ~/domains/bahrio.com/public_html/Os/
sed -i "s|__DIR__ . '/../app'|'/home/u882715874/lifeos/app'|" ~/domains/bahrio.com/public_html/Os/index.php
```

---

## أخطاء شائعة

| العرض | السبب | الحل |
|---|---|---|
| صفحة بيضاء | `config.php` مفقود أو `APP_PATH` غلط | `grep APP_PATH` بالجذر، وتأكد من وجود الملف |
| `500` | صلاحيات، أو `vendor/` ناقصة | `chmod 700 app/storage` و`composer install` |
| cron لا يعمل | مسار PHP غلط | `which php` وحدّث الأسطر |
| الطابور لا يفرغ | مهلة التنفيذ قصيرة | خفّض `queue_batch_size` — `preflight.php` يقترح الرقم |
| عربي مشوّه | ترميز القاعدة | `preflight.php` يكشفه؛ أعد إنشاء القاعدة بـ `utf8mb4` |
| وقت الإيجاز غلط | فرق المنطقة الزمنية | قارن `date` بالسيرفر مع وقتك، وأزح ساعات cron |

---

## بعد الاجتياز

علّم بنود م٠ في [`04-roadmap.md`](04-roadmap.md)، وابدأ م١: الالتقاط
والواجهة الدنيا.

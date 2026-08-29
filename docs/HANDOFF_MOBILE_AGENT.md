# تسليم إلى وكيل تطبيق الموبايل — تعديلات match_schools الجديدة

انسخ هذا الملف كاملاً وأرسله إلى الوكيل العامل على تطبيق الموبايل.

---

أنت تعمل على تطبيق موبايل يخدم نفس باكند **`match_schools`** (Frappe/ERPNext).
الباكند أُضيفت إليه اليوم وحدات جديدة، وتغيّرت فيه قواعد صلاحيات موجودة من قبل.
اقرأ ما يلي كعقد واجهة (API contract) وطبّقه؛ لا تخمّن أسماء حقول ولا مسارات.

## 0) قواعد ثابتة تسري على كل ما هو أدناه

**نداء الـ API**
```
POST/GET  {BASE}/api/method/match_schools.api.<module>.<function>
```
- المصادقة بالكوكيز (`sid`) — أرسل الطلب دائماً بـ credentials/cookie jar.
- كل عمليات الكتابة تحتاج هيدر `X-Frappe-CSRF-Token`.
- **كل** استجابة بنفس المغلّف المسطّح:
  ```json
  { "success": true, "data": {}, "message_en": "", "message_ar": "" }
  ```
  ملاحظة: Frappe يلفّها داخل `message`، أي أن جسم الرد الفعلي هو
  `{"message": {"success": ..., "data": ...}}` — فُكّ الطبقتين.
- عند `success:false` اعرض `message_ar` للمستخدم العربي و`message_en` للإنجليزي.
  الرسائل العربية جاهزة من الخادم — لا تترجم في التطبيق.

**بارامتر `persona`**
كل دالة تقبل `persona` لكن **الخادم يتجاهل ما ترسله ويعتمد على الدور المستخرج من
الجلسة**. لا تبنِ أي منطق صلاحيات على قيمة ترسلها أنت. الأدوار:
`admin` / `secretary` / `teacher` / `student` / `parent`.

**السنة والفصل الدراسي — قاعدة غير قابلة للتفاوض**
لا يوجد سجل يُخزَّن بدون `academic_year` و`academic_term`. الخادم يختمهما تلقائياً
عند الإنشاء من الإعدادات الافتراضية. في التطبيق:
- أي شاشة تعرض بيانات تاريخية **يجب** أن تحمل فلتر السنة + الفصل.
- أي شاشة إنشاء لا ترسلهما: الخادم يملؤهما — لكن لا تعرض للمستخدم بيانات
  مخلوطة بين فصلين في قائمة واحدة بدون تمييز.

**الأمان — أُغلقت ثغرات فعلية اليوم، لا تعِدها**
- لا تعتمد أبداً على إخفاء عنصر في الواجهة كوسيلة منع. الخادم يتحقق، لكن
  التطبيق يجب ألّا يعرض ما لا يملكه المستخدم.
- الطالب لا يراسل طالباً آخر. المعلّم لا يرى علامات مادة لا يدرّسها.
- تنبيهات/حجب الرسوم المالية تذهب **لولي الأمر فقط**، لا للطالب.
- المستخدم المعطّل (`enabled=0`) ممنوع من الدخول ولا يظهر في أي قائمة اختيار.

---

## 1) المراسلات (Mail) — بديل شاشة المحادثات القديمة

الوحدة القديمة `messaging.py` (شات) **استُبدلت** بصندوق بريد كامل.
غيّر التسمية في التطبيق من «المحادثات» إلى **«المراسلات»**.

**الموديل:** `MS Message` + `MS Message Recipient` (مستند مستقل لكل مستلم —
هو صندوق ذلك الشخص، وفيه أعلامه: مقروء/مميّز/مؤرشف/محذوف).

### النقاط الطرفية — `match_schools.api.mail`

| الدالة | النوع | البارامترات | الغرض |
|---|---|---|---|
| `folders` | GET | — | عدّادات المجلدات + عدد غير المقروء |
| `list_messages` | GET | `folder` (`inbox`\|`sent`\|`drafts`\|`starred`\|`archive`\|`trash`), `search`, `unread_only`, `limit=50` | قائمة الرسائل |
| `get_message` | GET | `message` | رسالة واحدة + السلسلة + المرفقات |
| `save_message` | POST | `payload` (أدناه) | إنشاء/تعديل مسودة أو إرسال |
| `set_flags` | POST | `message`, `is_read`, `is_starred`, `is_archived`, `is_deleted` | أعلام صندوق المستلم |
| `mark_all_read` | POST | — | تعليم الكل كمقروء |
| `delete_draft` | POST | `message` | حذف مسودة |
| `search_recipients` | GET | `q`, `limit=25` | بحث بالاسم/الرقم/معرّف النظام |
| `recipient_groups` | GET | — | الصفوف/الشعب المتاحة (admin/secretary/teacher فقط) |
| `upload_attachment` | POST multipart | ملف | يُرجع `{file_url, file_name, file_size}` |

### شكل `payload` في `save_message`
```jsonc
{
  "message": "MSG-0001",        // للتعديل فقط؛ اتركه فارغاً للإنشاء
  "is_draft": 0,                // 1 = حفظ كمسودة، 0 = إرسال
  "subject": "...",
  "body": "<p>HTML</p>",        // rich text
  "audience": "my_class_guardians",   // إما جمهور…
  "audience_groups": ["GRP-4B"],      // (اختياري) تضييق على شعب محددة
  "to":  ["user@x"],            // …أو أشخاص محددون
  "cc":  ["user@y"],
  "bcc": ["user@z"],
  "attachments": [{ "file_url": "...", "file_name": "...", "file_size": 1234 }],
  "reply_to": "MSG-0000",       // يربط الرسالة بالسلسلة
  "about_student": "STU-001"    // اختياري
}
```

### ثلاث قواعد إلزامية في واجهة الإنشاء

1. **الجمهور أولاً، ولا يُفكّ إلى إيميلات.**
   عندما يختار المستخدم «أولياء أمور صفوفي» أرسل `audience` فقط.
   **ممنوع** أن يجلب التطبيق أعضاء المجموعة ويضعهم كعناوين في حقل «إلى».
   الخادم هو من يوسّع الجمهور. اعرض في الواجهة بطاقة واحدة باسم الجمهور
   (مثال: «أولياء أمور صفوفي — 128 مستلماً»).
   في القراءة يعود `audience_label` و`audience_count` — اعرضهما بدل قائمة الأسماء.

2. **BCC.** الخادم يحذف مستلمي المخفية من كل قارئ عدا المرسل والمخفي نفسه.
   لا تحاول عرض `bcc` من أي مصدر آخر.

3. **الصلاحيات لكل دور** (القسم 2). لا تعرض جمهوراً غير مسموح للمستخدم الحالي.

### شكل الشاشة المطلوب (تمّ في الويب، طبّقه في الموبايل بروح الموبايل)
عميل بريد حقيقي لا لوحة بطاقات: قائمة صفوف كثيفة يفصلها خط، لكل صف نقطة
«غير مقروء» + المرسل + الموضوع + مقتطف + تاريخ. فتح الرسالة يفتح شاشة قراءة
كاملة (لا نافذة منبثقة). إجراءات الصف (نجمة/أرشفة/حذف) بالسحب (swipe) على
الموبايل بدل الإظهار عند المرور.

---

## 2) سياسة جمهور المراسلات — `match_schools.api.mail_policy`

من يُراسل مَن لم يعد مكتوباً في الكود، صار **إعداداً للمدرسة** يعدّله المدير.

| الدالة | النوع | الصلاحية | الغرض |
|---|---|---|---|
| `my_audiences` | GET | الجميع | الأجمهرة المسموحة للمستخدم الحالي — **ابنِ شاشة الإنشاء على هذه** |
| `get_settings` | GET | admin, secretary | مصفوفة الأدوار × الأجمهرة |
| `save_settings` | POST | **admin فقط** | حفظ المصفوفة |

**مفاتيح الأجمهرة السبعة:**
`my_class_guardians` (أولياء أمور صفوفي) · `my_class_students` (طلاب صفوفي) ·
`all_guardians` · `all_students` · `all_teachers` · `my_teachers` (معلّمو صفوفي —
يُقرأ لولي الأمر «معلّمو أبنائي») · `office` (إدارة المدرسة).

**الافتراضي:**
- admin / secretary: الكل.
- teacher: `my_class_guardians`, `my_class_students`, `all_teachers`, `office`.
- student / parent: `my_teachers`, `office` فقط.

⚠️ لا تُضمّن هذه الجداول في التطبيق. اقرأها من `my_audiences` في كل جلسة —
المدير قد يكون غيّرها.

---

## 3) طلبات الطباعة — `match_schools.api.print_requests`

المعلّم/المدير يرفق امتحاناً أو ورقة عمل، والسكرتير يطبع ويحدّث الحالة.
**الموديل:** `MS Print Request` + `MS Print Attachment`.

| الدالة | النوع | الصلاحية | البارامترات |
|---|---|---|---|
| `list_requests` | GET | admin, secretary, teacher | `status`, `mine` (0/1) |
| `get_request` | GET | نفسها | `request` |
| `save_request` | POST | نفسها | `payload` |
| `set_status` | POST | **admin, secretary فقط** | `request`, `status`, `note` |
| `delete_request` | POST | نفسها | `request` |
| `upload_attachment` | POST multipart | نفسها | ملف |

**payload:** `{request?, title, document_type, priority, needed_by, student_group, course, notes, copies, attachments:[{file_url,file_name,file_size}]}`

- `document_type`: `Exam` \| `Worksheet` \| `Homework` \| `Handout` \| `Other`
- `priority`: `Normal` \| `Urgent`
- `status`: `Submitted` (بانتظار الطباعة) → `In Progress` (قيد الطباعة) →
  `Ready` (جاهز للاستلام) → `Collected` (تم الاستلام) · أو `Rejected` (مرفوض)
- حدود: **10 ملفات كحد أقصى، 25 ميغابايت للملف الواحد** — تحقّق قبل الرفع.
- المعلّم يرى/يعدّل طلباته هو فقط، ولا يستطيع تغيير الحالة إطلاقاً.

---

## 4) مجتمع المدرسة — `match_schools.api.community`

خلاصة (feed) على نمط فيسبوك: منشور بصور، إعجاب، تعليقات.
**الموديل:** `MS Community Post` + `MS Post Photo` + `MS Post Like` + `MS Post Comment`.

| الدالة | النوع | الصلاحية | البارامترات |
|---|---|---|---|
| `feed` | GET | الجميع | `student_group`, `limit=30` |
| `get_post` | GET | الجميع | `post` |
| `save_post` | POST | admin, secretary, teacher | `payload` |
| `delete_post` | POST | admin, secretary, teacher | `post` |
| `toggle_like` | POST | الجميع | `post` |
| `add_comment` | POST | الجميع | `post`, `body` |
| `delete_comment` | POST | الجميع (صاحبه) | `comment` |
| `hide_comment` | POST | admin, secretary, teacher | `comment`, `reason`, `hidden` |
| `upload_photo` | POST multipart | admin, secretary, teacher | ملف |

**payload:** `{post?, title, body, post_type, audience, student_group, student, program, photos:[...]}`
- `post_type`: `Achievement` \| `Activity` \| `Announcement` \| `General`
- `audience`: `School` \| `Class` (يتطلب `student_group`) \| `Student` (يتطلب `student`)
- الطالب/ولي الأمر: قراءة + إعجاب + تعليق فقط. النشر لغير الطلاب.
- المعلّم لا ينشر لشعبة لا يدرّسها — الخادم يرفض، والتطبيق يجب ألّا يعرضها.

**الشكل:** خلاصة حقيقية لا قائمة بطاقات باهتة — صورة رمزية دائرية بالحرف الأول،
شبكة صور (1 كبيرة / 2 جنباً / 4 مع طبقة `N+`)، شريط عدّادات فوق أزرار التفاعل.

---

## 5) معرض الصفوف — `match_schools.api.gallery`

ألبوم صور لكل شعبة بعنوان فعالية وتاريخ.
**الموديل:** `MS Gallery Album` + `MS Gallery Photo`.

| الدالة | النوع | الصلاحية |
|---|---|---|
| `list_albums` | GET | الجميع (مقيّد بالشعب المرئية) |
| `get_album` | GET | الجميع |
| `save_album` | POST | admin, secretary, teacher |
| `delete_album` | POST | admin, secretary, teacher |
| `upload_photo` | POST multipart | admin, secretary, teacher |

**payload:** `{album?, student_group, title, event_date, description, is_published, cover_image, photos:[...]}`
- ولي الأمر يرى ألبومات شعب أبنائه فقط؛ الطالب شعبته فقط؛ المعلّم شعبه التي يدرّسها.
- `is_published=0` يعني مسودة — لا تظهر لأحد غير من يديرها.

---

## 6) ترفيع الطلبة — `match_schools.api.promotion`

| الدالة | النوع | الصلاحية | البارامترات |
|---|---|---|---|
| `get_rules` | GET | admin, secretary | — |
| `save_rules` | POST | **admin فقط** | `payload` |
| `options` | GET | admin, secretary | — |
| `preview` | GET | admin, secretary | `program`, `student_group`, `academic_year`, `academic_term` |
| `promote` | POST | **admin فقط** | `payload` |
| `mark_repeated` | POST | **admin فقط** | — |

- **الترفيع على مستوى الصف (`program`) لا الشعبة.** الشعبة تضييق اختياري فقط.
- `preview` يعيد لكل طالب: مؤهَّل/غير مؤهَّل + سبب الرفض (رسوم مستحقة، علامات
  غير مرصودة، معدّل تحت الحد، نسبة حضور، مواد راسبة).
- `promote` يقبل `{program, students:[], new_program, new_batch, new_academic_year,
  new_academic_term, academic_year, academic_term, override, override_reason}` —
  التجاوز يتطلب سبباً مكتوباً ويُسجَّل.
- إن كان التطبيق للأهل/الطلاب فقط: هذه الوحدة **لا تُعرض إطلاقاً**.

---

## 7) تغييرات تمسّ شاشات قائمة عندك أصلاً

1. **الترجمة.** أُضيف `translations/ar.csv` (١٠١ سلسلة). أخطاء الخادم تعود
   مترجمة في `message_ar` — احذف أي قاموس أخطاء محلي عندك يكرّرها.
2. **فهارس الأداء.** أُضيفت ١٠ فهارس على ٧ جداول. القوائم الكبيرة صارت أسرع؛
   لا تحتاج لتقسيم النداءات يدوياً بعد الآن.
3. **دليل الطلاب** كان يستعلم لكل صف (N+1). صار استدعاءً مجمّعاً — إن كنت
   تنادي نقاط طرفية فرعية داخل حلقة لبناء بطاقة الطالب، أوقف ذلك واستعمل
   الحقول العائدة من القائمة مباشرة.
4. **المستخدمون المعطّلون** لم يعودوا يظهرون في أي قائمة اختيار (معلّمين،
   مستلمين، مشرفين). حدّث أي قائمة مخزّنة محلياً (cache) عندك.
5. **صلاحية المعلّم على المواد**: لم يعد كل مساقات الشعبة تخصّه — فقط ما يدرّسه
   فعلاً. أي شاشة علامات في التطبيق يجب أن تعتمد على قائمة المساقات العائدة
   من الخادم، لا على مساقات الشعبة.

---

## المطلوب منك الآن

1. اقرأ عميلك الحالي للـ API وتأكّد أنه يفكّ المغلّف كما في القسم ٠.
2. أضف الوحدات: المراسلات، سياسة الجمهور، طلبات الطباعة، المجتمع، المعرض.
3. راجع كل شاشة قائمة عندك مقابل القسم ٧.
4. لا تُضمّن أي جدول صلاحيات أو قائمة جمهور داخل التطبيق — اقرأها من الخادم.
5. تأكّد أن كل شاشة تعرض بيانات مرتبطة بسنة وفصل دراسي تُظهرهما للمستخدم.

اسألني قبل أن تفترض أي اسم حقل غير مذكور هنا.

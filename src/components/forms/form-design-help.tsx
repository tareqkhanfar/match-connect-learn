import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TYPES: Array<[string, string, string]> = [
  ["Data", "نص قصير", "سطر واحد"],
  ["Long Text", "نص طويل", "فقرة"],
  ["Number", "رقم", ""],
  ["Date", "تاريخ", ""],
  ["Time", "وقت", ""],
  ["Datetime", "تاريخ ووقت", ""],
  ["Select", "قائمة اختيار", "يحتاج خيارات"],
  ["Multi Select", "اختيار متعدد", "يحتاج خيارات"],
  ["Checkbox", "مربع اختيار", "يُطبع «نعم/لا»"],
  ["Rating", "تقييم", "يُطبع «3 / 5»"],
  ["Table", "جدول", "الخيارات = أسماء الأعمدة"],
  ["Attach", "مرفق", ""],
  ["Section", "قسم", "عنوان يفصل مجموعة حقول"],
  ["Heading", "عنوان", "عنوان فرعي"],
];

function Code({ children }: { children: ReactNode }) {
  return (
    <code dir="ltr" className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">
      {children}
    </code>
  );
}

function Block({ children }: { children: string }) {
  return (
    <pre
      dir="ltr"
      className="overflow-x-auto rounded-lg border border-border bg-secondary/40 p-2.5 text-left font-mono text-[11px] leading-relaxed"
    >
      {children}
    </pre>
  );
}

function Part({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
          {n}
        </span>
        {title}
      </h3>
      <div className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/** «مساعدة» — how a form's design works and how it converts both ways. */
export function FormDesignHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <HelpCircle className="size-5 text-primary" />
            مساعدة — تصميم النماذج وطباعتها
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-right">
          <Part n={1} title="كيف يعمل النموذج">
            <p>
              لكل نموذج ثلاثة أجزاء: <b>الحقول</b> (ما يُعبّأ على الشاشة)، و<b>تصميم الطباعة</b>{" "}
              (HTML يحدد شكل الورقة المطبوعة)، و<b>CSS</b> (الألوان والخطوط والمسافات). تصميم
              الطباعة اختياري: إن تركته فارغاً يُطبع النموذج بتصميم افتراضي يسرد كل الحقول.
            </p>
            <p>
              الطلاب الذين يُعبّأ لهم النموذج يُحدَّدون من تبويب <b>«الطلاب الخاضعون»</b> — عند
              التعبئة لا يظهر إلا هؤلاء.
            </p>
          </Part>

          <Part n={2} title="تحويل الحقول إلى تصميم طباعة">
            <p>
              بعد إضافة الحقول اضغط <b>«تحويل الحقول إلى تصميم طباعة»</b>: يُنشأ تصميم جاهز فيه
              ترويسة المدرسة واسم النموذج وبيانات الطالب، ثم جدول لكل قسم بحقوله، ثم الملاحظات
              والتواقيع. ويُضاف CSS مبدئي إن لم يكن لديك CSS. يمكنك بعدها تعديل التصميم بحرية.
            </p>
            <p>التحويل يستبدل تصميم الطباعة الحالي، ولا يُحفظ شيء حتى تضغط «حفظ النموذج».</p>
          </Part>

          <Part n={3} title="كتابة الحقول في التصميم">
            <p>يوضع كل حقل في التصميم بهذه الصيغة، وعند الطباعة تحلّ محلها إجابة الطالب:</p>
            <Block>{`{{ field("اسم الحقل") }}
{{ field("الوزن *", "Number") }}
{{ field("فصيلة الدم", "Select", "A+|A-|B+|B-|O+|O-|AB+|AB-") }}
{{ field("الأدوية", "Table", "الدواء|الجرعة|الوقت") }}
{{ section("العلامات الحيوية") }}`}</Block>
            <ul className="list-disc space-y-1 pe-1 ps-5">
              <li>
                الوسيط الأول <b>اسم الحقل</b> كما يظهر للمعبّئ. علامة <Code>*</Code> في آخره تجعله
                حقلاً <b>مطلوباً</b>.
              </li>
              <li>
                الوسيط الثاني <b>النوع</b> (اختياري، الافتراضي نص قصير) — بالإنجليزية أو بالعربية
                كما في الجدول أدناه.
              </li>
              <li>
                الوسيط الثالث <b>الخيارات</b> مفصولة بـ <Code>|</Code> — للقائمة والاختيار المتعدد،
                وللجدول تكون أسماء الأعمدة. (في تبويب الحقول تُكتب سطراً لكل خيار.)
              </li>
              <li>
                <Code>{'{{ section("…") }}'}</Code> يطبع عنوان قسم، ويصبح حقلاً من نوع «قسم».
              </li>
              <li>استخدم علامات تنصيص مزدوجة " ولا تضع " داخل الاسم.</li>
            </ul>
          </Part>

          <Part n={4} title="تحويل التصميم إلى حقول">
            <p>
              صمّم الورقة كما تريد ثم اضغط <b>«تحويل التصميم إلى حقول»</b>: تُقرأ كل{" "}
              <Code>field(…)</Code> و<Code>section(…)</Code> بترتيب ظهورها وتصبح قائمة الحقول. قبل
              التطبيق يظهر ملخص: كم حقلاً موجوداً، وكم جديداً، وما الذي سيُزال.
            </p>
            <ul className="list-disc space-y-1 pe-1 ps-5">
              <li>الحقل الذي يبقى بالاسم نفسه يحتفظ بالإجابات المسجّلة عليه سابقاً.</li>
              <li>
                تغيير اسم الحقل في التصميم يجعله حقلاً جديداً؛ الإجابات القديمة تبقى محفوظة لكنها لا
                تظهر تحت الاسم الجديد.
              </li>
              <li>الحقل غير الموجود في التصميم يُزال من النموذج (وإجاباته السابقة تبقى محفوظة).</li>
              <li>
                عرض الحقل (ثلث/نصف/كامل) والتوضيح يُضبطان من تبويب الحقول ويُحفظان عند التحويل.
              </li>
              <li>
                القالب الافتراضي (الذي يسرد الحقول بحلقة) لا يحوي حقولاً بأسمائها فلا يمكن تحويله —
                حوّل الحقول إلى تصميم أولاً.
              </li>
            </ul>
          </Part>

          <Part n={5} title="المتغيرات المتاحة في التصميم">
            <ul className="list-disc space-y-1 pe-1 ps-5">
              <li>
                <Code>{"{{ school }}"}</Code> اسم المدرسة، <Code>{"{{ template.title }}"}</Code> اسم
                النموذج.
              </li>
              <li>
                <Code>{"{{ entry.student_name }}"}</Code> الطالب،{" "}
                <Code>{"{{ entry.student_group }}"}</Code> الشعبة،{" "}
                <Code>{"{{ entry.filled_by }}"}</Code> من عبّأه، <Code>{"{{ entry.notes }}"}</Code>{" "}
                الملاحظات، <Code>{"{{ filled_on }}"}</Code> التاريخ.
              </li>
              <li>
                <Code>{"{{ values.fieldname }}"}</Code> إجابة حقل بمعرّفه، و
                <Code>{"{% for field in fields %}"}</Code> للمرور على كل الحقول.
              </li>
              <li>
                يدعم التصميم صيغة Jinja كاملة: <Code>{"{% if … %}"}</Code>،{" "}
                <Code>{"{% for … %}"}</Code>، <Code>{'{{ x or "—" }}'}</Code>.
              </li>
            </ul>
          </Part>

          <Part n={6} title="CSS">
            <p>
              يُكتب في تبويب <b>CSS</b> بدون وسم <Code>{"<style>"}</Code>، ويُطبَّق بعد التنسيق
              الأساسي فيمكنه تغيير أي شيء. الأصناف الجاهزة في التصميم المولَّد:
            </p>
            <Block>{`.ms-form            الورقة كلها
.ms-head / .school  الترويسة واسم المدرسة
table.info          جدول بيانات الطالب
table.fields        جدول الحقول (th = الاسم، td = الإجابة)
h2.section          عنوان القسم
table.grid          حقول الجدول
.signatures         التواقيع
.no-print           لا يظهر عند الطباعة`}</Block>
            <p>مثال:</p>
            <Block>{`.ms-form .ms-head { border-bottom-color: #16A34A; }
.ms-form h2.section { background: #dcfce7; }
.ms-form table.fields th { width: 40%; }
@page { size: A4 landscape; }`}</Block>
          </Part>

          <Part n={7} title="المتطلبات والنصائح">
            <ul className="list-disc space-y-1 pe-1 ps-5">
              <li>احفظ النموذج مرة واحدة على الأقل قبل «معاينة الطباعة».</li>
              <li>أسماء الحقول يجب أن تكون مختلفة داخل النموذج الواحد.</li>
              <li>المعاينة تستخدم آخر نموذج معبّأ، أو إجابات تجريبية إن لم يُعبّأ بعد.</li>
              <li>خطأ في صيغة Jinja (قوس ناقص مثلاً) يظهر رسالة عند المعاينة — صحّحه قبل الحفظ.</li>
              <li>لا شيء من التحويلين يُحفظ تلقائياً: راجع النتيجة ثم اضغط «حفظ النموذج».</li>
            </ul>
          </Part>

          <section className="space-y-2">
            <h3 className="text-sm font-bold">أنواع الحقول</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-right text-xs">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">بالإنجليزية</th>
                    <th className="px-2 py-1.5 font-medium">بالعربية</th>
                    <th className="px-2 py-1.5 font-medium">ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {TYPES.map(([en, ar, note]) => (
                    <tr key={en} className="border-t border-border/60">
                      <td className="px-2 py-1 font-mono" dir="ltr">
                        {en}
                      </td>
                      <td className="px-2 py-1">{ar}</td>
                      <td className="px-2 py-1 text-muted-foreground">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

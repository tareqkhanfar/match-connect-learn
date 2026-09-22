import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TYPES: Array<[string, string, string]> = [
  ["Data", "نص قصير", "سطر واحد"],
  ["Long Text", "نص طويل", "فقرة — تُطبع أسطراً منقّطة إن كانت فارغة"],
  ["Number", "رقم", ""],
  ["Date", "تاريخ", "يُطبع يوم / شهر / سنة"],
  ["Time", "وقت", ""],
  ["Datetime", "تاريخ ووقت", ""],
  ["Select", "قائمة اختيار", "تُطبع مربعات ☐ ويُعلَّم المختار"],
  ["Multi Select", "اختيار متعدد", "مثلها، ويُعلَّم أكثر من خيار"],
  ["Checkbox", "مربع اختيار", "☐ نعم ☐ لا"],
  ["Rating", "تقييم", "يُطبع «3 / 5»"],
  ["Table", "جدول", "الخيارات = أسماء الأعمدة؛ صفوف فارغة للكتابة"],
  ["Student Table", "جدول طلاب", "صف لكل طالب في الشعبة، وأعمدة اختيار أو كتابة"],
  ["Text Block", "نص ثابت", "نص يُكتب مرة ويُطبع كما هو — مفتاح، تعليمات"],
  ["Attach", "مرفق", ""],
  ["Section", "قسم", "عنوان يفصل مجموعة حقول"],
  ["Heading", "عنوان", "عنوان فرعي"],
];

const HELPERS: Array<[string, string]> = [
  ["{{ letterhead() }}", "الترويسة: الشعار واسم المدرسة والقسم واسم النموذج والعبارة الجانبية"],
  [
    '{{ box("اسم الحقل", "النوع", "خيار1|خيار2") }}',
    "بطاقة ملوّنة للحقل: أيقونة، عنوان، ثم الإجابة أو أسطر أو مربعات",
  ],
  ['{{ inline("اسم الحقل") }}', "سطر واحد: «العنوان: الإجابة» أو خط منقّط"],
  ['{{ checks("اسم الحقل", "Select", "أ|ب") }}', "خيارات الحقل كمربعات فقط، بلا عنوان"],
  ['{{ field("اسم الحقل") }}', "الإجابة وحدها — لتضعها أينما شئت"],
  [
    '{{ card("عنوان", "users", "blue") }} … {{ endcard() }}',
    "بطاقة تضع فيها ما تشاء (العنوان والأيقونة واللون اختيارية)",
  ],
  ["{{ grid(2) }} … {{ endgrid() }}", "صفّ ما بينهما في أعمدة (من 1 إلى 5)"],
  ['{{ info("الصف والشعبة", section_label) }}', "سطر «عنوان: قيمة» لقيمة ليست حقلاً"],
  ['{{ section("اسم القسم") }}', "عنوان قسم"],
  ["{{ signatures() }}", "التواقيع المكتوبة في «الترويسة والطباعة»"],
  ["{{ footer() }}", "تذييل الصفحة"],
  ["{{ lines(3) }}", "ثلاثة أسطر منقّطة للكتابة"],
  ['{{ icon("target") }}', "أيقونة وحدها"],
];

const VARS: Array<[string, string]> = [
  ["student_name", "اسم الطالب (نماذج الطالب)"],
  ["section_label", "الصف والشعبة"],
  ["filled_date", "تاريخ التعبئة"],
  ["filled_by_name", "اسم من عبّأ النموذج"],
  ["blank", "صحيح عند طباعة النموذج فارغاً"],
  ["template.title", "اسم النموذج"],
  ["entry.notes", "الملاحظات العامة"],
  ["values.fieldname", "إجابة حقل بمعرّفه"],
];

const ICONS =
  "target (هدف) · flag · presentation (حصة) · gear (أساليب) · users (مجموعة) · user · note (قلم) · bulb (فكرة) · clipboard · calendar · book · clock · heart · star · check · info · pin (مكان) · list · activity · message · school · health · home (أسرة) · phone";

const TONES = "violet · green · blue · orange · pink · teal · yellow · gray";

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

function Pairs({ rows, mono = true }: { rows: Array<[string, string]>; mono?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-right text-xs">
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a} className="border-t border-border/60 first:border-0">
              <td
                className={
                  mono ? "whitespace-nowrap px-2 py-1.5 font-mono text-[11px]" : "px-2 py-1.5"
                }
                dir={mono ? "ltr" : undefined}
              >
                {a}
              </td>
              <td className="px-2 py-1.5 text-muted-foreground">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
              لكل نموذج: <b>الحقول</b> (ما يُعبّأ على الشاشة)، و<b>الترويسة والطباعة</b> (الشعار
              والقسم والتواقيع والتذييل)، و<b>تصميم الطباعة</b> (اختياري)، و<b>CSS</b> (اختياري).
            </p>
            <p>
              <b>يُعبّأ لـ:</b> «طالب» — نسخة لكل طالب من الخاضعين له (تبويب «الطلاب الخاضعون»)؛
              «شعبة» — نسخة لشعبة كاملة، مثل توثيق حصة جمعية أو متابعة صف؛ «عام» — بلا طالب ولا
              شعبة، مثل السجل اليومي.
            </p>
          </Part>

          <Part n={2} title="أسهل طريقة: بلا كتابة أي كود">
            <ol className="list-decimal space-y-1 pe-1 ps-5">
              <li>أضف الحقول بترتيبها، واختر لكل حقل من سطر «الطباعة» أيقونته ولونه وعدد أسطره.</li>
              <li>
                في «الترويسة والطباعة» ارفع الشعار واكتب القسم والعبارة الجانبية والتواقيع والتذييل.
              </li>
              <li>
                اترك «تصميم الطباعة» فارغاً: يُبنى تلقائياً — ترويسة، ثم الحقول القصيرة سطرين في كل
                صف، ثم بطاقة ملوّنة لكل حقل طويل، ثم التواقيع والتذييل.
              </li>
              <li>
                المعاينة بجانب كل تبويب تتحدّث وحدها، و«طباعة نموذج فارغ» تطبعه للتعبئة باليد.
              </li>
            </ol>
            <p>
              الحقل الفارغ يُطبع خطاً منقّطاً، والاختيارات مربعات ☐ — فالنموذج نفسه يصلح للطباعة
              الفارغة وللطباعة بعد التعبئة.
            </p>
          </Part>

          <Part n={3} title="تحويل الحقول إلى تصميم طباعة">
            <p>
              اضغط <b>«تحويل الحقول إلى تصميم طباعة»</b> ليُكتب التصميم التلقائي في تبويب «تصميم
              الطباعة»، ثم عدّله بحرية: انقل البطاقات، ضع حقلين في صف، أضف نصاً أو عنواناً. التحويل
              يستبدل التصميم الحالي ولا يُحفظ شيء حتى تضغط «حفظ النموذج».
            </p>
          </Part>

          <Part n={4} title="عناصر التصميم">
            <p>كل عنصر يُكتب بين قوسين مزدوجين، ويمكن خلطه بأي HTML:</p>
            <Pairs rows={HELPERS} />
            <p>
              في <Code>box</Code> و<Code>inline</Code> و<Code>checks</Code> و<Code>field</Code>:
              الأول <b>اسم الحقل</b> كما يظهر للمعبّئ (وعلامة <Code>*</Code> في آخره تجعله مطلوباً)،
              والثاني <b>النوع</b> (اختياري؛ بالإنجليزية أو العربية)، والثالث <b>الخيارات</b> مفصولة
              بـ <Code>|</Code>. أيقونة البطاقة ولونها يؤخذان من إعدادات الحقل، أو تكتبهما:{" "}
              <Code>{'box("…", icon="bulb", tone="pink")'}</Code>.
            </p>
            <p>مثال — بطاقة فيها سؤال وعدد في سطر واحد:</p>
            <Block>{`{{ card("هل توجد حالات تحتاج متابعة فردية؟", "users", "blue") }}
  <div class="follow">
    {{ checks("هل توجد حالات تحتاج متابعة فردية؟", "Select", "لا|نعم") }}
    {{ inline("عدد الحالات", "Number") }}
  </div>
{{ endcard() }}`}</Block>
          </Part>

          <Part n={5} title="حقول خاصة">
            <ul className="list-disc space-y-1 pe-1 ps-5">
              <li>
                <b>جدول طلاب</b> (لنماذج الشعبة): يمتلئ عند التعبئة بطلاب الشعبة. اكتب في خياراته
                سطراً لكل عمود — عمود اختيار: <Code>الوضع السلوكي: ممتاز|جيد جداً|جيد</Code>، وعمود
                كتابة: العنوان وحده مثل <Code>ملاحظات</Code>. يُطبع برأسين وعمود لكل خيار.
              </li>
              <li>
                <b>نص ثابت</b>: نص يُكتب في خياراته ويظهر ويُطبع كما هو — مفتاح تصنيفات، تعليمات.
              </li>
              <li>
                خيار ينتهي بـ <Code>:</Code> مثل <Code>أخرى:</Code> يُطبع وبعده خط للكتابة.
              </li>
              <li>
                <b>عدد الأسطر</b> لكل حقل (من سطر «الطباعة»): أسطر الكتابة للنص، والصفوف الفارغة
                للجدول.
              </li>
            </ul>
          </Part>

          <Part n={6} title="تحويل التصميم إلى حقول">
            <p>
              صمّم الورقة ثم اضغط <b>«تحويل التصميم إلى حقول»</b>: يُقرأ كل <Code>box</Code> و
              <Code>inline</Code> و<Code>checks</Code> و<Code>field</Code> و<Code>section</Code>{" "}
              بترتيب ظهوره ويصبح قائمة الحقول. يظهر قبل التطبيق ملخص بما سيُضاف ويُزال.
            </p>
            <ul className="list-disc space-y-1 pe-1 ps-5">
              <li>الحقل الذي يبقى باسمه يحتفظ بإجاباته السابقة ولونه وأيقونته وعرضه.</li>
              <li>
                تغيير الاسم يجعله حقلاً جديداً؛ الإجابات القديمة تبقى محفوظة لكن تحت الاسم القديم.
              </li>
              <li>الحقل الغائب عن التصميم يُزال من النموذج (وإجاباته تبقى محفوظة).</li>
              <li>خيارات «جدول طلاب» ونص «نص ثابت» تبقى من الحقل نفسه ولا تُكتب في التصميم.</li>
            </ul>
          </Part>

          <Part n={7} title="المتغيرات">
            <Pairs rows={VARS} />
            <p>
              والتصميم يقبل صيغة Jinja كاملة: <Code>{"{% if blank %}…{% endif %}"}</Code>،{" "}
              <Code>{"{% for f in fields %}"}</Code>.
            </p>
          </Part>

          <Part n={8} title="الألوان والأيقونات وCSS">
            <p>
              <b>الألوان:</b> <span dir="ltr">{TONES}</span>
            </p>
            <p>
              <b>الأيقونات:</b> <span dir="ltr">{ICONS}</span>
            </p>
            <p>
              CSS يُكتب في تبويبه بلا وسم <Code>{"<style>"}</Code> ويُطبَّق بعد التنسيق الأساسي.
              الأصناف:
            </p>
            <Block>{`.ms-page         الصفحة وإطارها          .theme-soft / .landscape
.ms-lh           الترويسة  (.lh-school .lh-dept .lh-title .lh-motto .lh-logo)
.ms-card         البطاقة   (.ms-card-head عنوانها، .tone-blue … لونها)
.inl             سطر «عنوان: قيمة»   (.val القيمة، .dots الخط المنقّط)
.opts / .opt     الخيارات  (.ck المربع، .ck.on المعلَّم)
.ln              سطر كتابة منقّط
.ms-grid.cols-2  أعمدة
.ms-table        الجدول    (.st جدول الطلاب)
h2.section       عنوان قسم
.ms-sign         التواقيع         .ms-foot  التذييل`}</Block>
            <p>مثال:</p>
            <Block>{`.lh-title { background: #dcfce7; }
.ms-card { border-radius: 6px; }
.ms-table td { height: 32px; }       /* صفوف أعلى للكتابة باليد */`}</Block>
          </Part>

          <Part n={9} title="المتطلبات والنصائح">
            <ul className="list-disc space-y-1 pe-1 ps-5">
              <li>
                أسماء الحقول مختلفة داخل النموذج الواحد، واستخدم علامات تنصيص مزدوجة " في التصميم.
              </li>
              <li>المعاينة تعمل قبل الحفظ؛ وبإلغاء «معاينة فارغة» تظهر على آخر نسخة معبّأة.</li>
              <li>خطأ في صيغة التصميم يظهر رسالة في المعاينة — صحّحه قبل الحفظ.</li>
              <li>الشعار: صورة PNG بخلفية شفافة حتى 3 ميغابايت.</li>
              <li>لا شيء من التحويلين يُحفظ تلقائياً: راجع ثم اضغط «حفظ النموذج».</li>
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
                    <th className="px-2 py-1.5 font-medium">في الطباعة</th>
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

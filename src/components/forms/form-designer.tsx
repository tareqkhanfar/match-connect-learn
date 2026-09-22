import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Eye,
  FileImage,
  Heading1,
  HelpCircle,
  LayoutList,
  Loader2,
  Palette,
  Plus,
  Printer,
  Repeat,
  Save,
  Stamp,
  Trash2,
  X,
} from "lucide-react";
import { SectionCard } from "@/components/shared/ui-kit";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/error-message";
import { fileUrl } from "@/lib/api/client";
import { FormDesignHelp } from "@/components/forms/form-design-help";
import {
  useDesignFromFields,
  useFieldsFromDesign,
  useFormCategories,
  printHtml as openPrint,
  uploadFormLogo,
  usePreviewFormPrint,
  useSaveFormTemplate,
  type FormEntryFor,
  type FormField,
  type FormFieldType,
  type FormTemplate,
} from "@/lib/api/hooks";
import { FormFieldInput, WIDTH_CLASS, type SectionStudent } from "@/components/forms/form-fields";
import { cn } from "@/lib/utils";

const WIDTHS: Array<{ value: FormField["width"]; label: string }> = [
  { value: "third", label: "ثلث" },
  { value: "half", label: "نصف" },
  { value: "full", label: "كامل" },
];

const NEEDS_OPTIONS: FormFieldType[] = [
  "Select",
  "Multi Select",
  "Table",
  "Student Table",
  "Text Block",
];

const OPTIONS_LABEL: Partial<Record<FormFieldType, string>> = {
  Table: "الأعمدة (سطر لكل عمود)",
  "Student Table":
    "الأعمدة، سطر لكل عمود — عمود اختيار: «العنوان: خيار1|خيار2»، وعمود كتابة: العنوان وحده",
  "Text Block": "النص كما سيظهر ويُطبع",
};

// Types that leave lines to write on when printed blank.
const HAS_LINES: FormFieldType[] = ["Long Text", "Data", "Table", "Student Table"];

const ENTRY_FOR: Array<{ value: FormEntryFor; label: string; hint: string }> = [
  { value: "Student", label: "طالب", hint: "نموذج لكل طالب من الخاضعين له" },
  { value: "Section", label: "شعبة", hint: "نموذج لشعبة كاملة — حصة جمعية، متابعة صف" },
  { value: "General", label: "عام", hint: "بلا طالب ولا شعبة — سجل يومي، تقرير" },
];

const blank = (category: string): FormTemplate => ({
  name: "",
  title: "",
  category,
  categoryLabel: "",
  description: "",
  isActive: 1,
  printTemplate: "",
  printCss: "",
  entryFor: "Student",
  printTheme: "soft",
  printOrientation: "Portrait",
  printLogo: "",
  printSchool: "",
  printDepartment: "",
  printMotto: "",
  printSignatures: "",
  printFooter: "",
  fields: [],
});

/**
 * Design one form: its fields, their order, their layout, and how it prints.
 *
 * The preview beside the field list is the form as it will be filled in, so a
 * designer sees the consequence of every choice without saving and switching
 * screens.
 */
export function FormDesigner({
  category,
  template,
  onSaved,
  onCancel,
}: {
  category: string;
  template: FormTemplate | null;
  onSaved: (t: FormTemplate) => void;
  onCancel: () => void;
}) {
  const meta = useFormCategories();
  const save = useSaveFormTemplate();
  const preview = usePreviewFormPrint();
  const toDesign = useDesignFromFields();
  const toFields = useFieldsFromDesign();
  const confirm = useConfirm();

  const [draft, setDraft] = useState<FormTemplate>(template ?? blank(category));
  const [tab, setTab] = useState<"fields" | "letterhead" | "print" | "css">("fields");
  const [help, setHelp] = useState(false);
  const [printHtml, setPrintHtml] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [blankPreview, setBlankPreview] = useState(true);
  const [uploading, setUploading] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(template ?? blank(category));
    setPrintHtml("");
  }, [template, category]);

  const fieldTypes = meta.data?.fieldTypes ?? [];
  const icons = meta.data?.icons ?? [];
  const tones = meta.data?.tones ?? [];
  const typeLabel = (t: string) => fieldTypes.find((f) => f.value === t)?.label ?? t;
  const design = printHtml || draft.printTemplate;

  function patch(index: number, change: Partial<FormField>) {
    setDraft((d) => ({
      ...d,
      fields: d.fields.map((f, i) => (i === index ? { ...f, ...change } : f)),
    }));
  }

  function set<K extends keyof FormTemplate>(key: K, value: FormTemplate[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function add(fieldtype: FormFieldType) {
    const starter: Partial<Record<FormFieldType, string>> = {
      Table: "العمود الأول\nالعمود الثاني",
      "Student Table": "الوضع السلوكي: ممتاز|جيد جداً|جيد|يحتاج إلى متابعة\nملاحظات",
      "Text Block": "اكتب هنا النص الثابت الذي يظهر في النموذج.",
    };
    const wide: FormFieldType[] = [
      "Long Text",
      "Table",
      "Student Table",
      "Text Block",
      "Multi Select",
    ];
    setDraft((d) => ({
      ...d,
      fields: [
        ...d.fields,
        {
          fieldname: "",
          label: fieldtype === "Section" ? "قسم جديد" : "حقل جديد",
          fieldtype,
          options: starter[fieldtype] ?? "",
          default: "",
          reqd: 0,
          width: wide.includes(fieldtype) ? "full" : "half",
          description: "",
          icon: "",
          tone: "",
          print_rows: 0,
        },
      ],
    }));
  }

  function move(index: number, by: number) {
    setDraft((d) => {
      const next = [...d.fields];
      const to = index + by;
      if (to < 0 || to >= next.length) return d;
      const moved = next[index] as FormField;
      next[index] = next[to] as FormField;
      next[to] = moved;
      return { ...d, fields: next };
    });
  }

  async function remove(index: number) {
    const field = draft.fields[index];
    if (!field) return;
    if (
      draft.name &&
      !(await confirm({
        title: "حذف الحقل",
        description: `سيُحذف «${field.label}» من النموذج. الإجابات المسجّلة عليه سابقاً تبقى محفوظة لكنها لن تظهر في التعبئة.`,
        confirmLabel: "حذف",
      }))
    ) {
      return;
    }
    setDraft((d) => ({ ...d, fields: d.fields.filter((_, i) => i !== index) }));
  }

  /** The draft as the server takes it — for saving and for the preview. */
  const payload = useMemo(
    () => ({ ...draft, printTemplate: printHtml || draft.printTemplate, category }),
    [draft, printHtml, category],
  );

  function persist() {
    if (!draft.title.trim()) {
      toast.error("اكتب اسم النموذج");
      return;
    }
    if (!draft.fields.length) {
      toast.error("أضف حقلاً واحداً على الأقل");
      return;
    }
    save.mutate(payload, {
      onSuccess: (t) => {
        toast.success("تم حفظ النموذج");
        setDraft(t);
        setPrintHtml("");
        onSaved(t);
      },
      onError: (e) => toast.error(errorMessage(e, "تعذّر حفظ النموذج")),
    });
  }

  function runPreview(blankPage = blankPreview, then?: (html: string) => void) {
    preview.mutate(
      { ...(draft.name ? { template: draft.name } : {}), payload, blank: blankPage },
      {
        onSuccess: (res) => then?.(res.html),
        onError: (e) => toast.error(errorMessage(e, "تعذّر عرض المعاينة")),
      },
    );
  }

  // The print preview follows the draft while a print tab is open.
  const previewRef = useRef(runPreview);
  previewRef.current = runPreview;
  useEffect(() => {
    if (tab === "fields") return;
    const t = setTimeout(() => previewRef.current(), 600);
    return () => clearTimeout(t);
  }, [payload, tab, blankPreview]);

  function printBlank() {
    runPreview(true, (html) => {
      try {
        openPrint(html, draft.title || "نموذج");
      } catch (e) {
        toast.error(errorMessage(e, "تعذّرت الطباعة"));
      }
    });
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      set("printLogo", await uploadFormLogo(file));
      toast.success("تم رفع الشعار");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر رفع الشعار"));
    } finally {
      setUploading(false);
      if (logoInput.current) logoInput.current.value = "";
    }
  }

  const previewFields = useMemo(() => draft.fields, [draft.fields]);

  /** «تحويل الحقول إلى تصميم طباعة» — replaces the design, not the fields. */
  async function fieldsToDesign() {
    if (!draft.fields.length) {
      toast.error("أضف حقولاً أولاً");
      return;
    }
    if (
      design.trim() &&
      !(await confirm({
        title: "تحويل الحقول إلى تصميم طباعة",
        description:
          "سيُستبدل تصميم الطباعة الحالي بتصميم جديد مولَّد من الحقول. التغيير لا يُحفظ حتى تضغط «حفظ النموذج».",
        confirmLabel: "تحويل",
      }))
    ) {
      return;
    }
    toDesign.mutate(
      { fields: draft.fields, category, entryFor: draft.entryFor ?? "Student" },
      {
        onSuccess: (res) => {
          setPrintHtml(res.html);
          setTab("print");
          toast.success("تم إنشاء تصميم الطباعة من الحقول — راجعه ثم احفظ النموذج");
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر التحويل")),
      },
    );
  }

  /** «تحويل التصميم إلى حقول» — replaces the fields with what the design places. */
  function designToFields() {
    if (!design.trim()) {
      toast.error("اكتب تصميم الطباعة أولاً، أو حوّل الحقول إلى تصميم");
      return;
    }
    toFields.mutate(
      { html: design, fields: draft.fields, category },
      {
        onSuccess: async (res) => {
          const lines = [
            `سيصبح في النموذج ${res.fields.length} عنصراً (حقول وأقسام):`,
            `• ${res.kept} موجود مسبقاً ويحتفظ بإجاباته`,
            `• ${res.added} جديد`,
          ];
          if (res.dropped.length)
            lines.push(
              `• سيُزال ${res.dropped.length} غير موجود في التصميم: ${res.dropped.join("، ")} (إجاباته السابقة تبقى محفوظة)`,
            );
          if (res.unknownTypes.length)
            lines.push(`• أنواع غير معروفة عوملت كنص قصير: ${res.unknownTypes.join("، ")}`);
          const ok = await confirm({
            title: "تحويل التصميم إلى حقول",
            description: (
              <span className="block space-y-1">
                {lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </span>
            ),
            confirmLabel: "تطبيق",
          });
          if (!ok) return;
          setDraft((d) => ({ ...d, fields: res.fields }));
          setTab("fields");
          toast.success("تم تحديث الحقول من التصميم — راجعها ثم احفظ النموذج");
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر التحويل")),
      },
    );
  }

  const previewPane = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            className="size-3.5 accent-[var(--primary)]"
            checked={blankPreview}
            onChange={(e) => setBlankPreview(e.target.checked)}
          />
          معاينة فارغة (كما تُطبع للتعبئة باليد)
        </label>
        {preview.isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        <button
          onClick={printBlank}
          disabled={preview.isPending}
          className="ms-auto flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Printer className="size-3.5" />
          طباعة نموذج فارغ
        </button>
      </div>
      <PrintPreview html={preview.data?.html} />
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionCard
        title={draft.name ? "تعديل النموذج" : "نموذج جديد"}
        description="الاسم ولمن يُعبّأ، ثم الحقول، ثم الترويسة وتصميم الطباعة"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHelp(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <HelpCircle className="size-3.5" />
              مساعدة
            </button>
            <button
              onClick={onCancel}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              رجوع
            </button>
            <button
              onClick={persist}
              disabled={save.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              حفظ النموذج
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">اسم النموذج</p>
            <Input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="مثال: توثيق حصة إرشاد جمعي"
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">الوصف (اختياري)</p>
            <Input value={draft.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">يُعبّأ لـ</p>
            <div className="flex gap-1">
              {ENTRY_FOR.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  title={o.hint}
                  onClick={() => set("entryFor", o.value)}
                  className={cn(
                    "h-9 flex-1 rounded-lg border text-xs font-medium transition-colors",
                    (draft.entryFor ?? "Student") === o.value
                      ? "border-primary bg-primary-soft/50 text-primary"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {ENTRY_FOR.find((o) => o.value === (draft.entryFor ?? "Student"))?.hint}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">الحالة</p>
            <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={!!draft.isActive}
                onChange={(e) => set("isActive", e.target.checked ? 1 : 0)}
              />
              {draft.isActive ? "مفعّل — يظهر عند التعبئة" : "معطّل — لا يظهر عند التعبئة"}
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 border-b border-border">
          {[
            { key: "fields" as const, label: "الحقول", icon: LayoutList },
            { key: "letterhead" as const, label: "الترويسة والطباعة", icon: Stamp },
            { key: "print" as const, label: "تصميم الطباعة", icon: Code2 },
            { key: "css" as const, label: "CSS", icon: Palette },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
          <div className="ms-auto flex flex-wrap items-center gap-1.5 pb-1">
            <button
              onClick={() => void fieldsToDesign()}
              disabled={toDesign.isPending}
              className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary-soft/40 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary-soft disabled:opacity-50"
              title="ينشئ تصميم طباعة جاهزاً من الحقول الحالية"
            >
              <Repeat className="size-3" />
              تحويل الحقول إلى تصميم طباعة
            </button>
            <button
              onClick={designToFields}
              disabled={toFields.isPending}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary disabled:opacity-50"
              title="يقرأ الحقول من تصميم الطباعة ويحدّث قائمة الحقول"
            >
              <Repeat className="size-3" />
              تحويل التصميم إلى حقول
            </button>
          </div>
        </div>

        {tab === "letterhead" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">شكل الطباعة</p>
                  <select
                    value={draft.printTheme ?? "soft"}
                    onChange={(e) => set("printTheme", e.target.value as "soft" | "classic")}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="soft">بطاقات ملوّنة بإطار وزخرفة</option>
                    <option value="classic">بسيط بلا إطار</option>
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">اتجاه الورقة</p>
                  <select
                    value={draft.printOrientation ?? "Portrait"}
                    onChange={(e) =>
                      set("printOrientation", e.target.value as "Portrait" | "Landscape")
                    }
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="Portrait">عمودي (A4)</option>
                    <option value="Landscape">أفقي (A4)</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">الشعار</p>
                <div className="flex items-center gap-3 rounded-xl border border-border p-2">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary/40">
                    {draft.printLogo ? (
                      <img
                        src={fileUrl(draft.printLogo)}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <FileImage className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={logoInput}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void onLogo(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => logoInput.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <FileImage className="size-3.5" />
                      )}
                      {draft.printLogo ? "تغيير الشعار" : "رفع شعار"}
                    </button>
                    {draft.printLogo && (
                      <button
                        type="button"
                        onClick={() => set("printLogo", "")}
                        className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-secondary"
                      >
                        <X className="size-3.5" />
                        إزالة
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  بلا شعار يُستخدم شعار المدرسة إن وُجد. يُفضَّل PNG بخلفية شفافة.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">اسم المدرسة</p>
                  <Input
                    value={draft.printSchool ?? ""}
                    onChange={(e) => set("printSchool", e.target.value)}
                    placeholder="فارغ = اسم المدرسة من النظام"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">القسم</p>
                  <Input
                    value={draft.printDepartment ?? ""}
                    onChange={(e) => set("printDepartment", e.target.value)}
                    placeholder="مثال: قسم الإرشاد التربوي"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    عبارة جانبية (سطر لكل سطر)
                  </p>
                  <Textarea
                    rows={3}
                    value={draft.printMotto ?? ""}
                    onChange={(e) => set("printMotto", e.target.value)}
                    placeholder={"معاً ..\nنُسهم في بناء\nجيل واعٍ وقادر ♡"}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">التواقيع (سطر لكل توقيع)</p>
                  <Textarea
                    rows={3}
                    value={draft.printSignatures ?? ""}
                    onChange={(e) => set("printSignatures", e.target.value)}
                    placeholder={"اسم المرشد/ة\nالتوقيع"}
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">تذييل الصفحة</p>
                <Input
                  value={draft.printFooter ?? ""}
                  onChange={(e) => set("printFooter", e.target.value)}
                  placeholder="مثال: لأن كل طالب يستحق أن يُسمع .. ويُساند .. ويُدعم"
                />
              </div>
              <p className="rounded-lg bg-secondary/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                ألوان البطاقات وأيقوناتها وعدد أسطر الكتابة تُضبط لكل حقل من تبويب «الحقول». إن كان
                تصميم الطباعة فارغاً يُبنى تلقائياً من الحقول بهذه الإعدادات.
              </p>
            </div>
            {previewPane}
          </div>
        )}

        {tab === "css" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                يُطبَّق بعد التنسيق الأساسي، فيمكنه تغيير أي شيء فيه. المعاينة تتحدّث تلقائياً.
              </p>
              <Textarea
                dir="ltr"
                rows={20}
                className="font-mono text-[11px]"
                value={draft.printCss ?? ""}
                onChange={(e) => set("printCss", e.target.value)}
                placeholder={
                  ".ms-card { border-radius: 6px; }\n.ms-card-head { font-size: 15px; }\n.lh-title { background: #dcfce7; }"
                }
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                اكتب CSS فقط، بدون وسم <code dir="ltr">&lt;style&gt;</code>. الأصناف المتاحة في
                «مساعدة».
              </p>
            </div>
            {previewPane}
          </div>
        )}

        {tab === "print" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                اتركه فارغاً ليُبنى تلقائياً من الحقول، أو اضغط «تحويل الحقول إلى تصميم طباعة» ثم
                عدّل عليه. المعاينة تتحدّث تلقائياً.
              </p>
              <Textarea
                dir="ltr"
                rows={20}
                className="font-mono text-[11px]"
                value={design}
                onChange={(e) => setPrintHtml(e.target.value)}
                placeholder={'{{ letterhead() }}\n{{ box("موضوع الحصة", "Long Text") }}'}
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                بطاقة لحقل:{" "}
                <code dir="ltr">{'{{ box("اسم الحقل", "النوع", "خيار1|خيار2") }}'}</code> · سطر:{" "}
                <code dir="ltr">{'{{ inline("اسم الحقل") }}'}</code> · التفاصيل في «مساعدة».
              </p>
            </div>
            {previewPane}
          </div>
        )}

        {tab === "fields" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* The design ------------------------------------------------ */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {fieldTypes.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => add(t.value)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:border-primary/40 hover:bg-primary-soft/30"
                  >
                    {t.value === "Section" || t.value === "Heading" ? (
                      <Heading1 className="size-3" />
                    ) : (
                      <Plus className="size-3" />
                    )}
                    {t.label}
                  </button>
                ))}
              </div>

              {draft.fields.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  أضف حقولاً من الأزرار أعلاه — لكل حقل بطاقة في الطباعة بلونها وأيقونتها.
                </p>
              ) : (
                <div className="space-y-2">
                  {draft.fields.map((f, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-xl border p-2.5",
                        f.fieldtype === "Section" || f.fieldtype === "Heading"
                          ? "border-primary/40 bg-primary-soft/20"
                          : "border-border",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {typeLabel(f.fieldtype)}
                        </span>
                        <Input
                          className="h-8 flex-1"
                          value={f.label}
                          onChange={(e) => patch(i, { label: e.target.value })}
                          placeholder="عنوان الحقل"
                        />
                        <button
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="rounded p-1 hover:bg-secondary disabled:opacity-30"
                          title="أعلى"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          onClick={() => move(i, 1)}
                          disabled={i === draft.fields.length - 1}
                          className="rounded p-1 hover:bg-secondary disabled:opacity-30"
                          title="أسفل"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                        <button
                          onClick={() => void remove(i)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="حذف"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      {f.fieldtype !== "Section" && f.fieldtype !== "Heading" && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <label className="flex items-center gap-2 text-[11px]">
                            العرض
                            <select
                              value={f.width}
                              onChange={(e) =>
                                patch(i, { width: e.target.value as FormField["width"] })
                              }
                              className="h-7 flex-1 rounded-md border border-input bg-transparent px-1 text-xs"
                            >
                              {WIDTHS.map((w) => (
                                <option key={w.value} value={w.value}>
                                  {w.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {f.fieldtype !== "Text Block" && (
                            <label className="flex items-center gap-2 text-[11px]">
                              <input
                                type="checkbox"
                                className="size-3.5 accent-[var(--primary)]"
                                checked={!!f.reqd}
                                onChange={(e) => patch(i, { reqd: e.target.checked ? 1 : 0 })}
                              />
                              حقل مطلوب
                            </label>
                          )}
                          {NEEDS_OPTIONS.includes(f.fieldtype) && (
                            <label className="text-[11px] sm:col-span-2">
                              {OPTIONS_LABEL[f.fieldtype] ??
                                "الخيارات (سطر لكل خيار — خيار ينتهي بـ «:» يترك سطراً للكتابة)"}
                              <Textarea
                                rows={f.fieldtype === "Student Table" ? 3 : 2}
                                className="mt-1"
                                value={f.options}
                                onChange={(e) => patch(i, { options: e.target.value })}
                              />
                            </label>
                          )}
                          {f.fieldtype !== "Text Block" && (
                            <label className="text-[11px] sm:col-span-2">
                              توضيح للمعبّئ (اختياري)
                              <Input
                                className="mt-1 h-8"
                                value={f.description}
                                onChange={(e) => patch(i, { description: e.target.value })}
                              />
                            </label>
                          )}
                        </div>
                      )}

                      {/* How it prints */}
                      {f.fieldtype !== "Heading" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-secondary/30 px-2 py-1.5 text-[11px]">
                          <span className="text-muted-foreground">الطباعة:</span>
                          <select
                            value={f.icon ?? ""}
                            onChange={(e) => patch(i, { icon: e.target.value })}
                            className="h-7 rounded-md border border-input bg-background px-1 text-xs"
                            title="أيقونة البطاقة"
                          >
                            <option value="">أيقونة تلقائية</option>
                            {icons.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {f.fieldtype !== "Section" && (
                            <div className="flex items-center gap-1" title="لون البطاقة">
                              <button
                                type="button"
                                onClick={() => patch(i, { tone: "" })}
                                className={cn(
                                  "h-5 rounded-full border px-1.5 text-[10px]",
                                  !f.tone ? "border-primary text-primary" : "border-border",
                                )}
                              >
                                تلقائي
                              </button>
                              {tones.map((t) => (
                                <button
                                  key={t.value}
                                  type="button"
                                  title={t.label}
                                  onClick={() => patch(i, { tone: t.value })}
                                  className={cn(
                                    "size-5 rounded-full border-2",
                                    f.tone === t.value ? "ring-2 ring-primary/60" : "",
                                  )}
                                  style={{ background: t.background, borderColor: t.color }}
                                />
                              ))}
                            </div>
                          )}
                          {HAS_LINES.includes(f.fieldtype) && (
                            <label className="flex items-center gap-1">
                              {f.fieldtype === "Table" || f.fieldtype === "Student Table"
                                ? "صفوف فارغة"
                                : "أسطر الكتابة"}
                              <Input
                                type="number"
                                min={0}
                                max={40}
                                dir="ltr"
                                className="h-7 w-14 text-xs"
                                value={f.print_rows || ""}
                                placeholder="تلقائي"
                                onChange={(e) =>
                                  patch(i, { print_rows: Number(e.target.value) || 0 })
                                }
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* What the person filling it will see ------------------------ */}
            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                <Eye className="size-3.5" />
                معاينة التعبئة
              </p>
              <FormBody
                fields={previewFields}
                values={values}
                onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
                students={SAMPLE_STUDENTS}
              />
            </div>
          </div>
        )}
      </SectionCard>
      <FormDesignHelp open={help} onOpenChange={setHelp} />
    </div>
  );
}

const SAMPLE_STUDENTS: SectionStudent[] = [
  { id: "sample-1", name: "طالب تجريبي ١" },
  { id: "sample-2", name: "طالب تجريبي ٢" },
];

function PrintPreview({ html }: { html?: string | undefined }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      {html ? (
        <iframe
          title="معاينة"
          className="h-[40rem] w-full"
          srcDoc={`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{padding:12px;background:#fff}</style></head><body>${html}</body></html>`}
        />
      ) : (
        <p className="p-6 text-center text-sm text-muted-foreground">جارِ تجهيز المعاينة…</p>
      )}
    </div>
  );
}

/** The fields of a form, laid out in their sections. Used to fill and to preview. */
export function FormBody({
  fields,
  values,
  onChange,
  readOnly,
  students,
}: {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (fieldname: string, value: string) => void;
  readOnly?: boolean;
  /** The section's pupils, for a «جدول طلاب». */
  students?: SectionStudent[] | undefined;
}) {
  if (!fields.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">لا توجد حقول بعد.</p>;
  }

  // Fields between two headings share one grid, so a half-width field sits
  // beside its neighbour instead of alone on its own row.
  const blocks: Array<{ heading: FormField | null; fields: FormField[] }> = [];
  for (const f of fields) {
    if (f.fieldtype === "Section" || f.fieldtype === "Heading") {
      blocks.push({ heading: f, fields: [] });
    } else {
      if (!blocks.length) blocks.push({ heading: null, fields: [] });
      (blocks[blocks.length - 1] as { fields: FormField[] }).fields.push(f);
    }
  }

  return (
    <div className="space-y-5">
      {blocks.map((block, bi) => (
        <div key={bi}>
          {block.heading && (
            <h3
              className={cn(
                "mb-3 border-b border-border pb-1 text-sm font-bold",
                block.heading.fieldtype === "Section" ? "text-primary" : "",
              )}
            >
              {block.heading.label}
            </h3>
          )}
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-6">
            {block.fields.map((f) => (
              <div
                key={f.fieldname || f.label}
                className={WIDTH_CLASS[f.width] ?? WIDTH_CLASS["half"]}
              >
                <p className="mb-1 text-[11px] text-muted-foreground">
                  {f.label}
                  {f.reqd ? <span className="text-destructive"> *</span> : null}
                </p>
                <FormFieldInput
                  field={f}
                  value={values[f.fieldname] ?? f.default ?? ""}
                  onChange={(v) => onChange(f.fieldname, v)}
                  students={students}
                  {...(readOnly ? { readOnly: true } : {})}
                />
                {f.description && !readOnly && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{f.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

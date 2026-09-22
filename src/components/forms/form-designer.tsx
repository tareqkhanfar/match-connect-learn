import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  Copy,
  Eye,
  Heading1,
  HelpCircle,
  LayoutList,
  Palette,
  Plus,
  Repeat,
  Save,
  Trash2,
} from "lucide-react";
import { SectionCard } from "@/components/shared/ui-kit";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/error-message";
import { FormDesignHelp } from "@/components/forms/form-design-help";
import {
  useDesignFromFields,
  useFieldsFromDesign,
  useFormCategories,
  usePreviewFormPrint,
  useSaveFormTemplate,
  type FormField,
  type FormFieldType,
  type FormTemplate,
} from "@/lib/api/hooks";
import { FormFieldInput, WIDTH_CLASS } from "@/components/forms/form-fields";
import { cn } from "@/lib/utils";

const WIDTHS: Array<{ value: FormField["width"]; label: string }> = [
  { value: "third", label: "ثلث" },
  { value: "half", label: "نصف" },
  { value: "full", label: "كامل" },
];

const NEEDS_OPTIONS: FormFieldType[] = ["Select", "Multi Select", "Table"];

const blank = (category: string): FormTemplate => ({
  name: "",
  title: "",
  category,
  categoryLabel: "",
  description: "",
  isActive: 1,
  printTemplate: "",
  printCss: "",
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
  const [tab, setTab] = useState<"fields" | "print" | "css">("fields");
  const [help, setHelp] = useState(false);
  const [printHtml, setPrintHtml] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(template ?? blank(category));
    setPrintHtml("");
  }, [template, category]);

  const fieldTypes = meta.data?.fieldTypes ?? [];
  const typeLabel = (t: string) => fieldTypes.find((f) => f.value === t)?.label ?? t;

  function patch(index: number, change: Partial<FormField>) {
    setDraft((d) => ({
      ...d,
      fields: d.fields.map((f, i) => (i === index ? { ...f, ...change } : f)),
    }));
  }

  function add(fieldtype: FormFieldType) {
    setDraft((d) => ({
      ...d,
      fields: [
        ...d.fields,
        {
          fieldname: "",
          label: fieldtype === "Section" ? "قسم جديد" : "حقل جديد",
          fieldtype,
          options: fieldtype === "Table" ? "العمود الأول\nالعمود الثاني" : "",
          default: "",
          reqd: 0,
          width: fieldtype === "Long Text" || fieldtype === "Table" ? "full" : "half",
          description: "",
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

  function persist() {
    if (!draft.title.trim()) {
      toast.error("اكتب اسم النموذج");
      return;
    }
    if (!draft.fields.length) {
      toast.error("أضف حقلاً واحداً على الأقل");
      return;
    }
    save.mutate(
      {
        ...draft,
        printTemplate: printHtml || draft.printTemplate,
        printCss: draft.printCss ?? "",
        category,
      },
      {
        onSuccess: (t) => {
          toast.success("تم حفظ النموذج");
          setDraft(t);
          setPrintHtml("");
          onSaved(t);
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر حفظ النموذج")),
      },
    );
  }

  function runPreview() {
    if (!draft.name) {
      toast.error("احفظ النموذج أولاً لمعاينة الطباعة");
      return;
    }
    preview.mutate(
      { template: draft.name, html: printHtml || draft.printTemplate, css: draft.printCss ?? "" },
      { onError: (e) => toast.error(errorMessage(e, "تعذّر عرض المعاينة")) },
    );
  }

  const previewFields = useMemo(() => draft.fields, [draft.fields]);
  const design = printHtml || draft.printTemplate;

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
      { fields: draft.fields, category },
      {
        onSuccess: (res) => {
          setPrintHtml(res.html);
          // Keep a CSS the school already wrote; give a starting one otherwise.
          if (!(draft.printCss ?? "").trim()) setDraft((d) => ({ ...d, printCss: res.css }));
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
      toast.error("اكتب تصميم الطباعة أولاً أو أدرج قالباً");
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

  return (
    <div className="space-y-4">
      <SectionCard
        title={draft.name ? "تعديل النموذج" : "نموذج جديد"}
        description="الاسم والوصف، ثم الحقول، ثم تصميم الطباعة"
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
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">اسم النموذج</p>
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="مثال: تقرير زيارة العيادة"
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">الوصف (اختياري)</p>
            <Input
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">الحالة</p>
            <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={!!draft.isActive}
                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked ? 1 : 0 }))}
              />
              {draft.isActive ? "مفعّل — يظهر عند التعبئة" : "معطّل — لا يظهر عند التعبئة"}
            </label>
          </div>
        </div>

        <div className="mt-4 flex gap-1.5 border-b border-border">
          {[
            { key: "fields" as const, label: "الحقول", icon: LayoutList },
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
          <div className="ms-auto flex items-center gap-1.5 pb-1">
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

        {tab === "css" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={runPreview}
                  disabled={preview.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft disabled:opacity-50"
                >
                  <Eye className="size-3.5" />
                  معاينة الطباعة
                </button>
                <span className="text-[11px] text-muted-foreground">
                  يُطبَّق بعد التنسيق الأساسي، فيمكنه تغيير أي شيء فيه.
                </span>
              </div>
              <Textarea
                dir="ltr"
                rows={18}
                className="font-mono text-[11px]"
                value={draft.printCss ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, printCss: e.target.value }))}
                placeholder={
                  ".ms-form h1 { color: #16A34A; }\n.ms-form table.fields th { width: 35%; }"
                }
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                اكتب CSS فقط، بدون وسم <code dir="ltr">&lt;style&gt;</code>. الأصناف الجاهزة:{" "}
                <code dir="ltr">.ms-form</code>، <code dir="ltr">.ms-head</code>،{" "}
                <code dir="ltr">table.info</code>، <code dir="ltr">table.fields</code>،{" "}
                <code dir="ltr">h2.section</code>، <code dir="ltr">table.grid</code>،{" "}
                <code dir="ltr">.signatures</code>.
              </p>
            </div>
            <PrintPreview html={preview.data?.html} />
          </div>
        ) : tab === "fields" ? (
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
                  أضف حقولاً من الأزرار أعلاه — ابدأ بـ«قسم» ثم الحقول التي تحته.
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
                          <label className="flex items-center gap-2 text-[11px]">
                            <input
                              type="checkbox"
                              className="size-3.5 accent-[var(--primary)]"
                              checked={!!f.reqd}
                              onChange={(e) => patch(i, { reqd: e.target.checked ? 1 : 0 })}
                            />
                            حقل مطلوب
                          </label>
                          {NEEDS_OPTIONS.includes(f.fieldtype) && (
                            <label className="text-[11px] sm:col-span-2">
                              {f.fieldtype === "Table"
                                ? "الأعمدة (سطر لكل عمود)"
                                : "الخيارات (سطر لكل خيار)"}
                              <Textarea
                                rows={2}
                                className="mt-1"
                                value={f.options}
                                onChange={(e) => patch(i, { options: e.target.value })}
                              />
                            </label>
                          )}
                          <label className="text-[11px] sm:col-span-2">
                            توضيح للمعبّئ (اختياري)
                            <Input
                              className="mt-1 h-8"
                              value={f.description}
                              onChange={(e) => patch(i, { description: e.target.value })}
                            />
                          </label>
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
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={runPreview}
                  disabled={preview.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft disabled:opacity-50"
                >
                  <Eye className="size-3.5" />
                  معاينة الطباعة
                </button>
                <button
                  onClick={() => {
                    setPrintHtml(DEFAULT_PRINT);
                    toast.success("أُدرج القالب الافتراضي — عدّله كما تشاء");
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  <Copy className="size-3.5" />
                  إدراج القالب الافتراضي
                </button>
                <span className="text-[11px] text-muted-foreground">
                  اتركه فارغاً لاستخدام التصميم الافتراضي تلقائياً.
                </span>
              </div>
              <Textarea
                dir="ltr"
                rows={18}
                className="font-mono text-[11px]"
                value={printHtml || draft.printTemplate}
                onChange={(e) => setPrintHtml(e.target.value)}
                placeholder='HTML + Jinja — مثال: {{ field("الوزن", "Number") }}'
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                ضع كل حقل هكذا:{" "}
                <code dir="ltr">{'{{ field("اسم الحقل", "النوع", "خيار1|خيار2") }}'}</code> وكل قسم:{" "}
                <code dir="ltr">{'{{ section("اسم القسم") }}'}</code>. التفاصيل في «مساعدة».
              </p>
            </div>
            <PrintPreview html={preview.data?.html} />
          </div>
        )}
      </SectionCard>
      <FormDesignHelp open={help} onOpenChange={setHelp} />
    </div>
  );
}

function PrintPreview({ html }: { html?: string | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-white">
      {html ? (
        <iframe
          title="معاينة"
          className="h-[28rem] w-full rounded-xl"
          srcDoc={`<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body>${html}</body></html>`}
        />
      ) : (
        <p className="p-6 text-center text-sm text-muted-foreground">
          اضغط «معاينة الطباعة» لعرض الشكل النهائي هنا.
        </p>
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
}: {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (fieldname: string, value: string) => void;
  readOnly?: boolean;
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

const DEFAULT_PRINT = `<div class="ms-form">
  <h1>{{ template.title }}</h1>
  <table class="head">
    <tr><td><b>الطالب:</b> {{ entry.student_name }}</td><td><b>الشعبة:</b> {{ entry.student_group or "—" }}</td></tr>
    <tr><td><b>التاريخ:</b> {{ filled_on }}</td><td><b>عبّأه:</b> {{ entry.filled_by }}</td></tr>
  </table>
  {% for field in fields %}
    {% if field.fieldtype in ("Section", "Heading") %}
      <h2>{{ field.label }}</h2>
    {% else %}
      <div class="row"><span class="label">{{ field.label }}:</span>
        <span class="value">{{ values.get(field.fieldname) or "—" }}</span></div>
    {% endif %}
  {% endfor %}
  {% if entry.notes %}<h2>ملاحظات</h2><p>{{ entry.notes }}</p>{% endif %}
</div>`;

export { DEFAULT_PRINT };

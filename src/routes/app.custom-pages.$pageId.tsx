import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Eye,
  FileText,
  ListFilter,
  Monitor,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ColorPicker, IconPicker } from "@/components/workspaces/pickers";
import { PageEntryEditor } from "@/components/workspaces/page-entry-editor";
import { errorMessage } from "@/lib/api/error-message";
import { useFormTemplate, type FormField } from "@/lib/api/hooks";
import {
  suggestPageConfig,
  useCustomPage,
  useDeletePage,
  useMyWorkspaces,
  usePageBuilderOptions,
  useSavePage,
  useTemplateFields,
  type FetchMode,
  type FetchSource,
  type PageConfig,
  type PageFieldRule,
  type PagePayload,
} from "@/lib/api/workspaces";
import { roleLabels, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/custom-pages/$pageId")({
  head: () => ({
    meta: [
      { title: "بناء صفحة — Match Education" },
      { name: "description", content: "صفحة من نموذج: الحقول وقواعدها، القائمة والفلاتر." },
    ],
  }),
  component: PageBuilderRoute,
});

const NO_VALUE = new Set(["Section", "Heading", "Text Block"]);
const COLUMN_TYPES = new Set([
  "Data",
  "Number",
  "Date",
  "Time",
  "Datetime",
  "Select",
  "Multi Select",
  "Checkbox",
  "Rating",
]);
const FILTER_TYPES = new Set(["Select", "Multi Select", "Checkbox", "Rating", "Data"]);
const PAGE_ROLES: Role[] = ["admin", "secretary", "teacher"];
const FORM_SOURCE = "__form";

/** A change to a field's rules; `undefined` clears that rule. */
type RulePatch = { [K in keyof PageFieldRule]?: PageFieldRule[K] | undefined };

const EMPTY_CONFIG: PageConfig = {
  fields: {},
  columns: ["subject", "status", "filledOn"],
  filters: [],
  students: "any",
  showNotes: 1,
  newLabel: "",
};

function PageBuilderRoute() {
  const { pageId } = Route.useParams();
  const isNew = pageId === "new";
  const mine = useMyWorkspaces();
  const page = useCustomPage(isNew ? undefined : pageId);

  if (mine.isLoading || (!isNew && page.isLoading)) return <DashboardSkeleton />;
  if (!mine.data?.canBuild) {
    return (
      <EmptyBlock
        title="هذه الشاشة لحساب Administrator فقط"
        description="بناء الصفحات من صلاحيات حساب Administrator."
        icon={<ShieldCheck className="size-6" />}
      />
    );
  }
  if (!isNew && page.error) return <ErrorState error={page.error} onRetry={() => page.refetch()} />;
  const d = page.data;
  return (
    <PageBuilder
      key={pageId}
      id={isNew ? undefined : pageId}
      initial={
        d
          ? {
              id: d.id,
              title: d.title,
              template: d.template,
              icon: d.icon,
              color: d.color,
              description: d.description,
              isActive: d.isActive,
              personas: d.personas,
              config: d.config,
            }
          : {
              title: "",
              template: "",
              icon: "file-text",
              color: "primary",
              description: "",
              isActive: 1,
              personas: ["admin", "secretary"],
              config: EMPTY_CONFIG,
            }
      }
    />
  );
}

function PageBuilder({ id, initial }: { id: string | undefined; initial: PagePayload }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const options = usePageBuilderOptions();
  const save = useSavePage();
  const remove = useDeletePage();
  const saved = useCustomPage(id);
  const [draft, setDraft] = useState<PagePayload>(initial);
  const [dirty, setDirty] = useState(!id);
  const [tab, setTab] = useState<"fields" | "list" | "preview">("fields");
  const template = useFormTemplate(draft.template || undefined);
  const chosen = options.data?.templates.find((t) => t.name === draft.template);
  const entryFor = template.data?.entryFor ?? chosen?.entryFor ?? "Student";
  const valueFields = useMemo(
    () => (template.data?.fields ?? []).filter((f) => !NO_VALUE.has(f.fieldtype)),
    [template.data],
  );

  function change(next: Partial<PagePayload>) {
    setDraft((d) => ({ ...d, ...next }));
    setDirty(true);
  }
  function setConfig(next: Partial<PageConfig>) {
    setDraft((d) => ({ ...d, config: { ...d.config, ...next } }));
    setDirty(true);
  }
  function setRule(fieldname: string, patch: RulePatch | null) {
    setDraft((d) => {
      const current = d.config.fields[fieldname] ?? {};
      const merged: RulePatch = { ...current, ...(patch ?? {}) };
      for (const k of Object.keys(merged) as Array<keyof PageFieldRule>) {
        if (merged[k] === undefined || merged[k] === "" || merged[k] === 0) delete merged[k];
      }
      const next = merged as PageFieldRule;
      const fields = { ...d.config.fields };
      if (patch === null || Object.keys(next).length === 0) delete fields[fieldname];
      else fields[fieldname] = next;
      return { ...d, config: { ...d.config, fields } };
    });
    setDirty(true);
  }

  async function chooseTemplate(name: string) {
    const t = options.data?.templates.find((x) => x.name === name);
    try {
      const res = await suggestPageConfig(name);
      setDraft((d) => ({
        ...d,
        template: name,
        title: d.title || t?.title || "",
        config: res.config.newLabel === undefined ? { ...res.config, newLabel: "" } : res.config,
      }));
      setDirty(true);
      const fetched = Object.keys(res.config.fields).length;
      if (fetched) toast.success(`ضُبط ${fetched} حقلاً ليُجلب تلقائياً — راجعها في «الحقول»`);
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر تحميل النموذج"));
    }
  }

  async function resuggest() {
    if (!draft.template) return;
    const ok = await confirm({
      title: "إعادة الضبط التلقائي",
      description: "ستُستبدل قواعد الحقول والأعمدة والفلاتر بما يقترحه النظام لهذا النموذج.",
      confirmLabel: "إعادة الضبط",
    });
    if (ok) await chooseTemplate(draft.template);
  }

  function persist() {
    if (!draft.title.trim()) {
      toast.error("اكتب عنوان الصفحة");
      return;
    }
    if (!draft.template) {
      toast.error("اختر النموذج");
      return;
    }
    save.mutate(
      { ...draft, ...(id ? { id } : {}) },
      {
        onSuccess: (res) => {
          setDirty(false);
          setDraft((d) => ({ ...d, config: res.config }));
          toast.success("تم حفظ الصفحة");
          if (!id) {
            void navigate({
              to: "/app/custom-pages/$pageId",
              params: { pageId: res.id },
              replace: true,
            });
          }
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر الحفظ")),
      },
    );
  }

  async function del() {
    if (!id) return;
    const ok = await confirm({
      title: "حذف الصفحة",
      description: "تُحذف الصفحة وأزرارها في مساحات العمل. النسخ المعبّأة تبقى في ملف النموذج.",
      confirmLabel: "حذف",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        toast.success("حُذفت الصفحة");
        void navigate({ to: "/app/workspaces" });
      },
      onError: (e) => toast.error(errorMessage(e, "تعذّر الحذف")),
    });
  }

  if (options.isLoading) return <DashboardSkeleton />;
  if (options.error) return <ErrorState error={options.error} onRetry={() => options.refetch()} />;
  const opts = options.data!;
  const byCategory = opts.categories
    .map((c) => ({ ...c, templates: opts.templates.filter((t) => t.category === c.key) }))
    .filter((c) => c.templates.length);

  const tabs = [
    { key: "fields" as const, label: "الحقول", icon: SlidersHorizontal },
    { key: "list" as const, label: "القائمة والفلاتر", icon: ListFilter },
    { key: "preview" as const, label: "معاينة التعبئة", icon: Eye },
  ];

  return (
    <>
      <PageHeader
        title={id ? draft.title || "صفحة" : "صفحة جديدة"}
        subtitle="صفحة مستقلة من نموذج: تعبئة، قائمة بالمعبّأ، فلاتر، طباعة"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/app/workspaces"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
            >
              <ArrowRight className="size-3.5" />
              مساحات العمل والصفحات
            </Link>
            {id && (
              <>
                <Link
                  to="/app/p/$pageId"
                  params={{ pageId: id }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
                >
                  <Monitor className="size-3.5" />
                  فتح الصفحة
                </Link>
                <button
                  onClick={() => void del()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                  حذف
                </button>
              </>
            )}
            <button
              onClick={persist}
              disabled={save.isPending || !dirty}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              {save.isPending ? "جارِ الحفظ…" : "حفظ"}
            </button>
          </div>
        }
      />

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_22rem]">
        <SectionCard title="الصفحة" description="عنوانها، والنموذج الذي تُبنى منه">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">النموذج</p>
                <select
                  value={draft.template}
                  onChange={(e) => void chooseTemplate(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">— اختر النموذج —</option>
                  {byCategory.map((c) => (
                    <optgroup key={c.key} label={c.label}>
                      {c.templates.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.title}
                          {t.isActive ? "" : " (موقوف)"}
                          {t.pages.length && !t.pages.includes(id ?? "") ? " · له صفحة" : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {chosen && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {chosen.categoryLabel} ·{" "}
                    {entryFor === "Section"
                      ? "يُعبّأ لشعبة"
                      : entryFor === "General"
                        ? "نموذج عام"
                        : "يُعبّأ لطالب"}
                    {" · "}
                    <Link
                      to="/app/forms/$category"
                      params={{ category: chosen.category }}
                      className="font-medium text-primary hover:underline"
                    >
                      تعديل تصميم النموذج وحقوله
                    </Link>
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">عنوان الصفحة</p>
                <Input value={draft.title} onChange={(e) => change({ title: e.target.value })} />
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">الوصف</p>
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => change({ description: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <IconPicker
                  value={draft.icon}
                  color={draft.color}
                  onChange={(icon) => change({ icon })}
                />
                <ColorPicker value={draft.color} onChange={(color) => change({ color })} />
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">نص زر التعبئة</p>
                <Input
                  value={draft.config.newLabel}
                  onChange={(e) => setConfig({ newLabel: e.target.value })}
                  placeholder="تعبئة جديدة"
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={!!draft.isActive}
                  onCheckedChange={(v) => change({ isActive: v ? 1 : 0 })}
                />
                فعّالة
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={!!draft.config.showNotes}
                  onCheckedChange={(v) => setConfig({ showNotes: v ? 1 : 0 })}
                />
                خانة «ملاحظات» أسفل النموذج
              </label>
              {entryFor === "Student" && (
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">لمن يُعبّأ</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["any", "أي طالب"],
                        ["subjects", "الطلاب الخاضعون للنموذج فقط"],
                      ] as const
                    ).map(([k, l]) => (
                      <button
                        key={k}
                        onClick={() => setConfig({ students: k })}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs",
                          draft.config.students === k
                            ? "border-primary bg-primary-soft/50 font-bold text-primary"
                            : "border-border",
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="من يفتحها"
          description="يبقى الحذف للإدارة، وتعبئة المعلمين حسب إعدادات القسم"
        >
          <div className="space-y-2">
            {PAGE_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-xs">
                <Switch
                  checked={draft.personas.includes(r)}
                  onCheckedChange={(v) =>
                    change({
                      personas: v ? [...draft.personas, r] : draft.personas.filter((p) => p !== r),
                    })
                  }
                />
                {roleLabels[r]}
              </label>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            المعلم يرى ويعبّئ لطلابه وشعبه فقط، كما في ملف النماذج.
          </p>
        </SectionCard>
      </div>

      {!draft.template ? (
        <div className="mt-5">
          <EmptyBlock
            title="اختر النموذج"
            description="تُبنى الصفحة من نموذج مصمَّم في «النماذج المتخصصة». تُقترح لها الأعمدة والفلاتر، والحقول التي تُجلب من سجل الطالب."
            icon={<FileText className="size-6" />}
          />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-1.5 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
            <button
              onClick={() => void resuggest()}
              className="ms-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="يقترح النظام القواعد من أسماء الحقول"
            >
              <Wand2 className="size-3.5" />
              ضبط تلقائي
            </button>
            {dirty && (
              <span className="self-center text-[11px] font-medium text-warning">
                تغييرات غير محفوظة
              </span>
            )}
          </div>

          {template.isLoading ? (
            <DashboardSkeleton />
          ) : tab === "fields" ? (
            <div className="mt-4 space-y-2">
              <p className="rounded-xl bg-secondary/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <Sparkles className="me-1 inline size-3.5 text-primary" />
                <b>الجلب</b>: يأخذ الحقل قيمته من سجل الطالب أو الشعبة أو من يعبّئ أو تاريخ اليوم،
                أو من آخر إجابة في نموذج آخر للطالب نفسه. «دائماً» = تُجلب وتُقفل (ويفرضها الخادم
                عند الحفظ)؛ «إن كان فارغاً» = تُقترح ويمكن تعديلها.
              </p>
              {valueFields.map((f) => (
                <FieldRuleRow
                  key={f.fieldname}
                  field={f}
                  rule={draft.config.fields[f.fieldname] ?? {}}
                  typeLabel={opts.fieldTypes[f.fieldtype] ?? f.fieldtype}
                  sources={opts.sources}
                  entryFor={entryFor}
                  templates={opts.templates.filter((t) => t.name !== draft.template)}
                  onChange={(patch) => setRule(f.fieldname, patch)}
                />
              ))}
              {valueFields.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  لا حقول في هذا النموذج بعد.
                </p>
              )}
            </div>
          ) : tab === "list" ? (
            <ListSettings
              config={draft.config}
              fields={valueFields}
              entryFor={entryFor}
              builtins={opts.builtinColumns}
              onChange={setConfig}
            />
          ) : (
            <div className="mt-4">
              {!id || !saved.data ? (
                <EmptyBlock
                  title="احفظ الصفحة أولاً"
                  description="المعاينة تعمل على صفحة محفوظة، لتجرّب اختيار الطالب وجلب بياناته."
                  icon={<Eye className="size-6" />}
                />
              ) : (
                <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-5">
                  {dirty && (
                    <p className="mb-3 rounded-lg bg-warning/10 p-2 text-[11px] text-muted-foreground">
                      المعاينة تعرض الحقول بالتعديلات الحالية؛ أما الجلب والحفظ فبالقواعد المحفوظة —
                      احفظ لتجربتها كاملة. ما يُحفظ هنا نسخة حقيقية.
                    </p>
                  )}
                  <PageEntryEditor
                    key={JSON.stringify(draft.config.fields)}
                    def={{
                      ...saved.data,
                      config: draft.config,
                      ...(template.data ? { form: template.data } : {}),
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

// --- one field's rules -------------------------------------------------------------

function FieldRuleRow({
  field,
  rule,
  typeLabel,
  sources,
  entryFor,
  templates,
  onChange,
}: {
  field: FormField;
  rule: PageFieldRule;
  typeLabel: string;
  sources: FetchSource[];
  entryFor: string;
  templates: Array<{ name: string; title: string; categoryLabel: string }>;
  onChange: (patch: RulePatch | null) => void;
}) {
  const source = rule.fetch?.source ?? "";
  const isForm = source.startsWith("form:");
  const [formTemplate, setFormTemplate] = useState(isForm ? (source.split(":")[1] ?? "") : "");
  const [picking, setPicking] = useState(isForm);
  const otherFields = useTemplateFields(picking && formTemplate ? formTemplate : undefined);

  useEffect(() => {
    if (isForm) {
      setPicking(true);
      setFormTemplate(source.split(":")[1] ?? "");
    }
  }, [isForm, source]);

  const usable = sources.filter(
    (s) =>
      s.needs === "context" ||
      (s.needs === "student" && entryFor === "Student") ||
      (s.needs === "section" && entryFor !== "General"),
  );
  const groups = [...new Set(usable.map((s) => s.group))];
  const mode: FetchMode = rule.fetch?.mode ?? "if_empty";
  const active = !!(
    rule.fetch ||
    rule.hidden ||
    rule.readOnly ||
    rule.reqd ||
    rule.default ||
    rule.label ||
    rule.width
  );

  function setSource(value: string) {
    if (value === FORM_SOURCE) {
      setPicking(true);
      return;
    }
    setPicking(false);
    setFormTemplate("");
    onChange({ fetch: value ? { source: value, mode } : undefined });
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3",
        active ? "border-primary/30" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            {field.label}
            {field.reqd ? <span className="text-destructive"> *</span> : null}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            {typeLabel} · <span dir="ltr">{field.fieldname}</span>
          </span>
        </span>
        {rule.fetch && (
          <Pill tone={rule.fetch.mode === "always" ? "primary" : "info"}>
            {rule.fetch.mode === "always" ? "يُجلب ويُقفل" : "يُجلب ويُعدَّل"}
          </Pill>
        )}
        {rule.hidden ? <Pill tone="muted">مخفي</Pill> : null}
        {rule.readOnly ? <Pill tone="muted">للقراءة</Pill> : null}
        {active && (
          <button
            onClick={() => onChange(null)}
            className="text-[11px] text-muted-foreground hover:text-destructive"
            title="إزالة كل قواعد هذا الحقل"
          >
            مسح
          </button>
        )}
      </div>

      <div className="mt-2.5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="mb-0.5 text-[10px] text-muted-foreground">الجلب من</p>
          <select
            value={picking ? FORM_SOURCE : source}
            onChange={(e) => setSource(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs"
          >
            <option value="">— لا شيء —</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {usable
                  .filter((s) => s.group === g)
                  .map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
              </optgroup>
            ))}
            {entryFor !== "General" && (
              <optgroup label="نموذج آخر">
                <option value={FORM_SOURCE}>آخر إجابة في نموذج آخر…</option>
              </optgroup>
            )}
          </select>
        </div>
        {(rule.fetch || picking) && (
          <div>
            <p className="mb-0.5 text-[10px] text-muted-foreground">طريقة الجلب</p>
            <select
              value={mode}
              onChange={(e) =>
                rule.fetch &&
                onChange({ fetch: { ...rule.fetch, mode: e.target.value as FetchMode } })
              }
              disabled={!rule.fetch}
              className="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs disabled:opacity-50"
            >
              <option value="if_empty">إن كان فارغاً — يمكن تعديله</option>
              <option value="always">دائماً — مقفل</option>
            </select>
          </div>
        )}
        {picking && (
          <>
            <div>
              <p className="mb-0.5 text-[10px] text-muted-foreground">النموذج</p>
              <select
                value={formTemplate}
                onChange={(e) => {
                  setFormTemplate(e.target.value);
                  onChange({ fetch: undefined });
                }}
                className="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs"
              >
                <option value="">— اختر —</option>
                {templates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.categoryLabel} · {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] text-muted-foreground">الحقل فيه</p>
              <select
                value={isForm ? source.split(":").slice(2).join(":") : ""}
                onChange={(e) =>
                  onChange({
                    fetch: e.target.value
                      ? { source: `form:${formTemplate}:${e.target.value}`, mode }
                      : undefined,
                  })
                }
                disabled={!formTemplate}
                className="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs disabled:opacity-50"
              >
                <option value="">— اختر —</option>
                {(otherFields.data?.fields ?? []).map((f) => (
                  <option key={f.fieldname} value={f.fieldname}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="mb-0.5 text-[10px] text-muted-foreground">الاسم في الصفحة</p>
          <Input
            className="h-8 text-xs"
            value={rule.label ?? ""}
            placeholder={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
        <div>
          <p className="mb-0.5 text-[10px] text-muted-foreground">قيمة افتراضية</p>
          <Input
            className="h-8 text-xs"
            value={rule.default ?? ""}
            placeholder={field.default ? `من النموذج: ${field.default}` : "—"}
            onChange={(e) => onChange({ default: e.target.value })}
          />
        </div>
        <div>
          <p className="mb-0.5 text-[10px] text-muted-foreground">العرض</p>
          <select
            value={rule.width ?? ""}
            onChange={(e) =>
              onChange({ width: (e.target.value || undefined) as PageFieldRule["width"] })
            }
            className="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs"
          >
            <option value="">كما في النموذج</option>
            <option value="full">كامل</option>
            <option value="half">نصف</option>
            <option value="third">ثلث</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3 pb-1">
          <label className="flex items-center gap-1.5 text-[11px]">
            <Switch
              checked={!!rule.hidden}
              onCheckedChange={(v) => onChange({ hidden: v ? 1 : undefined })}
            />
            مخفي
          </label>
          <label className="flex items-center gap-1.5 text-[11px]">
            <Switch
              checked={!!rule.readOnly}
              onCheckedChange={(v) => onChange({ readOnly: v ? 1 : undefined })}
            />
            للقراءة
          </label>
          <label
            className="flex items-center gap-1.5 text-[11px]"
            title={field.reqd ? "إلزامي في النموذج نفسه" : ""}
          >
            <Switch
              checked={!!rule.reqd || !!field.reqd}
              disabled={!!field.reqd}
              onCheckedChange={(v) => onChange({ reqd: v ? 1 : undefined })}
            />
            إلزامي
          </label>
        </div>
      </div>
    </div>
  );
}

// --- the list ------------------------------------------------------------------------

function ListSettings({
  config,
  fields,
  entryFor,
  builtins,
  onChange,
}: {
  config: PageConfig;
  fields: FormField[];
  entryFor: string;
  builtins: Array<{ key: string; label: string }>;
  onChange: (next: Partial<PageConfig>) => void;
}) {
  const available = [
    ...builtins.filter(
      (b) =>
        !(entryFor === "General" && (b.key === "subject" || b.key === "section")) &&
        !(entryFor === "Section" && b.key === "section"),
    ),
    ...fields
      .filter((f) => COLUMN_TYPES.has(f.fieldtype))
      .map((f) => ({ key: f.fieldname, label: config.fields[f.fieldname]?.label || f.label })),
  ];
  const labelOf = (k: string) => available.find((a) => a.key === k)?.label ?? k;
  const unused = available.filter((a) => !config.columns.includes(a.key));
  const filterable = fields.filter((f) => FILTER_TYPES.has(f.fieldtype));

  function move(index: number, by: number) {
    const to = index + by;
    if (to < 0 || to >= config.columns.length) return;
    const next = [...config.columns];
    next.splice(to, 0, ...next.splice(index, 1));
    onChange({ columns: next });
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <SectionCard title="أعمدة القائمة" description="بالترتيب الذي تظهر به">
        <div className="space-y-1.5">
          {config.columns.map((c, i) => (
            <div
              key={c}
              className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
            >
              <span className="num w-5 text-[11px] text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{labelOf(c)}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded p-1 hover:bg-secondary disabled:opacity-30"
              >
                <ArrowUp className="size-3" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === config.columns.length - 1}
                className="rounded p-1 hover:bg-secondary disabled:opacity-30"
              >
                <ArrowDown className="size-3" />
              </button>
              <button
                onClick={() => onChange({ columns: config.columns.filter((x) => x !== c) })}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
        {unused.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] text-muted-foreground">أضف عموداً</p>
            <div className="flex flex-wrap gap-1.5">
              {unused.map((a) => (
                <button
                  key={a.key}
                  onClick={() => onChange({ columns: [...config.columns, a.key] })}
                  className="rounded-lg border border-dashed border-border px-2 py-1 text-[11px] hover:border-primary/40 hover:text-primary"
                >
                  + {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="فلاتر من إجابات النموذج"
        description="تظهر أعلى القائمة بجانب الحالة والشعبة والتاريخ والبحث"
      >
        {filterable.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا حقول اختيار في هذا النموذج.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filterable.map((f) => {
              const on = config.filters.includes(f.fieldname);
              return (
                <button
                  key={f.fieldname}
                  onClick={() =>
                    onChange({
                      filters: on
                        ? config.filters.filter((x) => x !== f.fieldname)
                        : [...config.filters, f.fieldname],
                    })
                  }
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    on
                      ? "border-primary/40 bg-primary-soft/40 font-medium text-primary"
                      : "border-dashed border-border text-muted-foreground",
                  )}
                >
                  {config.fields[f.fieldname]?.label || f.label}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          وكل جدول في النظام فيه أدوات الفلترة والتصدير إلى Excel والطباعة تلقائياً.
        </p>
      </SectionCard>
    </div>
  );
}

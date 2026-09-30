import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Eye,
  FileSpreadsheet,
  Lock,
  Pencil,
  Plus,
  Printer,
  Save,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { HtmlPreviewDialog } from "@/components/shared/html-preview-dialog";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import { downloadTable } from "@/lib/api/export";
import {
  getPeCards,
  printHtml,
  useDeletePeForm,
  usePeForms,
  usePeOptions,
  usePeOverview,
  usePeSheet,
  useSavePeForm,
  useSavePeSheet,
  useSectionOptions,
  useSetPeOpenPeriod,
  type PeCriterion,
  type PeForm,
  type PeOptions,
  type PeScaleOption,
  type PeScope,
  type PeSection,
  type PeType,
  type PeValue,
} from "@/lib/api/hooks";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/periodic-evaluations")({
  head: () => ({
    meta: [
      { title: "نماذج التقييم — Match Education" },
      {
        name: "description",
        content: "التقييم الشهري والدوري للطلاب: معلم كل مادة يقيّم مادته، ومربي الصف حقوله.",
      },
    ],
  }),
  component: PeriodicEvaluationsPage,
});

const HOMEROOM = "homeroom";
const SCOPE_LABEL: Record<PeScope, string> = { subject: "معلم المادة", homeroom: "مربي الصف" };
const TYPE_LABEL: Record<PeType, string> = { scale: "تقدير من المقياس", text: "نص", number: "رقم" };
const TONE_CLASS: Record<string, string> = {
  success: "border-success/40 bg-success-soft text-success",
  info: "border-info/40 bg-info-soft text-info",
  primary: "border-primary/30 bg-primary-soft text-primary",
  warning: "border-warning/50 bg-warning-soft text-warm-foreground",
  danger: "border-destructive/40 bg-destructive-soft text-destructive",
  muted: "border-border bg-secondary text-secondary-foreground",
};

type Tab = "follow" | "fill" | "forms";
/** Where the entry grid opens — set by the office's «إدخال / تعديل». */
type FillTarget = { form: string; period: string; section: string; choice: string };

function PeriodicEvaluationsPage() {
  const { role } = useApp();
  const office = role === "admin" || role === "secretary";
  const options = usePeOptions();
  const [tab, setTab] = useState<Tab>(office ? "follow" : "fill");
  const [target, setTarget] = useState<FillTarget | null>(null);

  if (role !== "admin" && role !== "secretary" && role !== "teacher")
    return <EmptyBlock title="غير متاح" description="هذه الشاشة للمعلمين والإدارة." />;

  const tabs: Array<{ key: Tab; label: string }> = office
    ? [
        { key: "follow", label: "متابعة التقييمات" },
        { key: "fill", label: "الإدخال" },
        { key: "forms", label: "النماذج" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="نماذج التقييم"
        subtitle={
          office
            ? "النماذج الشهرية والدورية: ما أدخله كل معلم لكل طالب، وما زال ناقصاً"
            : "قيّم طلاب شُعبك في موادك — وحقول مربي الصف لشعبتك"
        }
      />

      {tabs.length > 0 && (
        <div className="mb-5 inline-flex rounded-2xl border border-border bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                tab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {options.error ? (
        <ErrorState error={options.error} onRetry={() => options.refetch()} />
      ) : !options.data ? (
        <TableSkeleton rows={5} />
      ) : tab === "forms" ? (
        <FormsManager options={options.data} />
      ) : options.data.forms.filter((f) => f.isActive).length === 0 ? (
        <EmptyBlock
          title="لا توجد نماذج تقييم فعّالة"
          description={
            office
              ? "أنشئ نموذجاً من تبويب «النماذج»."
              : "لم تُنشئ الإدارة نموذج تقييم لهذا العام بعد."
          }
          icon={<ClipboardCheck className="size-6" />}
        />
      ) : tab === "follow" ? (
        <FollowUp
          options={options.data}
          onFill={(t) => {
            setTarget(t);
            setTab("fill");
          }}
        />
      ) : (
        <FillSheet options={options.data} target={target} key={JSON.stringify(target)} />
      )}
    </>
  );
}

// --- Shared pickers ----------------------------------------------------------

function Pick({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

function sectionsFor(form: PeForm | undefined, sections: PeSection[]) {
  if (!form) return [];
  return sections.filter((s) => !form.programs.length || form.programs.includes(s.program));
}

function defaultPeriod(form: PeForm | undefined) {
  return form ? form.openPeriod || form.periods[0] || "" : "";
}

/** Form, period and section — the three choices every view starts from. */
function useSelection(options: PeOptions, initial?: FillTarget | null) {
  const forms = options.forms.filter((f) => f.isActive);
  const [formId, setFormId] = useState(initial?.form ?? forms[0]?.id ?? "");
  const form = forms.find((f) => f.id === formId) ?? forms[0];
  const [period, setPeriod] = useState(initial?.period ?? defaultPeriod(form));
  const sections = sectionsFor(form, options.sections);
  const [sectionId, setSectionId] = useState(initial?.section ?? sections[0]?.id ?? "");
  const section = sections.find((s) => s.id === sectionId) ?? sections[0];

  function chooseForm(id: string) {
    setFormId(id);
    const next = forms.find((f) => f.id === id);
    setPeriod(defaultPeriod(next));
    const inNext = sectionsFor(next, options.sections);
    if (!inNext.some((s) => s.id === sectionId)) setSectionId(inNext[0]?.id ?? "");
  }

  const pickers = (
    <>
      <Pick label="النموذج" value={form?.id ?? ""} onChange={chooseForm}>
        {forms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title}
          </option>
        ))}
      </Pick>
      <Pick label="الفترة" value={period} onChange={setPeriod}>
        {(form?.periods ?? []).map((p) => (
          <option key={p} value={p}>
            {p}
            {p === form?.openPeriod ? " — مفتوحة للإدخال" : ""}
          </option>
        ))}
      </Pick>
      <Pick label="الشعبة" value={section?.id ?? ""} onChange={setSectionId}>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Pick>
    </>
  );

  return { form, period, section, sections, pickers };
}

function formatValue(v: PeValue | undefined) {
  if (v === undefined || v === null || v === "") return "";
  return String(v);
}

// --- Entry grid (teachers; the office too) --------------------------------------

function FillSheet({ options, target }: { options: PeOptions; target: FillTarget | null }) {
  const { form, period, section, sections, pickers } = useSelection(options, target);
  const choices = useMemo(() => {
    const list = (section?.courses ?? []).map((c) => ({ id: c.id, label: c.name }));
    if (section?.isHomeroom) list.push({ id: HOMEROOM, label: "حقول مربي الصف" });
    return list;
  }, [section]);
  const [choice, setChoice] = useState(target?.choice ?? "");
  const current = choices.find((c) => c.id === choice) ?? choices[0];
  const scope: PeScope = current?.id === HOMEROOM ? "homeroom" : "subject";

  const params = {
    ...(form ? { form: form.id } : {}),
    ...(period ? { period } : {}),
    ...(section ? { student_group: section.id } : {}),
    scope,
    ...(current && scope === "subject" ? { course: current.id } : {}),
  };
  const sheet = usePeSheet(params);
  const save = useSavePeSheet();
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const [dirty, setDirty] = useState(false);

  const data = sheet.data;
  useEffect(() => {
    if (!data) return;
    const next: Record<string, Record<string, string>> = {};
    for (const s of data.students) {
      next[s.id] = {};
      for (const c of data.criteria) next[s.id]![c.key] = formatValue(data.values[s.id]?.[c.key]);
    }
    setDraft(next);
    setDirty(false);
  }, [data]);

  if (!sections.length)
    return (
      <EmptyBlock
        title="لا توجد شُعب لهذا النموذج"
        description="النموذج مخصّص لصفوف لا تدرّسها، أو لم تُربط بعدُ بشعبة في الجدول."
      />
    );

  function setCell(student: string, key: string, value: string) {
    setDraft((d) => ({ ...d, [student]: { ...d[student], [key]: value } }));
    setDirty(true);
  }

  function fillEmpty(key: string, value: string) {
    setDraft((d) => {
      const next = { ...d };
      for (const s of data?.students ?? []) {
        if (!next[s.id]?.[key]) next[s.id] = { ...next[s.id], [key]: value };
      }
      return next;
    });
    setDirty(true);
  }

  async function submit() {
    if (!data) return;
    try {
      const res = await save.mutateAsync({ ...params, rows: draft });
      toast.success(res.message_ar || "تم الحفظ");
      setDirty(false);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  const scale = data?.form.scale ?? [];
  const editable = !!data?.editable;
  const filled = data
    ? data.students.filter((s) => Object.values(draft[s.id] ?? {}).some((v) => v !== "")).length
    : 0;

  return (
    <div className="space-y-4">
      <div className="card-surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {pickers}
        <Pick label="المادة" value={current?.id ?? ""} onChange={setChoice}>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Pick>
      </div>

      {!choices.length ? (
        <EmptyBlock
          title="لا توجد مواد لك في هذه الشعبة"
          description="تظهر هنا المواد التي تدرّسها في الشعبة حسب الجدول، وحقول مربي الصف إن كنت مربي الشعبة."
        />
      ) : sheet.error ? (
        <ErrorState error={sheet.error} onRetry={() => sheet.refetch()} />
      ) : !data ? (
        <TableSkeleton rows={6} />
      ) : !data.criteria.length ? (
        <EmptyBlock
          title={
            scope === "homeroom"
              ? "لا حقول لمربي الصف في هذا النموذج"
              : "لا معايير للمواد في هذا النموذج"
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Pill tone={scope === "homeroom" ? "warning" : "primary"}>
                {scope === "homeroom" ? "حقول مربي الصف" : data.courseName || current?.label}
              </Pill>
              <span className="text-muted-foreground">
                {data.section.name} · {period} · مُعبّأ{" "}
                <b className="num">
                  {filled}/{data.students.length}
                </b>
              </span>
              {!editable && (
                <Pill tone="danger">
                  <Lock className="me-1 size-3" />
                  {data.reason || "للعرض فقط"}
                </Pill>
              )}
            </div>
            {editable && (
              <button
                onClick={submit}
                disabled={!dirty || save.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-50"
              >
                <Save className="size-4" />
                {save.isPending ? "جارٍ الحفظ…" : dirty ? "حفظ التقييم" : "محفوظ"}
              </button>
            )}
          </div>

          <div className="card-surface overflow-x-auto">
            <table className="w-full text-sm" data-no-tools>
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
                  <th className="w-10 p-3 text-start">#</th>
                  <th className="min-w-44 p-3 text-start">الطالب</th>
                  {data.criteria.map((c) => (
                    <th key={c.key} className="p-3 text-start">
                      <div className="font-bold text-foreground">{c.label}</div>
                      {editable && c.type === "scale" && (
                        <select
                          value=""
                          onChange={(e) => e.target.value && fillEmpty(c.key, e.target.value)}
                          className="mt-1 h-7 rounded-lg border border-border bg-card px-2 text-[11px] font-normal"
                        >
                          <option value="">تعبئة الفارغ بـ…</option>
                          {scale.map((o) => (
                            <option key={o.label} value={o.label}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </th>
                  ))}
                  <th className="p-3 text-start">آخر إدخال</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s, i) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="num p-3 text-muted-foreground">{s.roll ?? i + 1}</td>
                    <td className="p-3 font-semibold">{s.name}</td>
                    {data.criteria.map((c) => (
                      <td key={c.key} className="p-2 align-middle">
                        <AnswerCell
                          criterion={c}
                          scale={scale}
                          value={draft[s.id]?.[c.key] ?? ""}
                          disabled={!editable}
                          onChange={(v) => setCell(s.id, c.key, v)}
                        />
                      </td>
                    ))}
                    <td className="p-3 text-[11px] text-muted-foreground">
                      {data.by[s.id] ? (
                        <>
                          {data.by[s.id]!.name}
                          <div className="num" dir="ltr">
                            {data.by[s.id]!.on}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AnswerCell({
  criterion,
  scale,
  value,
  disabled,
  onChange,
}: {
  criterion: PeCriterion;
  scale: PeScaleOption[];
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  if (criterion.type === "scale")
    return (
      <div className="flex flex-wrap gap-1">
        {scale.map((o) => {
          const on = o.label === value;
          return (
            <button
              key={o.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(on ? "" : o.label)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed",
                on
                  ? (TONE_CLASS[o.tone] ?? TONE_CLASS["muted"])
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  return (
    <Input
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      type={criterion.type === "number" ? "number" : "text"}
      className={cn("h-9 rounded-lg", criterion.type === "number" ? "w-24" : "min-w-56")}
      {...(criterion.type === "number"
        ? { min: 0, dir: "ltr" as const, ...(criterion.max ? { max: criterion.max } : {}) }
        : {})}
      placeholder={criterion.type === "number" && criterion.max ? `من ${criterion.max}` : ""}
    />
  );
}

// --- Follow-up (office) ---------------------------------------------------------

function FollowUp({ options, onFill }: { options: PeOptions; onFill: (t: FillTarget) => void }) {
  const { form, period, section, sections, pickers } = useSelection(options);
  const [view, setView] = useState("all");
  const overview = usePeOverview(form?.id, period, section?.id);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => setPicked(new Set()), [section?.id]);

  if (!sections.length)
    return (
      <EmptyBlock title="لا توجد شُعب" description="لا توجد شُعب للصفوف التي يشملها النموذج." />
    );

  const data = overview.data;
  const subjectCriteria = (data?.form.criteria ?? []).filter((c) => c.scope === "subject");
  const homeroomCriteria = (data?.form.criteria ?? []).filter((c) => c.scope === "homeroom");
  const students = data?.students ?? [];
  const courses = data?.courses ?? [];
  const entry = (student: string, course: string) => data?.entries[student]?.[course];
  const done = (course: string) => students.filter((s) => entry(s.id, course)).length;

  const viewCourse =
    view !== "all" && view !== HOMEROOM ? courses.find((c) => c.id === view) : null;
  const viewCriteria = view === HOMEROOM ? homeroomCriteria : subjectCriteria;

  async function printCards(ids?: string[]) {
    if (!form || !section) return;
    setPrinting(true);
    try {
      const page = await getPeCards(form.id, period, section.id, ids);
      printHtml(page.html, page.title);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّرت الطباعة"));
    } finally {
      setPrinting(false);
    }
  }

  async function exportExcel() {
    if (!data) return;
    const headers = ["#", "الطالب"];
    for (const c of courses)
      for (const k of subjectCriteria)
        headers.push(subjectCriteria.length > 1 ? `${c.name} — ${k.label}` : c.name);
    for (const k of homeroomCriteria) headers.push(k.label);
    const rows = students.map((s, i) => {
      const row = [String(s.roll ?? i + 1), s.name];
      for (const c of courses)
        for (const k of subjectCriteria) row.push(formatValue(entry(s.id, c.id)?.values[k.key]));
      for (const k of homeroomCriteria) row.push(formatValue(entry(s.id, HOMEROOM)?.values[k.key]));
      return row;
    });
    try {
      await downloadTable(`${data.form.title} — ${period} — ${data.section.name}`, headers, rows);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التصدير"));
    }
  }

  const allPicked = students.length > 0 && students.every((s) => picked.has(s.id));
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const cell = (student: string, course: string, crit: PeCriterion[]) => {
    const e = entry(student, course);
    if (!e)
      return (
        <span className="inline-block rounded-lg bg-destructive-soft px-2 py-1 text-[11px] font-semibold text-destructive">
          لم يُقيَّم
        </span>
      );
    const text = crit
      .map((k) => formatValue(e.values[k.key]))
      .filter(Boolean)
      .join(" · ");
    return (
      <span
        title={`${e.by} — ${e.on}`}
        className="inline-block rounded-lg bg-success-soft px-2 py-1 text-xs font-semibold text-success"
      >
        {text || "—"}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card-surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {pickers}
        <Pick label="العرض" value={view} onChange={setView}>
          <option value="all">كل المواد</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {homeroomCriteria.length > 0 && <option value={HOMEROOM}>حقول مربي الصف</option>}
        </Pick>
      </div>

      {overview.error ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : !data ? (
        <TableSkeleton rows={6} />
      ) : (
        <>
          {!data.applies && (
            <p className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-2 text-sm">
              هذا النموذج ليس لصفّ هذه الشعبة.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {courses.map((c) => {
              const n = done(c.id);
              const tone = n === 0 ? "danger" : n < students.length ? "warning" : "success";
              return (
                <button
                  key={c.id}
                  onClick={() => setView(c.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-start text-xs transition-colors",
                    TONE_CLASS[tone],
                    view === c.id && "ring-2 ring-primary/40",
                  )}
                >
                  <div className="font-bold">
                    {c.name}{" "}
                    <span className="num">
                      ({n}/{students.length})
                    </span>
                  </div>
                  <div className="opacity-80">
                    {c.teachers.map((t) => t.name).join("، ") || "بلا معلم في الجدول"}
                  </div>
                </button>
              );
            })}
            {homeroomCriteria.length > 0 && (
              <button
                onClick={() => setView(HOMEROOM)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-start text-xs",
                  TONE_CLASS[
                    done(HOMEROOM) === 0
                      ? "danger"
                      : done(HOMEROOM) < students.length
                        ? "warning"
                        : "success"
                  ],
                  view === HOMEROOM && "ring-2 ring-primary/40",
                )}
              >
                <div className="font-bold">
                  مربي الصف{" "}
                  <span className="num">
                    ({done(HOMEROOM)}/{students.length})
                  </span>
                </div>
                <div className="opacity-80">{data.section.homeroom?.name ?? "غير محدد للشعبة"}</div>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="me-3 inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-success" /> مُقيَّم (مرّر المؤشر لترى من
                قيّم)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-destructive" /> لم يُقيَّم بعد
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {(viewCourse || view === HOMEROOM) && (
                <button
                  onClick={() =>
                    form &&
                    section &&
                    onFill({ form: form.id, period, section: section.id, choice: view })
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold hover:bg-secondary"
                >
                  <Pencil className="size-3.5" />
                  إدخال / تعديل
                </button>
              )}
              <button
                onClick={exportExcel}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold hover:bg-secondary"
              >
                <FileSpreadsheet className="size-3.5" />
                Excel الشعبة كاملة
              </button>
              <button
                onClick={() => printCards(picked.size ? [...picked] : undefined)}
                disabled={printing}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                <Printer className="size-3.5" />
                {printing
                  ? "جارٍ التجهيز…"
                  : picked.size
                    ? `طباعة / PDF للمحدَّدين (${picked.size})`
                    : "طباعة / PDF للشعبة كاملة"}
              </button>
            </div>
          </div>

          <div className="card-surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
                  <th className="w-10 p-3">
                    <input
                      type="checkbox"
                      checked={allPicked}
                      onChange={(e) =>
                        setPicked(e.target.checked ? new Set(students.map((s) => s.id)) : new Set())
                      }
                      aria-label="تحديد الكل"
                    />
                  </th>
                  <th className="w-10 p-3 text-start">#</th>
                  <th className="min-w-44 p-3 text-start">الطالب</th>
                  {view === "all" ? (
                    <>
                      {courses.map((c) => (
                        <th key={c.id} className="p-3 text-start">
                          {c.name}
                        </th>
                      ))}
                      {homeroomCriteria.map((k) => (
                        <th key={k.key} className="bg-warning-soft/60 p-3 text-start">
                          {k.label}
                        </th>
                      ))}
                    </>
                  ) : (
                    <>
                      {viewCriteria.map((k) => (
                        <th key={k.key} className="p-3 text-start">
                          {k.label}
                        </th>
                      ))}
                      <th className="p-3 text-start">المقيِّم</th>
                      <th className="p-3 text-start">التاريخ</th>
                    </>
                  )}
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const key = view === "all" ? null : view;
                  const e = key ? entry(s.id, key) : undefined;
                  return (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={picked.has(s.id)}
                          onChange={() => toggle(s.id)}
                          aria-label={`تحديد ${s.name}`}
                        />
                      </td>
                      <td className="num p-3 text-muted-foreground">{s.roll ?? i + 1}</td>
                      <td className="p-3 font-semibold">{s.name}</td>
                      {view === "all" ? (
                        <>
                          {courses.map((c) => (
                            <td key={c.id} className="p-2">
                              {cell(s.id, c.id, subjectCriteria)}
                            </td>
                          ))}
                          {homeroomCriteria.map((k) => {
                            const v = formatValue(entry(s.id, HOMEROOM)?.values[k.key]);
                            return (
                              <td key={k.key} className="max-w-64 p-2 text-xs">
                                {v ? (
                                  <span title={entry(s.id, HOMEROOM)?.by}>{v}</span>
                                ) : (
                                  <span className="text-destructive">—</span>
                                )}
                              </td>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          {viewCriteria.map((k) => (
                            <td key={k.key} className="p-2">
                              {e ? (
                                <span className="inline-block rounded-lg bg-success-soft px-2 py-1 text-xs font-semibold text-success">
                                  {formatValue(e.values[k.key]) || "—"}
                                </span>
                              ) : (
                                <span className="inline-block rounded-lg bg-destructive-soft px-2 py-1 text-[11px] font-semibold text-destructive">
                                  لم يُقيَّم
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="p-3 text-xs">
                            {e ? e.by : <span className="text-destructive">—</span>}
                          </td>
                          <td className="num p-3 text-[11px] text-muted-foreground" dir="ltr">
                            {e?.on ?? ""}
                          </td>
                        </>
                      )}
                      <td className="p-2">
                        <button
                          onClick={() => setPreview({ id: s.id, name: s.name })}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs hover:bg-secondary"
                        >
                          <Eye className="size-3.5" />
                          التقرير
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {preview && form && section && (
        <HtmlPreviewDialog
          heading={`${form.title} — ${preview.name}`}
          load={() => getPeCards(form.id, period, section.id, [preview.id])}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

// --- Forms (office) -------------------------------------------------------------

function FormsManager({ options }: { options: PeOptions }) {
  const list = usePeForms();
  const setOpen = useSetPeOpenPeriod();
  const remove = useDeletePeForm();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<PeForm | "new" | null>(null);

  async function open(form: PeForm, period: string) {
    try {
      const res = await setOpen.mutateAsync({ form: form.id, period });
      toast.success(res.message_ar || "تم");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التحديث"));
    }
  }

  async function drop(form: PeForm) {
    const ok = await confirm({
      title: `حذف «${form.title}»؟`,
      description: form.entries
        ? "النموذج فيه تقييمات، فسيُوقف بدل حذفه ويبقى ما أُدخل محفوظاً."
        : "لم يُدخل عليه أي تقييم بعد.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      const res = await remove.mutateAsync(form.id);
      toast.success(res.message_ar || "تم");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing("new")}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
        >
          <Plus className="size-4" />
          نموذج تقييم جديد
        </button>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <TableSkeleton rows={3} />
      ) : list.data.forms.length === 0 ? (
        <EmptyBlock
          title="لا توجد نماذج بعد"
          description="أنشئ نموذجاً (شهري، كل شهرين، نصفي، سنوي) وحدّد معاييره."
          icon={<ClipboardCheck className="size-6" />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.data.forms.map((f) => {
            const subject = f.criteria.filter((c) => c.scope === "subject");
            const homeroom = f.criteria.filter((c) => c.scope === "homeroom");
            return (
              <div key={f.id} className="card-surface space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold">{f.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.periodType} · {f.academicYear || "كل الأعوام"} ·{" "}
                      {f.programs.length ? f.programs.join("، ") : "كل الصفوف"}
                    </p>
                  </div>
                  <Pill tone={f.isActive ? "success" : "muted"}>
                    {f.isActive ? "فعّال" : "موقوف"}
                  </Pill>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {subject.map((c) => (
                    <Pill key={c.key} tone="primary">
                      {c.label}
                    </Pill>
                  ))}
                  {homeroom.map((c) => (
                    <Pill key={c.key} tone="warning">
                      {c.label} · مربي الصف
                    </Pill>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-48 flex-1">
                    <Pick
                      label="الإدخال للمعلمين"
                      value={f.openPeriod}
                      onChange={(p) => void open(f, p)}
                    >
                      <option value="">مغلق</option>
                      {f.periods.map((p) => (
                        <option key={p} value={p}>
                          مفتوح: {p}
                        </option>
                      ))}
                    </Pick>
                  </div>
                  <span className="pb-2 text-xs text-muted-foreground">
                    {f.openPeriod ? (
                      <Unlock className="inline size-3.5 text-success" />
                    ) : (
                      <Lock className="inline size-3.5" />
                    )}{" "}
                    <span className="num">{f.entries ?? 0}</span> تقييماً
                  </span>
                  <button
                    onClick={() => setEditing(f)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-secondary"
                  >
                    <Pencil className="size-4" />
                    تعديل
                  </button>
                  <button
                    onClick={() => drop(f)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-destructive/40 px-3 text-sm font-semibold text-destructive hover:bg-destructive-soft"
                    aria-label="حذف"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <FormDialog
          form={editing === "new" ? null : editing}
          options={options}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

type DraftCriterion = Omit<PeCriterion, "key"> & { key: string };

function FormDialog({
  form,
  options,
  onClose,
}: {
  form: PeForm | null;
  options: PeOptions;
  onClose: () => void;
}) {
  const save = useSavePeForm();
  const years = useSectionOptions().data?.academicYears ?? [];
  const presets = options.presets;
  const [title, setTitle] = useState(form?.title ?? "التقييم الشهري");
  const [periodType, setPeriodType] = useState(form?.periodType ?? "شهري");
  const [periods, setPeriods] = useState(
    (form?.periods ?? presets.periods["شهري"] ?? []).join("\n"),
  );
  const [heading, setHeading] = useState(form?.heading ?? presets.headings["شهري"] ?? "");
  const [academicYear, setAcademicYear] = useState(
    form?.academicYear ?? options.academicYear ?? "",
  );
  const [programs, setPrograms] = useState<string[]>(form?.programs ?? []);
  const [scale, setScale] = useState<PeScaleOption[]>(form?.scale ?? presets.scale);
  const [criteria, setCriteria] = useState<DraftCriterion[]>(
    form?.criteria ?? presets.criteria.map((c) => ({ ...c, key: "" })),
  );
  const [principalName, setPrincipalName] = useState(form?.principalName ?? "");
  const [isActive, setIsActive] = useState(form?.isActive ?? true);
  const [openPeriod, setOpenPeriod] = useState(form?.openPeriod ?? "");
  const periodList = periods
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  function changeType(t: string) {
    setPeriodType(t);
    setPeriods((presets.periods[t] ?? []).join("\n"));
    setHeading(presets.headings[t] ?? heading);
    setOpenPeriod("");
  }

  function patchCriterion(i: number, patch: Partial<DraftCriterion>) {
    setCriteria((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function move(i: number, by: number) {
    setCriteria((cs) => {
      const next = [...cs];
      const j = i + by;
      if (j < 0 || j >= next.length) return cs;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  async function submit() {
    try {
      const res = await save.mutateAsync({
        ...(form ? { id: form.id } : {}),
        title,
        periodType,
        periods: periodList,
        heading,
        academicYear: academicYear || null,
        programs,
        scale,
        criteria: criteria.map((c) => ({ ...c })),
        principalName,
        isActive,
        openPeriod: periodList.includes(openPeriod) ? openPeriod : "",
      });
      toast.success(res.message_ar || "تم الحفظ");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{form ? "تعديل نموذج التقييم" : "نموذج تقييم جديد"}</DialogTitle>
          <DialogDescription>
            معايير «معلم المادة» يعبّئها معلم كل مادة لطلاب شعبته، وحقول «مربي الصف» يعبّئها مربي
            الشعبة وحده.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>اسم النموذج</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Pick label="الدورية" value={periodType} onChange={changeType}>
            {Object.keys(presets.periods).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Pick>
          <div className="space-y-1.5">
            <Label>عنوان الطباعة</Label>
            <Input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">
              يُطبع مع الفترة: «{heading} لـ{periodList[0] ?? "…"}»
            </p>
          </div>
          <Pick label="العام الدراسي" value={academicYear} onChange={setAcademicYear}>
            <option value="">كل الأعوام</option>
            {[...new Set([academicYear, ...years].filter(Boolean))].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Pick>
          <div className="space-y-1.5">
            <Label>الفترات (سطر لكل فترة)</Label>
            <Textarea
              value={periods}
              onChange={(e) => setPeriods(e.target.value)}
              rows={4}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-3">
            <Pick label="الإدخال للمعلمين" value={openPeriod} onChange={setOpenPeriod}>
              <option value="">مغلق</option>
              {periodList.map((p) => (
                <option key={p} value={p}>
                  مفتوح: {p}
                </option>
              ))}
            </Pick>
            <div className="space-y-1.5">
              <Label>اسم مدير المدرسة (للطباعة)</Label>
              <Input
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>الصفوف (بلا تحديد = كل الصفوف)</Label>
          <div className="flex flex-wrap gap-1.5">
            {options.programs.map((p) => {
              const on = programs.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrograms((ps) => (on ? ps.filter((x) => x !== p) : [...ps, p]))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    on ? TONE_CLASS["primary"] : "border-border hover:bg-secondary",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>خيارات المقياس</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {scale.map((o, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1 py-0.5",
                  TONE_CLASS[o.tone] ?? TONE_CLASS["muted"],
                )}
              >
                <input
                  value={o.label}
                  onChange={(e) =>
                    setScale((s) =>
                      s.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  className="w-20 bg-transparent px-1 text-xs font-semibold outline-none"
                />
                <button
                  type="button"
                  onClick={() => setScale((s) => s.filter((_, j) => j !== i))}
                  aria-label="حذف الخيار"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setScale((s) => [...s, { label: "", tone: "muted" }])}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs"
            >
              <Plus className="size-3" />
              خيار
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>المعايير والحقول</Label>
          <div className="space-y-2">
            {criteria.map((c, i) => (
              <div
                key={i}
                className={cn(
                  "grid items-center gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_9rem_9rem_auto]",
                  c.scope === "homeroom" ? "border-warning/50 bg-warning-soft/40" : "border-border",
                )}
              >
                <Input
                  value={c.label}
                  onChange={(e) => patchCriterion(i, { label: e.target.value })}
                  placeholder="اسم المعيار"
                  className="h-9 rounded-lg"
                />
                <select
                  value={c.scope}
                  onChange={(e) => patchCriterion(i, { scope: e.target.value as PeScope })}
                  className="h-9 rounded-lg border border-border bg-card px-2 text-xs"
                >
                  {(Object.keys(SCOPE_LABEL) as PeScope[]).map((s) => (
                    <option key={s} value={s}>
                      يعبّئه: {SCOPE_LABEL[s]}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <select
                    value={c.type}
                    onChange={(e) => patchCriterion(i, { type: e.target.value as PeType })}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-xs"
                  >
                    {(Object.keys(TYPE_LABEL) as PeType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  {c.type === "number" && (
                    <Input
                      type="number"
                      value={c.max ?? ""}
                      onChange={(e) => patchCriterion(i, { max: Number(e.target.value) || 0 })}
                      placeholder="من"
                      className="h-9 w-16 rounded-lg"
                      dir="ltr"
                    />
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    aria-label="أعلى"
                    className="grid size-8 place-items-center rounded-lg border border-border"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    aria-label="أسفل"
                    className="grid size-8 place-items-center rounded-lg border border-border"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriteria((cs) => cs.filter((_, j) => j !== i))}
                    aria-label="حذف"
                    className="grid size-8 place-items-center rounded-lg border border-destructive/40 text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setCriteria((cs) => [
                  ...cs,
                  { key: "", label: "", scope: "subject", type: "scale" },
                ])
              }
              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              معيار لمعلم المادة
            </button>
            <button
              type="button"
              onClick={() =>
                setCriteria((cs) => [
                  ...cs,
                  { key: "", label: "", scope: "homeroom", type: "text" },
                ])
              }
              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-warning/60 px-3 py-1.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              حقل لمربي الصف
            </button>
          </div>
          {form?.entries ? (
            <p className="text-[11px] text-warning">
              النموذج فيه {form.entries} تقييماً: حذف معيار يُخفي ما أُدخل عليه من الطباعة.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-medium">النموذج فعّال</p>
            <p className="text-[11px] text-muted-foreground">الموقوف لا يظهر للمعلمين.</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

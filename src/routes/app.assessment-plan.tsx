import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  FilePlus2,
  LayoutTemplate,
  Layers,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wand2,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import { isBackOffice } from "@/lib/roles";
import {
  useAssessmentPlan,
  useQuarters,
  useSaveAssessmentPlan,
  useSaveQuarters,
  useSubjects,
  useApplyPlanTemplate,
  useDeletePlanTemplate,
  usePlanTemplate,
  usePlanTemplates,
  useSavePlanTemplate,
  type PlanCategory,
  type PlanTemplateSummary,
  type Quarter,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/assessment-plan")({
  validateSearch: groupSearch,
  head: () => ({
    meta: [
      { title: "خطة التقييم — Match Education" },
      {
        name: "description",
        content: "تقسيم الفصل إلى أرباع، وبناء خطة التقييم لكل مادة كشجرة تصنيفات وامتحانات.",
      },
    ],
  }),
  component: AssessmentPlanPage,
});

/** A category being edited, before it is sent to the server. */
type DraftCategory = {
  quarter: string;
  name: string;
  type: string;
  weight: string;
  children: Array<{ name: string; maxScore: string }>;
};

const TYPES = [
  { value: "Exam", label: "امتحان" },
  { value: "Quiz", label: "اختبار قصير" },
  { value: "Activity", label: "نشاط" },
  { value: "Homework", label: "واجب" },
  { value: "Participation", label: "مشاركة" },
  { value: "Project", label: "مشروع" },
];

function AssessmentPlanPage() {
  const { role } = useApp();
  const canEditQuarters = isBackOffice(role);

  const quartersQuery = useQuarters();
  // Opened from a class: only that class's subjects are offered, and the
  // first is chosen — a plan belongs to a subject, so the class narrows the
  // list rather than selecting for it.
  const { group: groupFromUrl } = Route.useSearch();
  const subjects = useSubjects(groupFromUrl ? { student_group: groupFromUrl } : {});
  const [course, setCourse] = useState("");

  const planQuery = useAssessmentPlan(course || undefined);
  const savePlan = useSaveAssessmentPlan();

  const quarters = useMemo(() => quartersQuery.data?.quarters ?? [], [quartersQuery.data]);
  const termBase = quarters.reduce((a, q) => a + q.totalMarks, 0);
  // What this subject is out of during the term, and on the certificate.
  const [termTotal, setTermTotal] = useState(0);
  const [certificateMax, setCertificateMax] = useState(100);
  const subjectTotal = termTotal || termBase;
  const subjectQuarters = useMemo(
    () => scaleQuarters(quarters, subjectTotal),
    [quarters, subjectTotal],
  );

  // The plan is edited locally and sent in one go: a half-saved plan whose
  // weights do not add up is worse than no plan at all.
  const [draft, setDraft] = useState<DraftCategory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"plans" | "templates">("plans");
  const confirm = useConfirm();
  const templates = usePlanTemplates();
  const canManageTemplates = templates.data?.canEdit ?? isBackOffice(role);
  // «تحميل من نموذج»: the template is fetched, then poured into the editor —
  // nothing is saved until the plan itself is saved.
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const templateQuery = usePlanTemplate(loadingTemplate);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [applying, setApplying] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!loadingTemplate || !templateQuery.data) return;
    const t = templateQuery.data;
    if (t.applied.problems.length) {
      toast.error("النموذج لا يناسب أرباع هذا الفصل", {
        description: t.applied.problems.join("\n"),
      });
    } else {
      setDraft(t.applied.categories.map(fromApplied));
      setTermTotal(t.applied.termTotal || termBase);
      setCertificateMax(t.applied.certificateMax || 100);
      toast.success(`تم تحميل «${t.name}» — راجع الخطة ثم احفظها`, {
        description: t.applied.notes.join("\n") || undefined,
      });
    }
    setLoadingTemplate(null);
  }, [loadingTemplate, templateQuery.data, termBase]);

  useEffect(() => {
    if (!planQuery.data) return;
    const rows: DraftCategory[] = [];
    for (const q of planQuery.data.quarters) {
      for (const c of q.categories) rows.push(toDraft(c, q.name));
    }
    for (const c of planQuery.data.unassigned) rows.push(toDraft(c, quarters[0]?.name ?? ""));
    setDraft(rows);
    setTermTotal(planQuery.data.termTotal || planQuery.data.termBaseTotal || 0);
    setCertificateMax(planQuery.data.certificateMax || 100);
    setLoaded(true);
  }, [planQuery.data]);

  function toDraft(c: PlanCategory, quarter: string): DraftCategory {
    return {
      quarter: c.quarter || quarter,
      name: c.name,
      type: c.type || "Exam",
      weight: String(c.weight ?? ""),
      children: (c.children ?? []).map((ch) => ({
        name: ch.name,
        maxScore: String(ch.maxScore ?? ""),
      })),
    };
  }

  /** Weight used per quarter, so the screen can show the shortfall live. */
  const usedByQuarter = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of draft) {
      map[c.quarter] = (map[c.quarter] ?? 0) + (Number(c.weight) || 0);
    }
    return map;
  }, [draft]);

  async function save() {
    if (!course) {
      toast.error("اختر المادة أولاً");
      return;
    }
    // Checked here as well as on the server so the teacher sees the shortfall
    // before a round trip, and on the exact quarter that is wrong.
    for (const q of subjectQuarters) {
      const used = usedByQuarter[q.name] ?? 0;
      const mine = draft.filter((c) => c.quarter === q.name);
      if (mine.length === 0) continue;
      // Categories are written in the quarter's own marks: a 40-mark quarter
      // has categories adding to 40, not to 100.
      if (Math.abs(used - q.totalMarks) > 0.01) {
        toast.error(`${q.name}: مجموع العلامات ${used} — يجب أن يكون ${q.totalMarks}`);
        return;
      }
    }
    try {
      const res = await savePlan.mutateAsync({
        course,
        term_total: subjectTotal,
        certificate_max: certificateMax,
        categories: draft.map((c) => ({
          quarter: c.quarter,
          name: c.name.trim(),
          type: c.type,
          weight: Number(c.weight) || 0,
          children: c.children
            .filter((ch) => ch.name.trim())
            .map((ch) => ({ name: ch.name.trim(), maxScore: Number(ch.maxScore) || 0 })),
        })),
      });
      toast.success(res.message_ar || "تم حفظ الخطة");
    } catch (err) {
      const message = (err as { messageAr?: string }).messageAr || "تعذّر حفظ الخطة";
      // The server returns each problem on its own line.
      toast.error(message.split("\n")[0] ?? message, {
        description: message.split("\n").slice(1).join("\n") || undefined,
        duration: 8000,
      });
    }
  }

  return (
    <>
      <PageHeader
        title="خطة التقييم"
        subtitle="قسّم الفصل إلى أرباع، ثم ابنِ لكل مادة تصنيفاتها والامتحانات داخل كل تصنيف."
        actions={
          course ? (
            <button
              onClick={save}
              disabled={savePlan.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Save className="size-4" />
              {savePlan.isPending ? "جارٍ الحفظ…" : "حفظ الخطة"}
            </button>
          ) : null
        }
      />

      <div className="mt-6">
        <QuarterEditor canEdit={canEditQuarters} />
      </div>

      {quarters.length > 0 && (
        <div className="mt-6 inline-flex rounded-xl border border-border bg-secondary/40 p-1">
          {(
            [
              ["plans", "خطط المواد", Layers],
              ["templates", "نماذج الخطط", LayoutTemplate],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
              {key === "templates" && (templates.data?.templates.length ?? 0) > 0 && (
                <span className="num rounded-full bg-primary-soft px-1.5 text-[11px] text-primary">
                  {templates.data!.templates.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {quarters.length > 0 && tab === "templates" ? (
        <TemplatesPanel
          quarters={quarters}
          canEdit={canManageTemplates}
          onApply={(id) => setApplying(id)}
        />
      ) : quarters.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock
            title="لم يتم تقسيم الفصل بعد"
            description="عرّف أرباع الفصل أولاً — لا يمكن بناء خطة تقييم بدونها."
            icon={<CalendarRange className="size-6" />}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div className="w-full max-w-md">
              <Label>المادة</Label>
              <div className="mt-1.5">
                <SearchableSelect
                  options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  value={course}
                  onChange={setCourse}
                  placeholder="اختر المادة"
                  searchPlaceholder="ابحث عن مادة…"
                />
              </div>
            </div>
            {course && (templates.data?.templates.length ?? 0) > 0 && (
              <div className="w-full max-w-xs">
                <Label>تحميل من نموذج</Label>
                <div className="mt-1.5">
                  <SearchableSelect
                    options={(templates.data?.templates ?? []).map((t) => ({
                      value: t.id,
                      label: t.name,
                      hint: `${t.categories} تصنيف · ${t.assessments} امتحان`,
                    }))}
                    value={loadingTemplate ?? ""}
                    onChange={async (v) => {
                      if (!v) return;
                      if (draft.length) {
                        const ok = await confirm({
                          title: "استبدال الخطة الحالية بالنموذج؟",
                          description:
                            "ستُملأ الخطة من النموذج في هذه الشاشة فقط — لا شيء يُحفظ حتى تضغط «حفظ الخطة».",
                          confirmLabel: "تحميل النموذج",
                        });
                        if (!ok) return;
                      }
                      setLoadingTemplate(v);
                    }}
                    placeholder={templateQuery.isFetching ? "جارٍ التحميل…" : "اختر نموذجاً"}
                  />
                </div>
              </div>
            )}
            {course && canManageTemplates && draft.length > 0 && (
              <button
                onClick={() => setSavingAsTemplate(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary"
              >
                <Copy className="size-4" />
                حفظ كنموذج
              </button>
            )}
          </div>

          {!course ? (
            <div className="mt-6">
              <EmptyBlock title="اختر مادة لعرض خطتها" icon={<Layers className="size-6" />} />
            </div>
          ) : planQuery.isLoading && !loaded ? (
            <div className="mt-6">
              <TableSkeleton rows={5} />
            </div>
          ) : planQuery.error ? (
            <div className="mt-6">
              <ErrorState error={planQuery.error} onRetry={() => planQuery.refetch()} />
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <ScaleCard
                termTotal={subjectTotal}
                termBase={termBase}
                certificateMax={certificateMax}
                onTermTotal={(next) => {
                  if (next === subjectTotal) return;
                  setDraft((d) => rescaleDraft(d, subjectTotal, next));
                  if (draft.length) {
                    toast.success(`حُوّلت علامات التصنيفات من ${subjectTotal} إلى ${next}`);
                  }
                  setTermTotal(next);
                }}
                onCertificateMax={setCertificateMax}
              />
              <PlanQuarters quarters={subjectQuarters} draft={draft} setDraft={setDraft} />

              {planQuery.data?.orphans && planQuery.data.orphans.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                  <p className="font-semibold text-amber-800">
                    امتحانات بلا تصنيف ({planQuery.data.orphans.length})
                  </p>
                  <p className="text-amber-700/90">
                    {planQuery.data.orphans.map((o) => o.name).join("، ")} — أُعيدت تسمية التصنيف
                    دون تحديث الامتحانات بداخله.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {savingAsTemplate && (
        <TemplateMetaDialog
          title="حفظ الخطة كنموذج"
          description={`تُحفظ بنية خطة «${course}» (التصنيفات والامتحانات والعلامات) لاستخدامها مع مواد أخرى.`}
          onClose={() => setSavingAsTemplate(false)}
          quarters={subjectQuarters}
          certificateMax={certificateMax}
          draft={draft}
        />
      )}
      {applying !== undefined && (
        <ApplyTemplateDialog
          initialTemplate={applying}
          templates={templates.data?.templates ?? []}
          subjects={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          onClose={() => setApplying(undefined)}
        />
      )}
    </>
  );
}

/** The term's quarters as shares of a subject worth `total` (80/120 of 200 for 40/60). */
function scaleQuarters(quarters: Quarter[], total: number): Quarter[] {
  const base = quarters.reduce((a, q) => a + q.totalMarks, 0);
  if (!total || !base || Math.abs(total - base) < 0.005) return quarters;
  const out = quarters.map((q) => ({
    ...q,
    totalMarks: Math.round(((q.totalMarks * total) / base) * 100) / 100,
  }));
  const drift = Math.round((total - out.reduce((a, q) => a + q.totalMarks, 0)) * 100) / 100;
  const last = out[out.length - 1];
  if (last && drift) last.totalMarks = Math.round((last.totalMarks + drift) * 100) / 100;
  return out;
}

/** Category marks carried from one subject total to another, in proportion. */
function rescaleDraft(draft: DraftCategory[], from: number, to: number): DraftCategory[] {
  if (!from || !to || from === to) return draft;
  return draft.map((c) => ({
    ...c,
    weight:
      c.weight === ""
        ? c.weight
        : String(Math.round(((Number(c.weight) || 0) * to * 100) / from) / 100),
  }));
}

/** What the subject is out of: during the term, and on the certificate. */
function ScaleCard({
  termTotal,
  termBase,
  certificateMax,
  onTermTotal,
  onCertificateMax,
}: {
  termTotal: number;
  termBase: number;
  certificateMax: number;
  onTermTotal: (v: number) => void;
  onCertificateMax: (v: number) => void;
}) {
  const [term, setTerm] = useState(String(termTotal));
  const [cert, setCert] = useState(String(certificateMax));
  useEffect(() => setTerm(String(termTotal)), [termTotal]);
  useEffect(() => setCert(String(certificateMax)), [certificateMax]);
  function commitTerm() {
    const v = Number(term);
    if (v > 0) onTermTotal(v);
    else setTerm(String(termTotal));
  }
  function commitCert() {
    const v = Number(cert);
    if (v > 0) onCertificateMax(v);
    else setCert(String(certificateMax));
  }
  return (
    <div className="card-surface grid gap-4 p-5 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>مجموع علامات المادة خلال الفصل</Label>
        <Input
          type="number"
          min={1}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onBlur={commitTerm}
          onKeyDown={(e) => e.key === "Enter" && commitTerm()}
          className="num h-10 w-40 text-center"
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">
          الأرباع حصص منه بنفس نسب الفصل
          {termTotal !== termBase ? ` (الفصل مقسّم على ${termBase})` : ""}. تغييره يحوّل علامات
          التصنيفات بالنسبة نفسها.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>علامة المادة على الشهادة</Label>
        <Input
          type="number"
          min={1}
          value={cert}
          onChange={(e) => setCert(e.target.value)}
          onBlur={commitCert}
          onKeyDown={(e) => e.key === "Enter" && commitCert()}
          className="num h-10 w-40 text-center"
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">
          تُطبع المادة على الشهادة من هذه العلامة (مقرّبة لأقرب علامة كاملة)، وتؤثر في المعدل العام
          بقدرها: مادة من 200 وزنها ضعف مادة من 100.
        </p>
      </div>
    </div>
  );
}

/** A category of the current term, back to a template row by quarter position. */
function toTemplateRows(draft: DraftCategory[], quarters: Quarter[]) {
  return draft.map((c) => ({
    q: Math.max(
      0,
      quarters.findIndex((q) => q.name === c.quarter),
    ),
    name: c.name.trim(),
    type: c.type,
    weight: Number(c.weight) || 0,
    children: c.children
      .filter((ch) => ch.name.trim())
      .map((ch) => ({ name: ch.name.trim(), maxScore: Number(ch.maxScore) || 0 })),
  }));
}

function fromApplied(c: {
  quarter: string;
  name: string;
  type: string;
  weight: number;
  children: Array<{ name: string; maxScore: number }>;
}): DraftCategory {
  return {
    quarter: c.quarter,
    name: c.name,
    type: c.type || "Exam",
    weight: String(c.weight),
    children: c.children.map((ch) => ({ name: ch.name, maxScore: String(ch.maxScore) })),
  };
}

function problemsToast(err: unknown, fallback: string) {
  const message = (err as { messageAr?: string }).messageAr || fallback;
  toast.error(message.split("\n")[0] ?? message, {
    description: message.split("\n").slice(1).join("\n") || undefined,
    duration: 8000,
  });
}

/** The quarters of the term, each with its categories — shared by plans and templates. */
function PlanQuarters({
  quarters,
  draft,
  setDraft,
}: {
  quarters: Quarter[];
  draft: DraftCategory[];
  setDraft: React.Dispatch<React.SetStateAction<DraftCategory[]>>;
}) {
  const usedByQuarter = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of draft) map[c.quarter] = (map[c.quarter] ?? 0) + (Number(c.weight) || 0);
    return map;
  }, [draft]);
  function update(index: number, patch: Partial<DraftCategory>) {
    setDraft((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }
  function addCategory(quarter: string) {
    setDraft((prev) => [...prev, { quarter, name: "", type: "Exam", weight: "", children: [] }]);
  }
  function addAssessment(index: number) {
    setDraft((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, children: [...c.children, { name: "", maxScore: "" }] } : c,
      ),
    );
  }
  return (
    <>
      {quarters.map((q) => {
        const used = usedByQuarter[q.name] ?? 0;
        const mine = draft.map((c, i) => ({ c, i })).filter(({ c }) => c.quarter === q.name);
        const balanced = Math.abs(used - q.totalMarks) < 0.01;
        return (
          <SectionCard
            key={q.name}
            title={`${q.name} — ${q.totalMarks} علامة`}
            actions={
              <div className="flex items-center gap-2">
                <Pill tone={balanced ? "success" : mine.length ? "warning" : "muted"}>
                  {used} من {q.totalMarks}
                </Pill>
                <button
                  onClick={() => addCategory(q.name)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                >
                  <Plus className="size-3.5" />
                  تصنيف
                </button>
              </div>
            }
          >
            {mine.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                لا توجد تصنيفات في هذا الربع — أضف تصنيفاً مثل «امتحانات يومية».
              </p>
            ) : (
              <div className="space-y-3">
                {mine.map(({ c, i }) => (
                  <CategoryRow
                    key={i}
                    category={c}
                    onChange={(patch) => update(i, patch)}
                    onAddAssessment={() => addAssessment(i)}
                    onRemove={() => setDraft((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            )}
            {!balanced && mine.length > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <AlertTriangle className="size-3.5" />
                {used < q.totalMarks
                  ? `ينقص ${Math.round((q.totalMarks - used) * 100) / 100} علامة لإكمال الربع`
                  : `تجاوزت ${q.totalMarks} بمقدار ${Math.round((used - q.totalMarks) * 100) / 100}`}
              </p>
            )}
          </SectionCard>
        );
      })}
    </>
  );
}

/** Name a template and save the plan on screen as one. */
function TemplateMetaDialog({
  title,
  description,
  quarters,
  certificateMax,
  draft,
  onClose,
}: {
  title: string;
  description: string;
  quarters: Quarter[];
  certificateMax: number;
  draft: DraftCategory[];
  onClose: () => void;
}) {
  const save = useSavePlanTemplate();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  async function submit() {
    if (!name.trim()) {
      toast.error("اسم النموذج مطلوب");
      return;
    }
    try {
      await save.mutateAsync({
        name: name.trim(),
        description: notes.trim(),
        quarter_totals: quarters.map((q) => q.totalMarks),
        certificate_max: certificateMax,
        categories: toTemplateRows(draft, quarters),
      });
      toast.success(`تم حفظ النموذج «${name.trim()}»`);
      onClose();
    } catch (err) {
      problemsToast(err, "تعذّر حفظ النموذج");
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>اسم النموذج</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مواد علمية — ثانوي"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>وصف (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="لأي مواد يصلح هذا النموذج"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={save.isPending}
            className="rounded-xl bg-brand-gradient px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ النموذج"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The template library: build, edit, delete, and apply to subjects. */
function TemplatesPanel({
  quarters,
  canEdit,
  onApply,
}: {
  quarters: Quarter[];
  canEdit: boolean;
  onApply: (template: string) => void;
}) {
  const list = usePlanTemplates();
  const remove = useDeletePlanTemplate();
  const confirm = useConfirm();
  // null = a new template; a string = editing that one.
  const [editing, setEditing] = useState<string | null | undefined>(undefined);

  async function drop(t: PlanTemplateSummary) {
    const ok = await confirm({
      title: `حذف النموذج «${t.name}»؟`,
      description: "الخطط التي بُنيت منه تبقى كما هي.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(t.id);
      toast.success("تم حذف النموذج");
    } catch (err) {
      problemsToast(err, "تعذّر الحذف");
    }
  }

  if (editing !== undefined) {
    return (
      <TemplateEditor template={editing} quarters={quarters} onDone={() => setEditing(undefined)} />
    );
  }

  const rows = list.data?.templates ?? [];
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          النموذج خطة جاهزة (تصنيفات وعلاماتها وامتحاناتها) تبنيها مرة واحدة، ثم تطبّقها على مادة أو
          على عدة مواد دفعة واحدة. الأرباع تُطابَق بترتيبها، وإن اختلفت علامة الربع في الفصل تُحوَّل
          الأوزان تلقائياً.
        </p>
        {canEdit && (
          <div className="flex gap-2">
            {rows.length > 0 && (
              <button
                onClick={() => onApply(rows[0]!.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium hover:bg-secondary"
              >
                <Wand2 className="size-4" />
                تطبيق على مواد
              </button>
            )}
            <button
              onClick={() => setEditing(null)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground"
            >
              <FilePlus2 className="size-4" />
              نموذج جديد
            </button>
          </div>
        )}
      </div>
      {list.isLoading ? (
        <TableSkeleton rows={3} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="لا توجد نماذج بعد"
          description="أنشئ نموذجاً جديداً، أو افتح خطة مادة جاهزة واضغط «حفظ كنموذج»."
          icon={<LayoutTemplate className="size-6" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <div key={t.id} className="card-surface flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <LayoutTemplate className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{t.name}</p>
                  {t.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill tone="primary">{t.categories} تصنيف</Pill>
                <Pill tone="info">{t.assessments} امتحان</Pill>
                <Pill tone="muted">
                  <span className="num">{t.quarterTotals.join(" / ")}</span>
                </Pill>
                {(t.certificateMax ?? 100) !== 100 || (t.termTotal ?? 100) !== 100 ? (
                  <Pill tone="warning">
                    على الشهادة من <span className="num">{t.certificateMax ?? 100}</span>
                  </Pill>
                ) : null}
              </div>
              {canEdit && (
                <div className="mt-4 flex gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => onApply(t.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:opacity-90"
                  >
                    <Wand2 className="size-3.5" />
                    تطبيق على مواد
                  </button>
                  <button
                    onClick={() => setEditing(t.id)}
                    className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                  >
                    <Pencil className="size-3.5" />
                    تعديل
                  </button>
                  <button
                    onClick={() => drop(t)}
                    aria-label="حذف"
                    className="rounded-lg bg-secondary px-2 py-1.5 text-destructive hover:bg-destructive-soft"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Build or edit a template on the term's own quarters. */
function TemplateEditor({
  template,
  quarters,
  onDone,
}: {
  template: string | null;
  quarters: Quarter[];
  onDone: () => void;
}) {
  const existing = usePlanTemplate(template);
  const save = useSavePlanTemplate();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<DraftCategory[]>([]);
  const [ready, setReady] = useState(template === null);
  const termBase = quarters.reduce((a, q) => a + q.totalMarks, 0);
  const [termTotal, setTermTotal] = useState(termBase);
  const [certificateMax, setCertificateMax] = useState(100);
  const subjectQuarters = useMemo(
    () => scaleQuarters(quarters, termTotal || termBase),
    [quarters, termTotal, termBase],
  );

  useEffect(() => {
    if (!template || !existing.data || ready) return;
    setName(existing.data.name);
    setNotes(existing.data.description);
    setDraft(existing.data.applied.categories.map(fromApplied));
    setTermTotal(existing.data.applied.termTotal || termBase);
    setCertificateMax(existing.data.applied.certificateMax || 100);
    setReady(true);
  }, [template, existing.data, ready, termBase]);

  async function submit() {
    if (!name.trim()) {
      toast.error("اسم النموذج مطلوب");
      return;
    }
    try {
      await save.mutateAsync({
        ...(template ? { template } : {}),
        name: name.trim(),
        description: notes.trim(),
        quarter_totals: subjectQuarters.map((q) => q.totalMarks),
        certificate_max: certificateMax,
        categories: toTemplateRows(draft, subjectQuarters),
      });
      toast.success("تم حفظ النموذج");
      onDone();
    } catch (err) {
      problemsToast(err, "تعذّر حفظ النموذج");
    }
  }

  if (!ready) {
    return (
      <div className="mt-6">
        {existing.error ? (
          <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
        ) : (
          <TableSkeleton rows={5} />
        )}
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-6">
      <SectionCard
        title={template ? "تعديل النموذج" : "نموذج جديد"}
        actions={
          <div className="flex gap-2">
            <button
              onClick={onDone}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              رجوع
            </button>
            <button
              onClick={submit}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              <Save className="size-3.5" />
              {save.isPending ? "جارٍ الحفظ…" : "حفظ النموذج"}
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>اسم النموذج</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مواد علمية — ثانوي"
            />
          </div>
          <div className="space-y-1.5">
            <Label>وصف (اختياري)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="لأي مواد يصلح هذا النموذج"
            />
          </div>
        </div>
        {existing.data?.applied.notes.length ? (
          <p className="mt-3 text-xs text-amber-700">
            {existing.data.applied.notes.join(" ")} احفظ النموذج ليُعتمد على أرباع هذا الفصل.
          </p>
        ) : null}
      </SectionCard>
      <ScaleCard
        termTotal={termTotal || termBase}
        termBase={termBase}
        certificateMax={certificateMax}
        onTermTotal={(next) => {
          setDraft((d) => rescaleDraft(d, termTotal || termBase, next));
          setTermTotal(next);
        }}
        onCertificateMax={setCertificateMax}
      />
      <PlanQuarters quarters={subjectQuarters} draft={draft} setDraft={setDraft} />
    </div>
  );
}

/** Apply one template to many subjects at once. */
function ApplyTemplateDialog({
  initialTemplate,
  templates,
  subjects,
  onClose,
}: {
  initialTemplate: string | null;
  templates: PlanTemplateSummary[];
  subjects: Array<{ value: string; label: string }>;
  onClose: () => void;
}) {
  const apply = useApplyPlanTemplate();
  const [template, setTemplate] = useState(initialTemplate ?? templates[0]?.id ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof apply.mutateAsync>> | null>(
    null,
  );
  const shown = subjects.filter((s) => !query.trim() || s.label.includes(query.trim()));

  async function submit() {
    if (!template) {
      toast.error("اختر النموذج");
      return;
    }
    if (!picked.length) {
      toast.error("اختر مادة واحدة على الأقل");
      return;
    }
    try {
      const res = await apply.mutateAsync({ template, courses: picked, overwrite });
      setResults(res);
      toast.success(`طُبّق النموذج على ${res.applied} مادة`);
    } catch (err) {
      problemsToast(err, "تعذّر تطبيق النموذج");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تطبيق نموذج على مواد</DialogTitle>
          <DialogDescription>
            تُكتب خطة كل مادة مختارة من النموذج لهذا الفصل. المادة التي لها خطة تُترك كما هي إلا إذا
            اخترت الاستبدال.
          </DialogDescription>
        </DialogHeader>
        {results ? (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {results.notes.length > 0 && (
              <p className="text-xs text-amber-700">{results.notes.join(" ")}</p>
            )}
            {results.results.map((r) => (
              <div
                key={r.course}
                className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{r.course}</span>
                <span
                  className={`whitespace-pre-line text-left text-xs ${
                    r.status === "applied"
                      ? "text-success"
                      : r.status === "skipped"
                        ? "text-muted-foreground"
                        : "text-destructive"
                  }`}
                >
                  {r.message}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>النموذج</Label>
              <SearchableSelect
                options={templates.map((t) => ({ value: t.id, label: t.name }))}
                value={template}
                onChange={setTemplate}
                placeholder="اختر النموذج"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>المواد ({picked.length})</Label>
                <button
                  type="button"
                  onClick={() =>
                    setPicked((p) =>
                      shown.every((s) => p.includes(s.value))
                        ? p.filter((x) => !shown.some((s) => s.value === x))
                        : Array.from(new Set([...p, ...shown.map((s) => s.value)])),
                    )
                  }
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {shown.length && shown.every((s) => picked.includes(s.value))
                    ? "إلغاء تحديد الكل"
                    : "تحديد الكل"}
                </button>
              </div>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن مادة…"
                className="h-9"
              />
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {shown.map((s) => (
                  <label
                    key={s.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60"
                  >
                    <input
                      type="checkbox"
                      checked={picked.includes(s.value)}
                      onChange={(e) =>
                        setPicked((p) =>
                          e.target.checked ? [...p, s.value] : p.filter((x) => x !== s.value),
                        )
                      }
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="text-sm">
                استبدال الخطط الموجودة
                <span className="block text-xs text-muted-foreground">
                  احذر: المادة التي رُصدت عليها علامات قد تتأثر بتغيير أسماء امتحاناتها.
                </span>
              </span>
              <Switch checked={overwrite} onCheckedChange={setOverwrite} />
            </label>
          </div>
        )}
        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            {results ? "إغلاق" : "إلغاء"}
          </button>
          {!results && (
            <button
              onClick={submit}
              disabled={apply.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Check className="size-4" />
              {apply.isPending ? "جارٍ التطبيق…" : `تطبيق على ${picked.length} مادة`}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One category with its assessments, editable inline. */
function CategoryRow({
  category,
  onChange,
  onAddAssessment,
  onRemove,
}: {
  category: DraftCategory;
  onChange: (patch: Partial<DraftCategory>) => void;
  onAddAssessment: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-border">
      <div className="flex flex-wrap items-end gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mb-1.5 grid size-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary"
          aria-label={open ? "طيّ" : "توسيع"}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>

        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label className="text-[11px]">التصنيف</Label>
          <Input
            value={category.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="مثال: امتحانات يومية"
            className="h-9 rounded-lg"
          />
        </div>

        <div className="w-28 space-y-1">
          <Label className="text-[11px]">العلامة</Label>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={category.weight}
            onChange={(e) => onChange({ weight: e.target.value })}
            className="num h-9 rounded-lg text-center"
            dir="ltr"
          />
        </div>

        <div className="w-36 space-y-1">
          <Label className="text-[11px]">النوع</Label>
          <select
            value={category.type}
            onChange={(e) => onChange({ type: e.target.value })}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="mb-1.5 grid size-9 shrink-0 place-items-center rounded-lg border border-destructive/30 text-destructive transition-colors hover:bg-destructive-soft"
          aria-label="حذف التصنيف"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-secondary/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">
              الامتحانات داخل هذا التصنيف ({category.children.length})
            </p>
            <button
              type="button"
              onClick={onAddAssessment}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-secondary"
            >
              <Plus className="size-3" />
              امتحان
            </button>
          </div>

          {category.children.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-muted-foreground">
              بدون امتحانات — سيتم رصد علامة واحدة لهذا التصنيف مباشرة.
            </p>
          ) : (
            <div className="space-y-1.5">
              {category.children.map((child, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">└─</span>
                  <Input
                    value={child.name}
                    onChange={(e) =>
                      onChange({
                        children: category.children.map((c, i) =>
                          i === ci ? { ...c, name: e.target.value } : c,
                        ),
                      })
                    }
                    placeholder={`امتحان ${ci + 1}`}
                    className="h-8 flex-1 rounded-lg text-sm"
                  />
                  <span className="text-[11px] text-muted-foreground">من</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={child.maxScore}
                    onChange={(e) =>
                      onChange({
                        children: category.children.map((c, i) =>
                          i === ci ? { ...c, maxScore: e.target.value } : c,
                        ),
                      })
                    }
                    className="num h-8 w-20 rounded-lg text-center text-sm"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ children: category.children.filter((_, i) => i !== ci) })
                    }
                    className="grid size-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                    aria-label="حذف"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Dividing the term into quarters, with the marks each is worth. */
function QuarterEditor({ canEdit }: { canEdit: boolean }) {
  const query = useQuarters();
  const save = useSaveQuarters();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Array<{ name: string; totalMarks: string }>>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setRows(query.data.quarters.map((q) => ({ name: q.name, totalMarks: String(q.totalMarks) })));
  }, [query.data]);

  const total = rows.reduce((sum, r) => sum + (Number(r.totalMarks) || 0), 0);

  async function submit() {
    const cleaned = rows.filter((r) => r.name.trim());
    if (cleaned.length === 0) {
      toast.error("يجب تعريف ربع واحد على الأقل");
      return;
    }
    const ok = await confirm({
      title: "حفظ تقسيم الفصل؟",
      description: `${cleaned.length} أرباع بمجموع ${total} علامة. خطط التقييم مبنية على هذا التقسيم.`,
    });
    if (!ok) return;
    try {
      const res = await save.mutateAsync({
        quarters: cleaned.map((r) => ({
          name: r.name.trim(),
          totalMarks: Number(r.totalMarks) || 0,
        })),
      });
      toast.success(res.message_ar || "تم الحفظ");
      setEditing(false);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <SectionCard
      title="تقسيم الفصل إلى أرباع"
      actions={
        canEdit ? (
          editing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRows((p) => [...p, { name: "", totalMarks: "" }])}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                <Plus className="size-3.5" />
                ربع
              </button>
              <button
                onClick={submit}
                disabled={save.isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
              >
                <Check className="ml-1 inline size-3.5" />
                حفظ
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              تعديل
            </button>
          )
        ) : null
      }
    >
      {query.isLoading ? (
        <TableSkeleton rows={2} />
      ) : rows.length === 0 && !editing ? (
        <p className="py-3 text-center text-xs text-muted-foreground">لم يتم تقسيم الفصل بعد.</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((r, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                {editing ? (
                  <div className="space-y-2">
                    <Input
                      value={r.name}
                      onChange={(e) =>
                        setRows((p) =>
                          p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                        )
                      }
                      placeholder="مثال: الربع الأول"
                      className="h-8 rounded-lg text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={r.totalMarks}
                        onChange={(e) =>
                          setRows((p) =>
                            p.map((x, j) => (j === i ? { ...x, totalMarks: e.target.value } : x)),
                          )
                        }
                        className="num h-8 rounded-lg text-center text-sm"
                        dir="ltr"
                      />
                      <span className="text-[11px] text-muted-foreground">علامة</span>
                      <button
                        onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                        className="grid size-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                        aria-label="حذف"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-bold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.totalMarks} علامة</p>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            المجموع: <span className="font-bold tabular-nums">{total}</span> علامة
            {" — "}
            خطة كل مادة تُبنى على هذه الأرباع.
          </p>
        </>
      )}
    </SectionCard>
  );
}

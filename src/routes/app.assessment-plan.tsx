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
  Layers,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { isBackOffice } from "@/lib/roles";
import {
  useAssessmentPlan,
  useQuarters,
  useSaveAssessmentPlan,
  useSaveQuarters,
  useSubjects,
  type PlanCategory,
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
  const subjects = useSubjects();
  const [course, setCourse] = useState("");

  const planQuery = useAssessmentPlan(course || undefined);
  const savePlan = useSaveAssessmentPlan();

  const quarters = quartersQuery.data?.quarters ?? [];

  // The plan is edited locally and sent in one go: a half-saved plan whose
  // weights do not add up is worse than no plan at all.
  const [draft, setDraft] = useState<DraftCategory[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!planQuery.data) return;
    const rows: DraftCategory[] = [];
    for (const q of planQuery.data.quarters) {
      for (const c of q.categories) rows.push(toDraft(c, q.name));
    }
    for (const c of planQuery.data.unassigned) rows.push(toDraft(c, quarters[0]?.name ?? ""));
    setDraft(rows);
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

  async function save() {
    if (!course) {
      toast.error("اختر المادة أولاً");
      return;
    }
    // Checked here as well as on the server so the teacher sees the shortfall
    // before a round trip, and on the exact quarter that is wrong.
    for (const q of quarters) {
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

      {quarters.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock
            title="لم يتم تقسيم الفصل بعد"
            description="عرّف أرباع الفصل أولاً — لا يمكن بناء خطة تقييم بدونها."
            icon={<CalendarRange className="size-6" />}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 max-w-md">
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
              {quarters.map((q) => {
                const used = usedByQuarter[q.name] ?? 0;
                const mine = draft
                  .map((c, i) => ({ c, i }))
                  .filter(({ c }) => c.quarter === q.name);
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
    </>
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

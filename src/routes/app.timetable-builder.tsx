import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarCog,
  CheckCircle2,
  Play,
  Plus,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useApplyTimetable,
  useClasses,
  useDeletePlan,
  useGenerateTimetable,
  usePlanDefaults,
  useSavePlan,
  useTeachers,
  useTimetablePlans,
  type GeneratedTimetable,
  type TimetablePlan,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/timetable-builder")({
  head: () => ({
    meta: [
      { title: "توليد الجدول الدراسي — Match Education" },
      {
        name: "description",
        content: "توليد الجدول الدراسي الأسبوعي تلقائياً دون تعارض في المعلمين أو القاعات.",
      },
    ],
  }),
  component: TimetableBuilderPage,
});

const STATUS = {
  Draft: { label: "مسودة", tone: "muted" as const },
  Generated: { label: "تم التوليد", tone: "info" as const },
  Applied: { label: "مُطبّق", tone: "success" as const },
};

function TimetableBuilderPage() {
  const query = useTimetablePlans();
  const remove = useDeletePlan();
  const confirm = useConfirm();

  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<{ plan: TimetablePlan; grid: GeneratedTimetable } | null>(
    null,
  );

  const plans = query.data ?? [];
  const applied = plans.filter((p) => p.status === "Applied");

  async function removePlan(plan: TimetablePlan) {
    const ok = await confirm({
      title: `حذف «${plan.name}»؟`,
      description: "لن تُحذف الحصص التي طُبّقت على الجدول الفعلي.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(plan.id);
      toast.success("تم حذف الخطة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title="توليد الجدول الدراسي"
        subtitle="حدّد حصص كل مادة أسبوعياً، ويوزّعها النظام دون تعارض في المعلمين أو القاعات"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-4" />
            خطة جديدة
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد الخطط" value={plans.length} icon={CalendarCog} tone="primary" />
        <KpiCard label="مُطبّقة" value={applied.length} icon={CheckCircle2} tone="accent" />
        <KpiCard
          label="حصص مُنشأة"
          value={plans.reduce((a, p) => a + p.lessons, 0)}
          icon={Upload}
          tone="info"
        />
        <KpiCard
          label="بانتظار التطبيق"
          value={plans.filter((p) => p.status === "Generated").length}
          icon={Wand2}
          tone="warm"
        />
      </div>

      <div className="mt-5">
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          <TableSkeleton rows={4} />
        ) : plans.length === 0 ? (
          <EmptyBlock
            title="لا توجد خطط جداول"
            description="أنشئ خطة لشعبة، حدّد عدد حصص كل مادة، ثم ولّد الجدول."
            icon={<CalendarCog className="size-6" />}
          />
        ) : (
          <SectionCard title="خطط الجداول" description={`${plans.length} خطة`}>
            <ul className="divide-y divide-border">
              {plans.map((p) => (
                <li
                  key={p.id}
                  className="grid gap-3 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold">{p.name}</p>
                      <Pill tone={STATUS[p.status]?.tone ?? "muted"}>
                        {STATUS[p.status]?.label ?? p.status}
                      </Pill>
                    </div>
                    <p className="num mt-0.5 text-xs text-muted-foreground">
                      {p.student_group}
                      {p.academic_term ? ` • ${p.academic_term}` : ""}
                      {p.lessons ? ` • ${p.lessons} حصة مُنشأة` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <GenerateButton plan={p} onPreview={setPreview} />
                    <button
                      onClick={() => removePlan(p)}
                      aria-label="حذف"
                      className="rounded-lg bg-secondary px-2.5 py-2 text-destructive hover:bg-destructive-soft"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>

      {creating && <PlanDialog onClose={() => setCreating(false)} />}
      {preview && (
        <PreviewDialog
          plan={preview.plan}
          grid={preview.grid}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}

function GenerateButton({
  plan,
  onPreview,
}: {
  plan: TimetablePlan;
  onPreview: (v: { plan: TimetablePlan; grid: GeneratedTimetable }) => void;
}) {
  const generate = useGenerateTimetable();

  async function run() {
    try {
      const grid = await generate.mutateAsync(plan.id);
      onPreview({ plan, grid });
      if (!grid.complete) {
        toast.warning(`تعذّر توزيع ${grid.unplaced.length} مادة بالكامل`);
      }
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التوليد");
    }
  }

  return (
    <button
      onClick={run}
      disabled={generate.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
    >
      <Wand2 className="size-3.5" />
      {generate.isPending ? "جارٍ التوليد…" : "توليد الجدول"}
    </button>
  );
}

/** The generated week, as a grid, with an apply step. */
function PreviewDialog({
  plan,
  grid,
  onClose,
}: {
  plan: TimetablePlan;
  grid: GeneratedTimetable;
  onClose: () => void;
}) {
  const apply = useApplyTimetable();
  const confirm = useConfirm();
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState("4");

  // day -> period order -> lesson
  const byCell = new Map<string, (typeof grid.lessons)[number]>();
  for (const l of grid.lessons) byCell.set(`${l.day}|${l.period_order}`, l);

  async function run() {
    const ok = await confirm({
      title: `تطبيق الجدول على ${weeks} أسبوع؟`,
      description:
        "سيتم استبدال أي حصص موجودة لهذه الشعبة ضمن الفترة المحددة بالجدول المولّد.",
      tone: "question",
      confirmLabel: "تطبيق",
    });
    if (!ok) return;
    try {
      const result = await apply.mutateAsync({
        plan: plan.id,
        from_date: fromDate,
        weeks: Number(weeks) || 1,
      });
      toast.success(
        result.skipped.length
          ? `تم إنشاء ${result.created} حصة وتخطّي ${result.skipped.length}`
          : `تم إنشاء ${result.created} حصة`,
      );
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التطبيق");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{plan.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["حصص موزّعة", `${grid.placed}/${grid.demand}`],
            ["سعة الأسبوع", grid.capacity],
            ["أيام الدوام", grid.days.length],
            ["الحصص اليومية", grid.periods.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border p-3 text-center">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="num mt-1 text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>

        {grid.teacherless.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-destructive-soft p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              مواد بدون معلم لا يمكن تطبيقها: <strong>{grid.teacherless.join("، ")}</strong> — عيّن
              معلماً لكل مادة في الخطة أولاً.
            </span>
          </p>
        )}

        {grid.unplaced.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-warm-soft p-3 text-xs text-warm-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              تعذّر توزيع بعض الحصص:{" "}
              {grid.unplaced.map((u) => `${u.course} (${u.periods})`).join("، ")} — قلّل عدد الحصص
              أو أضف يوم دوام.
            </span>
          </p>
        )}

        {/* The week, as the school reads it. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-right text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="border border-border px-2 py-2 font-semibold">اليوم</th>
                {grid.periods.map((p) => (
                  <th key={p.order} className="border border-border px-2 py-2 font-semibold">
                    <div>{p.name}</div>
                    <div className="num text-[10px] font-normal text-muted-foreground">
                      {p.from_time.slice(0, 5)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.days.map((d) => (
                <tr key={d.code}>
                  <td className="border border-border bg-secondary/30 px-2 py-2 font-semibold">
                    {d.label}
                  </td>
                  {grid.periods.map((p) => {
                    const lesson = byCell.get(`${d.code}|${p.order}`);
                    return (
                      <td key={p.order} className="border border-border px-2 py-2 align-top">
                        {lesson ? (
                          <>
                            <div className="truncate font-semibold">{lesson.course}</div>
                            {lesson.instructor && (
                              <div className="truncate text-[10px] text-muted-foreground">
                                {lesson.instructor}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">تطبيق ابتداءً من</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="num h-9 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">عدد الأسابيع</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              className="num h-9 rounded-lg"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={run}
            disabled={apply.isPending || grid.teacherless.length > 0}
            title={
              grid.teacherless.length > 0 ? "عيّن معلماً لكل مادة أولاً" : undefined
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="size-4" />
            {apply.isPending ? "جارٍ التطبيق…" : "تطبيق على الجدول"}
          </button>
          <button onClick={onClose} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold">
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({ onClose }: { onClose: () => void }) {
  const classes = useClasses({});
  const teachers = useTeachers();
  const save = useSavePlan();

  const [group, setGroup] = useState("");
  const [name, setName] = useState("");
  const defaults = usePlanDefaults(group);

  const [subjects, setSubjects] = useState<
    Array<{ course: string; periods_per_week: number; instructor: string | null; max_per_day: number }>
  >([]);
  const [days, setDays] = useState<string[]>([]);

  // Seed from the class's own subjects once they arrive.
  useEffect(() => {
    if (!defaults.data) return;
    setSubjects(
      defaults.data.subjects.map((s) => ({
        course: s.course,
        periods_per_week: s.periods_per_week,
        instructor: s.instructor,
        max_per_day: s.max_per_day,
      })),
    );
    setDays(defaults.data.working_days);
  }, [defaults.data]);

  const periodsPerDay = (defaults.data?.periods ?? []).filter((p) => !p.is_break).length;
  const capacity = periodsPerDay * days.length;
  const demand = subjects.reduce((a, s) => a + (Number(s.periods_per_week) || 0), 0);
  const over = demand > capacity;

  async function submit() {
    if (!group) {
      toast.error("اختر الشعبة");
      return;
    }
    if (over) {
      toast.error(`المواد تحتاج ${demand} حصة والأسبوع يتسع لـ ${capacity}`);
      return;
    }
    try {
      await save.mutateAsync({
        student_group: group,
        name: name || undefined,
        working_days: days,
        periods: defaults.data?.periods ?? [],
        subjects,
      });
      toast.success("تم حفظ الخطة — اضغط «توليد الجدول»");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">خطة جدول جديدة</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>الشعبة</Label>
            <SearchableSelect
              options={(classes.data ?? []).map((c) => ({
                value: c.name,
                label: c.student_group_name,
                hint: `${c.students} طالباً`,
              }))}
              value={group}
              onChange={setGroup}
              placeholder="اختر الشعبة"
            />
          </div>
          <div className="space-y-1.5">
            <Label>اسم الخطة (اختياري)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="يُشتق من اسم الشعبة"
              className="rounded-xl"
            />
          </div>
        </div>

        {!group ? (
          <p className="rounded-xl bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
            اختر شعبة لتحميل موادها وأيام الدوام.
          </p>
        ) : defaults.isLoading ? (
          <TableSkeleton rows={4} />
        ) : (
          <>
            <div>
              <Label className="mb-2 block text-xs">أيام الدوام</Label>
              <div className="flex flex-wrap gap-1.5">
                {(defaults.data?.days ?? []).map((d) => {
                  const on = days.includes(d.code);
                  return (
                    <button
                      key={d.code}
                      onClick={() =>
                        setDays((cur) =>
                          on ? cur.filter((x) => x !== d.code) : [...cur, d.code],
                        )
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        on
                          ? "bg-brand-gradient text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className={`rounded-xl border p-3 text-xs ${
                over ? "border-destructive/40 bg-destructive-soft" : "border-border bg-muted/30"
              }`}
            >
              <span className="num">
                المطلوب {demand} حصة • السعة {capacity} حصة ({periodsPerDay} يومياً ×{" "}
                {days.length} أيام)
              </span>
              {over && <span className="mr-2 font-bold">— قلّل عدد الحصص أو أضف يوماً</span>}
            </div>

            <div>
              <Label className="mb-2 block text-xs">المواد وعدد الحصص أسبوعياً</Label>
              <ul className="space-y-2">
                {subjects.map((s, i) => (
                  <li
                    key={s.course}
                    className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px]"
                  >
                    <div className="min-w-0 self-center">
                      <p className="truncate text-sm font-semibold">{s.course}</p>
                    </div>
                    <SearchableSelect
                      options={(teachers.data ?? []).map((t) => ({
                        value: t.id,
                        label: t.instructor_name,
                      }))}
                      value={s.instructor ?? ""}
                      onChange={(v) =>
                        setSubjects((cur) =>
                          cur.map((x, idx) => (idx === i ? { ...x, instructor: v } : x)),
                        )
                      }
                      placeholder="اختر المعلم"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={s.periods_per_week}
                      onChange={(e) =>
                        setSubjects((cur) =>
                          cur.map((x, idx) =>
                            idx === i
                              ? { ...x, periods_per_week: Number(e.target.value) || 0 }
                              : x,
                          ),
                        )
                      }
                      className="num h-9 rounded-lg text-center"
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                كل مادة تحتاج معلماً قبل تطبيق الجدول على النظام.
              </p>
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending || !group || over}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ الخطة"}
          </button>
          <button onClick={onClose} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold">
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

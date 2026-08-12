import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarCog,
  CalendarRange,
  Check,
  Clock,
  GraduationCap,
  ListChecks,
  RotateCcw,
  Save,
  School,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
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
import { errorMessage } from "@/lib/api/error-message";
import {
  useCheckSlots,
  useGenerateLessons,
  useGenerateTimetable,
  useGridOptions,
  usePattern,
  useDefaultRange,
  usePeriodPreview,
  usePublicationStatus,
  usePublishTimetable,
  usePlanDefaults,
  useSaveSchoolDayShape,
  useSchoolDayShape,
  useSavePattern,
  useSavePlan,
  useTimetablePlans,
  type ConflictItem,
  type DayShape,
  type GridSlot,
  type PlanDetail,
  type TimetableAudience,
} from "@/lib/api/hooks";

/** Sunday to Thursday — the working week in the schools this serves. */
const DEFAULT_WORKING_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

export const Route = createFileRoute("/app/timetable-grid")({
  // Other screens link here with a section preselected — the teacher profile
  // does it from the weekly-load table — so the group arrives in the URL.
  validateSearch: (search: Record<string, unknown>): { group?: string } => {
    const group = search["group"];
    return typeof group === "string" && group ? { group } : {};
  },
  head: () => ({
    meta: [
      { title: "بناء الجدول الدراسي — Match Education" },
      {
        name: "description",
        content: "بناء الجدول الأسبوعي بالسحب والإفلات مع كشف التعارضات فوراً.",
      },
    ],
  }),
  component: TimetableGridPage,
});

/** A slot keyed by its cell, which is how the grid indexes everything. */
const cellKey = (day: string, period: number) => `${day}#${period}`;

function TimetableGridPage() {
  const { group: groupFromUrl } = Route.useSearch();
  const [mode, setMode] = useState<"class" | "teacher">("class");
  const [group, setGroup] = useState(groupFromUrl ?? "");
  const [instructor, setInstructor] = useState("");

  // Scoped to the chosen class so every course picker on this screen offers
  // that programme's subjects and nothing else.
  const options = useGridOptions(group || undefined);
  const pattern = usePattern(mode === "class" ? { student_group: group } : { instructor });

  // The grid is edited locally and saved as a whole, so a half-finished week
  // never reaches the server.
  const [slots, setSlots] = useState<Record<string, GridSlot>>({});
  const [dirty, setDirty] = useState(false);
  const [conflicts, setConflicts] = useState<Record<string, ConflictItem[]>>({});
  const [editing, setEditing] = useState<{ day: string; period: number } | null>(null);
  const [generating, setGenerating] = useState(false);

  const check = useCheckSlots();
  const save = useSavePattern();
  const confirm = useConfirm();

  // A week is built over several minutes and lives only in this component
  // until it is saved, so leaving the screen used to discard it silently.
  // Both exits are guarded: moving to another screen, and closing the tab.
  useBlocker({
    shouldBlockFn: () => dirty && !save.isPending,
    withResolver: false,
    enableBeforeUnload: () => dirty && !save.isPending,
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browsers show their own wording; a non-empty return value is what
      // actually triggers the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // --- The plan -----------------------------------------------------------
  // Building a week is two steps, and this screen now holds both: first say
  // what the class must study and who teaches it, then arrange it. The plan is
  // the input to the automatic arrangement, so it lives above the grid rather
  // than on a page of its own.
  const plans = useTimetablePlans();
  const defaults = usePlanDefaults(group);
  const savePlan = useSavePlan();
  const autoBuild = useGenerateTimetable();

  const [subjects, setSubjects] = useState<PlanDetail["subjects"]>([]);
  const [planTouched, setPlanTouched] = useState(false);
  const [building, setBuilding] = useState(false);

  // --- Releasing -----------------------------------------------------------
  // Its own step, not a setting buried in the generate dialog: a school
  // publishes to teachers first and to families once the week has settled,
  // and that second decision is taken days later.
  const pubStatus = usePublicationStatus(group);
  const publish = usePublishTimetable();

  async function releaseTo(next: TimetableAudience) {
    if (!group) return;
    try {
      const res = await publish.mutateAsync({ student_group: group, audience: next });
      toast.success(`${res.lessons} حصة — ${res.audienceLabel}`);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تغيير النشر"));
    }
  }

  // --- The shape of the school day ----------------------------------------
  // Seeded from the school's saved settings rather than constants, so every
  // section starts from the day the school actually runs. The state below is
  // only a fallback for the moment before those settings arrive.
  const schoolShape = useSchoolDayShape();
  const saveShape = useSaveSchoolDayShape();
  const [workingDays, setWorkingDays] = useState<string[]>(DEFAULT_WORKING_DAYS);
  const [dayShape, setDayShape] = useState<DayShape>({
    count: 7,
    minutes: 45,
    start: "08:00:00",
    gap: 5,
    break_after: 2,
    break_minutes: 20,
  });
  const [shapeTouched, setShapeTouched] = useState(false);
  const preview = usePeriodPreview(dayShape);

  // Adopt the school defaults once, and never over a change in progress.
  useEffect(() => {
    const s = schoolShape.data;
    if (!s || shapeTouched) return;
    setDayShape({
      count: s.count,
      minutes: s.minutes,
      start: s.start,
      gap: s.gap,
      break_after: s.break_after,
      break_minutes: s.break_minutes,
    });
    if (s.working_days?.length) setWorkingDays(s.working_days);
  }, [schoolShape.data, shapeTouched]);

  function setShape(patch: Partial<DayShape>) {
    setDayShape((s) => ({ ...s, ...patch }));
    setShapeTouched(true);
  }

  /** Make the current day settings the school's default for every section. */
  async function saveAsSchoolDefault() {
    try {
      await saveShape.mutateAsync({ ...dayShape, working_days: workingDays });
      // The saved values are now the baseline, so stop treating the local
      // state as an unsaved override.
      setShapeTouched(false);
      toast.success("تم حفظ اليوم الدراسي كافتراضي للمدرسة");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ الإعدادات"));
    }
  }

  /**
   * Switching class or view throws away the grid being edited, so ask first.
   * The blocker only covers leaving the screen; this is the same loss without
   * a navigation.
   */
  async function confirmDiscard(): Promise<boolean> {
    if (!dirty) return true;
    return confirm({
      title: "تغييرات غير محفوظة",
      description: "الجدول الحالي لم يُحفظ. الانتقال الآن سيُلغي التعديلات.",
      confirmLabel: "تجاهل التعديلات",
    });
  }

  function toggleDay(code: string) {
    setWorkingDays((current) =>
      current.includes(code) ? current.filter((d) => d !== code) : [...current, code],
    );
    setShapeTouched(true);
  }

  // Adopt the plan's own working days when a class is picked, unless the user
  // has already started changing them.
  useEffect(() => {
    if (!group || shapeTouched) return;
    const stored = defaults.data?.working_days;
    if (stored?.length) setWorkingDays(stored);
  }, [group, defaults.data, shapeTouched]);

  // The plan already stored for this class, if there is one.
  const planForGroup = useMemo(
    () => (plans.data ?? []).find((p) => p.student_group === group) ?? null,
    [plans.data, group],
  );

  // Seed the subject list from the class's own courses the first time a
  // section is picked; a plan the user has started editing is left alone.
  useEffect(() => {
    if (!group) {
      setSubjects([]);
      setPlanTouched(false);
      return;
    }
    if (planTouched) return;
    setSubjects(defaults.data?.subjects ?? []);
  }, [group, defaults.data, planTouched]);

  function editSubject(index: number, patch: Partial<PlanDetail["subjects"][number]>) {
    setSubjects((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setPlanTouched(true);
  }

  function removeSubject(index: number) {
    setSubjects((rows) => rows.filter((_, i) => i !== index));
    setPlanTouched(true);
  }

  const weeklyDemand = subjects.reduce((n, s) => n + (Number(s.periods_per_week) || 0), 0);

  // Courses this programme teaches that are not in the plan yet. A subject
  // already listed is left out so it cannot be added twice.
  const unusedCourses = useMemo(() => {
    const taken = new Set(subjects.map((s) => s.course).filter(Boolean));
    return (options.data?.courses ?? []).filter((c) => !taken.has(c));
  }, [options.data, subjects]);

  // Load the stored pattern into the editable grid.
  useEffect(() => {
    if (!pattern.data) return;
    const next: Record<string, GridSlot> = {};
    for (const s of pattern.data.slots) next[cellKey(s.day, s.period)] = s;
    setSlots(next);
    setDirty(false);
    setConflicts({});
  }, [pattern.data]);

  // The day/week settings only apply to a class being edited. A teacher's
  // timetable is read-only and spans every class, so it keeps the stored shape.
  const canEditShape = mode === "class" && Boolean(group);

  // The grid must show the week being built, not the one last saved. While a
  // class is selected the rows come from the settings above, so changing the
  // period count or the break moves the grid immediately instead of leaving it
  // describing a day that no longer applies.
  const periods = useMemo(() => {
    if (canEditShape && preview.data) {
      return preview.data.periods.map((p) => ({
        name: p.name,
        order: p.order,
        from: p.from_time,
        to: p.to_time,
        isBreak: p.is_break,
      }));
    }
    return pattern.data?.periods ?? options.data?.periods ?? [];
  }, [canEditShape, preview.data, pattern.data, options.data]);

  // Likewise the columns: a school that works Sunday to Tuesday should not be
  // shown Wednesday and Thursday to drop lessons into.
  const days = useMemo(() => {
    const every = pattern.data?.days ?? options.data?.days ?? [];
    if (canEditShape && workingDays.length) {
      return every.filter((d) => workingDays.includes(d.value));
    }
    return every;
  }, [canEditShape, workingDays, pattern.data, options.data]);

  const teaching = periods.filter((p) => !p.isBreak);
  // What the week can hold, from the settings above rather than the stored
  // grid — the plan is checked against the week about to be built.
  const weeklyCapacity =
    (preview.data?.teaching ?? teaching.length) * (workingDays.length || days.length);

  // Only what the grid actually shows gets saved. Shrinking the week — fewer
  // periods, or dropping Thursday — would otherwise keep lessons in rows and
  // columns nobody can see, and save them anyway.
  const list = useMemo(() => {
    const visibleDays = new Set(days.map((d) => d.value));
    const visiblePeriods = new Set(teaching.map((p) => p.order));
    return Object.values(slots).filter(
      (s) => s.course && visibleDays.has(s.day) && visiblePeriods.has(s.period),
    );
  }, [slots, days, teaching]);

  // Lessons stranded outside the current week, so the user is told rather than
  // finding them silently dropped on save.
  const strandedCount = useMemo(
    () => Object.values(slots).filter((s) => s.course).length - list.length,
    [slots, list],
  );

  /** Conflicts are keyed by position in the array we send. */
  const conflictFor = (day: string, period: number): ConflictItem[] => {
    const index = list.findIndex((s) => s.day === day && s.period === period);
    return index >= 0 ? (conflicts[String(index)] ?? []) : [];
  };

  async function runCheck(next: Record<string, GridSlot>) {
    if (mode !== "class" || !group) return;
    const payload = Object.values(next).filter((s) => s.course);
    if (!payload.length) {
      setConflicts({});
      return;
    }
    try {
      const result = await check.mutateAsync({ student_group: group, slots: payload });
      setConflicts(result.conflicts);
    } catch {
      // A failed check must not block editing; saving re-checks anyway.
    }
  }

  /**
   * The clock times of a period, taken from the grid's own rows.
   *
   * A lesson's time is a property of the period it sits in, so it is stamped
   * from here on every write rather than carried along with the lesson.
   */
  function timesFor(period: number): { from?: string; to?: string } {
    const row = periods.find((p) => p.order === period);
    if (!row) return {};
    return { from: row.from, to: row.to };
  }

  function setCell(day: string, period: number, slot: GridSlot | null) {
    setSlots((current) => {
      const next = { ...current };
      if (slot) next[cellKey(day, period)] = { ...slot, day, period, ...timesFor(period) };
      else delete next[cellKey(day, period)];
      setDirty(true);
      void runCheck(next);
      return next;
    });
  }

  function moveCell(from: { day: string; period: number }, to: { day: string; period: number }) {
    if (from.day === to.day && from.period === to.period) return;
    setSlots((current) => {
      const next = { ...current };
      const moving = next[cellKey(from.day, from.period)];
      if (!moving) return current;
      const displaced = next[cellKey(to.day, to.period)];

      // The times belong to the destination period, not to the lesson. Moving
      // a lesson without re-stamping them stored period 5 carrying period 3's
      // clock, so the grid and the saved record disagreed about when it runs.
      next[cellKey(to.day, to.period)] = {
        ...moving,
        day: to.day,
        period: to.period,
        ...timesFor(to.period),
      };
      // Dropping onto an occupied cell swaps them, which is what a timetabler
      // means by moving a lesson into a taken slot.
      if (displaced) {
        next[cellKey(from.day, from.period)] = {
          ...displaced,
          day: from.day,
          period: from.period,
          ...timesFor(from.period),
        };
      } else {
        delete next[cellKey(from.day, from.period)];
      }

      setDirty(true);
      void runCheck(next);
      return next;
    });
  }

  /**
   * Arrange the plan into the grid automatically.
   *
   * The result is written into the grid on screen and nothing else: no lessons
   * are created and nothing is stored until "حفظ الجدول" is pressed. That is
   * what makes pressing this repeatedly safe — each press is a fresh
   * arrangement to look at, not a change to the school's timetable.
   */
  async function autoArrange() {
    if (!group || !subjects.length) return;
    setBuilding(true);
    try {
      // The solver reads the plan from the server, so an edited plan is saved
      // first — otherwise it would quietly arrange the previous version.
      // `id` updates the class's existing plan; without it save_plan creates a
      // new one on every press, leaving a trail of duplicates behind.
      const saved = await savePlan.mutateAsync({
        student_group: group,
        name: planForGroup?.name || `جدول ${group}`,
        ...(planForGroup?.id ? { id: planForGroup.id } : {}),
        // The chosen week and day, not the plan's stored defaults — otherwise
        // the settings above would preview correctly and then be ignored.
        working_days: workingDays,
        periods: preview.data?.periods ?? defaults.data?.periods ?? [],
        subjects,
      });
      setPlanTouched(false);

      // A fresh seed each press, so "build again" means a different week.
      const result = await autoBuild.mutateAsync({
        plan: saved.id,
        variant: Math.floor(Math.random() * 1_000_000),
      });

      const next: Record<string, GridSlot> = {};
      for (const l of result.lessons) {
        next[cellKey(l.day, l.period_order)] = {
          day: l.day,
          period: l.period_order,
          from: l.from_time,
          to: l.to_time,
          course: l.course,
          instructor: l.instructor,
          room: l.room,
        };
      }
      setSlots(next);
      setDirty(true);
      void runCheck(next);

      if (result.complete) {
        toast.success(`تم توزيع ${result.placed} حصة — راجعها ثم احفظ`);
      } else {
        const missing = result.unplaced.map((u) => `${u.course} (${u.periods})`).join("، ");
        toast.warning(`وُزّعت ${result.placed} حصة — تعذّر توزيع: ${missing}`);
      }
      if (result.teacherless.length) {
        toast.warning(`مواد بلا معلم: ${result.teacherless.join("، ")}`);
      }
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر بناء الجدول تلقائياً"));
    } finally {
      setBuilding(false);
    }
  }

  /** Empty the grid on screen. The plan and the saved week are untouched. */
  async function resetGrid() {
    if (!Object.keys(slots).length) return;
    const ok = await confirm({
      title: "إعادة ضبط الجدول؟",
      description:
        "ستُفرَّغ الشبكة على الشاشة. الخطة تبقى كما هي، والجدول المحفوظ لا يتغيّر حتى تضغط حفظ.",
    });
    if (!ok) return;
    setSlots({});
    setConflicts({});
    setDirty(true);
  }

  async function persist() {
    if (!group) return;
    try {
      const result = await save.mutateAsync({ student_group: group, slots: list });
      toast.success(`تم حفظ الجدول — ${result.slots} حصة`);
      setDirty(false);
      setConflicts({});
    } catch (err) {
      const data = (err as { data?: { conflicts?: Record<string, ConflictItem[]> } }).data;
      if (data?.conflicts) setConflicts(data.conflicts);
      toast.error(errorMessage(err, "تعذّر حفظ الجدول"));
    }
  }

  const totalConflicts = Object.values(conflicts).reduce((n, c) => n + c.length, 0);

  // Every conflict with the cell it belongs to, so the banner can name the day
  // and period instead of leaving the reader to match red cells to messages.
  const conflictList = useMemo(
    () =>
      Object.entries(conflicts).flatMap(([index, items]) => {
        const slot = list[Number(index)];
        const dayLabel = days.find((d) => d.value === slot?.day)?.label ?? slot?.day ?? "";
        const periodLabel =
          periods.find((p) => p.order === slot?.period)?.name ?? `الحصة ${slot?.period ?? ""}`;
        return items.map((c) => ({
          ...c,
          day: slot?.day ?? "",
          period: slot?.period ?? 0,
          dayLabel,
          periodLabel,
        }));
      }),
    [conflicts, list, days, periods],
  );
  const canEdit = canEditShape;

  return (
    <>
      <PageHeader
        title="بناء الجدول الدراسي"
        subtitle="اسحب الحصص لترتيب الأسبوع — يتحقق النظام من التعارضات فوراً"
        actions={
          canEdit ? (
            <>
              <button
                onClick={autoArrange}
                disabled={building || subjects.length === 0 || workingDays.length === 0}
                title={
                  workingDays.length === 0
                    ? "اختر أيام الدوام أولاً"
                    : subjects.length === 0
                      ? "أضف مواد للخطة أولاً"
                      : "كل ضغطة تعطي توزيعاً جديداً — لا يُحفظ شيء حتى تضغط حفظ"
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <Shuffle className="size-4" />
                {building ? "جارٍ التوزيع…" : "بناء تلقائي"}
              </button>
              <button
                onClick={resetGrid}
                disabled={Object.keys(slots).length === 0}
                title="تفريغ الشبكة على الشاشة فقط"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <RotateCcw className="size-4" />
                إعادة ضبط
              </button>
              <button
                onClick={() => setGenerating(true)}
                title="إنشاء حصص الفصل الفعلية لتظهر عند المعلم والطلاب"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                <CalendarRange className="size-4" />
                توليد حصص الفصل
              </button>
              <button
                onClick={persist}
                disabled={save.isPending || !dirty || totalConflicts > 0}
                title={
                  totalConflicts > 0
                    ? "عالج التعارضات أولاً"
                    : !dirty
                      ? "لا توجد تغييرات"
                      : undefined
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                <Save className="size-4" />
                {save.isPending ? "جارٍ الحفظ…" : "حفظ الجدول"}
              </button>
            </>
          ) : null
        }
      />

      {/* Whose timetable is being looked at. */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-secondary p-1">
          {(
            [
              ["class", "حسب الشعبة", School],
              ["teacher", "حسب المعلم", GraduationCap],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={async () => {
                if (await confirmDiscard()) setMode(key);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                mode === key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="min-w-[240px]">
          {mode === "class" ? (
            <SearchableSelect
              value={group}
              onChange={async (g) => {
                if (await confirmDiscard()) setGroup(g);
              }}
              options={(options.data?.groups ?? []).map((g) => ({
                value: g.name,
                label: g.student_group_name || g.name,
              }))}
              placeholder="اختر الشعبة"
            />
          ) : (
            <SearchableSelect
              value={instructor}
              onChange={setInstructor}
              options={(options.data?.instructors ?? []).map((i) => ({
                value: i.name,
                label: i.instructor_name || i.name,
              }))}
              placeholder="اختر المعلم"
            />
          )}
        </div>

        {mode === "teacher" && (
          <p className="text-xs text-muted-foreground">
            جدول المعلم للعرض فقط — التعديل يتم من جدول الشعبة.
          </p>
        )}
      </div>

      {/* Step one: the shape of the week. */}
      {canEdit && (
        <div className="mb-5">
          <SectionCard
            title="١. أيام الدوام والحصص"
            description="أيام الأسبوع، عدد الحصص ومدتها، ووقت الاستراحة"
            actions={
              <div className="flex items-center gap-2">
                <Pill tone="muted">
                  <Clock className="ml-1 inline size-3" />
                  {preview.data?.teaching ?? dayShape.count} حصة · ينتهي{" "}
                  {(preview.data?.ends_at ?? "").slice(0, 5) || "—"}
                </Pill>
                <button
                  onClick={saveAsSchoolDefault}
                  disabled={saveShape.isPending || workingDays.length === 0}
                  title="تصبح هذه القيم الافتراضية لكل الشعب"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  {saveShape.isPending ? "جارٍ…" : "حفظ كافتراضي للمدرسة"}
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <Label className="text-xs">أيام الدوام</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(options.data?.days ?? []).map((d) => {
                    const on = workingDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        onClick={() => toggleDay(d.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          on
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {on && <Check className="ml-1 inline size-3" />}
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                {workingDays.length === 0 && (
                  <p className="mt-2 text-xs font-semibold text-destructive">
                    اختر يوم دوام واحداً على الأقل.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className="text-xs">عدد الحصص</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={String(dayShape.count)}
                    onChange={(e) => setShape({ count: Number(e.target.value) || 1 })}
                    className="num h-9 text-center"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">مدة الحصة (دقيقة)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={String(dayShape.minutes)}
                    onChange={(e) => setShape({ minutes: Number(e.target.value) || 45 })}
                    className="num h-9 text-center"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">بداية الدوام</Label>
                  <Input
                    type="time"
                    value={dayShape.start.slice(0, 5)}
                    onChange={(e) => setShape({ start: `${e.target.value}:00` })}
                    className="num h-9 text-center"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">الاستراحة بعد الحصة</Label>
                  <select
                    value={String(dayShape.break_after)}
                    onChange={(e) => setShape({ break_after: Number(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  >
                    <option value="0">بدون استراحة</option>
                    {Array.from({ length: Math.max(dayShape.count - 1, 0) }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        بعد الحصة {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">مدة الاستراحة (دقيقة)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={90}
                    value={String(dayShape.break_minutes)}
                    onChange={(e) => setShape({ break_minutes: Number(e.target.value) || 0 })}
                    disabled={dayShape.break_after === 0}
                    className="num h-9 text-center disabled:opacity-50"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* The day these settings produce, so it is checked before the
                  week is built on top of it. */}
              {preview.data && (
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-secondary/30 p-2.5">
                  {preview.data.periods.map((p) => (
                    <span
                      key={p.order}
                      className={`rounded-lg border px-2 py-1 text-[11px] ${
                        p.is_break
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                          : "border-border bg-card"
                      }`}
                    >
                      <span className="font-semibold">{p.name}</span>{" "}
                      <span className="num text-muted-foreground">
                        {p.from_time.slice(0, 5)}–{p.to_time.slice(0, 5)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Step two: the plan. Step three, below, is arranging it. */}
      {canEdit && (
        <div className="mb-5">
          <SectionCard
            title="٢. خطة الجدول"
            description="ما الذي تدرسه الشعبة، كم حصة أسبوعياً، ومن يدرّسها"
            actions={
              <div className="flex items-center gap-2">
                <Pill tone={weeklyDemand > weeklyCapacity ? "danger" : "muted"}>
                  <ListChecks className="ml-1 inline size-3" />
                  {weeklyDemand} / {weeklyCapacity} حصة
                </Pill>
                {/* Adding a subject means picking one the programme already
                    teaches — never typing a new one. A blank row let a course
                    be invented that the class does not study. */}
                {unusedCourses.length > 0 && (
                  <div className="w-52">
                    <SearchableSelect
                      value=""
                      onChange={(course) => {
                        if (!course) return;
                        setSubjects((rows) => [
                          ...rows,
                          {
                            course,
                            periods_per_week: 1,
                            instructor: null,
                            preferred_room: null,
                            max_per_day: 1,
                          },
                        ]);
                        setPlanTouched(true);
                      }}
                      options={unusedCourses.map((c) => ({ value: c, label: c }))}
                      placeholder="+ إضافة مادة من الخطة"
                    />
                  </div>
                )}
              </div>
            }
          >
            {defaults.isLoading ? (
              <TableSkeleton rows={4} />
            ) : subjects.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">
                لا توجد مواد بعد — أضف مادة لتبدأ الخطة.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-semibold">المادة</th>
                        <th className="pb-2 font-semibold">حصص أسبوعياً</th>
                        <th className="pb-2 font-semibold">المعلم</th>
                        <th className="pb-2 font-semibold">الأقصى يومياً</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {subjects.map((s, i) => (
                        <tr key={`${s.course}-${i}`}>
                          <td className="py-2 pl-3">
                            <SearchableSelect
                              value={s.course}
                              onChange={(v) => editSubject(i, { course: v })}
                              options={[
                                // Its own course stays selectable; the others
                                // already in the plan are hidden.
                                ...(s.course ? [s.course] : []),
                                ...unusedCourses,
                              ].map((c) => ({ value: c, label: c }))}
                              placeholder="اختر المادة"
                            />
                          </td>
                          <td className="py-2 pl-3">
                            <Input
                              type="number"
                              min={1}
                              max={weeklyCapacity || 40}
                              value={String(s.periods_per_week ?? 1)}
                              onChange={(e) =>
                                editSubject(i, {
                                  periods_per_week: Number(e.target.value) || 0,
                                })
                              }
                              className="num h-9 w-20 text-center"
                              dir="ltr"
                            />
                          </td>
                          <td className="py-2 pl-3">
                            <SearchableSelect
                              value={s.instructor ?? ""}
                              onChange={(v) => editSubject(i, { instructor: v || null })}
                              options={(options.data?.instructors ?? []).map((t) => ({
                                value: t.name,
                                label: t.instructor_name || t.name,
                              }))}
                              placeholder="بدون معلم"
                            />
                          </td>
                          <td className="py-2 pl-3">
                            <Input
                              type="number"
                              min={1}
                              max={teaching.length || 8}
                              value={String(s.max_per_day ?? 1)}
                              onChange={(e) =>
                                editSubject(i, { max_per_day: Number(e.target.value) || 1 })
                              }
                              className="num h-9 w-20 text-center"
                              dir="ltr"
                            />
                          </td>
                          <td className="py-2">
                            <button
                              onClick={() => removeSubject(i)}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                              title="حذف المادة"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {weeklyDemand > weeklyCapacity && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                    <AlertTriangle className="size-3.5" />
                    الخطة تطلب {weeklyDemand} حصة والأسبوع يتسع لـ {weeklyCapacity} — قلّل الحصص قبل
                    التوزيع.
                  </p>
                )}
              </>
            )}
          </SectionCard>
        </div>
      )}

      {totalConflicts > 0 && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive-soft p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-destructive">
            <AlertTriangle className="size-4" />
            {totalConflicts} تعارضاً — لا يمكن الحفظ قبل معالجتها
          </p>

          {/* The reasons in full, rather than a tooltip a timetabler has to
              hunt for — and which never appears at all on a touch screen. */}
          <ul className="mt-2 space-y-1.5">
            {conflictList.map((c, i) => (
              <li
                key={`${c.day}-${c.period}-${i}`}
                className="rounded-lg border border-destructive/30 bg-card/70 p-2 text-xs leading-relaxed"
              >
                <span className="font-bold text-destructive">
                  {c.dayLabel} · {c.periodLabel} — {c.label}
                </span>
                <span className="block text-foreground/80">{c.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!group && !instructor ? (
        <SectionCard title="ابدأ باختيار شعبة" description="ثم اسحب الحصص لبناء الأسبوع">
          <p className="py-6 text-center text-sm text-muted-foreground">
            اختر شعبة من الأعلى لعرض جدولها وتعديله.
          </p>
        </SectionCard>
      ) : pattern.isLoading ? (
        <TableSkeleton rows={6} />
      ) : pattern.error ? (
        <ErrorState error={pattern.error} onRetry={() => pattern.refetch()} />
      ) : (
        <div className="card-surface overflow-x-auto p-3">
          {canEdit && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <p className="text-sm font-bold">٣. ترتيب الأسبوع</p>
                <p className="text-xs text-muted-foreground">
                  اسحب أي حصة لتنقلها — الإفلات على خانة مشغولة يبدّل بينهما. لا شيء يُحفظ حتى تضغط
                  «حفظ الجدول».
                </p>
              </div>
              <div className="flex items-center gap-2">
                {strandedCount > 0 && (
                  <Pill tone="danger">
                    <AlertTriangle className="ml-1 inline size-3" />
                    {strandedCount} حصة خارج الأسبوع الحالي — لن تُحفظ
                  </Pill>
                )}
                {dirty && <Pill tone="warning">تغييرات غير محفوظة</Pill>}
              </div>
            </div>
          )}
          <table className="w-full min-w-[820px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-28 text-right text-xs font-semibold text-muted-foreground">
                  الحصة
                </th>
                {days.slice(0, 6).map((d) => (
                  <th key={d.value} className="text-center text-xs font-bold">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.order}>
                  <td className="align-top">
                    <div className="rounded-lg bg-secondary/60 px-2 py-2 text-right">
                      <p className="text-xs font-bold">{p.name}</p>
                      <p className="num text-[10px] text-muted-foreground">
                        {p.from} - {p.to}
                      </p>
                    </div>
                  </td>

                  {days.slice(0, 6).map((d) =>
                    p.isBreak ? (
                      <td key={d.value}>
                        <div className="grid h-16 place-items-center rounded-lg bg-secondary/40 text-[11px] text-muted-foreground">
                          استراحة
                        </div>
                      </td>
                    ) : (
                      <td key={d.value}>
                        <Cell
                          slot={slots[cellKey(d.value, p.order)] ?? null}
                          conflicts={conflictFor(d.value, p.order)}
                          editable={canEdit}
                          onOpen={() => canEdit && setEditing({ day: d.value, period: p.order })}
                          onClear={() => setCell(d.value, p.order, null)}
                          onDropSlot={(from) => moveCell(from, { day: d.value, period: p.order })}
                          position={{ day: d.value, period: p.order }}
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {teaching.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              لم تُعرّف حصص للمدرسة بعد — عرّفها من خطة الجدول أولاً.
            </p>
          )}
        </div>
      )}

      {/* Step four: who may read it. Deliberately on the page and not inside
          the generate dialog — a school releases to teachers first and to
          families days later, so this is returned to long after generating. */}
      {canEdit && (pubStatus.data?.total ?? 0) > 0 && (
        <div className="mt-5">
          <SectionCard
            title="٤. نشر الجدول"
            description="من يرى هذا الجدول — يمكن تغييره في أي وقت"
            actions={
              <Pill tone="muted">
                <ListChecks className="ml-1 inline size-3" />
                {pubStatus.data?.total} حصة مولّدة
              </Pill>
            }
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {(["draft", "teachers", "all"] as const).map((a) =>
                pubStatus.data?.counts[a] ? (
                  <Pill
                    key={a}
                    tone={a === "all" ? "success" : a === "teachers" ? "info" : "muted"}
                  >
                    {a === "draft"
                      ? "مسودة (الإدارة فقط)"
                      : a === "teachers"
                        ? "للمعلمين"
                        : "للجميع"}
                    : {pubStatus.data.counts[a]}
                  </Pill>
                ) : null,
              )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["teachers", "نشر للمعلمين", "يراه المعلمون فقط — للمراجعة قبل إعلانه"],
                  ["all", "نشر للجميع", "يراه المعلمون والطلاب وأولياء الأمور"],
                  ["draft", "سحب (مسودة)", "يعود مخفياً عن الجميع خارج الإدارة"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  onClick={() => releaseTo(value)}
                  disabled={publish.isPending}
                  className={`rounded-xl border p-3 text-right transition-colors disabled:opacity-50 ${
                    value === "all"
                      ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                      : value === "teachers"
                        ? "border-info/40 bg-info-soft/40 hover:bg-info-soft"
                        : "border-border hover:bg-secondary"
                  }`}
                >
                  <p className="text-sm font-bold">{label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {editing && (
        <SlotDialog
          day={editing.day}
          period={editing.period}
          slot={slots[cellKey(editing.day, editing.period)] ?? null}
          options={options.data}
          onClose={() => setEditing(null)}
          onSave={(slot) => {
            setCell(editing.day, editing.period, slot);
            setEditing(null);
          }}
          onRemove={async () => {
            const ok = await confirm({
              title: "حذف الحصة؟",
              description: "ستُزال من الجدول الأسبوعي.",
              tone: "danger",
              confirmLabel: "حذف",
            });
            if (!ok) return;
            setCell(editing.day, editing.period, null);
            setEditing(null);
          }}
        />
      )}

      {generating && group && <GenerateDialog group={group} onClose={() => setGenerating(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ cell */

function Cell({
  slot,
  conflicts,
  editable,
  position,
  onOpen,
  onClear,
  onDropSlot,
}: {
  slot: GridSlot | null;
  conflicts: ConflictItem[];
  editable: boolean;
  position: { day: string; period: number };
  onOpen: () => void;
  onClear: () => void;
  onDropSlot: (from: { day: string; period: number }) => void;
}) {
  const [over, setOver] = useState(false);
  const bad = conflicts.length > 0;

  return (
    <div
      onDragOver={(e) => {
        if (!editable) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!editable) return;
        e.preventDefault();
        setOver(false);
        try {
          const from = JSON.parse(e.dataTransfer.getData("text/plain"));
          if (from?.day) onDropSlot(from);
        } catch {
          /* not one of our drags */
        }
      }}
      className={`h-16 rounded-lg border-2 border-dashed transition-colors ${
        over ? "border-primary bg-primary-soft" : "border-transparent"
      }`}
    >
      {slot?.course ? (
        <div
          draggable={editable}
          onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify(position))}
          onClick={onOpen}
          title={bad ? conflicts.map((c) => `${c.label}: ${c.detail}`).join("\n") : undefined}
          className={`group relative flex h-full cursor-${editable ? "grab" : "default"} flex-col justify-center rounded-lg px-2 py-1 text-right transition-all ${
            bad
              ? "bg-destructive-soft ring-2 ring-destructive"
              : "bg-primary-soft hover:-translate-y-0.5 hover:shadow-soft"
          }`}
        >
          <p className="truncate text-xs font-bold">{slot.course}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {slot.instructorName || slot.instructor || "—"}
          </p>
          {slot.room && (
            <p className="num truncate text-[10px] text-muted-foreground">{slot.room}</p>
          )}

          {bad && <AlertTriangle className="absolute left-1 top-1 size-3.5 text-destructive" />}
          {editable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              aria-label="حذف"
              className="absolute left-1 bottom-1 hidden rounded p-0.5 text-destructive group-hover:block"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onOpen}
          disabled={!editable}
          className="grid h-full w-full place-items-center rounded-lg bg-secondary/40 text-lg text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary disabled:cursor-default disabled:hover:bg-secondary/40 disabled:hover:text-muted-foreground"
        >
          {editable ? "+" : ""}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ slot editor */

function SlotDialog({
  day,
  period,
  slot,
  options,
  onClose,
  onSave,
  onRemove,
}: {
  day: string;
  period: number;
  slot: GridSlot | null;
  options: ReturnType<typeof useGridOptions>["data"];
  onClose: () => void;
  onSave: (slot: GridSlot) => void;
  onRemove: () => void;
}) {
  const [course, setCourse] = useState(slot?.course ?? "");
  const [instructor, setInstructor] = useState(slot?.instructor ?? "");
  const [room, setRoom] = useState(slot?.room ?? "");

  const dayLabel = options?.days.find((d) => d.value === day)?.label ?? day;
  const periodLabel = options?.periods.find((p) => p.order === period)?.name ?? `الحصة ${period}`;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCog className="size-5 text-primary" />
            {dayLabel} — {periodLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>المادة *</Label>
            <SearchableSelect
              value={course}
              onChange={setCourse}
              options={(options?.courses ?? []).map((c) => ({ value: c, label: c }))}
              placeholder="اختر المادة"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المعلم</Label>
            <SearchableSelect
              value={instructor}
              onChange={setInstructor}
              options={(options?.instructors ?? []).map((i) => ({
                value: i.name,
                label: i.instructor_name || i.name,
              }))}
              placeholder="اختر المعلم"
              clearable
            />
          </div>
          <div className="space-y-1.5">
            <Label>القاعة</Label>
            <SearchableSelect
              value={room}
              onChange={setRoom}
              options={(options?.rooms ?? []).map((r) => ({
                value: r.name,
                label: r.room_name || r.name,
              }))}
              placeholder="اختر القاعة"
              clearable
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => {
              if (!course) {
                toast.error("اختر المادة");
                return;
              }
              onSave({ day, period, course, instructor: instructor || null, room: room || null });
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Check className="size-4" />
            حفظ في الجدول
          </button>
          {slot?.course && (
            <button
              onClick={onRemove}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-destructive-soft px-4 text-sm font-bold text-destructive"
            >
              <Trash2 className="size-4" />
              حذف
            </button>
          )}
          <button
            onClick={onClose}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            <X className="size-4" />
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- generate */

function GenerateDialog({ group, onClose }: { group: string; onClose: () => void }) {
  const generate = useGenerateLessons();
  const range = useDefaultRange(group);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Generating and releasing are separate decisions: a week is built first
  // and only shown to people once it is right.
  const [audience, setAudience] = useState<TimetableAudience>("draft");

  // Show the term that would be used rather than two empty boxes and a silent
  // assumption — the dates are the single most important thing to check here.
  useEffect(() => {
    if (!range.data) return;
    setFrom((v) => v || range.data.from);
    setTo((v) => v || range.data.to);
  }, [range.data]);

  async function run() {
    try {
      const result = await generate.mutateAsync({
        student_group: group,
        audience,
        ...(from ? { from_date: from } : {}),
        ...(to ? { to_date: to } : {}),
      });
      const skipped = result.skipped.length;
      toast.success(`تم إنشاء ${result.created} حصة` + (skipped ? ` — تعذّر ${skipped}` : ""));
      if (skipped) {
        // The reason matters: it is almost always a date outside the term.
        toast.error(result.skipped[0]!.reason, { duration: 8000 });
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التوليد"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>توليد حصص الفصل</DialogTitle>
        </DialogHeader>

        <p className="rounded-xl bg-info-soft p-3 text-xs leading-relaxed text-info">
          سيُنشئ النظام حصصاً مؤرخة من الجدول الأسبوعي لكل يوم ضمن الفترة. الحصص التي جرى عليها
          تبديل أو مناوبة تبقى كما هي.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {range.data?.label
            ? `التواريخ المعروضة هي فترة ${range.data.label} — عدّلها إن أردت فترة أخرى.`
            : "اتركهما فارغين لاستخدام تواريخ الفصل الدراسي للشعبة."}
        </p>

        {/* Who is allowed to read the result. */}
        <div className="space-y-1.5">
          <Label>من يرى هذا الجدول؟</Label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as TimetableAudience)}
            className="h-10 w-full rounded-xl border border-input bg-background px-2 text-sm"
          >
            <option value="draft">مسودة — الإدارة فقط</option>
            <option value="teachers">المعلمون</option>
            <option value="all">المعلمون والطلاب وأولياء الأمور</option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            {audience === "draft"
              ? "لن يظهر الجدول لأحد خارج الإدارة — يمكنك نشره لاحقاً بعد مراجعته."
              : audience === "teachers"
                ? "سيظهر للمعلمين فقط، ولن يراه الطلاب وأولياء الأمور بعد."
                : "سيظهر للجميع فور التوليد."}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={run}
            disabled={generate.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {generate.isPending ? "جارٍ التوليد…" : "توليد"}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

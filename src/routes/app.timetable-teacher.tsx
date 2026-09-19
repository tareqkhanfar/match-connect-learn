import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarCog,
  Check,
  FileSpreadsheet,
  Eraser,
  Info,
  Plus,
  Save,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useConfirm } from "@/components/shared/confirm";
import { TimetableImportDialog } from "@/components/shared/timetable-import-dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/error-message";
import {
  useCheckTeacherSlots,
  usePattern,
  useSaveRecordFields,
  useSaveTeacherPattern,
  useTakenPeriods,
  useTeacherAssignments,
  useTeacherGridOptions,
  type GridSlot,
  type TakenPeriod,
  type TeacherAssignment,
  type TeacherProblem,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/timetable-teacher")({
  head: () => ({
    meta: [
      { title: "بناء الجدول حسب المعلم — Match Education" },
      {
        name: "description",
        content: "إدخال جدول المدرسة معلماً معلماً مع احتساب النصاب الأسبوعي وكشف التعارضات.",
      },
    ],
  }),
  component: TeacherTimetablePage,
});

const cellKey = (day: string, period: number) => `${day}#${period}`;
const rowKey = (group: string, course: string) => `${group}#${course}`;

type Cell = { studentGroup: string; course: string; room: string | null };
type Row = TeacherAssignment;

function TeacherTimetablePage() {
  const options = useTeacherGridOptions();
  const confirm = useConfirm();

  const [instructor, setInstructor] = useState("");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState("");
  const [dirty, setDirty] = useState(false);
  const [importing, setImporting] = useState(false);

  // Adding a teacher's subjects: several sections at once, because a teacher
  // usually takes the same subject across a whole grade.
  const [adding, setAdding] = useState(false);
  const [pickedGroups, setPickedGroups] = useState<string[]>([]);
  const [pickCourse, setPickCourse] = useState("");
  const [pickPerWeek, setPickPerWeek] = useState(1);
  const [groupSearch, setGroupSearch] = useState("");

  const pattern = usePattern(instructor ? { instructor } : {});
  const assignments = useTeacherAssignments(instructor || undefined);
  const taken = useTakenPeriods(instructor || undefined);
  const save = useSaveTeacherPattern();
  const saveQuota = useSaveRecordFields("Instructor", instructor);
  const check = useCheckTeacherSlots();
  const [problems, setProblems] = useState<TeacherProblem[]>([]);

  const groups = options.data?.groups ?? [];
  const periods = (options.data?.periods ?? []).filter((p) => !p.isBreak);
  const workingDays = options.data?.workingDays ?? [];
  const days = (options.data?.days ?? []).filter((d) => workingDays.includes(d.value));

  const teacher = (options.data?.instructors ?? []).find((i) => i.name === instructor);
  const quota = assignments.data?.quota ?? teacher?.quota ?? 0;
  const [quotaDraft, setQuotaDraft] = useState("");
  useEffect(() => setQuotaDraft(quota ? String(quota) : ""), [quota, instructor]);

  // The saved week is the starting point; edits live on top until saved.
  useEffect(() => {
    const next: Record<string, Cell> = {};
    for (const s of pattern.data?.slots ?? []) {
      if (!s.course || !s.studentGroup) continue;
      next[cellKey(s.day, s.period)] = {
        studentGroup: s.studentGroup,
        course: s.course,
        room: s.room ?? null,
      };
    }
    setCells(next);
    setDirty(false);
  }, [pattern.data]);

  useEffect(() => {
    setRows(assignments.data?.assignments ?? []);
    setActive("");
  }, [assignments.data]);

  useBlocker({
    shouldBlockFn: () => dirty && !save.isPending,
    withResolver: false,
    enableBeforeUnload: () => dirty && !save.isPending,
  });

  // What every other teacher already holds, so a section is never promised
  // twice — checked before a cell is filled rather than on save.
  const busy = useMemo(() => {
    const map = new Map<string, TakenPeriod>();
    for (const t of taken.data?.taken ?? [])
      map.set(`${cellKey(t.day, t.period)}|${t.studentGroup}`, t);
    return map;
  }, [taken.data]);

  // Counted from the grid rather than the server, so every figure on screen
  // moves with the click that caused it.
  const placedByRow = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of Object.values(cells)) {
      const k = rowKey(c.studentGroup, c.course);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [cells]);

  const perDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [key, c] of Object.entries(cells)) {
      const day = key.split("#")[0] as string;
      const k = `${day}|${rowKey(c.studentGroup, c.course)}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [cells]);

  const problemAt = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of problems) map.set(cellKey(p.day, p.period), p.message);
    return map;
  }, [problems]);

  const placed = Object.keys(cells).length;
  const overQuota = quota > 0 && placed > quota;
  const activeRow = rows.find((r) => rowKey(r.studentGroup, r.course) === active) ?? null;

  const groupLabel = (name: string) =>
    groups.find((g) => g.name === name)?.student_group_name || name;

  const remaining = (r: Row) =>
    r.required - (placedByRow.get(rowKey(r.studentGroup, r.course)) ?? 0);

  function place(day: string, period: number) {
    const key = cellKey(day, period);
    if (cells[key]) {
      setCells((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setDirty(true);
      return;
    }
    if (!activeRow) {
      toast.error("اختر التكليف (الشعبة والمادة) من القائمة أولاً");
      return;
    }
    const blocked = busy.get(`${key}|${activeRow.studentGroup}`);
    if (blocked) {
      toast.error(
        `${groupLabel(activeRow.studentGroup)} محجوزة في هذه الحصة${
          blocked.instructorName ? ` لدى ${blocked.instructorName}` : ""
        }`,
      );
      return;
    }
    if (quota > 0 && placed >= quota) {
      toast.error(`اكتمل نصاب المعلم الأسبوعي (${quota} حصة)`);
      return;
    }
    if (remaining(activeRow) <= 0) {
      toast.error("اكتمل عدد حصص هذه المادة لهذه الشعبة");
      return;
    }
    if ((perDay.get(`${day}|${active}`) ?? 0) >= activeRow.maxPerDay) {
      toast.error(`لا تتجاوز ${activeRow.maxPerDay} حصة لهذه المادة في اليوم الواحد`);
      return;
    }
    setCells((prev) => ({
      ...prev,
      [key]: {
        studentGroup: activeRow.studentGroup,
        course: activeRow.course,
        room: activeRow.room,
      },
    }));
    setDirty(true);
  }

  /** Fill what is still owed into free periods, spread across the week. */
  function autoFill() {
    const next = { ...cells };
    const dayTally = new Map(perDay);
    let total = Object.keys(next).length;
    let added = 0;
    const skipped: string[] = [];

    for (const r of [...rows].sort((a, b) => remaining(b) - remaining(a))) {
      const k = rowKey(r.studentGroup, r.course);
      let left =
        r.required -
        Object.values(next).filter((c) => rowKey(c.studentGroup, c.course) === k).length;
      if (left <= 0) continue;

      // Period-major so a subject lands on different days before it doubles up
      // on one, which is how a school reads a balanced week.
      outer: for (const p of periods) {
        for (const d of days) {
          if (left <= 0) break outer;
          if (quota > 0 && total >= quota) break outer;
          const key = cellKey(d.value, p.order);
          if (next[key]) continue;
          if (busy.has(`${key}|${r.studentGroup}`)) continue;
          if ((dayTally.get(`${d.value}|${k}`) ?? 0) >= r.maxPerDay) continue;
          next[key] = { studentGroup: r.studentGroup, course: r.course, room: r.room };
          dayTally.set(`${d.value}|${k}`, (dayTally.get(`${d.value}|${k}`) ?? 0) + 1);
          left -= 1;
          total += 1;
          added += 1;
        }
      }
      if (left > 0) skipped.push(`${groupLabel(r.studentGroup)} — ${r.course}: ${left}`);
    }

    setCells(next);
    setDirty(true);
    if (added) toast.success(`تم توزيع ${added} حصة`);
    if (skipped.length)
      toast.warning(`تعذّر توزيع: ${skipped.slice(0, 3).join("، ")}`, { duration: 6000 });
    if (!added && !skipped.length) toast.info("لا توجد حصص متبقية للتوزيع");
  }

  function addAssignments() {
    if (!pickedGroups.length || !pickCourse) {
      toast.error("اختر شعبة واحدة على الأقل والمادة");
      return;
    }
    setRows((prev) => {
      const next = [...prev];
      for (const g of pickedGroups) {
        const k = rowKey(g, pickCourse);
        const at = next.findIndex((r) => rowKey(r.studentGroup, r.course) === k);
        if (at >= 0) next[at] = { ...(next[at] as Row), required: pickPerWeek };
        else
          next.push({
            studentGroup: g,
            studentGroupName: groupLabel(g),
            course: pickCourse,
            required: pickPerWeek,
            maxPerDay: 2,
            room: null,
            placed: 0,
          });
      }
      return next;
    });
    setActive(rowKey(pickedGroups[0] as string, pickCourse));
    toast.success(`تمت إضافة ${pickedGroups.length} تكليف`);
    setPickedGroups([]);
    setPickCourse("");
    setAdding(false);
  }

  async function removeRow(r: Row) {
    const k = rowKey(r.studentGroup, r.course);
    const has = placedByRow.get(k) ?? 0;
    if (has > 0) {
      const ok = await confirm({
        title: "حذف التكليف",
        description: `سيُحذف ${has} حصة من جدول هذا المعلم لـ${r.studentGroupName} — ${r.course}.`,
        confirmLabel: "حذف",
      });
      if (!ok) return;
      setCells((prev) => {
        const next: Record<string, Cell> = {};
        for (const [key, c] of Object.entries(prev))
          if (rowKey(c.studentGroup, c.course) !== k) next[key] = c;
        return next;
      });
      setDirty(true);
    }
    setRows((prev) => prev.filter((x) => rowKey(x.studentGroup, x.course) !== k));
    if (active === k) setActive("");
  }

  const slotList = (): GridSlot[] =>
    Object.entries(cells).map(([key, cell]) => {
      const [day, period] = key.split("#");
      return {
        day: day as string,
        period: Number(period),
        course: cell.course,
        instructor,
        room: cell.room,
        studentGroup: cell.studentGroup,
      };
    });

  // Validate against the server whenever the week changes, so the grid shows
  // what the save would refuse before it is pressed.
  useEffect(() => {
    if (!instructor) return;
    const slots = slotList();
    if (!slots.length) {
      setProblems([]);
      return;
    }
    const t = setTimeout(() => {
      check.mutate(
        { instructor, slots },
        { onSuccess: (res) => setProblems(res.problems), onError: () => setProblems([]) },
      );
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, instructor]);

  function submit() {
    const slots = slotList();
    save.mutate(
      { instructor, slots },
      {
        onSuccess: (res) => {
          setDirty(false);
          void assignments.refetch();
          toast.success(`تم حفظ ${res.slots} حصة في ${res.groups.length} شعبة`);
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر حفظ الجدول")),
      },
    );
  }

  function saveQuotaValue() {
    const value = Number(quotaDraft || 0);
    if (!Number.isFinite(value) || value < 0) return;
    saveQuota.mutate(
      { ms_weekly_quota: value },
      {
        onSuccess: () => {
          void assignments.refetch();
          void options.refetch();
          toast.success("تم حفظ النصاب");
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر حفظ النصاب")),
      },
    );
  }

  async function switchTeacher(next: string) {
    if (dirty) {
      const ok = await confirm({
        title: "تغييرات غير محفوظة",
        description: "جدول هذا المعلم لم يُحفظ. الانتقال الآن سيُلغي التعديلات.",
        confirmLabel: "تجاهل التعديلات",
      });
      if (!ok) return;
    }
    setInstructor(next);
    setCells({});
    setDirty(false);
  }

  if (options.isLoading) return <TableSkeleton />;
  if (options.error) return <ErrorState error={options.error} onRetry={() => options.refetch()} />;

  const courseChoices = [
    ...new Set(
      (pickedGroups.length ? groups.filter((g) => pickedGroups.includes(g.name)) : groups).flatMap(
        (g) => g.courses,
      ),
    ),
  ].sort();

  return (
    <>
      <TimetableImportDialog open={importing} onOpenChange={setImporting} />
      <PageHeader
        title="بناء الجدول حسب المعلم"
        subtitle="اختر المعلم، أضف تكليفاته (شعبة ومادة وعدد حصص)، ثم وزّعها على الأسبوع"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft/40 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
            >
              <FileSpreadsheet className="size-3.5" />
              استيراد من إكسل
            </button>
            <Link
              to="/app/timetable-grid"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <CalendarCog className="size-3.5" />
              البناء حسب الشعبة
            </Link>
            <button
              onClick={submit}
              disabled={!instructor || save.isPending || overQuota || problems.length > 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              حفظ جدول المعلم
            </button>
          </div>
        }
      />

      {/* Teacher and quota ------------------------------------------------ */}
      <div className="mt-6">
        <SectionCard
          title="المعلم والنصاب"
          description="النصاب هو أقصى عدد حصص أسبوعية لهذا المعلم — يمنع الحفظ عند تجاوزه"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">المعلم</p>
              <SearchableSelect
                options={(options.data?.instructors ?? []).map((i) => ({
                  value: i.name,
                  label: i.instructor_name || i.name,
                }))}
                value={instructor}
                onChange={(v) => void switchTeacher(v)}
                placeholder="اختر المعلم…"
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">النصاب الأسبوعي</p>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  min={0}
                  dir="ltr"
                  value={quotaDraft}
                  disabled={!instructor}
                  onChange={(e) => setQuotaDraft(e.target.value)}
                  placeholder="بدون نصاب"
                />
                <button
                  onClick={saveQuotaValue}
                  disabled={!instructor || saveQuota.isPending}
                  className="shrink-0 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                >
                  حفظ
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] text-muted-foreground">الموزّع حتى الآن</p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {placed}
                {quota > 0 && <span className="text-sm text-muted-foreground"> / {quota}</span>}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] text-muted-foreground">المتبقي من النصاب</p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${overQuota ? "text-destructive" : ""}`}
              >
                {quota > 0 ? quota - placed : "—"}
              </p>
            </div>
          </div>

          {overQuota && (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              عدد الحصص الموزّعة يتجاوز النصاب — احذف {placed - quota} حصة قبل الحفظ.
            </p>
          )}
        </SectionCard>
      </div>

      {/* Assignments ------------------------------------------------------ */}
      {instructor && (
        <div className="mt-6">
          <SectionCard
            title="تكليفات المعلم"
            description="اختر تكليفاً ثم اضغط على خلايا الأسبوع لتوزيعه — أو استخدم التوزيع التلقائي"
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAdding((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  <Plus className="size-3.5" />
                  إضافة تكليف
                </button>
                <button
                  onClick={autoFill}
                  disabled={!rows.length}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft disabled:opacity-50"
                >
                  <Shuffle className="size-3.5" />
                  توزيع تلقائي
                </button>
              </div>
            }
          >
            {adding && (
              <div className="mb-4 rounded-xl border border-primary/30 bg-primary-soft/20 p-3">
                <div className="grid gap-3 lg:grid-cols-[2fr_1fr_auto_auto]">
                  <div>
                    <p className="mb-1 text-[11px] font-medium">
                      الشعب ({pickedGroups.length} مختارة)
                    </p>
                    <Input
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="ابحث عن شعبة…"
                      className="mb-2"
                    />
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-card p-2">
                      {groups
                        .filter((g) =>
                          (g.student_group_name || g.name)
                            .toLowerCase()
                            .includes(groupSearch.toLowerCase()),
                        )
                        .map((g) => (
                          <label
                            key={g.name}
                            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-secondary"
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 accent-[var(--primary)]"
                              checked={pickedGroups.includes(g.name)}
                              onChange={(e) =>
                                setPickedGroups((prev) =>
                                  e.target.checked
                                    ? [...prev, g.name]
                                    : prev.filter((x) => x !== g.name),
                                )
                              }
                            />
                            <span className="truncate">{g.student_group_name || g.name}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium">المادة</p>
                    <SearchableSelect
                      options={courseChoices.map((c) => ({ value: c, label: c }))}
                      value={pickCourse}
                      onChange={setPickCourse}
                      placeholder="اختر المادة…"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium">حصص/أسبوع</p>
                    <Input
                      type="number"
                      min={1}
                      dir="ltr"
                      className="w-24"
                      value={pickPerWeek}
                      onChange={(e) => setPickPerWeek(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addAssignments}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
                    >
                      <Check className="size-3.5" />
                      إضافة
                    </button>
                  </div>
                </div>
              </div>
            )}

            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                لا توجد تكليفات لهذا المعلم بعد — أضف شعبة ومادة للبدء.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((r) => {
                  const k = rowKey(r.studentGroup, r.course);
                  const done = placedByRow.get(k) ?? 0;
                  const left = r.required - done;
                  return (
                    <div
                      key={k}
                      onClick={() => setActive(k)}
                      className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                        active === k
                          ? "border-primary bg-primary-soft/40"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{r.course}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {r.studentGroupName}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeRow(r);
                          }}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="حذف التكليف"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Pill tone={left === 0 ? "success" : left < 0 ? "danger" : "warning"}>
                          {done} / {r.required}
                        </Pill>
                        <span className="text-[11px] text-muted-foreground">
                          {left > 0 ? `متبقٍ ${left}` : left < 0 ? `زائد ${-left}` : "مكتمل"}
                        </span>
                        <label
                          className="ms-auto flex items-center gap-1 text-[10px] text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          المطلوب
                          <Input
                            type="number"
                            min={0}
                            dir="ltr"
                            className="h-7 w-14 px-1 text-xs"
                            value={r.required}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x) =>
                                  rowKey(x.studentGroup, x.course) === k
                                    ? { ...x, required: Math.max(0, Number(e.target.value) || 0) }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {problems.length > 0 && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
          <p className="flex items-center gap-2 text-xs font-bold text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {problems.length} تعارضاً يمنع الحفظ — الخلايا المعلّمة بالأحمر:
          </p>
          <ul className="mt-1.5 space-y-0.5 ps-6 text-[11px] text-destructive">
            {problems.slice(0, 5).map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* The week --------------------------------------------------------- */}
      <div className="mt-6">
        <SectionCard
          title={teacher ? `أسبوع ${teacher.instructor_name || teacher.name}` : "أسبوع المعلم"}
          description={
            activeRow
              ? `التوزيع الحالي: ${activeRow.course} — ${activeRow.studentGroupName}`
              : "اختر تكليفاً من الأعلى ثم اضغط على الخلايا"
          }
          actions={
            placed > 0 ? (
              <button
                onClick={() => {
                  setCells({});
                  setDirty(true);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <Eraser className="size-3.5" />
                تفريغ الأسبوع
              </button>
            ) : undefined
          }
        >
          {!instructor ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              اختر معلماً من القائمة أعلاه للبدء.
            </p>
          ) : periods.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              لم يُعرَّف اليوم الدراسي بعد. عرّف الحصص من شاشة «البناء حسب الشعبة» ثم عُد إلى هنا.
            </p>
          ) : pattern.isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th className="w-24 text-xs font-medium text-muted-foreground">الحصة</th>
                    {days.map((d) => (
                      <th
                        key={d.value}
                        className="min-w-[10rem] rounded-lg bg-secondary/60 px-2 py-2 text-xs font-bold"
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p, index) => (
                    <tr key={p.order}>
                      <td className="whitespace-nowrap rounded-lg bg-secondary/40 px-2 py-2 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                        <span className="block font-bold">{index + 1}</span>
                        <span dir="ltr">{p.from}</span>
                      </td>
                      {days.map((d) => {
                        const key = cellKey(d.value, p.order);
                        const cell = cells[key];
                        const blocked = activeRow
                          ? busy.get(`${key}|${activeRow.studentGroup}`)
                          : undefined;
                        const problem = problemAt.get(key);
                        return (
                          <td key={d.value} className="p-0 align-top">
                            <button
                              onClick={() => place(d.value, p.order)}
                              title={
                                problem ??
                                (blocked
                                  ? `محجوزة لدى ${blocked.instructorName ?? "معلم آخر"}`
                                  : undefined)
                              }
                              className={`h-full min-h-[3.5rem] w-full rounded-lg border px-2 py-2 text-right transition-colors ${
                                problem
                                  ? "border-destructive bg-destructive/10"
                                  : cell
                                    ? "border-primary/30 bg-primary-soft/50 hover:border-destructive/40"
                                    : blocked
                                      ? "cursor-not-allowed border-dashed border-border bg-secondary/40 text-muted-foreground"
                                      : "border-dashed border-border/60 hover:border-primary/40 hover:bg-primary-soft/20"
                              }`}
                            >
                              {cell ? (
                                <>
                                  <span className="flex items-center justify-between gap-1">
                                    <span className="truncate text-xs font-bold">
                                      {cell.course}
                                    </span>
                                    <X className="size-3 shrink-0 text-muted-foreground" />
                                  </span>
                                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                    {groupLabel(cell.studentGroup)}
                                  </span>
                                </>
                              ) : blocked ? (
                                <span className="block truncate text-[11px]">
                                  {blocked.instructorName ?? "محجوزة"}
                                </span>
                              ) : (
                                <span className="block text-center text-[11px] text-muted-foreground/50">
                                  —
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/50 p-2.5 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                الحفظ يستبدل جدول هذا المعلم وحده ولا يمسّ حصص المعلمين الآخرين، ويُحدّث خطة كل شعبة
                بعدد الحصص الموزّعة. توليد حصص الفصل يتم من شاشة «البناء حسب الشعبة».
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}

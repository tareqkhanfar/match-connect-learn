import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListOrdered,
} from "lucide-react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import {
  useExamAvailability,
  useExamFormOptions,
  useSaveExam,
  type ExamSitting,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** The Sunday the school week of `iso` starts on (the server reads it the same way). */
function sundayOf(iso: string): string {
  return addDays(iso, -new Date(`${iso}T12:00:00`).getDay());
}

interface Conflicts {
  students: Array<{
    student: string;
    name: string;
    overlapping: boolean;
    conflicts: Array<{
      exam: string;
      course: string;
      student_group: string;
      from_time: string;
      to_time: string;
      overlapping: boolean;
    }>;
  }>;
  total: number;
  exams: number;
  overlapping: number;
}

/**
 * Scheduling an exam. The slot is picked on the section's own week — period
 * by period, with what is already there (its lessons, its exams, the exams
 * its pupils sit with other sections, holidays) — and expressed as «من الحصة
 * … إلى الحصة …», the way a school talks about it. A clock time is still
 * available for a sitting that does not follow the periods.
 */
export function ExamDialog({
  exam,
  defaultGroup,
  onClose,
}: {
  exam: ExamSitting | null;
  /** The section the page is showing — a new exam starts on it. */
  defaultGroup?: string | undefined;
  onClose: () => void;
}) {
  const options = useExamFormOptions();
  const save = useSaveExam();
  const today = isoDate(new Date());

  const [form, setForm] = useState({
    title: exam?.title ?? "",
    student_group: exam?.student_group ?? defaultGroup ?? "",
    course: exam?.course ?? "",
    exam_type: exam?.exam_type ?? "Final",
    schedule_date: exam?.date ?? "",
    from_time: exam?.from_time?.slice(0, 5) ?? "09:00",
    to_time: exam?.to_time?.slice(0, 5) ?? "10:30",
    room: exam?.room ?? "",
    max: String(exam?.max ?? 100),
  });
  const [mode, setMode] = useState<"periods" | "clock">("periods");
  const [fromPeriod, setFromPeriod] = useState(0);
  const [toPeriod, setToPeriod] = useState(0);
  const [week, setWeek] = useState(sundayOf(exam?.date || today));
  const [conflicts, setConflicts] = useState<Conflicts | null>(null);

  const availability = useExamAvailability(form.student_group || undefined, week, exam?.id);
  const periods = useMemo(() => availability.data?.periods ?? [], [availability.data]);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "student_group" || key === "schedule_date") setConflicts(null);
  }

  // An exam being edited opens on the periods its times cover.
  useEffect(() => {
    if (!exam || fromPeriod || !periods.length) return;
    const start = periods.find((p) => p.from === exam.from_time.slice(0, 5));
    const end = periods.find((p) => p.to === exam.to_time.slice(0, 5));
    if (start && end) {
      setFromPeriod(start.order);
      setToPeriod(end.order);
    } else setMode("clock");
    // Runs once the periods arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods]);

  /** A square on the week: picks the day and the period; a second square on
   *  the same day, later, stretches the exam to it. */
  function pick(date: string, order: number) {
    setConflicts(null);
    if (
      date === form.schedule_date &&
      fromPeriod &&
      order > fromPeriod &&
      toPeriod === fromPeriod
    ) {
      setToPeriod(order);
      return;
    }
    set("schedule_date", date);
    setFromPeriod(order);
    setToPeriod(order);
    setMode("periods");
  }

  const span =
    mode === "periods" && fromPeriod && toPeriod
      ? {
          from: periods.find((p) => p.order === Math.min(fromPeriod, toPeriod))?.from ?? "",
          to: periods.find((p) => p.order === Math.max(fromPeriod, toPeriod))?.to ?? "",
        }
      : null;

  async function submit(acknowledge = false) {
    if (!form.student_group || !form.course || !form.schedule_date) {
      toast.error("الشعبة والمادة وتاريخ الامتحان مطلوبة");
      return;
    }
    if (mode === "periods" && !(fromPeriod && toPeriod)) {
      toast.error("اختر الحصص — من الجدول أو من القائمتين");
      return;
    }
    try {
      await save.mutateAsync({
        ...(exam ? { id: exam.id } : {}),
        title: form.title,
        student_group: form.student_group,
        course: form.course,
        exam_type: form.exam_type,
        schedule_date: form.schedule_date,
        ...(mode === "periods"
          ? {
              from_period: Math.min(fromPeriod, toPeriod),
              to_period: Math.max(fromPeriod, toPeriod),
            }
          : { from_time: `${form.from_time}:00`, to_time: `${form.to_time}:00` }),
        ...(form.room ? { room: form.room } : {}),
        max: Number(form.max) || 100,
        ...(acknowledge ? { acknowledge_conflicts: 1 } : {}),
      });
      toast.success(exam ? "تم تحديث الامتحان" : "تمت جدولة الامتحان");
      onClose();
    } catch (err) {
      const data = err instanceof ApiError ? (err.data as { conflicts?: Conflicts } | null) : null;
      if (data?.conflicts) {
        setConflicts(data.conflicts);
        return;
      }
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر حفظ الامتحان");
    }
  }

  const room = options.data?.rooms.find((r) => r.id === form.room);
  const group = options.data?.groups.find((g) => g.id === form.student_group);
  const groupCourses =
    (form.student_group && options.data?.coursesByGroup?.[form.student_group]) ||
    options.data?.courses ||
    [];
  const overCapacity = room && group && room.capacity > 0 && group.students > room.capacity;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">
            {exam ? "تعديل موعد الامتحان" : "جدولة امتحان"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>الشعبة</Label>
            <SearchableSelect
              options={(options.data?.groups ?? []).map((g) => ({
                value: g.id,
                label: g.name,
                hint: `${g.students} طالباً`,
              }))}
              value={form.student_group}
              onChange={(v) => {
                set("student_group", v);
                const allowed = options.data?.coursesByGroup?.[v];
                if (allowed && form.course && !allowed.includes(form.course)) set("course", "");
                else if (allowed?.length === 1 && !form.course) set("course", allowed[0]!);
              }}
              placeholder="اختر الشعبة"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المادة</Label>
            <SearchableSelect
              options={groupCourses.map((c) => ({ value: c, label: c }))}
              value={form.course}
              onChange={(v) => set("course", v)}
              placeholder="اختر المادة"
            />
          </div>
          <div className="space-y-1.5">
            <Label>نوع الامتحان</Label>
            <SearchableSelect
              options={(options.data?.types ?? []).map((t) => ({ value: t.code, label: t.label }))}
              value={form.exam_type}
              onChange={(v) => set("exam_type", v)}
            />
          </div>
        </div>

        {/* The week the exam goes into. */}
        <div className="rounded-xl border border-border p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <CalendarDays className="size-4 text-primary" />
              اختر الموعد من أسبوع الشعبة
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeek(addDays(week, -7))}
                aria-label="الأسبوع السابق"
                className="grid size-8 place-items-center rounded-lg border border-border hover:bg-secondary"
              >
                <ChevronRight className="size-4" />
              </button>
              <span className="num px-2 text-xs font-semibold" dir="ltr">
                {week.replaceAll("-", "/")} – {addDays(week, 4).replaceAll("-", "/")}
              </span>
              <button
                onClick={() => setWeek(addDays(week, 7))}
                aria-label="الأسبوع التالي"
                className="grid size-8 place-items-center rounded-lg border border-border hover:bg-secondary"
              >
                <ChevronLeft className="size-4" />
              </button>
              {week !== sundayOf(today) && (
                <button
                  onClick={() => setWeek(sundayOf(today))}
                  className="px-2 text-xs font-semibold text-primary hover:underline"
                >
                  هذا الأسبوع
                </button>
              )}
            </div>
          </div>

          {!form.student_group ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              اختر الشعبة أولاً لترى أسبوعها وما هو محجوز فيه.
            </p>
          ) : availability.isLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : !availability.data?.periods.length ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              لا توجد أوقات حصص لهذه الشعبة — حدّد الوقت بالساعة.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]" data-no-tools>
                <thead>
                  <tr>
                    <th className="w-24 p-1 text-start text-muted-foreground">الحصة</th>
                    {availability.data.days.map((d) => (
                      <th key={d.date} className="p-1 text-center">
                        <div className="font-bold">{d.label}</div>
                        <div
                          className="num text-[10px] font-normal text-muted-foreground"
                          dir="ltr"
                        >
                          {d.date.slice(5).replace("-", "/")}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {availability.data.periods.map((p, pi) => (
                    <tr key={p.order}>
                      <td className="p-1 text-muted-foreground">
                        <div className="font-semibold text-foreground">{p.name}</div>
                        <div className="num" dir="ltr">
                          {p.from}–{p.to}
                        </div>
                      </td>
                      {availability.data!.days.map((d) => {
                        const cell = d.cells[pi];
                        const chosen =
                          d.date === form.schedule_date &&
                          mode === "periods" &&
                          p.order >= Math.min(fromPeriod, toPeriod) &&
                          p.order <= Math.max(fromPeriod, toPeriod) &&
                          fromPeriod > 0;
                        const booked = cell?.exams ?? [];
                        const past = d.date < today;
                        const disabled = !!d.holiday || past;
                        return (
                          <td key={d.date} className="p-0.5">
                            <button
                              onClick={() => !disabled && pick(d.date, p.order)}
                              disabled={disabled}
                              title={
                                d.holiday
                                  ? `عطلة — ${d.holiday}`
                                  : booked
                                      .map((e) => `${e.course} — ${e.group} (${e.from}–${e.to})`)
                                      .join("\n")
                              }
                              className={cn(
                                "h-12 w-full rounded-lg border px-1 text-center leading-tight transition-colors",
                                chosen
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : d.holiday
                                    ? "cursor-not-allowed border-dashed border-border bg-secondary/40 text-muted-foreground"
                                    : booked.length
                                      ? booked.some((e) => e.own)
                                        ? "border-destructive/50 bg-destructive-soft text-destructive"
                                        : "border-warning/60 bg-warning-soft text-warm-foreground"
                                      : past
                                        ? "cursor-not-allowed border-border/50 text-muted-foreground/50"
                                        : "border-border bg-card hover:border-primary hover:bg-primary-soft",
                              )}
                            >
                              {d.holiday && pi === 0 ? (
                                <span className="font-semibold">عطلة</span>
                              ) : booked.length ? (
                                <span className="line-clamp-2 font-bold">
                                  {booked[0]!.course}
                                  {booked.length > 1 ? ` +${booked.length - 1}` : ""}
                                </span>
                              ) : (
                                <span className="line-clamp-2 opacity-70">
                                  {cell?.lesson ?? ""}
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
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                <span>
                  <span className="me-1 inline-block size-2.5 rounded bg-destructive-soft ring-1 ring-destructive/50" />
                  امتحان لهذه الشعبة
                </span>
                <span>
                  <span className="me-1 inline-block size-2.5 rounded bg-warning-soft ring-1 ring-warning/60" />
                  امتحان لطلابها مع شعبة أخرى
                </span>
                <span>
                  <span className="me-1 inline-block size-2.5 rounded bg-primary" />
                  الموعد المختار
                </span>
                <span>
                  اضغط مربعاً لاختيار اليوم والحصة، ثم مربعاً لاحقاً في اليوم نفسه لتمديد الامتحان.
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={form.schedule_date}
              onChange={(e) => {
                set("schedule_date", e.target.value);
                if (e.target.value) setWeek(sundayOf(e.target.value));
              }}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label>الوقت</Label>
              <div className="inline-flex rounded-lg bg-secondary p-0.5 text-[11px] font-semibold">
                <button
                  onClick={() => setMode("periods")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1",
                    mode === "periods" ? "bg-card shadow-soft" : "text-muted-foreground",
                  )}
                >
                  <ListOrdered className="size-3" />
                  بالحصص
                </button>
                <button
                  onClick={() => setMode("clock")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1",
                    mode === "clock" ? "bg-card shadow-soft" : "text-muted-foreground",
                  )}
                >
                  <Clock className="size-3" />
                  بالساعة
                </button>
              </div>
            </div>
            {mode === "periods" ? (
              <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <select
                  value={fromPeriod || ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFromPeriod(v);
                    if (!toPeriod || toPeriod < v) setToPeriod(v);
                  }}
                  className="h-10 rounded-xl border border-border bg-card px-2 text-sm"
                >
                  <option value="">من الحصة…</option>
                  {periods.map((p) => (
                    <option key={p.order} value={p.order}>
                      من {p.name} ({p.from})
                    </option>
                  ))}
                </select>
                <select
                  value={toPeriod || ""}
                  onChange={(e) => setToPeriod(Number(e.target.value))}
                  className="h-10 rounded-xl border border-border bg-card px-2 text-sm"
                >
                  <option value="">إلى الحصة…</option>
                  {periods
                    .filter((p) => !fromPeriod || p.order >= fromPeriod)
                    .map((p) => (
                      <option key={p.order} value={p.order}>
                        إلى {p.name} ({p.to})
                      </option>
                    ))}
                </select>
                <span className="num text-xs font-bold text-primary" dir="ltr">
                  {span ? `${span.from}–${span.to}` : ""}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="time"
                  value={form.from_time}
                  onChange={(e) => set("from_time", e.target.value)}
                  className="num rounded-xl"
                  aria-label="من الساعة"
                />
                <Input
                  type="time"
                  value={form.to_time}
                  onChange={(e) => set("to_time", e.target.value)}
                  className="num rounded-xl"
                  aria-label="إلى الساعة"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>القاعة</Label>
            <SearchableSelect
              options={(options.data?.rooms ?? []).map((r) => ({
                value: r.id,
                label: r.name,
                ...(r.capacity ? { hint: `تتسع ${r.capacity}` } : {}),
              }))}
              value={form.room}
              onChange={(v) => set("room", v)}
              placeholder="اختر القاعة"
              clearable
              clearLabel="بدون قاعة"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الدرجة العظمى</Label>
            <Input
              type="number"
              min={1}
              value={form.max}
              onChange={(e) => set("max", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>عنوان الامتحان (اختياري)</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="يُشتق من المادة والشعبة"
              className="rounded-xl"
            />
          </div>
          {overCapacity && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground sm:col-span-3">
              عدد طلاب الشعبة ({group!.students}) أكبر من سعة القاعة ({room!.capacity}).
            </p>
          )}
        </div>

        {conflicts && (
          <div className="rounded-xl border border-warning/60 bg-warning-soft/40 p-3">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <AlertTriangle className="size-4 text-warning" />
              تعارضات في هذا اليوم: {conflicts.total} طالباً لديهم امتحانات أخرى
              {conflicts.overlapping ? ` — ${conflicts.overlapping} في الوقت نفسه` : ""}
            </p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
              {conflicts.students.map((s) => (
                <li key={s.student} className="rounded-lg bg-card px-2.5 py-1.5">
                  <span className={cn("font-bold", s.overlapping && "text-destructive")}>
                    {s.name}
                  </span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {s.conflicts
                      .map(
                        (c) =>
                          `${c.course} (${c.student_group}${c.from_time ? `، \u2066${c.from_time}–${c.to_time}\u2069` : ""})${
                            c.overlapping ? " ⟵ نفس الوقت" : ""
                          }`,
                      )
                      .join("، ")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => submit(true)}
                disabled={save.isPending}
                className="h-9 rounded-xl bg-warning px-4 text-xs font-bold text-white disabled:opacity-60"
              >
                متابعة رغم ذلك
              </button>
              <button
                onClick={() => setConflicts(null)}
                className="h-9 rounded-xl border border-border bg-card px-4 text-xs font-semibold"
              >
                تعديل الموعد
              </button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={() => submit(false)}
            disabled={save.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : exam ? "حفظ التعديلات" : "جدولة"}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

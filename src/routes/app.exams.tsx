import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CalendarDays,
  Clock,
  DoorOpen,
  History,
  Pencil,
  Plus,
  Timer,
  Trash2,
  Users,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useConfirm } from "@/components/shared/confirm";
import { ExamBoard } from "@/components/shared/exam-board";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { byRole, isBackOffice } from "@/lib/roles";
import {
  useDeleteExam,
  useExamFormOptions,
  useExamSchedule,
  useSaveExam,
  type ExamSitting,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/exams")({
  head: () => ({
    meta: [
      { title: "جدول الامتحانات — Match Education" },
      {
        name: "description",
        content: "جدول الامتحانات لكل شعبة ومادة مع القاعة والموعد ونوع الامتحان.",
      },
    ],
  }),
  component: ExamsPage,
});

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS[d.getDay()]} ${iso}`;
}

/** "بعد ٣ أيام" / "اليوم" / "غداً" — friendlier than a bare date. */
function countdown(days: number | null): { text: string; urgent: boolean } | null {
  if (days === null || days < 0) return null;
  if (days === 0) return { text: "اليوم", urgent: true };
  if (days === 1) return { text: "غداً", urgent: true };
  if (days <= 7) return { text: `بعد ${days} أيام`, urgent: days <= 3 };
  return { text: `بعد ${days} يوماً`, urgent: false };
}

function ExamsPage() {
  const { role } = useApp();
  const canSchedule = isBackOffice(role) || role === "teacher";

  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  // How the same exams are laid out. A list answers "what is next"; the board
  // answers "is this week too heavy", which is the question when scheduling.
  const [layout, setLayout] = useState<"list" | "week" | "month">("list");
  const [cursor, setCursor] = useState(() => new Date());
  const [type, setType] = useState("");
  const [group, setGroup] = useState("");
  const [editing, setEditing] = useState<ExamSitting | null>(null);
  const [creating, setCreating] = useState(false);

  const viewed = useViewedStudent();
  const query = useExamSchedule({
    ...(type ? { exam_type: type } : {}),
    ...(group ? { student_group: group } : {}),
    ...(viewed ? { student: viewed } : {}),
  });
  const remove = useDeleteExam();
  const saveExam = useSaveExam();
  const confirm = useConfirm();

  const all = query.data?.exams ?? [];
  const visible = all.filter((e) => (view === "upcoming" ? e.upcoming : !e.upcoming));

  // Group by date so the page reads as a calendar rather than a flat list.
  const byDate = useMemo(() => {
    const map = new Map<string, ExamSitting[]>();
    for (const e of visible) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    const entries = [...map.entries()];
    entries.sort((a, b) =>
      view === "upcoming" ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]),
    );
    return entries;
  }, [visible, view]);

  /** Drag-and-drop: only the date moves; time, room and staff stay put. */
  async function moveExam(exam: ExamSitting, date: string) {
    try {
      await saveExam.mutateAsync({
        id: exam.id,
        student_group: exam.student_group,
        course: exam.course,
        schedule_date: date,
        from_time: exam.from_time,
        to_time: exam.to_time,
        room: exam.room,
        max: exam.max,
      });
      toast.success(`تم نقل ${exam.course} إلى ${date}`);
    } catch (err) {
      // Holidays and clashes are refused by the server with a reason.
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر نقل الامتحان");
    }
  }

  const next = all.filter((e) => e.upcoming).sort((a, b) => a.date.localeCompare(b.date))[0];
  const thisWeek = all.filter((e) => e.upcoming && e.days_away !== null && e.days_away <= 7).length;

  async function removeExam(exam: ExamSitting) {
    const ok = await confirm({
      title: `حذف امتحان ${exam.course}؟`,
      description: `${formatDate(exam.date)} — ${exam.student_group}. سيُحذف من جدول جميع الطلاب.`,
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(exam.id);
      toast.success("تم حذف الامتحان من الجدول");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title={byRole(role, "جدول الامتحانات", {
          teacher: "جدول امتحاناتي",
          student: "جدول امتحاناتي",
          parent: "جدول امتحانات الأبناء",
        })}
        subtitle={byRole(role, "مواعيد الامتحانات لكل شعبة ومادة مع القاعة والموعد", {
          teacher: "امتحانات الشُعب والمواد التي تدرّسها",
          student: "مواعيد امتحاناتك القادمة",
          parent: "مواعيد امتحانات أبنائك",
        })}
        actions={
          canSchedule ? (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="size-4" />
              جدولة امتحان
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="امتحانات قادمة"
          value={query.data?.upcoming ?? 0}
          icon={CalendarClock}
          tone="primary"
        />
        <KpiCard label="خلال أسبوع" value={thisWeek} icon={Timer} tone="warm" />
        <KpiCard
          label="الامتحان القادم"
          value={next ? formatDate(next.date).split(" ")[0]! : "—"}
          icon={CalendarDays}
          tone="accent"
        />
        <KpiCard label="امتحانات سابقة" value={query.data?.past ?? 0} icon={History} tone="info" />
      </div>

      {/* The nearest exam, called out so it is the first thing anyone sees. */}
      {next && view === "upcoming" && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-primary/25 bg-primary-soft">
          <div className="flex flex-wrap items-center gap-4 p-4">
            <div
              className="grid size-14 shrink-0 place-items-center rounded-2xl text-white"
              style={{ backgroundColor: next.colour }}
            >
              <CalendarClock className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-primary">الامتحان القادم</p>
              <p className="truncate text-base font-bold">{next.course}</p>
              <p className="num truncate text-xs text-muted-foreground">
                {formatDate(next.date)} • {next.from_time.slice(0, 5)}
                {next.room_name ? ` • ${next.room_name}` : ""}
              </p>
            </div>
            {(() => {
              const c = countdown(next.days_away);
              return c ? (
                <span
                  className={`rounded-xl px-3 py-2 text-sm font-bold ${
                    c.urgent ? "bg-destructive text-white" : "bg-card text-primary"
                  }`}
                >
                  {c.text}
                </span>
              ) : null;
            })()}
          </div>
        </div>
      )}

      <div className="card-surface my-5 grid gap-3 p-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="inline-flex items-center gap-1 rounded-xl bg-secondary p-1">
          <button
            onClick={() => setView("upcoming")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              view === "upcoming" ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >
            القادمة
          </button>
          <button
            onClick={() => setView("past")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              view === "past" ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >
            السابقة
          </button>
        </div>

        {/* The same exams, laid out three ways. */}
        <div className="inline-flex items-center gap-1 rounded-xl bg-secondary p-1">
          {(
            [
              ["list", "قائمة"],
              ["week", "أسبوعي"],
              ["month", "شهري"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setLayout(key)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                layout === key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <SearchableSelect
          options={(query.data?.types ?? []).map((t) => ({ value: t.code, label: t.label }))}
          value={type}
          onChange={setType}
          placeholder="كل أنواع الامتحانات"
          clearable
          clearLabel="كل الأنواع"
        />

        <SearchableSelect
          options={[...new Set(all.map((e) => e.student_group))].map((g) => ({
            value: g,
            label: g,
          }))}
          value={group}
          onChange={setGroup}
          placeholder="كل الشُعب"
          clearable
          clearLabel="كل الشُعب"
        />
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={6} />
      ) : layout !== "list" ? (
        <div className="card-surface p-4">
          <ExamBoard
            exams={visible}
            view={layout}
            cursor={cursor}
            busy={saveExam.isPending}
            onMove={(delta) =>
              setCursor((c) => {
                const next = new Date(c);
                if (layout === "month") next.setMonth(next.getMonth() + delta);
                else next.setDate(next.getDate() + delta * 7);
                return next;
              })
            }
            onDropExam={canSchedule ? moveExam : () => {}}
            {...(canSchedule ? { onPick: setEditing } : {})}
          />
        </div>
      ) : byDate.length === 0 ? (
        <EmptyBlock
          title={view === "upcoming" ? "لا توجد امتحانات قادمة" : "لا توجد امتحانات سابقة"}
          description={
            canSchedule
              ? "استخدم «جدولة امتحان» لإضافة موعد جديد."
              : "سيظهر هنا جدول امتحاناتك فور إعلانه."
          }
          icon={<CalendarDays className="size-6" />}
        />
      ) : (
        <div className="space-y-5">
          {byDate.map(([date, items]) => (
            <SectionCard
              key={date}
              title={formatDate(date)}
              description={`${items.length} امتحان`}
              actions={(() => {
                const c = countdown(items[0]!.days_away);
                return c ? (
                  <Pill tone={c.urgent ? "danger" : "info"}>{c.text}</Pill>
                ) : (
                  <Pill tone="muted">منتهٍ</Pill>
                );
              })()}
            >
              <ul className="space-y-3">
                {items
                  .slice()
                  .sort((a, b) => a.from_time.localeCompare(b.from_time))
                  .map((e) => (
                    <li
                      key={e.id}
                      className="grid gap-3 rounded-xl border border-border p-3.5 transition-colors hover:bg-secondary/30 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
                    >
                      {/* A coloured spine makes the exam type scannable. */}
                      <div className="flex items-center gap-3">
                        <span
                          className="h-full min-h-[2.5rem] w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: e.colour }}
                        />
                        <span
                          className="num shrink-0 rounded-lg px-2.5 py-1.5 text-center text-xs font-bold text-white"
                          style={{ backgroundColor: e.colour }}
                        >
                          {e.from_time.slice(0, 5)}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold">{e.course}</p>
                          <Pill tone="muted">{e.exam_type_label}</Pill>
                        </div>
                        <div className="num mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {e.student_group}
                          </span>
                          {e.room_name && (
                            <span className="flex items-center gap-1">
                              <DoorOpen className="size-3" />
                              {e.room_name}
                            </span>
                          )}
                          {e.duration > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {e.duration} دقيقة
                            </span>
                          )}
                          <span>من {e.max} درجة</span>
                        </div>
                      </div>

                      {canSchedule && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => setEditing(e)}
                            aria-label="تعديل"
                            className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => removeExam(e)}
                            aria-label="حذف"
                            className="rounded-lg bg-secondary px-2.5 py-1.5 text-destructive transition-colors hover:bg-destructive-soft"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ExamDialog
          exam={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ExamDialog({ exam, onClose }: { exam: ExamSitting | null; onClose: () => void }) {
  const options = useExamFormOptions();
  const save = useSaveExam();

  const [form, setForm] = useState({
    title: exam?.title ?? "",
    student_group: exam?.student_group ?? "",
    course: exam?.course ?? "",
    exam_type: exam?.exam_type ?? "Final",
    schedule_date: exam?.date ?? "",
    from_time: exam?.from_time?.slice(0, 5) ?? "09:00",
    to_time: exam?.to_time?.slice(0, 5) ?? "10:30",
    room: exam?.room ?? "",
    max: String(exam?.max ?? 100),
  });

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.student_group || !form.course || !form.schedule_date) {
      toast.error("الشعبة والمادة وتاريخ الامتحان مطلوبة");
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
        from_time: `${form.from_time}:00`,
        to_time: `${form.to_time}:00`,
        ...(form.room ? { room: form.room } : {}),
        max: Number(form.max) || 100,
      });
      toast.success(exam ? "تم تحديث الامتحان" : "تمت جدولة الامتحان");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر حفظ الامتحان");
    }
  }

  const room = options.data?.rooms.find((r) => r.id === form.room);
  const group = options.data?.groups.find((g) => g.id === form.student_group);
  const overCapacity = room && group && room.capacity > 0 && group.students > room.capacity;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {exam ? "تعديل موعد الامتحان" : "جدولة امتحان"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>عنوان الامتحان (اختياري)</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="يُشتق من المادة والشعبة إن تُرك فارغاً"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>الشعبة</Label>
            <SearchableSelect
              options={(options.data?.groups ?? []).map((g) => ({
                value: g.id,
                label: g.name,
                hint: `${g.students} طالباً`,
              }))}
              value={form.student_group}
              onChange={(v) => set("student_group", v)}
              placeholder="اختر الشعبة"
            />
          </div>

          <div className="space-y-1.5">
            <Label>المادة</Label>
            <SearchableSelect
              options={(options.data?.courses ?? []).map((c) => ({ value: c, label: c }))}
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

          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={form.schedule_date}
              onChange={(e) => set("schedule_date", e.target.value)}
              className="num rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>من الساعة</Label>
            <Input
              type="time"
              value={form.from_time}
              onChange={(e) => set("from_time", e.target.value)}
              className="num rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>إلى الساعة</Label>
            <Input
              type="time"
              value={form.to_time}
              onChange={(e) => set("to_time", e.target.value)}
              className="num rounded-xl"
            />
          </div>

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

          {overCapacity && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground sm:col-span-2">
              عدد طلاب الشعبة ({group!.students}) أكبر من سعة القاعة ({room!.capacity}).
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
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

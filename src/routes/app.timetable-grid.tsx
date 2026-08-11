import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarCog,
  CalendarRange,
  Check,
  GraduationCap,
  Save,
  School,
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
  useGridOptions,
  usePattern,
  useSavePattern,
  type ConflictItem,
  type GridSlot,
} from "@/lib/api/hooks";

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

  const options = useGridOptions();
  const pattern = usePattern(
    mode === "class" ? { student_group: group } : { instructor },
  );

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

  // Load the stored pattern into the editable grid.
  useEffect(() => {
    if (!pattern.data) return;
    const next: Record<string, GridSlot> = {};
    for (const s of pattern.data.slots) next[cellKey(s.day, s.period)] = s;
    setSlots(next);
    setDirty(false);
    setConflicts({});
  }, [pattern.data]);

  const periods = pattern.data?.periods ?? options.data?.periods ?? [];
  const days = pattern.data?.days ?? options.data?.days ?? [];
  const teaching = periods.filter((p) => !p.isBreak);

  const list = useMemo(
    () => Object.values(slots).filter((s) => s.course),
    [slots],
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

  function setCell(day: string, period: number, slot: GridSlot | null) {
    setSlots((current) => {
      const next = { ...current };
      if (slot) next[cellKey(day, period)] = { ...slot, day, period };
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

      next[cellKey(to.day, to.period)] = { ...moving, day: to.day, period: to.period };
      // Dropping onto an occupied cell swaps them, which is what a timetabler
      // means by moving a lesson into a taken slot.
      if (displaced) {
        next[cellKey(from.day, from.period)] = {
          ...displaced,
          day: from.day,
          period: from.period,
        };
      } else {
        delete next[cellKey(from.day, from.period)];
      }

      setDirty(true);
      void runCheck(next);
      return next;
    });
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
  const canEdit = mode === "class" && Boolean(group);

  return (
    <>
      <PageHeader
        title="بناء الجدول الدراسي"
        subtitle="اسحب الحصص لترتيب الأسبوع — يتحقق النظام من التعارضات فوراً"
        actions={
          canEdit ? (
            <>
              <button
                onClick={() => setGenerating(true)}
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
              onClick={() => setMode(key)}
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
              onChange={setGroup}
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

      {totalConflicts > 0 && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive-soft p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-destructive">
            <AlertTriangle className="size-4" />
            {totalConflicts} تعارضاً — الخانات المظللة بالأحمر
          </p>
          <p className="mt-1 text-xs text-destructive/80">
            لا يمكن الحفظ قبل معالجتها. مرّر المؤشر على الخانة لمعرفة السبب.
          </p>
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

      {generating && group && (
        <GenerateDialog group={group} onClose={() => setGenerating(false)} />
      )}
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

          {bad && (
            <AlertTriangle className="absolute left-1 top-1 size-3.5 text-destructive" />
          )}
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function run() {
    try {
      const result = await generate.mutateAsync({
        student_group: group,
        ...(from ? { from_date: from } : {}),
        ...(to ? { to_date: to } : {}),
      });
      const skipped = result.skipped.length;
      toast.success(
        `تم إنشاء ${result.created} حصة` + (skipped ? ` — تعذّر ${skipped}` : ""),
      );
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
          اتركهما فارغين لاستخدام تواريخ الفصل الدراسي للشعبة.
        </p>

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

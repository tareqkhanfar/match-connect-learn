import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCog, Eraser, GraduationCap, Info, Save, School, X } from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { errorMessage } from "@/lib/api/error-message";
import {
  usePattern,
  useSaveTeacherPattern,
  useTakenPeriods,
  useTeacherGridOptions,
  type GridSlot,
  type TakenPeriod,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/timetable-teacher")({
  head: () => ({
    meta: [
      { title: "بناء الجدول حسب المعلم — Match Education" },
      {
        name: "description",
        content: "إدخال جدول المدرسة معلماً معلماً: اختر الشعبة والمادة ثم املأ حصص الأسبوع.",
      },
    ],
  }),
  component: TeacherTimetablePage,
});

const cellKey = (day: string, period: number) => `${day}#${period}`;

/** Sunday to Thursday — the working week in the schools this serves. */
const WORKING_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

type Cell = { studentGroup: string; course: string; room: string | null };

function TeacherTimetablePage() {
  const options = useTeacherGridOptions();
  const [instructor, setInstructor] = useState("");
  const [group, setGroup] = useState("");
  const [course, setCourse] = useState("");
  const [room, setRoom] = useState("");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [dirty, setDirty] = useState(false);

  const pattern = usePattern(instructor ? { instructor } : {});
  const taken = useTakenPeriods(instructor || undefined);
  const save = useSaveTeacherPattern();

  // The teacher's saved week is the starting point; edits live on top of it
  // until saved, so switching teachers must not carry them across.
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

  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm("لديك تعديلات غير محفوظة. هل تريد المغادرة؟"),
  });

  const groups = options.data?.groups ?? [];
  const periods = options.data?.periods ?? [];
  const days = (options.data?.days ?? []).filter((d) => WORKING_DAYS.includes(d.value));
  const courses = groups.find((g) => g.name === group)?.courses ?? [];

  useEffect(() => {
    if (course && !courses.includes(course)) setCourse("");
  }, [course, courses]);

  // Who else holds each cell, so a section is never promised twice.
  const busy = useMemo(() => {
    const map = new Map<string, TakenPeriod>();
    for (const t of taken.data?.taken ?? [])
      map.set(`${cellKey(t.day, t.period)}|${t.studentGroup}`, t);
    return map;
  }, [taken.data]);

  const ready = instructor && group && course;

  const paint = (day: string, period: number) => {
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
    if (!ready) {
      toast.error("اختر المعلم والشعبة والمادة أولاً");
      return;
    }
    if (busy.has(`${key}|${group}`)) {
      const who = busy.get(`${key}|${group}`);
      toast.error(
        `هذه الشعبة محجوزة في هذه الحصة${who?.instructorName ? ` لدى ${who.instructorName}` : ""}`,
      );
      return;
    }
    setCells((prev) => ({ ...prev, [key]: { studentGroup: group, course, room: room || null } }));
    setDirty(true);
  };

  const submit = () => {
    const slots: GridSlot[] = Object.entries(cells).map(([key, cell]) => {
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
    save.mutate(
      { instructor, slots },
      {
        onSuccess: (res) => {
          setDirty(false);
          toast.success(`تم حفظ ${res.slots} حصة في ${res.groups.length} شعبة`);
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر حفظ الجدول")),
      },
    );
  };

  const groupLabel = (name: string) =>
    groups.find((g) => g.name === name)?.student_group_name || name;

  const instructorLabel =
    (options.data?.instructors ?? []).find((i) => i.name === instructor)?.instructor_name ||
    instructor;
  const placed = Object.keys(cells).length;

  if (options.isLoading) return <TableSkeleton />;
  if (options.error) return <ErrorState error={options.error} onRetry={() => options.refetch()} />;

  return (
    <>
      <PageHeader
        title="بناء الجدول حسب المعلم"
        subtitle="اختر المعلم، ثم الشعبة والمادة، واملأ حصص أسبوعه بالضغط على الخلايا"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/app/timetable-grid"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <CalendarCog className="size-3.5" />
              البناء حسب الشعبة
            </Link>
            <button
              onClick={submit}
              disabled={!instructor || save.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              حفظ جدول المعلم
            </button>
          </div>
        }
      />

      <div className="mt-6">
        <SectionCard
          title="المعلم والمادة"
          description="الشعبة والمادة تبقى مختارة، فتُملأ عدة حصص بالضغط عليها واحدة تلو الأخرى"
          actions={
            placed > 0 ? (
              <Pill tone={dirty ? "warning" : "info"}>
                {placed} حصة{dirty ? " — غير محفوظة" : ""}
              </Pill>
            ) : undefined
          }
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
                onChange={(v) => {
                  if (dirty && !window.confirm("لديك تعديلات غير محفوظة لهذا المعلم. تجاهلها؟"))
                    return;
                  setInstructor(v);
                }}
                placeholder="اختر المعلم…"
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">الصف والشعبة</p>
              <SearchableSelect
                options={groups.map((g) => ({
                  value: g.name,
                  label: g.student_group_name || g.name,
                  ...(g.program ? { code: g.program } : {}),
                }))}
                value={group}
                onChange={setGroup}
                placeholder="اختر الشعبة…"
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">المادة</p>
              <SearchableSelect
                options={courses.map((c) => ({ value: c, label: c }))}
                value={course}
                onChange={setCourse}
                placeholder={group ? "اختر المادة…" : "اختر الشعبة أولاً"}
                disabled={!group}
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">القاعة (اختياري)</p>
              <SearchableSelect
                options={(options.data?.rooms ?? []).map((r) => ({
                  value: r.name,
                  label: r.room_name || r.name,
                }))}
                value={room}
                onChange={setRoom}
                placeholder="بدون قاعة"
                clearable
                clearLabel="بدون قاعة"
              />
            </div>
          </div>

          <p className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/50 p-2.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            اضغط على خلية فارغة لإضافة الحصة بالاختيار الحالي، واضغط على حصة موجودة لحذفها. الحفظ
            يستبدل جدول هذا المعلم وحده، ولا يمسّ حصص المعلمين الآخرين في الشعب نفسها.
          </p>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title={instructorLabel ? `أسبوع ${instructorLabel}` : "أسبوع المعلم"}
          description={
            instructor
              ? "الخلايا الرمادية شعبٌ محجوزة لدى معلم آخر في الحصة نفسها"
              : "اختر معلماً لعرض أسبوعه"
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
                  {periods.map((p) => (
                    <tr key={p.order}>
                      <td className="whitespace-nowrap rounded-lg bg-secondary/40 px-2 py-2 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                        <span className="block font-bold">{p.order}</span>
                        <span dir="ltr">{p.from}</span>
                      </td>
                      {days.map((d) => {
                        const key = cellKey(d.value, p.order);
                        const cell = cells[key];
                        const blocked = group ? busy.get(`${key}|${group}`) : undefined;
                        return (
                          <td key={d.value} className="p-0 align-top">
                            <button
                              onClick={() => paint(d.value, p.order)}
                              title={
                                blocked
                                  ? `محجوزة لدى ${blocked.instructorName ?? "معلم آخر"}`
                                  : undefined
                              }
                              className={`h-full w-full rounded-lg border px-2 py-2 text-right transition-colors ${
                                cell
                                  ? "border-primary/30 bg-primary-soft/50 hover:border-destructive/40"
                                  : blocked
                                    ? "border-dashed border-border bg-secondary/40 text-muted-foreground"
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
                                  <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                                    <School className="size-3 shrink-0" />
                                    {groupLabel(cell.studentGroup)}
                                  </span>
                                  {cell.room && (
                                    <span className="block truncate text-[10px] text-muted-foreground">
                                      {cell.room}
                                    </span>
                                  )}
                                </>
                              ) : blocked ? (
                                <span className="flex items-center gap-1 truncate text-[11px]">
                                  <GraduationCap className="size-3 shrink-0" />
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
            </div>
          )}
        </SectionCard>
      </div>

      {placed > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>الشعب في هذا الأسبوع:</span>
          {[...new Set(Object.values(cells).map((c) => c.studentGroup))].map((g) => (
            <Link
              key={g}
              to="/app/timetable-grid"
              search={{ group: g }}
              className="rounded-lg border border-border px-2 py-1 font-medium transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
            >
              {groupLabel(g)}
            </Link>
          ))}
          <span>— افتح الشعبة لتوليد حصص الفصل بعد اكتمال جدولها.</span>
        </div>
      )}
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { CalendarDays, Printer, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { LessonPlanDialog, PlanMarker } from "@/components/shared/lesson-plan-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { byRole } from "@/lib/roles";
import { useClasses, useTeachers, useTimetable } from "@/lib/api/hooks";
import type { ScheduleSlot, TimetablePeriod } from "@/lib/api/types";

export const Route = createFileRoute("/app/timetable")({
  validateSearch: groupSearch,
  head: () => ({
    meta: [
      { title: "الجدول الدراسي — Match Education" },
      {
        name: "description",
        content: "جدول أسبوعي مرئي لكل صف ومعلم بأيام وحصص وألوان مميزة لكل مادة.",
      },
      { property: "og:title", content: "الجدول الدراسي — Match Education" },
      { property: "og:description", content: "شبكة أيام × حصص بألوان لكل مادة دراسية." },
    ],
  }),
  component: TimetablePage,
});

// School week runs Sunday → Thursday.
const WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

const SLOT_COLORS = [
  "bg-primary-soft text-primary border-primary/25",
  "bg-success-soft text-accent border-accent/25",
  "bg-warm-soft text-warm-foreground border-warning/30",
  "bg-info-soft text-info border-info/25",
  "bg-success-soft text-success border-success/25",
  "bg-destructive-soft text-destructive border-destructive/25",
];

/** Stable colour per subject so the grid reads consistently. */
function colorFor(subject: string) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) | 0;
  return SLOT_COLORS[Math.abs(hash) % SLOT_COLORS.length]!;
}

function shortTime(t: string) {
  return (t || "").slice(0, 5);
}

/** A row's time. A period two stages run at different hours shows both, so a
 *  teacher reading one grid across the school can tell them apart. */
function periodTime(p: TimetablePeriod) {
  const times = p.varies && p.times?.length ? p.times : [{ from: p.from, to: p.to }];
  const seen = new Set<string>();
  for (const t of times) if (t.from) seen.add(`${t.from}–${t.to || ""}`);
  return Array.from(seen).join(" / ") || "—";
}

/**
 * The lesson happening right now, as "day#start".
 *
 * Only when the week on screen is this week — the same grid is used to look
 * back and forward, and a mark on a past week would be a lie.
 */
function useNowSlot(
  weekStart: string | undefined,
  days: Record<string, Array<{ from_time: string; to_time: string }>>,
) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    if (!weekStart) return null;
    const now = new Date(tick);
    const start = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 7 * 864e5);
    if (now < start || now >= end) return null;
    const day = WEEK_DAYS[now.getDay()];
    if (!day) return null;
    const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const slot = (days[day] ?? []).find(
      (s) => shortTime(s.from_time) <= clock && clock < shortTime(s.to_time),
    );
    return slot ? `${day}#${shortTime(slot.from_time)}` : null;
  }, [weekStart, days, tick]);
}

function TimetablePage() {
  const { role } = useApp();
  const isTeacher = role === "teacher";
  // Students and parents get their own timetable; the back office picks a
  // class. A teacher gets their *own* lessons: "جدولي" means the periods this
  // teacher stands in front of a class, not everything their sections are
  // taught by everyone else.
  const picksClass = role === "admin" || role === "secretary";

  const classesQuery = useClasses();
  // Opened from a class: start on it instead of on the first in the list.
  const { group: groupFromUrl } = Route.useSearch();
  const [groupId, setGroupId] = useState<string>(groupFromUrl ?? "");

  // A teacher may still look at a whole class, but only by asking for it.
  const [teacherViewsClass, setTeacherViewsClass] = useState(false);
  // The back office reads this screen two ways: a section's week, or one
  // teacher's. Both are the same grid; only the question differs.
  const [mode, setMode] = useState<"class" | "teacher">("class");
  const [instructorId, setInstructorId] = useState("");
  const teachersQuery = useTeachers({});
  const byTeacher = picksClass && mode === "teacher";
  // Which lesson's preparation is open. Every role can open one; what they
  // see inside is the server's decision, not this screen's.
  const [planFor, setPlanFor] = useState<string | null>(null);
  const showsClassPicker = (picksClass && mode === "class") || (isTeacher && teacherViewsClass);

  useEffect(() => {
    if (showsClassPicker && !groupId && classesQuery.data?.length) {
      setGroupId(groupFromUrl ?? classesQuery.data[0]!.name);
    }
  }, [showsClassPicker, classesQuery.data, groupId]);

  const viewed = useViewedStudent();
  const timetableQuery = useTimetable(
    byTeacher
      ? instructorId
        ? { instructor: instructorId }
        : {}
      : showsClassPicker && groupId
        ? { student_group: groupId }
        : // No argument for a teacher: the server resolves the instructor from
          // the session, so one teacher can never request another's week.
          isTeacher
          ? {}
          : viewed
            ? { student: viewed }
            : {},
  );

  // `?? []` builds a new array every render, so every memo downstream
  // recomputed on each one. Memoised so the identity is stable.
  const days = useMemo(() => timetableQuery.data?.days ?? {}, [timetableQuery.data]);

  // The rows are the school day, sent by the server: seven periods with the
  // times this class actually runs them at. Building them here from the times
  // present in the week was the bug — a class with no lesson in period 1 lost
  // the row and every period below it was renumbered, so "الحصة 4" on screen
  // could be period 5 in the register.
  const periods = useMemo<TimetablePeriod[]>(() => {
    const sent = timetableQuery.data?.periods;
    if (sent?.length) return sent;
    // An older server, or a week with no clock to read: fall back to the
    // distinct start times rather than showing nothing.
    const times = new Set<string>();
    for (const slots of Object.values(days)) {
      for (const s of slots) times.add(shortTime(s.from_time));
    }
    return Array.from(times)
      .sort()
      .map((from, i) => ({ order: i + 1, from, to: "" }));
  }, [timetableQuery.data, days]);

  // Lessons by row, so a cell is found by its period and not by matching a
  // time string: two classes in a teacher's week may run the same period at
  // different hours.
  const byCell = useMemo(() => {
    const map = new Map<string, ScheduleSlot>();
    for (const [day, slots] of Object.entries(days)) {
      for (const s of slots) {
        const row = s.period_order ?? periods.find((p) => p.from === shortTime(s.from_time))?.order;
        if (row != null) map.set(`${day}#${row}`, s);
      }
    }
    return map;
  }, [days, periods]);

  // The grid is drawn whenever there is a class to draw it for: an empty week
  // is a timetable with nothing in it, which is an answer, where a blank
  // screen only looks broken.
  const hasData = periods.length > 0;
  const hasLessons = useMemo(() => Object.values(days).some((slots) => slots.length > 0), [days]);
  const selectedClass = classesQuery.data?.find((c) => c.name === groupId);
  const selectedTeacher = (teachersQuery.data ?? []).find((t) => t.name === instructorId);
  const nowSlot = useNowSlot(timetableQuery.data?.week_start, days);

  return (
    <>
      <PageHeader
        title={byRole(role, "الجدول الدراسي", {
          teacher: "جدولي",
          student: "جدولي الدراسي",
          parent: "جدول الأبناء",
        })}
        subtitle={
          byTeacher
            ? `${selectedTeacher?.instructor_name ?? "اختر معلماً"} • ${timetableQuery.data?.week_start ?? ""}`
            : showsClassPicker
              ? `${selectedClass?.student_group_name ?? ""} • ${timetableQuery.data?.week_start ?? ""}`
              : isTeacher
                ? `حصصي أنا • الأسبوع من ${timetableQuery.data?.week_start ?? ""}`
                : `الأسبوع من ${timetableQuery.data?.week_start ?? ""}`
        }
        actions={
          <>
            {isTeacher && (
              <button
                onClick={() => setTeacherViewsClass((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                {teacherViewsClass ? "عرض حصصي أنا" : "عرض جدول شعبة كاملة"}
              </button>
            )}
            {picksClass && (
              <div className="inline-flex h-10 items-center rounded-xl border border-border bg-card p-0.5 text-sm font-semibold">
                {[
                  { key: "class" as const, label: "حسب الشعبة" },
                  { key: "teacher" as const, label: "حسب المعلم" },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`h-9 rounded-[10px] px-3 transition-colors ${
                      mode === m.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
            {byTeacher && (
              <Select value={instructorId} onValueChange={setInstructorId}>
                <SelectTrigger className="h-10 w-[220px] rounded-xl">
                  <SelectValue placeholder="اختر المعلم" />
                </SelectTrigger>
                <SelectContent>
                  {(teachersQuery.data ?? []).map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.instructor_name || t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showsClassPicker && (
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="h-10 w-[200px] rounded-xl">
                  <SelectValue placeholder="اختر الشعبة" />
                </SelectTrigger>
                <SelectContent>
                  {(classesQuery.data ?? []).map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.student_group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:bg-secondary"
            >
              <Printer className="size-4" />
              <span className="hidden sm:inline">طباعة</span>
            </button>
          </>
        }
      />

      <SectionCard title="الجدول الأسبوعي" description="الأحد إلى الخميس">
        {timetableQuery.error ? (
          <ErrorState error={timetableQuery.error} onRetry={() => timetableQuery.refetch()} />
        ) : timetableQuery.isLoading ? (
          <TableSkeleton rows={6} />
        ) : byTeacher && !instructorId ? (
          <EmptyBlock title="اختر معلماً لعرض جدوله" icon={<CalendarDays className="size-6" />} />
        ) : !hasData ? (
          <EmptyBlock
            title="لا توجد حصص مجدولة هذا الأسبوع"
            icon={<CalendarDays className="size-6" />}
          />
        ) : (
          <div className="overflow-x-auto">
            {/* An empty week is still drawn as a week: the same seven rows,
                every cell "—". Replacing the grid with a notice made a class
                with nothing scheduled look like a failure to load. */}
            {!hasLessons && (
              <p className="mb-3 rounded-xl border border-dashed border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                لا توجد حصص مجدولة هذا الأسبوع — الشبكة تعرض أوقات الحصص كما هي معرّفة.
              </p>
            )}
            <table className="w-full border-collapse text-right text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border p-2 text-xs font-semibold text-muted-foreground">
                    الحصة
                  </th>
                  {WEEK_DAYS.map((d) => (
                    <th
                      key={d}
                      className="border-b border-border p-2 text-xs font-semibold text-muted-foreground"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.order}>
                    <td className="num whitespace-nowrap border-b border-border p-2 text-xs text-muted-foreground">
                      <span className="font-semibold">
                        {period.extra ? "خارج الدوام" : `الحصة ${period.order}`}
                      </span>
                      <span className="block">{periodTime(period)}</span>
                      {period.varies && (
                        <span className="block text-[10px] opacity-70">يختلف حسب الصف</span>
                      )}
                    </td>
                    {WEEK_DAYS.map((day) => {
                      const slot = byCell.get(`${day}#${period.order}`);
                      const isNow = !!slot && nowSlot === `${day}#${shortTime(slot.from_time)}`;
                      return (
                        <td key={day} className="border-b border-border p-1.5 align-top">
                          {slot ? (
                            <button
                              type="button"
                              onClick={() => setPlanFor(slot.id)}
                              title="اضغط لعرض تحضير الحصة"
                              className={`w-full rounded-xl border p-2 text-right transition-all hover:-translate-y-0.5 hover:shadow-soft ${
                                slot.cancelled
                                  ? "border-destructive/40 bg-destructive-soft"
                                  : colorFor(slot.subject)
                              } ${isNow ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                            >
                              {isNow && (
                                <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                                  <Radio className="size-3 animate-pulse" />
                                  الآن
                                </span>
                              )}
                              <p
                                className={`truncate text-xs font-bold ${
                                  slot.cancelled ? "text-destructive line-through" : ""
                                }`}
                              >
                                {slot.subject}
                              </p>
                              {slot.cancelled && (
                                <p className="mt-0.5 text-[10px] font-bold text-destructive">
                                  ملغية{slot.cancelReason ? ` — ${slot.cancelReason}` : ""}
                                </p>
                              )}
                              {slot.teacher && (
                                <p
                                  className={`truncate text-[11px] opacity-80 ${
                                    slot.cancelled ? "line-through" : ""
                                  }`}
                                >
                                  {slot.teacher}
                                </p>
                              )}
                              {/* The class, so a teacher can tell two lessons of
                                  the same subject apart at a glance. */}
                              {slot.class_name && (
                                <p className="truncate text-[10px] font-semibold opacity-75">
                                  {slot.class_name}
                                </p>
                              )}
                              {slot.room && (
                                <p className="num truncate text-[10px] opacity-70">{slot.room}</p>
                              )}
                              <PlanMarker
                                hasPlan={slot.has_plan}
                                hasHomework={slot.has_homework}
                                published={slot.plan_published}
                              />
                            </button>
                          ) : (
                            <div className="grid h-full min-h-[52px] place-items-center rounded-xl border border-dashed border-border text-[11px] text-muted-foreground">
                              —
                            </div>
                          )}
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

      {hasLessons && (
        <div className="mt-5">
          <SectionCard title="المواد في هذا الأسبوع" description="الألوان المستخدمة في الجدول">
            <div className="flex flex-wrap gap-2">
              {Array.from(
                new Set(
                  Object.values(days)
                    .flat()
                    .map((s) => s.subject),
                ),
              ).map((s) => (
                <Pill key={s}>{s}</Pill>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {planFor && <LessonPlanDialog courseSchedule={planFor} onClose={() => setPlanFor(null)} />}
    </>
  );
}

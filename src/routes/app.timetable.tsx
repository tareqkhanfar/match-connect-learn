import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
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
import { useClasses, useTimetable } from "@/lib/api/hooks";

export const Route = createFileRoute("/app/timetable")({
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

function TimetablePage() {
  const { role } = useApp();
  // Students and parents get their own timetable; staff pick a class.
  const picksClass = role === "admin" || role === "teacher";

  const classesQuery = useClasses();
  const [groupId, setGroupId] = useState<string>("");

  useEffect(() => {
    if (picksClass && !groupId && classesQuery.data?.length) {
      setGroupId(classesQuery.data[0]!.name);
    }
  }, [picksClass, classesQuery.data, groupId]);

  const viewed = useViewedStudent();
  const timetableQuery = useTimetable(
    picksClass && groupId
      ? { student_group: groupId }
      : viewed
        ? { student: viewed }
        : {},
  );

  const days = timetableQuery.data?.days ?? {};

  // Build the period rows from the distinct start times present in the week.
  const periods = useMemo(() => {
    const times = new Set<string>();
    for (const slots of Object.values(days)) {
      for (const s of slots) times.add(shortTime(s.from_time));
    }
    return Array.from(times).sort();
  }, [days]);

  const hasData = periods.length > 0;
  const selectedClass = classesQuery.data?.find((c) => c.name === groupId);

  return (
    <>
      <PageHeader
        title={byRole(role, "الجدول الدراسي", { teacher: "جدولي", student: "جدولي الدراسي", parent: "جدول الأبناء" })}
        subtitle={
          picksClass
            ? `${selectedClass?.student_group_name ?? ""} • ${timetableQuery.data?.week_start ?? ""}`
            : `الأسبوع من ${timetableQuery.data?.week_start ?? ""}`
        }
        actions={
          <>
            {picksClass && (
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
        ) : !hasData ? (
          <EmptyBlock
            title="لا توجد حصص مجدولة هذا الأسبوع"
            icon={<CalendarDays className="size-6" />}
          />
        ) : (
          <div className="overflow-x-auto">
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
                {periods.map((time, pi) => (
                  <tr key={time}>
                    <td className="num whitespace-nowrap border-b border-border p-2 text-xs text-muted-foreground">
                      <span className="font-semibold">الحصة {pi + 1}</span>
                      <span className="block">{time}</span>
                    </td>
                    {WEEK_DAYS.map((day) => {
                      const slot = (days[day] ?? []).find((s) => shortTime(s.from_time) === time);
                      return (
                        <td key={day} className="border-b border-border p-1.5 align-top">
                          {slot ? (
                            <div className={`rounded-xl border p-2 ${colorFor(slot.subject)}`}>
                              <p className="truncate text-xs font-bold">{slot.subject}</p>
                              {slot.teacher && (
                                <p className="truncate text-[11px] opacity-80">{slot.teacher}</p>
                              )}
                              {slot.room && (
                                <p className="num truncate text-[10px] opacity-70">{slot.room}</p>
                              )}
                            </div>
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

      {hasData && (
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
    </>
  );
}

import { BookOpen, CalendarClock, ClipboardCheck, NotebookPen, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar, KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useDashboard } from "@/lib/api/hooks";
import type { TeacherDashboard as TeacherDashboardData } from "@/lib/api/types";

/** "09:00:00" -> "09:00" */
function shortTime(t: string) {
  return (t || "").slice(0, 5);
}

export function TeacherDashboard() {
  const { session } = useApp();
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const d = data as TeacherDashboardData;
  const kpi = d.kpi;
  const schedule = d.today_schedule ?? [];
  const groups = d.groups ?? [];
  const assignments = d.assignments ?? [];

  return (
    <>
      <PageHeader
        title="لوحة المعلم"
        subtitle={`أهلاً ${session?.name ?? ""} — لديك ${schedule.length} حصة اليوم و${kpi.pending_grading} واجباً بحاجة إلى تصحيح`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="صفوفي" value={kpi.classes} icon={BookOpen} tone="primary" />
        <KpiCard label="طلابي" value={kpi.students} icon={Users} tone="accent" />
        <KpiCard label="حصص اليوم" value={schedule.length} icon={CalendarClock} tone="info" />
        <KpiCard label="واجبات للتصحيح" value={kpi.pending_grading} icon={NotebookPen} tone="warm" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="حصص اليوم"
          description="جدول اليوم الدراسي"
          className="xl:col-span-1"
          actions={
            <Link to="/app/timetable" className="text-xs font-semibold text-primary hover:underline">
              الجدول الكامل
            </Link>
          }
        >
          {schedule.length === 0 ? (
            <EmptyBlock title="لا توجد حصص اليوم" icon={<CalendarClock className="size-6" />} />
          ) : (
            <ul className="space-y-2.5">
              {schedule.map((slot, i) => (
                <li key={slot.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{slot.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{slot.student_group}</p>
                  </div>
                  <span className="num shrink-0 text-xs text-muted-foreground">{shortTime(slot.from_time)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="صفوفي" description="عدد الطلاب في كل شعبة" className="xl:col-span-2">
          {groups.length === 0 ? (
            <EmptyBlock title="لم يتم إسناد أي شعبة لك بعد" icon={<BookOpen className="size-6" />} />
          ) : (
            <ul className="space-y-3.5">
              {groups.map((c, i) => (
                <li key={c.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                  <Avatar name={c.student_group_name} />
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{c.student_group_name}</p>
                      <span className="num shrink-0 text-xs text-muted-foreground">{c.students} طالباً</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar
                        value={c.capacity ? Math.min((c.students / c.capacity) * 100, 100) : 0}
                        tone={i % 2 ? "success" : "primary"}
                      />
                    </div>
                  </div>
                  <Link
                    to="/app/attendance"
                    className="shrink-0 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                  >
                    تسجيل الحضور
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard
          title="الواجبات النشطة"
          description="حالة التسليم"
          actions={
            <Link to="/app/assignments" className="text-xs font-semibold text-primary hover:underline">
              كل الواجبات
            </Link>
          }
        >
          {assignments.length === 0 ? (
            <EmptyBlock title="لا توجد واجبات بعد" icon={<NotebookPen className="size-6" />} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {assignments.map((a) => {
                const total = Number(a.total ?? 0);
                const submitted = Number(a.submitted ?? 0);
                return (
                  <li key={a.id} className="rounded-xl border border-border p-3.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.subject} • {a.grade}
                        </p>
                      </div>
                      <Pill tone={a.status === "مفتوح" ? "info" : a.status === "مغلق" ? "muted" : "warning"}>
                        {a.status}
                      </Pill>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <ProgressBar value={total ? (submitted / total) * 100 : 0} tone="success" />
                      <span className="num shrink-0 text-xs text-muted-foreground">
                        {submitted}/{total}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

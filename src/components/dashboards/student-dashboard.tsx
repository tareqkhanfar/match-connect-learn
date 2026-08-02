import { Link } from "@tanstack/react-router";
import { Award, CalendarDays, ClipboardCheck, NotebookPen, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useDashboard } from "@/lib/api/hooks";
import type { StudentDashboard as StudentDashboardData } from "@/lib/api/types";
import { money } from "@/lib/roles";

function shortTime(t: string) {
  return (t || "").slice(0, 5);
}

export function StudentDashboard() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const d = data as StudentDashboardData;

  if (!d.student) {
    return (
      <EmptyBlock
        title="لا يوجد ملف طالب مرتبط بحسابك"
        description="يرجى التواصل مع إدارة المدرسة لربط حسابك بملف الطالب."
      />
    );
  }

  const s = d.student;
  const kpi = d.kpi;
  const schedule = d.today_schedule ?? [];
  const assignments = d.assignments ?? [];
  const grades = d.grades ?? [];

  return (
    <>
      <PageHeader
        title={`مرحباً ${s.name} 👋`}
        subtitle={[s.program, s.batch ? `شعبة ${s.batch}` : null, `رقم الطالب ${s.id}`]
          .filter(Boolean)
          .join(" • ")}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="معدلي العام" value={`${kpi?.average ?? 0}%`} icon={Award} tone="primary" />
        <KpiCard
          label="نسبة حضوري"
          value={`${kpi?.attendance_rate ?? 0}%`}
          icon={ClipboardCheck}
          tone="accent"
        />
        <KpiCard
          label="واجبات مستحقة"
          value={kpi?.pending_assignments ?? 0}
          icon={NotebookPen}
          tone="warm"
        />
        <KpiCard
          label="رسوم متبقية"
          value={money(kpi?.outstanding_fees ?? 0)}
          icon={Wallet}
          tone="info"
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="جدول اليوم"
          description="حصص اليوم الدراسي"
          actions={<CalendarDays className="size-4 text-muted-foreground" />}
        >
          {schedule.length === 0 ? (
            <EmptyBlock title="لا توجد حصص اليوم" icon={<CalendarDays className="size-6" />} />
          ) : (
            <ul className="space-y-2.5">
              {schedule.map((slot, i) => (
                <li
                  key={slot.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <span className="num grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{slot.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{slot.teacher}</p>
                  </div>
                  <span className="num shrink-0 text-xs text-muted-foreground">
                    {shortTime(slot.from_time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="واجباتي"
          description="آخر الواجبات المطلوبة"
          className="xl:col-span-2"
          actions={
            <Link
              to="/app/assignments"
              className="text-xs font-semibold text-primary hover:underline"
            >
              كل الواجبات
            </Link>
          }
        >
          {assignments.length === 0 ? (
            <EmptyBlock title="لا توجد واجبات حالياً" icon={<NotebookPen className="size-6" />} />
          ) : (
            <ul className="space-y-3">
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.subject} • تاريخ التسليم {a.due}
                    </p>
                  </div>
                  <Pill tone={a.my_submission ? "success" : "warning"}>
                    {a.my_submission ? a.my_submission.status : "لم يُسلّم"}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard title="درجاتي حسب المادة" description="آخر النتائج المسجّلة">
          {grades.length === 0 ? (
            <EmptyBlock title="لا توجد درجات مسجّلة بعد" icon={<Award className="size-6" />} />
          ) : (
            <>
              <div className="h-[260px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={grades.map((g) => ({ subject: g.subject, average: g.percentage }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="subject"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                        direction: "rtl",
                      }}
                      formatter={(v: number) => [`${v}%`, "النسبة"]}
                    />
                    <Bar
                      dataKey="average"
                      fill="var(--chart-1)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <ul className="mt-4 space-y-3">
                {grades.map((g) => (
                  <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">{g.subject}</p>
                        <span className="num shrink-0 text-xs text-muted-foreground">
                          {g.score}/{g.max}
                        </span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar
                          value={g.percentage}
                          tone={
                            g.percentage >= 75
                              ? "success"
                              : g.percentage >= 50
                                ? "primary"
                                : "danger"
                          }
                        />
                      </div>
                    </div>
                    {g.grade && <Pill tone="muted">{g.grade}</Pill>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>
      </div>
    </>
  );
}

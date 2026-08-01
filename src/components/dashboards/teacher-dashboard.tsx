import { BookOpen, ClipboardCheck, NotebookPen, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Avatar, KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { assignments, classes, performanceData, timetable, weekDays } from "@/lib/mock-data";

export function TeacherDashboard() {
  const myClasses = classes.slice(0, 4);
  const today = timetable[weekDays[0]!] ?? [];

  return (
    <>
      <PageHeader title="لوحة المعلم" subtitle="صباح الخير أ. محمود — لديك ٥ حصص اليوم و٣ واجبات بحاجة إلى تصحيح" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="صفوفي" value={myClasses.length} icon={BookOpen} tone="primary" />
        <KpiCard label="طلابي" value={myClasses.reduce((a, c) => a + c.students, 0)} icon={Users} tone="accent" />
        <KpiCard label="حصص اليوم" value={5} icon={ClipboardCheck} tone="info" />
        <KpiCard label="واجبات للتصحيح" value={3} icon={NotebookPen} tone="warm" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <SectionCard
          title="حصص اليوم"
          description="الأحد"
          className="xl:col-span-1"
          actions={
            <Link to="/app/timetable" className="text-xs font-semibold text-primary hover:underline">
              الجدول الكامل
            </Link>
          }
        >
          <ul className="space-y-2.5">
            {today.slice(0, 5).map((slot, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{slot.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{classes[i]?.grade} - {classes[i]?.section}</p>
                </div>
                <span className="num text-xs text-muted-foreground">0{8 + i}:00</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="صفوفي" description="متوسط الحضور والأداء" className="xl:col-span-2">
          <ul className="space-y-3.5">
            {myClasses.map((c, i) => (
              <li key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                <Avatar name={`${c.grade} ${c.section}`} />
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">
                      {c.grade} - شعبة {c.section}
                    </p>
                    <span className="num text-xs text-muted-foreground">{88 + i * 3}%</span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={88 + i * 3} tone={i % 2 ? "success" : "primary"} />
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
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SectionCard title="الواجبات النشطة" description="حالة التسليم">
          <ul className="space-y-3">
            {assignments.slice(0, 4).map((a) => (
              <li key={a.id} className="rounded-xl border border-border p-3.5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.subject} • {a.grade}</p>
                  </div>
                  <Pill tone={a.status === "مفتوح" ? "info" : a.status === "مغلق" ? "muted" : "warning"}>{a.status}</Pill>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar value={(a.submitted / a.total) * 100} tone="success" />
                  <span className="num shrink-0 text-xs text-muted-foreground">{a.submitted}/{a.total}</span>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="أداء طلابي حسب المادة" description="متوسط الدرجات">
          <div className="h-[260px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    direction: "rtl",
                  }}
                  formatter={(v: number) => [`${v}%`, "المعدل"]}
                />
                <Bar dataKey="average" fill="var(--chart-1)" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

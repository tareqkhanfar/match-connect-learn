import { Link } from "@tanstack/react-router";
import { Award, CalendarDays, ClipboardCheck, NotebookPen, Wallet } from "lucide-react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { assignments, currentStudent, money, performanceData, subjectNames, timetable, weekDays } from "@/lib/mock-data";

const termProgress = [
  { term: "شهر ١", avg: 78 },
  { term: "شهر ٢", avg: 81 },
  { term: "شهر ٣", avg: 76 },
  { term: "شهر ٤", avg: 85 },
  { term: "شهر ٥", avg: 88 },
  { term: "شهر ٦", avg: 91 },
];

export function StudentDashboard() {
  const s = currentStudent;
  const today = timetable[weekDays[0]!] ?? [];

  return (
    <>
      <PageHeader title={`مرحباً ${s.name} 👋`} subtitle={`${s.grade} - شعبة ${s.section} • رقم الطالب ${s.id}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="معدلي العام" value={`${s.average}%`} icon={Award} tone="primary" />
        <KpiCard label="نسبة حضوري" value={`${s.attendanceRate}%`} icon={ClipboardCheck} tone="accent" />
        <KpiCard label="واجبات مستحقة" value={3} icon={NotebookPen} tone="warm" />
        <KpiCard label="رسوم متبقية" value={money(s.feeTotal - s.feePaid)} icon={Wallet} tone="info" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <SectionCard title="جدول اليوم" description="الأحد" actions={<CalendarDays className="size-4 text-muted-foreground" />}>
          <ul className="space-y-2.5">
            {today.slice(0, 6).map((slot, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="num grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{slot.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{slot.teacher}</p>
                </div>
                <span className="num text-xs text-muted-foreground">0{8 + i}:00</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="تطور معدلي" description="خلال الفصل الحالي" className="xl:col-span-2">
          <div className="h-[280px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={termProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="term" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.75rem", fontSize: "12px", direction: "rtl" }}
                  formatter={(v: number) => [`${v}%`, "المعدل"]}
                />
                <Line type="monotone" dataKey="avg" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4, fill: "var(--chart-1)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SectionCard title="درجاتي حسب المادة" description="الفصل الثاني">
          <ul className="space-y-3.5">
            {performanceData.map((p, i) => (
              <li key={p.subject}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{p.subject}</span>
                  <span className="num text-sm font-bold">{p.average}</span>
                </div>
                <ProgressBar value={p.average} tone={p.average >= 85 ? "success" : p.average >= 70 ? "primary" : "warning"} />
                {i === 0 && null}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="واجباتي"
          description="المستحقة قريباً"
          actions={
            <Link to="/app/assignments" className="text-xs font-semibold text-primary hover:underline">
              عرض الكل
            </Link>
          }
        >
          <ul className="space-y-3">
            {assignments.slice(0, 5).map((a) => (
              <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.title}</p>
                  <p className="num truncate text-xs text-muted-foreground">{a.subject} • التسليم {a.due}</p>
                </div>
                <Pill tone={a.status === "مغلق" ? "muted" : a.status === "مفتوح" ? "info" : "warning"}>{a.status}</Pill>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard title="حضوري" description={`المواد: ${subjectNames.slice(0, 6).join("، ")}`}>
          <div className="grid grid-cols-7 gap-2 sm:grid-cols-14">
            {Array.from({ length: 28 }, (_, i) => {
              const absent = [4, 11, 19].includes(i);
              const late = [7, 22].includes(i);
              return (
                <div
                  key={i}
                  title={absent ? "غياب" : late ? "تأخر" : "حضور"}
                  className={`num grid aspect-square place-items-center rounded-lg text-xs font-semibold ${
                    absent ? "bg-destructive-soft text-destructive" : late ? "bg-warning-soft text-warm-foreground" : "bg-success-soft text-success"
                  }`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-success" /> حضور</span>
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-warning" /> تأخر</span>
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-destructive" /> غياب</span>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

import { Users, GraduationCap, School, ClipboardCheck, CalendarDays, Bell } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { useDashboard } from "@/lib/api/hooks";
import type { AdminDashboard as AdminDashboardData } from "@/lib/api/types";
import { DashboardSkeleton, ErrorState } from "@/components/shared/states";

const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const tooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    fontSize: "12px",
    direction: "rtl" as const,
    color: "var(--card-foreground)",
  },
};

const GENDER_LABELS: Record<string, string> = { Male: "طلاب", Female: "طالبات" };

export function AdminDashboard() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const d = data as AdminDashboardData;
  const kpi = d.kpi;
  const attendanceTrend = d.attendance_trend ?? [];
  const gradeDistribution = d.grade_distribution ?? [];
  const performanceData = d.performance ?? [];
  const announcements = d.announcements ?? [];
  const genderSplit = (d.gender_split ?? []).map((g) => ({
    name: GENDER_LABELS[g.name] ?? g.name,
    value: g.value,
  }));

  return (
    <>
      <PageHeader
        title="لوحة تحكم المدرسة"
        subtitle={`نظرة شاملة على الأداء الأكاديمي والحضور والأنشطة${d.academic_year ? ` — العام الدراسي ${d.academic_year}` : ""}`}
        actions={d.academic_year ? <Pill tone="success">{d.academic_year}</Pill> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد الطلاب" value={kpi.students} icon={Users} tone="primary" />
        <KpiCard label="عدد المعلمين" value={kpi.teachers} icon={GraduationCap} tone="accent" />
        <KpiCard label="عدد الصفوف والشُعب" value={kpi.classes} icon={School} tone="info" />
        <KpiCard label="نسبة الحضور اليوم" value={`${kpi.attendance_today}%`} icon={ClipboardCheck} tone="warm" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <SectionCard title="الحضور عبر الزمن" description="نسبة الحضور الشهرية خلال العام" className="xl:col-span-2">
          <div className="h-[290px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={34} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, "الحضور"]} />
                <Area type="monotone" dataKey="present" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#attGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="توزيع الطلاب" description="حسب النوع">
          <div className="h-[290px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderSplit} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={4} stroke="none">
                  {genderSplit.map((_, i) => (
                    <Cell key={i} fill={pieColors[i]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-5">
            {genderSplit.map((g, i) => (
              <div key={g.name} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: pieColors[i] }} />
                <span className="text-muted-foreground">{g.name}</span>
                <span className="num font-semibold">{g.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SectionCard title="توزيع الطلاب حسب الصف" description="عدد الطلاب في كل صف دراسي">
          <div className="h-[280px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="grade" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "طالب"]} />
                <Bar dataKey="students" fill="var(--chart-2)" radius={[8, 8, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="الأداء الأكاديمي العام" description="متوسط الدرجات حسب المادة">
          <div className="h-[280px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="subject"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={82}
                  orientation="right"
                />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, "المعدل"]} />
                <Bar dataKey="average" fill="var(--chart-3)" radius={[0, 8, 8, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard title="الأحداث والإعلانات القادمة" description="آخر التحديثات من إدارة المدرسة" actions={<Bell className="size-4 text-muted-foreground" />}>
          <ul className="divide-y divide-border">
            {announcements.map((a) => (
              <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 py-3.5 first:pt-0 last:pb-0">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
                  <CalendarDays className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.body}</p>
                  <p className="num mt-1 text-[11px] text-muted-foreground">{a.date} • {a.audience}</p>
                </div>
                <Pill tone={a.type === "تنبيه" ? "danger" : a.type === "حدث" ? "info" : "primary"}>{a.type}</Pill>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}

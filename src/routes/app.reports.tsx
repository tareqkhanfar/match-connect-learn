import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { Award, BarChart3, ClipboardCheck, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useReports } from "@/lib/api/hooks";
import { money } from "@/lib/roles";

export const Route = createFileRoute("/app/reports")({
  validateSearch: groupSearch,
  head: () => ({
    meta: [
      { title: "التقارير — Match Education" },
      {
        name: "description",
        content: "تقارير أكاديمية وحضور ومالية مبنية على بيانات المدرسة الفعلية.",
      },
      { property: "og:title", content: "التقارير — Match Education" },
      { property: "og:description", content: "حلّل الأداء الأكاديمي والحضور والتحصيل المالي." },
    ],
  }),
  component: ReportsPage,
});

const TOOLTIP = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    fontSize: "12px",
    direction: "rtl" as const,
  },
};

function ReportsPage() {
  const { data, isLoading, error, refetch } = useReports();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return <EmptyBlock title="لا توجد بيانات" />;

  const { academic, attendance, financial } = data;
  const overallAverage = academic.by_subject.length
    ? Math.round(
        academic.by_subject.reduce((a, s) => a + s.average, 0) / academic.by_subject.length,
      )
    : 0;

  return (
    <>
      <PageHeader
        title="التقارير"
        subtitle={`تحليل الأداء الأكاديمي والحضور والتحصيل${data.academic_year ? ` — ${data.academic_year}` : ""}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="المعدل العام" value={`${overallAverage}%`} icon={Award} tone="primary" />
        <KpiCard
          label="نسبة الحضور"
          value={`${attendance.overall}%`}
          icon={ClipboardCheck}
          tone="accent"
        />
        <KpiCard
          label="عدد المواد المقيّمة"
          value={academic.by_subject.length}
          icon={BarChart3}
          tone="info"
        />
        {financial && (
          <KpiCard
            label="نسبة التحصيل"
            value={`${financial.totals.collection_rate}%`}
            icon={Wallet}
            tone="warm"
          />
        )}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <SectionCard title="الأداء حسب المادة" description="متوسط النسبة المئوية لكل مادة">
          {academic.by_subject.length === 0 ? (
            <EmptyBlock title="لا توجد نتائج مسجّلة" />
          ) : (
            <div className="h-[280px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={academic.by_subject} layout="vertical" margin={{ right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={92}
                    orientation="right"
                  />
                  <Tooltip {...TOOLTIP} formatter={(v: number) => [`${v}%`, "المعدل"]} />
                  <Bar
                    dataKey="average"
                    fill="var(--chart-3)"
                    radius={[0, 8, 8, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="نسبة الحضور الشهرية" description="النسبة المئوية لكل شهر">
          {attendance.monthly.length === 0 ? (
            <EmptyBlock title="لا توجد بيانات حضور" />
          ) : (
            <div className="h-[280px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendance.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                  />
                  <Tooltip {...TOOLTIP} formatter={(v: number) => [`${v}%`, "الحضور"]} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SectionCard title="الأوائل" description="أعلى ١٠ طلاب حسب المعدل">
          {academic.top_students.length === 0 ? (
            <EmptyBlock title="لا توجد نتائج كافية" />
          ) : (
            <ul className="space-y-3">
              {academic.top_students.map((s, i) => (
                <li
                  key={s.student}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
                >
                  <span className="num grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.student_name}</p>
                    <div className="mt-1.5">
                      <ProgressBar value={s.average} tone="success" />
                    </div>
                  </div>
                  <span className="num text-sm font-bold">{s.average}%</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="الحضور حسب الشعبة" description="نسبة الحضور لكل شعبة">
          {attendance.by_group.length === 0 ? (
            <EmptyBlock title="لا توجد بيانات" />
          ) : (
            <ul className="space-y-3">
              {attendance.by_group.map((g) => (
                <li
                  key={g.student_group}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{g.student_group}</p>
                      <span className="num shrink-0 text-xs text-muted-foreground">{g.rate}%</span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar
                        value={g.rate}
                        tone={g.rate >= 85 ? "success" : g.rate >= 70 ? "warning" : "danger"}
                      />
                    </div>
                  </div>
                  <Pill tone="muted">{g.total} سجل</Pill>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {financial && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <SectionCard title="التحصيل المالي الشهري" description="المُحصّل مقابل المتوقع (₪)">
            {financial.monthly.length === 0 ? (
              <EmptyBlock title="لا توجد بيانات مالية" />
            ) : (
              <div className="h-[280px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financial.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip {...TOOLTIP} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, direction: "rtl" }}
                      formatter={(v) => (v === "collected" ? "المُحصّل" : "المتوقع")}
                    />
                    <Bar
                      dataKey="expected"
                      fill="var(--muted)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={26}
                    />
                    <Bar
                      dataKey="collected"
                      fill="var(--chart-2)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={26}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard title="التحصيل حسب الصف" description="الإجمالي والمتبقي لكل صف">
            {financial.by_program.length === 0 ? (
              <EmptyBlock title="لا توجد فواتير" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-3 font-semibold">الصف</th>
                      <th className="pb-3 font-semibold">الإجمالي</th>
                      <th className="pb-3 font-semibold">المُحصّل</th>
                      <th className="pb-3 font-semibold">المتبقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {financial.by_program.map((p) => (
                      <tr key={p.program}>
                        <td className="py-2.5 font-medium">{p.program}</td>
                        <td className="num py-2.5">{money(p.total)}</td>
                        <td className="num py-2.5 text-success">{money(p.collected)}</td>
                        <td className="num py-2.5 text-destructive">{money(p.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}

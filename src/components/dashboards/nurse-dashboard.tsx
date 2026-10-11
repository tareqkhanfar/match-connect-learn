import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  HeartPulse,
  Home,
  Pill as PillIcon,
  Stethoscope,
} from "lucide-react";
import { KpiCard, PageHeader, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, ErrorState } from "@/components/shared/states";
import { ReportChart } from "@/components/reports/report-chart";
import { VisitsTable } from "@/components/reports/visits-table";
import { useNurseDashboard } from "@/lib/api/reports";

/**
 * The school nurse's opening screen: today's clinic, the week so far, the
 * last two weeks at a glance, and the pupils whose conditions the nurse must
 * keep in mind. Everything deeper is one click away in the reports.
 */
export function NurseDashboard({ showHeader = true }: { showHeader?: boolean }) {
  const q = useNurseDashboard();
  if (q.isLoading) return <DashboardSkeleton />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;

  const links = (
    <div className="flex flex-wrap gap-2">
      <Link
        to="/app/health"
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <HeartPulse className="size-4" />
        الصحة والعيادة
      </Link>
      <Link
        to="/app/health-reports"
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3.5 text-sm font-semibold hover:bg-secondary"
      >
        <BarChart3 className="size-4" />
        تقارير التمريض
      </Link>
    </div>
  );

  return (
    <div className="space-y-5">
      {showHeader ? (
        <PageHeader
          title="عيادة المدرسة"
          subtitle="زيارات اليوم والحالات التي تحتاج متابعة"
          actions={links}
        />
      ) : (
        links
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="زيارات اليوم"
          value={d.today}
          icon={Stethoscope}
          tone="primary"
          {...(d.todaySentHome ? { trend: `${d.todaySentHome} أُرسلوا للمنزل` } : {})}
        />
        <KpiCard
          label="زيارات هذا الأسبوع"
          value={d.thisWeek}
          icon={CalendarDays}
          tone="info"
          trend={`آخر 30 يوماً: ${d.last30}`}
        />
        <KpiCard
          label="أمراض مزمنة"
          value={d.chronic}
          icon={HeartPulse}
          tone="warm"
          trend={`حساسية: ${d.allergies}`}
        />
        <KpiCard label="أدوية منتظمة" value={d.medications} icon={PillIcon} tone="accent" />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <SectionCard
          title="آخر أسبوعين"
          description="عدد زيارات العيادة يومياً"
          className="xl:col-span-2"
        >
          <ReportChart
            rows={d.series}
            labelKey="label"
            series={[{ key: "visits", label: "الزيارات" }]}
            defaultType="bar"
            types={["bar", "line", "area"]}
            height={220}
            storageKey="nurse-dash"
            emptyText="لا توجد زيارات في آخر أسبوعين"
          />
        </SectionCard>
        <SectionCard
          title="أحدث الزيارات"
          className="xl:col-span-3"
          actions={
            <Link
              to="/app/health"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Home className="size-3.5" />
              كل الزيارات
            </Link>
          }
        >
          <VisitsTable visits={d.recent} />
        </SectionCard>
      </div>
    </div>
  );
}

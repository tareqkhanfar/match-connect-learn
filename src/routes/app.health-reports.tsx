import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HeartPulse, Stethoscope, TriangleAlert } from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState, LoadingRow } from "@/components/shared/states";
import { ReportChart } from "@/components/reports/report-chart";
import {
  CountBlock,
  Num,
  ReportBlock,
  ReportFilterBar,
  ReportTabs,
  Segmented,
  StatGrid,
  StatTile,
  TableFrame,
} from "@/components/reports/report-kit";
import { TD, TH, pctText } from "@/components/reports/report-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VisitsTable } from "@/components/reports/visits-table";
import {
  useHealthOptions,
  useRecordsReport,
  useStudentVisits,
  useVisitsReport,
  type ReportFilters,
  type VisitBucket,
} from "@/lib/api/reports";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/health-reports")({
  head: () => ({
    meta: [
      { title: "تقارير التمريض — Match Education" },
      {
        name: "description",
        content:
          "زيارات العيادة حسب اليوم والأسبوع والشهر، والأسباب والنتائج، والطلاب الأكثر زيارة، والحالات المزمنة.",
      },
    ],
  }),
  component: HealthReportsPage,
});

type Tab = "visits" | "records";

const TABS = [
  { key: "visits", label: "زيارات العيادة", icon: Stethoscope },
  { key: "records", label: "السجل الصحي والحالات", icon: HeartPulse },
] as const;

function HealthReportsPage() {
  const options = useHealthOptions();
  const [tab, setTab] = useState<Tab>("visits");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [bucket, setBucket] = useState<VisitBucket | "auto">("auto");

  if (options.isLoading) return <DashboardSkeleton />;
  if (options.error) return <ErrorState error={options.error} onRetry={() => options.refetch()} />;
  const o = options.data;

  return (
    <>
      <PageHeader
        title="تقارير التمريض"
        subtitle="زيارات العيادة والحالات الصحية التي تحتاج متابعة"
        actions={
          <Link
            to="/app/health"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-secondary"
          >
            <HeartPulse className="size-4" />
            <span className="hidden sm:inline">الصحة والعيادة</span>
          </Link>
        }
      />
      <ReportTabs tabs={TABS} value={tab} onChange={setTab} />
      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        defaults={o ? { dateFrom: o.dateFrom, dateTo: o.dateTo } : undefined}
        programs={o?.programs ?? []}
        sections={o?.sections ?? []}
        showDates={tab === "visits"}
        extra={
          tab === "visits" ? (
            <Segmented
              label="التجميع"
              options={[
                { key: "auto", label: "تلقائي" },
                { key: "day", label: "يومي" },
                { key: "week", label: "أسبوعي" },
                { key: "month", label: "شهري" },
              ]}
              value={bucket}
              onChange={setBucket}
            />
          ) : null
        }
      />
      {tab === "visits" ? (
        <VisitsTab filters={filters} bucket={bucket} />
      ) : (
        <RecordsTab
          filters={{
            ...(filters.program ? { program: filters.program } : {}),
            ...(filters.student_group ? { student_group: filters.student_group } : {}),
          }}
        />
      )}
    </>
  );
}

const BUCKET_LABEL: Record<VisitBucket, string> = { day: "يوم", week: "أسبوع", month: "شهر" };

function VisitsTab({ filters, bucket }: { filters: ReportFilters; bucket: VisitBucket | "auto" }) {
  const q = useVisitsReport({ ...filters, ...(bucket !== "auto" ? { bucket } : {}) });
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  if (!q.data) {
    if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
    return <DashboardSkeleton />;
  }
  const d = q.data;
  const s = d.summary;

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatTile
          label="الزيارات"
          value={s.visits}
          hint={`${s.avgPerDay} في اليوم الدراسي`}
          tone="info"
        />
        <StatTile
          label="طلاب زاروا العيادة"
          value={s.students}
          hint={`${s.repeatVisitors} زاروها 3 مرات فأكثر`}
        />
        <StatTile
          label="أُرسلوا للمنزل"
          value={s.sentHome}
          tone={s.sentHome ? "warn" : "neutral"}
          hint={`حُوّل للمستشفى: ${s.referred}`}
        />
        <StatTile
          label="عادوا للصف"
          value={s.returned}
          tone="good"
          hint={`استراحة في العيادة: ${s.rested}`}
        />
        <StatTile
          label="إبلاغ ولي الأمر"
          value={pctText(s.parentNotifiedPct)}
          hint={`اليوم: ${s.today} · هذا الأسبوع: ${s.thisWeek}`}
        />
      </StatGrid>

      {s.visits === 0 ? (
        <EmptyBlock
          title="لا توجد زيارات في هذه الفترة"
          description="غيّر الفترة أو الصف من شريط التصفية."
          icon={<Stethoscope className="size-6" />}
        />
      ) : (
        <>
          <ReportBlock
            title={`الزيارات حسب ${BUCKET_LABEL[d.bucket]}`}
            description="عدد الزيارات، ومنها من أُرسل إلى المنزل."
          >
            <ReportChart
              rows={d.series}
              labelKey="label"
              series={[
                { key: "visits", label: "الزيارات" },
                { key: "sentHome", label: "أُرسل للمنزل" },
              ]}
              defaultType={d.series.length > 14 ? "area" : "bar"}
              types={["bar", "line", "area", "stacked", "hbar"]}
              maxCategories={120}
              storageKey="health-series"
            />
            <TableFrame>
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>{BUCKET_LABEL[d.bucket]}</th>
                  <th className={TH}>الزيارات</th>
                  <th className={TH}>أُرسل للمنزل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.series
                  .filter((r) => r.visits > 0)
                  .map((r) => (
                    <tr key={r.key}>
                      <td className={cn(TD, "num")}>{d.bucket === "month" ? r.label : r.key}</td>
                      <td className={TD}>
                        <Num value={r.visits} />
                      </td>
                      <td className={TD}>
                        <Num value={r.sentHome} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </TableFrame>
          </ReportBlock>

          <div className="grid gap-5 xl:grid-cols-2">
            <CountBlock
              title="نوع الزيارة"
              rows={d.byType}
              defaultType="donut"
              labelHeading="النوع"
              storageKey="health-type"
            />
            <CountBlock
              title="نتيجة الزيارة"
              rows={d.byOutcome}
              defaultType="pie"
              labelHeading="النتيجة"
              storageKey="health-outcome"
            />
          </div>

          <CountBlock
            title="الشكاوى الأكثر تكراراً"
            description="من حقل الشكوى؛ الشكوى التي تجمع أكثر من عرض تُحتسب لكل منها."
            rows={d.byComplaint}
            defaultType="hbar"
            labelHeading="الشكوى"
            storageKey="health-complaint"
          />

          <div className="grid gap-5 xl:grid-cols-2">
            <CountBlock
              title="حسب الصف"
              rows={d.byProgram}
              defaultType="bar"
              labelHeading="الصف"
              storageKey="health-program"
            />
            <CountBlock
              title="حسب الشعبة"
              rows={d.bySection}
              defaultType="hbar"
              labelHeading="الشعبة"
              storageKey="health-section"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <CountBlock
              title="حسب يوم الأسبوع"
              rows={d.byWeekday}
              defaultType="bar"
              labelHeading="اليوم"
              storageKey="health-weekday"
            />
            {d.byHour.length > 0 ? (
              <CountBlock
                title="حسب ساعة الزيارة"
                description="للزيارات المسجّل وقتها فقط."
                rows={d.byHour}
                defaultType="bar"
                labelHeading="الساعة"
                storageKey="health-hour"
              />
            ) : (
              <CountBlock
                title="حسب من استقبل الزيارة"
                rows={d.byAttendant}
                defaultType="donut"
                labelHeading="المستخدم"
                storageKey="health-attendant"
              />
            )}
          </div>

          <ReportBlock
            title="الطلاب الأكثر زيارة للعيادة"
            description="اضغط على اسم الطالب لعرض سجل زياراته."
            chart={
              <ReportChart
                rows={d.frequent.map((f) => ({
                  name: f.studentName,
                  visits: f.visits,
                  sentHome: f.sentHome,
                }))}
                labelKey="name"
                series={[
                  { key: "visits", label: "الزيارات" },
                  { key: "sentHome", label: "أُرسل للمنزل" },
                ]}
                defaultType="hbar"
                storageKey="health-frequent"
              />
            }
          >
            <TableFrame>
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>الطالب</th>
                  <th className={TH}>الشعبة</th>
                  <th className={TH}>الزيارات</th>
                  <th className={TH}>أُرسل للمنزل</th>
                  <th className={TH}>أكثر شكوى</th>
                  <th className={TH}>آخر زيارة</th>
                  <th className={TH}>حالة صحية مسجّلة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.frequent.map((f) => (
                  <tr key={f.student}>
                    <td className={TD}>
                      <button
                        type="button"
                        onClick={() => setStudent({ id: f.student, name: f.studentName })}
                        className="text-start font-medium text-primary hover:underline"
                      >
                        {f.studentName}
                      </button>
                    </td>
                    <td className={TD}>{f.section}</td>
                    <td className={cn(TD, "font-bold")}>
                      <Num value={f.visits} />
                    </td>
                    <td className={TD}>
                      <Num value={f.sentHome} />
                    </td>
                    <td className={cn(TD, "text-xs")}>{f.topComplaint || "—"}</td>
                    <td className={cn(TD, "num text-xs text-muted-foreground")}>{f.lastVisit}</td>
                    <td className={TD}>
                      {f.chronic ? (
                        <Pill tone="warning">نعم</Pill>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
          </ReportBlock>

          <ReportBlock title="أحدث الزيارات في الفترة">
            <VisitsTable visits={d.recent} />
          </ReportBlock>
        </>
      )}

      <Dialog open={!!student} onOpenChange={(open) => !open && setStudent(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>زيارات {student?.name}</DialogTitle>
          </DialogHeader>
          {student && <StudentHistory student={student.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentHistory({ student }: { student: string }) {
  const q = useStudentVisits(student);
  if (q.isLoading) return <LoadingRow />;
  if (q.error) return <ErrorState error={q.error} />;
  return <VisitsTable visits={q.data?.visits ?? []} showStudent={false} />;
}

function RecordsTab({ filters }: { filters: ReportFilters }) {
  const q = useRecordsReport(filters);
  const [search, setSearch] = useState("");
  if (!q.data) {
    if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
    return <DashboardSkeleton />;
  }
  const d = q.data;
  const s = d.summary;
  const term = search.trim();
  const cases = term
    ? d.cases.filter((c) =>
        [c.studentName, c.section, c.conditions, c.allergies, c.medications].some((x) =>
          x.includes(term),
        ),
      )
    : d.cases;

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatTile
          label="طلاب لهم سجل صحي"
          value={`${s.withRecord} / ${s.students}`}
          hint={`التغطية ${pctText(s.coveragePct)}`}
          tone={(s.coveragePct ?? 0) >= 90 ? "good" : "warn"}
        />
        <StatTile label="أمراض مزمنة" value={s.chronic} tone={s.chronic ? "bad" : "neutral"} />
        <StatTile label="حساسية" value={s.allergies} tone={s.allergies ? "warn" : "neutral"} />
        <StatTile
          label="أدوية منتظمة"
          value={s.medications}
          hint={`احتياجات خاصة: ${s.specialNeeds}`}
        />
        <StatTile
          label="فحص دوري متأخر"
          value={s.overdue}
          tone={s.overdue ? "warn" : "good"}
          hint={`بلا رقم طوارئ: ${s.noEmergency}`}
        />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-2">
        <CountBlock
          title="الأمراض المزمنة"
          rows={d.conditions}
          defaultType="hbar"
          labelHeading="الحالة"
          valueLabel="الطلاب"
          storageKey="health-conditions"
        />
        <CountBlock
          title="الحساسية"
          rows={d.allergies}
          defaultType="hbar"
          labelHeading="الحساسية"
          valueLabel="الطلاب"
          storageKey="health-allergies"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <CountBlock
          title="الأدوية المنتظمة"
          rows={d.medications}
          defaultType="hbar"
          labelHeading="الدواء"
          valueLabel="الطلاب"
          storageKey="health-meds"
        />
        <CountBlock
          title="فصائل الدم"
          rows={d.bloodGroups}
          defaultType="donut"
          labelHeading="الفصيلة"
          valueLabel="الطلاب"
          storageKey="health-blood"
        />
      </div>

      <ReportBlock
        title="الحالات حسب الصف"
        description="عدد الطلاب في كل صف ممن لديهم مرض مزمن أو حساسية أو دواء منتظم."
      >
        <ReportChart
          rows={d.byProgram}
          labelKey="label"
          series={[
            { key: "chronic", label: "مرض مزمن" },
            { key: "allergies", label: "حساسية" },
            { key: "medications", label: "دواء منتظم" },
          ]}
          defaultType="bar"
          storageKey="health-cases-program"
        />
        <TableFrame>
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>الصف</th>
              <th className={TH}>مرض مزمن</th>
              <th className={TH}>حساسية</th>
              <th className={TH}>دواء منتظم</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {d.byProgram.map((g) => (
              <tr key={g.label}>
                <td className={cn(TD, "font-medium")}>{g.label}</td>
                <td className={TD}>
                  <Num value={g.chronic} />
                </td>
                <td className={TD}>
                  <Num value={g.allergies} />
                </td>
                <td className={TD}>
                  <Num value={g.medications} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </ReportBlock>

      <ReportBlock
        title="قائمة الحالات التي تحتاج متابعة"
        description="كل طالب لديه مرض مزمن أو حساسية أو دواء منتظم أو احتياج خاص."
        actions={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الحالة…"
            className="h-9 w-56 max-w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        }
      >
        {cases.length === 0 ? (
          <EmptyBlock title="لا توجد حالات" icon={<TriangleAlert className="size-6" />} />
        ) : (
          <TableFrame>
            <thead>
              <tr className="border-b border-border">
                <th className={TH}>الطالب</th>
                <th className={TH}>الشعبة</th>
                <th className={TH}>فصيلة الدم</th>
                <th className={TH}>مرض مزمن</th>
                <th className={TH}>حساسية</th>
                <th className={TH}>دواء منتظم</th>
                <th className={TH}>احتياج خاص</th>
                <th className={TH}>آخر فحص</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cases.map((c) => (
                <tr key={c.student}>
                  <td className={cn(TD, "font-medium")}>{c.studentName}</td>
                  <td className={TD}>{c.section}</td>
                  <td className={cn(TD, "num")}>{c.bloodGroup || "—"}</td>
                  <td
                    className={cn(TD, "text-xs", c.conditions && "font-semibold text-destructive")}
                  >
                    {c.conditions || "—"}
                  </td>
                  <td
                    className={cn(
                      TD,
                      "text-xs",
                      c.allergies && "font-semibold text-warm-foreground",
                    )}
                  >
                    {c.allergies || "—"}
                  </td>
                  <td className={cn(TD, "text-xs")}>{c.medications || "—"}</td>
                  <td className={cn(TD, "text-xs")}>{c.specialNeeds || "—"}</td>
                  <td className={cn(TD, "num text-xs text-muted-foreground")}>
                    {c.lastCheckup ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </ReportBlock>
    </div>
  );
}

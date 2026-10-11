import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  BookCheck,
  ClipboardCheck,
  LayoutGrid,
  NotebookPen,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { ReportChart } from "@/components/reports/report-chart";
import {
  Num,
  PctCell,
  ReportBlock,
  ReportFilterBar,
  ReportTabs,
  Segmented,
  StatGrid,
  StatTile,
  TableFrame,
} from "@/components/reports/report-kit";
import { TD, TH, pctText, rateTone } from "@/components/reports/report-utils";
import {
  useAttendanceCompliance,
  useClassLogCompliance,
  useDutyCover,
  useLeadershipOptions,
  useMarksCompletion,
  useSectionOverview,
  useTeacherActivity,
  type ActivityRow,
  type MarksStatus,
  type ReportFilters,
  type SectionRow,
} from "@/lib/api/reports";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/leadership-reports")({
  head: () => ({
    meta: [
      { title: "تقارير القيادة — Match Education" },
      {
        name: "description",
        content:
          "متابعة المعلمين والشعب: إدخال العلامات، النشاط على النظام، المناوبات والإشغالات، الحضور وسجل الحصص.",
      },
    ],
  }),
  component: LeadershipReportsPage,
});

type Tab = "marks" | "activity" | "duty" | "attendance" | "logs" | "sections";

const TABS = [
  { key: "marks", label: "إدخال العلامات", icon: BookCheck },
  { key: "activity", label: "نشاط المعلمين", icon: Activity },
  { key: "duty", label: "المناوبات والإشغالات", icon: ShieldCheck },
  { key: "attendance", label: "أخذ الحضور", icon: ClipboardCheck },
  { key: "logs", label: "سجل الحصص والتحضير", icon: NotebookPen },
  { key: "sections", label: "نظرة على الشعب", icon: LayoutGrid },
] as const;

// Which filters each report can use; the bar shows only those.
const USES: Record<Tab, { teacher: boolean; section: boolean; dates: boolean }> = {
  marks: { teacher: true, section: true, dates: false },
  activity: { teacher: true, section: false, dates: true },
  duty: { teacher: true, section: false, dates: true },
  attendance: { teacher: false, section: true, dates: true },
  logs: { teacher: true, section: true, dates: true },
  sections: { teacher: false, section: true, dates: true },
};

function LeadershipReportsPage() {
  const options = useLeadershipOptions();
  const [tab, setTab] = useState<Tab>("marks");
  const [filters, setFilters] = useState<ReportFilters>({});

  if (options.isLoading) return <DashboardSkeleton />;
  if (options.error) return <ErrorState error={options.error} onRetry={() => options.refetch()} />;
  const o = options.data;
  const uses = USES[tab];

  // A filter the report cannot use is dropped rather than silently ignored.
  const applied: ReportFilters = { ...filters };
  if (!uses.teacher) delete applied.teacher;
  if (!uses.section) {
    delete applied.student_group;
    delete applied.program;
  }

  return (
    <>
      <PageHeader
        title="تقارير القيادة"
        subtitle={
          o
            ? `${o.academicTerm ?? o.academicYear ?? ""} — من ${filters.date_from ?? o.dateFrom} إلى ${filters.date_to ?? o.dateTo}`
            : "متابعة المعلمين والشعب"
        }
      />
      <ReportTabs tabs={TABS} value={tab} onChange={setTab} />
      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        defaults={o ? { dateFrom: o.dateFrom, dateTo: o.dateTo } : undefined}
        programs={uses.section ? (o?.programs ?? []) : []}
        sections={o?.sections ?? []}
        teachers={o?.teachers}
        showTeacher={uses.teacher}
        showSection={uses.section}
        showDates={uses.dates}
      />

      {tab === "marks" && <MarksTab filters={applied} />}
      {tab === "activity" && <ActivityTab filters={applied} />}
      {tab === "duty" && <DutyTab filters={applied} />}
      {tab === "attendance" && <AttendanceTab filters={applied} />}
      {tab === "logs" && <LogsTab filters={applied} />}
      {tab === "sections" && <SectionsTab filters={applied} />}
    </>
  );
}

function Loading({ q }: { q: { isLoading: boolean; error: unknown; refetch: () => unknown } }) {
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <DashboardSkeleton />;
}

// --- 1. Marks -------------------------------------------------------------------------

const STATUS: Record<
  MarksStatus,
  { label: string; tone: "danger" | "warning" | "success" | "muted" }
> = {
  none: { label: "لم يُدخل", tone: "danger" },
  partial: { label: "جزئي", tone: "warning" },
  complete: { label: "مكتمل", tone: "success" },
  noPlan: { label: "بلا خطة تقييم", tone: "muted" },
};

function MarksTab({ filters }: { filters: ReportFilters }) {
  const q = useMarksCompletion(filters);
  const [onlyMissing, setOnlyMissing] = useState(true);
  if (!q.data) return <Loading q={q} />;
  const { summary: s, teachers, rows } = q.data;

  if (rows.length === 0)
    return (
      <EmptyBlock
        title="لا توجد شعب ومواد مسندة لمعلمين في هذه الفترة"
        description="يُقرأ إسناد المواد من الجدول الأسبوعي وحصص الفصل."
      />
    );

  const none = teachers.filter((t) => t.state === "none");
  const detail = onlyMissing ? rows.filter((r) => r.status !== "complete") : rows;
  const chartRows = teachers.map((t) => ({
    name: t.teacherName,
    entered: t.entered,
    missing: t.missing,
    pct: t.pct,
  }));

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatTile
          label="نسبة إدخال العلامات"
          value={pctText(s.pct)}
          tone={rateTone(s.pct)}
          hint={`حتى ${q.data.asOf}`}
        />
        <StatTile
          label="معلمون لم يُدخلوا أي علامة"
          value={s.teachersNoMarks}
          tone={s.teachersNoMarks ? "bad" : "good"}
          hint={`من ${s.teachers} معلماً`}
        />
        <StatTile
          label="معلمون لديهم نواقص"
          value={s.teachersWithMissing}
          tone={s.teachersWithMissing ? "warn" : "good"}
        />
        <StatTile
          label="علامات ناقصة"
          value={s.missing}
          tone={s.missing ? "warn" : "good"}
          hint={`من ${s.expected} مطلوبة`}
        />
        <StatTile
          label="مواد بلا أي علامة"
          value={`${s.pairsNone} / ${s.pairs}`}
          tone={s.pairsNone ? "bad" : "good"}
          hint="شعبة × مادة"
        />
      </StatGrid>

      {none.length > 0 && (
        <ReportBlock
          title="لم يُدخلوا علاماتهم بعد"
          description="معلمون لا توجد لهم أي علامة في أي من الشعب والمواد التي يدرّسونها هذا الفصل."
        >
          <ul className="grid gap-2 md:grid-cols-2">
            {none.map((t) => (
              <li
                key={t.teacher}
                className="rounded-xl border border-destructive/25 bg-destructive-soft/30 p-3"
              >
                <div className="flex items-center gap-2">
                  <UserX className="size-4 shrink-0 text-destructive" />
                  <p className="truncate text-sm font-bold">{t.teacherName}</p>
                  <span className="num ms-auto text-xs text-muted-foreground">{t.pairs} مادة</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.notEntered.map((p) => (
                    <Pill key={p}>{p}</Pill>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </ReportBlock>
      )}

      <ReportBlock
        title="الإدخال حسب المعلم"
        description="العلامات المطلوبة = عدد الطلاب × بنود خطة التقييم المستحقة (دون البنود الإضافية والأرباع التي لم تبدأ)."
        chart={
          <ReportChart
            rows={chartRows}
            labelKey="name"
            series={[
              { key: "entered", label: "مُدخلة" },
              { key: "missing", label: "ناقصة" },
            ]}
            defaultType="stacked"
            storageKey="lead-marks"
          />
        }
      >
        <TableFrame>
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>المعلم</th>
              <th className={TH}>شعبة × مادة</th>
              <th className={TH}>بلا علامات</th>
              <th className={TH}>مكتملة</th>
              <th className={TH}>نسبة الإدخال</th>
              <th className={TH}>الناقص</th>
              <th className={TH}>آخر إدخال</th>
              <th className={TH}>الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {teachers.map((t) => (
              <tr key={t.teacher}>
                <td className={cn(TD, "font-medium")}>{t.teacherName}</td>
                <td className={TD}>
                  <Num value={t.pairs} />
                </td>
                <td className={TD}>
                  <span className={cn("num", t.pairsNone && "font-bold text-destructive")}>
                    {t.pairsNone}
                  </span>
                </td>
                <td className={TD}>
                  <Num value={t.pairsComplete} />
                </td>
                <td className={TD}>
                  <PctCell pct={t.pct} />
                </td>
                <td className={TD}>
                  <Num value={t.missing} />
                </td>
                <td className={cn(TD, "num text-xs text-muted-foreground")}>
                  {t.lastEntry ?? "—"}
                </td>
                <td className={TD}>
                  <Pill tone={STATUS[t.state].tone}>{STATUS[t.state].label}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </ReportBlock>

      <ReportBlock
        title="التفصيل حسب الشعبة والمادة"
        description="الأعمدة الناقصة: بنود الخطة التي لم تكتمل علاماتها لكل طلاب الشعبة."
        actions={
          <Segmented
            options={[
              { key: "missing", label: "غير المكتمل فقط" },
              { key: "all", label: "الكل" },
            ]}
            value={onlyMissing ? "missing" : "all"}
            onChange={(k) => setOnlyMissing(k === "missing")}
          />
        }
      >
        {detail.length === 0 ? (
          <EmptyBlock title="كل العلامات المطلوبة مُدخلة" />
        ) : (
          <TableFrame>
            <thead>
              <tr className="border-b border-border">
                <th className={TH}>المعلم</th>
                <th className={TH}>الشعبة</th>
                <th className={TH}>المادة</th>
                <th className={TH}>الطلاب</th>
                <th className={TH}>خطة التقييم</th>
                <th className={TH}>بنود مستحقة</th>
                <th className={TH}>بنود مكتملة</th>
                <th className={TH}>النسبة</th>
                <th className={TH}>الناقص</th>
                <th className={TH}>الأعمدة الناقصة</th>
                <th className={TH}>آخر إدخال</th>
                <th className={TH}>الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {detail.map((r) => (
                <tr key={`${r.teacher}|${r.section}|${r.course}`}>
                  <td className={cn(TD, "font-medium")}>{r.teacherName}</td>
                  <td className={TD}>{r.sectionLabel}</td>
                  <td className={TD}>{r.course}</td>
                  <td className={TD}>
                    <Num value={r.students} />
                  </td>
                  <td className={cn(TD, "text-xs")}>
                    {r.plan ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={TD}>
                    <Num value={r.components} />
                  </td>
                  <td className={TD}>
                    <Num value={r.columnsDone} />
                  </td>
                  <td className={TD}>
                    <PctCell pct={r.plan ? r.pct : null} />
                  </td>
                  <td className={TD}>
                    <Num value={r.missing} />
                  </td>
                  <td className={cn(TD, "max-w-[16rem] text-xs text-muted-foreground")}>
                    {r.missingColumns.join("، ") || "—"}
                  </td>
                  <td className={cn(TD, "num text-xs text-muted-foreground")}>
                    {r.lastEntry ?? "—"}
                  </td>
                  <td className={TD}>
                    <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
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

// --- 2. Activity ----------------------------------------------------------------------

const ACTIVITY_METRICS = [
  { key: "total", label: "المجموع" },
  { key: "activeDays", label: "أيام النشاط" },
  { key: "attendanceSessions", label: "الحضور" },
  { key: "classLogs", label: "سجل الحصص" },
  { key: "lessonPlans", label: "التحضير" },
  { key: "marks", label: "العلامات" },
  { key: "assignments", label: "الواجبات" },
  { key: "behaviour", label: "السلوك" },
  { key: "messages", label: "الرسائل" },
] as const satisfies ReadonlyArray<{ key: keyof ActivityRow; label: string }>;

type ActivityMetric = (typeof ACTIVITY_METRICS)[number]["key"];

const ACTIVITY_STATE = {
  active: { label: "نشط", tone: "success" },
  inactive: { label: "بلا نشاط", tone: "danger" },
  noAccount: { label: "بلا حساب", tone: "muted" },
} as const;

function ActivityTab({ filters }: { filters: ReportFilters }) {
  const q = useTeacherActivity(filters);
  const [metric, setMetric] = useState<ActivityMetric>("total");
  if (!q.data) return <Loading q={q} />;
  const { summary: s, rows, daily } = q.data;
  const label = ACTIVITY_METRICS.find((m) => m.key === metric)?.label ?? "";
  const chartRows = [...rows]
    .sort((a, b) => b[metric] - a[metric])
    .map((r) => ({ name: r.teacherName, value: r[metric] }));

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatTile
          label="معلمون نشطون"
          value={`${s.active} / ${s.teachers}`}
          tone="good"
          hint="لهم عمل مسجّل في الفترة"
        />
        <StatTile label="بلا أي نشاط" value={s.inactive} tone={s.inactive ? "bad" : "good"} />
        <StatTile
          label="بلا حساب دخول"
          value={s.noAccount}
          tone={s.noAccount ? "warn" : "neutral"}
        />
        <StatTile
          label="لم يسجّلوا الدخول قط"
          value={s.neverLoggedIn}
          tone={s.neverLoggedIn ? "warn" : "neutral"}
        />
        <StatTile label="أيام دراسية في الفترة" value={s.schoolDays} />
      </StatGrid>

      <ReportBlock
        title="النشاط حسب المعلم"
        description="يُحسب من الأعمال المسجّلة: كشف حضور (شعبة في يوم)، سجل حصة، تحضير درس، علامة، واجب، ملاحظة سلوك، رسالة."
        chart={
          <ReportChart
            rows={chartRows}
            labelKey="name"
            series={[{ key: "value", label }]}
            defaultType="hbar"
            storageKey="lead-activity"
            caption={
              <Segmented
                options={ACTIVITY_METRICS}
                value={metric}
                onChange={setMetric}
                label="المقياس"
              />
            }
          />
        }
      >
        <TableFrame>
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>المعلم</th>
              <th className={TH}>آخر دخول</th>
              <th className={TH}>آخر نشاط</th>
              <th className={TH}>أيام النشاط</th>
              <th className={TH}>كشوف الحضور</th>
              <th className={TH}>سجل الحصص</th>
              <th className={TH}>التحضير</th>
              <th className={TH}>العلامات</th>
              <th className={TH}>الواجبات</th>
              <th className={TH}>السلوك</th>
              <th className={TH}>الرسائل</th>
              <th className={TH}>التقييمات الدورية</th>
              <th className={TH}>المجموع</th>
              <th className={TH}>الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.teacher}>
                <td className={cn(TD, "font-medium")}>{r.teacherName}</td>
                <td className={cn(TD, "num text-xs text-muted-foreground")}>
                  {r.lastLogin ?? "—"}
                </td>
                <td className={cn(TD, "num text-xs text-muted-foreground")}>
                  {r.lastActive ?? "—"}
                </td>
                <td className={TD}>
                  <Num value={r.activeDays} />
                </td>
                <td className={TD}>
                  <Num value={r.attendanceSessions} />
                </td>
                <td className={TD}>
                  <Num value={r.classLogs} />
                </td>
                <td className={TD}>
                  <Num value={r.lessonPlans} />
                </td>
                <td className={TD}>
                  <Num value={r.marks} />
                </td>
                <td className={TD}>
                  <Num value={r.assignments} />
                </td>
                <td className={TD}>
                  <Num value={r.behaviour} />
                </td>
                <td className={TD}>
                  <Num value={r.messages} />
                </td>
                <td className={TD}>
                  <Num value={r.evaluations} />
                </td>
                <td className={cn(TD, "font-bold")}>
                  <Num value={r.total} />
                </td>
                <td className={TD}>
                  <Pill tone={ACTIVITY_STATE[r.state].tone}>{ACTIVITY_STATE[r.state].label}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </ReportBlock>

      <ReportBlock title="النشاط اليومي" description="مجموع أعمال المعلمين في كل يوم دراسي.">
        <ReportChart
          rows={daily}
          labelKey="label"
          series={[{ key: "actions", label: "الأعمال" }]}
          defaultType="area"
          types={["line", "area", "bar"]}
          maxCategories={400}
          storageKey="lead-activity-daily"
        />
      </ReportBlock>
    </div>
  );
}

// --- 3. Duty and cover ------------------------------------------------------------------

function DutyTab({ filters }: { filters: ReportFilters }) {
  const q = useDutyCover(filters);
  if (!q.data) return <Loading q={q} />;
  const { summary: s, rows, byReason, daily, unmatchedDuties } = q.data;
  const chartRows = rows.map((r) => ({
    name: r.teacherName,
    weeklyLessons: r.weeklyLessons,
    weeklyDuties: r.weeklyDuties,
    covers: r.covers,
  }));

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatTile label="حصص إشغال (نيابة)" value={s.covers} tone="info" hint="في الفترة المحددة" />
        <StatTile label="تبديل حصص" value={s.swaps} />
        <StatTile
          label="مناوبات أسبوعية"
          value={s.weeklyDuties}
          hint="من برامج المناوبة الفعّالة"
        />
        <StatTile label="متوسط الحصص الأسبوعية" value={s.avgWeeklyLessons} hint="لمن له حصص" />
        <StatTile
          label="معلمون بلا مناوبة"
          value={s.teachersWithoutDuty}
          tone={s.teachersWithoutDuty ? "warn" : "good"}
        />
      </StatGrid>

      <ReportBlock
        title="العبء حسب المعلم"
        description="الحصص والمناوبات من الجدول الأسبوعي وبرامج المناوبة؛ الإشغالات من الحصص المسجّلة بمعلم بديل خلال الفترة."
        chart={
          <ReportChart
            rows={chartRows}
            labelKey="name"
            series={[
              { key: "weeklyLessons", label: "حصص أسبوعية" },
              { key: "weeklyDuties", label: "مناوبات أسبوعية" },
              { key: "covers", label: "إشغالات في الفترة" },
            ]}
            defaultType="stacked"
            storageKey="lead-duty"
          />
        }
      >
        <TableFrame>
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>المعلم</th>
              <th className={TH}>حصص أسبوعية</th>
              <th className={TH}>الشعب</th>
              <th className={TH}>المواد</th>
              <th className={TH}>مناوبات أسبوعية</th>
              <th className={TH}>أماكن المناوبة</th>
              <th className={TH}>العبء الأسبوعي</th>
              <th className={TH}>إشغالات (غطّى)</th>
              <th className={TH}>غُطّي عنه</th>
              <th className={TH}>تبديل</th>
              <th className={TH}>حصص الفترة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.teacher}>
                <td className={cn(TD, "font-medium")}>{r.teacherName}</td>
                <td className={TD}>
                  <Num value={r.weeklyLessons} />
                </td>
                <td className={TD}>
                  <Num value={r.sections} />
                </td>
                <td className={TD}>
                  <Num value={r.subjects} />
                </td>
                <td className={TD}>
                  <Num value={r.weeklyDuties} />
                </td>
                <td className={cn(TD, "max-w-[14rem] text-xs text-muted-foreground")}>
                  {r.dutyPlaces.join("، ") || "—"}
                </td>
                <td className={cn(TD, "font-bold")}>
                  <Num value={r.weeklyTotal} />
                </td>
                <td className={TD}>
                  <Num value={r.covers} />
                </td>
                <td className={TD}>
                  <Num value={r.coveredFor} />
                </td>
                <td className={TD}>
                  <Num value={r.swaps} />
                </td>
                <td className={TD}>
                  <Num value={r.scheduledLessons} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
        {unmatchedDuties.length > 0 && (
          <p className="text-xs text-muted-foreground">
            أسماء في برامج المناوبة لا تطابق معلماً مسجّلاً:{" "}
            {unmatchedDuties.map((u) => `${u.name} (${u.count})`).join("، ")}
          </p>
        )}
      </ReportBlock>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportBlock title="أسباب الإشغال" description="سبب غياب المعلم الأصلي في الحصص المغطّاة.">
          <ReportChart
            rows={byReason}
            labelKey="label"
            series={[{ key: "count", label: "الحصص" }]}
            defaultType="donut"
            height={260}
            storageKey="lead-duty-reasons"
          />
        </ReportBlock>
        <ReportBlock title="الإشغالات يوماً بيوم">
          <ReportChart
            rows={daily}
            labelKey="label"
            series={[{ key: "covers", label: "الإشغالات" }]}
            defaultType="bar"
            types={["bar", "line", "area"]}
            height={260}
            maxCategories={400}
            storageKey="lead-duty-daily"
          />
        </ReportBlock>
      </div>
    </div>
  );
}

// --- 4. Attendance taking ---------------------------------------------------------------

function AttendanceTab({ filters }: { filters: ReportFilters }) {
  const q = useAttendanceCompliance(filters);
  const [view, setView] = useState<"pct" | "counts">("pct");
  if (!q.data) return <Loading q={q} />;
  const { summary: s, rows, daily } = q.data;
  if (rows.length === 0) return <EmptyBlock title="لا توجد شعب فيها طلاب ضمن هذا الاختيار" />;
  const chartRows = rows.map((r) => ({
    name: r.sectionLabel,
    pct: r.pct ?? 0,
    taken: r.taken,
    missing: r.missing,
  }));

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatTile
          label="نسبة الالتزام بأخذ الحضور"
          value={pctText(s.pct)}
          tone={rateTone(s.pct, 95, 75)}
        />
        <StatTile label="أيام دراسية" value={s.schoolDays} hint="دون العطل والإجازات الأسبوعية" />
        <StatTile
          label="كشوف لم تُؤخذ"
          value={s.missing}
          tone={s.missing ? "bad" : "good"}
          hint="شعبة × يوم"
        />
        <StatTile
          label="شعب بلا أي كشف"
          value={s.sectionsNever}
          tone={s.sectionsNever ? "bad" : "good"}
        />
        <StatTile
          label="شعب ملتزمة كلياً"
          value={`${s.sectionsComplete} / ${s.sections}`}
          tone="good"
        />
      </StatGrid>

      <ReportBlock
        title="الالتزام حسب الشعبة"
        description="يُعدّ الحضور مأخوذاً في يوم إذا سُجّل فيه حضور أو غياب لأي طالب في الشعبة."
        chart={
          <ReportChart
            rows={chartRows}
            labelKey="name"
            series={
              view === "pct"
                ? [{ key: "pct", label: "نسبة الالتزام" }]
                : [
                    { key: "taken", label: "أيام أُخذ فيها" },
                    { key: "missing", label: "أيام لم يؤخذ" },
                  ]
            }
            defaultType={view === "pct" ? "hbar" : "stacked"}
            valueSuffix={view === "pct" ? "%" : ""}
            {...(view === "pct" ? { domainMax: 100 } : {})}
            storageKey={`lead-att-${view}`}
            caption={
              <Segmented
                options={[
                  { key: "pct", label: "النسبة" },
                  { key: "counts", label: "الأيام" },
                ]}
                value={view}
                onChange={setView}
              />
            }
          />
        }
      >
        <TableFrame>
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>الشعبة</th>
              <th className={TH}>الصف</th>
              <th className={TH}>المربي</th>
              <th className={TH}>الطلاب</th>
              <th className={TH}>أيام دراسية</th>
              <th className={TH}>أُخذ</th>
              <th className={TH}>لم يؤخذ</th>
              <th className={TH}>النسبة</th>
              <th className={TH}>آخر كشف</th>
              <th className={TH}>آخر الأيام الناقصة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.section}>
                <td className={cn(TD, "font-medium")}>{r.sectionLabel}</td>
                <td className={TD}>{r.program}</td>
                <td className={cn(TD, "text-xs")}>{r.homeroom || "—"}</td>
                <td className={TD}>
                  <Num value={r.students} />
                </td>
                <td className={TD}>
                  <Num value={r.schoolDays} />
                </td>
                <td className={TD}>
                  <Num value={r.taken} />
                </td>
                <td className={TD}>
                  <span className={cn("num", r.missing && "font-bold text-destructive")}>
                    {r.missing}
                  </span>
                </td>
                <td className={TD}>
                  <PctCell pct={r.pct} good={95} fair={75} />
                </td>
                <td className={cn(TD, "num text-xs text-muted-foreground")}>
                  {r.lastTaken ?? "—"}
                </td>
                <td
                  className={cn(TD, "num max-w-[16rem] text-xs text-muted-foreground")}
                  title={r.missingDates.join("، ")}
                >
                  {r.missingDates.slice(-4).reverse().join("، ") || "—"}
                  {r.missingDates.length > 4 ? " …" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </ReportBlock>

      <ReportBlock
        title="الالتزام يوماً بيوم"
        description="عدد الشعب التي أُخذ لها الحضور في كل يوم دراسي."
      >
        <ReportChart
          rows={daily}
          labelKey="label"
          series={[
            { key: "taken", label: "شعب أُخذ حضورها" },
            { key: "missing", label: "شعب لم يؤخذ حضورها" },
          ]}
          defaultType="area"
          types={["area", "line", "bar", "stacked"]}
          maxCategories={400}
          storageKey="lead-att-daily"
        />
      </ReportBlock>
    </div>
  );
}

// --- 5. Lesson logs and preparation ------------------------------------------------------

function LogsTab({ filters }: { filters: ReportFilters }) {
  const q = useClassLogCompliance(filters);
  if (!q.data) return <Loading q={q} />;
  const { summary: s, rows, daily, source } = q.data;
  if (rows.length === 0)
    return (
      <EmptyBlock
        title="لا توجد حصص في هذه الفترة"
        description="تُقرأ الحصص من حصص الفصل المولّدة، أو من الجدول الأسبوعي إن لم تُولَّد."
      />
    );
  const chartRows = rows.map((r) => ({
    name: r.teacherName,
    logPct: r.logPct ?? 0,
    planPct: r.planPct ?? 0,
  }));

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatTile
          label="حصص في الفترة"
          value={s.lessons}
          hint={source === "timetable" ? "محسوبة من الجدول الأسبوعي" : "من حصص الفصل"}
        />
        <StatTile
          label="نسبة توثيق الحصص"
          value={pctText(s.logPct)}
          tone={rateTone(s.logPct, 85, 50)}
          hint={`${s.missingLogs} حصة بلا سجل`}
        />
        <StatTile
          label="نسبة تحضير الدروس"
          value={pctText(s.planPct)}
          tone={rateTone(s.planPct, 85, 50)}
          hint={`${s.missingPlans} حصة بلا تحضير`}
        />
        <StatTile
          label="معلمون بلا أي سجل"
          value={s.teachersNoLogs}
          tone={s.teachersNoLogs ? "bad" : "good"}
        />
        <StatTile label="معلمون" value={s.teachers} />
      </StatGrid>

      <ReportBlock
        title="التوثيق والتحضير حسب المعلم"
        description="تُطابق الحصة بسجل أو تحضير لنفس الشعبة والمادة في اليوم نفسه؛ الحصة الملغاة لا تُحتسب، وحصة البديل تُحتسب على من غطّاها."
        chart={
          <ReportChart
            rows={chartRows}
            labelKey="name"
            series={[
              { key: "logPct", label: "توثيق الحصص" },
              { key: "planPct", label: "تحضير الدروس" },
            ]}
            defaultType="bar"
            valueSuffix="%"
            domainMax={100}
            storageKey="lead-logs"
          />
        }
      >
        <TableFrame>
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>المعلم</th>
              <th className={TH}>الحصص</th>
              <th className={TH}>موثّقة</th>
              <th className={TH}>بلا سجل</th>
              <th className={TH}>نسبة التوثيق</th>
              <th className={TH}>محضّرة</th>
              <th className={TH}>بلا تحضير</th>
              <th className={TH}>نسبة التحضير</th>
              <th className={TH}>آخر سجل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.teacher}>
                <td className={cn(TD, "font-medium")}>{r.teacherName}</td>
                <td className={TD}>
                  <Num value={r.lessons} />
                </td>
                <td className={TD}>
                  <Num value={r.logged} />
                </td>
                <td className={TD}>
                  <Num value={r.missingLogs} />
                </td>
                <td className={TD}>
                  <PctCell pct={r.logPct} good={85} fair={50} />
                </td>
                <td className={TD}>
                  <Num value={r.planned} />
                </td>
                <td className={TD}>
                  <Num value={r.missingPlans} />
                </td>
                <td className={TD}>
                  <PctCell pct={r.planPct} good={85} fair={50} />
                </td>
                <td className={cn(TD, "num text-xs text-muted-foreground")}>{r.lastLog ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </ReportBlock>

      <ReportBlock title="يوماً بيوم">
        <ReportChart
          rows={daily}
          labelKey="label"
          series={[
            { key: "lessons", label: "الحصص" },
            { key: "logged", label: "الموثّقة" },
            { key: "planned", label: "المحضّرة" },
          ]}
          defaultType="line"
          types={["line", "area", "bar"]}
          maxCategories={400}
          storageKey="lead-logs-daily"
        />
      </ReportBlock>
    </div>
  );
}

// --- 6. Sections ----------------------------------------------------------------------------

const SECTION_METRICS = [
  { key: "absenceRate", label: "نسبة الغياب", suffix: "%", max: 100 },
  { key: "negative", label: "سلوك سلبي", suffix: "", max: undefined },
  { key: "positive", label: "سلوك إيجابي", suffix: "", max: undefined },
  { key: "marksAverage", label: "معدل العلامات", suffix: "%", max: 100 },
  { key: "visits", label: "زيارات العيادة", suffix: "", max: undefined },
  { key: "exams", label: "الامتحانات", suffix: "", max: undefined },
  { key: "students", label: "الطلاب", suffix: "", max: undefined },
] as const satisfies ReadonlyArray<{
  key: keyof SectionRow;
  label: string;
  suffix: string;
  max: number | undefined;
}>;

type SectionMetric = (typeof SECTION_METRICS)[number]["key"];

function SectionsTab({ filters }: { filters: ReportFilters }) {
  const q = useSectionOverview(filters);
  const [metric, setMetric] = useState<SectionMetric>("absenceRate");
  const [by, setBy] = useState<"section" | "program">("section");
  const meta = SECTION_METRICS.find((m) => m.key === metric) ?? SECTION_METRICS[0];

  const chartRows = useMemo(() => {
    if (!q.data) return [];
    const source =
      by === "section"
        ? q.data.rows.map((r) => ({ name: r.sectionLabel, value: r[metric] ?? 0 }))
        : q.data.byProgram.map((g) => ({ name: g.program, value: g[metric] ?? 0 }));
    return [...source].sort((a, b) => Number(b.value) - Number(a.value));
  }, [q.data, metric, by]);

  if (!q.data) return <Loading q={q} />;
  const { summary: s, rows } = q.data;
  if (rows.length === 0) return <EmptyBlock title="لا توجد شعب ضمن هذا الاختيار" />;

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatTile label="الطلاب" value={s.students ?? 0} hint={`${s.sections} شعبة`} />
        <StatTile
          label="نسبة الغياب"
          value={pctText(s.absenceRate)}
          tone={(s.absenceRate ?? 0) > 10 ? "bad" : "good"}
        />
        <StatTile
          label="ملاحظات سلوك سلبية"
          value={s.negative ?? 0}
          tone={s.negative ? "warn" : "neutral"}
          hint={`إيجابية: ${s.positive ?? 0}`}
        />
        <StatTile
          label="معدل العلامات"
          value={pctText(s.marksAverage)}
          tone={rateTone(s.marksAverage, 75, 60)}
          hint="علامات الفصل حتى الآن"
        />
        <StatTile label="زيارات العيادة" value={s.visits ?? 0} hint={`امتحانات: ${s.exams ?? 0}`} />
      </StatGrid>

      <ReportBlock
        title="مقارنة الشعب"
        description="الغياب والسلوك والعيادة ضمن الفترة؛ معدل العلامات للفصل كله."
        chart={
          <ReportChart
            rows={chartRows}
            labelKey="name"
            series={[{ key: "value", label: meta.label }]}
            defaultType="bar"
            valueSuffix={meta.suffix}
            {...(meta.max ? { domainMax: meta.max } : {})}
            storageKey="lead-sections"
            caption={
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  options={SECTION_METRICS}
                  value={metric}
                  onChange={setMetric}
                  label="المقياس"
                />
                <Segmented
                  options={[
                    { key: "section", label: "حسب الشعبة" },
                    { key: "program", label: "حسب الصف" },
                  ]}
                  value={by}
                  onChange={setBy}
                />
              </div>
            }
          />
        }
      >
        <TableFrame>
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>الشعبة</th>
              <th className={TH}>الصف</th>
              <th className={TH}>المربي</th>
              <th className={TH}>الطلاب</th>
              <th className={TH}>أيام الحضور</th>
              <th className={TH}>غياب</th>
              <th className={TH}>بعذر</th>
              <th className={TH}>نسبة الغياب</th>
              <th className={TH}>سلبي</th>
              <th className={TH}>إيجابي</th>
              <th className={TH}>معدل العلامات</th>
              <th className={TH}>امتحانات</th>
              <th className={TH}>زيارات العيادة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.section}>
                <td className={cn(TD, "font-medium")}>{r.sectionLabel}</td>
                <td className={TD}>{r.program}</td>
                <td className={cn(TD, "text-xs")}>{r.homeroom || "—"}</td>
                <td className={TD}>
                  <Num value={r.students} />
                </td>
                <td className={TD}>
                  <Num value={r.attendanceDays} />
                </td>
                <td className={TD}>
                  <Num value={r.absent} />
                </td>
                <td className={TD}>
                  <Num value={r.excused} />
                </td>
                <td className={TD}>
                  <span className={cn("num", r.absenceRate > 10 && "font-bold text-destructive")}>
                    {r.attendanceDays ? `${r.absenceRate}%` : "—"}
                  </span>
                </td>
                <td className={TD}>
                  <Num value={r.negative} />
                </td>
                <td className={TD}>
                  <Num value={r.positive} />
                </td>
                <td className={TD}>
                  {r.marksAverage === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="num">{r.marksAverage}%</span>
                  )}
                </td>
                <td className={TD}>
                  <Num value={r.exams} />
                </td>
                <td className={TD}>
                  <Num value={r.visits} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </ReportBlock>
    </div>
  );
}

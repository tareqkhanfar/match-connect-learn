import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  Flame,
  ListOrdered,
  MessageCircle,
  Phone,
  Printer,
  RotateCcw,
  Tags,
  TrendingDown,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { ReportChart } from "@/components/reports/report-chart";
import {
  CountBlock,
  Num,
  ReportBlock,
  ReportTabs,
  Segmented,
  StatGrid,
  StatTile,
  TableFrame,
} from "@/components/reports/report-kit";
import { TD, TH, isoDate, type TileTone } from "@/components/reports/report-utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAbsenceOptions,
  useAbsenceReport,
  useStudentAbsenceFile,
  type AbsenceFilters,
  type AbsenceStudent,
  type AbsenteeRow,
  type Guardian,
} from "@/lib/api/absence";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/absence-report")({
  head: () => ({
    meta: [
      { title: "تقرير الغياب — Match Education" },
      {
        name: "description",
        content:
          "الغائبون في أي يوم أو فترة مع أولياء أمورهم، والأكثر والأقل غياباً، والشعب والصفوف، والاتجاه اليومي، والأسباب، والغياب المتتالي.",
      },
    ],
  }),
  component: AbsenceReportPage,
});

type Tab = "absentees" | "most" | "least" | "groups" | "trend" | "reasons" | "streaks";

const TABS = [
  { key: "absentees", label: "الغائبون", icon: UserX },
  { key: "most", label: "الأكثر غياباً", icon: TrendingUp },
  { key: "least", label: "الأقل غياباً", icon: TrendingDown },
  { key: "groups", label: "الشعب والصفوف", icon: Users },
  { key: "trend", label: "الاتجاه والأيام", icon: CalendarDays },
  { key: "reasons", label: "الأسباب", icon: Tags },
  { key: "streaks", label: "الغياب المتتالي", icon: Flame },
] as const;

const DATE_FMT = new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "long" });

function niceDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : DATE_FMT.format(d);
}

function shift(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Absence is bad when high: the opposite of an attendance rate. */
function rateTone(rate: number | null | undefined): TileTone {
  if (rate === null || rate === undefined) return "neutral";
  return rate < 5 ? "good" : rate < 10 ? "warn" : "bad";
}

function RateCell({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-muted-foreground">—</span>;
  const tone = rate < 5 ? "bg-success" : rate < 10 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex min-w-[7rem] items-center gap-2">
      <span className="num w-11 shrink-0 text-xs font-semibold">{rate}%</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  return <Pill tone={status === "Absent" ? "danger" : "warning"}>{label}</Pill>;
}

/** A number a parent can be reached on: a call, and WhatsApp. */
function PhoneLinks({ number }: { number: string }) {
  if (!number) return null;
  const digits = number.replace(/[^\d+]/g, "");
  const wa = digits.replace(/^\+/, "").replace(/^0/, "970");
  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={`tel:${digits}`}
        className="num inline-flex items-center gap-1 rounded-md px-1 text-xs text-primary hover:underline"
        dir="ltr"
      >
        <Phone className="size-3" />
        {number}
      </a>
      <a
        href={`https://wa.me/${wa}`}
        target="_blank"
        rel="noreferrer"
        title="واتساب"
        className="grid size-6 place-items-center rounded-md text-emerald-600 hover:bg-emerald-500/10"
      >
        <MessageCircle className="size-3.5" />
      </a>
    </span>
  );
}

function Guardians({ list }: { list: Guardian[] }) {
  if (!list.length) return <span className="text-xs text-muted-foreground">لا ولي أمر مسجّل</span>;
  return (
    <div className="space-y-1">
      {list.map((g) => (
        <div key={g.id || g.name} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs font-medium">
            {g.name}
            {g.relation ? <span className="text-muted-foreground"> · {g.relation}</span> : null}
          </span>
          <PhoneLinks number={g.mobile} />
          {g.altMobile && <PhoneLinks number={g.altMobile} />}
        </div>
      ))}
    </div>
  );
}

/**
 * تقرير الغياب.
 *
 * Who was absent on any day or over any period — with the guardians to call
 * beside each name — then the patterns: who misses most and least, which
 * sections and grades, which weekdays, the reasons given, and the runs of
 * consecutive absence that a school should notice before they become a
 * dropout. Each role sees its own reach: the office the school, a teacher or
 * supervisor their sections, a family its own children.
 */
function AbsenceReportPage() {
  const options = useAbsenceOptions();
  const [filters, setFilters] = useState<AbsenceFilters>({
    date_from: shift(0),
    date_to: shift(0),
  });
  const [tab, setTab] = useState<Tab>("absentees");
  const [groupBy, setGroupBy] = useState<"section" | "grade">("section");
  const [opened, setOpened] = useState<string | null>(null);
  const family = options.data?.family ?? false;
  const report = useAbsenceReport(filters, !!options.data && !family);

  const set = (patch: { [K in keyof AbsenceFilters]?: string | undefined }) => {
    const next: AbsenceFilters = { ...filters };
    for (const [k, v] of Object.entries(patch) as Array<
      [keyof AbsenceFilters, string | undefined]
    >) {
      if (v) next[k] = v;
      else delete next[k];
    }
    setFilters(next);
  };

  if (options.isLoading) return <DashboardSkeleton />;
  if (options.error) return <ErrorState error={options.error} onRetry={() => options.refetch()} />;
  const o = options.data!;

  if (family) return <FamilyView students={o.students} />;

  const r = report.data;
  const s = r?.summary;
  const sections = filters.program
    ? o.sections.filter((x) => x.program === filters.program)
    : o.sections;
  const presets: Array<[string, Partial<AbsenceFilters>]> = [
    ["اليوم", { date_from: shift(0), date_to: shift(0) }],
    ["أمس", { date_from: shift(-1), date_to: shift(-1) }],
    ["آخر 7 أيام", { date_from: shift(-6), date_to: shift(0) }],
    ["آخر 30 يوماً", { date_from: shift(-29), date_to: shift(0) }],
    ["الفصل الحالي", { date_from: o.defaultRange.dateFrom, date_to: o.defaultRange.dateTo }],
  ];
  const single = r?.period.singleDay ?? filters.date_from === filters.date_to;

  return (
    <>
      <PageHeader
        title="تقرير الغياب"
        subtitle={
          o.scope === "school"
            ? "الغائبون مع أولياء أمورهم، والأكثر والأقل غياباً، والشعب والأيام والأسباب"
            : "غياب شعبك: الغائبون مع أولياء أمورهم، والأنماط والأسباب"
        }
        actions={
          <button
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:bg-secondary print:hidden"
          >
            <Printer className="size-4" />
            طباعة
          </button>
        }
      />

      {/* Filters ------------------------------------------------------------- */}
      <div className="card-surface mb-5 space-y-3 p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            من
            <Input
              type="date"
              value={filters.date_from ?? ""}
              max={filters.date_to}
              onChange={(e) => set({ date_from: e.target.value })}
              className="h-9 w-[9.5rem] rounded-xl"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            إلى
            <Input
              type="date"
              value={filters.date_to ?? ""}
              min={filters.date_from}
              onChange={(e) => set({ date_to: e.target.value })}
              className="h-9 w-[9.5rem] rounded-xl"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {presets.map(([label, patch]) => {
              const on = filters.date_from === patch.date_from && filters.date_to === patch.date_to;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => set(patch)}
                  className={cn(
                    "h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors",
                    on
                      ? "border-primary bg-primary-soft/50 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {o.programs.length > 1 && (
            <SearchableSelect
              value={filters.program ?? ""}
              onChange={(v) => set({ program: v, student_group: undefined, student: undefined })}
              options={o.programs.map((p) => ({ value: p.id, label: p.label }))}
              placeholder="كل الصفوف"
              clearable
              clearLabel="كل الصفوف"
            />
          )}
          <SearchableSelect
            value={filters.student_group ?? ""}
            onChange={(v) => set({ student_group: v, student: undefined })}
            options={sections.map((x) => ({ value: x.id, label: x.label }))}
            placeholder="كل الشعب"
            clearable
            clearLabel="كل الشعب"
          />
          <SearchableSelect
            value={filters.student ?? ""}
            onChange={(v) => set({ student: v })}
            options={o.students.map((x) => ({ value: x.id, label: x.label }))}
            placeholder="كل الطلاب"
            clearable
            clearLabel="كل الطلاب"
          />
          <button
            type="button"
            onClick={() => setFilters({ date_from: shift(0), date_to: shift(0) })}
            className="inline-flex h-9 items-center gap-1 justify-self-start rounded-xl px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            إعادة الضبط
          </button>
        </div>
      </div>

      {report.error ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : !r ? (
        <DashboardSkeleton />
      ) : r.empty || !s ? (
        <EmptyBlock title="لا توجد شعب ضمن صلاحياتك" icon={<Users className="size-6" />} />
      ) : (
        <div className={cn(report.isFetching && "opacity-60 transition-opacity")}>
          <p className="mb-3 text-xs font-semibold text-muted-foreground">
            {single
              ? niceDate(r.period.dateFrom)
              : `${niceDate(r.period.dateFrom)} — ${niceDate(r.period.dateTo)}`}
            {" · "}
            {s.schoolDays} يوم دراسي مسجّل
          </p>

          {/* Figures ---------------------------------------------------------- */}
          <StatGrid>
            <StatTile
              label="نسبة الغياب"
              value={s.rate === null ? "—" : `${s.rate}%`}
              hint={`${s.absent} غياب من ${s.present + s.absent} يوم`}
              tone={rateTone(s.rate)}
            />
            <StatTile
              label={single ? "الغائبون" : "طلاب غابوا"}
              value={single ? s.absent + s.excused : s.absentStudents}
              hint={single ? `${s.absent} غائب · ${s.excused} بعذر` : `من ${s.students} طالب`}
              tone={s.absentStudents ? "bad" : "good"}
            />
            {!single && (
              <StatTile
                label="متوسط الغياب اليومي"
                value={s.avgDailyAbsent}
                hint="طالب في اليوم"
                tone="info"
              />
            )}
            {!single && (
              <StatTile
                label="أعلى يوم غياب"
                value={s.worstDay ? s.worstDay.absent : "—"}
                hint={s.worstDay ? niceDate(s.worstDay.date) : "—"}
                tone="warn"
              />
            )}
            <StatTile
              label="غياب بعذر"
              value={s.excused}
              hint="لا يُحسب في النسبة"
              tone="neutral"
            />
            {!single && (
              <StatTile
                label={`غياب متتالي (${s.streakDays}+ أيام)`}
                value={s.streaks}
                hint={s.currentStreaks ? `${s.currentStreaks} ما زالوا غائبين` : "لا أحد حالياً"}
                tone={s.streaks ? "bad" : "good"}
              />
            )}
            {!single && (
              <StatTile
                label={`غياب مرتفع (${s.chronicPct}%+)`}
                value={s.chronic}
                hint="طلاب يحتاجون متابعة"
                tone={s.chronic ? "warn" : "good"}
              />
            )}
            {!single && (
              <StatTile label="حضور كامل" value={s.perfect} hint="بلا غياب في الفترة" tone="good" />
            )}
          </StatGrid>

          <div className="print:hidden">
            <ReportTabs tabs={TABS} value={tab} onChange={setTab} />
          </div>

          {tab === "absentees" && (
            <AbsenteesBlock
              rows={r.absentees ?? []}
              single={single}
              contacts={r.showsContacts ?? false}
              truncated={r.truncated ?? false}
              onOpen={setOpened}
            />
          )}

          {tab === "most" && (
            <StudentsBlock
              title="الأكثر غياباً"
              description="الطلاب مرتبين من الأكثر غياباً — اضغط على الاسم لملفه"
              students={(r.students ?? []).filter((x) => x.absent > 0)}
              chartRows={(r.students ?? []).filter((x) => x.absent > 0).slice(0, 15)}
              onOpen={setOpened}
            />
          )}

          {tab === "least" && (
            <StudentsBlock
              title="الأقل غياباً"
              description="الطلاب مرتبين من الأقل غياباً — من لم يغب في الفترة أولاً"
              students={[...(r.students ?? [])].sort(
                (a, b) => a.absent - b.absent || a.excused - b.excused || b.days - a.days,
              )}
              onOpen={setOpened}
              least
            />
          )}

          {tab === "groups" && (
            <ReportBlock
              title={groupBy === "section" ? "الغياب حسب الشعبة" : "الغياب حسب الصف"}
              description="مرتبة من الأعلى نسبة غياب"
              actions={
                <Segmented
                  options={[
                    { key: "section", label: "الشعب" },
                    { key: "grade", label: "الصفوف" },
                  ]}
                  value={groupBy}
                  onChange={setGroupBy}
                />
              }
              chart={
                <ReportChart
                  rows={groupBy === "section" ? (r.sections ?? []) : (r.grades ?? [])}
                  labelKey="label"
                  series={[{ key: "rate", label: "نسبة الغياب %" }]}
                  defaultType="hbar"
                  valueSuffix="%"
                  storageKey={`absence-groups-${groupBy}`}
                />
              }
            >
              <TableFrame>
                <thead>
                  <tr>
                    <th className={TH}>{groupBy === "section" ? "الشعبة" : "الصف"}</th>
                    <th className={TH}>الطلاب</th>
                    <th className={TH}>طلاب غابوا</th>
                    <th className={TH}>أيام الغياب</th>
                    <th className={TH}>بعذر</th>
                    <th className={TH}>نسبة الغياب</th>
                  </tr>
                </thead>
                <tbody>
                  {(groupBy === "section" ? (r.sections ?? []) : (r.grades ?? [])).map((g) => (
                    <tr key={g.id} className="border-t border-border/70">
                      <td className={cn(TD, "font-semibold")}>
                        {groupBy === "section" ? (
                          <button
                            className="hover:text-primary hover:underline"
                            onClick={() => set({ student_group: g.id, student: undefined })}
                          >
                            {g.label}
                          </button>
                        ) : (
                          g.label
                        )}
                      </td>
                      <td className={TD}>
                        <Num value={g.students} />
                      </td>
                      <td className={TD}>
                        <Num value={g.absentStudents} />
                      </td>
                      <td className={TD}>
                        <Num value={g.absent} />
                      </td>
                      <td className={TD}>
                        <Num value={g.excused} />
                      </td>
                      <td className={TD}>
                        <RateCell rate={g.rate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            </ReportBlock>
          )}

          {tab === "trend" && (
            <div className="space-y-5">
              <ReportBlock
                title="الغياب يوماً بيوم"
                description="أيام الغياب والغياب بعذر في كل يوم دراسي مسجّل"
                chart={
                  <ReportChart
                    rows={(r.daily ?? []).map((d) => ({ ...d, label: d.date.slice(5) }))}
                    labelKey="label"
                    series={[
                      { key: "absent", label: "غائب" },
                      { key: "excused", label: "بعذر" },
                    ]}
                    defaultType="line"
                    storageKey="absence-daily"
                  />
                }
              >
                <TableFrame>
                  <thead>
                    <tr>
                      <th className={TH}>اليوم</th>
                      <th className={TH}>حاضر</th>
                      <th className={TH}>غائب</th>
                      <th className={TH}>بعذر</th>
                      <th className={TH}>نسبة الغياب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(r.daily ?? [])].reverse().map((d) => (
                      <tr key={d.date} className="border-t border-border/70">
                        <td className={TD}>
                          <button
                            className="hover:text-primary hover:underline"
                            onClick={() => {
                              set({ date_from: d.date, date_to: d.date });
                              setTab("absentees");
                            }}
                          >
                            {niceDate(d.date)}
                          </button>
                        </td>
                        <td className={TD}>
                          <Num value={d.present} />
                        </td>
                        <td className={TD}>
                          <Num value={d.absent} />
                        </td>
                        <td className={TD}>
                          <Num value={d.excused} />
                        </td>
                        <td className={TD}>
                          <RateCell rate={d.rate} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableFrame>
              </ReportBlock>
              <ReportBlock
                title="حسب أيام الأسبوع"
                description="أي الأيام يكثر فيها الغياب — متوسط الغائبين في اليوم"
                chart={
                  <ReportChart
                    rows={r.weekday ?? []}
                    labelKey="day"
                    series={[{ key: "avgAbsent", label: "متوسط الغائبين" }]}
                    defaultType="bar"
                    storageKey="absence-weekday"
                  />
                }
              />
            </div>
          )}

          {tab === "reasons" && (
            <CountBlock
              title="أسباب الغياب"
              description="كما سُجّلت مع الغياب — الغياب بلا سبب يظهر منفصلاً"
              rows={r.reasons ?? []}
              defaultType="donut"
              labelHeading="السبب"
              valueLabel="الأيام"
              storageKey="absence-reasons"
            />
          )}

          {tab === "streaks" && (
            <StreaksBlock
              students={(r.students ?? []).filter((x) => x.longestStreak >= (s.streakDays || 3))}
              days={s.streakDays}
              onOpen={setOpened}
            />
          )}
        </div>
      )}

      {opened && (
        <StudentFileDialog
          student={opened}
          filters={filters}
          onClose={() => setOpened(null)}
          showsContacts={o.showsContacts}
        />
      )}
    </>
  );
}

// --- the absentees -----------------------------------------------------------------

function AbsenteesBlock({
  rows,
  single,
  contacts,
  truncated,
  onOpen,
}: {
  rows: AbsenteeRow[];
  single: boolean;
  contacts: boolean;
  truncated: boolean;
  onOpen: (student: string) => void;
}) {
  const [only, setOnly] = useState<"all" | "Absent" | "excused">("all");
  const shown = rows.filter((r) =>
    only === "all" ? true : only === "Absent" ? r.status === "Absent" : r.status !== "Absent",
  );
  const bySection = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of shown)
      map.set(r.sectionLabel || "—", (map.get(r.sectionLabel || "—") ?? 0) + 1);
    return [...map.entries()].map(([label, count]) => ({ label, count }));
  }, [shown]);

  return (
    <ReportBlock
      title={single ? "الغائبون في هذا اليوم" : "الغائبون في الفترة"}
      description={
        contacts ? "كل غياب مع ولي الأمر ورقمه — اتصال أو واتساب بضغطة" : "كل غياب بتاريخه وسببه"
      }
      actions={
        <Segmented
          options={[
            { key: "all", label: `الكل (${rows.length})` },
            { key: "Absent", label: "غائب" },
            { key: "excused", label: "بعذر" },
          ]}
          value={only}
          onChange={setOnly}
        />
      }
      chart={
        single && bySection.length > 1 ? (
          <ReportChart
            rows={bySection}
            labelKey="label"
            series={[{ key: "count", label: "الغائبون" }]}
            defaultType="hbar"
            storageKey="absence-today-sections"
            height={220}
          />
        ) : undefined
      }
    >
      {shown.length === 0 ? (
        <EmptyBlock
          title={single ? "لا غياب في هذا اليوم" : "لا غياب في هذه الفترة"}
          description="إما أن الجميع حضروا، أو أن الحضور لم يُسجَّل بعد."
          icon={<UserX className="size-6" />}
        />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              {!single && <th className={TH}>التاريخ</th>}
              <th className={TH}>الطالب</th>
              <th className={TH}>الشعبة</th>
              <th className={TH}>الحالة</th>
              <th className={TH}>السبب</th>
              {contacts && <th className={TH}>ولي الأمر والتواصل</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-border/70 align-top">
                {!single && (
                  <td className={cn(TD, "whitespace-nowrap text-xs")}>{niceDate(r.date)}</td>
                )}
                <td className={TD}>
                  <button
                    className="text-right font-semibold hover:text-primary hover:underline"
                    onClick={() => onOpen(r.student)}
                  >
                    {r.name}
                  </button>
                </td>
                <td className={cn(TD, "text-xs")}>{r.sectionLabel}</td>
                <td className={TD}>
                  <StatusPill status={r.status} label={r.statusLabel} />
                </td>
                <td className={cn(TD, "max-w-[14rem] text-xs text-muted-foreground")}>
                  {r.reason || "—"}
                </td>
                {contacts && (
                  <td className={TD}>
                    <Guardians list={r.guardians} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      {truncated && (
        <p className="text-[11px] text-muted-foreground">
          عُرض أحدث 5000 غياب — ضيّق الفترة أو اختر شعبة لرؤية الباقي.
        </p>
      )}
    </ReportBlock>
  );
}

// --- the pupils ----------------------------------------------------------------------

function StudentsBlock({
  title,
  description,
  students,
  chartRows,
  onOpen,
  least,
}: {
  title: string;
  description: string;
  students: AbsenceStudent[];
  chartRows?: AbsenceStudent[];
  onOpen: (student: string) => void;
  least?: boolean;
}) {
  return (
    <ReportBlock
      title={title}
      description={description}
      chart={
        chartRows && chartRows.length > 0 ? (
          <ReportChart
            rows={chartRows}
            labelKey="name"
            series={[
              { key: "absent", label: "غائب" },
              { key: "excused", label: "بعذر" },
            ]}
            defaultType="hbar"
            storageKey="absence-most"
          />
        ) : undefined
      }
    >
      {students.length === 0 ? (
        <EmptyBlock title="لا يوجد طلاب في هذه القائمة" icon={<ListOrdered className="size-6" />} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <th className={TH}>#</th>
              <th className={TH}>الطالب</th>
              <th className={TH}>الشعبة</th>
              <th className={TH}>أيام مسجّلة</th>
              <th className={TH}>غائب</th>
              <th className={TH}>بعذر</th>
              <th className={TH}>نسبة الغياب</th>
              <th className={TH}>أطول غياب متتالٍ</th>
              <th className={TH}>آخر غياب</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.student} className="border-t border-border/70">
                <td className={cn(TD, "num text-xs text-muted-foreground")}>{i + 1}</td>
                <td className={TD}>
                  <button
                    className="text-right font-semibold hover:text-primary hover:underline"
                    onClick={() => onOpen(s.student)}
                  >
                    {s.name}
                  </button>
                  {least && !s.absent && !s.excused && (
                    <span className="ms-2">
                      <Pill tone="success">حضور كامل</Pill>
                    </span>
                  )}
                </td>
                <td className={cn(TD, "text-xs")}>{s.sectionLabel}</td>
                <td className={TD}>
                  <Num value={s.days} />
                </td>
                <td className={TD}>
                  <Num value={s.absent} />
                </td>
                <td className={TD}>
                  <Num value={s.excused} />
                </td>
                <td className={TD}>
                  <RateCell rate={s.rate} />
                </td>
                <td className={TD}>
                  <Num value={s.longestStreak} />
                </td>
                <td className={cn(TD, "whitespace-nowrap text-xs")}>
                  {s.lastAbsent ? niceDate(s.lastAbsent) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </ReportBlock>
  );
}

function StreaksBlock({
  students,
  days,
  onOpen,
}: {
  students: AbsenceStudent[];
  days: number;
  onOpen: (student: string) => void;
}) {
  const sorted = [...students].sort(
    (a, b) => b.currentStreak - a.currentStreak || b.longestStreak - a.longestStreak,
  );
  return (
    <ReportBlock
      title="الغياب المتتالي"
      description={`طلاب غابوا ${days} أيام دراسية متتالية أو أكثر — «ما زال غائباً» أولاً`}
    >
      {sorted.length === 0 ? (
        <EmptyBlock
          title="لا غياب متتالٍ في هذه الفترة"
          description={`لم يغب أي طالب ${days} أيام متتالية.`}
          icon={<Flame className="size-6" />}
        />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <th className={TH}>الطالب</th>
              <th className={TH}>الشعبة</th>
              <th className={TH}>أطول غياب متتالٍ</th>
              <th className={TH}>الحالي</th>
              <th className={TH}>مجموع الغياب</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.student} className="border-t border-border/70">
                <td className={TD}>
                  <button
                    className="text-right font-semibold hover:text-primary hover:underline"
                    onClick={() => onOpen(s.student)}
                  >
                    {s.name}
                  </button>
                </td>
                <td className={cn(TD, "text-xs")}>{s.sectionLabel}</td>
                <td className={TD}>
                  <span className="num font-bold">{s.longestStreak}</span> أيام
                </td>
                <td className={TD}>
                  {s.currentStreak >= days ? (
                    <Pill tone="danger">
                      ما زال غائباً منذ {niceDate(s.currentStreakFrom)} ({s.currentStreak})
                    </Pill>
                  ) : (
                    <span className="text-xs text-muted-foreground">عاد للدوام</span>
                  )}
                </td>
                <td className={TD}>
                  <Num value={s.absent} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </ReportBlock>
  );
}

// --- one pupil's file ---------------------------------------------------------------------

function StudentFileBody({
  student,
  filters,
  showsContacts,
}: {
  student: string;
  filters: AbsenceFilters;
  showsContacts: boolean;
}) {
  const file = useStudentAbsenceFile(student, filters);
  if (file.isLoading) return <DashboardSkeleton />;
  if (file.error) return <ErrorState error={file.error} onRetry={() => file.refetch()} />;
  const f = file.data!;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="نسبة الغياب"
          value={f.summary.rate === null ? "—" : `${f.summary.rate}%`}
          tone={rateTone(f.summary.rate)}
        />
        <StatTile label="أيام الغياب" value={f.summary.absent} hint={`من ${f.summary.days} يوم`} />
        <StatTile label="بعذر" value={f.summary.excused} />
        <StatTile
          label="أطول غياب متتالٍ"
          value={f.summary.longestStreak}
          hint={
            f.summary.currentStreak
              ? `غائب حالياً منذ ${niceDate(f.summary.currentStreakFrom)}`
              : "ليس غائباً حالياً"
          }
          tone={f.summary.longestStreak >= 3 ? "bad" : "neutral"}
        />
      </div>
      {showsContacts && (
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-xs font-bold text-muted-foreground">أولياء الأمور</p>
          <Guardians list={f.guardians} />
        </div>
      )}
      {f.months.length > 1 && (
        <ReportChart
          rows={f.months}
          labelKey="month"
          series={[
            { key: "absent", label: "غائب" },
            { key: "excused", label: "بعذر" },
          ]}
          defaultType="bar"
          height={200}
          storageKey="absence-student-months"
        />
      )}
      <div>
        <p className="mb-2 text-xs font-bold text-muted-foreground">
          أيام الغياب ({f.days.length})
        </p>
        {f.days.length === 0 ? (
          <p className="rounded-xl bg-success-soft p-3 text-sm text-success">
            لا غياب في هذه الفترة.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {f.days.map((d) => (
              <li
                key={d.date}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">{niceDate(d.date)}</span>
                {d.reason && <span className="text-xs text-muted-foreground">{d.reason}</span>}
                <StatusPill status={d.status} label={d.statusLabel} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StudentFileDialog({
  student,
  filters,
  showsContacts,
  onClose,
}: {
  student: string;
  filters: AbsenceFilters;
  showsContacts: boolean;
  onClose: () => void;
}) {
  const file = useStudentAbsenceFile(student, filters);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {file.data?.name ?? "ملف غياب الطالب"}
            {file.data?.sectionLabel ? (
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                {file.data.sectionLabel}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <StudentFileBody student={student} filters={filters} showsContacts={showsContacts} />
      </DialogContent>
    </Dialog>
  );
}

// --- a family's view -------------------------------------------------------------------------

/** A parent or a pupil: their own child's absences, nobody else's. */
function FamilyView({ students }: { students: Array<{ id: string; label: string }> }) {
  const [student, setStudent] = useState(students[0]?.id ?? "");
  const [filters, setFilters] = useState<AbsenceFilters>({});
  return (
    <>
      <PageHeader title="تقرير الغياب" subtitle="أيام الغياب وأسبابها خلال الفترة" />
      <div className="card-surface mb-5 flex flex-wrap items-center gap-2 p-4">
        {students.length > 1 && (
          <div className="w-56">
            <SearchableSelect
              value={student}
              onChange={(v) => setStudent(v)}
              options={students.map((s) => ({ value: s.id, label: s.label }))}
              placeholder="اختر الابن"
            />
          </div>
        )}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          من
          <Input
            type="date"
            value={filters.date_from ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            className="h-9 w-[9.5rem] rounded-xl"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          إلى
          <Input
            type="date"
            value={filters.date_to ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            className="h-9 w-[9.5rem] rounded-xl"
          />
        </label>
      </div>
      {student ? (
        <StudentFileBody student={student} filters={filters} showsContacts={false} />
      ) : (
        <EmptyBlock title="لا يوجد طالب مرتبط بحسابك" icon={<Users className="size-6" />} />
      )}
    </>
  );
}

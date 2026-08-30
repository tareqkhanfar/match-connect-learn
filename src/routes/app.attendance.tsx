import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CalendarOff, Check, ClipboardCheck, Clock, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Avatar,
  KpiCard,
  PageHeader,
  Pill,
  ProgressBar,
  SectionCard,
} from "@/components/shared/ui-kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { errorMessage } from "@/lib/api/error-message";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import {
  useAttendanceReport,
  useAttendanceSheet,
  useMarkAttendance,
  useMyGroups,
  useAcademicContext,
  useUpcomingHolidays,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/attendance")({
  head: () => ({
    meta: [
      { title: "الحضور والغياب — Match Education" },
      {
        name: "description",
        content: "تسجيل الحضور اليومي لكل شعبة، تقارير الغياب، وتنبيهات الطلاب كثيري الغياب.",
      },
      { property: "og:title", content: "الحضور والغياب — Match Education" },
      { property: "og:description", content: "شبكة تفاعلية لتسجيل الحضور وتقارير دقيقة للغياب." },
    ],
  }),
  // A link may preselect the group, e.g. from the teacher's class list.
  validateSearch: (search: Record<string, unknown>): { group?: string } => ({
    ...(typeof search["group"] === "string" && search["group"] ? { group: search["group"] } : {}),
  }),
  component: AttendancePage,
});

/** Backend statuses, matching Student Attendance in Education. */
type Status = "Present" | "Absent" | "Excused" | "Leave";

/** The statuses a user can pick. "Leave" is legacy — same meaning as
 *  "Excused" — so it is displayed but never offered as a fourth button. */
const SELECTABLE: Status[] = ["Present", "Absent", "Excused"];

const STATUS_META: Record<Status, { label: string; cls: string; icon: typeof Check }> = {
  Present: { label: "حاضر", cls: "bg-success text-success-foreground", icon: Check },
  // An excused absence is not counted against the student anywhere — not in
  // the rate, not on a certificate. It is a distinct status, not a note.
  Excused: { label: "غائب بعذر", cls: "bg-warning text-warning-foreground", icon: Clock },
  Absent: { label: "غائب", cls: "bg-destructive text-destructive-foreground", icon: X },
  // Written by an older version; shown so historic sheets still read.
  Leave: { label: "غائب بعذر", cls: "bg-warning text-warning-foreground", icon: Clock },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AttendancePage() {
  const { role } = useApp();
  // Students and parents never see the marking grid — only their own record.
  if (role === "student" || role === "parent") return <MyAttendanceView />;
  return <StaffAttendanceView />;
}

/** Read-only attendance for a student or their parent. */
function MyAttendanceView() {
  // The child comes from the header, so every screen agrees on who is shown.
  const student = useViewedStudent();

  const report = useAttendanceReport(student ? { student } : {});
  const summary = report.data?.summary;
  const trend = (report.data?.rows ?? []).map((r) => ({ month: r.date, present: r.rate }));

  return (
    <>
      <PageHeader title="الحضور والغياب" subtitle="سجل الحضور الخاص بك" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="أيام الحضور" value={summary?.present ?? 0} icon={Check} tone="accent" />
        <KpiCard label="أيام الغياب" value={summary?.absent ?? 0} icon={X} tone="warm" />
        <KpiCard label="إجازات" value={summary?.leave ?? 0} icon={Clock} tone="info" />
        <KpiCard
          label="نسبة الحضور"
          value={`${summary?.rate ?? 0}%`}
          icon={ClipboardCheck}
          tone="primary"
        />
      </div>

      <div className="mt-5">
        <SectionCard title="نسبة الحضور عبر الزمن" description="لكل يوم مسجَّل">
          {report.error ? (
            <ErrorState error={report.error} onRetry={() => report.refetch()} />
          ) : report.isLoading ? (
            <TableSkeleton rows={4} />
          ) : trend.length === 0 ? (
            <EmptyBlock title="لا توجد سجلات حضور بعد" />
          ) : (
            <div className="h-[280px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="myAtt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
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
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      direction: "rtl",
                    }}
                    formatter={(v: number) => [`${v}%`, "الحضور"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="present"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="url(#myAtt)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}

/** Marking grid and reports for admin, secretary and teachers. */
function StaffAttendanceView() {
  const { role } = useApp();
  const canMark = role === "admin" || role === "secretary" || role === "teacher";

  const navigate = useNavigate();
  const { group: groupFromUrl } = Route.useSearch();
  const groupsQuery = useMyGroups();
  const [groupId, setGroupId] = useState<string>(groupFromUrl ?? "");
  const [date, setDate] = useState(todayISO());

  // A group named in the URL wins; otherwise fall back to the first one.
  // Without this the page always opened on the first group, so arriving from
  // "تسجيل الحضور" on a specific class showed the wrong roster.
  useEffect(() => {
    if (groupFromUrl) {
      setGroupId(groupFromUrl);
      return;
    }
    if (!groupId && groupsQuery.data?.length) setGroupId(groupsQuery.data[0]!.name);
  }, [groupFromUrl, groupsQuery.data, groupId]);

  // Picking a group from the dropdown rewrites the URL, so the effect above
  // does not snap the selection back to whatever the link carried.
  function selectGroup(next: string) {
    setGroupId(next);
    void navigate({ to: "/app/attendance", search: next ? { group: next } : {}, replace: true });
  }

  const sheetQuery = useAttendanceSheet(groupId || undefined, date);
  const reportQuery = useAttendanceReport(groupId ? { student_group: groupId } : {});
  const markAttendance = useMarkAttendance();

  // Local edits layered over whatever is already saved on the server.
  const [edits, setEdits] = useState<Record<string, Status>>({});
  const { data: context } = useAcademicContext();
  const { data: holidayInfo } = useUpcomingHolidays(365);
  useEffect(() => {
    // Reset local edits whenever the sheet identity changes.
    setEdits({});
  }, [groupId, date]);

  // `?? []` builds a new array every render, so every memo downstream
  // recomputed on each one. Memoised so the identity is stable.
  const rows = useMemo(() => sheetQuery.data?.students ?? [], [sheetQuery.data]);
  const marks = useMemo(() => {
    const out: Record<string, Status> = {};
    for (const r of rows) {
      out[r.student] = (edits[r.student] ?? r.status ?? "Present") as Status;
    }
    return out;
  }, [rows, edits]);

  const counts = {
    Present: Object.values(marks).filter((m) => m === "Present").length,
    Excused: Object.values(marks).filter((m) => m === "Excused" || m === "Leave").length,
    Absent: Object.values(marks).filter((m) => m === "Absent").length,
  };

  async function save() {
    if (!groupId) return;
    // Only what the teacher actually changed. Sending the whole class made the
    // server cancel and re-create every record in it to correct one pupil,
    // because an attendance record is submitted and cannot be edited in place.
    const entries = rows
      .filter((r) => isPending(r.student))
      .map((r) => ({ student: r.student, status: marks[r.student]! }));
    if (entries.length === 0) {
      toast.error("لا تغييرات لحفظها");
      return;
    }
    try {
      const res = await markAttendance.mutateAsync({ student_group: groupId, date, entries });
      toast.success(`تم حفظ الحضور لـ ${res.created + res.updated} طالباً`);
      setEdits({});
    } catch (error) {
      const message =
        (error as { messageAr?: string }).messageAr ||
        (error as Error).message ||
        "تعذّر حفظ الحضور";
      toast.error(message);
    }
  }

  /**
   * Whether a row differs from what the server holds.
   *
   * A record saved as the legacy "Leave" means the same as "Excused", so
   * switching between them is not a change and must not be sent — it would
   * cancel and rewrite the record for nothing.
   */
  function isPending(student: string): boolean {
    const local = edits[student];
    if (local === undefined) return false;
    const stored = (rows.find((r) => r.student === student)?.status ?? "Present") as Status;
    if (local === stored) return false;
    return !(local === "Excused" && stored === "Leave");
  }

  const pendingCount = rows.filter((r) => isPending(r.student)).length;

  const report = reportQuery.data;
  const trend = (report?.rows ?? []).map((r) => ({ month: r.date, present: r.rate }));

  // The sheet must refuse the same days the server refuses, and say why —
  // discovering it only on save wastes the teacher's time.
  const holidayReason = (holidayInfo?.holidays ?? []).find((h) => h.date === date)?.reason ?? null;
  const isFuture = date > (context?.today ?? date);
  const periodClosed = context ? !context.canWrite : false;
  const blockedReason = holidayReason
    ? `اليوم عطلة — ${holidayReason}. لا يمكن تسجيل الحضور.`
    : isFuture
      ? "لا يمكن تسجيل الحضور لتاريخ مستقبلي."
      : periodClosed
        ? (context?.readOnlyReason ?? "الفصل الدراسي مغلق.")
        : null;

  /** Set every student in the sheet to one status. */
  function markAll(status: Status) {
    const next: Record<string, Status> = {};
    for (const r of rows) next[r.student] = status;
    setEdits(next);
    toast.success(`تم تعيين ${rows.length} طالباً كـ ${STATUS_META[status].label}`);
  }

  return (
    <>
      <PageHeader
        title="الحضور والغياب"
        subtitle="عدّل ما تشاء ثم اضغط حفظ — لا يُرسل إلا ما تغيّر"
        actions={
          canMark ? (
            <button
              onClick={save}
              disabled={
                markAttendance.isPending ||
                rows.length === 0 ||
                !!blockedReason ||
                pendingCount === 0
              }
              title={blockedReason ?? (pendingCount === 0 ? "لا تغييرات معلّقة" : undefined)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              <Save className="size-4" />
              {markAttendance.isPending
                ? "جارٍ الحفظ…"
                : pendingCount > 0
                  ? `حفظ ${pendingCount} طالباً`
                  : "لا تغييرات"}
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="حاضر" value={counts.Present} icon={Check} tone="accent" />
        <KpiCard label="غائب" value={counts.Absent} icon={X} tone="warm" />
        <KpiCard label="غائب بعذر" value={counts.Excused} icon={Clock} tone="info" />
        <KpiCard
          label="نسبة الحضور العامة"
          value={`${report?.summary.rate ?? 0}%`}
          icon={ClipboardCheck}
          tone="primary"
        />
      </div>

      <div className="card-surface my-5 grid gap-3 p-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <SearchableSelect
          options={(groupsQuery.data ?? []).map((c) => ({
            value: c.name,
            label: c.student_group_name,
            code: c.name,
            hint: `${c.students} طالباً`,
          }))}
          value={groupId}
          onChange={selectGroup}
          placeholder="اختر الشعبة"
          searchPlaceholder="ابحث عن شعبة…"
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-xl"
        />
      </div>

      {blockedReason && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <CalendarOff className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800">تعذّر التسجيل في هذا التاريخ</p>
            <p className="text-amber-700/90">{blockedReason}</p>
          </div>
        </div>
      )}

      {canMark && rows.length > 0 && !blockedReason && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <span className="text-xs font-medium text-muted-foreground">تعيين الجميع:</span>
          {SELECTABLE.map((state) => {
            const meta = STATUS_META[state];
            return (
              <button
                key={state}
                onClick={() => markAll(state)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                <meta.icon className="size-3.5" />
                {meta.label}
              </button>
            );
          })}
          <span className="mr-auto text-[11px] text-muted-foreground">
            يمكن تعديل أي طالب بعد التعيين الجماعي
          </span>
        </div>
      )}

      <SectionCard
        title="شبكة تسجيل الحضور"
        description={
          sheetQuery.data
            ? `${sheetQuery.data.marked} من ${sheetQuery.data.total} مسجّل • ${date}`
            : date
        }
      >
        {groupsQuery.error || sheetQuery.error ? (
          <ErrorState
            error={groupsQuery.error ?? sheetQuery.error}
            onRetry={() => (groupsQuery.error ? groupsQuery.refetch() : sheetQuery.refetch())}
          />
        ) : groupsQuery.isLoading || sheetQuery.isLoading ? (
          <TableSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <EmptyBlock
            title="لا يوجد طلاب في هذه الشعبة"
            icon={<ClipboardCheck className="size-6" />}
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((s) => {
              const current = marks[s.student]!;
              return (
                <li
                  key={s.student}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3"
                >
                  <Avatar name={s.student_name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.student_name}</p>
                    <p className="num flex items-center gap-1.5 text-xs text-muted-foreground">
                      {s.student}
                      {/* Changed and not yet sent. Nothing reaches the server
                          until the teacher presses save — a register is a
                          legal record, and a stray tap should not write one. */}
                      {isPending(s.student) && (
                        <span className="font-semibold text-warning">غير محفوظ</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {SELECTABLE.map((state) => {
                      const meta = STATUS_META[state];
                      const Icon = meta.icon;
                      // A record saved as the legacy "Leave" means the same as
                      // "Excused", so it lights that button rather than leaving
                      // the row looking unmarked.
                      const active =
                        current === state || (state === "Excused" && current === "Leave");
                      return (
                        <button
                          key={state}
                          type="button"
                          disabled={!canMark}
                          onClick={() => setEdits((p) => ({ ...p, [s.student]: state }))}
                          title={meta.label}
                          aria-label={`${s.student_name}: ${meta.label}`}
                          aria-pressed={active}
                          className={`grid size-9 place-items-center rounded-lg border transition-colors disabled:cursor-not-allowed ${
                            active
                              ? `${meta.cls} border-transparent`
                              : "border-border text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          <Icon className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard title="نسبة الحضور عبر الزمن" description="لكل يوم مسجَّل في هذه الشعبة">
          {reportQuery.isLoading ? (
            <TableSkeleton rows={4} />
          ) : trend.length === 0 ? (
            <EmptyBlock title="لا توجد بيانات حضور بعد" />
          ) : (
            <div className="h-[260px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="attRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
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
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      direction: "rtl",
                    }}
                    formatter={(v: number) => [`${v}%`, "الحضور"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="present"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="url(#attRate)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="طلاب كثيرو الغياب"
          description="نسبة حضور أقل من ٨٠٪"
          actions={<AlertTriangle className="size-4 text-warning" />}
        >
          {reportQuery.isLoading ? (
            <TableSkeleton rows={4} />
          ) : (report?.chronic_absentees.length ?? 0) === 0 ? (
            <EmptyBlock title="لا يوجد طلاب بنسبة غياب مرتفعة" />
          ) : (
            <ul className="space-y-3">
              {report!.chronic_absentees.map((s) => (
                <li
                  key={s.student}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{s.student_name}</p>
                      <span className="num shrink-0 text-xs text-muted-foreground">{s.rate}%</span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar value={s.rate} tone={s.rate < 70 ? "danger" : "warning"} />
                    </div>
                  </div>
                  <Pill tone="danger">{s.absent} غياب</Pill>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

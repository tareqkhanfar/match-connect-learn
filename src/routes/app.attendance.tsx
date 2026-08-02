import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check, ClipboardCheck, Clock, Save, X } from "lucide-react";
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
import { useApp } from "@/lib/app-context";
import {
  useAttendanceReport,
  useAttendanceSheet,
  useMarkAttendance,
  useMyGroups,
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
  component: AttendancePage,
});

/** Backend statuses, matching Student Attendance in Education. */
type Status = "Present" | "Absent" | "Leave";

const STATUS_META: Record<Status, { label: string; cls: string; icon: typeof Check }> = {
  Present: { label: "حاضر", cls: "bg-success text-success-foreground", icon: Check },
  Leave: { label: "إجازة", cls: "bg-warning text-warning-foreground", icon: Clock },
  Absent: { label: "غائب", cls: "bg-destructive text-destructive-foreground", icon: X },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AttendancePage() {
  const { role } = useApp();
  const canMark = role === "admin" || role === "teacher";

  const groupsQuery = useMyGroups();
  const [groupId, setGroupId] = useState<string>("");
  const [date, setDate] = useState(todayISO());

  // Default to the first group once the list arrives.
  useEffect(() => {
    if (!groupId && groupsQuery.data?.length) setGroupId(groupsQuery.data[0]!.name);
  }, [groupsQuery.data, groupId]);

  const sheetQuery = useAttendanceSheet(groupId || undefined, date);
  const reportQuery = useAttendanceReport(groupId ? { student_group: groupId } : {});
  const markAttendance = useMarkAttendance();

  // Local edits layered over whatever is already saved on the server.
  const [edits, setEdits] = useState<Record<string, Status>>({});
  useEffect(() => {
    // Reset local edits whenever the sheet identity changes.
    setEdits({});
  }, [groupId, date]);

  const rows = sheetQuery.data?.students ?? [];
  const marks = useMemo(() => {
    const out: Record<string, Status> = {};
    for (const r of rows) {
      out[r.student] = (edits[r.student] ?? r.status ?? "Present") as Status;
    }
    return out;
  }, [rows, edits]);

  const counts = {
    Present: Object.values(marks).filter((m) => m === "Present").length,
    Leave: Object.values(marks).filter((m) => m === "Leave").length,
    Absent: Object.values(marks).filter((m) => m === "Absent").length,
  };

  async function save() {
    if (!groupId) return;
    const entries = rows.map((r) => ({ student: r.student, status: marks[r.student]! }));
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

  const report = reportQuery.data;
  const trend = (report?.rows ?? []).map((r) => ({ month: r.date, present: r.rate }));

  return (
    <>
      <PageHeader
        title="الحضور والغياب"
        subtitle="تسجيل الحضور اليومي ومتابعة تقارير الغياب"
        actions={
          canMark ? (
            <button
              onClick={save}
              disabled={markAttendance.isPending || rows.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              <Save className="size-4" />
              {markAttendance.isPending ? "جارٍ الحفظ…" : "حفظ الحضور"}
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="حاضر" value={counts.Present} icon={Check} tone="accent" />
        <KpiCard label="غائب" value={counts.Absent} icon={X} tone="warm" />
        <KpiCard label="إجازة" value={counts.Leave} icon={Clock} tone="info" />
        <KpiCard
          label="نسبة الحضور العامة"
          value={`${report?.summary.rate ?? 0}%`}
          icon={ClipboardCheck}
          tone="primary"
        />
      </div>

      <div className="card-surface my-5 grid gap-3 p-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="اختر الشعبة" />
          </SelectTrigger>
          <SelectContent>
            {(groupsQuery.data ?? []).map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.student_group_name} ({c.students})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-xl"
        />
      </div>

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
                    <p className="num text-xs text-muted-foreground">{s.student}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {(Object.keys(STATUS_META) as Status[]).map((state) => {
                      const meta = STATUS_META[state];
                      const Icon = meta.icon;
                      const active = current === state;
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

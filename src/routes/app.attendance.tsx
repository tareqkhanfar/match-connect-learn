import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check, Clock, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Avatar, KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { attendanceTrend, classes, students } from "@/lib/mock-data";

export const Route = createFileRoute("/app/attendance")({
  head: () => ({
    meta: [
      { title: "الحضور والغياب — Match Education" },
      { name: "description", content: "تسجيل الحضور اليومي لكل شعبة، تقارير الغياب، وتنبيهات الطلاب كثيري الغياب." },
      { property: "og:title", content: "الحضور والغياب — Match Education" },
      { property: "og:description", content: "شبكة تفاعلية لتسجيل الحضور وتقارير دقيقة للغياب." },
    ],
  }),
  component: AttendancePage,
});

type State = "present" | "late" | "absent";

const stateMeta: Record<State, { label: string; cls: string; icon: typeof Check }> = {
  present: { label: "حاضر", cls: "bg-success text-success-foreground", icon: Check },
  late: { label: "متأخر", cls: "bg-warning text-warning-foreground", icon: Clock },
  absent: { label: "غائب", cls: "bg-destructive text-destructive-foreground", icon: X },
};

function AttendancePage() {
  const [classId, setClassId] = useState(classes[0]!.id);
  const selected = classes.find((c) => c.id === classId)!;
  const roster = students.slice(0, 20);
  const [marks, setMarks] = useState<Record<string, State>>(() =>
    Object.fromEntries(roster.map((s, i) => [s.id, i % 9 === 4 ? "absent" : i % 7 === 3 ? "late" : "present"])),
  );

  const counts = {
    present: Object.values(marks).filter((m) => m === "present").length,
    late: Object.values(marks).filter((m) => m === "late").length,
    absent: Object.values(marks).filter((m) => m === "absent").length,
  };

  const frequentAbsentees = students.filter((s) => s.attendanceRate < 80).slice(0, 6);

  return (
    <>
      <PageHeader
        title="الحضور والغياب"
        subtitle="تسجيل الحضور اليومي ومتابعة نِسب الغياب"
        actions={
          <button
            onClick={() => toast.success("تم حفظ سجل الحضور لهذا اليوم")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Save className="size-4" />
            حفظ الحضور
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="حاضرون اليوم" value={counts.present} icon={Check} tone="accent" />
        <KpiCard label="متأخرون" value={counts.late} icon={Clock} tone="warm" />
        <KpiCard label="غائبون" value={counts.absent} icon={X} tone="primary" />
        <KpiCard label="نسبة الحضور" value={`${Math.round((counts.present / roster.length) * 100)}%`} icon={Check} tone="info" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SectionCard
          title="شبكة تسجيل الحضور"
          description={`${selected.grade} - شعبة ${selected.section} • اليوم`}
          actions={
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="h-9 w-[170px] rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.grade} - {c.section}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          <ul className="space-y-2">
            {roster.map((s) => (
              <li key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-2.5">
                <Avatar name={s.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="num text-xs text-muted-foreground">{s.id}</p>
                </div>
                <div className="flex gap-1.5">
                  {(Object.keys(stateMeta) as State[]).map((st) => {
                    const Icon = stateMeta[st].icon;
                    const active = marks[s.id] === st;
                    return (
                      <button
                        key={st}
                        onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                        title={stateMeta[st].label}
                        className={`grid size-9 place-items-center rounded-lg border transition-all ${
                          active ? `${stateMeta[st].cls} border-transparent scale-105` : "border-border text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        <Icon className="size-4" />
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="اتجاه الحضور" description="النسبة الشهرية">
            <div className="h-[220px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceTrend}>
                  <defs>
                    <linearGradient id="att2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.75rem", fontSize: "12px", direction: "rtl" }} formatter={(v: number) => [`${v}%`, "الحضور"]} />
                  <Area type="monotone" dataKey="present" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#att2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="تنبيهات الغياب المتكرر" description="طلاب بنسبة حضور أقل من ٨٠٪" actions={<AlertTriangle className="size-4 text-destructive" />}>
            <ul className="space-y-3">
              {frequentAbsentees.map((s) => (
                <li key={s.id}>
                  <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <Pill tone="danger">{s.attendanceRate}%</Pill>
                  </div>
                  <ProgressBar value={s.attendanceRate} tone="danger" />
                  <p className="mt-1 text-xs text-muted-foreground">{s.grade} - شعبة {s.section}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

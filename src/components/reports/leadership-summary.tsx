import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookCheck, ClipboardCheck, UserX } from "lucide-react";
import { ProgressBar } from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/shared/states";
import { useLeadershipSummary } from "@/lib/api/reports";
import { cn } from "@/lib/utils";

/**
 * What the leadership dashboard opens on: how far marks entry has got, how
 * reliably registers are taken, and the three names at the bottom of each —
 * the people the vice principal would speak to first. The full picture is in
 * «تقارير القيادة».
 */
export function LeadershipSummary({ className }: { className?: string }) {
  const q = useLeadershipSummary();
  if (q.isLoading)
    return (
      <div className={cn("grid gap-4 md:grid-cols-3", className)}>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  if (!q.data) return null;
  const { marks, attendance, topMissingMarks, topMissingAttendance } = q.data;
  const tone = (pct: number | null, good: number, fair: number) =>
    pct === null ? "primary" : pct >= good ? "success" : pct >= fair ? "warning" : "danger";

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">متابعة القيادة</h2>
        <Link
          to="/app/leadership-reports"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          كل التقارير
          <ArrowLeft className="size-3.5" />
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          icon={BookCheck}
          label="إدخال العلامات"
          value={marks.pct === null ? "—" : `${marks.pct}%`}
          hint={`${marks.entered} من ${marks.expected} علامة مطلوبة`}
          progress={marks.pct ?? 0}
          tone={tone(marks.pct, 90, 60)}
        />
        <Card
          icon={UserX}
          label="معلمون لم يُدخلوا علاماتهم"
          value={`${marks.teachersNoMarks}`}
          hint={`ولدى ${marks.teachersWithMissing} من ${marks.teachers} معلماً نواقص`}
          progress={marks.teachers ? (marks.teachersComplete / marks.teachers) * 100 : 0}
          tone={marks.teachersNoMarks ? "danger" : "success"}
        />
        <Card
          icon={ClipboardCheck}
          label="الالتزام بأخذ الحضور"
          value={attendance.pct === null ? "—" : `${attendance.pct}%`}
          hint={`${attendance.missing} كشفاً لم يؤخذ في ${attendance.schoolDays} يوماً دراسياً`}
          progress={attendance.pct ?? 0}
          tone={tone(attendance.pct, 95, 75)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TopList
          title="الأبعد عن إكمال العلامات"
          empty="كل المعلمين أكملوا علاماتهم"
          rows={topMissingMarks.map((t) => ({
            id: t.id,
            name: t.name,
            value: t.state === "none" ? "لم يُدخل" : `${t.pct}%`,
            hint: t.missing ? `${t.missing} ناقصة` : "",
          }))}
        />
        <TopList
          title="شعب لم يؤخذ حضورها"
          empty="أُخذ الحضور لكل الشعب"
          rows={topMissingAttendance.map((s) => ({
            id: s.id,
            name: s.name,
            value: s.pct === null ? "—" : `${s.pct}%`,
            hint: `${s.missing} يوماً`,
          }))}
        />
      </div>
    </section>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  hint,
  progress,
  tone,
}: {
  icon: typeof BookCheck;
  label: string;
  value: string;
  hint: string;
  progress: number;
  tone: "primary" | "success" | "warning" | "danger";
}) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="num mt-2 text-3xl font-bold tracking-tight">{value}</p>
      <div className="mt-3">
        <ProgressBar value={progress} tone={tone} />
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function TopList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ id: string; name: string; value: string; hint: string }>;
  empty: string;
}) {
  return (
    <div className="card-surface p-4">
      <p className="mb-2 text-sm font-bold">{title}</p>
      {rows.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className="num grid size-6 shrink-0 place-items-center rounded-lg bg-destructive-soft text-xs font-bold text-destructive">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              {r.hint && (
                <span className="num shrink-0 text-xs text-muted-foreground">{r.hint}</span>
              )}
              <span className="num shrink-0 text-xs font-semibold">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

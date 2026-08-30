import { useState } from "react";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Pill, SectionCard } from "@/components/shared/ui-kit";
import { useOverallComparison, useSubjectComparison } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

const TONE_FILL: Record<string, string> = {
  success: "var(--color-success, #16a34a)",
  info: "var(--color-info, #0ea5e9)",
  warning: "var(--color-warning, #f59e0b)",
  danger: "var(--color-destructive, #dc2626)",
  muted: "var(--color-muted-foreground, #94a3b8)",
};

/**
 * Where one pupil stands against the class they sit in.
 *
 * A percentage on its own answers nothing a family actually asks: 72% is good
 * where the class averages 60 and worrying where it averages 88. So every
 * figure appears beside the class's, and below the server's minimum sample it
 * says so rather than drawing a chart of two children.
 */
export function ClassStanding({ student }: { student: string }) {
  const overall = useOverallComparison(student);
  const [course, setCourse] = useState<string>("");
  const detail = useSubjectComparison(student, course || undefined);

  if (overall.isLoading) return <TableSkeleton rows={5} />;

  const subjects = overall.data?.subjects ?? [];
  if (subjects.length === 0) {
    return (
      <EmptyBlock
        title="لا توجد علامات كافية للمقارنة"
        description="تظهر المقارنة بعد رصد علامات هذا الفصل."
        icon={<BarChart3 className="size-6" />}
      />
    );
  }

  const summary = overall.data?.overall;
  const chart = subjects.map((s) => ({
    name: s.course_name,
    الطالب: s.student_percent,
    الصف: s.class_average ?? 0,
    tone: s.tone,
  }));

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="معدّل الطالب" value={`${summary.student_percent}%`} tone="primary" />
          <Stat
            label="معدّل الصف"
            value={summary.class_average !== null ? `${summary.class_average}%` : "—"}
            tone="muted"
          />
          <Stat
            label="مواد فوق المعدل"
            value={String(summary.above)}
            tone="success"
            hint={summary.strongest ?? undefined}
          />
          <Stat
            label="مواد دون المعدل"
            value={String(summary.below)}
            tone="danger"
            hint={summary.weakest ?? undefined}
          />
        </div>
      )}

      <SectionCard
        title="كل المواد"
        description="مرتّبة من الأضعف مقارنة بالصف — هذه هي المادة التي تحتاج متابعة."
      >
        <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 16, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, n: string) => [`${v}%`, n]}
                contentStyle={{ direction: "rtl", fontSize: 12 }}
              />
              <Bar dataKey="الصف" fill="var(--color-muted, #cbd5e1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="الطالب" radius={[4, 4, 0, 0]}>
                {chart.map((row, i) => (
                  <Cell key={i} fill={TONE_FILL[row.tone] ?? TONE_FILL["muted"]} />
                ))}
                <LabelList dataKey="الطالب" position="top" style={{ fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <ul className="mt-3 divide-y divide-border">
          {subjects.map((s) => (
            <li key={s.course}>
              <button
                onClick={() => setCourse(course === s.course ? "" : s.course)}
                className="flex w-full flex-wrap items-center gap-2 py-2.5 text-start hover:bg-secondary/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.course_name}</span>
                  <span className="num block text-[11px] text-muted-foreground">
                    {s.assessments} تقييماً
                    {s.rank ? ` · الترتيب ${s.rank} من ${s.of}` : ""}
                  </span>
                </span>
                <span className="num shrink-0 text-sm font-black">{s.student_percent}%</span>
                <span className="num shrink-0 text-xs text-muted-foreground">
                  {s.class_average !== null ? `الصف ${s.class_average}%` : "—"}
                </span>
                <Pill tone={s.tone as never}>
                  {s.gap !== null && s.gap > 0 && <TrendingUp className="ms-1 inline size-3" />}
                  {s.gap !== null && s.gap < 0 && <TrendingDown className="ms-1 inline size-3" />}
                  {s.band_label}
                </Pill>
              </button>

              {course === s.course && (
                <div className="border-t border-border bg-secondary/20 p-3">
                  {detail.isLoading ? (
                    <TableSkeleton rows={3} />
                  ) : (detail.data?.assessments.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد تقييمات مفصّلة.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-max text-xs">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="px-2 py-1.5 text-start font-semibold">التقييم</th>
                            <th className="px-2 py-1.5 font-semibold">الطالب</th>
                            <th className="px-2 py-1.5 font-semibold">معدّل الصف</th>
                            <th className="px-2 py-1.5 font-semibold">أعلى علامة</th>
                            <th className="px-2 py-1.5 font-semibold">الترتيب</th>
                            <th className="px-2 py-1.5 font-semibold">الموقع</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.data!.assessments.map((a) => (
                            <tr key={a.component} className="border-t border-border">
                              <td className="px-2 py-1.5 font-semibold">{a.component}</td>
                              <td className="num px-2 py-1.5 text-center font-bold">
                                {a.student_percent}%
                              </td>
                              <td className="num px-2 py-1.5 text-center text-muted-foreground">
                                {a.class_average !== null ? `${a.class_average}%` : "—"}
                              </td>
                              <td className="num px-2 py-1.5 text-center text-muted-foreground">
                                {a.class_high !== null ? `${a.class_high}%` : "—"}
                              </td>
                              <td className="num px-2 py-1.5 text-center">
                                {a.rank ? `${a.rank}/${a.of}` : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <Pill tone={a.tone as never}>{a.band_label}</Pill>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        لا تُحسب المقارنة إذا كان عدد من رُصدت لهم العلامة أقل من{" "}
                        <span className="num">{detail.data?.min_sample ?? 3}</span> طلاب.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: string;
  hint?: string | undefined;
}) {
  return (
    <div className="card-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num mt-1 text-2xl font-black",
          tone === "success" && "text-success",
          tone === "danger" && "text-destructive",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

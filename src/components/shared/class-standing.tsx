import { Award, Minus, TrendingDown, TrendingUp, Users } from "lucide-react";
import { SectionCard } from "@/components/shared/ui-kit";
import { useClassStanding } from "@/lib/api/hooks";

/**
 * Where a student sits relative to their class.
 *
 * Deliberately shows no other student — a family is entitled to know how their
 * own child is doing, not what the child next to them scored. The API returns
 * only aggregates for the same reason.
 */
export function ClassStanding({ student }: { student: string }) {
  const { data, isLoading } = useClassStanding(student);

  if (isLoading || !data) return null;
  if (!data.available) {
    // Silent when there is nothing meaningful to say — a rank out of one, or
    // no published marks yet, is worse than no card at all.
    return null;
  }

  const mine = data.studentAverage ?? 0;
  const avg = data.classAverage ?? 0;
  const diff = data.difference ?? 0;
  const rank = data.rank ?? 0;
  const size = data.classSize ?? 0;

  const Trend = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const trendTone =
    diff > 0 ? "text-emerald-600" : diff < 0 ? "text-amber-600" : "text-muted-foreground";

  // The bar shows the class range with the child's position marked, which
  // reads faster than three separate numbers.
  const low = data.lowest ?? 0;
  const high = data.highest ?? 100;
  const span = Math.max(high - low, 1);
  const position = Math.min(Math.max(((mine - low) / span) * 100, 0), 100);
  const classPosition = Math.min(Math.max(((avg - low) / span) * 100, 0), 100);

  return (
    <SectionCard title="مستوى الطالب مقارنة بالصف">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-3.5">
          <p className="text-[11px] text-muted-foreground">معدل الطالب</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{mine}%</p>
        </div>
        <div className="rounded-xl border border-border p-3.5">
          <p className="text-[11px] text-muted-foreground">معدل الصف</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-muted-foreground">{avg}%</p>
          <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-medium ${trendTone}`}>
            <Trend className="size-3" />
            {diff > 0 ? `أعلى بـ ${diff}` : diff < 0 ? `أقل بـ ${Math.abs(diff)}` : "مطابق"}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3.5">
          <p className="text-[11px] text-muted-foreground">الترتيب في الصف</p>
          <p className="mt-1 flex items-baseline gap-1 text-2xl font-bold tabular-nums">
            <Award className="size-4 text-primary" />
            {rank}
            <span className="text-sm font-normal text-muted-foreground">من {size}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="size-3" />
            ضمن أعلى {data.topPercent}%
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="relative h-2.5 rounded-full bg-secondary">
          {/* The class average, as a reference line. */}
          <span
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-muted-foreground/60"
            style={{ insetInlineStart: `${classPosition}%` }}
            title={`معدل الصف ${avg}%`}
          />
          <span
            className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
            style={{ insetInlineStart: `calc(${position}% - 8px)` }}
            title={`الطالب ${mine}%`}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span className="tabular-nums">أدنى {low}%</span>
          <span className="tabular-nums">أعلى {high}%</span>
        </div>
      </div>
    </SectionCard>
  );
}

import { EmptyBlock } from "@/components/shared/states";
import { Pill } from "@/components/shared/ui-kit";
import type { VisitRow } from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import { TableFrame } from "./report-kit";
import { outcomeTone, TD, TH } from "./report-utils";

/** Clinic visits as a plain table — the reports, a pupil's history, the nurse's dashboard. */

export function VisitsTable({
  visits,
  showStudent = true,
}: {
  visits: VisitRow[];
  showStudent?: boolean;
}) {
  if (visits.length === 0) return <EmptyBlock title="لا توجد زيارات" />;
  return (
    <TableFrame>
      <thead>
        <tr className="border-b border-border">
          <th className={TH}>التاريخ</th>
          {showStudent && <th className={TH}>الطالب</th>}
          {showStudent && <th className={TH}>الشعبة</th>}
          <th className={TH}>النوع</th>
          <th className={TH}>الشكوى</th>
          <th className={TH}>الإجراء</th>
          <th className={TH}>النتيجة</th>
          <th className={TH}>إبلاغ الأهل</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {visits.map((v) => (
          <tr key={v.id}>
            <td className={cn(TD, "num whitespace-nowrap text-xs")}>
              {v.date}
              {v.time ? ` ${v.time}` : ""}
            </td>
            {showStudent && <td className={cn(TD, "font-medium")}>{v.studentName}</td>}
            {showStudent && <td className={TD}>{v.section}</td>}
            <td className={TD}>{v.type}</td>
            <td className={cn(TD, "max-w-[14rem] text-xs")}>{v.complaint || "—"}</td>
            <td className={cn(TD, "max-w-[14rem] text-xs text-muted-foreground")}>
              {v.treatment || "—"}
            </td>
            <td className={TD}>
              <Pill tone={outcomeTone(v.outcomeKey)}>{v.outcome}</Pill>
            </td>
            <td className={TD}>{v.parentNotified ? "✓" : "—"}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

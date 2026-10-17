import { memo, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { SchoolSheet, SheetSlot } from "@/lib/api/school-timetable";
import {
  cellId,
  clockOf,
  gradeTone,
  subjectTone,
  type SheetIndex,
  type WeekCheck,
} from "@/lib/school-timetable";
import { cn } from "@/lib/utils";
import type { SheetView } from "./cell-picker";

export type SheetRow =
  | { type: "heading"; id: string; label: string; hint?: string }
  | {
      type: "row";
      id: string;
      label: string;
      sub?: string | undefined;
      end: ReactNode;
      endTone?: "ok" | "warn" | "bad" | undefined;
    };

export interface CellAddress {
  row: string;
  day: string;
  period: number;
}

interface GridProps {
  view: SheetView;
  sheet: SchoolSheet;
  index: SheetIndex;
  check: WeekCheck;
  days: SchoolSheet["days"];
  periods: SchoolSheet["periods"];
  rows: SheetRow[];
  /** Whether a lesson stays lit under the current filters. */
  lit: (slot: SheetSlot) => boolean;
  focusKeys: Set<string>;
  selected: CellAddress | null;
  showTimes: boolean;
  /** The page's header is folded away: the sheet takes the screen. */
  tall?: boolean;
  endLabel: string;
  footerLabel: string;
  footer: (day: string, period: number) => { value: number; title: string; tone?: "warn" | "ok" };
  onOpen: (cell: CellAddress, x: number, y: number) => void;
  onSelect: (cell: CellAddress) => void;
  onHoverKeys: (keys: string[] | null) => void;
  onMove: (fromK: string, to: CellAddress) => void;
}

/**
 * The sheet: a row per teacher (or per section), a column per day and
 * period — the paper timetable, with the checks drawn on it.
 */
export function SheetGrid(props: GridProps) {
  const { days, periods, rows, showTimes, tall, endLabel, footerLabel, footer } = props;
  const [dragRow, setDragRow] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "relative overflow-auto rounded-xl border border-border",
        tall ? "max-h-[calc(100vh-205px)]" : "max-h-[72vh]",
      )}
      dir="rtl"
    >
      <table data-no-tools className="border-separate border-spacing-0 text-center text-xs">
        <thead className="sticky top-0 z-20">
          <tr>
            <th
              rowSpan={2}
              className="sticky right-0 z-30 min-w-40 border-b border-l border-border bg-card px-3 py-2 text-right text-[11px] font-bold"
            >
              {props.view === "teachers" ? "المعلم" : "الشعبة"}
            </th>
            {days.map((d) => (
              <th
                key={d.value}
                colSpan={periods.length}
                className="border-b border-l-2 border-border bg-primary-soft px-2 py-1.5 text-[12px] font-black text-primary"
              >
                {d.label}
              </th>
            ))}
            <th
              rowSpan={2}
              className="sticky left-0 z-30 min-w-20 border-b border-r border-border bg-card px-2 text-[11px] font-bold"
            >
              {endLabel}
            </th>
          </tr>
          <tr>
            {days.map((d) =>
              periods.map((p, i) => (
                <th
                  key={`${d.value}${p.order}`}
                  title={`${p.from} – ${p.to}`}
                  className={cn(
                    "border-b border-border bg-card px-0.5 py-1 font-bold text-muted-foreground",
                    i === 0 && "border-r-2",
                  )}
                >
                  <span className="num block text-[11px]">{p.order}</span>
                  {showTimes && <span className="num block text-[9px] font-normal">{p.from}</span>}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.type === "heading" ? (
              <tr key={`h-${row.id}`}>
                <td
                  colSpan={days.length * periods.length + 2}
                  className="sticky right-0 border-b border-border bg-muted/60 px-3 py-1 text-right text-[11px] font-black"
                >
                  {row.label}
                  {row.hint && (
                    <span className="ms-2 font-normal text-muted-foreground">{row.hint}</span>
                  )}
                </td>
              </tr>
            ) : (
              <GridRow
                key={row.id}
                row={row}
                {...props}
                dragRow={dragRow}
                setDragRow={setDragRow}
              />
            ),
          )}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={days.length * periods.length + 2}
                className="py-12 text-sm text-muted-foreground"
              >
                لا يوجد ما يطابق الفلاتر.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="sticky bottom-0 z-20">
          <tr>
            <td className="sticky right-0 z-30 border-t border-l border-border bg-card px-3 py-1.5 text-right text-[10px] font-bold text-muted-foreground">
              {footerLabel}
            </td>
            {days.map((d) =>
              periods.map((p, i) => {
                const f = footer(d.value, p.order);
                return (
                  <td
                    key={`f${d.value}${p.order}`}
                    title={f.title}
                    className={cn(
                      "num border-t border-border bg-card py-1.5 text-[11px] font-bold",
                      i === 0 && "border-r-2",
                      f.tone === "warn" ? "text-warm-foreground" : "text-success",
                    )}
                  >
                    {f.value}
                  </td>
                );
              }),
            )}
            <td className="sticky left-0 z-30 border-t border-r border-border bg-card" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const GridRow = memo(function GridRow({
  row,
  view,
  sheet,
  index,
  check,
  days,
  periods,
  lit,
  focusKeys,
  selected,
  onOpen,
  onSelect,
  onHoverKeys,
  onMove,
  dragRow,
  setDragRow,
}: GridProps & {
  row: Extract<SheetRow, { type: "row" }>;
  dragRow: string | null;
  setDragRow: (r: string | null) => void;
}) {
  const isTeacher = view === "teachers";
  const group = isTeacher ? undefined : index.groups.get(row.id);
  return (
    <tr className="group/row">
      <th
        scope="row"
        className="sticky right-0 z-10 max-w-52 border-b border-l border-border bg-card px-3 py-1 text-right group-hover/row:bg-secondary"
      >
        <span className="block truncate text-[12px] font-bold">{row.label}</span>
        {row.sub && (
          <span className="block truncate text-[10px] font-normal text-muted-foreground">
            {row.sub}
          </span>
        )}
      </th>
      {days.map((d) =>
        periods.map((p, i) => {
          const address = { row: row.id, day: d.value, period: p.order };
          const list =
            (isTeacher ? index.byTeacherCell : index.byGroupCell).get(
              cellId(row.id, d.value, p.order),
            ) ?? [];
          const slot = list[0];
          const noPeriod = !isTeacher && !clockOf(group, p.order);
          const state = list.reduce<string | undefined>((worst, s) => {
            const st = check.byKey.get(s.k);
            if (
              st === "error" ||
              (st === "legacy" && worst !== "error") ||
              (st === "warning" && !worst)
            )
              return st;
            return worst;
          }, undefined);
          const isSelected =
            selected?.row === row.id && selected.day === d.value && selected.period === p.order;
          const focused = list.some((s) => focusKeys.has(s.k));
          const dim = slot ? !list.some(lit) : false;
          const g = slot ? index.groups.get(slot.group) : undefined;
          const course = slot ? sheet.courses[slot.course] : undefined;
          const tone = slot
            ? isTeacher
              ? gradeTone(g?.gradeOrder ?? 0)
              : subjectTone(course?.subject ?? slot.course)
            : "";
          const teacherName = slot?.instructor
            ? (index.teachers.get(slot.instructor)?.name ?? "")
            : "";
          return (
            <td
              key={`${d.value}${p.order}`}
              data-cell={cellId(row.id, d.value, p.order)}
              className={cn("border-b border-border p-0.5", i === 0 && "border-r-2")}
              onDragOver={(e) => {
                if (noPeriod) return;
                if (!isTeacher && dragRow !== row.id) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const k = e.dataTransfer.getData("text/plain");
                setDragRow(null);
                if (k) onMove(k, address);
              }}
            >
              <button
                type="button"
                disabled={noPeriod}
                draggable={!!slot}
                onDragStart={(e) => {
                  if (!slot) return;
                  e.dataTransfer.setData("text/plain", slot.k);
                  e.dataTransfer.effectAllowed = "move";
                  setDragRow(row.id);
                }}
                onDragEnd={() => setDragRow(null)}
                onClick={(e) => {
                  onSelect(address);
                  const r = e.currentTarget.getBoundingClientRect();
                  onOpen(address, r.left, r.bottom + 4);
                }}
                onFocus={() => onSelect(address)}
                onMouseEnter={() => {
                  if (!state) return;
                  const keys = list.flatMap((s) =>
                    (check.problemsOf.get(s.k) ?? []).flatMap((pr) =>
                      pr.kind === "quota" ? [] : pr.keys,
                    ),
                  );
                  onHoverKeys(keys);
                }}
                onMouseLeave={() => state && onHoverKeys(null)}
                title={
                  slot
                    ? [
                        `${g?.label ?? slot.group} · ${course?.subject ?? slot.course}`,
                        teacherName && `المعلم: ${teacherName}`,
                        ...list.flatMap((s) =>
                          (check.problemsOf.get(s.k) ?? []).map(
                            (pr) =>
                              `${pr.legacy ? "⚠ قائم قبل التعديل: " : pr.level === "error" ? "⛔ " : "⚠ "}${pr.message}`,
                          ),
                        ),
                      ]
                        .filter(Boolean)
                        .join("\n")
                    : noPeriod
                      ? "لا توجد هذه الحصة في يوم هذه الشعبة"
                      : "خانة فارغة — انقر لوضع حصة"
                }
                className={cn(
                  "relative flex h-10 w-[54px] flex-col items-center justify-center rounded-md leading-tight transition-all",
                  slot ? tone : "hover:bg-secondary",
                  noPeriod &&
                    "cursor-not-allowed bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,var(--border)_4px,var(--border)_5px)] opacity-60",
                  dim && "opacity-25",
                  state === "error" &&
                    "bg-destructive/20 text-destructive ring-2 ring-inset ring-destructive",
                  state === "legacy" &&
                    "bg-destructive/10 outline-dashed outline-1 -outline-offset-2 outline-destructive",
                  focused && "z-10 scale-105 ring-[3px] ring-destructive shadow-lg",
                  isSelected && !focused && "ring-2 ring-primary",
                )}
              >
                {slot && (
                  <>
                    <span className="block max-w-full truncate px-0.5 text-[12px] font-black">
                      {isTeacher ? (g?.short ?? "؟") : (course?.short ?? slot.course)}
                    </span>
                    <span className="block max-w-full truncate px-0.5 text-[9.5px] font-medium opacity-75">
                      {isTeacher
                        ? (course?.short ?? "")
                        : teacherName.split(/\s+/).filter((w) => !/^(أ\.|م\.|د\.)$/.test(w))[0] ||
                          "—"}
                    </span>
                    {list.length > 1 && (
                      <span className="num absolute -top-1 -left-1 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-white">
                        {list.length}
                      </span>
                    )}
                    {state === "warning" && (
                      <AlertTriangle className="absolute left-0.5 top-0.5 size-2.5 text-warm-foreground" />
                    )}
                  </>
                )}
              </button>
            </td>
          );
        }),
      )}
      <td
        className={cn(
          "num sticky left-0 z-10 border-b border-r border-border bg-card px-1.5 text-[11px] font-bold",
          row.endTone === "bad" && "bg-destructive-soft text-destructive",
          row.endTone === "warn" && "text-warm-foreground",
          row.endTone === "ok" && "text-success",
        )}
      >
        {row.end}
      </td>
    </tr>
  );
});

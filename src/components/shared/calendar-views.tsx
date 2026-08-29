import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CalendarEntry = {
  date: string;
  label: string;
  weeklyOff: boolean;
};

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTH_FMT = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" });
const DAY_FMT = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long" });

/** "2026-08-10" without timezone drift — `new Date(str)` parses as UTC. */
export function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function startOfWeek(date: Date): Date {
  // The school week starts on Sunday, which is also getDay() === 0.
  const out = new Date(date);
  out.setDate(out.getDate() - out.getDay());
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function Cell({
  date,
  entry,
  muted,
  today,
  onPick,
}: {
  date: Date;
  entry: CalendarEntry | undefined;
  muted: boolean;
  today: boolean;
  onPick?: (key: string) => void;
}) {
  const key = toKey(date);
  const clickable = !!onPick;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onPick?.(key)}
      className={[
        "flex min-h-[4.5rem] flex-col items-start gap-1 rounded-lg border p-1.5 text-right transition-colors",
        muted ? "opacity-40" : "",
        entry
          ? entry.weeklyOff
            ? "border-border bg-secondary/70"
            : "border-amber-500/40 bg-amber-500/15"
          : "border-border/60 bg-card",
        today ? "ring-2 ring-primary ring-offset-1" : "",
        clickable ? "cursor-pointer hover:border-primary/40" : "cursor-default",
      ].join(" ")}
      title={entry?.label}
    >
      <span
        className={`text-xs font-bold tabular-nums ${
          today ? "text-primary" : entry && !entry.weeklyOff ? "text-amber-700" : ""
        }`}
      >
        {date.getDate()}
      </span>
      {entry && (
        <span
          className={`w-full truncate text-[10px] leading-tight ${
            entry.weeklyOff ? "text-muted-foreground" : "text-amber-700"
          }`}
        >
          {entry.label}
        </span>
      )}
    </button>
  );
}

/**
 * A month laid out as a calendar.
 *
 * Six rows always, so the grid does not jump height between months — a
 * calendar that resizes as you page through it is hard to scan.
 */
export function MonthView({
  cursor,
  entries,
  today,
  onMove,
  onPick,
}: {
  cursor: Date;
  entries: Map<string, CalendarEntry>;
  today: string;
  onMove: (delta: number) => void;
  onPick?: (key: string) => void;
}) {
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => onMove(-1)}
          className="grid size-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
          aria-label="الشهر السابق"
        >
          <ChevronRight className="size-4" />
        </button>
        <p className="text-sm font-bold">{MONTH_FMT.format(cursor)}</p>
        <button
          onClick={() => onMove(1)}
          className="grid size-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
          aria-label="الشهر التالي"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_AR.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d) => (
          <Cell
            key={toKey(d)}
            date={d}
            entry={entries.get(toKey(d))}
            muted={d.getMonth() !== cursor.getMonth()}
            today={toKey(d) === today}
            {...(onPick ? { onPick } : {})}
          />
        ))}
      </div>
    </div>
  );
}

/** One week, with room for the full holiday name rather than a truncation. */
export function WeekView({
  cursor,
  entries,
  today,
  onMove,
  onPick,
}: {
  cursor: Date;
  entries: Map<string, CalendarEntry>;
  today: string;
  onMove: (delta: number) => void;
  onPick?: (key: string) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const first = days[0];
  const last = days[6];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => onMove(-1)}
          className="grid size-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
          aria-label="الأسبوع السابق"
        >
          <ChevronRight className="size-4" />
        </button>
        <p className="text-sm font-bold">
          {first && last ? `${DAY_FMT.format(first)} — ${DAY_FMT.format(last)}` : ""}
        </p>
        <button
          onClick={() => onMove(1)}
          className="grid size-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
          aria-label="الأسبوع التالي"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d, i) => {
          const key = toKey(d);
          const entry = entries.get(key);
          const isToday = key === today;
          return (
            <button
              key={key}
              type="button"
              disabled={!onPick}
              onClick={() => onPick?.(key)}
              className={[
                "flex min-h-[6rem] flex-col rounded-xl border p-3 text-right transition-colors",
                entry
                  ? entry.weeklyOff
                    ? "border-border bg-secondary/70"
                    : "border-amber-500/40 bg-amber-500/15"
                  : "border-border bg-card",
                isToday ? "ring-2 ring-primary ring-offset-1" : "",
                onPick ? "cursor-pointer hover:border-primary/40" : "cursor-default",
              ].join(" ")}
            >
              <p className="text-[11px] font-medium text-muted-foreground">{WEEKDAYS_AR[i]}</p>
              <p
                className={`mt-0.5 text-lg font-bold tabular-nums ${isToday ? "text-primary" : ""}`}
              >
                {d.getDate()}
              </p>
              {entry ? (
                <p
                  className={`mt-1 text-[11px] leading-tight ${
                    entry.weeklyOff ? "text-muted-foreground" : "font-medium text-amber-700"
                  }`}
                >
                  {entry.label}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground/60">دوام</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

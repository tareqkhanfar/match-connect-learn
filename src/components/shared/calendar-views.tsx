import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { wsColor } from "@/lib/workspace-icons";

/** One thing on one day: an agenda event, a holiday, a weekly day off. */
export type CalendarEntry = {
  id: string;
  date: string;
  label: string;
  /** A colour key from WS_COLORS. */
  color: string;
  weeklyOff: boolean;
  /** The day is closed (a holiday). */
  closed?: boolean;
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

export function startOfWeek(date: Date): Date {
  // The school week starts on Sunday, which is also getDay() === 0.
  const out = new Date(date);
  out.setDate(out.getDate() - out.getDay());
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function Chip({
  entry,
  onOpen,
  big,
}: {
  entry: CalendarEntry;
  onOpen?: ((entry: CalendarEntry) => void) | undefined;
  big?: boolean;
}) {
  const tone = entry.weeklyOff ? "bg-secondary text-muted-foreground" : wsColor(entry.color).tile;
  return (
    <span
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={(e) => {
        if (!onOpen) return;
        e.stopPropagation();
        onOpen(entry);
      }}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          e.stopPropagation();
          onOpen(entry);
        }
      }}
      className={cn(
        "block w-full truncate rounded px-1 leading-tight",
        big ? "py-1 text-[11px] font-medium" : "py-0.5 text-[10px]",
        tone,
        onOpen && "hover:ring-1 hover:ring-current",
      )}
      title={entry.label}
    >
      {entry.label}
    </span>
  );
}

function Cell({
  date,
  entries,
  muted,
  today,
  onPick,
  onOpen,
}: {
  date: Date;
  entries: CalendarEntry[];
  muted: boolean;
  today: boolean;
  onPick?: ((key: string) => void) | undefined;
  onOpen?: ((entry: CalendarEntry) => void) | undefined;
}) {
  const key = toKey(date);
  const closed = entries.some((e) => e.closed && !e.weeklyOff);
  const weekly = entries.length > 0 && entries.every((e) => e.weeklyOff);
  const shown = entries.slice(0, 3);
  const more = entries.length - shown.length;

  return (
    <div
      role={onPick ? "button" : undefined}
      tabIndex={onPick ? 0 : undefined}
      onClick={() => onPick?.(key)}
      onKeyDown={(e) => {
        if (onPick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onPick(key);
        }
      }}
      className={cn(
        "flex min-h-[5.5rem] flex-col items-stretch gap-0.5 rounded-lg border p-1 text-right transition-colors",
        muted && "opacity-40",
        closed
          ? "border-rose-400/40 bg-rose-500/5"
          : weekly
            ? "border-border bg-secondary/60"
            : "border-border/60 bg-card",
        today && "ring-2 ring-primary ring-offset-1",
        onPick ? "cursor-pointer hover:border-primary/40" : "cursor-default",
      )}
    >
      <span className={cn("px-0.5 text-xs font-bold tabular-nums", today && "text-primary")}>
        {date.getDate()}
      </span>
      {shown.map((e) => (
        <Chip key={e.id} entry={e} onOpen={onOpen} />
      ))}
      {more > 0 && <span className="px-0.5 text-[10px] text-muted-foreground">+{more} أخرى</span>}
    </div>
  );
}

function Header({
  label,
  onMove,
  prev,
  next,
}: {
  label: string;
  onMove: (d: number) => void;
  prev: string;
  next: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <button
        onClick={() => onMove(-1)}
        className="grid size-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
        aria-label={prev}
      >
        <ChevronRight className="size-4" />
      </button>
      <p className="text-sm font-bold">{label}</p>
      <button
        onClick={() => onMove(1)}
        className="grid size-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
        aria-label={next}
      >
        <ChevronLeft className="size-4" />
      </button>
    </div>
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
  onOpen,
}: {
  cursor: Date;
  entries: Map<string, CalendarEntry[]>;
  today: string;
  onMove: (delta: number) => void;
  onPick?: ((key: string) => void) | undefined;
  onOpen?: ((entry: CalendarEntry) => void) | undefined;
}) {
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  return (
    <div>
      <Header
        label={MONTH_FMT.format(cursor)}
        onMove={onMove}
        prev="الشهر السابق"
        next="الشهر التالي"
      />
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
            entries={entries.get(toKey(d)) ?? []}
            muted={d.getMonth() !== cursor.getMonth()}
            today={toKey(d) === today}
            onPick={onPick}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

/** One week, with room for every event's full name. */
export function WeekView({
  cursor,
  entries,
  today,
  onMove,
  onPick,
  onOpen,
}: {
  cursor: Date;
  entries: Map<string, CalendarEntry[]>;
  today: string;
  onMove: (delta: number) => void;
  onPick?: ((key: string) => void) | undefined;
  onOpen?: ((entry: CalendarEntry) => void) | undefined;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);
  const first = days[0];
  const last = days[6];

  return (
    <div>
      <Header
        label={first && last ? `${DAY_FMT.format(first)} — ${DAY_FMT.format(last)}` : ""}
        onMove={onMove}
        prev="الأسبوع السابق"
        next="الأسبوع التالي"
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d, i) => {
          const key = toKey(d);
          const list = entries.get(key) ?? [];
          const isToday = key === today;
          const closed = list.some((e) => e.closed && !e.weeklyOff);
          return (
            <div
              key={key}
              role={onPick ? "button" : undefined}
              tabIndex={onPick ? 0 : undefined}
              onClick={() => onPick?.(key)}
              onKeyDown={(e) => {
                if (onPick && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onPick(key);
                }
              }}
              className={cn(
                "flex min-h-[8rem] flex-col gap-1 rounded-xl border p-2.5 text-right transition-colors",
                closed ? "border-rose-400/40 bg-rose-500/5" : "border-border bg-card",
                isToday && "ring-2 ring-primary ring-offset-1",
                onPick ? "cursor-pointer hover:border-primary/40" : "cursor-default",
              )}
            >
              <p className="text-[11px] font-medium text-muted-foreground">{WEEKDAYS_AR[i]}</p>
              <p className={cn("text-lg font-bold tabular-nums", isToday && "text-primary")}>
                {d.getDate()}
              </p>
              {list.length ? (
                list.map((e) => <Chip key={e.id} entry={e} onOpen={onOpen} big />)
              ) : (
                <p className="text-[11px] text-muted-foreground/60">دوام</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

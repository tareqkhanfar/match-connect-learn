import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import type { ExamSitting } from "@/lib/api/hooks";

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTH_FMT = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" });
const RANGE_FMT = new Intl.DateTimeFormat("ar", { day: "numeric", month: "long" });

/** A yyyy-mm-dd key built from local parts, never from toISOString(). */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** The Sunday that starts this date's school week. */
function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

/**
 * The exam timetable as a board a registrar can rearrange.
 *
 * A list of dates answers "what is on?" but not "is this week too heavy?" —
 * three exams stacked on one Tuesday only becomes obvious when the week is
 * laid out. Dragging an exam moves the sitting to another day, which is the
 * edit a registrar actually makes; everything else stays as it was, so the
 * room and the time are still whatever was agreed.
 *
 * The drop is validated on the server — holidays, clashes and permissions all
 * live there — so this is about seeing the shape of the week, not about
 * deciding what is allowed.
 */
export function ExamBoard({
  exams,
  view,
  cursor,
  onMove,
  onDropExam,
  onPick,
  busy,
}: {
  exams: ExamSitting[];
  view: "week" | "month";
  cursor: Date;
  onMove: (delta: number) => void;
  onDropExam: (exam: ExamSitting, date: string) => void;
  onPick?: (exam: ExamSitting) => void;
  busy?: boolean;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const todayKey = dayKey(new Date());

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor, view]);

  // One bucket per day, so a cell is a lookup rather than a scan of every exam.
  const byDay = useMemo(() => {
    const map = new Map<string, ExamSitting[]>();
    for (const e of exams) {
      const key = (e.date || "").slice(0, 10);
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.from_time || "").localeCompare(b.from_time || ""));
    }
    return map;
  }, [exams]);

  const heading =
    view === "month"
      ? MONTH_FMT.format(cursor)
      : `${RANGE_FMT.format(days[0]!)} — ${RANGE_FMT.format(days[6]!)}`;

  function handleDrop(event: React.DragEvent, key: string) {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData("text/exam-id");
    if (!id) return;
    const exam = exams.find((e) => e.id === id);
    // Dropping an exam back on its own day is not a change.
    if (!exam || (exam.date || "").slice(0, 10) === key) return;
    onDropExam(exam, key);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => onMove(-1)}
          className="grid size-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
          aria-label="السابق"
        >
          <ChevronRight className="size-4" />
        </button>
        <p className="text-sm font-bold">{heading}</p>
        <button
          onClick={() => onMove(1)}
          className="grid size-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
          aria-label="التالي"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS_AR.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-bold text-muted-foreground">
            {d}
          </div>
        ))}

        {days.map((date) => {
          const key = dayKey(date);
          const dayExams = byDay.get(key) ?? [];
          const outside = view === "month" && date.getMonth() !== cursor.getMonth();
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(key);
              }}
              onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
              onDrop={(e) => handleDrop(e, key)}
              className={`min-h-24 rounded-xl border p-1.5 transition-colors ${
                dragOver === key
                  ? "border-primary bg-primary-soft"
                  : isToday
                    ? "border-primary/40 bg-primary-soft/30"
                    : "border-border"
              } ${outside ? "opacity-40" : ""} ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <p
                className={`num mb-1 text-[11px] ${
                  isToday ? "font-bold text-primary" : "text-muted-foreground"
                }`}
              >
                {date.getDate()}
              </p>

              <div className="space-y-1">
                {dayExams.map((e) => (
                  <button
                    key={e.id}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData("text/exam-id", e.id);
                      ev.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onPick?.(e)}
                    title={`${e.course} — ${e.student_group} ${e.from_time ?? ""}`}
                    className="flex w-full cursor-grab items-start gap-1 rounded-lg border border-info/30 bg-info-soft p-1 text-right active:cursor-grabbing"
                  >
                    <GripVertical className="mt-0.5 size-3 shrink-0 text-info/60" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold leading-tight">
                        {e.course}
                      </span>
                      {e.from_time && (
                        <span className="num block text-[10px] text-muted-foreground">
                          {e.from_time.slice(0, 5)}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        اسحب أي امتحان إلى يوم آخر لنقله — يتحقق النظام من العطل والتعارضات قبل الحفظ.
      </p>
    </div>
  );
}

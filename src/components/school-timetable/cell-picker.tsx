import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Eraser, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SchoolSheet, SheetSlot } from "@/lib/api/school-timetable";
import { clockOf, gradeTone, normalise, type SheetIndex } from "@/lib/school-timetable";
import { cn } from "@/lib/utils";

export type SheetView = "teachers" | "sections";

export interface CellTarget {
  row: string;
  day: string;
  period: number;
  x: number;
  y: number;
}

/**
 * What goes in one cell. From a teacher's row it picks the section (then the
 * subject); from a section's row the subject (then the teacher). Every option
 * says whether it is free at this time, so a clash is avoided before it is
 * made — though a busy one can still be chosen, and lights red on the sheet.
 */
export function CellPicker({
  view,
  target,
  sheet,
  index,
  current,
  onApply,
  onClear,
  onClose,
}: {
  view: SheetView;
  target: CellTarget;
  sheet: SchoolSheet;
  index: SheetIndex;
  current: SheetSlot | undefined;
  onApply: (patch: { group: string; course: string; instructor: string; room: string }) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: target.x, top: target.y });
  const [query, setQuery] = useState("");
  const isTeacher = view === "teachers";
  const [group, setGroup] = useState(isTeacher ? (current?.group ?? "") : target.row);
  const [course, setCourse] = useState(current?.course ?? "");
  const [instructor, setInstructor] = useState(
    isTeacher ? target.row : (current?.instructor ?? ""),
  );
  const [room, setRoom] = useState(current?.room ?? "");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      const m = 8;
      let left = target.x - width;
      if (left < m) left = Math.min(target.x, window.innerWidth - width - m);
      let top = target.y;
      if (top + height > window.innerHeight - m) top = Math.max(m, window.innerHeight - height - m);
      setPos((p) => (p.left === left && p.top === top ? p : { left, top }));
    };
    fit();
    const frame = requestAnimationFrame(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [target.x, target.y]);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
    };
  }, []);

  const rowLabel = isTeacher
    ? (index.teachers.get(target.row)?.name ?? target.row)
    : (index.groups.get(target.row)?.label ?? target.row);
  const header = `${rowLabel} — ${index.dayLabel.get(target.day) ?? target.day} · الحصة ${target.period}`;
  const q = normalise(query);

  // --- from a teacher's row: the section, then the subject -----------------
  const teacherCombos = useMemo(() => {
    if (!isTeacher) return [];
    const counts = new Map<string, number>();
    for (const s of index.teacherSlots.get(target.row) ?? []) {
      const key = `${s.group}#${s.course}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, n]) => {
        const [g, c] = key.split("#") as [string, string];
        return { group: g, course: c, n };
      })
      .sort((a, b) => b.n - a.n);
  }, [isTeacher, index, target.row]);

  const gradeBlocks = useMemo(() => {
    const blocks = new Map<string, SchoolSheet["groups"]>();
    for (const g of sheet.groups) {
      if (q && !normalise(`${g.label} ${g.short} ${g.program}`).includes(q)) continue;
      const key = g.program || "—";
      blocks.set(key, [...(blocks.get(key) ?? []), g]);
    }
    return [...blocks.entries()];
  }, [sheet.groups, q]);

  // --- from a section's row: the subject, then the teacher -----------------
  const sectionCourses = useMemo(() => {
    if (isTeacher) return [];
    const g = index.groups.get(target.row);
    const placed = new Map<string, number>();
    for (const s of index.groupSlots.get(target.row) ?? [])
      placed.set(s.course, (placed.get(s.course) ?? 0) + 1);
    const ids = [...new Set([...(g?.courses ?? []), ...placed.keys()])].filter(Boolean);
    return ids
      .map((id) => ({ id, label: sheet.courses[id]?.subject ?? id, n: placed.get(id) ?? 0 }))
      .filter((c) => !q || normalise(c.label).includes(q))
      .sort((a, b) => a.label.localeCompare(b.label, "ar"));
  }, [isTeacher, index, target.row, sheet.courses, q]);

  const teacherOptions = useMemo(() => {
    if (isTeacher || !course) return [];
    const subject = sheet.courses[course]?.subject ?? course;
    const rank = (t: SchoolSheet["teachers"][number]) => {
      const mine = (index.teacherSlots.get(t.id) ?? []).some(
        (s) => s.group === target.row && s.course === course,
      );
      if (mine) return 0;
      if (t.courses.some((c) => (sheet.courses[c]?.subject ?? c) === subject)) return 1;
      return 2;
    };
    return sheet.teachers
      .filter((t) => !t.inactive)
      .filter((t) => !q || normalise(t.name).includes(q))
      .map((t) => ({
        t,
        rank: rank(t),
        busy: index.teacherBusy(t.id, target.row, target.day, target.period, current?.k),
        load: index.teacherSlots.get(t.id)?.length ?? 0,
      }))
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          Number(!!a.busy) - Number(!!b.busy) ||
          a.t.name.localeCompare(b.t.name, "ar"),
      );
  }, [isTeacher, course, sheet, index, target, current, q]);

  const groupCourses = useMemo(() => {
    if (!isTeacher || !group) return [];
    const g = index.groups.get(group);
    const mine = new Set(
      (index.teachers.get(target.row)?.courses ?? []).map((c) => sheet.courses[c]?.subject ?? c),
    );
    return (g?.courses ?? [])
      .map((id) => ({
        id,
        label: sheet.courses[id]?.subject ?? id,
        mine: mine.has(sheet.courses[id]?.subject ?? id),
      }))
      .sort((a, b) => Number(b.mine) - Number(a.mine) || a.label.localeCompare(b.label, "ar"));
  }, [isTeacher, group, index, target.row, sheet.courses]);

  // A teacher who already teaches this section one subject most likely
  // teaches it that one again: preselect it.
  useEffect(() => {
    if (!isTeacher || !group || course) return;
    const known = teacherCombos.find((c) => c.group === group);
    if (known) setCourse(known.course);
    else if (groupCourses.length === 1) setCourse(groupCourses[0]!.id);
  }, [isTeacher, group, course, teacherCombos, groupCourses]);

  const ready = Boolean(group && course && (isTeacher || instructor));
  const apply = (patch?: Partial<{ group: string; course: string; instructor: string }>) =>
    onApply({
      group: patch?.group ?? group,
      course: patch?.course ?? course,
      instructor: patch?.instructor ?? instructor,
      room,
    });

  const status = (g: string) => {
    const group_ = index.groups.get(g);
    if (!clockOf(group_, target.period))
      return { kind: "none" as const, text: "لا حصة بهذا الرقم" };
    const busy = index.groupBusy(g, target.day, target.period, current?.k);
    if (busy) {
      const who = busy.instructor
        ? (index.teachers.get(busy.instructor)?.name ?? busy.instructor)
        : "بلا معلم";
      return {
        kind: "busy" as const,
        text: `مشغولة: ${sheet.courses[busy.course]?.short ?? busy.course} · ${who}`,
      };
    }
    if (isTeacher) {
      const clash = index.teacherBusy(target.row, g, target.day, target.period, current?.k);
      if (clash)
        return {
          kind: "busy" as const,
          text: `المعلم عنده ${index.groups.get(clash.group)?.short} بنفس الوقت`,
        };
    }
    return { kind: "free" as const, text: "متاحة" };
  };

  return (
    <div
      ref={ref}
      dir="rtl"
      role="dialog"
      aria-label={header}
      className="fixed z-50 flex max-h-[min(72vh,600px)] w-[min(96vw,380px)] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="flex items-start gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{header}</p>
          <p className="num text-[11px] text-muted-foreground">
            {(() => {
              const g = index.groups.get(isTeacher ? group : target.row);
              const c = clockOf(g, target.period);
              return c ? `${c.from} – ${c.to}` : "اختر الشعبة لمعرفة الوقت";
            })()}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-secondary" aria-label="إغلاق">
          <X className="size-4" />
        </button>
      </div>

      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isTeacher ? "ابحث عن شعبة…" : course ? "ابحث عن معلم…" : "ابحث عن مادة…"}
            className="h-8 pr-8 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2.5">
        {isTeacher ? (
          <>
            {teacherCombos.length > 0 && !q && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                  من حصص هذا المعلم — بنقرة
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {teacherCombos.slice(0, 10).map((c) => {
                    const st = status(c.group);
                    const g = index.groups.get(c.group);
                    return (
                      <button
                        key={`${c.group}#${c.course}`}
                        onClick={() => apply({ group: c.group, course: c.course })}
                        title={st.text}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors",
                          st.kind === "free"
                            ? "border-border hover:border-primary hover:bg-primary-soft"
                            : "border-destructive/40 bg-destructive-soft/50 text-destructive",
                        )}
                      >
                        {g?.short ?? c.group} · {sheet.courses[c.course]?.short ?? c.course}
                        <span className="num ms-1 font-normal text-muted-foreground">×{c.n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {gradeBlocks.map(([program, groups]) => (
              <div key={program}>
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{program}</p>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => {
                    const st = status(g.id);
                    return (
                      <button
                        key={g.id}
                        disabled={st.kind === "none"}
                        onClick={() => {
                          setGroup(g.id);
                          setCourse("");
                        }}
                        title={`${g.label} — ${st.text}`}
                        className={cn(
                          "min-w-11 rounded-lg border px-2 py-1 text-xs font-bold transition-all disabled:opacity-30",
                          gradeTone(g.gradeOrder),
                          group === g.id
                            ? "border-primary ring-2 ring-primary/40"
                            : st.kind === "busy"
                              ? "border-destructive/50 opacity-70"
                              : "border-transparent hover:border-primary/50",
                        )}
                      >
                        {g.short}
                        {st.kind === "busy" && <span className="ms-0.5 text-destructive">•</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {group && (
              <div className="rounded-xl border border-border bg-muted/30 p-2">
                <p className="mb-1.5 text-[11px] font-semibold">
                  مادة {index.groups.get(group)?.short}
                  <span
                    className={cn(
                      "ms-2 font-normal",
                      status(group).kind === "free" ? "text-success" : "text-destructive",
                    )}
                  >
                    {status(group).text}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {groupCourses.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCourse(c.id)}
                      className={cn(
                        "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                        course === c.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-secondary",
                        !c.mine && course !== c.id && "text-muted-foreground",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                  {groupCourses.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">لا مواد معرّفة لهذا الصف.</p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                المادة (وعدد حصصها في الأسبوع)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sectionCourses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCourse(c.id);
                      setQuery("");
                      const mine = (index.groupSlots.get(target.row) ?? []).find(
                        (s) => s.course === c.id && s.instructor,
                      );
                      if (mine) setInstructor(mine.instructor);
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                      course === c.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-secondary",
                    )}
                  >
                    {c.label}
                    <span className="num ms-1 font-normal opacity-70">×{c.n}</span>
                  </button>
                ))}
              </div>
            </div>
            {course && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">المعلم</p>
                <div className="space-y-1">
                  {teacherOptions.slice(0, 40).map(({ t, rank, busy, load }) => (
                    <button
                      key={t.id}
                      onClick={() => setInstructor(t.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-right text-xs",
                        instructor === t.id
                          ? "border-primary bg-primary-soft"
                          : "border-transparent hover:bg-secondary",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
                      {rank === 0 && (
                        <span className="text-[10px] text-primary">يدرّسها للشعبة</span>
                      )}
                      {rank === 1 && (
                        <span className="text-[10px] text-muted-foreground">يدرّس المادة</span>
                      )}
                      <span className="num text-[10px] text-muted-foreground">
                        {load}
                        {t.quota ? `/${t.quota}` : ""}
                      </span>
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          busy ? "bg-destructive" : "bg-success",
                        )}
                        title={busy ? `مشغول في ${index.groups.get(busy.group)?.short}` : "متاح"}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {sheet.rooms.length > 0 && group && course && (
          <label className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">القاعة</span>
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="h-7 flex-1 rounded-md border border-border bg-background px-1.5 text-xs"
            >
              <option value="">— بلا قاعة —</option>
              {sheet.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-2">
        <button
          disabled={!ready}
          onClick={() => apply()}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-gradient text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          <Check className="size-3.5" />
          {current ? "تعديل الخانة" : "وضع الحصة"}
        </button>
        {current && (
          <button
            onClick={onClear}
            className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
          >
            <Eraser className="size-3.5" />
            مسح
          </button>
        )}
      </div>
    </div>
  );
}

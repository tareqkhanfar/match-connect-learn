/**
 * The school sheet's rules, run in the browser on every change.
 *
 * Mirrors `school_timetable.validate` on the server rule for rule: the page
 * lights a clash the moment it is made, and the save runs the same checks
 * again so nothing the browser missed reaches the register.
 */
import type { SchoolSheet, SheetGroup, SheetProblem, SheetSlot } from "@/lib/api/school-timetable";

export type CellState = "error" | "legacy" | "warning";

export interface WeekCheck {
  problems: SheetProblem[];
  /** The worst state of each slot key. */
  byKey: Map<string, CellState>;
  /** The problems each slot key takes part in. */
  problemsOf: Map<string, SheetProblem[]>;
  errors: number;
  legacy: number;
  warnings: number;
}

export function clockOf(group: SheetGroup | undefined, period: number) {
  return group?.clock.find((p) => p.order === period);
}

/** Whether a slot is new, or no longer matches the stored lesson it came from. */
export function differs(slot: SheetSlot, original: Map<string, SheetSlot>): boolean {
  const old = slot.id ? original.get(slot.id) : undefined;
  if (!old) return true;
  return (
    old.day !== slot.day ||
    old.period !== slot.period ||
    old.group !== slot.group ||
    old.course !== slot.course ||
    old.instructor !== slot.instructor ||
    old.room !== slot.room
  );
}

export function checkWeek(
  slots: SheetSlot[],
  sheet: SchoolSheet,
  original: Map<string, SheetSlot>,
  limits: Record<string, number>,
): WeekCheck {
  const groups = new Map(sheet.groups.map((g) => [g.id, g]));
  const teachers = new Map(sheet.teachers.map((t) => [t.id, t]));
  const dayLabel = new Map(sheet.days.map((d) => [d.value, d.label]));
  const problems: SheetProblem[] = [];
  const at = (s: SheetSlot) => `${dayLabel.get(s.day) ?? s.day} ح${s.period}`;
  const gname = (g: string) => groups.get(g)?.short ?? g;
  const tname = (t: string) => teachers.get(t)?.name ?? t;
  const clock = (s: SheetSlot) => clockOf(groups.get(s.group), s.period);

  for (const s of slots) {
    const g = groups.get(s.group);
    if (!g) {
      problems.push({
        kind: "group",
        level: "error",
        keys: [s.k],
        message: `شعبة غير معروفة (${at(s)})`,
      });
    } else if (!clock(s)) {
      problems.push({
        kind: "time",
        level: "error",
        keys: [s.k],
        message: `${gname(s.group)}: لا توجد الحصة ${s.period} في يومها الدراسي (${at(s)})`,
      });
    }
    if (!s.course) {
      problems.push({
        kind: "course",
        level: "error",
        keys: [s.k],
        message: `${gname(s.group)}: بلا مادة (${at(s)})`,
      });
    } else if (g && !g.courses.includes(s.course)) {
      problems.push({
        kind: "course",
        level: "warning",
        keys: [s.k],
        message: `${gname(s.group)}: «${s.course}» ليست من مواد صفها (${at(s)})`,
      });
    }
    if (!s.instructor) {
      problems.push({
        kind: "teacher",
        level: "warning",
        keys: [s.k],
        message: `${gname(s.group)}: حصة بلا معلم — لن تُولَّد (${at(s)})`,
      });
    }
  }

  // A section in two lessons at once.
  const byCell = new Map<string, SheetSlot[]>();
  for (const s of slots) {
    const key = `${s.group}|${s.day}|${s.period}`;
    byCell.set(key, [...(byCell.get(key) ?? []), s]);
  }
  for (const items of byCell.values()) {
    if (items.length < 2) continue;
    const who = [
      ...new Set(items.map((i) => (i.instructor ? tname(i.instructor) : "")).filter(Boolean)),
    ].join("، ");
    problems.push({
      kind: "group",
      level: "error",
      keys: items.map((i) => i.k),
      message: `${gname(items[0]!.group)} في ${items.length} حصص معاً (${at(items[0]!)}): ${who}`,
    });
  }

  // A teacher, or a room, in two places at once — by each section's own clock.
  for (const [field, kind, label] of [
    ["instructor", "teacher", tname],
    ["room", "room", (r: string) => r],
  ] as const) {
    const byOwner = new Map<string, SheetSlot[]>();
    for (const s of slots) {
      const owner = s[field];
      if (!owner || !clock(s)) continue;
      const key = `${owner}|${s.day}`;
      byOwner.set(key, [...(byOwner.get(key) ?? []), s]);
    }
    for (const [key, raw] of byOwner) {
      const items = [...raw].sort((a, b) => clock(a)!.from.localeCompare(clock(b)!.from));
      const owner = key.split("|")[0]!;
      for (let i = 0; i < items.length; i++) {
        const a = items[i]!;
        const ca = clock(a)!;
        for (let j = i + 1; j < items.length; j++) {
          const b = items[j]!;
          const cb = clock(b)!;
          if (cb.from >= ca.to) break;
          if (cb.from < ca.to && ca.from < cb.to) {
            problems.push({
              kind,
              level: "error",
              keys: [a.k, b.k],
              message: `${label(owner)} في ${gname(a.group)} و${gname(b.group)} معاً (${at(a)})`,
            });
          }
        }
      }
    }
  }

  // النصاب.
  const counts = new Map<string, string[]>();
  for (const s of slots)
    if (s.instructor) counts.set(s.instructor, [...(counts.get(s.instructor) ?? []), s.k]);
  for (const [t, keys] of counts) {
    const quota = teachers.get(t)?.quota ?? 0;
    if (quota && keys.length > quota) {
      problems.push({
        kind: "quota",
        level: "error",
        keys,
        message: `${tname(t)}: ${keys.length} حصة تتجاوز النصاب (${quota})`,
      });
    }
  }

  // One subject too many times in a day.
  const perDay = new Map<string, SheetSlot[]>();
  for (const s of slots) {
    if (!s.course) continue;
    const key = `${s.group}|${s.course}|${s.day}`;
    perDay.set(key, [...(perDay.get(key) ?? []), s]);
  }
  for (const items of perDay.values()) {
    const s = items[0]!;
    const limit =
      limits[`${s.group}#${s.course}`] ||
      sheet.limits[`${s.group}#${s.course}`] ||
      sheet.defaultLimit;
    if (items.length > limit) {
      problems.push({
        kind: "daily",
        level: "warning",
        keys: items.map((i) => i.k),
        message: `${gname(s.group)}: ${sheet.courses[s.course]?.subject ?? s.course} ${items.length} مرات ${dayLabel.get(s.day) ?? s.day} (الحد ${limit})`,
      });
    }
  }

  // An error blocks the save only if this edit takes part in it.
  const changed = new Set(slots.filter((s) => differs(s, original)).map((s) => s.k));
  for (const p of problems) {
    if (p.level === "error" && !p.keys.some((k) => changed.has(k))) p.legacy = true;
  }

  const rank: Record<CellState, number> = { warning: 1, legacy: 2, error: 3 };
  const byKey = new Map<string, CellState>();
  const problemsOf = new Map<string, SheetProblem[]>();
  for (const p of problems) {
    // The quota names every lesson of the teacher; colouring all of them red
    // would drown the real clashes, so it is listed but not painted.
    const state: CellState = p.level === "warning" ? "warning" : p.legacy ? "legacy" : "error";
    for (const k of p.keys) {
      problemsOf.set(k, [...(problemsOf.get(k) ?? []), p]);
      if (p.kind === "quota") continue;
      const current = byKey.get(k);
      if (!current || rank[state] > rank[current]) byKey.set(k, state);
    }
  }
  return {
    problems,
    byKey,
    problemsOf,
    errors: problems.filter((p) => p.level === "error" && !p.legacy).length,
    legacy: problems.filter((p) => p.legacy).length,
    warnings: problems.filter((p) => p.level === "warning").length,
  };
}

/** A soft colour per grade, so a teacher's row reads by stage at a glance. */
const GRADE_TONES = [
  "bg-sky-500/12 text-sky-900 dark:text-sky-100",
  "bg-emerald-500/12 text-emerald-900 dark:text-emerald-100",
  "bg-violet-500/12 text-violet-900 dark:text-violet-100",
  "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  "bg-teal-500/12 text-teal-900 dark:text-teal-100",
  "bg-fuchsia-500/12 text-fuchsia-900 dark:text-fuchsia-100",
  "bg-lime-500/15 text-lime-900 dark:text-lime-100",
  "bg-indigo-500/12 text-indigo-900 dark:text-indigo-100",
  "bg-orange-500/12 text-orange-900 dark:text-orange-100",
  "bg-cyan-500/12 text-cyan-900 dark:text-cyan-100",
  "bg-pink-500/12 text-pink-900 dark:text-pink-100",
  "bg-stone-500/15 text-stone-900 dark:text-stone-100",
  "bg-blue-500/12 text-blue-900 dark:text-blue-100",
  "bg-green-500/12 text-green-900 dark:text-green-100",
];

export function gradeTone(order: number): string {
  return GRADE_TONES[((order % GRADE_TONES.length) + GRADE_TONES.length) % GRADE_TONES.length]!;
}

/** A colour per subject in the section view, stable across loads. */
export function subjectTone(subject: string): string {
  let h = 0;
  for (const ch of subject) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return gradeTone(Math.abs(h));
}

/** Fold Arabic spelling variants so «احمد» finds «أحمد». */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

export const cellId = (row: string, day: string, period: number) => `${row}|${day}|${period}`;

/** Lookups the grid, the picker and the panels share, rebuilt on each change. */
export interface SheetIndex {
  groups: Map<string, SheetGroup>;
  teachers: Map<string, SchoolSheet["teachers"][number]>;
  byTeacherCell: Map<string, SheetSlot[]>;
  byGroupCell: Map<string, SheetSlot[]>;
  teacherSlots: Map<string, SheetSlot[]>;
  groupSlots: Map<string, SheetSlot[]>;
  dayLabel: Map<string, string>;
  /** The teacher's lesson that overlaps this section's period, if any — by the clock. */
  teacherBusy: (
    teacher: string,
    group: string,
    day: string,
    period: number,
    exceptK?: string,
  ) => SheetSlot | undefined;
  /** The section's lesson in this period, if any. */
  groupBusy: (
    group: string,
    day: string,
    period: number,
    exceptK?: string,
  ) => SheetSlot | undefined;
}

export function buildIndex(slots: SheetSlot[], sheet: SchoolSheet): SheetIndex {
  const groups = new Map(sheet.groups.map((g) => [g.id, g]));
  const teachers = new Map(sheet.teachers.map((t) => [t.id, t]));
  const push = (map: Map<string, SheetSlot[]>, key: string, s: SheetSlot) => {
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  };
  const byTeacherCell = new Map<string, SheetSlot[]>();
  const byGroupCell = new Map<string, SheetSlot[]>();
  const teacherSlots = new Map<string, SheetSlot[]>();
  const groupSlots = new Map<string, SheetSlot[]>();
  for (const s of slots) {
    if (s.instructor) {
      push(byTeacherCell, cellId(s.instructor, s.day, s.period), s);
      push(teacherSlots, s.instructor, s);
    }
    push(byGroupCell, cellId(s.group, s.day, s.period), s);
    push(groupSlots, s.group, s);
  }
  return {
    groups,
    teachers,
    byTeacherCell,
    byGroupCell,
    teacherSlots,
    groupSlots,
    dayLabel: new Map(sheet.days.map((d) => [d.value, d.label])),
    teacherBusy(teacher, group, day, period, exceptK) {
      const at = clockOf(groups.get(group), period);
      for (const s of teacherSlots.get(teacher) ?? []) {
        if (s.day !== day || s.k === exceptK) continue;
        const c = clockOf(groups.get(s.group), s.period);
        if (!at || !c) {
          if (s.period === period) return s;
          continue;
        }
        if (c.from < at.to && at.from < c.to) return s;
      }
      return undefined;
    },
    groupBusy(group, day, period, exceptK) {
      return (byGroupCell.get(cellId(group, day, period)) ?? []).find((s) => s.k !== exceptK);
    },
  };
}

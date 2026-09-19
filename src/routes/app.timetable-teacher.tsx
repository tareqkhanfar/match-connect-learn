import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarCog,
  Check,
  ClipboardPaste,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Move,
  Pencil,
  Redo2,
  Undo2,
  Eraser,
  Info,
  Plus,
  Save,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useConfirm } from "@/components/shared/confirm";
import { TimetableImportDialog } from "@/components/shared/timetable-import-dialog";
import { Input } from "@/components/ui/input";
import {
  CellMenu,
  CellMenuGroup,
  CellMenuItem,
  CellMenuLabel,
  CellMenuSeparator,
} from "@/components/shared/cell-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import {
  useCheckTeacherSlots,
  usePattern,
  useSaveRecordFields,
  useSaveTeacherPattern,
  useTakenPeriods,
  useTeacherAssignments,
  useTeacherGridOptions,
  type GridSlot,
  type TakenPeriod,
  type TeacherAssignment,
  type TeacherProblem,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/timetable-teacher")({
  head: () => ({
    meta: [
      { title: "بناء الجدول حسب المعلم — Match Education" },
      {
        name: "description",
        content: "إدخال جدول المدرسة معلماً معلماً مع احتساب النصاب الأسبوعي وكشف التعارضات.",
      },
    ],
  }),
  component: TeacherTimetablePage,
});

const cellKey = (day: string, period: number) => `${day}#${period}`;
const rowKey = (group: string, course: string) => `${group}#${course}`;

type Cell = { studentGroup: string; course: string; room: string | null };
type Row = TeacherAssignment;

function TeacherTimetablePage() {
  const options = useTeacherGridOptions();
  const confirm = useConfirm();

  const [instructor, setInstructor] = useState("");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState("");
  const [dirty, setDirty] = useState(false);
  const [importing, setImporting] = useState(false);

  // Editing the week: every change is undoable, a click selects rather than
  // deletes, and moving or swapping obeys the same rules as placing.
  const [past, setPast] = useState<Array<Record<string, Cell>>>([]);
  const [future, setFuture] = useState<Array<Record<string, Cell>>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ kind: "move" | "swap"; from: string } | null>(null);
  const [clip, setClip] = useState<Cell | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [changeGroup, setChangeGroup] = useState("");
  const [changeCourse, setChangeCourse] = useState("");
  const navigate = useNavigate();

  // Adding a teacher's subjects: several sections at once, because a teacher
  // usually takes the same subject across a whole grade.
  const [adding, setAdding] = useState(false);
  const [pickedGroups, setPickedGroups] = useState<string[]>([]);
  const [pickCourse, setPickCourse] = useState("");
  const [pickPerWeek, setPickPerWeek] = useState(1);
  const [groupSearch, setGroupSearch] = useState("");

  const pattern = usePattern(instructor ? { instructor } : {});
  const assignments = useTeacherAssignments(instructor || undefined);
  const taken = useTakenPeriods(instructor || undefined);
  const save = useSaveTeacherPattern();
  const saveQuota = useSaveRecordFields("Instructor", instructor);
  const check = useCheckTeacherSlots();
  const [problems, setProblems] = useState<TeacherProblem[]>([]);

  const groups = options.data?.groups ?? [];
  const periods = (options.data?.periods ?? []).filter((p) => !p.isBreak);
  const workingDays = options.data?.workingDays ?? [];
  const days = (options.data?.days ?? []).filter((d) => workingDays.includes(d.value));

  const teacher = (options.data?.instructors ?? []).find((i) => i.name === instructor);
  const quota = assignments.data?.quota ?? teacher?.quota ?? 0;
  const [quotaDraft, setQuotaDraft] = useState("");
  useEffect(() => setQuotaDraft(quota ? String(quota) : ""), [quota, instructor]);

  // The saved week is the starting point; edits live on top until saved.
  useEffect(() => {
    const next: Record<string, Cell> = {};
    for (const s of pattern.data?.slots ?? []) {
      if (!s.course || !s.studentGroup) continue;
      next[cellKey(s.day, s.period)] = {
        studentGroup: s.studentGroup,
        course: s.course,
        room: s.room ?? null,
      };
    }
    setCells(next);
    setDirty(false);
    setPast([]);
    setFuture([]);
    setSelected(null);
    setPending(null);
  }, [pattern.data]);

  useEffect(() => {
    setRows(assignments.data?.assignments ?? []);
    setActive("");
  }, [assignments.data]);

  useBlocker({
    shouldBlockFn: () => dirty && !save.isPending,
    withResolver: false,
    enableBeforeUnload: () => dirty && !save.isPending,
  });

  // What every other teacher already holds, so a section is never promised
  // twice — checked before a cell is filled rather than on save.
  const busy = useMemo(() => {
    const map = new Map<string, TakenPeriod>();
    for (const t of taken.data?.taken ?? [])
      map.set(`${cellKey(t.day, t.period)}|${t.studentGroup}`, t);
    return map;
  }, [taken.data]);

  // Counted from the grid rather than the server, so every figure on screen
  // moves with the click that caused it.
  const placedByRow = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of Object.values(cells)) {
      const k = rowKey(c.studentGroup, c.course);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [cells]);

  const perDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [key, c] of Object.entries(cells)) {
      const day = key.split("#")[0] as string;
      const k = `${day}|${rowKey(c.studentGroup, c.course)}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [cells]);

  const problemAt = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of problems) map.set(cellKey(p.day, p.period), p.message);
    return map;
  }, [problems]);

  const placed = Object.keys(cells).length;
  const overQuota = quota > 0 && placed > quota;
  const activeRow = rows.find((r) => rowKey(r.studentGroup, r.course) === active) ?? null;

  const groupLabel = (name: string) =>
    groups.find((g) => g.name === name)?.student_group_name || name;

  const remaining = (r: Row) =>
    r.required - (placedByRow.get(rowKey(r.studentGroup, r.course)) ?? 0);

  const dayOf = (key: string) => key.split("#")[0] as string;
  const describe = (c: Cell) => `${c.course} — ${groupLabel(c.studentGroup)}`;
  const rowFor = (c: Cell) =>
    rows.find((r) => rowKey(r.studentGroup, r.course) === rowKey(c.studentGroup, c.course));
  const cellOf = (r: Row): Cell => ({
    studentGroup: r.studentGroup,
    course: r.course,
    room: r.room,
  });

  function tally(map: Record<string, Cell>) {
    const byRow = new Map<string, number>();
    const byDay = new Map<string, number>();
    for (const [key, c] of Object.entries(map)) {
      const k = rowKey(c.studentGroup, c.course);
      byRow.set(k, (byRow.get(k) ?? 0) + 1);
      const d = `${dayOf(key)}|${k}`;
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    return { byRow, byDay, total: Object.keys(map).length };
  }

  /**
   * Why `next` may not replace the current week, or null when it may.
   *
   * One rulebook for every edit — add, move, swap, change, paste — so no path
   * through the menu can produce a week the plain click would have refused.
   * A limit is only enforced when the edit makes it worse: a week that was
   * already over (a requirement lowered after the fact) can still be tidied.
   */
  function violation(next: Record<string, Cell>, changed: string[]): string | null {
    const now = tally(cells);
    const then = tally(next);
    if (quota > 0 && then.total > quota && then.total > now.total) {
      return `اكتمل نصاب المعلم الأسبوعي (${quota} حصة)`;
    }
    for (const key of changed) {
      const c = next[key];
      if (!c) continue;
      const blocked = busy.get(`${key}|${c.studentGroup}`);
      if (blocked) {
        return `${groupLabel(c.studentGroup)} محجوزة في هذه الحصة${
          blocked.instructorName ? ` لدى ${blocked.instructorName}` : ""
        }`;
      }
      const k = rowKey(c.studentGroup, c.course);
      const row = rowFor(c);
      const dk = `${dayOf(key)}|${k}`;
      const max = row?.maxPerDay ?? 2;
      const dayThen = then.byDay.get(dk) ?? 0;
      if (dayThen > max && dayThen > (now.byDay.get(dk) ?? 0)) {
        return `لا تتجاوز ${max} حصة من ${describe(c)} في اليوم الواحد`;
      }
      const rowThen = then.byRow.get(k) ?? 0;
      if (row && rowThen > row.required && rowThen > (now.byRow.get(k) ?? 0)) {
        return `اكتمل عدد حصص ${describe(c)} (${row.required} أسبوعياً) — زِد «المطلوب» في بطاقة التكليف إن أردت`;
      }
    }
    return null;
  }

  /** Replace the week and remember the old one for undo. */
  function record(next: Record<string, Cell>) {
    setPast((p) => [...p.slice(-99), cells]);
    setFuture([]);
    setCells(next);
    setDirty(true);
  }

  function commit(next: Record<string, Cell>, changed: string[]): boolean {
    const why = violation(next, changed);
    if (why) {
      toast.error(why);
      return false;
    }
    record(next);
    return true;
  }

  function undo() {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture([cells, ...future].slice(0, 100));
    setCells(prev);
    setDirty(true);
    setSelected(null);
    setPending(null);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, cells].slice(-100));
    setCells(next);
    setDirty(true);
    setSelected(null);
  }

  // Toasts outlive the render that raised them; the undo they offer must be
  // the current one, not the one captured when the toast appeared.
  const undoRef = useRef(undo);
  undoRef.current = undo;

  function addAt(key: string, c: Cell) {
    if (cells[key]) return;
    if (commit({ ...cells, [key]: c }, [key])) setSelected(key);
  }

  function clearAt(key: string) {
    const c = cells[key];
    if (!c) return;
    const next = { ...cells };
    delete next[key];
    record(next);
    if (selected === key) setSelected(null);
    toast(`حُذفت حصة ${describe(c)}`, {
      duration: 4000,
      action: { label: "تراجع", onClick: () => undoRef.current() },
    });
  }

  /** Onto an empty cell it moves; onto a lesson the two trade places. */
  function moveOrSwap(from: string, to: string) {
    if (from === to) return;
    const a = cells[from];
    if (!a) return;
    const b = cells[to];
    const next = { ...cells, [to]: a };
    if (b) next[from] = b;
    else delete next[from];
    if (commit(next, b ? [to, from] : [to])) setSelected(to);
  }

  function replaceAt(key: string, c: Cell) {
    const old = cells[key];
    if (!old) {
      addAt(key, c);
      return;
    }
    if (rowKey(old.studentGroup, old.course) === rowKey(c.studentGroup, c.course)) return;
    if (commit({ ...cells, [key]: c }, [key])) setSelected(key);
  }

  function onCellClick(key: string) {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    if (pending) {
      const { from } = pending;
      setPending(null);
      if (key !== from) moveOrSwap(from, key);
      return;
    }
    if (cells[key]) {
      setSelected(selected === key ? null : key);
      return;
    }
    if (!activeRow) {
      setSelected(null);
      toast.info("اختر تكليفاً من القائمة، أو انقر بالزر الأيمن على الخلية لإضافة حصة");
      return;
    }
    addAt(key, cellOf(activeRow));
  }

  // Keyboard: the shortcuts every spreadsheet user already reaches for. Read by
  // physical key, so an Arabic keyboard layout works the same.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (
      !instructor ||
      (t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable))
    ) {
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === "KeyZ" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (mod && (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey))) {
      e.preventDefault();
      redo();
    } else if (mod && e.code === "KeyC" && selected && cells[selected]) {
      setClip(cells[selected]);
      toast.success("نُسخت الحصة — الصقها بالزر الأيمن على خلية فارغة", { duration: 1800 });
    } else if ((e.key === "Delete" || e.key === "Backspace") && selected && cells[selected]) {
      e.preventDefault();
      clearAt(selected);
    } else if (e.key === "Escape") {
      setPending(null);
      setSelected(null);
    }
  };
  useEffect(() => {
    const listen = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);

  // Dragging is done with pointer events rather than the browser's native
  // drag-and-drop: the native session swallowed the next right-click, and it
  // does not work on tablets at all. A few pixels of movement start a drag;
  // less than that is an ordinary click.
  const drag = useRef<{ from: string; x: number; y: number; active: boolean } | null>(null);
  const dropRef = useRef<string | null>(null);
  const swallowClick = useRef(false);
  const dropHandler = useRef<(from: string, to: string) => void>(() => {});
  dropHandler.current = moveOrSwap;

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
        d.active = true;
        setDragFrom(d.from);
        setSelected(d.from);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      }
      setGhost({ x: e.clientX, y: e.clientY });
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = (under?.closest("[data-cell]") as HTMLElement | null)?.dataset["cell"] ?? null;
      if (target !== dropRef.current) {
        dropRef.current = target;
        setDropOn(target);
      }
    }
    function finish(commitDrop: boolean) {
      const d = drag.current;
      drag.current = null;
      if (!d?.active) return;
      swallowClick.current = true;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      const target = dropRef.current;
      dropRef.current = null;
      setDragFrom(null);
      setDropOn(null);
      setGhost(null);
      if (commitDrop && target && target !== d.from) dropHandler.current(d.from, target);
      // The click that ends a drag fires right after pointerup, if at all —
      // when the pointer lands elsewhere there is none, and the next real
      // click must not be swallowed.
      setTimeout(() => {
        swallowClick.current = false;
      }, 0);
    }
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const closeMenu = () => setMenu(null);
  const then = (fn: () => void) => () => {
    setMenu(null);
    fn();
  };

  function renderMenu(m: { key: string; x: number; y: number }) {
    const { key } = m;
    const cell = cells[key];
    const day = days.find((d) => d.value === dayOf(key))?.label ?? "";
    const lesson = periods.findIndex((p) => p.order === Number(key.split("#")[1])) + 1;
    const rowItem = (r: Row, action: () => void, disabledSame: boolean) => {
      const k = rowKey(r.studentGroup, r.course);
      const taken = busy.get(`${key}|${r.studentGroup}`);
      return (
        <CellMenuItem
          key={k}
          disabled={disabledSame || !!taken}
          onSelect={then(action)}
          hint={taken ? "محجوزة" : `${remaining(r)} متبقٍ`}
        >
          {r.course} — {r.studentGroupName}
        </CellMenuItem>
      );
    };
    return (
      <CellMenu x={m.x} y={m.y} onClose={closeMenu}>
        <CellMenuLabel muted>
          {day} — الحصة {lesson}
        </CellMenuLabel>
        {cell ? (
          <>
            <CellMenuLabel>{describe(cell)}</CellMenuLabel>
            <CellMenuSeparator />
            <CellMenuGroup icon={<Pencil />} title="تغيير إلى تكليف آخر" disabled={rows.length < 2}>
              {rows.map((r) =>
                rowItem(
                  r,
                  () => replaceAt(key, cellOf(r)),
                  rowKey(r.studentGroup, r.course) === rowKey(cell.studentGroup, cell.course),
                ),
              )}
            </CellMenuGroup>
            <CellMenuItem icon={<Pencil />} onSelect={then(() => openChange(key))}>
              تغيير إلى شعبة أو مادة أخرى…
            </CellMenuItem>
            <CellMenuSeparator />
            <CellMenuItem
              icon={<ArrowLeftRight />}
              onSelect={then(() => setPending({ kind: "swap", from: key }))}
            >
              تبديل مع حصة أخرى…
            </CellMenuItem>
            <CellMenuItem
              icon={<Move />}
              onSelect={then(() => setPending({ kind: "move", from: key }))}
            >
              نقل إلى خلية أخرى…
            </CellMenuItem>
            <CellMenuItem
              icon={<Copy />}
              hint="Ctrl+C"
              onSelect={then(() => {
                setClip(cell);
                toast.success("نُسخت الحصة — الصقها بالزر الأيمن على خلية فارغة", {
                  duration: 1800,
                });
              })}
            >
              نسخ
            </CellMenuItem>
            <CellMenuItem
              icon={<Check />}
              disabled={!rowFor(cell)}
              onSelect={then(() => setActive(rowKey(cell.studentGroup, cell.course)))}
            >
              اعتمادها للإضافة بالنقر
            </CellMenuItem>
            <CellMenuSeparator />
            <CellMenuItem
              icon={<ExternalLink />}
              onSelect={then(
                () =>
                  void navigate({
                    to: "/app/timetable-grid",
                    search: { group: cell.studentGroup },
                  }),
              )}
            >
              فتح جدول الشعبة
            </CellMenuItem>
            <CellMenuSeparator />
            <CellMenuItem icon={<Trash2 />} hint="Del" danger onSelect={then(() => clearAt(key))}>
              حذف الحصة
            </CellMenuItem>
          </>
        ) : (
          <>
            <CellMenuSeparator />
            {rows.length ? (
              <CellMenuGroup icon={<Plus />} title="إضافة حصة" defaultOpen>
                {rows.map((r) => rowItem(r, () => addAt(key, cellOf(r)), false))}
              </CellMenuGroup>
            ) : null}
            <CellMenuItem icon={<Plus />} onSelect={then(() => openChange(key))}>
              إضافة شعبة أو مادة أخرى…
            </CellMenuItem>
            <CellMenuItem
              icon={<ClipboardPaste />}
              disabled={!clip}
              onSelect={then(() => clip && addAt(key, clip))}
            >
              لصق{clip ? ` ${describe(clip)}` : ""}
            </CellMenuItem>
          </>
        )}
      </CellMenu>
    );
  }

  function openChange(key: string) {
    const c = cells[key];
    setChangeGroup(c?.studentGroup ?? activeRow?.studentGroup ?? "");
    setChangeCourse(c?.course ?? "");
    setChanging(key);
  }

  function applyChange() {
    if (!changing || !changeGroup || !changeCourse) return;
    const c: Cell = { studentGroup: changeGroup, course: changeCourse, room: null };
    const k = rowKey(changeGroup, changeCourse);
    // A subject the teacher had no card for gets one, sized to what is placed
    // after this edit — so the edit itself does not trip the weekly count.
    const known = rows.some((r) => rowKey(r.studentGroup, r.course) === k);
    const old = cells[changing];
    if (old && rowKey(old.studentGroup, old.course) === k) {
      setChanging(null);
      return;
    }
    // Same rulebook as every other edit; a subject with no card yet simply has
    // no weekly count to exceed.
    if (!commit({ ...cells, [changing]: c }, [changing])) return;
    if (!known) {
      setRows((prev) => [
        ...prev,
        {
          studentGroup: changeGroup,
          studentGroupName: groupLabel(changeGroup),
          course: changeCourse,
          required: (placedByRow.get(k) ?? 0) + 1,
          maxPerDay: 2,
          room: null,
          placed: 0,
        },
      ]);
    }
    setSelected(changing);
    setChanging(null);
  }

  /** Fill what is still owed into free periods, spread across the week. */
  function autoFill() {
    const next = { ...cells };
    const dayTally = new Map(perDay);
    let total = Object.keys(next).length;
    let added = 0;
    const skipped: string[] = [];

    for (const r of [...rows].sort((a, b) => remaining(b) - remaining(a))) {
      const k = rowKey(r.studentGroup, r.course);
      let left =
        r.required -
        Object.values(next).filter((c) => rowKey(c.studentGroup, c.course) === k).length;
      if (left <= 0) continue;

      // Period-major so a subject lands on different days before it doubles up
      // on one, which is how a school reads a balanced week.
      outer: for (const p of periods) {
        for (const d of days) {
          if (left <= 0) break outer;
          if (quota > 0 && total >= quota) break outer;
          const key = cellKey(d.value, p.order);
          if (next[key]) continue;
          if (busy.has(`${key}|${r.studentGroup}`)) continue;
          if ((dayTally.get(`${d.value}|${k}`) ?? 0) >= r.maxPerDay) continue;
          next[key] = { studentGroup: r.studentGroup, course: r.course, room: r.room };
          dayTally.set(`${d.value}|${k}`, (dayTally.get(`${d.value}|${k}`) ?? 0) + 1);
          left -= 1;
          total += 1;
          added += 1;
        }
      }
      if (left > 0) skipped.push(`${groupLabel(r.studentGroup)} — ${r.course}: ${left}`);
    }

    if (added) record(next);
    if (added)
      toast.success(`تم توزيع ${added} حصة`, {
        action: { label: "تراجع", onClick: () => undoRef.current() },
      });
    if (skipped.length)
      toast.warning(`تعذّر توزيع: ${skipped.slice(0, 3).join("، ")}`, { duration: 6000 });
    if (!added && !skipped.length) toast.info("لا توجد حصص متبقية للتوزيع");
  }

  function addAssignments() {
    if (!pickedGroups.length || !pickCourse) {
      toast.error("اختر شعبة واحدة على الأقل والمادة");
      return;
    }
    setRows((prev) => {
      const next = [...prev];
      for (const g of pickedGroups) {
        const k = rowKey(g, pickCourse);
        const at = next.findIndex((r) => rowKey(r.studentGroup, r.course) === k);
        if (at >= 0) next[at] = { ...(next[at] as Row), required: pickPerWeek };
        else
          next.push({
            studentGroup: g,
            studentGroupName: groupLabel(g),
            course: pickCourse,
            required: pickPerWeek,
            maxPerDay: 2,
            room: null,
            placed: 0,
          });
      }
      return next;
    });
    setActive(rowKey(pickedGroups[0] as string, pickCourse));
    toast.success(`تمت إضافة ${pickedGroups.length} تكليف`);
    setPickedGroups([]);
    setPickCourse("");
    setAdding(false);
  }

  async function removeRow(r: Row) {
    const k = rowKey(r.studentGroup, r.course);
    const has = placedByRow.get(k) ?? 0;
    if (has > 0) {
      const ok = await confirm({
        title: "حذف التكليف",
        description: `سيُحذف ${has} حصة من جدول هذا المعلم لـ${r.studentGroupName} — ${r.course}.`,
        confirmLabel: "حذف",
      });
      if (!ok) return;
      const next: Record<string, Cell> = {};
      for (const [key, c] of Object.entries(cells))
        if (rowKey(c.studentGroup, c.course) !== k) next[key] = c;
      record(next);
    }
    setRows((prev) => prev.filter((x) => rowKey(x.studentGroup, x.course) !== k));
    if (active === k) setActive("");
  }

  const slotList = (): GridSlot[] =>
    Object.entries(cells).map(([key, cell]) => {
      const [day, period] = key.split("#");
      return {
        day: day as string,
        period: Number(period),
        course: cell.course,
        instructor,
        room: cell.room,
        studentGroup: cell.studentGroup,
      };
    });

  // Validate against the server whenever the week changes, so the grid shows
  // what the save would refuse before it is pressed.
  useEffect(() => {
    if (!instructor) return;
    const slots = slotList();
    if (!slots.length) {
      setProblems([]);
      return;
    }
    const t = setTimeout(() => {
      check.mutate(
        { instructor, slots },
        { onSuccess: (res) => setProblems(res.problems), onError: () => setProblems([]) },
      );
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, instructor]);

  function submit() {
    const slots = slotList();
    save.mutate(
      { instructor, slots },
      {
        onSuccess: (res) => {
          setDirty(false);
          void assignments.refetch();
          toast.success(`تم حفظ ${res.slots} حصة في ${res.groups.length} شعبة`);
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر حفظ الجدول")),
      },
    );
  }

  function saveQuotaValue() {
    const value = Number(quotaDraft || 0);
    if (!Number.isFinite(value) || value < 0) return;
    saveQuota.mutate(
      { ms_weekly_quota: value },
      {
        onSuccess: () => {
          void assignments.refetch();
          void options.refetch();
          toast.success("تم حفظ النصاب");
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر حفظ النصاب")),
      },
    );
  }

  async function switchTeacher(next: string) {
    if (dirty) {
      const ok = await confirm({
        title: "تغييرات غير محفوظة",
        description: "جدول هذا المعلم لم يُحفظ. الانتقال الآن سيُلغي التعديلات.",
        confirmLabel: "تجاهل التعديلات",
      });
      if (!ok) return;
    }
    setInstructor(next);
    setCells({});
    setDirty(false);
  }

  if (options.isLoading) return <TableSkeleton />;
  if (options.error) return <ErrorState error={options.error} onRetry={() => options.refetch()} />;

  const courseChoices = [
    ...new Set(
      (pickedGroups.length ? groups.filter((g) => pickedGroups.includes(g.name)) : groups).flatMap(
        (g) => g.courses,
      ),
    ),
  ].sort();

  return (
    <>
      <TimetableImportDialog open={importing} onOpenChange={setImporting} />
      <PageHeader
        title="بناء الجدول حسب المعلم"
        subtitle="اختر المعلم، أضف تكليفاته (شعبة ومادة وعدد حصص)، ثم وزّعها على الأسبوع"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImporting(true)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft/40 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
            >
              <FileSpreadsheet className="size-3.5" />
              استيراد من إكسل
            </button>
            <Link
              to="/app/timetable-grid"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <CalendarCog className="size-3.5" />
              البناء حسب الشعبة
            </Link>
            <button
              onClick={submit}
              disabled={!instructor || save.isPending || overQuota || problems.length > 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              حفظ جدول المعلم
            </button>
          </div>
        }
      />

      {/* Teacher and quota ------------------------------------------------ */}
      <div className="mt-6">
        <SectionCard
          title="المعلم والنصاب"
          description="النصاب هو أقصى عدد حصص أسبوعية لهذا المعلم — يمنع الحفظ عند تجاوزه"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">المعلم</p>
              <SearchableSelect
                options={(options.data?.instructors ?? []).map((i) => ({
                  value: i.name,
                  label: i.instructor_name || i.name,
                }))}
                value={instructor}
                onChange={(v) => void switchTeacher(v)}
                placeholder="اختر المعلم…"
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">النصاب الأسبوعي</p>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  min={0}
                  dir="ltr"
                  value={quotaDraft}
                  disabled={!instructor}
                  onChange={(e) => setQuotaDraft(e.target.value)}
                  placeholder="بدون نصاب"
                />
                <button
                  onClick={saveQuotaValue}
                  disabled={!instructor || saveQuota.isPending}
                  className="shrink-0 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                >
                  حفظ
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] text-muted-foreground">الموزّع حتى الآن</p>
              <p className="mt-1 text-lg font-bold tabular-nums">
                {placed}
                {quota > 0 && <span className="text-sm text-muted-foreground"> / {quota}</span>}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] text-muted-foreground">المتبقي من النصاب</p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${overQuota ? "text-destructive" : ""}`}
              >
                {quota > 0 ? quota - placed : "—"}
              </p>
            </div>
          </div>

          {overQuota && (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              عدد الحصص الموزّعة يتجاوز النصاب — احذف {placed - quota} حصة قبل الحفظ.
            </p>
          )}
        </SectionCard>
      </div>

      {/* Assignments ------------------------------------------------------ */}
      {instructor && (
        <div className="mt-6">
          <SectionCard
            title="تكليفات المعلم"
            description="اختر تكليفاً ثم اضغط على خلايا الأسبوع لتوزيعه — أو استخدم التوزيع التلقائي"
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAdding((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  <Plus className="size-3.5" />
                  إضافة تكليف
                </button>
                <button
                  onClick={autoFill}
                  disabled={!rows.length}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft disabled:opacity-50"
                >
                  <Shuffle className="size-3.5" />
                  توزيع تلقائي
                </button>
              </div>
            }
          >
            {adding && (
              <div className="mb-4 rounded-xl border border-primary/30 bg-primary-soft/20 p-3">
                <div className="grid gap-3 lg:grid-cols-[2fr_1fr_auto_auto]">
                  <div>
                    <p className="mb-1 text-[11px] font-medium">
                      الشعب ({pickedGroups.length} مختارة)
                    </p>
                    <Input
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="ابحث عن شعبة…"
                      className="mb-2"
                    />
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-card p-2">
                      {groups
                        .filter((g) =>
                          (g.student_group_name || g.name)
                            .toLowerCase()
                            .includes(groupSearch.toLowerCase()),
                        )
                        .map((g) => (
                          <label
                            key={g.name}
                            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-secondary"
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 accent-[var(--primary)]"
                              checked={pickedGroups.includes(g.name)}
                              onChange={(e) =>
                                setPickedGroups((prev) =>
                                  e.target.checked
                                    ? [...prev, g.name]
                                    : prev.filter((x) => x !== g.name),
                                )
                              }
                            />
                            <span className="truncate">{g.student_group_name || g.name}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium">المادة</p>
                    <SearchableSelect
                      options={courseChoices.map((c) => ({ value: c, label: c }))}
                      value={pickCourse}
                      onChange={setPickCourse}
                      placeholder="اختر المادة…"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium">حصص/أسبوع</p>
                    <Input
                      type="number"
                      min={1}
                      dir="ltr"
                      className="w-24"
                      value={pickPerWeek}
                      onChange={(e) => setPickPerWeek(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addAssignments}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
                    >
                      <Check className="size-3.5" />
                      إضافة
                    </button>
                  </div>
                </div>
              </div>
            )}

            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                لا توجد تكليفات لهذا المعلم بعد — أضف شعبة ومادة للبدء.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((r) => {
                  const k = rowKey(r.studentGroup, r.course);
                  const done = placedByRow.get(k) ?? 0;
                  const left = r.required - done;
                  return (
                    <div
                      key={k}
                      onClick={() => setActive(k)}
                      className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                        active === k
                          ? "border-primary bg-primary-soft/40"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{r.course}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {r.studentGroupName}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeRow(r);
                          }}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="حذف التكليف"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Pill tone={left === 0 ? "success" : left < 0 ? "danger" : "warning"}>
                          {done} / {r.required}
                        </Pill>
                        <span className="text-[11px] text-muted-foreground">
                          {left > 0 ? `متبقٍ ${left}` : left < 0 ? `زائد ${-left}` : "مكتمل"}
                        </span>
                        <label
                          className="ms-auto flex items-center gap-1 text-[10px] text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          المطلوب
                          <Input
                            type="number"
                            min={0}
                            dir="ltr"
                            className="h-7 w-14 px-1 text-xs"
                            value={r.required}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x) =>
                                  rowKey(x.studentGroup, x.course) === k
                                    ? { ...x, required: Math.max(0, Number(e.target.value) || 0) }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {problems.length > 0 && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
          <p className="flex items-center gap-2 text-xs font-bold text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {problems.length} تعارضاً يمنع الحفظ — الخلايا المعلّمة بالأحمر:
          </p>
          <ul className="mt-1.5 space-y-0.5 ps-6 text-[11px] text-destructive">
            {problems.slice(0, 5).map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* The week --------------------------------------------------------- */}
      <div className="mt-6">
        <SectionCard
          title={teacher ? `أسبوع ${teacher.instructor_name || teacher.name}` : "أسبوع المعلم"}
          description={
            activeRow
              ? `الإضافة بالنقر: ${activeRow.course} — ${activeRow.studentGroupName}`
              : "اختر تكليفاً من الأعلى، أو استخدم الزر الأيمن على أي خلية"
          }
          actions={
            instructor ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={undo}
                  disabled={!past.length}
                  title="تراجع (Ctrl+Z)"
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-40"
                >
                  <Undo2 className="size-3.5" />
                  تراجع
                </button>
                <button
                  onClick={redo}
                  disabled={!future.length}
                  title="إعادة (Ctrl+Y)"
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-40"
                >
                  <Redo2 className="size-3.5" />
                  إعادة
                </button>
                {placed > 0 && (
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: "تفريغ الأسبوع",
                        description: `ستُزال ${placed} حصة من جدول هذا المعلم (يمكن التراجع قبل الحفظ).`,
                        confirmLabel: "تفريغ",
                      });
                      if (ok) record({});
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    <Eraser className="size-3.5" />
                    تفريغ
                  </button>
                )}
              </div>
            ) : undefined
          }
        >
          {!instructor ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              اختر معلماً من القائمة أعلاه للبدء.
            </p>
          ) : periods.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              لم يُعرَّف اليوم الدراسي بعد. عرّف الحصص من شاشة «البناء حسب الشعبة» ثم عُد إلى هنا.
            </p>
          ) : pattern.isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              {pending && cells[pending.from] && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">
                  <span className="font-medium">
                    {pending.kind === "swap"
                      ? `اختر الحصة التي تريد تبديل «${describe(cells[pending.from] as Cell)}» معها`
                      : `اختر الخلية التي تريد نقل «${describe(cells[pending.from] as Cell)}» إليها`}
                  </span>
                  <button
                    onClick={() => setPending(null)}
                    className="rounded-md border border-border bg-card px-2 py-0.5 hover:bg-secondary"
                  >
                    إلغاء (Esc)
                  </button>
                </div>
              )}
              <table className="w-full border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th className="w-24 text-xs font-medium text-muted-foreground">الحصة</th>
                    {days.map((d) => (
                      <th
                        key={d.value}
                        className="min-w-[10rem] rounded-lg bg-secondary/60 px-2 py-2 text-xs font-bold"
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p, index) => (
                    <tr key={p.order}>
                      <td className="whitespace-nowrap rounded-lg bg-secondary/40 px-2 py-2 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                        <span className="block font-bold">{index + 1}</span>
                        <span dir="ltr">{p.from}</span>
                      </td>
                      {days.map((d) => {
                        const key = cellKey(d.value, p.order);
                        const cell = cells[key];
                        const blocked = activeRow
                          ? busy.get(`${key}|${activeRow.studentGroup}`)
                          : undefined;
                        const problem = problemAt.get(key);
                        const isSelected = selected === key;
                        const isSource = pending?.from === key || dragFrom === key;
                        // While dragging, show whether letting go here would be accepted.
                        let dropState: "ok" | "bad" | null = null;
                        if (dragFrom && dropOn === key && dragFrom !== key) {
                          const a = cells[dragFrom];
                          if (a) {
                            const next = { ...cells, [key]: a };
                            if (cell) next[dragFrom] = cell;
                            else delete next[dragFrom];
                            dropState = violation(next, cell ? [key, dragFrom] : [key])
                              ? "bad"
                              : "ok";
                          }
                        }
                        const label = `${d.label} — الحصة ${index + 1}`;
                        return (
                          <td key={d.value} className="p-0 align-top">
                            <button
                              onClick={() => onCellClick(key)}
                              // Selected in the same event that opens the menu, so the
                              // two land in one render instead of racing each other.
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setPending(null);
                                setSelected(key);
                                setMenu({ key, x: e.clientX, y: e.clientY });
                              }}
                              data-cell={key}
                              data-filled={cell ? "1" : undefined}
                              onPointerDown={(e) => {
                                if (e.button !== 0 || !cell) return;
                                swallowClick.current = false;
                                drag.current = {
                                  from: key,
                                  x: e.clientX,
                                  y: e.clientY,
                                  active: false,
                                };
                              }}
                              title={
                                problem ??
                                (blocked
                                  ? `محجوزة لدى ${blocked.instructorName ?? "معلم آخر"}`
                                  : undefined)
                              }
                              className={`h-full min-h-[3.5rem] w-full select-none rounded-lg border px-2 py-2 text-right transition-all duration-150 ${
                                dropState === "ok"
                                  ? "border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/60"
                                  : dropState === "bad"
                                    ? "border-destructive bg-destructive/10 ring-2 ring-destructive/60"
                                    : problem
                                      ? "border-destructive bg-destructive/10"
                                      : cell
                                        ? "cursor-grab touch-none border-primary/30 bg-primary-soft/50 hover:border-primary/60 active:cursor-grabbing"
                                        : blocked
                                          ? "border-dashed border-border bg-secondary/40 text-muted-foreground"
                                          : pending
                                            ? "border-dashed border-amber-500/60 hover:bg-amber-500/10"
                                            : "border-dashed border-border/60 hover:border-primary/40 hover:bg-primary-soft/20"
                              } ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""} ${
                                isSource ? "opacity-50" : ""
                              }`}
                            >
                              {cell ? (
                                <>
                                  <span className="block truncate text-xs font-bold">
                                    {cell.course}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                    {groupLabel(cell.studentGroup)}
                                  </span>
                                </>
                              ) : blocked ? (
                                <span className="block truncate text-[11px]">
                                  {blocked.instructorName ?? "محجوزة"}
                                </span>
                              ) : (
                                <span className="block text-center text-[11px] text-muted-foreground/50">
                                  —
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  النقر على خلية فارغة يضيف التكليف المختار، والنقر على حصة يحدّدها فقط.{" "}
                  <b>اسحب الحصة</b> إلى خلية فارغة لنقلها أو إلى حصة أخرى لتبديلهما.{" "}
                  <b>الزر الأيمن</b> لكل الخيارات: تغيير، تبديل، نقل، نسخ ولصق، حذف. Ctrl+Z تراجع،
                  Ctrl+Y إعادة، Delete حذف المحدّدة، Esc إلغاء. الحفظ يستبدل جدول هذا المعلم وحده.
                </span>
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Right-click menu — one for the whole grid ------------------------- */}
      {menu && renderMenu(menu)}

      {/* The lesson being dragged, following the pointer ------------------- */}
      {ghost && dragFrom && cells[dragFrom] && (
        <div
          className="pointer-events-none fixed z-50 w-40 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-primary bg-card px-2 py-1.5 text-right shadow-xl"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <span className="block truncate text-xs font-bold">{cells[dragFrom]?.course}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {groupLabel(cells[dragFrom]?.studentGroup ?? "")}
          </span>
          {dropOn && dropOn !== dragFrom && (
            <span className="mt-0.5 block text-[10px] font-medium text-primary">
              {cells[dropOn] ? "إفلات للتبديل" : "إفلات للنقل"}
            </span>
          )}
        </div>
      )}

      {/* Change a lesson (or add one) to any section and subject ------------ */}
      <Dialog open={!!changing} onOpenChange={(o) => !o && setChanging(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{changing && cells[changing] ? "تغيير الحصة" : "إضافة حصة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {changing && cells[changing] && (
              <p className="rounded-lg bg-secondary/50 p-2 text-xs text-muted-foreground">
                الحالية: {describe(cells[changing] as Cell)}
              </p>
            )}
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">الشعبة</p>
              <SearchableSelect
                options={groups.map((g) => ({
                  value: g.name,
                  label: g.student_group_name || g.name,
                }))}
                value={changeGroup}
                onChange={(v) => {
                  setChangeGroup(v);
                  setChangeCourse("");
                }}
                placeholder="اختر الشعبة…"
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">المادة</p>
              <SearchableSelect
                options={(groups.find((g) => g.name === changeGroup)?.courses ?? []).map((c) => ({
                  value: c,
                  label: c,
                }))}
                value={changeCourse}
                onChange={setChangeCourse}
                placeholder={changeGroup ? "اختر المادة…" : "اختر الشعبة أولاً"}
                disabled={!changeGroup}
              />
            </div>
            {changing && changeGroup && busy.get(`${changing}|${changeGroup}`) && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5" />
                هذه الشعبة محجوزة في هذه الحصة لدى{" "}
                {busy.get(`${changing}|${changeGroup}`)?.instructorName ?? "معلم آخر"}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setChanging(null)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
            >
              إلغاء
            </button>
            <button
              onClick={applyChange}
              disabled={!changeGroup || !changeCourse}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Check className="size-3.5" />
              تطبيق
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

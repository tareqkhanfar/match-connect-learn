import { createFileRoute, useBlocker, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  Clipboard,
  Eraser,
  ExternalLink,
  Expand,
  Shrink,
  FileSpreadsheet,
  Loader2,
  PanelTopClose,
  PanelTopOpen,
  Printer,
  RefreshCw,
  Redo2,
  Save,
  Search,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { PageHeader, ProgressBar } from "@/components/shared/ui-kit";
import { DashboardSkeleton, ErrorState } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { TimetableImportDialog } from "@/components/shared/timetable-import-dialog";
import { Segmented, StatTile } from "@/components/reports/report-kit";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  CellPicker,
  type CellTarget,
  type SheetView,
} from "@/components/school-timetable/cell-picker";
import {
  SheetGrid,
  type CellAddress,
  type SheetRow,
} from "@/components/school-timetable/sheet-grid";
import { GenerateDialog } from "@/components/school-timetable/generate-dialog";
import { LoadTables, ProblemsPanel, SelectionPanel } from "@/components/school-timetable/panels";
import { errorMessage } from "@/lib/api/error-message";
import { downloadTable } from "@/lib/api/export";
import { fillTableFrame, getTableFrame } from "@/lib/api/print-designs";
import {
  useSaveSheet,
  useSchoolSheet,
  useSetQuota,
  useSheetJob,
  type SchoolSheet,
  type SheetJob,
  type SheetProblem,
  type SheetSlot,
} from "@/lib/api/school-timetable";
import { buildIndex, cellId, checkWeek, clockOf, differs, normalise } from "@/lib/school-timetable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/timetable-school")({
  head: () => ({
    meta: [
      { title: "بناء الجدول الدراسي للمدرسة — Match Education" },
      {
        name: "description",
        content:
          "جدول المدرسة كله على ورقة واحدة: المعلمون والشعب والحصص، مع كشف التعارضات والأنصبة وتوليد حصص الفصل.",
      },
    ],
  }),
  component: SchoolTimetablePage,
});

function SchoolTimetablePage() {
  const sheet = useSchoolSheet();
  // Bumped on an explicit reload, so the draft is rebuilt from the server —
  // and only then: a background refetch must never wipe unsaved work.
  const [version, setVersion] = useState(0);
  if (sheet.isLoading) return <DashboardSkeleton />;
  if (sheet.error || !sheet.data)
    return (
      <ErrorState
        title="تعذّر تحميل جدول المدرسة"
        error={sheet.error}
        onRetry={() => void sheet.refetch()}
      />
    );
  return (
    <Builder
      key={version}
      sheet={sheet.data}
      reload={async () => {
        await sheet.refetch();
        setVersion((v) => v + 1);
      }}
    />
  );
}

const HEADER_KEY = "ms-timetable-school-header-hidden";
let seq = 0;
const newKey = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;
const fromServer = (slots: SchoolSheet["slots"]): SheetSlot[] =>
  slots.map((s) => ({ ...s, k: s.id }));

type Filters = {
  q: string;
  program: string;
  group: string;
  subject: string;
  day: string;
  onlyProblems: boolean;
  sort: "name" | "most" | "least";
};

function Builder({ sheet: loaded, reload }: { sheet: SchoolSheet; reload: () => Promise<void> }) {
  const qc = useQueryClient();
  const save = useSaveSheet();
  const setQuotaM = useSetQuota();

  const [slots, setSlots] = useState<SheetSlot[]>(() => fromServer(loaded.slots));
  const [original, setOriginal] = useState(
    () => new Map(fromServer(loaded.slots).map((s) => [s.id, s])),
  );
  const [past, setPast] = useState<SheetSlot[][]>([]);
  const [future, setFuture] = useState<SheetSlot[][]>([]);
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [limits, setLimits] = useState<Record<string, number>>(() => ({ ...loaded.limits }));
  const [limitEdits, setLimitEdits] = useState<Record<string, number>>({});
  const [view, setView] = useState<SheetView>("teachers");
  const [filters, setFilters] = useState<Filters>({
    q: "",
    program: "",
    group: "",
    subject: "",
    day: "",
    onlyProblems: false,
    sort: "name",
  });
  const [showTimes, setShowTimes] = useState(false);
  // Opened from «فتح في تاب جديد»: no sidebar or header around the page.
  const full = useRouterState({
    select: (s) => Boolean((s.location.search as Record<string, unknown>)["full"]),
  });
  const [screenFull, setScreenFull] = useState(false);
  useEffect(() => {
    const sync = () => setScreenFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  function toggleScreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen?.()
        .catch(() => toast.error("المتصفح لم يسمح بملء الشاشة"));
  }
  function openTab() {
    if (
      dirty &&
      !window.confirm(
        "التعديلات غير المحفوظة لا تنتقل إلى التاب الجديد — احفظها أولاً لتظهر فيه. فتح التاب على أي حال؟",
      )
    )
      return;
    window.open("/app/timetable-school?full=1", "_blank", "noopener");
  }
  // The header — title, figures, filters — folds away so the sheet gets the
  // screen. Remembered per browser: whoever builds the week wants it the same
  // way next time.
  const [headerHidden, setHeaderHidden] = useState(() => {
    try {
      return localStorage.getItem(HEADER_KEY) === "1";
    } catch {
      return false;
    }
  });
  function toggleHeader() {
    setHeaderHidden((h) => {
      try {
        localStorage.setItem(HEADER_KEY, h ? "0" : "1");
      } catch {
        /* private window: the choice lasts this visit only */
      }
      return !h;
    });
  }
  const [selected, setSelected] = useState<CellAddress | null>(null);
  const [picker, setPicker] = useState<CellTarget | null>(null);
  const [hoverKeys, setHoverKeys] = useState<string[] | null>(null);
  const [focusProblem, setFocusProblem] = useState<SheetProblem | null>(null);
  const [clipboard, setClipboard] = useState<Pick<
    SheetSlot,
    "group" | "course" | "instructor" | "room"
  > | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [polling, setPolling] = useState(loaded.job?.state === "running");
  const job = useSheetJob(polling);
  const gridRef = useRef<HTMLDivElement>(null);

  // The teachers as the sheet should judge them: quotas edited here count at once.
  const sheet = useMemo<SchoolSheet>(
    () => ({
      ...loaded,
      limits,
      teachers: loaded.teachers.map((t) => (t.id in quotas ? { ...t, quota: quotas[t.id]! } : t)),
    }),
    [loaded, quotas, limits],
  );
  const index = useMemo(() => buildIndex(slots, sheet), [slots, sheet]);
  const check = useMemo(
    () => checkWeek(slots, sheet, original, limits),
    [slots, sheet, original, limits],
  );

  const changes = useMemo(() => {
    const present = new Set(slots.map((s) => s.id).filter(Boolean));
    let removed = 0;
    for (const id of original.keys()) if (!present.has(id)) removed++;
    return (
      slots.filter((s) => differs(s, original)).length + removed + Object.keys(limitEdits).length
    );
  }, [slots, original, limitEdits]);
  const dirty = changes > 0;

  const jobState: SheetJob | undefined = job.data ?? loaded.job;
  const running = jobState?.state === "running";
  const summary = job.data?.generation ?? loaded.generation;

  useEffect(() => {
    if (job.data && job.data.state !== "running") setPolling(false);
  }, [job.data]);

  useBlocker({
    shouldBlockFn: () => {
      if (!dirty || save.isPending) return false;
      return !window.confirm(
        "لديك تعديلات غير محفوظة في جدول المدرسة. الخروج الآن سيُلغيها.\n\nاضغط «موافق» للخروج دون حفظ، أو «إلغاء» للبقاء.",
      );
    },
    withResolver: false,
    enableBeforeUnload: () => dirty && !save.isPending,
  });

  // --- editing ------------------------------------------------------------------

  const commit = useCallback(
    (next: SheetSlot[]) => {
      setPast((p) => [...p.slice(-100), slots]);
      setFuture([]);
      setSlots(next);
    },
    [slots],
  );

  const cellList = useCallback(
    (cell: CellAddress) =>
      (view === "teachers" ? index.byTeacherCell : index.byGroupCell).get(
        cellId(cell.row, cell.day, cell.period),
      ) ?? [],
    [view, index],
  );

  function applyCell(
    cell: CellAddress,
    patch: { group: string; course: string; instructor: string; room: string },
  ) {
    const current = cellList(cell)[0];
    const fields =
      view === "teachers"
        ? { group: patch.group, course: patch.course, instructor: cell.row, room: patch.room }
        : { group: cell.row, course: patch.course, instructor: patch.instructor, room: patch.room };
    if (current) {
      commit(slots.map((s) => (s.k === current.k ? { ...s, ...fields } : s)));
    } else {
      commit([...slots, { k: newKey(), id: "", day: cell.day, period: cell.period, ...fields }]);
    }
    setPicker(null);
  }

  function clearCell(cell: CellAddress) {
    const keys = new Set(cellList(cell).map((s) => s.k));
    if (!keys.size) return;
    commit(slots.filter((s) => !keys.has(s.k)));
    setPicker(null);
  }

  function move(fromK: string, to: CellAddress) {
    const from = slots.find((s) => s.k === fromK);
    if (!from) return;
    const target = cellList(to).find((s) => s.k !== fromK);
    const placeFrom =
      view === "teachers"
        ? { day: to.day, period: to.period, instructor: to.row }
        : { day: to.day, period: to.period, group: to.row };
    if (
      from.day === to.day &&
      from.period === to.period &&
      (view === "teachers" ? from.instructor : from.group) === to.row
    )
      return;
    commit(
      slots.map((s) => {
        if (s.k === fromK) return { ...s, ...placeFrom };
        // Dropped on a lesson: the two swap places.
        if (target && s.k === target.k)
          return view === "teachers"
            ? { ...s, day: from.day, period: from.period, instructor: from.instructor }
            : { ...s, day: from.day, period: from.period, group: from.group };
        return s;
      }),
    );
  }

  function undo() {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture([slots, ...future]);
    setSlots(prev);
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setPast([...past, slots]);
    setSlots(next);
  }

  // --- filters ------------------------------------------------------------------

  const cellFilters = Boolean(filters.program || filters.group || filters.subject);
  const lit = useCallback(
    (s: SheetSlot) => {
      if (!cellFilters) return true;
      const g = index.groups.get(s.group);
      if (filters.program && g?.program !== filters.program) return false;
      if (filters.group && s.group !== filters.group) return false;
      if (filters.subject && (sheet.courses[s.course]?.subject ?? s.course) !== filters.subject)
        return false;
      return true;
    },
    [cellFilters, filters, index, sheet.courses],
  );
  const hasProblem = useCallback(
    (list: SheetSlot[]) => list.some((s) => check.byKey.has(s.k)),
    [check],
  );

  const days = filters.day ? sheet.days.filter((d) => d.value === filters.day) : sheet.days;
  const q = normalise(filters.q);

  const rows = useMemo<SheetRow[]>(() => {
    if (view === "teachers") {
      const list = sheet.teachers
        .filter((t) => !t.inactive || (index.teacherSlots.get(t.id)?.length ?? 0) > 0)
        .filter((t) => !q || normalise(t.name).includes(q))
        .filter((t) => {
          const mine = index.teacherSlots.get(t.id) ?? [];
          if (cellFilters) {
            const teachesSubject =
              !!filters.subject &&
              !filters.group &&
              !filters.program &&
              t.courses.some((c) => (sheet.courses[c]?.subject ?? c) === filters.subject);
            if (!mine.some(lit) && !teachesSubject) return false;
          }
          if (filters.onlyProblems) {
            const over = t.quota > 0 && mine.length > t.quota;
            if (!over && !hasProblem(mine)) return false;
          }
          return true;
        });
      const load = (id: string) => index.teacherSlots.get(id)?.length ?? 0;
      list.sort((a, b) =>
        filters.sort === "most"
          ? load(b.id) - load(a.id)
          : filters.sort === "least"
            ? load(a.id) - load(b.id)
            : a.name.localeCompare(b.name, "ar"),
      );
      return list.map((t) => {
        const n = load(t.id);
        const subjects = [
          ...new Set(
            (index.teacherSlots.get(t.id) ?? []).map(
              (s) => sheet.courses[s.course]?.short ?? s.course,
            ),
          ),
        ];
        const homeroom = t.homeroomOf.map((g) => index.groups.get(g)?.short ?? g);
        return {
          type: "row" as const,
          id: t.id,
          label: t.name,
          sub: [
            homeroom.length ? `مربي ${homeroom.join("، ")}` : "",
            subjects.slice(0, 3).join("، "),
          ]
            .filter(Boolean)
            .join(" · "),
          end: t.quota ? `${n}/${t.quota}` : `${n}`,
          endTone: t.quota ? (n > t.quota ? "bad" : n === t.quota ? "ok" : "warn") : undefined,
        };
      });
    }
    const out: SheetRow[] = [];
    let program = "\u0000";
    for (const g of sheet.groups) {
      if (filters.program && g.program !== filters.program) continue;
      if (filters.group && g.id !== filters.group) continue;
      if (q && !normalise(`${g.label} ${g.short}`).includes(q)) continue;
      const mine = index.groupSlots.get(g.id) ?? [];
      if (
        filters.subject &&
        !mine.some(lit) &&
        !g.courses.some((c) => (sheet.courses[c]?.subject ?? c) === filters.subject)
      )
        continue;
      if (filters.onlyProblems && !hasProblem(mine)) continue;
      if (g.program !== program) {
        program = g.program;
        const count = sheet.groups.filter((x) => x.program === g.program).length;
        out.push({
          type: "heading",
          id: g.program || g.id,
          label: g.program || "—",
          hint: `${count} شعبة`,
        });
      }
      const capacity = sheet.days.length * g.clock.length;
      const homeroom = g.homeroom ? (index.teachers.get(g.homeroom)?.name ?? "") : "";
      out.push({
        type: "row",
        id: g.id,
        label: g.label,
        sub: [homeroom && `مربي: ${homeroom}`, `${g.students} طالب`].filter(Boolean).join(" · "),
        end: `${mine.length}/${capacity}`,
        endTone: mine.length >= capacity ? "ok" : "warn",
      });
    }
    return out;
  }, [view, sheet, index, q, filters, cellFilters, lit, hasProblem]);

  const footer = useCallback(
    (day: string, period: number) => {
      if (view === "teachers") {
        const free = sheet.groups.filter(
          (g) => clockOf(g, period) && !index.byGroupCell.get(cellId(g.id, day, period))?.length,
        );
        return {
          value: free.length,
          title: free.length
            ? `شعب بلا حصة: ${free.map((g) => g.short).join("، ")}`
            : "كل الشعب لها حصة",
          tone: free.length ? ("warn" as const) : ("ok" as const),
        };
      }
      const busy = new Set(
        slots
          .filter((s) => s.day === day && s.period === period && s.instructor)
          .map((s) => s.instructor),
      );
      const free = sheet.teachers.filter((t) => !t.inactive && !busy.has(t.id)).length;
      return { value: free, title: `${free} معلماً بلا حصة في هذا الوقت`, tone: "ok" as const };
    },
    [view, sheet, index, slots],
  );

  // --- figures ------------------------------------------------------------------

  const figures = useMemo(() => {
    const capacity = sheet.groups.reduce((n, g) => n + sheet.days.length * g.clock.length, 0);
    const complete = sheet.groups.filter(
      (g) =>
        (index.groupSlots.get(g.id)?.length ?? 0) >= sheet.days.length * g.clock.length &&
        g.clock.length > 0,
    ).length;
    const active = sheet.teachers.filter((t) => !t.inactive);
    const withQuota = active.filter((t) => t.quota > 0);
    const over = withQuota.filter(
      (t) => (index.teacherSlots.get(t.id)?.length ?? 0) > t.quota,
    ).length;
    const exact = withQuota.filter(
      (t) => (index.teacherSlots.get(t.id)?.length ?? 0) === t.quota,
    ).length;
    const teaching = active.filter((t) => (index.teacherSlots.get(t.id)?.length ?? 0) > 0).length;
    return {
      capacity,
      complete,
      active: active.length,
      withQuota: withQuota.length,
      over,
      exact,
      teaching,
    };
  }, [sheet, index]);

  // --- saving -------------------------------------------------------------------

  async function doSave() {
    if (check.errors > 0) {
      toast.error(`عالج ${check.errors} خطأ قبل الحفظ — مؤشَّرة بالأحمر في الجدول`);
      const first = check.problems.find((p) => p.level === "error" && !p.legacy);
      if (first) focusOn(first);
      return;
    }
    try {
      const present = new Set(slots.map((s) => s.id).filter(Boolean));
      const r = await save.mutateAsync({
        changes: slots.filter((s) => differs(s, original)),
        deletes: [...original.keys()].filter((id) => !present.has(id)),
        limits: limitEdits,
      });
      const fresh = fromServer(r.slots);
      setSlots(fresh);
      setOriginal(new Map(fresh.map((s) => [s.id, s])));
      setPast([]);
      setFuture([]);
      setLimitEdits({});
      toast.success(
        `تم حفظ الجدول: ${r.created} جديدة، ${r.updated} معدّلة، ${r.removed} محذوفة` +
          (r.job ? " — تُحدَّث الحصص المولّدة في الخلفية" : ""),
      );
      if (r.job) {
        qc.setQueryData(["school-timetable", "job"], r.job);
        setPolling(true);
      }
      void qc.invalidateQueries({ queryKey: ["timetable"] });
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر حفظ الجدول"));
    }
  }

  async function saveQuota(teacher: string, quota: number) {
    try {
      await setQuotaM.mutateAsync({ instructor: teacher, quota });
      setQuotas((q) => ({ ...q, [teacher]: quota }));
      toast.success("تم حفظ النصاب");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر حفظ النصاب"));
    }
  }

  function setLimit(group: string, course: string, value: number) {
    const key = `${group}#${course}`;
    setLimits((l) => ({ ...l, [key]: value }));
    setLimitEdits((l) => ({ ...l, [key]: value }));
  }

  // --- focus, keyboard ------------------------------------------------------------

  function focusOn(p: SheetProblem) {
    setFocusProblem(p);
    const slot = slots.find((s) => s.k === p.keys[0]);
    if (!slot) return;
    const nextView: SheetView =
      p.kind === "group" || p.kind === "daily" || p.kind === "time" || !slot.instructor
        ? "sections"
        : "teachers";
    setView(nextView);
    setFilters((f) => ({
      ...f,
      q: "",
      program: "",
      group: "",
      subject: "",
      day: "",
      onlyProblems: false,
    }));
    const row = nextView === "teachers" ? slot.instructor : slot.group;
    const address = { row, day: slot.day, period: slot.period };
    setSelected(address);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        gridRef.current
          ?.querySelector(`[data-cell="${CSS.escape(cellId(row, slot.day, slot.period))}"]`)
          ?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      }),
    );
  }

  const focusKeys = useMemo(
    () =>
      new Set(
        hoverKeys ?? (focusProblem && focusProblem.kind !== "quota" ? focusProblem.keys : []),
      ),
    [hoverKeys, focusProblem],
  );

  const rowIds = rows.filter((r) => r.type === "row").map((r) => r.id);
  const columns = days.flatMap((d) =>
    sheet.periods.map((p) => ({ day: d.value, period: p.order })),
  );

  function onGridKey(e: React.KeyboardEvent) {
    if (picker || !selected) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, select, textarea")) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "c") {
      const s = cellList(selected)[0];
      if (s) {
        setClipboard({ group: s.group, course: s.course, instructor: s.instructor, room: s.room });
        toast.message("نُسخت الحصة — اختر خانة واضغط Ctrl+V");
      }
      return;
    }
    if (ctrl && e.key.toLowerCase() === "v" && clipboard) {
      e.preventDefault();
      applyCell(selected, clipboard);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      clearCell(selected);
      return;
    }
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [0, 1],
      ArrowRight: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    const delta = moves[e.key];
    if (!delta) return;
    e.preventDefault();
    const r = rowIds.indexOf(selected.row) + delta[0];
    const c =
      columns.findIndex((x) => x.day === selected.day && x.period === selected.period) + delta[1];
    const row = rowIds[Math.max(0, Math.min(rowIds.length - 1, r))];
    const col = columns[Math.max(0, Math.min(columns.length - 1, c))];
    if (!row || !col) return;
    const next = { row, day: col.day, period: col.period };
    setSelected(next);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-cell="${CSS.escape(cellId(row, col.day, col.period))}"] button`,
      )
      ?.focus();
  }

  // --- export -------------------------------------------------------------------

  const cellText = (row: string, day: string, period: number) =>
    cellList({ row, day, period })
      .map((s) =>
        view === "teachers"
          ? `${index.groups.get(s.group)?.short ?? s.group} ${sheet.courses[s.course]?.short ?? ""}`
          : `${sheet.courses[s.course]?.short ?? s.course} ${s.instructor ? (index.teachers.get(s.instructor)?.name ?? "") : ""}`,
      )
      .join(" / ");

  const title = view === "teachers" ? "جدول المدرسة حسب المعلمين" : "جدول المدرسة حسب الشعب";

  async function exportExcel() {
    const headers = [
      view === "teachers" ? "المعلم" : "الشعبة",
      ...columns.map((c) => `${index.dayLabel.get(c.day)} ح${c.period}`),
      view === "teachers" ? "النصاب" : "الحصص",
    ];
    const body = rows
      .filter((r): r is Extract<SheetRow, { type: "row" }> => r.type === "row")
      .map((r) => [r.label, ...columns.map((c) => cellText(r.id, c.day, c.period)), String(r.end)]);
    try {
      await downloadTable(title, headers, body);
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر التصدير"));
    }
  }

  function print() {
    const esc = (t: string) =>
      t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const head =
      `<tr><th rowspan="2">${view === "teachers" ? "المعلم" : "الشعبة"}</th>` +
      days.map((d) => `<th colspan="${sheet.periods.length}">${esc(d.label)}</th>`).join("") +
      `<th rowspan="2">${view === "teachers" ? "النصاب" : "الحصص"}</th></tr><tr>` +
      days.map(() => sheet.periods.map((p) => `<th>${p.order}</th>`).join("")).join("") +
      "</tr>";
    const body = rows
      .map((r) =>
        r.type === "heading"
          ? `<tr><td class="h" colspan="${columns.length + 2}">${esc(r.label)}</td></tr>`
          : `<tr><td class="n">${esc(r.label)}</td>${columns
              .map((c) => `<td>${esc(cellText(r.id, c.day, c.period)).replace(" ", "<br>")}</td>`)
              .join("")}<td>${esc(String(r.end))}</td></tr>`,
      )
      .join("");
    const table = `<table class="tp-table tt">${`<thead>${head}</thead>`}<tbody>${body}</tbody></table>`;
    const style = `<style>@page{size:A4 landscape;margin:7mm}body{font-family:Tahoma,system-ui,sans-serif}
      table.tt{border-collapse:collapse;width:100%;font-size:7.5px}table.tt th,table.tt td{border:1px solid #999;padding:1px 2px;text-align:center}
      table.tt td.n{text-align:right;white-space:nowrap;font-weight:700;font-size:8px}table.tt td.h{background:#eee;font-weight:700;text-align:right}
      table.tt thead th{background:#f2f2f2}</style>`;
    const date = new Date().toLocaleDateString("ar-EG-u-nu-latn");
    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) {
      toast.error("نافذة الطباعة محجوبة — اسمح بالنوافذ المنبثقة");
      return;
    }
    win.document.write(
      '<!doctype html><html dir="rtl"><body style="font-family:system-ui;padding:24px">جارٍ تجهيز الطباعة…</body></html>',
    );
    void getTableFrame().then((frame) => {
      if (win.closed) return;
      const html = frame
        ? fillTableFrame(frame, {
            title: esc(title),
            date: esc(date),
            count: String(rowIds.length),
            table,
          })
        : `<h3>${esc(title)}</h3><p style="font-size:10px;color:#666">${date}</p>${table}`;
      win.document.open();
      win.document.write(
        `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title>${style}</head><body>${html}</body></html>`,
      );
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    });
  }

  // --- options for the filter pickers -----------------------------------------------

  const programs = useMemo(
    () =>
      [...new Set(sheet.groups.map((g) => g.program).filter(Boolean))].map((p) => ({
        value: p,
        label: p,
      })),
    [sheet.groups],
  );
  const groupOptions = useMemo(
    () =>
      sheet.groups
        .filter((g) => !filters.program || g.program === filters.program)
        .map((g) => ({ value: g.id, label: g.label, code: g.short })),
    [sheet.groups, filters.program],
  );
  const subjects = useMemo(
    () =>
      [...new Set(Object.values(sheet.courses).map((c) => c.subject))]
        .sort((a, b) => a.localeCompare(b, "ar"))
        .map((s) => ({ value: s, label: s })),
    [sheet.courses],
  );
  const setF = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const anyFilter = Boolean(
    filters.q ||
    filters.program ||
    filters.group ||
    filters.subject ||
    filters.day ||
    filters.onlyProblems,
  );

  const pickerCurrent = picker ? cellList(picker)[0] : undefined;
  const audienceLabel = summary.audiences.find((a) => a.value === summary.audience)?.label ?? "";

  return (
    <div className="space-y-5">
      {!headerHidden && (
        <PageHeader
          title="بناء الجدول الدراسي للمدرسة"
          subtitle="المدرسة كلها على ورقة واحدة — صف لكل معلم أو شعبة، وعمود لكل حصة. التعارضات تظهر بالأحمر لحظة حدوثها."
        />
      )}

      {running && jobState && (
        <div className="card-surface flex flex-wrap items-center gap-3 border-primary/30 p-3">
          <Loader2 className="size-4 animate-spin text-primary" />
          <p className="text-sm font-semibold">
            {jobState.mode === "sync"
              ? "تحديث الحصص المولّدة لتطابق الجدول المحفوظ"
              : "جارٍ توليد حصص الفصل"}
            <span className="num ms-2 font-normal text-muted-foreground">
              {jobState.done ?? 0}/{jobState.total ?? 0}
              {jobState.current ? ` — ${jobState.current}` : ""}
            </span>
          </p>
          <div className="min-w-40 flex-1">
            <ProgressBar
              value={jobState.total ? ((jobState.done ?? 0) / jobState.total) * 100 : 0}
            />
          </div>
          <button
            onClick={() => setGenerateOpen(true)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            التفاصيل
          </button>
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6",
          headerHidden && "hidden",
        )}
      >
        <StatTile
          label="الحصص في الجدول"
          value={slots.length}
          hint={`من ${figures.capacity} خانة للشعب`}
          tone="info"
        />
        <StatTile
          label="شعب مكتملة"
          value={`${figures.complete}/${sheet.groups.length}`}
          hint="كل حصص أسبوعها مملوءة"
          tone={figures.complete === sheet.groups.length ? "good" : "warn"}
        />
        <StatTile
          label="المعلمون في الجدول"
          value={`${figures.teaching}/${figures.active}`}
          hint={
            figures.withQuota
              ? `${figures.exact} على النصاب تماماً · ${figures.over} فوقه`
              : "لم يُحدَّد نصاب لأي معلم"
          }
          tone={figures.over ? "bad" : "neutral"}
        />
        <StatTile
          label="أخطاء في تعديلاتك"
          value={check.errors}
          hint={check.legacy ? `${check.legacy} قائمة من قبل` : "تمنع الحفظ"}
          tone={check.errors ? "bad" : "good"}
        />
        <StatTile
          label="تنبيهات"
          value={check.warnings}
          hint="لا تمنع الحفظ"
          tone={check.warnings ? "warn" : "good"}
        />
        <StatTile
          label="الحصص المولّدة"
          value={summary.lessons}
          hint={
            summary.lessons ? `حتى ${summary.generatedTo} · ${audienceLabel}` : "لم تُولَّد بعد"
          }
          tone="neutral"
        />
      </div>

      {/* Actions */}
      <div className="card-surface flex flex-wrap items-center gap-2 p-3">
        <ToolButton
          onClick={toggleHeader}
          icon={headerHidden ? PanelTopOpen : PanelTopClose}
          label={headerHidden ? "إظهار الهيدر" : "إخفاء الهيدر"}
        />
        {full ? (
          <ToolButton
            onClick={toggleScreen}
            icon={screenFull ? Shrink : Expand}
            label={screenFull ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
          />
        ) : (
          <ToolButton onClick={openTab} icon={ExternalLink} label="فتح في تاب جديد" />
        )}
        {headerHidden && (
          <>
            <span
              className={cn(
                "num rounded-full px-2 py-0.5 text-[11px] font-bold",
                check.errors
                  ? "bg-destructive-soft text-destructive"
                  : "bg-success-soft text-success",
              )}
            >
              {check.errors ? `${check.errors} خطأ` : "بلا أخطاء"}
            </span>
            {anyFilter && (
              <button
                onClick={toggleHeader}
                className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary"
                title="الفلاتر في الهيدر — اضغط لإظهاره"
              >
                فلاتر مفعّلة
              </button>
            )}
          </>
        )}
        <div className="mx-1 h-6 w-px bg-border" />
        <Segmented
          value={view}
          onChange={(v) => {
            setView(v);
            setSelected(null);
            setPicker(null);
          }}
          options={[
            { key: "teachers", label: "حسب المعلمين" },
            { key: "sections", label: "حسب الشعب" },
          ]}
        />
        <div className="mx-1 h-6 w-px bg-border" />
        <ToolButton onClick={undo} disabled={!past.length} icon={Undo2} label="تراجع" />
        <ToolButton onClick={redo} disabled={!future.length} icon={Redo2} label="إعادة" />
        {selected && cellList(selected).length > 0 && (
          <>
            <ToolButton
              onClick={() => {
                const s = cellList(selected)[0]!;
                setClipboard({
                  group: s.group,
                  course: s.course,
                  instructor: s.instructor,
                  room: s.room,
                });
                toast.message("نُسخت الحصة — اختر خانة واضغط «لصق» أو Ctrl+V");
              }}
              icon={Clipboard}
              label="نسخ"
            />
            <ToolButton onClick={() => clearCell(selected)} icon={Eraser} label="مسح الخانة" />
          </>
        )}
        {clipboard && selected && (
          <ToolButton onClick={() => applyCell(selected, clipboard)} icon={Clipboard} label="لصق" />
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <ToolButton
            onClick={() => {
              if (
                dirty &&
                !window.confirm("تحديث الجدول من الخادم يلغي تعديلاتك غير المحفوظة. متابعة؟")
              )
                return;
              void reload();
            }}
            icon={RefreshCw}
            label="تحديث"
          />
          <ToolButton
            onClick={() => setImportOpen(true)}
            icon={Upload}
            label="استيراد Excel"
            disabled={dirty}
          />
          <ToolButton onClick={() => void exportExcel()} icon={FileSpreadsheet} label="Excel" />
          <ToolButton onClick={print} icon={Printer} label="طباعة" />
          <button
            onClick={() => void doSave()}
            disabled={!dirty || save.isPending || running}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-50"
            title={running ? "انتظر انتهاء التوليد" : undefined}
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            حفظ الجدول
            {dirty && (
              <span className="num rounded-full bg-white/25 px-1.5 text-[11px]">{changes}</span>
            )}
          </button>
          <button
            onClick={() => setGenerateOpen(true)}
            disabled={dirty}
            title={dirty ? "احفظ الجدول أولاً، ثم ولّد الحصص" : "توليد حصص الفصل من الجدول المحفوظ"}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-primary/40 px-3 text-sm font-bold text-primary hover:bg-primary-soft disabled:opacity-50"
          >
            <CalendarPlus className="size-4" />
            توليد الحصص
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className={cn(
          "card-surface flex flex-wrap items-center gap-2 p-3",
          headerHidden && "hidden",
        )}
      >
        <div className="relative w-full sm:w-52">
          <Search className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => setF("q", e.target.value)}
            placeholder={view === "teachers" ? "ابحث عن معلم…" : "ابحث عن شعبة…"}
            className="h-9 pr-8 text-xs"
          />
        </div>
        <SearchableSelect
          className="w-full sm:w-40"
          options={programs}
          value={filters.program}
          onChange={(v) => setFilters((f) => ({ ...f, program: v, group: "" }))}
          placeholder="كل الصفوف"
          clearable
          clearLabel="كل الصفوف"
        />
        <SearchableSelect
          className="w-full sm:w-48"
          options={groupOptions}
          value={filters.group}
          onChange={(v) => setF("group", v)}
          placeholder="كل الشعب"
          clearable
          clearLabel="كل الشعب"
        />
        <SearchableSelect
          className="w-full sm:w-44"
          options={subjects}
          value={filters.subject}
          onChange={(v) => setF("subject", v)}
          placeholder="كل المواد"
          clearable
          clearLabel="كل المواد"
        />
        <Segmented
          value={filters.day || "all"}
          onChange={(v) => setF("day", v === "all" ? "" : v)}
          options={[
            { key: "all", label: "كل الأيام" },
            ...sheet.days.map((d) => ({ key: d.value, label: d.label })),
          ]}
        />
        {view === "teachers" && (
          <Segmented
            value={filters.sort}
            onChange={(v) => setF("sort", v)}
            label="ترتيب"
            options={[
              { key: "name", label: "الاسم" },
              { key: "most", label: "الأكثر حصصاً" },
              { key: "least", label: "الأقل" },
            ]}
          />
        )}
        <label className="flex items-center gap-1.5 text-xs font-semibold">
          <Switch checked={filters.onlyProblems} onCheckedChange={(v) => setF("onlyProblems", v)} />
          المشكلات فقط
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold">
          <Switch checked={showTimes} onCheckedChange={setShowTimes} />
          الأوقات
        </label>
        {anyFilter && (
          <button
            onClick={() =>
              setFilters({
                q: "",
                program: "",
                group: "",
                subject: "",
                day: "",
                onlyProblems: false,
                sort: filters.sort,
              })
            }
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            مسح الفلاتر
          </button>
        )}
        <span className="num ms-auto text-[11px] text-muted-foreground">
          {rowIds.length} {view === "teachers" ? "معلماً" : "شعبة"}
        </span>
      </div>

      <div ref={gridRef} onKeyDown={onGridKey}>
        <SheetGrid
          view={view}
          sheet={sheet}
          index={index}
          check={check}
          days={days}
          periods={sheet.periods}
          rows={rows}
          lit={lit}
          focusKeys={focusKeys}
          selected={selected}
          showTimes={showTimes}
          size={headerHidden ? (full ? "full" : "tall") : "normal"}
          quotaOf={(t) => index.teachers.get(t)?.quota ?? 0}
          onQuota={(t, q) => void saveQuota(t, q)}
          endLabel={view === "teachers" ? "النصاب" : "الحصص"}
          footerLabel={view === "teachers" ? "شعب بلا حصة" : "معلمون متاحون"}
          footer={footer}
          onOpen={(cell, x, y) => setPicker({ ...cell, x, y })}
          onSelect={(cell) => {
            setSelected(cell);
            setFocusProblem(null);
          }}
          onHoverKeys={setHoverKeys}
          onMove={move}
        />
        <Legend />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProblemsPanel check={check} onFocus={focusOn} />
        <SelectionPanel
          key={`${view}${selected?.row ?? ""}`}
          view={view}
          row={selected?.row ?? null}
          sheet={sheet}
          index={index}
          onQuota={(t, q) => void saveQuota(t, q)}
          limits={limits}
          onLimit={setLimit}
        />
      </div>

      <LoadTables
        sheet={sheet}
        index={index}
        onQuota={(t, q) => void saveQuota(t, q)}
        onPick={(v, row) => {
          setView(v);
          setSelected({
            row,
            day: sheet.days[0]?.value ?? "",
            period: sheet.periods[0]?.order ?? 1,
          });
          setFilters((f) => ({
            ...f,
            q: "",
            program: "",
            group: "",
            subject: "",
            onlyProblems: false,
          }));
          requestAnimationFrame(() =>
            gridRef.current
              ?.querySelector(`[data-cell^="${CSS.escape(`${row}|`)}"]`)
              ?.scrollIntoView({ block: "center", behavior: "smooth" }),
          );
        }}
      />

      {picker && (
        <CellPicker
          key={`${picker.row}|${picker.day}|${picker.period}|${view}`}
          view={view}
          target={picker}
          sheet={sheet}
          index={index}
          current={pickerCurrent}
          onApply={(patch) => applyCell(picker, patch)}
          onClear={() => clearCell(picker)}
          onClose={() => setPicker(null)}
        />
      )}

      <TimetableImportDialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) void reload();
        }}
      />
      <GenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        sheet={{ ...sheet, slots }}
        summary={summary}
        job={jobState}
        onStarted={() => {
          void qc.invalidateQueries({ queryKey: ["school-timetable", "job"] });
          setPolling(true);
        }}
      />
    </div>
  );
}

function ToolButton({
  onClick,
  disabled,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: typeof Save;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-xs font-semibold hover:bg-secondary disabled:opacity-40"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function Legend() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-destructive/20 ring-2 ring-inset ring-destructive" />{" "}
        تعارض في تعديلاتك — يمنع الحفظ
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-destructive/10 outline-dashed outline-1 outline-destructive" />{" "}
        تعارض قائم من قبل
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded ring-[3px] ring-destructive" /> الخانات المتعارضة معاً (مرّر
        المؤشر على خانة حمراء)
      </span>
      <span>⚠ تنبيه لا يمنع الحفظ</span>
      <span>
        اسحب حصة لنقلها أو تبديلها · Delete للمسح · Ctrl+C / Ctrl+V · Ctrl+Z للتراجع · الأسهم للتنقل
      </span>
    </div>
  );
}

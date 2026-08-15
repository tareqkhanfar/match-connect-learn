import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Flame,
  Minus,
  RotateCcw,
  Save,
  Search,
  Send,
  TrendingDown,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/shared/ui-kit";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import {
  useCurveColumn,
  useEntrySheet,
  useExcludeColumn,
  usePublishComponent,
  useSaveGrid,
  useScheduleRelease,
  type SchemeComponent,
} from "@/lib/api/hooks";

/** A cell's address, used for keyboard and paste navigation. */
const cellId = (row: number, col: number) => `mg-${row}-${col}`;

type Column = SchemeComponent & { index: number };

/** One assessment's summary, as the entry sheet reports it. */
type ColumnStat = NonNullable<ReturnType<typeof useEntrySheet>["data"]>["columns"][number];

/** Marks are entered to the nearest half during the term. */
function isHalfStep(value: number): boolean {
  return Math.abs(value * 2 - Math.round(value * 2)) < 0.001;
}

/**
 * The mark sheet as a spreadsheet.
 *
 * Marking used to mean choosing one assessment, entering thirty marks, saving,
 * and repeating for every column. A teacher with a register in front of them
 * reads across a student, not down a column — so the sheet matches the
 * register: students down the side, assessments across the top, grouped under
 * the category the plan puts them in.
 *
 * Nothing is written until the sheet is saved. That is what makes everything
 * else safe: free navigation, pasting a column from Excel, filling a whole
 * row — none of it can leave a half-written sheet on a child's record.
 */
export function MarkGrid({
  group,
  course,
  canEdit,
}: {
  group: string;
  course: string;
  canEdit: boolean;
}) {
  const sheet = useEntrySheet({ student_group: group, course });
  const saveGrid = useSaveGrid();
  const curve = useCurveColumn();
  const exclude = useExcludeColumn();
  const publish = usePublishComponent();
  const schedule = useScheduleRelease();
  const confirm = useConfirm();

  // Edits live here until saved: {student: {component: "7.5"}}
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [search, setSearch] = useState("");
  const [heat, setHeat] = useState(true);
  const [compare, setCompare] = useState<{ a: string; b: string }>({ a: "", b: "" });
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [releaseOn, setReleaseOn] = useState("");
  // Publication is decided per assessment but acted on in batches: at the end
  // of a quarter a teacher releases six papers at once, not one at a time.
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkDate, setBulkDate] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const term = sheet.data?.academic_term ?? undefined;
  const allRows = useMemo(() => sheet.data?.rows ?? [], [sheet.data]);
  const components = useMemo(() => sheet.data?.components ?? [], [sheet.data]);
  const stats = useMemo(() => sheet.data?.columns ?? [], [sheet.data]);

  const statOf = (name: string) => stats.find((s) => s.component_name === name);

  // Assessments grouped under their category — the plan's own shape, which is
  // what gives the header its two rows.
  const groups = useMemo(() => {
    const out: Array<{ category: string; items: Column[] }> = [];
    components.forEach((c, index) => {
      // Falling back to the quarter here would print it twice — once as the
      // quarter band and again as the category beneath it. An assessment with
      // no category of its own is simply "other marks" for that quarter.
      const category = c.category || "مكوّنات أخرى";
      const item: Column = { ...c, index };
      const last = out[out.length - 1];
      if (last && last.category === category) last.items.push(item);
      else out.push({ category, items: [item] });
    });
    return out;
  }, [components]);

  // The quarter sits above the categories, not beside them. A plan carries
  // both — "الربع الأول" and "علامة اليومي" are different questions about the
  // same assessment — and collapsing them into one row was hiding the term's
  // shape: a teacher could not see where one quarter ended and the next began.
  const quarters = useMemo(() => {
    const out: Array<{ quarter: string; span: number; groups: number }> = [];
    groups.forEach((g) => {
      const quarter = g.items[0]?.quarter || "";
      const last = out[out.length - 1];
      if (last && last.quarter === quarter) {
        last.span += g.items.length;
        last.groups += 1;
      } else {
        out.push({ quarter, span: g.items.length, groups: 1 });
      }
    });
    return out;
  }, [groups]);

  // With no quarter on any component the row is noise, so it is dropped
  // rather than shown empty.
  const hasQuarters = quarters.some((q) => q.quarter);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Shown on the toolbar button so the state of publication is legible
  // without opening anything.
  const publishedCount = stats.filter((s) => s.publish_state === "published").length;
  const scheduledCount = stats.filter((s) => s.release_on).length;

  const rows = useMemo(() => {
    const q = search.trim();
    if (!q) return allRows;
    return allRows.filter(
      (r) => r.student_name?.includes(q) || r.student.toLowerCase().includes(q.toLowerCase()),
    );
  }, [allRows, search]);

  // Marks already on record, so an untouched cell shows what is saved.
  const saved = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const r of allRows) {
      const byComponent: Record<string, number> = {};
      for (const e of r.entries ?? []) byComponent[e.component_name] = e.score;
      map[r.student] = byComponent;
    }
    return map;
  }, [allRows]);

  // A different class or subject is a different sheet: its edits are not ours.
  useEffect(() => {
    setEdits({});
    setSearch("");
  }, [group, course]);

  const dirty = Object.keys(edits).length > 0;

  function valueOf(student: string, component: string): string {
    const edited = edits[student]?.[component];
    if (edited !== undefined) return edited;
    const value = saved[student]?.[component];
    return value === undefined || value === null ? "" : String(value);
  }

  function setValue(student: string, component: string, value: string) {
    setEdits((prev) => ({
      ...prev,
      [student]: { ...(prev[student] ?? {}), [component]: value },
    }));
  }

  /** Every problem in the sheet, so saving reports them all at once. */
  const problems = useMemo(() => {
    const found: string[] = [];
    for (const [student, byComponent] of Object.entries(edits)) {
      const who = allRows.find((r) => r.student === student)?.student_name ?? student;
      for (const [component, raw] of Object.entries(byComponent)) {
        if (raw === "") continue;
        const value = Number(raw);
        const column = flat.find((c) => c.component_name === component);
        if (Number.isNaN(value)) found.push(`${who} — ${component}: قيمة غير رقمية`);
        else if (value < 0) found.push(`${who} — ${component}: لا يمكن أن تكون سالبة`);
        else if (column && value > column.max_score)
          found.push(`${who} — ${component}: تتجاوز ${column.max_score}`);
        else if (!isHalfStep(value))
          found.push(`${who} — ${component}: يجب أن تكون من مضاعفات ٠.٥`);
      }
    }
    return found;
  }, [edits, flat, allRows]);

  function focusCell(row: number, col: number) {
    const el = gridRef.current?.querySelector<HTMLInputElement>(`#${cellId(row, col)}`);
    el?.focus();
    el?.select();
  }

  /** Arrow keys and Enter walk the sheet the way a spreadsheet does. */
  function onKeyDown(e: React.KeyboardEvent, row: number, col: number) {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [row - 1, col],
      ArrowDown: [row + 1, col],
      Enter: [row + 1, col],
      // RTL: the visual "left" is the next column.
      ArrowLeft: [row, col + 1],
      ArrowRight: [row, col - 1],
    };
    const move = moves[e.key];
    if (!move) return;
    const [r, c] = move;
    if (r < 0 || r >= rows.length || c < 0 || c >= flat.length) return;
    e.preventDefault();
    focusCell(r, c);
  }

  /**
   * Paste a block from Excel.
   *
   * Schools keep marks in spreadsheets, and retyping a column of forty is how
   * transcription errors get in. A tab/newline block dropped on a cell fills
   * outward from it, clipped to the sheet's own bounds.
   */
  function onPaste(e: React.ClipboardEvent, row: number, col: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !/[\t\n\r]/.test(text)) return; // a single value pastes normally
    e.preventDefault();

    const block = text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .filter((line, i, all) => line !== "" || i < all.length - 1)
      .map((line) => line.split("\t"));

    setEdits((prev) => {
      const next = { ...prev };
      block.forEach((line, dr) => {
        const target = rows[row + dr];
        if (!target) return;
        line.forEach((raw, dc) => {
          const column = flat[col + dc];
          if (!column) return;
          next[target.student] = {
            ...(next[target.student] ?? {}),
            [column.component_name]: raw.trim(),
          };
        });
      });
      return next;
    });
    toast.success(`تم لصق ${block.length} صفاً`);
  }

  async function save() {
    if (problems.length) {
      toast.error(
        `${problems.length} خطأ في العلامات — لم يُحفظ شيء.\n${problems.slice(0, 3).join("\n")}`,
        { duration: 8000 },
      );
      return;
    }

    const touched = new Set<string>();
    for (const byComponent of Object.values(edits)) {
      for (const component of Object.keys(byComponent)) touched.add(component);
    }
    if (!touched.size) return;

    const columns = flat
      .filter((c) => touched.has(c.component_name))
      .map((c) => ({
        component_name: c.component_name,
        component_type: c.component_type,
        max_score: c.max_score,
        weight: c.weight,
        marks: allRows
          .map((r) => ({ student: r.student, score: valueOf(r.student, c.component_name) }))
          // An empty cell means "not marked yet", never zero.
          .filter((m) => m.score !== "")
          .map((m) => ({ student: m.student, score: Number(m.score) })),
      }));

    try {
      const res = await saveGrid.mutateAsync({
        student_group: group,
        course,
        ...(term ? { academic_term: term } : {}),
        columns,
      });
      toast.success(`تم حفظ ${res.saved + res.updated} علامة`);
      setEdits({});
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ العلامات"));
    }
  }

  /** Fill every empty cell in a column — the register's "everyone got X". */
  function fillColumn(component: string, value: string, onlyEmpty: boolean) {
    setEdits((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (onlyEmpty && valueOf(r.student, component) !== "") continue;
        next[r.student] = { ...(next[r.student] ?? {}), [component]: value };
      }
      return next;
    });
    setMenuFor(null);
  }

  async function runCurve(component: string, points: number) {
    const ok = await confirm({
      title: points > 0 ? `رفع علامات «${component}»؟` : `خفض علامات «${component}»؟`,
      description: `سيتم تعديل كل العلامات المحفوظة في هذا العمود بمقدار ${Math.abs(points)}، دون تجاوز العلامة العظمى ولا النزول تحت الصفر.`,
    });
    if (!ok) return;
    try {
      const res = await curve.mutateAsync({
        student_group: group,
        course,
        component_name: component,
        points,
        ...(term ? { academic_term: term } : {}),
      });
      toast.success(`تم تعديل ${res.changed} علامة`);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تعديل العلامات"));
    }
    setMenuFor(null);
  }

  async function toggleExclude(component: string) {
    const off = statOf(component)?.excluded;
    const ok = await confirm({
      title: off ? `إعادة «${component}» للاحتساب؟` : `استبعاد «${component}» من الاحتساب؟`,
      description: off
        ? "سيعود هذا الاختبار للاحتساب ضمن علامة المادة."
        : "تبقى العلامات مسجّلة على الطلاب، لكنها لن تُحتسب ضمن علامة المادة.",
    });
    if (!ok) return;
    try {
      await exclude.mutateAsync({
        student_group: group,
        course,
        component_name: component,
        excluded: off ? 0 : 1,
        ...(term ? { academic_term: term } : {}),
      });
      toast.success(off ? "تمت الإعادة للاحتساب" : "تم الاستبعاد");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تغيير حالة الاحتساب"));
    }
    setMenuFor(null);
  }

  async function togglePublish(component: string, toPublish: boolean) {
    const ok = await confirm({
      title: toPublish ? `نشر «${component}»؟` : `سحب «${component}» من الطلاب؟`,
      description: toPublish
        ? "ستظهر علامات هذا المكوّن للطلاب وأولياء الأمور."
        : "ستختفي علامات هذا المكوّن عن الطلاب وأولياء الأمور حتى تُنشر مرة أخرى.",
    });
    if (!ok) return;
    try {
      const res = await publish.mutateAsync({
        student_group: group,
        course,
        component_name: component,
        published: toPublish ? 1 : 0,
        ...(term ? { academic_term: term } : {}),
      });
      toast.success(res.message_ar || (toPublish ? "تم النشر" : "تم السحب"));
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تنفيذ العملية"));
    }
    setMenuFor(null);
  }

  async function applySchedule() {
    if (!scheduleFor) return;
    try {
      const res = await schedule.mutateAsync({
        student_group: group,
        course,
        component_name: scheduleFor,
        ...(releaseOn ? { release_on: releaseOn } : {}),
      });
      toast.success(res.message_ar || "تم ضبط موعد النشر");
      setScheduleFor(null);
      setReleaseOn("");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر ضبط موعد النشر"));
    }
  }

  /**
   * Publish or withdraw several assessments in one decision.
   *
   * Each one still goes to the server separately — the endpoint owns one
   * component — but the teacher confirms once, and a failure part-way names
   * exactly which papers moved and which did not, so the sheet is never left
   * in a state nobody can describe.
   */
  async function bulkPublish(toPublish: boolean) {
    if (!picked.length) return;
    const ok = await confirm({
      title: toPublish
        ? `نشر ${picked.length} من الاختبارات للطلاب؟`
        : `سحب ${picked.length} من الاختبارات؟`,
      description: toPublish
        ? "ستظهر علامات هذه الاختبارات للطلاب وأولياء الأمور فوراً."
        : "ستختفي علامات هذه الاختبارات عن الطلاب وأولياء الأمور حتى تُنشر مرة أخرى.",
    });
    if (!ok) return;

    const done: string[] = [];
    const failed: string[] = [];
    for (const name of picked) {
      try {
        await publish.mutateAsync({
          student_group: group,
          course,
          component_name: name,
          published: toPublish ? 1 : 0,
          ...(term ? { academic_term: term } : {}),
        });
        done.push(name);
      } catch {
        failed.push(name);
      }
    }

    if (failed.length) {
      toast.error(
        `${done.length} نُفِّذت، وتعذّر: ${failed.slice(0, 3).join("، ")}${
          failed.length > 3 ? "…" : ""
        }`,
      );
    } else {
      toast.success(
        toPublish ? `تم نشر ${done.length} اختباراً` : `تم سحب ${done.length} اختباراً`,
      );
      setPicked([]);
    }
  }

  /** Schedule several assessments to appear on the same day. */
  async function bulkSchedule() {
    if (!picked.length || !bulkDate) return;
    const done: string[] = [];
    const failed: string[] = [];
    for (const name of picked) {
      try {
        await schedule.mutateAsync({
          student_group: group,
          course,
          component_name: name,
          release_on: bulkDate,
        });
        done.push(name);
      } catch {
        failed.push(name);
      }
    }
    if (failed.length) toast.error(`${done.length} جُدولت، وتعذّر ${failed.length}`);
    else {
      toast.success(`تم ضبط موعد ظهور ${done.length} اختباراً في ${bulkDate}`);
      setPicked([]);
      setBulkDate("");
    }
  }

  /** A student's running total across everything marked so far. */
  function totalFor(student: string): { earned: number; outOf: number; pct: number | null } {
    let earned = 0;
    let outOf = 0;
    for (const c of flat) {
      if (statOf(c.component_name)?.excluded) continue;
      const raw = valueOf(student, c.component_name);
      if (raw === "" || Number.isNaN(Number(raw))) continue;
      earned += Number(raw);
      outOf += c.max_score;
    }
    return { earned, outOf, pct: outOf ? (earned / outOf) * 100 : null };
  }

  function percentOf(student: string, component: string): number | null {
    const c = flat.find((x) => x.component_name === component);
    const raw = valueOf(student, component);
    if (!c || raw === "" || !c.max_score || Number.isNaN(Number(raw))) return null;
    return (Number(raw) / c.max_score) * 100;
  }

  /** CSV of exactly what is on screen, for a teacher who wants it offline. */
  function exportCsv() {
    const header = ["الطالب", "الرقم", ...flat.map((c) => `${c.component_name} / ${c.max_score}`)];
    const lines = rows.map((r) => [
      r.student_name ?? "",
      r.student,
      ...flat.map((c) => valueOf(r.student, c.component_name)),
    ]);
    const csv = [header, ...lines]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    // A BOM so Excel opens Arabic correctly instead of showing mojibake.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marks-${group}-${course}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function heatClass(pct: number | null): string {
    if (!heat || pct === null) return "";
    if (pct >= 80) return "bg-emerald-500/10";
    if (pct >= 65) return "bg-info-soft/60";
    if (pct >= 50) return "bg-warm-soft/60";
    return "bg-destructive-soft/50";
  }

  if (sheet.isLoading)
    return <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>;
  if (sheet.error)
    return <p className="py-10 text-center text-sm text-destructive">تعذّر تحميل كشف العلامات.</p>;
  if (!allRows.length)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">لا يوجد طلاب في هذه الشعبة.</p>
    );
  if (!flat.length)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        لا توجد مكوّنات تقييم لهذه المادة — عرّفها من خطة التقييم أولاً.
      </p>
    );

  const marked = flat.reduce((n, c) => n + (statOf(c.component_name)?.marked ?? 0), 0);
  const capacity = flat.length * allRows.length;

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <button
            onClick={save}
            disabled={!dirty || saveGrid.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-50"
          >
            <Save className="size-4" />
            {saveGrid.isPending ? "جارٍ الحفظ…" : "حفظ العلامات"}
          </button>
        )}

        {dirty && (
          <button
            onClick={() => setEdits({})}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary"
          >
            <RotateCcw className="size-3.5" />
            تراجع
          </button>
        )}
        {dirty &&
          (problems.length ? (
            <Pill tone="danger">{problems.length} خطأ — راجع الخانات الحمراء</Pill>
          ) : (
            <Pill tone="warning">تغييرات غير محفوظة</Pill>
          ))}

        <div className="relative">
          <Search className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن طالب…"
            className="h-10 w-48 rounded-xl pr-8 text-xs"
          />
        </div>

        <button
          onClick={() => setHeat((h) => !h)}
          title="تلوين الخانات حسب مستوى العلامة"
          className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
            heat
              ? "border-primary bg-primary-soft text-primary"
              : "border-border hover:bg-secondary"
          }`}
        >
          <Flame className="size-3.5" />
          تلوين
        </button>

        <button
          onClick={exportCsv}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary"
        >
          <Download className="size-3.5" />
          تصدير
        </button>

        {/* Publication opens over the sheet rather than sitting above it: the
            grid needs its height, and releasing marks is an occasional act,
            not something a teacher keeps on screen while marking. */}
        {canEdit && flat.length > 0 && (
          <button
            onClick={() => setShowPublish(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-secondary"
            title="نشر العلامات للطلاب، سحبها، أو جدولة ظهورها"
          >
            <Send className="size-3.5" />
            النشر
            {publishedCount > 0 && (
              <span className="num rounded-md bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-700">
                {publishedCount}
              </span>
            )}
            {scheduledCount > 0 && (
              <span className="num rounded-md bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-700">
                {scheduledCount}
              </span>
            )}
          </button>
        )}

        <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="num">
            {marked} / {capacity} علامة مرصودة
          </span>
          <span>·</span>
          <span className="num">{rows.length} طالباً</span>
        </div>
      </div>

      {/* Comparison picker — two assessments and the change between them. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
        <span className="text-[11px] font-semibold text-muted-foreground">مقارنة تحسّن:</span>
        <select
          value={compare.a}
          onChange={(e) => setCompare((c) => ({ ...c, a: e.target.value }))}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
        >
          <option value="">من…</option>
          {flat.map((c) => (
            <option key={c.component_name} value={c.component_name}>
              {c.component_name}
            </option>
          ))}
        </select>
        <select
          value={compare.b}
          onChange={(e) => setCompare((c) => ({ ...c, b: e.target.value }))}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
        >
          <option value="">إلى…</option>
          {flat.map((c) => (
            <option key={c.component_name} value={c.component_name}>
              {c.component_name}
            </option>
          ))}
        </select>
        {(compare.a || compare.b) && (
          <button
            onClick={() => setCompare({ a: "", b: "" })}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            إلغاء
          </button>
        )}
      </div>

      {canEdit && flat.length > 0 && showPublish && (
        <PublishDialog
          columns={flat}
          statOf={statOf}
          quarters={quarters}
          groups={groups}
          picked={picked}
          setPicked={setPicked}
          bulkDate={bulkDate}
          setBulkDate={setBulkDate}
          onPublish={bulkPublish}
          onSchedule={bulkSchedule}
          busy={publish.isPending || schedule.isPending}
          onClose={() => setShowPublish(false)}
        />
      )}

      {/* The sheet owns its scrolling in both directions. Without a height the
          box never overflows vertically, so `sticky` headers had nothing to
          stick to and scrolled away with the page — the column names vanished
          exactly when a long class needed them most. */}
      <div
        ref={gridRef}
        className="max-h-[calc(100vh-15rem)] min-h-72 overflow-auto overscroll-contain rounded-xl border border-border"
      >
        <table className="w-full border-collapse text-right text-sm">
          <thead className="sticky top-0 z-20">
            {/* Top row: the quarter. Each one is walled off from the next so
                the term reads as its own block of the sheet. */}
            {hasQuarters && (
              <tr>
                <th
                  rowSpan={4}
                  className="sticky right-0 z-30 min-w-56 border-b border-l border-border bg-secondary p-2 text-xs font-bold"
                >
                  الطالب
                </th>
                {quarters.map((q, i) => (
                  <th
                    key={`${q.quarter}-${i}`}
                    colSpan={q.span}
                    className={`border-b border-border p-2 text-center text-xs font-black ${
                      q.quarter
                        ? "bg-brand-gradient text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    } ${i > 0 ? "border-r-2 border-r-primary/40" : ""}`}
                  >
                    {q.quarter || "غير محدّد"}
                  </th>
                ))}
                <th
                  rowSpan={4}
                  className="border-b border-border bg-secondary p-2 text-center text-xs font-bold"
                >
                  المجموع
                </th>
                {compare.a && compare.b && (
                  <th
                    rowSpan={4}
                    className="border-b border-r border-border bg-secondary p-2 text-center text-xs font-bold"
                  >
                    التحسّن
                  </th>
                )}
              </tr>
            )}

            {/* Category row: the bucket the plan puts the assessment in. */}
            <tr>
              {!hasQuarters && (
                <th
                  rowSpan={3}
                  className="sticky right-0 z-30 min-w-56 border-b border-l border-border bg-secondary p-2 text-xs font-bold"
                >
                  الطالب
                </th>
              )}
              {groups.map((g, i) => (
                <th
                  key={`${g.category}-${i}`}
                  colSpan={g.items.length}
                  className="border-b border-l border-border bg-secondary/70 p-2 text-center text-xs font-bold"
                >
                  {g.category}
                </th>
              ))}
              {!hasQuarters && (
                <>
                  <th
                    rowSpan={3}
                    className="border-b border-border bg-secondary p-2 text-center text-xs font-bold"
                  >
                    المجموع
                  </th>
                  {compare.a && compare.b && (
                    <th
                      rowSpan={3}
                      className="border-b border-r border-border bg-secondary p-2 text-center text-xs font-bold"
                    >
                      التحسّن
                    </th>
                  )}
                </>
              )}
            </tr>

            {/* Child row: the assessments, each with its own menu. */}
            <tr>
              {flat.map((c) => {
                const s = statOf(c.component_name);
                const off = s?.excluded;
                return (
                  <th
                    key={c.component_name}
                    className={`relative min-w-28 border-b border-l border-border p-1.5 text-center align-top text-[11px] ${
                      off ? "bg-destructive-soft" : "bg-card"
                    }`}
                  >
                    <span className="flex items-start justify-center gap-1">
                      <span className="min-w-0">
                        <span
                          className={`block truncate font-bold ${off ? "text-destructive line-through" : ""}`}
                          title={c.component_name}
                        >
                          {c.component_name}
                        </span>
                        <span className="num block text-[10px] text-muted-foreground">
                          / {c.max_score}
                          {c.weight ? ` · وزن ${c.weight}` : ""}
                        </span>
                      </span>
                      {canEdit && (
                        <button
                          onClick={() =>
                            setMenuFor((m) => (m === c.component_name ? null : c.component_name))
                          }
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary"
                          aria-label="خيارات العمود"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      )}
                    </span>

                    <span className="mt-1 flex items-center justify-center gap-1">
                      {s?.publish_state === "published" && (
                        <Pill tone="success">
                          <Eye className="ml-0.5 inline size-2.5" />
                          منشور
                        </Pill>
                      )}
                      {s?.publish_state === "partial" && <Pill tone="warning">جزئي</Pill>}
                      {off && <Pill tone="danger">مستبعد</Pill>}
                    </span>

                    {menuFor === c.component_name && (
                      <ColumnMenu
                        component={c}
                        stat={s}
                        onClose={() => setMenuFor(null)}
                        onFill={(v, onlyEmpty) => fillColumn(c.component_name, v, onlyEmpty)}
                        onCurve={(p) => runCurve(c.component_name, p)}
                        onExclude={() => toggleExclude(c.component_name)}
                        onPublish={(p) => togglePublish(c.component_name, p)}
                        onSchedule={() => {
                          setScheduleFor(c.component_name);
                          setReleaseOn(s?.release_on?.slice(0, 10) ?? "");
                          setMenuFor(null);
                        }}
                      />
                    )}
                  </th>
                );
              })}
            </tr>

            {/* Statistics row: how the paper actually went. */}
            <tr>
              {flat.map((c) => {
                const s = statOf(c.component_name);
                return (
                  <th
                    key={c.component_name}
                    className="border-b border-l border-border bg-muted/40 p-1 text-center text-[10px] font-normal text-muted-foreground"
                  >
                    {s?.average_pct !== null && s?.average_pct !== undefined ? (
                      <span className="num">
                        م {s.average_pct}% · {s.marked}/{s.marked + s.missing}
                      </span>
                    ) : (
                      <span>لم تُرصد</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((r, rowIndex) => {
              const total = totalFor(r.student);
              const a = compare.a ? percentOf(r.student, compare.a) : null;
              const b = compare.b ? percentOf(r.student, compare.b) : null;
              const delta = a !== null && b !== null ? Math.round((b - a) * 10) / 10 : null;

              return (
                <tr key={r.student} className="even:bg-secondary/20">
                  <td className="sticky right-0 z-10 border-b border-l border-border bg-card p-2">
                    <span className="block truncate font-semibold" title={r.student_name ?? ""}>
                      {r.student_name}
                    </span>
                    <span className="num block text-[10px] text-muted-foreground">{r.student}</span>
                  </td>

                  {flat.map((c, colIndex) => {
                    const off = statOf(c.component_name)?.excluded;
                    const raw = valueOf(r.student, c.component_name);
                    const value = Number(raw);
                    const bad =
                      raw !== "" &&
                      (Number.isNaN(value) ||
                        value < 0 ||
                        value > c.max_score ||
                        !isHalfStep(value));
                    const touched = edits[r.student]?.[c.component_name] !== undefined;
                    const pct = raw === "" || bad ? null : (value / c.max_score) * 100;

                    return (
                      <td
                        key={c.component_name}
                        className={`border-b border-l border-border p-0.5 ${
                          off ? "bg-destructive-soft/30" : heatClass(pct)
                        }`}
                      >
                        <Input
                          id={cellId(rowIndex, colIndex)}
                          value={raw}
                          onChange={(e) => setValue(r.student, c.component_name, e.target.value)}
                          onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
                          onPaste={(e) => onPaste(e, rowIndex, colIndex)}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={!canEdit}
                          inputMode="decimal"
                          placeholder="—"
                          dir="ltr"
                          title={bad ? `القيمة يجب أن تكون بين 0 و ${c.max_score}` : undefined}
                          className={`num h-9 rounded-md border-0 bg-transparent text-center shadow-none focus-visible:ring-1 ${
                            bad
                              ? "bg-destructive/20 font-bold text-destructive"
                              : touched
                                ? "font-bold text-primary"
                                : ""
                          }`}
                        />
                      </td>
                    );
                  })}

                  <td className="num border-b border-border p-2 text-center">
                    {total.pct === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="font-bold">
                        {Math.round(total.earned * 100) / 100}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {" "}
                          / {total.outOf}
                        </span>
                      </span>
                    )}
                  </td>

                  {compare.a && compare.b && (
                    <td className="num border-b border-r border-border p-2 text-center">
                      {delta === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            delta > 0
                              ? "text-emerald-600"
                              : delta < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {delta > 0 ? (
                            <ArrowUp className="size-3.5" />
                          ) : delta < 0 ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <Minus className="size-3.5" />
                          )}
                          {delta > 0 ? `+${delta}` : delta}%
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>تنقّل بالأسهم أو Enter</span>
        <span>· الصق عموداً من Excel مباشرة في أي خانة</span>
        <span>· الخانة الفارغة تعني «لم تُرصد» وليست صفراً</span>
        <span>· العلامات من مضاعفات ٠.٥</span>
        <span>· الأعمدة المشطوبة مستبعدة من احتساب المادة</span>
      </div>

      {/* Release date for one component. */}
      {scheduleFor && (
        <Dialog open onOpenChange={(v) => !v && setScheduleFor(null)}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="size-5 text-primary" />
                موعد ظهور «{scheduleFor}»
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>يظهر لأولياء الأمور بتاريخ</Label>
              <Input
                type="date"
                value={releaseOn}
                onChange={(e) => setReleaseOn(e.target.value)}
                className="num rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                حتى هذا التاريخ تبقى العلامات مخفية عن الطلاب وأولياء الأمور مهما كانت حالة النشر.
                اتركه فارغاً للتحكم اليدوي.
              </p>
            </div>
            <DialogFooter className="gap-2 sm:justify-start">
              <button
                onClick={applySchedule}
                disabled={schedule.isPending}
                className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {schedule.isPending ? "جارٍ…" : "حفظ الموعد"}
              </button>
              <button
                onClick={() => setScheduleFor(null)}
                className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
              >
                إلغاء
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Everything that can be done to one assessment, in one place. */
/**
 * Publication, gathered in one place.
 *
 * Releasing marks is the decision a teacher is most careful about and most
 * often asked to reverse, so it does not belong buried in a per-column menu.
 * The assessments are laid out as cards under their quarter — pick some, or a
 * whole quarter at once, and act. Every card says where it stands, because
 * "did I publish the midterm?" is the question this panel exists to answer.
 */
function PublishDialog({
  columns,
  statOf,
  quarters,
  groups,
  picked,
  setPicked,
  bulkDate,
  setBulkDate,
  onPublish,
  onSchedule,
  busy,
  onClose,
}: {
  columns: Column[];
  statOf: (name: string) => ColumnStat | undefined;
  quarters: Array<{ quarter: string; span: number; groups: number }>;
  groups: Array<{ category: string; items: Column[] }>;
  picked: string[];
  setPicked: (v: string[] | ((p: string[]) => string[])) => void;
  bulkDate: string;
  setBulkDate: (v: string) => void;
  onPublish: (toPublish: boolean) => void;
  onSchedule: () => void;
  busy: boolean;
  onClose: () => void;
}) {
  const published = columns.filter((c) => statOf(c.component_name)?.publish_state === "published");
  const drafts = columns.filter((c) => statOf(c.component_name)?.publish_state === "draft");
  const scheduled = columns.filter((c) => statOf(c.component_name)?.release_on);

  function toggle(name: string) {
    setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));
  }

  // Quarters own a run of categories, so their assessments are the union of
  // those categories' items — the same walk the header does.
  function quarterColumns(qi: number): Column[] {
    let g = 0;
    for (let i = 0; i < qi; i++) g += quarters[i]!.groups;
    return groups.slice(g, g + quarters[qi]!.groups).flatMap((x) => x.items);
  }

  const allPicked = picked.length === columns.length && columns.length > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" />
            نشر العلامات للطلاب
          </DialogTitle>
        </DialogHeader>

        <div className="num flex flex-wrap items-center gap-1.5 text-[11px]">
          <Pill tone="success">{published.length} منشور</Pill>
          <Pill tone="muted">{drafts.length} مسودة</Pill>
          {scheduled.length > 0 && <Pill tone="warning">{scheduled.length} مجدول</Pill>}
        </div>

        {
          <div className="max-h-[55vh] overflow-y-auto p-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px]">
              <button
                onClick={() => setPicked(allPicked ? [] : columns.map((c) => c.component_name))}
                className="rounded-lg border border-border px-2.5 py-1 font-semibold transition-colors hover:bg-secondary"
              >
                {allPicked ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </button>
              <button
                onClick={() => setPicked(drafts.map((c) => c.component_name))}
                className="rounded-lg border border-border px-2.5 py-1 font-semibold transition-colors hover:bg-secondary"
              >
                غير المنشورة فقط
              </button>
              <button
                onClick={() => setPicked(published.map((c) => c.component_name))}
                className="rounded-lg border border-border px-2.5 py-1 font-semibold transition-colors hover:bg-secondary"
              >
                المنشورة فقط
              </button>
            </div>

            {/* Cards, grouped exactly as the header groups them. */}
            <div className="space-y-3">
              {quarters.map((q, qi) => {
                const cols = quarterColumns(qi);
                const names = cols.map((c) => c.component_name);
                const allInQuarter = names.every((n) => picked.includes(n));
                return (
                  <div key={`${q.quarter}-${qi}`} className="rounded-xl border border-border p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-primary">
                        {q.quarter || "غير محدّد"}
                      </span>
                      <button
                        onClick={() =>
                          setPicked((p) =>
                            allInQuarter
                              ? p.filter((n) => !names.includes(n))
                              : [...new Set([...p, ...names])],
                          )
                        }
                        className="rounded-lg border border-border px-2 py-0.5 text-[10px] font-semibold transition-colors hover:bg-secondary"
                      >
                        {allInQuarter ? "إلغاء الربع" : "تحديد الربع"}
                      </button>
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {cols.map((c) => {
                        const s = statOf(c.component_name);
                        const on = picked.includes(c.component_name);
                        return (
                          <button
                            key={c.component_name}
                            onClick={() => toggle(c.component_name)}
                            className={`flex items-center gap-2 rounded-xl border p-2 text-right transition-all ${
                              on
                                ? "border-primary bg-primary-soft"
                                : "border-border hover:bg-secondary/60"
                            }`}
                          >
                            <span
                              className={`grid size-4 shrink-0 place-items-center rounded border ${
                                on
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border"
                              }`}
                            >
                              {on && <Check className="size-3" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-bold">
                                {c.component_name}
                              </span>
                              <span className="num block text-[10px] text-muted-foreground">
                                {s ? `${s.marked}/${s.marked + s.missing} مرصودة` : "—"}
                                {s?.release_on ? ` · يظهر ${s.release_on.slice(0, 10)}` : ""}
                              </span>
                            </span>
                            {s?.publish_state === "published" && <Pill tone="success">منشور</Pill>}
                            {s?.publish_state === "partial" && <Pill tone="warning">جزئي</Pill>}
                            {s?.publish_state === "draft" && <Pill tone="muted">مسودة</Pill>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions stay disabled until something is picked, so the buttons
              can never fire on an empty selection. */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {picked.length ? `${picked.length} محدَّد` : "لم تحدّد شيئاً"}
              </span>
              <button
                onClick={() => onPublish(true)}
                disabled={!picked.length || busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
              >
                <Send className="size-3.5" />
                نشر للطلاب
              </button>
              <button
                onClick={() => onPublish(false)}
                disabled={!picked.length || busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-destructive/40 px-3.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive-soft disabled:pointer-events-none disabled:opacity-40"
              >
                <EyeOff className="size-3.5" />
                سحب من الطلاب
              </button>
              <span className="mr-auto flex items-center gap-1.5">
                <CalendarClock className="size-3.5 text-muted-foreground" />
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="num h-9 rounded-xl border border-border bg-card px-2 text-xs"
                />
                <button
                  onClick={onSchedule}
                  disabled={!picked.length || !bulkDate || busy}
                  className="h-9 rounded-xl border border-border px-3 text-xs font-bold transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
                >
                  جدولة الظهور
                </button>
              </span>
            </div>
          </div>
        }

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnMenu({
  component,
  stat,
  onClose,
  onFill,
  onCurve,
  onExclude,
  onPublish,
  onSchedule,
}: {
  component: SchemeComponent;
  stat: { publish_state?: string; excluded?: boolean } | undefined;
  onClose: () => void;
  onFill: (value: string, onlyEmpty: boolean) => void;
  onCurve: (points: number) => void;
  onExclude: () => void;
  onPublish: (publish: boolean) => void;
  onSchedule: () => void;
}) {
  const [fill, setFill] = useState("");
  const published = stat?.publish_state === "published" || stat?.publish_state === "partial";

  // The menu is positioned against the viewport, not the table. Absolute
  // placement put it inside the sheet's own scroll box, which clipped it —
  // worst when the class is small and the table is shorter than the menu.
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current?.previousElementSibling ?? anchorRef.current?.parentElement;
    if (!anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const W = 224;
      const H = 260;
      // Flip above the header when there is not enough room below it.
      const below = window.innerHeight - r.bottom;
      const top = below < H && r.top > H ? Math.max(8, r.top - H - 4) : r.bottom + 4;
      // Keep the whole menu on screen horizontally (RTL: measured from right).
      const right = Math.min(Math.max(8, window.innerWidth - r.right), window.innerWidth - W - 8);
      setPos({ top, right });
    };
    place();
    window.addEventListener("resize", place);
    // The sheet scrolls in both directions; the menu must follow its column.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} className="hidden" />
      {/* Click anywhere else to dismiss. */}
      <span className="fixed inset-0 z-40" onClick={onClose} />
      <span
        style={pos ? { top: pos.top, right: pos.right } : undefined}
        className={`fixed z-50 block w-56 rounded-xl border border-border bg-card p-2 text-right shadow-xl ${
          pos ? "" : "invisible"
        }`}
      >
        <span className="mb-1.5 block text-[11px] font-bold">{component.component_name}</span>

        <span className="mb-2 flex items-center gap-1">
          <Input
            value={fill}
            onChange={(e) => setFill(e.target.value)}
            placeholder="قيمة"
            inputMode="decimal"
            dir="ltr"
            className="num h-8 flex-1 text-center text-xs"
          />
          <button
            onClick={() => fill !== "" && onFill(fill, true)}
            title="تعبئة الخانات الفارغة فقط"
            className="rounded-lg bg-secondary px-2 py-1.5 text-[11px] font-semibold hover:bg-primary-soft hover:text-primary"
          >
            الفارغ
          </button>
          <button
            onClick={() => fill !== "" && onFill(fill, false)}
            title="تعبئة كل الخانات"
            className="rounded-lg bg-secondary px-2 py-1.5 text-[11px] font-semibold hover:bg-primary-soft hover:text-primary"
          >
            الكل
          </button>
        </span>

        <MenuRow icon={Wand2} label="مسح العمود" onClick={() => onFill("", false)} />
        <MenuRow icon={TrendingUp} label="رفع العلامات (+1)" onClick={() => onCurve(1)} />
        <MenuRow icon={TrendingDown} label="خفض العلامات (−1)" onClick={() => onCurve(-1)} />
        <MenuRow
          icon={Ban}
          label={stat?.excluded ? "إعادة للاحتساب" : "استبعاد من الاحتساب"}
          onClick={onExclude}
          tone={stat?.excluded ? "primary" : "danger"}
        />
        <span className="my-1 block border-t border-border" />
        {published ? (
          <MenuRow
            icon={EyeOff}
            label="سحب من الطلاب"
            onClick={() => onPublish(false)}
            tone="danger"
          />
        ) : (
          <MenuRow icon={Eye} label="نشر للطلاب" onClick={() => onPublish(true)} tone="primary" />
        )}
        <MenuRow icon={CalendarClock} label="موعد الظهور" onClick={onSchedule} />
      </span>
    </>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: typeof Eraser;
  label: string;
  onClick: () => void;
  tone?: "danger" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors hover:bg-secondary ${
        tone === "danger"
          ? "text-destructive"
          : tone === "primary"
            ? "text-primary"
            : "text-foreground"
      }`}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </button>
  );
}

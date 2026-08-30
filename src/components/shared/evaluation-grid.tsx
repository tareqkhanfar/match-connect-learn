import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Keyboard, Save, Wand2 } from "lucide-react";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Pill } from "@/components/shared/ui-kit";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/error-message";
import { useSheetNav } from "@/lib/sheet-nav";
import { useEvaluationGrid, usePublishEvaluations, useSaveEvaluationGrid } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<string, string> = {
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  primary: "bg-primary/15 text-primary",
  muted: "bg-secondary text-foreground",
};

/**
 * A whole class against one form, entered like a spreadsheet.
 *
 * The same shape as mark entry because it is the same job: a teacher answering
 * fifteen criteria for thirty pupils is doing four hundred and fifty small
 * things, and every extra gesture is multiplied by that. So:
 *
 *   - arrows and Enter walk the sheet, and a block pastes in from Excel
 *   - on a scale form the number keys pick the option — 1 for the first, 2 for
 *     the second — which is the whole entry, one keystroke, no dropdown
 *   - a column fills down from its heading for the common case where most of
 *     a class gets the same answer and a few do not
 *
 * Edits are held here until saved, so a slow connection never loses a column
 * of typing and the sheet does not move under the teacher's hands.
 */
export function EvaluationGrid({
  form,
  studentGroup,
  course,
}: {
  form: string;
  studentGroup: string;
  course?: string | undefined;
}) {
  const grid = useEvaluationGrid(form || undefined, studentGroup || undefined);
  const saveGrid = useSaveEvaluationGrid();
  const publish = usePublishEvaluations();

  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft({});
    setNotes({});
  }, [form, studentGroup]);

  const spec = grid.data?.form;
  const criteria = useMemo(() => spec?.criteria ?? [], [spec]);
  const scale = useMemo(() => spec?.scale ?? [], [spec]);
  const students = useMemo(() => grid.data?.students ?? [], [grid.data]);
  const saved = grid.data?.answers ?? {};

  const isScale = spec?.scale_type === "مقياس" || spec?.scale_type === "نعم/لا";
  const dirty = Object.keys(draft).length > 0 || Object.keys(notes).length > 0;

  function valueAt(student: string, key: string): string {
    return draft[student]?.[key] ?? saved[student]?.[key]?.value ?? "";
  }

  function setValue(student: string, key: string, value: string) {
    setDraft((d) => ({ ...d, [student]: { ...(d[student] ?? {}), [key]: value } }));
  }

  const nav = useSheetNav({
    rows: students.length,
    cols: criteria.length,
    prefix: "eg",
    onPasteCell: (row, col, raw) => {
      const student = students[row];
      const criterion = criteria[col];
      if (!student || !criterion) return;
      // A pasted word only counts if the form actually offers it; anything
      // else would store an answer the form cannot mean.
      const value = isScale ? (scale.find((o) => o.label === raw)?.label ?? "") : raw;
      setValue(student.id, criterion.key, value);
    },
  });

  /** Number keys choose the option; the rest of the sheet keeps its shortcuts. */
  function onCellKey(e: React.KeyboardEvent, row: number, col: number) {
    if (nav.onKeyDown(e, row, col)) return;
    if (!isScale) return;

    const student = students[row];
    const criterion = criteria[col];
    if (!student || !criterion) return;

    if (e.key === "Delete" || e.key === "Backspace" || e.key === " ") {
      e.preventDefault();
      setValue(student.id, criterion.key, "");
      return;
    }
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= scale.length) {
      e.preventDefault();
      setValue(student.id, criterion.key, scale[digit - 1]!.label);
      // Straight on to the next pupil: entering a column is the common path.
      if (row + 1 < students.length) nav.focusCell(row + 1, col);
    }
  }

  function fillColumn(col: number, value: string, onlyEmpty: boolean) {
    setDraft((d) => {
      const next = { ...d };
      const criterion = criteria[col];
      if (!criterion) return d;
      for (const s of students) {
        if (onlyEmpty && valueAt(s.id, criterion.key)) continue;
        next[s.id] = { ...(next[s.id] ?? {}), [criterion.key]: value };
      }
      return next;
    });
  }

  async function submit() {
    const rows: Record<string, { values: Record<string, { value?: string }>; notes?: string }> = {};
    for (const s of students) {
      if (!draft[s.id] && notes[s.id] === undefined) continue;
      // Everything this pupil has, not only what changed: the server replaces
      // the answer set, so a partial row would erase the rest.
      const values: Record<string, { value?: string }> = {};
      for (const c of criteria) {
        const v = valueAt(s.id, c.key);
        if (v) values[c.key] = { value: v };
      }
      rows[s.id] = { values, ...(notes[s.id] !== undefined ? { notes: notes[s.id]! } : {}) };
    }
    if (Object.keys(rows).length === 0) {
      toast.error("لا توجد تغييرات لحفظها");
      return;
    }
    try {
      const res = await saveGrid.mutateAsync({
        form,
        student_group: studentGroup,
        ...(course ? { course } : {}),
        rows,
      });
      toast.success(`تم حفظ تقييم ${res.saved} طالباً`);
      setDraft({});
      setNotes({});
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحفظ"));
    }
  }

  async function setVisible(show: boolean) {
    const entries = students.map((s) => s.entry).filter((e): e is string => Boolean(e));
    if (entries.length === 0) {
      toast.error("لا توجد تقييمات محفوظة بعد");
      return;
    }
    try {
      await publish.mutateAsync({ entries, is_published: show ? 1 : 0 });
      toast.success(show ? "أصبحت التقييمات ظاهرة للأهالي" : "تم إخفاء التقييمات");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر التحديث"));
    }
  }

  if (grid.isLoading) return <TableSkeleton rows={6} />;
  if (students.length === 0) {
    return <EmptyBlock title="لا يوجد طلاب في هذه الشعبة" />;
  }

  const filled = students.reduce(
    (n, s) => n + criteria.filter((c) => valueAt(s.id, c.key)).length,
    0,
  );
  const cells = students.length * criteria.length;

  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">{spec?.title}</p>
          <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Keyboard className="size-3" />
              {isScale
                ? `اضغط ${scale.map((_o, i) => i + 1).join("/")} لاختيار ${scale
                    .map((o) => o.label)
                    .join("/")}`
                : "أدخل القيمة ثم Enter"}
            </span>
            <span>· الأسهم للتنقّل · لصق من إكسل مدعوم</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Pill tone={filled === cells ? "success" : "info"}>
            <span className="num">
              {filled}/{cells}
            </span>{" "}
            خانة
          </Pill>
          <button
            onClick={() => void setVisible(true)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <Eye className="ms-1 inline size-3.5" />
            إظهار للأهالي
          </button>
          <button
            onClick={() => void setVisible(false)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            <EyeOff className="ms-1 inline size-3.5" />
            إخفاء
          </button>
          <button
            onClick={() => void submit()}
            disabled={!dirty || saveGrid.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-gradient px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
          >
            <Save className="size-3.5" />
            {saveGrid.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </div>

      {/* Wide sheets scroll inside their own box; the page never does. */}
      <div ref={nav.gridRef} className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            {(spec?.categories.length ?? 0) > 0 && (
              <tr>
                <th className="sticky right-0 z-20 bg-card" />
                {spec!.categories.map((cat) => (
                  <th
                    key={cat}
                    colSpan={criteria.filter((c) => c.category === cat).length}
                    className="border-b border-s border-border bg-secondary/60 px-2 py-1.5 text-center text-[11px] font-bold"
                  >
                    {cat}
                  </th>
                ))}
                {criteria.some((c) => !c.category) && (
                  <th
                    colSpan={criteria.filter((c) => !c.category).length}
                    className="border-b border-s border-border bg-secondary/60 px-2 py-1.5 text-center text-[11px] font-bold"
                  >
                    معايير عامة
                  </th>
                )}
                <th className="border-b border-s border-border bg-secondary/60" />
              </tr>
            )}
            <tr>
              <th className="sticky right-0 z-20 min-w-44 border-b border-border bg-card px-2 py-2 text-start text-xs font-bold">
                الطالب
              </th>
              {criteria.map((c, col) => (
                <th
                  key={c.key}
                  className="w-32 border-b border-s border-border bg-card px-1.5 py-2 align-bottom text-[11px] font-semibold"
                  title={c.help_text ?? c.item}
                >
                  <span className="line-clamp-3">{c.item}</span>
                  {isScale && (
                    <ColumnFill
                      options={scale.map((o) => o.label)}
                      onFill={(v, onlyEmpty) => fillColumn(col, v, onlyEmpty)}
                    />
                  )}
                </th>
              ))}
              <th className="w-24 border-b border-s border-border bg-card px-2 py-2 text-[11px] font-bold">
                المجموع
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, row) => (
              <tr key={s.id} className="hover:bg-secondary/30">
                <td className="sticky right-0 z-10 border-b border-border bg-card px-2 py-1.5">
                  <span className="block truncate text-xs font-semibold">{s.name}</span>
                  {s.is_published && <span className="text-[10px] text-success">ظاهر للأهل</span>}
                </td>

                {criteria.map((c, col) => {
                  const value = valueAt(s.id, c.key);
                  const tone = scale.find((o) => o.label === value)?.tone ?? "muted";
                  const edited = draft[s.id]?.[c.key] !== undefined;
                  return (
                    <td key={c.key} className="border-b border-s border-border p-1">
                      {isScale ? (
                        // A button rather than a select: the whole point is to
                        // answer with one keystroke, and a native dropdown
                        // takes the caret away to do it.
                        <button
                          id={nav.cellId(row, col)}
                          onKeyDown={(e) => onCellKey(e, row, col)}
                          onPaste={(e) => nav.onPaste(e, row, col)}
                          onClick={() => {
                            const at = scale.findIndex((o) => o.label === value);
                            const next = scale[(at + 1) % (scale.length + 1)];
                            setValue(s.id, c.key, next ? next.label : "");
                          }}
                          className={cn(
                            "h-8 w-full rounded-lg border text-center text-xs font-semibold outline-none transition-colors focus:ring-2 focus:ring-primary",
                            value ? TONE_CLASS[tone] : "bg-background text-muted-foreground",
                            edited ? "border-primary" : "border-border",
                          )}
                          title="اضغط رقم الخيار، أو انقر للتبديل"
                        >
                          {value || "—"}
                        </button>
                      ) : (
                        <Input
                          id={nav.cellId(row, col)}
                          {...(spec?.scale_type === "علامة رقمية" ? { type: "number" } : {})}
                          value={value}
                          onChange={(e) => setValue(s.id, c.key, e.target.value)}
                          onKeyDown={(e) => nav.onKeyDown(e, row, col)}
                          onPaste={(e) => nav.onPaste(e, row, col)}
                          className={cn("h-8 text-center text-xs", edited && "border-primary")}
                          {...(spec?.scale_type === "علامة رقمية" && c.max_score
                            ? { max: c.max_score }
                            : {})}
                        />
                      )}
                    </td>
                  );
                })}

                <td className="num border-b border-s border-border px-2 py-1.5 text-center text-xs font-bold">
                  {s.entry ? s.total : "—"}
                  {s.entry && spec?.max_total ? (
                    <span className="text-muted-foreground">/{spec.max_total}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Fill a column from its heading — most of a class, then fix the few. */
function ColumnFill({
  options,
  onFill,
}: {
  options: string[];
  onFill: (value: string, onlyEmpty: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative mt-1 block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-normal text-muted-foreground hover:bg-secondary hover:text-primary"
        title="تعبئة العمود"
      >
        <Wand2 className="size-3" />
        تعبئة
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <span className="absolute start-0 top-full z-50 mt-1 block w-36 rounded-xl border border-border bg-card p-1 shadow-card">
            {options.map((o) => (
              <span key={o} className="flex gap-1">
                <button
                  onClick={() => {
                    onFill(o, true);
                    setOpen(false);
                  }}
                  className="flex-1 rounded px-1.5 py-1 text-start text-[11px] hover:bg-secondary"
                  title="الفارغ فقط"
                >
                  {o}
                </button>
                <button
                  onClick={() => {
                    onFill(o, false);
                    setOpen(false);
                  }}
                  className="rounded bg-secondary px-1.5 py-1 text-[10px] font-semibold hover:bg-primary-soft hover:text-primary"
                  title="الكل"
                >
                  الكل
                </button>
              </span>
            ))}
            <button
              onClick={() => {
                onFill("", false);
                setOpen(false);
              }}
              className="mt-0.5 w-full rounded px-1.5 py-1 text-start text-[11px] text-destructive hover:bg-destructive-soft"
            >
              مسح العمود
            </button>
          </span>
        </>
      )}
    </span>
  );
}

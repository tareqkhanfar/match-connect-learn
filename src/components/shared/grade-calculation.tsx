import { useState } from "react";
import { toast } from "sonner";
import { Calculator, Check, ChevronDown, ChevronLeft, Settings2, X } from "lucide-react";
import { SectionCard, Pill } from "@/components/shared/ui-kit";
import { Input } from "@/components/ui/input";
import {
  useComputedMarks,
  useGradeRules,
  useSaveGradeRule,
  type ComputedStudent,
} from "@/lib/api/hooks";

/**
 * How a class's marks are being counted, and what that produces.
 *
 * Two things a teacher needs while a term is running: the rule for each
 * category ("count the best three of four"), and the arithmetic it produces
 * for each student. Both live here rather than in the assessment plan, because
 * the rule depends on how the term actually went — a plan written in September
 * cannot know that the third daily test was disrupted.
 */
export function GradeCalculation({
  studentGroup,
  course,
  canEdit,
}: {
  studentGroup: string;
  course: string;
  canEdit: boolean;
}) {
  const rulesQuery = useGradeRules(studentGroup, course);
  const computed = useComputedMarks(studentGroup, course);
  const saveRule = useSaveGradeRule();
  const [expanded, setExpanded] = useState<string | null>(null);

  const students = computed.data?.students ?? [];
  const modes = rulesQuery.data?.modes ?? [];

  // Every category in the plan, with the rule currently applied to it.
  const categories = students[0]
    ? students[0].quarters.flatMap((q) =>
        q.categories.map((c) => ({
          quarter: q.quarter,
          name: c.category,
          weight: c.weight,
          rule: c.rule,
          ruleN: c.ruleN,
          assessments: c.counted.length + c.dropped.length,
        })),
      )
    : [];

  async function apply(category: string, quarter: string, mode: string, n: number) {
    try {
      const res = await saveRule.mutateAsync({
        student_group: studentGroup,
        course,
        category,
        quarter,
        count_mode: mode,
        count_n: n,
      });
      toast.success(res.message_ar || "تم ضبط الاحتساب");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر ضبط الاحتساب");
    }
  }

  if (computed.isLoading) return null;
  if (!computed.data || students.length === 0) return null;

  return (
    <div className="space-y-6">
      {canEdit && categories.length > 0 && (
        <SectionCard
          title="طريقة احتساب العلامات"
          description="أنت تحدد كيف تُحتسب امتحانات كل تصنيف — والعلامات تتغيّر فوراً للطلاب."
        >
          <div className="space-y-2">
            {categories.map((c) => (
              <RuleRow
                key={`${c.quarter}-${c.name}`}
                category={c}
                modes={modes}
                busy={saveRule.isPending}
                onApply={(mode, n) => apply(c.name, c.quarter, mode, n)}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            الامتحان غير المرصود يُحتسب صفراً — العلامة ترتفع فقط عندما يُنجز العمل فعلاً.
          </p>
        </SectionCard>
      )}

      <SectionCard
        title="العلامات المحتسبة"
        description={`${students.length} طالباً — اضغط على أي طالب لعرض تفصيل الاحتساب.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 pl-4 font-medium">الطالب</th>
                {(computed.data.quarters ?? []).map((q) => (
                  <th key={q.name} className="py-2 pl-4 font-medium">
                    {q.name} <span className="font-normal">/{q.totalMarks}</span>
                  </th>
                ))}
                <th className="py-2 pl-4 font-medium">المجموع</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <StudentRows
                  key={s.student}
                  student={s}
                  open={expanded === s.student}
                  onToggle={() =>
                    setExpanded((prev) => (prev === s.student ? null : s.student))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function RuleRow({
  category,
  modes,
  busy,
  onApply,
}: {
  category: { name: string; quarter: string; weight: number; rule: string; ruleN: number; assessments: number };
  modes: Array<{ value: string; label: string }>;
  busy: boolean;
  onApply: (mode: string, n: number) => void;
}) {
  const [mode, setMode] = useState(category.rule || "all");
  const [n, setN] = useState(String(category.ruleN || Math.max(category.assessments - 1, 1)));

  const dirty = mode !== category.rule || (mode === "best" && Number(n) !== category.ruleN);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{category.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {category.quarter} · {category.weight} علامة · {category.assessments} امتحان
        </p>
      </div>

      <select
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
      >
        {modes.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {mode === "best" && (
        <Input
          type="number"
          min={1}
          max={category.assessments}
          value={n}
          onChange={(e) => setN(e.target.value)}
          className="num h-8 w-16 rounded-lg text-center text-xs"
          dir="ltr"
        />
      )}

      <button
        type="button"
        onClick={() => onApply(mode, Number(n) || 0)}
        disabled={busy || !dirty}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
      >
        <Check className="ml-1 inline size-3" />
        تطبيق
      </button>
    </div>
  );
}

function StudentRows({
  student,
  open,
  onToggle,
}: {
  student: ComputedStudent;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-border/60">
        <td className="py-2.5 pl-4 font-medium">{student.studentName}</td>
        {student.quarters.map((q) => (
          <td key={q.quarter} className="py-2.5 pl-4 tabular-nums">
            {q.marks}
          </td>
        ))}
        <td className="py-2.5 pl-4">
          <span className="font-bold tabular-nums">{student.marks}</span>
          <span className="text-xs text-muted-foreground"> / {student.totalMarks}</span>
        </td>
        <td className="py-2.5">
          <button
            onClick={onToggle}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] transition-colors hover:bg-secondary"
          >
            {open ? <ChevronDown className="size-3" /> : <ChevronLeft className="size-3" />}
            التفصيل
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={student.quarters.length + 3} className="bg-secondary/25 px-4 py-3">
            {/* The arithmetic, spelled out. A teacher explaining a mark to a
                parent should be able to read it straight off the screen. */}
            <div className="space-y-3">
              {student.quarters.map((q) => (
                <div key={q.quarter}>
                  <p className="text-xs font-bold">
                    {q.quarter}: {q.percent}% ← {q.marks} من {q.totalMarks}
                  </p>
                  <div className="mt-1.5 space-y-1.5">
                    {q.categories.map((c) => (
                      <div key={c.category} className="rounded-lg border border-border bg-card p-2.5">
                        <p className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-semibold">{c.category}</span>
                          <Pill tone="muted">{c.ruleLabel}{c.rule === "best" ? ` ${c.ruleN}` : ""}</Pill>
                          <span className="text-muted-foreground">
                            {c.percent}% × {c.weight} علامة = <b>{c.earned}</b>
                          </span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.counted.map((a) => (
                            <span
                              key={a.name}
                              className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700"
                            >
                              <Check className="size-2.5" />
                              {a.name}: {a.score}/{a.maxScore}
                              {a.missing && " (غير مرصود)"}
                            </span>
                          ))}
                          {c.dropped.map((a) => (
                            <span
                              key={a.name}
                              className="flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground line-through"
                            >
                              <X className="size-2.5" />
                              {a.name}: {a.score}/{a.maxScore}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

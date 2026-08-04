import { createFileRoute } from "@tanstack/react-router";
import { BookOpenCheck, Download, FileDown, Save, Settings2, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  KpiCard,
  PageHeader,
  Pill,
  ProgressBar,
  SectionCard,
} from "@/components/shared/ui-kit";
import { GradeBadge, progressTone } from "@/components/shared/grade-badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import {
  useClasses,
  useClassTermGrades,
  useEntrySheet,
  useSaveMarks,
  useSchemes,
  useSubjects,
  type SchemeComponent,
  useImportableAssignments,
  useImportAssignment,
  useImportAssignmentsCombined,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/gradebook")({
  head: () => ({
    meta: [
      { title: "سجل العلامات — Match Education" },
      {
        name: "description",
        content: "إدخال علامات الطلاب لكل مكوّن تقييم واحتساب علامة الفصل تلقائياً.",
      },
    ],
  }),
  // The term-workflow page links straight to a class/subject.
  validateSearch: (search: Record<string, unknown>): { group?: string; course?: string } => ({
    ...(typeof search["group"] === "string" && search["group"] ? { group: search["group"] } : {}),
    ...(typeof search["course"] === "string" && search["course"]
      ? { course: search["course"] }
      : {}),
  }),
  component: GradebookPage,
});

const TYPE_AR: Record<string, string> = {
  Exam: "امتحان",
  Quiz: "اختبار قصير",
  Activity: "نشاط",
  Homework: "واجب",
  Participation: "مشاركة",
  Project: "مشروع",
  Bonus: "درجة إضافية",
};

function GradebookPage() {
  const { role } = useApp();
  const canEnter = role === "admin" || role === "secretary" || role === "teacher";

  const classesQuery = useClasses();
  const subjectsQuery = useSubjects();

  // A link from the term-workflow page preselects the class and subject.
  const { group: groupFromUrl, course: courseFromUrl } = Route.useSearch();
  const [group, setGroup] = useState(groupFromUrl ?? "");
  const [course, setCourse] = useState(courseFromUrl ?? "");
  const [importing, setImporting] = useState(false);

  // Default to the first class the user can see.
  useEffect(() => {
    if (!group && classesQuery.data?.length) setGroup(classesQuery.data[0]!.name);
  }, [classesQuery.data, group]);

  if (!canEnter) {
    return (
      <>
        <PageHeader title="سجل العلامات" subtitle="إدخال العلامات" />
        <EmptyBlock
          title="هذه الصفحة للمعلمين والإدارة"
          description="يمكنك متابعة علاماتك من صفحة «الامتحانات والدرجات»."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="رصد العلامات"
        subtitle="أدخل علامات كل مكوّن، وتُحتسب علامة المادة تلقائياً"
        actions={
          group && course ? (
            <button
              onClick={() => setImporting(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-secondary active:translate-y-0"
            >
              <FileDown className="size-4" />
              ترحيل علامات الواجبات
            </button>
          ) : null
        }
      />

      <div className="card-surface mb-5 grid gap-3 p-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">الشعبة</Label>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="اختر الشعبة" />
            </SelectTrigger>
            <SelectContent>
              {(classesQuery.data ?? []).map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  <SelectItemLabel code={c.name}>
                    {c.student_group_name} ({c.students})
                  </SelectItemLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">المادة</Label>
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="اختر المادة" />
            </SelectTrigger>
            <SelectContent>
              {(subjectsQuery.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <SelectItemLabel code={s.id}>{s.course_name}</SelectItemLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!group || !course ? (
        <EmptyBlock
          title="اختر الشعبة والمادة"
          description="ثم أدخل العلامات لكل مكوّن من مكوّنات التقييم."
          icon={<BookOpenCheck className="size-6" />}
        />
      ) : (
        <Tabs defaultValue="entry" dir="rtl">
          <TabsList className="mb-4 h-auto flex-wrap rounded-xl p-1">
            <TabsTrigger value="entry" className="rounded-lg">
              إدخال العلامات
            </TabsTrigger>
            <TabsTrigger value="summary" className="rounded-lg">
              علامات الفصل للشعبة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entry">
            <MarkEntry group={group} course={course} />
          </TabsContent>
          <TabsContent value="summary">
            <ClassSummary group={group} course={course} />
          </TabsContent>
        </Tabs>
      )}

      {importing && group && course && (
        <ImportAssignmentsDialog
          group={group}
          course={course}
          onClose={() => setImporting(false)}
        />
      )}
    </>
  );
}

/** Enter one component's marks for a whole class. */
function MarkEntry({ group, course }: { group: string; course: string }) {
  const [component, setComponent] = useState<string>("");
  const sheet = useEntrySheet({
    student_group: group,
    course,
    component_name: component || undefined,
  });
  const saveMarks = useSaveMarks();

  const components = sheet.data?.components ?? [];
  const active: SchemeComponent | undefined =
    components.find((c) => c.component_name === component) ?? components[0];

  // Pick the first component once the scheme loads.
  useEffect(() => {
    if (!component && components.length) setComponent(components[0]!.component_name);
  }, [components, component]);

  const [marks, setMarks] = useState<Record<string, string>>({});
  useEffect(() => {
    // Reset edits when the class, subject or component changes.
    setMarks({});
  }, [group, course, component]);

  const rows = sheet.data?.rows ?? [];
  const maxScore = active?.max_score ?? 100;

  function valueFor(student: string, saved: number | null) {
    const edited = marks[student];
    if (edited !== undefined) return edited;
    return saved != null ? String(saved) : "";
  }

  const overMax = useMemo(
    () =>
      rows.filter((r) => {
        const raw = valueFor(r.student, r.score);
        return raw !== "" && Number(raw) > maxScore && active?.component_type !== "Bonus";
      }).length,
    [rows, marks, maxScore, active],
  );

  async function save() {
    if (!active) return;
    const payload = {
      student_group: group,
      course,
      component_name: active.component_name,
      component_type: active.component_type,
      max_score: active.max_score,
      weight: active.weight,
      is_bonus: active.component_type === "Bonus" ? 1 : 0,
      marks: rows.map((r) => ({
        student: r.student,
        student_name: r.student_name,
        score: valueFor(r.student, r.score),
      })),
    };
    try {
      const res = await saveMarks.mutateAsync(payload);
      toast.success(`تم حفظ ${res.created + res.updated} علامة`);
      if (res.skipped?.length) {
        toast.warning(`تم تجاوز ${res.skipped.length} علامة تفوق الحد الأقصى`);
      }
      setMarks({});
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر حفظ العلامات");
    }
  }

  function fillAll(value: string) {
    const next: Record<string, string> = {};
    for (const r of rows) next[r.student] = value;
    setMarks(next);
  }

  if (sheet.error) return <ErrorState error={sheet.error} onRetry={() => sheet.refetch()} />;
  if (sheet.isLoading) return <TableSkeleton rows={8} />;

  if (!sheet.data?.scheme) {
    return (
      <EmptyBlock
        title="لا توجد خطة تقييم لهذه المادة"
        description="أنشئ خطة تقييم أولاً من صفحة خطط التقييم لتحديد المكوّنات وأوزانها."
        icon={<Settings2 className="size-6" />}
      />
    );
  }

  return (
    <>
      {/* component tabs */}
      <div className="card-surface mb-4 p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          مكوّنات التقييم — {sheet.data.scheme.scheme_name}
        </p>
        <div className="flex flex-wrap gap-2">
          {components.map((c) => {
            const isActive = c.component_name === active?.component_name;
            return (
              <button
                key={c.component_name}
                onClick={() => setComponent(c.component_name)}
                className={
                  isActive
                    ? "rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground"
                    : "rounded-xl bg-secondary px-3.5 py-2 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                }
              >
                {c.component_type === "Bonus" && <Sparkles className="ml-1 inline size-3" />}
                {c.component_name}
                <span className="mr-1.5 opacity-70">
                  ({c.component_type === "Bonus" ? "إضافي " : ""}
                  {c.weight}%)
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <SectionCard
        title={active ? `${active.component_name} — من ${active.max_score}` : "إدخال العلامات"}
        description={
          active
            ? `${TYPE_AR[active.component_type] ?? active.component_type} • الوزن ${active.weight}%${
                active.component_type === "Bonus" ? " (خارج الـ100%)" : ""
              } • ${sheet.data.entered} من ${sheet.data.total} مُدخلة`
            : ""
        }
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="تعبئة الكل"
              onChange={(e) => e.target.value && fillAll(e.target.value)}
              className="num h-9 w-28 rounded-lg text-center"
            />
            <button
              onClick={save}
              disabled={saveMarks.isPending || rows.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-gradient px-3.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              <Save className="size-3.5" />
              {saveMarks.isPending ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </div>
        }
      >
        {overMax > 0 && (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs font-semibold text-destructive">
            {overMax} علامة تتجاوز الحد الأقصى ({maxScore}) ولن يتم حفظها.
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyBlock title="لا يوجد طلاب في هذه الشعبة" icon={<Users className="size-6" />} />
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const raw = valueFor(r.student, r.score);
              const num = raw === "" ? null : Number(raw);
              const invalid = num != null && num > maxScore && active?.component_type !== "Bonus";
              const pct = num != null && maxScore ? (num / maxScore) * 100 : null;
              return (
                <li
                  key={r.student}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-border p-3"
                >
                  <Avatar name={r.student_name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.student_name}</p>
                    <p className="num text-xs text-muted-foreground">{r.student}</p>
                  </div>
                  {pct != null && !invalid ? (
                    <GradeBadge percentage={Math.round(pct * 10) / 10} size="sm" showPercentage />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={raw}
                      onChange={(e) => setMarks((p) => ({ ...p, [r.student]: e.target.value }))}
                      className={
                        invalid
                          ? "num h-9 w-24 rounded-lg border-destructive text-center"
                          : "num h-9 w-24 rounded-lg text-center"
                      }
                    />
                    <span className="text-xs text-muted-foreground">/ {maxScore}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

/** Whole-class term grades for the selected subject. */
function ClassSummary({ group, course }: { group: string; course: string }) {
  const query = useClassTermGrades({ student_group: group, course });
  const rows = query.data?.rows ?? [];
  const graded = rows.filter((r) => r.entries > 0);

  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.isLoading) return <TableSkeleton rows={8} />;

  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="متوسط الشعبة"
          value={`${query.data?.class_average ?? 0}%`}
          icon={BookOpenCheck}
          tone="primary"
        />
        <KpiCard label="طلاب لديهم علامات" value={graded.length} icon={Users} tone="accent" />
        <KpiCard
          label="ناجحون"
          value={graded.filter((r) => r.final >= 50).length}
          icon={Sparkles}
          tone="info"
        />
      </div>

      <SectionCard title="علامات الفصل" description={`${rows.length} طالباً`}>
        {rows.length === 0 ? (
          <EmptyBlock title="لا توجد علامات بعد" />
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li
                key={r.student}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3"
              >
                <Avatar name={r.student_name} />
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{r.student_name}</p>
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {r.entries} مكوّن
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={r.final} tone={progressTone(r.final)} />
                  </div>
                  {r.bonus > 0 && (
                    <p className="mt-1 text-[11px] text-success">
                      يشمل {r.bonus} درجة إضافية (قبل الإضافة {r.percentage}%)
                    </p>
                  )}
                </div>
                {r.entries > 0 ? (
                  <GradeBadge
                    percentage={r.final}
                    grade={r.grade}
                    emoji={r.emoji}
                    label={r.label}
                    size="lg"
                  />
                ) : (
                  <Pill tone="muted">لم تُدخل</Pill>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

/**
 * Carry assignment marks into the term gradebook.
 *
 * Schools usually want one "الواجبات" line rather than a row per assignment,
 * so the combined mode averages each student's assignments as a percentage.
 */
function ImportAssignmentsDialog({
  group,
  course,
  onClose,
}: {
  group: string;
  course: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useImportableAssignments({ student_group: group, course });
  const importOne = useImportAssignment();
  const importCombined = useImportAssignmentsCombined();

  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"combined" | "separate">("combined");
  const [componentName, setComponentName] = useState("الواجبات");
  const [weight, setWeight] = useState("20");

  const ready = (data ?? []).filter((a) => a.ready);
  const busy = importOne.isPending || importCombined.isPending;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit() {
    if (selected.length === 0) {
      toast.error("اختر واجباً واحداً على الأقل");
      return;
    }
    try {
      if (mode === "combined") {
        await importCombined.mutateAsync({
          student_group: group,
          course,
          assignments: selected,
          component_name: componentName || "الواجبات",
          ...(weight ? { weight: Number(weight) } : {}),
        });
      } else {
        for (const id of selected) {
          await importOne.mutateAsync({
            assignment: id,
            ...(weight ? { weight: Number(weight) } : {}),
          });
        }
      }
      toast.success(
        mode === "combined"
          ? `تم ترحيل ${selected.length} واجب كمكوّن واحد`
          : `تم ترحيل ${selected.length} واجب كمكوّنات منفصلة`,
      );
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الترحيل");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">ترحيل علامات الواجبات — {course}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-info/30 bg-info-soft p-3 text-xs leading-relaxed">
            تُرحّل علامات الواجبات المُصححة فقط. الطلاب الذين لم تُصحّح واجباتهم بعد لا تُحتسب لهم
            علامة (ولا تُصفَّر).
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
            <button
              onClick={() => setMode("combined")}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                mode === "combined" ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              مكوّن واحد (متوسط)
            </button>
            <button
              onClick={() => setMode("separate")}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                mode === "separate" ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              مكوّن لكل واجب
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {mode === "combined" && (
              <div className="space-y-1.5">
                <Label className="text-xs">اسم المكوّن</Label>
                <Input
                  value={componentName}
                  onChange={(e) => setComponentName(e.target.value)}
                  className="h-9 rounded-lg"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">الوزن (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="num h-9 rounded-lg"
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs">
              الواجبات المُصححة ({ready.length})
            </Label>
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
            ) : ready.length === 0 ? (
              <EmptyBlock
                title="لا توجد واجبات مُصححة"
                description="صحّح تسليمات الواجبات أولاً حتى تتمكن من ترحيل علاماتها."
              />
            ) : (
              <ul className="space-y-2">
                {ready.map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-secondary/40">
                      <input
                        type="checkbox"
                        checked={selected.includes(a.id)}
                        onChange={() => toggle(a.id)}
                        className="size-4 accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{a.title}</span>
                        <span className="num block text-[11px] text-muted-foreground">
                          مُصحح {a.graded}/{a.total} • من {a.max} • التسليم {a.due}
                        </span>
                      </span>
                      {a.imported && <Pill tone="muted">مُرحّل سابقاً</Pill>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={busy || selected.length === 0}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "جارٍ الترحيل…" : `ترحيل (${selected.length})`}
          </button>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

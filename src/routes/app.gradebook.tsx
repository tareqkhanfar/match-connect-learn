import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpenCheck,
  ExternalLink,
  FileDown,
  History,
  Settings2,
  Sparkles,
  Table2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  KpiCard,
  PageHeader,
  Pill,
  ProgressBar,
  SectionCard,
} from "@/components/shared/ui-kit";
import { GradeCalculation } from "@/components/shared/grade-calculation";
import { GradeBadge, progressTone } from "@/components/shared/grade-badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useSubjects,
  useImportableAssignments,
  useImportAssignment,
  useImportAssignmentsCombined,
  useMarkChangeLog,
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

function GradebookPage() {
  const { role } = useApp();
  const canEnter = role === "admin" || role === "secretary" || role === "teacher";

  const classesQuery = useClasses();

  // The term-workflow page links straight to a class/subject.
  const { group: groupFromUrl, course: courseFromUrl } = Route.useSearch();
  const [group, setGroup] = useState(groupFromUrl ?? "");
  // Subjects follow the chosen class: a teacher is offered what they teach in
  // it, not every subject of the grade.
  const subjectsQuery = useSubjects(group ? { student_group: group } : {});
  const [course, setCourse] = useState(courseFromUrl ?? "");
  const [importing, setImporting] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

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
        title="سجل العلامات"
        subtitle="افتح ورقة العلامات لإدخال الدرجات، أو راجع الاحتساب وسجل التعديلات"
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
          <Select
            value={group}
            onValueChange={(v) => {
              setGroup(v);
              // A subject picked for another class is not offered here.
              setCourse("");
            }}
          >
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
          description="ثم افتح ورقة العلامات لإدخال الدرجات."
          icon={<BookOpenCheck className="size-6" />}
        />
      ) : (
        <>
          <MarkActions
            group={group}
            course={course}
            onLog={() => setShowLog(true)}
            onCalc={() => setShowCalc(true)}
          />

          <div className="mt-6">
            <SectionCard
              title="علامات الفصل للشعبة"
              description="العلامة النهائية لكل طالب في هذه المادة"
            >
              <ClassSummary group={group} course={course} />
            </SectionCard>
          </div>
        </>
      )}

      {importing && group && course && (
        <ImportAssignmentsDialog
          group={group}
          course={course}
          onClose={() => setImporting(false)}
        />
      )}

      {showLog && group && course && (
        <ChangeLogDialog group={group} course={course} onClose={() => setShowLog(false)} />
      )}

      {showCalc && group && course && (
        <Dialog open onOpenChange={(v) => !v && setShowCalc(false)}>
          <DialogContent className="max-w-4xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="size-5 text-primary" />
                طريقة احتساب العلامات
              </DialogTitle>
            </DialogHeader>
            {/* The arithmetic behind every mark: which assessments counted,
                which the teacher's rule dropped, and what each category came
                to. A teacher explaining a mark to a parent reads it here. */}
            <div className="max-h-[70vh] overflow-y-auto">
              <GradeCalculation studentGroup={group} course={course} canEdit={canEnter} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/**
 * The three things a teacher does with a subject's marks.
 *
 * Entering them is the big one and opens its own screen; the other two —
 * checking the arithmetic and reading what changed — are references, so they
 * open over this page rather than replacing it.
 */
function MarkActions({
  group,
  course,
  onLog,
  onCalc,
}: {
  group: string;
  course: string;
  onLog: () => void;
  onCalc: () => void;
}) {
  const sheet = useEntrySheet({ student_group: group, course });
  const columns = sheet.data?.columns ?? [];
  const students = sheet.data?.rows.length ?? 0;

  const marked = columns.reduce((n, c) => n + c.marked, 0);
  const capacity = columns.length * students;
  const publishedColumns = columns.filter((c) => c.publish_state === "published").length;
  const excluded = columns.filter((c) => c.excluded).length;

  const href = `/marks?group=${encodeURIComponent(group)}&course=${encodeURIComponent(course)}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* Opening in its own tab is deliberate: a teacher keeps the calculation
          on this page and the sheet beside it while marking. */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="card-surface group flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft"
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-primary-foreground">
          <Table2 className="size-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-base font-black">فتح ورقة العلامات</span>
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            شاشة كاملة على شكل جدول — كل الطلاب وكل المكوّنات معاً، مع النشر والسحب والتعديل
          </span>
          <span className="num mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <Pill tone={marked >= capacity && capacity > 0 ? "success" : "muted"}>
              {marked} / {capacity} علامة
            </Pill>
            <Pill tone="muted">{students} طالباً</Pill>
            <Pill tone="muted">{columns.length} مكوّناً</Pill>
            {publishedColumns > 0 && <Pill tone="success">{publishedColumns} منشور</Pill>}
            {excluded > 0 && <Pill tone="danger">{excluded} مستبعد</Pill>}
          </span>
        </span>
      </a>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <button
          onClick={onCalc}
          className="card-surface flex items-center gap-3 p-4 text-right transition-all hover:-translate-y-0.5 hover:shadow-soft"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info">
            <Settings2 className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">طريقة الاحتساب</span>
            <span className="block text-[11px] text-muted-foreground">
              كيف تكوّنت علامة كل طالب بالتفصيل
            </span>
          </span>
        </button>

        <button
          onClick={onLog}
          className="card-surface flex items-center gap-3 p-4 text-right transition-all hover:-translate-y-0.5 hover:shadow-soft"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warm-soft text-warm-foreground">
            <History className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">سجل التعديلات</span>
            <span className="block text-[11px] text-muted-foreground">
              كل علامة تغيّرت: قبل، بعد، ومن غيّرها
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

/** Every mark that changed after it was first entered. */
function ChangeLogDialog({
  group,
  course,
  onClose,
}: {
  group: string;
  course: string;
  onClose: () => void;
}) {
  const log = useMarkChangeLog(group, course);
  const changes = log.data?.changes ?? [];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            سجل تعديلات العلامات
          </DialogTitle>
        </DialogHeader>

        {log.data?.reopen && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs">
            <p className="font-bold text-amber-800">أُعيد فتح هذه العلامات للتعديل</p>
            <p className="mt-0.5 text-amber-700">
              السبب: {log.data.reopen.reason} — بواسطة {log.data.reopen.by} في{" "}
              {log.data.reopen.on.slice(0, 16)}
            </p>
          </div>
        )}

        {log.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : changes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            لا توجد تعديلات مسجّلة على علامات هذه المادة.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-card text-[11px] text-muted-foreground">
                <tr>
                  <th className="pb-1.5 font-semibold">الطالب</th>
                  <th className="pb-1.5 font-semibold">المكوّن</th>
                  <th className="pb-1.5 font-semibold">قبل</th>
                  <th className="pb-1.5 font-semibold">بعد</th>
                  <th className="pb-1.5 font-semibold">الفرق</th>
                  <th className="pb-1.5 font-semibold">بواسطة</th>
                  <th className="pb-1.5 font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {changes.map((c) => {
                  const diff = (c.to ?? 0) - (c.from ?? 0);
                  return (
                    <tr key={c.id}>
                      <td className="py-1.5 font-semibold">{c.studentName}</td>
                      <td className="py-1.5 text-muted-foreground">{c.component}</td>
                      <td className="num py-1.5 text-destructive line-through">{c.from ?? "—"}</td>
                      <td className="num py-1.5 font-bold text-emerald-700">{c.to ?? "—"}</td>
                      <td
                        className={`num py-1.5 font-semibold ${
                          diff > 0 ? "text-emerald-700" : diff < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td className="py-1.5 text-muted-foreground">{c.by}</td>
                      <td className="num py-1.5 text-muted-foreground">{c.at.slice(0, 16)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
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
            <Label className="mb-2 block text-xs">الواجبات المُصححة ({ready.length})</Label>
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

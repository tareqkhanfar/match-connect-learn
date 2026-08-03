import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  NotebookPen,
  Plus,
  Send,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Pill, ProgressBar } from "@/components/shared/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { RichText, RichTextView } from "@/components/shared/rich-text";
import {
  FileList,
  FileUpload,
  type UploadedFile,
} from "@/components/shared/file-upload";
import { useApp } from "@/lib/app-context";
import {
  useAssignments,
  useClasses,
  useGradeSubmission,
  useSaveAssignment,
  useSubjects,
  useSubmission,
  useSubmissions,
  useSubmitAssignment,
} from "@/lib/api/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/assignments")({
  head: () => ({
    meta: [
      { title: "الواجبات — Match Education" },
      {
        name: "description",
        content: "إنشاء الواجبات، متابعة تسليم الطلاب، وتصحيح المعلم في مكان واحد.",
      },
      { property: "og:title", content: "الواجبات — Match Education" },
      { property: "og:description", content: "أنشئ الواجبات وتابع التسليم والتصحيح." },
    ],
  }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { role } = useApp();
  const isStaff = role === "admin" || role === "secretary" || role === "teacher";
  const isStudent = role === "student";

  const { data, isLoading, error, refetch } = useAssignments();
  const assignments = data ?? [];

  const [gradingFor, setGradingFor] = useState<string | null>(null);
  const [submittingFor, setSubmittingFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="الواجبات"
        subtitle={`${assignments.length} واجباً`}
        actions={
          isStaff ? (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
            >
              <Plus className="size-4" />
              واجب جديد
            </button>
          ) : null
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={6} />
      ) : assignments.length === 0 ? (
        <EmptyBlock title="لا توجد واجبات" icon={<NotebookPen className="size-6" />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assignments.map((a) => {
            const total = Number(a.total ?? 0);
            const submitted = Number(a.submitted ?? 0);
            return (
              <div key={a.id} className="card-surface p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.subject} • {a.grade}
                    </p>
                  </div>
                  <Pill
                    tone={a.status === "مفتوح" ? "info" : a.status === "مغلق" ? "muted" : "warning"}
                  >
                    {a.status}
                  </Pill>
                </div>

                <p className="num mt-3 text-xs text-muted-foreground">تاريخ التسليم: {a.due}</p>

                {isStaff && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>التسليم</span>
                      <span className="num">
                        {submitted}/{total}
                      </span>
                    </div>
                    <ProgressBar value={total ? (submitted / total) * 100 : 0} tone="success" />
                    <button
                      onClick={() => setGradingFor(a.id)}
                      className="mt-3 w-full rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                    >
                      عرض التسليمات والتصحيح
                    </button>
                  </div>
                )}

                {!isStaff && (
                  <div className="mt-3 border-t border-border pt-3">
                    {a.my_submission ? (
                      <div className="flex items-center justify-between gap-2">
                        <Pill tone={a.my_submission.status_raw === "Graded" ? "success" : "info"}>
                          {a.my_submission.status}
                        </Pill>
                        {a.my_submission.score != null && (
                          <span className="num text-sm font-bold">
                            {a.my_submission.score}/{a.max}
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        <Pill tone="warning">لم يُسلّم</Pill>
                        {isStudent && (
                          <button
                            onClick={() => setSubmittingFor(a.id)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-3 py-2 text-xs font-bold text-primary-foreground"
                          >
                            <Send className="size-3.5" />
                            تسليم الواجب
                          </button>
                        )}
                      </>
                    )}
                    {a.my_submission?.feedback && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        ملاحظة المعلم: {a.my_submission.feedback}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {creating && <AssignmentDialog onClose={() => setCreating(false)} />}
      {gradingFor && <GradingDialog assignment={gradingFor} onClose={() => setGradingFor(null)} />}
      {submittingFor && (
        <SubmitDialog assignment={submittingFor} onClose={() => setSubmittingFor(null)} />
      )}
    </>
  );
}

function GradingDialog({ assignment, onClose }: { assignment: string; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useSubmissions(assignment);
  const gradeSubmission = useGradeSubmission();
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  async function saveScore(student: string) {
    const raw = scores[student];
    if (raw === undefined || raw === "") return;
    const max = data?.assignment.max ?? 100;
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0 || value > max) {
      toast.error(`الدرجة يجب أن تكون بين ٠ و${max}`);
      return;
    }
    try {
      await gradeSubmission.mutateAsync({
        assignment,
        student,
        score: value,
        ...(feedback[student] ? { feedback: feedback[student] } : {}),
      });
      toast.success("تم حفظ الدرجة");
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر حفظ الدرجة";
      toast.error(message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {data ? `${data.assignment.title} — التسليمات` : "التسليمات"}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={5} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              سلّم {data!.submitted} من {data!.total} طالبًا — الدرجة العظمى {data!.assignment.max}
            </p>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {data!.rows.map((r) => {
                const open = expanded === r.student;
                const hasWork = Boolean(r.content) || (r.files?.length ?? 0) > 0;
                return (
                  <div key={r.student} className="rounded-xl border border-border">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 p-3">
                      <button
                        onClick={() => setExpanded(open ? null : r.student)}
                        disabled={!hasWork}
                        title={hasWork ? "عرض التسليم" : "لا يوجد تسليم"}
                        aria-label={`عرض تسليم ${r.student_name}`}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.student_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.status}
                          {r.files?.length ? ` — ${r.files.length} مرفق` : ""}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={data!.assignment.max}
                        placeholder="الدرجة"
                        value={scores[r.student] ?? (r.score != null ? String(r.score) : "")}
                        onChange={(e) => setScores((p) => ({ ...p, [r.student]: e.target.value }))}
                        className="num h-9 w-24 rounded-lg text-center"
                      />
                      <button
                        onClick={() => saveScore(r.student)}
                        disabled={gradeSubmission.isPending}
                        className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold hover:bg-primary-soft hover:text-primary disabled:opacity-50"
                      >
                        حفظ
                      </button>
                    </div>

                    {open && (
                      <div className="space-y-3 border-t border-border bg-muted/20 p-3">
                        <div>
                          <Label className="mb-1.5 block text-xs">إجابة الطالب</Label>
                          <div className="rounded-lg border border-border bg-background p-3">
                            <RichTextView html={r.content ?? ""} />
                          </div>
                        </div>
                        {r.files?.length ? (
                          <div>
                            <Label className="mb-1.5 block text-xs">المرفقات</Label>
                            <FileList files={r.files} />
                          </div>
                        ) : null}
                        <div>
                          <Label className="mb-1.5 block text-xs">ملاحظات للطالب</Label>
                          <textarea
                            rows={2}
                            value={feedback[r.student] ?? r.feedback ?? ""}
                            onChange={(e) =>
                              setFeedback((p) => ({ ...p, [r.student]: e.target.value }))
                            }
                            placeholder="اكتب ملاحظاتك… تُحفظ مع الدرجة"
                            className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <DialogFooter className="sm:justify-start">
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmitDialog({ assignment, onClose }: { assignment: string; onClose: () => void }) {
  const submit = useSubmitAssignment();
  const { data, isLoading, error } = useSubmission(assignment);

  const [content, setContent] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Seed the editor from any previous attempt, once the fetch settles.
  useEffect(() => {
    if (!data || loaded) return;
    setContent(data.submission?.content ?? "");
    setFiles(data.submission?.files ?? []);
    setLoaded(true);
  }, [data, loaded]);

  const info = data?.assignment;
  const existing = data?.submission;
  const locked = existing?.status === "Graded" || existing?.status === "Returned";
  const overdue = Boolean(info?.due && info.due < new Date().toISOString().slice(0, 10));
  const hasAnswer = Boolean(content.replace(/<[^>]*>/g, "").trim()) || files.length > 0;

  async function send() {
    try {
      const result = await submit.mutateAsync({ assignment, content, files });
      toast.success(
        result.status === "Late" ? "تم التسليم متأخرًا" : "تم تسليم الواجب بنجاح",
      );
      onClose();
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر تسليم الواجب";
      toast.error(message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {info ? `تسليم: ${info.title}` : "تسليم الواجب"}
          </DialogTitle>
        </DialogHeader>

        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>}
        {error && (
          <p className="py-6 text-center text-sm text-destructive">تعذّر تحميل تفاصيل الواجب.</p>
        )}

        {info && (
          <div className="space-y-5">
            {/* Brief: what was asked, when it is due, how it is marked. */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">المادة:</span>
                  <strong>{info.course}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">التسليم:</span>
                  <strong className={overdue ? "text-destructive" : ""}>{info.due}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">الدرجة:</span>
                  <strong>{info.max}</strong>
                </span>
              </div>
              {info.description ? (
                <RichTextView html={info.description} />
              ) : (
                <p className="text-sm text-muted-foreground">لم يضف المعلم وصفًا لهذا الواجب.</p>
              )}
              {info.files.length > 0 && (
                <div className="mt-3">
                  <Label className="mb-2 block text-xs">ملفات المعلم</Label>
                  <FileList files={info.files} />
                </div>
              )}
            </div>

            {overdue && !locked && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                انتهى موعد التسليم — سيُسجَّل تسليمك كمتأخر.
              </p>
            )}

            {locked ? (
              /* Already marked: show the work and the feedback, read-only. */
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    تم تصحيح هذا الواجب — الدرجة {existing?.score ?? 0} من {info.max}
                  </span>
                </div>
                <div>
                  <Label className="mb-2 block">إجابتك</Label>
                  <div className="rounded-xl border border-border p-3">
                    <RichTextView html={existing?.content ?? ""} />
                  </div>
                </div>
                {existing?.files.length ? (
                  <div>
                    <Label className="mb-2 block">مرفقاتك</Label>
                    <FileList files={existing.files} />
                  </div>
                ) : null}
                {existing?.feedback && (
                  <div>
                    <Label className="mb-2 block">ملاحظات المعلم</Label>
                    <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                      {existing.feedback}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <Label className="mb-2 block">إجابتك</Label>
                  <RichText
                    value={content}
                    onChange={setContent}
                    placeholder="اكتب إجابتك هنا… يمكنك التنسيق والترقيم"
                    disabled={submit.isPending}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">المرفقات</Label>
                  <FileUpload
                    files={files}
                    onChange={setFiles}
                    disabled={submit.isPending}
                  />
                </div>
                {existing && (
                  <p className="text-xs text-muted-foreground">
                    سلّمت هذا الواجب في {existing.submitted_on.slice(0, 16)} — إعادة التسليم ستحل
                    محل التسليم السابق.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          {!locked && (
            <button
              onClick={send}
              disabled={submit.isPending || !hasAnswer || isLoading}
              className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {submit.isPending ? "جارٍ التسليم…" : existing ? "إعادة التسليم" : "تسليم"}
            </button>
          )}
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            {locked ? "إغلاق" : "إلغاء"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentDialog({ onClose }: { onClose: () => void }) {
  const save = useSaveAssignment();
  const classesQuery = useClasses();
  const subjectsQuery = useSubjects();

  const [form, setForm] = useState({
    title: "",
    course: "",
    student_group: "",
    due_date: "",
    maximum_score: "100",
    description: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    const missing = !form.title.trim() || !form.course || !form.student_group || !form.due_date;
    if (missing) {
      toast.error("العنوان والمادة والشعبة وتاريخ التسليم مطلوبة");
      return;
    }
    try {
      await save.mutateAsync({ ...form, maximum_score: Number(form.maximum_score) || 100 });
      toast.success("تم إنشاء الواجب");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">واجب جديد</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>عنوان الواجب *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المادة *</Label>
            <Select value={form.course} onValueChange={(v) => set("course", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر المادة" />
              </SelectTrigger>
              <SelectContent>
                {(subjectsQuery.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.course_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الشعبة *</Label>
            <Select value={form.student_group} onValueChange={(v) => set("student_group", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر الشعبة" />
              </SelectTrigger>
              <SelectContent>
                {(classesQuery.data ?? []).map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.student_group_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ التسليم *</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الدرجة العظمى</Label>
            <Input
              type="number"
              min={1}
              value={form.maximum_score}
              onChange={(e) => set("maximum_score", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>الوصف</Label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border bg-card p-3 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
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

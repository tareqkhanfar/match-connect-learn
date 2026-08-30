import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
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
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { FileList, FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { apiUpload } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { byRole } from "@/lib/roles";
import {
  useAnswerAssignmentQuestion,
  useAskAssignmentQuestion,
  useAssignmentQuestions,
  useAssignmentSolution,
  useAssignments,
  useClasses,
  useGradingSheet,
  usePublishSolution,
  useSaveAssignment,
  useRecordAssignmentView,
  useSaveGrades,
  useSubjects,
  useSubmission,
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
  validateSearch: groupSearch,
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

  // A family sees the child chosen in the header.
  const viewed = useViewedStudent();
  const { data, isLoading, error, refetch } = useAssignments(viewed ? { student: viewed } : {});
  const assignments = data ?? [];

  const [gradingFor, setGradingFor] = useState<string | null>(null);
  const [submittingFor, setSubmittingFor] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={byRole(role, "الواجبات", {
          teacher: "واجبات صفوفي",
          student: "واجباتي",
          parent: "واجبات الأبناء",
        })}
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

                    {/* Asking about the homework, and the model answer once the
                        teacher releases it — both belong on the homework
                        itself rather than in a message that scrolls away. */}
                    <button
                      onClick={() => setDetailFor(a.id)}
                      className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                    >
                      الاستفسارات وحلول الواجب
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {creating && <AssignmentDialog onClose={() => setCreating(false)} />}
      {gradingFor && <GradingDialog assignment={gradingFor} onClose={() => setGradingFor(null)} />}
      {detailFor && (
        <StudentAssignmentDialog assignment={detailFor} onClose={() => setDetailFor(null)} />
      )}
      {submittingFor && (
        <SubmitDialog assignment={submittingFor} onClose={() => setSubmittingFor(null)} />
      )}
    </>
  );
}

/**
 * Marking as a sheet rather than thirty dialogs.
 *
 * A row exists for every pupil the work was set for, not only those who handed
 * something in: "لم يُسلّم" is the most important state here and it has no
 * record of its own to be listed from. Beside the mark it shows what a teacher
 * actually wants to know — did they open it, was it late, did a guardian see
 * it — and a note that goes back to the pupil.
 */
function GradingDialog({ assignment, onClose }: { assignment: string; onClose: () => void }) {
  const [group, setGroup] = useState("");
  const sheet = useGradingSheet(assignment, group || undefined);
  const saveGrades = useSaveGrades();
  const publishSolution = usePublishSolution();
  const questions = useAssignmentQuestions(assignment);
  const [tab, setTab] = useState<"marks" | "questions">("marks");
  const [draft, setDraft] = useState<Record<string, { score?: string; teacher_note?: string }>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const info = sheet.data?.assignment;
  const rows = sheet.data?.students ?? [];
  const summary = sheet.data?.summary;
  const dirty = Object.keys(draft).length > 0;

  function edit(student: string, patch: { score?: string; teacher_note?: string }) {
    setDraft((d) => ({ ...d, [student]: { ...(d[student] ?? {}), ...patch } }));
  }

  async function save() {
    const payload: Record<string, { score?: number; teacher_note?: string }> = {};
    for (const [student, row] of Object.entries(draft)) {
      const entry: { score?: number; teacher_note?: string } = {};
      if (row.score !== undefined && row.score !== "") entry.score = Number(row.score);
      if (row.teacher_note !== undefined) entry.teacher_note = row.teacher_note;
      if (Object.keys(entry).length) payload[student] = entry;
    }
    if (Object.keys(payload).length === 0) {
      toast.error("لا توجد تغييرات لحفظها");
      return;
    }
    try {
      const res = await saveGrades.mutateAsync({ assignment, rows: payload });
      toast.success(`تم حفظ ${res.saved} صفاً`);
      setDraft({});
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  async function toggleSolution() {
    try {
      const res = await publishSolution.mutateAsync({
        assignment,
        published: info?.["solution_published"] ? 0 : 1,
      });
      toast.success(res.published ? "أصبح الحل ظاهراً للطلاب" : "تم إخفاء الحل");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التحديث"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">تصحيح: {info?.title ?? "الواجب"}</DialogTitle>
        </DialogHeader>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
            {[
              { key: "marks" as const, label: "العلامات" },
              {
                key: "questions" as const,
                label: `الاستفسارات${questions.data?.unanswered ? ` (${questions.data.unanswered})` : ""}`,
              },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.key ? "bg-card shadow-soft" : "text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {(sheet.data?.groups.length ?? 0) > 1 && (
            <Select value={group || "all"} onValueChange={(v) => setGroup(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44 rounded-xl">
                <SelectValue placeholder="كل الشُعب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الشُعب</SelectItem>
                {sheet.data!.groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <button
            onClick={() => void toggleSolution()}
            className="mr-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
          >
            {info?.["solution_published"] ? "إخفاء حلول الواجب" : "إظهار حلول الواجب"}
          </button>
        </div>

        {tab === "marks" ? (
          <>
            {summary && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Pill>
                  الطلاب <span className="num">{summary.total}</span>
                </Pill>
                <Pill tone="success">
                  سلّم <span className="num">{summary.submitted}</span>
                </Pill>
                <Pill tone="danger">
                  لم يسلّم <span className="num">{summary.missing}</span>
                </Pill>
                <Pill tone="info">
                  اطّلع <span className="num">{summary.seen}</span>
                </Pill>
                <Pill tone="warning">
                  متأخر <span className="num">{summary.late}</span>
                </Pill>
                <Pill tone="primary">
                  مُصحّح <span className="num">{summary.graded}</span>
                </Pill>
              </div>
            )}

            {sheet.isLoading ? (
              <TableSkeleton rows={6} />
            ) : rows.length === 0 ? (
              <EmptyBlock title="لا يوجد طلاب" icon={<NotebookPen className="size-6" />} />
            ) : (
              <div className="max-h-[52vh] overflow-auto rounded-xl border border-border">
                <table className="w-full min-w-max text-xs">
                  <thead className="sticky top-0 z-10 bg-secondary/80 backdrop-blur">
                    <tr>
                      <th className="px-2 py-2 text-start font-bold">الطالب</th>
                      <th className="px-2 py-2 font-bold">الحالة</th>
                      <th className="px-2 py-2 font-bold">تاريخ التسليم</th>
                      <th className="px-2 py-2 font-bold">اطّلاع الطالب</th>
                      <th className="px-2 py-2 font-bold">اطّلاع ولي الأمر</th>
                      <th className="px-2 py-2 font-bold">
                        العلامة <span className="num">/{info?.maximum_score ?? 100}</span>
                      </th>
                      <th className="px-2 py-2 text-start font-bold">ملاحظة للطالب</th>
                      <th className="px-2 py-2 font-bold">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <>
                        <tr
                          key={r.student}
                          className="border-t border-border hover:bg-secondary/30"
                        >
                          <td className="px-2 py-1.5">
                            <span className="block font-semibold">{r.name}</span>
                            {(sheet.data?.groups.length ?? 0) > 1 && (
                              <span className="block text-[10px] text-muted-foreground">
                                {r.group_name}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <Pill
                              tone={
                                r.status.includes("مُصحّح")
                                  ? "primary"
                                  : r.status.includes("متأخر")
                                    ? "warning"
                                    : r.status.includes("سُلّم")
                                      ? "success"
                                      : r.status.includes("اطّلع")
                                        ? "info"
                                        : "danger"
                              }
                            >
                              {r.status}
                            </Pill>
                          </td>
                          <td className="num px-2 py-1.5 text-center text-muted-foreground">
                            {r.submitted_on ? r.submitted_on.slice(0, 16) : "—"}
                          </td>
                          <td className="num px-2 py-1.5 text-center text-muted-foreground">
                            {r.viewed_on ? r.viewed_on.slice(0, 16) : "—"}
                          </td>
                          <td className="num px-2 py-1.5 text-center text-muted-foreground">
                            {r.guardian_viewed_on ? r.guardian_viewed_on.slice(0, 16) : "—"}
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              type="number"
                              min={0}
                              max={r.max_score}
                              value={draft[r.student]?.score ?? r.score ?? ""}
                              onChange={(e) => edit(r.student, { score: e.target.value })}
                              className="num h-8 w-20 text-center"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              value={draft[r.student]?.teacher_note ?? r.teacher_note ?? ""}
                              onChange={(e) => edit(r.student, { teacher_note: e.target.value })}
                              placeholder="ملاحظة يراها الطالب"
                              className="h-8 min-w-44"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {(r.content || r.files.length > 0) && (
                              <button
                                onClick={() =>
                                  setExpanded(expanded === r.student ? null : r.student)
                                }
                                className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                              >
                                {expanded === r.student ? "إخفاء" : `عرض (${r.files.length})`}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expanded === r.student && (
                          <tr key={`${r.student}-detail`} className="bg-secondary/30">
                            <td colSpan={8} className="px-3 py-2">
                              {r.content && <RichTextView html={r.content} />}
                              {r.files.length > 0 && <FileList files={r.files} />}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <QuestionsPanel assignment={assignment} />
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          {tab === "marks" && (
            <button
              onClick={() => void save()}
              disabled={!dirty || saveGrades.isPending}
              className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {saveGrades.isPending ? "جارٍ الحفظ…" : "حفظ العلامات"}
            </button>
          )}
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

/** Questions pupils asked, and the teacher's answers. */
function QuestionsPanel({ assignment }: { assignment: string }) {
  const { data, isLoading } = useAssignmentQuestions(assignment);
  const answer = useAnswerAssignmentQuestion();
  const [replying, setReplying] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  async function send(question: string) {
    if (!text.trim()) {
      toast.error("اكتب نص الرد");
      return;
    }
    try {
      await answer.mutateAsync({ question, answer: text.trim(), is_public: isPublic ? 1 : 0 });
      toast.success("تم إرسال الرد");
      setReplying(null);
      setText("");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الإرسال"));
    }
  }

  if (isLoading) return <TableSkeleton rows={3} />;
  if ((data?.questions.length ?? 0) === 0) {
    return (
      <EmptyBlock
        title="لا توجد استفسارات"
        description="عندما يسأل طالب عن هذا الواجب سيظهر سؤاله هنا."
        icon={<BookOpen className="size-6" />}
      />
    );
  }

  return (
    <ul className="max-h-[52vh] space-y-2 overflow-y-auto">
      {data!.questions.map((q) => (
        <li key={q.id} className="rounded-xl border border-border p-3">
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold">{q.student_name ?? "طالب"}</span>
            <span className="num text-muted-foreground">{q.asked_on.slice(0, 16)}</span>
            {q.is_public && <Pill tone="info">ظاهر للجميع</Pill>}
            {!q.answered && <Pill tone="warning">بانتظار الرد</Pill>}
          </p>
          <p className="mt-1 text-sm">{q.body}</p>

          {q.answer ? (
            <div className="mt-2 rounded-lg bg-primary-soft p-2.5">
              <p className="text-[11px] font-bold text-primary">ردّك</p>
              <p className="text-sm">{q.answer}</p>
            </div>
          ) : replying === q.id ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border bg-card p-2 text-sm"
                placeholder="اكتب ردك…"
                autoFocus
              />
              <label className="flex items-center gap-2 text-[11px]">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                إظهار السؤال والرد لبقية الطلاب
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => void send(q.id)}
                  disabled={answer.isPending}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  إرسال
                </button>
                <button
                  onClick={() => setReplying(null)}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
                >
                  تراجع
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setReplying(q.id);
                setText("");
              }}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              الرد على الاستفسار
            </button>
          )}
        </li>
      ))}
    </ul>
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
      toast.success(result.status === "Late" ? "تم التسليم متأخرًا" : "تم تسليم الواجب بنجاح");
      onClose();
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر تسليم الواجب";
      toast.error(message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {info ? `تسليم: ${info.title}` : "تسليم الواجب"}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        )}
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
                  <FileUpload files={files} onChange={setFiles} disabled={submit.isPending} />
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
  // Opened from a class: the form starts on it instead of empty.
  const { group: preselectedGroup } = Route.useSearch();
  const save = useSaveAssignment();
  const classesQuery = useClasses();
  const subjectsQuery = useSubjects();
  const input = useRef<HTMLInputElement>(null);
  const solutionInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [tab, setTab] = useState<"basics" | "detail" | "publish" | "solution">("basics");

  const [form, setForm] = useState({
    title: "",
    course: "",
    due_date: "",
    maximum_score: "100",
    description: "",
    objectives: "",
    requirements: "",
    submission_type: "رفع ملف",
    allow_late: true,
    allow_questions: true,
    notify_guardians: true,
    solution_body: "",
    solution_published: false,
  });
  // Several sections at once: the same worksheet usually goes to every class
  // a teacher takes, and setting it five times is five chances to differ.
  const [groups, setGroups] = useState<string[]>(preselectedGroup ? [preselectedGroup] : []);
  const [links, setLinks] = useState<Array<{ title: string; url: string; kind: string }>>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [solutionFiles, setSolutionFiles] = useState<UploadedFile[]>([]);
  const [mode, setMode] = useState<"now" | "draft" | "schedule">("now");
  const [publishAt, setPublishAt] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function pick(list: FileList | null, into: "files" | "solution") {
    if (!list?.length) return;
    setUploading(list.length);
    const added: UploadedFile[] = [];
    for (const file of Array.from(list)) {
      try {
        const res = await apiUpload<UploadedFile>("assignments.upload_file", file);
        added.push(res);
      } catch (err) {
        toast.error(`${file.name}: ${errorMessage(err, "تعذّر الرفع")}`);
      }
    }
    setUploading(0);
    if (added.length) {
      if (into === "files") setFiles((f) => [...f, ...added]);
      else setSolutionFiles((f) => [...f, ...added]);
    }
    if (input.current) input.current.value = "";
    if (solutionInput.current) solutionInput.current.value = "";
  }

  async function submit() {
    if (!form.title.trim() || !form.course || groups.length === 0 || !form.due_date) {
      toast.error("العنوان والمادة والشعبة وتاريخ الاستحقاق مطلوبة");
      setTab("basics");
      return;
    }
    if (mode === "schedule" && !publishAt) {
      toast.error("حدّد موعد النشر");
      setTab("publish");
      return;
    }
    try {
      await save.mutateAsync({
        ...form,
        maximum_score: Number(form.maximum_score) || 100,
        student_group: groups[0]!,
        student_groups: groups,
        links: links.filter((l) => l.url.trim()),
        files,
        solution_files: solutionFiles,
        allow_late: form.allow_late ? 1 : 0,
        allow_questions: form.allow_questions ? 1 : 0,
        notify_guardians: form.notify_guardians ? 1 : 0,
        solution_published: form.solution_published ? 1 : 0,
        is_draft: mode === "draft" ? 1 : 0,
        ...(mode === "schedule" ? { publish_at: `${publishAt.replace("T", " ")}:00` } : {}),
      });
      toast.success(
        mode === "draft"
          ? "تم حفظ المسودة"
          : mode === "schedule"
            ? "تمت جدولة نشر الواجب"
            : "تم إنشاء الواجب",
      );
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  const tabs = [
    { key: "basics" as const, label: "الأساسيات" },
    { key: "detail" as const, label: "التفاصيل والمرفقات" },
    { key: "publish" as const, label: "النشر" },
    { key: "solution" as const, label: "حلول الواجب" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">واجب جديد</DialogTitle>
        </DialogHeader>

        <div className="mb-3 flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.key ? "bg-card shadow-soft" : "text-muted-foreground hover:bg-card/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[58vh] space-y-4 overflow-y-auto p-1">
          {tab === "basics" && (
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
                <Label>تاريخ الاستحقاق *</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => set("due_date", e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>الشُعب المستهدفة *</Label>
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-border p-2">
                  {(classesQuery.data ?? []).map((c) => {
                    const on = groups.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        onClick={() =>
                          setGroups(on ? groups.filter((g) => g !== c.name) : [...groups, c.name])
                        }
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                          on
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary hover:bg-primary-soft hover:text-primary"
                        }`}
                      >
                        {c.student_group_name}
                      </button>
                    );
                  })}
                </div>
                {groups.length > 1 && (
                  <p className="text-[11px] text-muted-foreground">
                    سيصل الواجب إلى <span className="num">{groups.length}</span> شُعب.
                  </p>
                )}
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
              <div className="space-y-1.5">
                <Label>طريقة التسليم</Label>
                <Select
                  value={form.submission_type}
                  onValueChange={(v) => set("submission_type", v)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["رفع ملف", "نص مكتوب", "في الصف", "بدون تسليم"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {tab === "detail" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>وصف الواجب</Label>
                <RichText
                  value={form.description}
                  onChange={(v) => set("description", v)}
                  placeholder="ما المطلوب من الطالب…"
                  minHeight={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label>الأهداف</Label>
                <RichText
                  value={form.objectives}
                  onChange={(v) => set("objectives", v)}
                  placeholder="ماذا يتعلّم الطالب من هذا الواجب…"
                  minHeight={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label>المتطلبات</Label>
                <RichText
                  value={form.requirements}
                  onChange={(v) => set("requirements", v)}
                  placeholder="الأدوات، المراجع، شروط التسليم…"
                  minHeight={80}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label>أوراق العمل والمرفقات ({files.length})</Label>
                  <button
                    onClick={() => input.current?.click()}
                    disabled={uploading > 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary disabled:opacity-50"
                  >
                    <Upload className="size-3.5" />
                    إرفاق
                  </button>
                  <input
                    ref={input}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => void pick(e.target.files, "files")}
                  />
                </div>
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li
                        key={f.file_url}
                        className="flex items-center gap-2 rounded-lg border border-border p-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs">{f.file_name}</span>
                        <button
                          onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          className="rounded p-0.5 text-destructive hover:bg-destructive-soft"
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">روابط (فيديو شرح، مرجع، ورقة عمل)</Label>
                <ul className="space-y-1.5">
                  {links.map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <Input
                        value={l.title}
                        onChange={(e) =>
                          setLinks(
                            links.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                          )
                        }
                        placeholder="العنوان"
                        className="w-40 shrink-0 rounded-xl"
                      />
                      <Input
                        value={l.url}
                        onChange={(e) =>
                          setLinks(
                            links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                          )
                        }
                        placeholder="https://…"
                        className="flex-1 rounded-xl"
                        dir="ltr"
                      />
                      <button
                        onClick={() => setLinks(links.filter((_, j) => j !== i))}
                        className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive-soft"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setLinks([...links, { title: "", url: "", kind: "رابط" }])}
                  className="mt-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  + رابط
                </button>
              </div>
            </div>
          )}

          {tab === "publish" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>متى يظهر الواجب؟</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { key: "now" as const, label: "نشر فوري", hint: "يصل الآن للطلاب" },
                    { key: "draft" as const, label: "حفظ كمسودة", hint: "لا يراه أحد غيرك" },
                    { key: "schedule" as const, label: "جدولة", hint: "يظهر في وقت تحدده" },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMode(m.key)}
                      className={`rounded-xl border p-3 text-start transition-colors ${
                        mode === m.key
                          ? "border-primary bg-primary-soft"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      <span className="block text-xs font-bold">{m.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {mode === "schedule" && (
                <div className="space-y-1.5">
                  <Label>موعد النشر</Label>
                  <Input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              )}

              <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
                <Switch
                  checked={form.notify_guardians}
                  onCheckedChange={(v) => set("notify_guardians", v)}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">إشعار أولياء الأمور</span>
                  <span className="block text-[11px] text-muted-foreground">
                    يصل الواجب إلى الطالب وإلى ولي أمره معاً.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
                <Switch checked={form.allow_late} onCheckedChange={(v) => set("allow_late", v)} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">قبول التسليم المتأخر</span>
                  <span className="block text-[11px] text-muted-foreground">
                    يُعلَّم التسليم بعد تاريخ الاستحقاق كمتأخر بدل رفضه.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
                <Switch
                  checked={form.allow_questions}
                  onCheckedChange={(v) => set("allow_questions", v)}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">السماح باستفسارات الطلاب</span>
                  <span className="block text-[11px] text-muted-foreground">
                    يسأل الطالب على الواجب نفسه، ويصلك السؤال لترد عليه.
                  </span>
                </span>
              </label>
            </div>
          )}

          {tab === "solution" && (
            <div className="space-y-3">
              <p className="rounded-xl bg-secondary/60 p-2.5 text-[11px] text-muted-foreground">
                يمكنك كتابة الحل النموذجي الآن وإبقاؤه مخفياً، ثم إظهاره بعد انتهاء موعد التسليم.
              </p>
              <div className="space-y-1.5">
                <Label>الحل النموذجي</Label>
                <RichText
                  value={form.solution_body}
                  onChange={(v) => set("solution_body", v)}
                  placeholder="خطوات الحل…"
                  minHeight={120}
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label>ملفات الحل ({solutionFiles.length})</Label>
                  <button
                    onClick={() => solutionInput.current?.click()}
                    disabled={uploading > 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary disabled:opacity-50"
                  >
                    <Upload className="size-3.5" />
                    إرفاق
                  </button>
                  <input
                    ref={solutionInput}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => void pick(e.target.files, "solution")}
                  />
                </div>
                {solutionFiles.length > 0 && (
                  <ul className="space-y-1">
                    {solutionFiles.map((f, i) => (
                      <li
                        key={f.file_url}
                        className="flex items-center gap-2 rounded-lg border border-border p-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs">{f.file_name}</span>
                        <button
                          onClick={() => setSolutionFiles(solutionFiles.filter((_, j) => j !== i))}
                          className="rounded p-0.5 text-destructive hover:bg-destructive-soft"
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
                <Switch
                  checked={form.solution_published}
                  onCheckedChange={(v) => set("solution_published", v)}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">
                    إظهار الحل للطلاب وأولياء الأمور
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    اتركه مغلقاً حتى ينتهي موعد التسليم.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending || uploading > 0}
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

/**
 * What a family sees on one piece of homework: the questions, and the answers
 * once the teacher lets them out.
 *
 * Opening this also records that the pupil (or their guardian) has seen the
 * work, which is what lets a teacher tell "has not seen it" from "seen it and
 * not done it" — two very different conversations.
 */
function StudentAssignmentDialog({
  assignment,
  onClose,
}: {
  assignment: string;
  onClose: () => void;
}) {
  const { role } = useApp();
  const questions = useAssignmentQuestions(assignment);
  const solution = useAssignmentSolution(assignment);
  const ask = useAskAssignmentQuestion();
  const recordView = useRecordAssignmentView();
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"questions" | "solution">("questions");

  useEffect(() => {
    // Only the first view is kept; the server ignores the rest.
    recordView.mutate({ assignment });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment]);

  async function send() {
    if (!body.trim()) {
      toast.error("اكتب استفسارك");
      return;
    }
    try {
      await ask.mutateAsync({ assignment, body: body.trim() });
      toast.success("تم إرسال الاستفسار إلى المعلم");
      setBody("");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الإرسال"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">الواجب</DialogTitle>
        </DialogHeader>

        <div className="mb-3 flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {[
            { key: "questions" as const, label: "الاستفسارات" },
            { key: "solution" as const, label: "حلول الواجب" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[56vh] space-y-3 overflow-y-auto p-1">
          {tab === "questions" ? (
            <>
              {role === "student" && (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <Label className="text-xs">اسأل معلّمك عن هذا الواجب</Label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-border bg-card p-2 text-sm"
                    placeholder="مثال: هل نحلّ التمرين الخامس أيضاً؟"
                  />
                  <button
                    onClick={() => void send()}
                    disabled={ask.isPending}
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    إرسال الاستفسار
                  </button>
                </div>
              )}

              {questions.isLoading ? (
                <TableSkeleton rows={2} />
              ) : (questions.data?.questions.length ?? 0) === 0 ? (
                <EmptyBlock
                  title="لا توجد استفسارات"
                  description="اسأل معلّمك إن كان شيء غير واضح."
                  icon={<BookOpen className="size-6" />}
                />
              ) : (
                <ul className="space-y-2">
                  {questions.data!.questions.map((q) => (
                    <li key={q.id} className="rounded-xl border border-border p-3">
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {q.mine ? "سؤالك" : (q.student_name ?? "سؤال زميل")}
                        </span>
                        <span className="num">{q.asked_on.slice(0, 16)}</span>
                        {!q.answered && <Pill tone="warning">بانتظار رد المعلم</Pill>}
                      </p>
                      <p className="mt-1 text-sm">{q.body}</p>
                      {q.answer && (
                        <div className="mt-2 rounded-lg bg-primary-soft p-2.5">
                          <p className="text-[11px] font-bold text-primary">رد المعلم</p>
                          <p className="text-sm">{q.answer}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : solution.isLoading ? (
            <TableSkeleton rows={2} />
          ) : !solution.data?.published ? (
            <EmptyBlock
              title="لم يُنشر الحل بعد"
              description="يظهر الحل النموذجي هنا بعد أن يتيحه المعلم."
              icon={<Award className="size-6" />}
            />
          ) : (
            <div className="space-y-3">
              {solution.data.body && <RichTextView html={solution.data.body} />}
              {solution.data.files.length > 0 && <FileList files={solution.data.files} />}
            </div>
          )}
        </div>

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

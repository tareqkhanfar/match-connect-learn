import { createFileRoute } from "@tanstack/react-router";
import { NotebookPen, Plus, Send } from "lucide-react";
import { useState } from "react";
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
import { useApp } from "@/lib/app-context";
import {
  useAssignments,
  useGradeSubmission,
  useSubmissions,
  useSubmitAssignment,
} from "@/lib/api/hooks";

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
  const isStaff = role === "admin" || role === "teacher";
  const isStudent = role === "student";

  const { data, isLoading, error, refetch } = useAssignments();
  const assignments = data ?? [];

  const [gradingFor, setGradingFor] = useState<string | null>(null);
  const [submittingFor, setSubmittingFor] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="الواجبات"
        subtitle={`${assignments.length} واجباً`}
        actions={
          isStaff ? (
            <button
              onClick={() => toast.info("إنشاء واجب من الواجهة غير مفعّل بعد")}
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

  async function saveScore(student: string) {
    const raw = scores[student];
    if (raw === undefined || raw === "") return;
    try {
      await gradeSubmission.mutateAsync({ assignment, student, score: Number(raw) });
      toast.success("تم حفظ الدرجة");
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر حفظ الدرجة";
      toast.error(message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
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
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {data!.rows.map((r) => (
              <div
                key={r.student}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.student_name}</p>
                  <p className="text-xs text-muted-foreground">{r.status}</p>
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
            ))}
          </div>
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
  const [content, setContent] = useState("");

  async function send() {
    try {
      await submit.mutateAsync({ assignment, content });
      toast.success("تم تسليم الواجب");
      onClose();
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر تسليم الواجب";
      toast.error(message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">تسليم الواجب</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>إجابتك</Label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-border bg-card p-3 text-sm"
            placeholder="اكتب إجابتك هنا…"
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={send}
            disabled={submit.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {submit.isPending ? "جارٍ التسليم…" : "تسليم"}
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

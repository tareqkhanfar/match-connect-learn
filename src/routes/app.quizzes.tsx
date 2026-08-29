import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  FileQuestion,
  Play,
  Plus,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { RichText, RichTextView } from "@/components/shared/rich-text";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { byRole, isBackOffice } from "@/lib/roles";
import {
  useClasses,
  useDeleteQuiz,
  useQuizResults,
  useQuizzes,
  useReviewAttempt,
  useSaveQuiz,
  useStartAttempt,
  useSubjects,
  useSubmitAttempt,
  type QuizPaper,
  type QuizRow,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/quizzes")({
  head: () => ({
    meta: [
      { title: "الاختبارات الإلكترونية — Match Education" },
      {
        name: "description",
        content: "اختبارات قصيرة تُصحَّح تلقائياً مع نتائج فورية وتحليل لأداء الصف.",
      },
    ],
  }),
  component: QuizzesPage,
});

function QuizzesPage() {
  const { role } = useApp();
  const staff = isBackOffice(role) || role === "teacher";
  return staff ? <StaffQuizView /> : <StudentQuizView />;
}

/* -------------------------------------------------------------------- staff */

function StaffQuizView() {
  const viewed = useViewedStudent();
  const query = useQuizzes({ page_size: 50, ...(viewed ? { student: viewed } : {}) });
  const remove = useDeleteQuiz();
  const confirm = useConfirm();

  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<string | null>(null);

  const items = query.data?.items ?? [];
  const published = items.filter((q) => q.status === "Published");
  const totalSubmissions = items.reduce((a, q) => a + q.submissions, 0);

  async function removeQuiz(quiz: QuizRow) {
    const ok = await confirm({
      title: `حذف «${quiz.title}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(quiz.id);
      toast.success("تم حذف الاختبار");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title="الاختبارات الإلكترونية"
        subtitle="اختبارات قصيرة تُصحَّح تلقائياً — أنشئها وتابع نتائج صفك"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-4" />
            اختبار جديد
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="إجمالي الاختبارات"
          value={items.length}
          icon={FileQuestion}
          tone="primary"
        />
        <KpiCard label="منشورة الآن" value={published.length} icon={Play} tone="accent" />
        <KpiCard label="محاولات الطلاب" value={totalSubmissions} icon={CheckCircle2} tone="info" />
        <KpiCard label="بانتظار تصحيح يدوي" value={0} icon={Clock} tone="warm" />
      </div>

      <div className="mt-5">
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          <TableSkeleton rows={5} />
        ) : items.length === 0 ? (
          <EmptyBlock
            title="لا توجد اختبارات"
            description="أنشئ اختباراً قصيراً وسيُصحَّح تلقائياً فور تسليم الطلاب."
            icon={<FileQuestion className="size-6" />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((q) => (
              <div key={q.id} className="card-surface flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{q.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.course} • {q.student_group}
                    </p>
                  </div>
                  <Pill
                    tone={
                      q.status === "Published"
                        ? "success"
                        : q.status === "Closed"
                          ? "muted"
                          : "info"
                    }
                  >
                    {q.status_label}
                  </Pill>
                </div>

                <div className="num mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{q.questions} سؤال</span>
                  <span>{q.total_marks} درجة</span>
                  <span>{q.time_limit} دقيقة</span>
                  <span>{q.attempts_allowed} محاولة</span>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>سلّموا</span>
                    <span className="num">{q.submissions}</span>
                  </div>
                  <ProgressBar value={q.submissions ? 100 : 0} tone="success" />
                </div>

                <div className="mt-auto flex items-center gap-2 pt-4">
                  <button
                    onClick={() => setResults(q.id)}
                    className="flex-1 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                  >
                    النتائج والتحليل
                  </button>
                  <button
                    onClick={() => removeQuiz(q)}
                    aria-label="حذف"
                    className="rounded-lg bg-secondary px-2.5 py-2 text-destructive hover:bg-destructive-soft"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && <QuizBuilderDialog onClose={() => setCreating(false)} />}
      {results && <QuizResultsDialog quiz={results} onClose={() => setResults(null)} />}
    </>
  );
}

/* ------------------------------------------------------------------ student */

function StudentQuizView() {
  const { role } = useApp();
  const query = useQuizzes({ page_size: 50 });
  const [sitting, setSitting] = useState<QuizPaper | null>(null);

  const items = query.data?.items ?? [];
  const available = items.filter((q) => q.open && q.attempts_left > 0);
  const done = items.filter((q) => q.my_attempts.length > 0);
  const best = done.length
    ? Math.round(
        done.reduce((a, q) => a + (q.best ?? 0), 0) / done.filter((q) => q.best !== null).length,
      )
    : null;

  return (
    <>
      <PageHeader
        title={byRole(role, "الاختبارات الإلكترونية", { parent: "اختبارات الأبناء" })}
        subtitle={byRole(role, "اختباراتك القصيرة ونتائجها الفورية", {
          parent: "اختبارات أبنائك ونتائجهم",
        })}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="متاح الآن" value={available.length} icon={Play} tone="accent" />
        <KpiCard label="اختبارات أنهيتها" value={done.length} icon={CheckCircle2} tone="primary" />
        <KpiCard
          label="متوسط نتائجك"
          value={best !== null ? `${best}%` : "—"}
          icon={Trophy}
          tone="info"
        />
        <KpiCard label="إجمالي الاختبارات" value={items.length} icon={FileQuestion} tone="warm" />
      </div>

      <div className="mt-5">
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          <TableSkeleton rows={4} />
        ) : items.length === 0 ? (
          <EmptyBlock
            title="لا توجد اختبارات"
            description="ستظهر هنا الاختبارات فور نشرها من معلمك."
            icon={<FileQuestion className="size-6" />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((q) => (
              <StudentQuizCard key={q.id} quiz={q} onStart={setSitting} />
            ))}
          </div>
        )}
      </div>

      {sitting && <SitQuizDialog paper={sitting} onClose={() => setSitting(null)} />}
    </>
  );
}

function StudentQuizCard({
  quiz: q,
  onStart,
}: {
  quiz: QuizRow;
  onStart: (paper: QuizPaper) => void;
}) {
  const { role } = useApp();
  const start = useStartAttempt();

  async function begin() {
    try {
      const paper = await start.mutateAsync(q.id);
      onStart(paper);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر بدء الاختبار");
    }
  }

  const last = q.my_attempts[q.my_attempts.length - 1];

  return (
    <div className="card-surface flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{q.title}</p>
          <p className="truncate text-xs text-muted-foreground">{q.course}</p>
        </div>
        <Pill tone={q.open ? "success" : "muted"}>{q.open ? "متاح" : q.status_label}</Pill>
      </div>

      <div className="num mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>{q.questions} سؤال</span>
        <span>{q.total_marks} درجة</span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {q.time_limit} دقيقة
        </span>
        {q.closes_on && <span>يغلق {q.closes_on.slice(0, 10)}</span>}
      </div>

      {/* Best attempt so far. */}
      {q.best !== null && (
        <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">أفضل نتيجة</span>
            <span className="num font-bold">{q.best}%</span>
          </div>
          <ProgressBar value={q.best} tone={q.best >= q.pass_mark ? "success" : "danger"} />
          {last && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {last.status_label} • المحاولة {last.attempt} من {q.attempts_allowed}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto pt-4">
        {role === "parent" ? (
          <p className="rounded-lg bg-secondary px-3 py-2 text-center text-xs text-muted-foreground">
            الاختبارات يحلّها الطالب من حسابه
          </p>
        ) : (
          <button
            onClick={begin}
            disabled={!q.open || q.attempts_left === 0 || start.isPending}
            className="w-full rounded-lg bg-brand-gradient px-3 py-2.5 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!q.open
              ? "الاختبار مغلق"
              : q.attempts_left === 0
                ? "استنفدت المحاولات"
                : start.isPending
                  ? "جارٍ الفتح…"
                  : q.my_attempts.length
                    ? `محاولة جديدة (${q.attempts_left} متبقية)`
                    : "ابدأ الاختبار"}
          </button>
        )}
      </div>
    </div>
  );
}

/** The exam room: one question at a time, with a countdown. */
function SitQuizDialog({ paper, onClose }: { paper: QuizPaper; onClose: () => void }) {
  const submit = useSubmitAttempt();
  const confirm = useConfirm();

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(paper.time_limit * 60);
  const [result, setResult] = useState<Awaited<ReturnType<typeof submit.mutateAsync>> | null>(null);

  // Count down, and hand the paper in automatically when time runs out.
  useEffect(() => {
    if (result) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          void send(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const answered = Object.keys(answers).length;
  const question = paper.questions[current];

  async function send(auto = false) {
    if (!auto) {
      const ok = await confirm({
        title: "تسليم الاختبار؟",
        description:
          answered < paper.questions.length
            ? `لم تجب عن ${paper.questions.length - answered} سؤال. لا يمكن التعديل بعد التسليم.`
            : "لا يمكن التعديل بعد التسليم.",
        tone: answered < paper.questions.length ? "warning" : "question",
        confirmLabel: "تسليم",
      });
      if (!ok) return;
    }
    try {
      const res = await submit.mutateAsync({
        attempt: paper.attempt,
        answers: paper.questions.map((q) => ({
          idx: q.idx,
          answer: answers[q.idx] ?? "",
        })),
      });
      setResult(res);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التسليم");
    }
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const urgent = remaining <= 60;

  return (
    <Dialog open onOpenChange={(o) => !o && result && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{paper.title}</DialogTitle>
        </DialogHeader>

        {result ? (
          <ResultView result={result} onClose={onClose} />
        ) : (
          <>
            {/* Progress and the clock. */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <span
                className={`num rounded-lg px-3 py-1.5 text-sm font-bold ${
                  urgent ? "bg-destructive text-white" : "bg-card"
                }`}
              >
                {minutes}:{String(seconds).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    السؤال {current + 1} من {paper.questions.length}
                  </span>
                  <span className="num">أجبت عن {answered}</span>
                </div>
                <ProgressBar value={(answered / paper.questions.length) * 100} tone="primary" />
              </div>
            </div>

            {paper.instructions && current === 0 && (
              <div className="rounded-xl border border-info/30 bg-info-soft p-3 text-xs">
                <RichTextView html={paper.instructions} />
              </div>
            )}

            {question && (
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold leading-relaxed">{question.question_text}</p>
                  <Pill tone="muted">{question.marks} درجة</Pill>
                </div>

                <div className="mt-4 space-y-2">
                  {question.options.length > 0 ? (
                    question.options.map((o) => (
                      <label
                        key={o.key}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                          answers[question.idx] === o.key
                            ? "border-primary bg-primary-soft"
                            : "border-border hover:bg-secondary/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${question.idx}`}
                          checked={answers[question.idx] === o.key}
                          onChange={() => setAnswers((a) => ({ ...a, [question.idx]: o.key }))}
                          className="size-4 accent-primary"
                        />
                        <span className="num shrink-0 font-bold text-muted-foreground">
                          {o.key}
                        </span>
                        <span className="text-sm">{o.text}</span>
                      </label>
                    ))
                  ) : (
                    <Input
                      value={answers[question.idx] ?? ""}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [question.idx]: e.target.value }))
                      }
                      placeholder="اكتب إجابتك…"
                      className="rounded-xl"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Question navigator, so a student can jump back. */}
            <div className="flex flex-wrap gap-1.5">
              {paper.questions.map((q, i) => (
                <button
                  key={q.idx}
                  onClick={() => setCurrent(i)}
                  className={`num size-8 rounded-lg text-xs font-bold transition-colors ${
                    i === current
                      ? "bg-brand-gradient text-primary-foreground"
                      : answers[q.idx]
                        ? "bg-success-soft text-success"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </>
        )}

        {!result && (
          <DialogFooter className="gap-2 sm:justify-start">
            <button
              onClick={() => send()}
              disabled={submit.isPending}
              className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {submit.isPending ? "جارٍ التسليم…" : "تسليم الاختبار"}
            </button>
            <button
              onClick={() => setCurrent((c) => Math.min(c + 1, paper.questions.length - 1))}
              disabled={current >= paper.questions.length - 1}
              className="h-11 rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-40"
            >
              السؤال التالي
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultView({
  result,
  onClose,
}: {
  result: {
    score: number;
    total: number;
    percentage: number;
    passed: boolean;
    needs_review: boolean;
    correct: number;
    questions: number;
    answers_revealed: boolean;
    answers: Array<{
      idx: number;
      question: string;
      given: string;
      correct_answer: string;
      is_correct: boolean;
      marks: number;
      possible: number;
    }>;
  };
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={`rounded-2xl p-6 text-center ${
          result.passed ? "bg-success-soft" : "bg-destructive-soft"
        }`}
      >
        <p className="num text-4xl font-black">{result.percentage}%</p>
        <p className="num mt-1 text-sm font-semibold">
          {result.score} من {result.total} درجة
        </p>
        <p className="mt-2 text-sm">
          {result.passed ? "🎉 مبروك، لقد نجحت!" : "لم تحقق درجة النجاح هذه المرة"}
        </p>
        <p className="num mt-1 text-xs text-muted-foreground">
          إجابات صحيحة {result.correct} من {result.questions}
        </p>
      </div>

      {result.needs_review && (
        <p className="rounded-xl bg-warm-soft px-3 py-2 text-center text-xs text-warm-foreground">
          بعض إجاباتك تحتاج مراجعة المعلم — قد ترتفع درجتك بعد التصحيح.
        </p>
      )}

      {result.answers_revealed && result.answers.length > 0 && (
        <ul className="space-y-2">
          {result.answers.map((a) => (
            <li
              key={a.idx}
              className={`rounded-xl border p-3 ${
                a.is_correct
                  ? "border-success/40 bg-success-soft/30"
                  : "border-destructive/40 bg-destructive-soft/30"
              }`}
            >
              <div className="flex items-start gap-2">
                {a.is_correct ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.question}</p>
                  <p className="num mt-1 text-xs text-muted-foreground">
                    إجابتك: {a.given || "—"}
                    {!a.is_correct && ` • الصحيحة: ${a.correct_answer}`}
                  </p>
                </div>
                <span className="num shrink-0 text-xs font-bold">
                  {a.marks}/{a.possible}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DialogFooter className="sm:justify-start">
        <button
          onClick={onClose}
          className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground"
        >
          إغلاق
        </button>
      </DialogFooter>
    </>
  );
}

/* ------------------------------------------------------------------ builder */

interface DraftQuestion {
  question_text: string;
  question_type: string;
  marks: number;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
}

const BLANK: DraftQuestion = {
  question_text: "",
  question_type: "Multiple Choice",
  marks: 1,
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: "A",
};

function QuizBuilderDialog({ onClose }: { onClose: () => void }) {
  const classes = useClasses({});
  const subjects = useSubjects();
  const save = useSaveQuiz();

  const [meta, setMeta] = useState({
    title: "",
    course: "",
    student_group: "",
    time_limit_minutes: "20",
    attempts_allowed: "1",
    pass_mark: "50",
    opens_on: "",
    closes_on: "",
    show_answers_after: "Immediately",
  });
  const [instructions, setInstructions] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([{ ...BLANK }]);

  function setField(key: keyof typeof meta, value: string) {
    setMeta((m) => ({ ...m, [key]: value }));
  }

  function updateQuestion(i: number, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  const totalMarks = useMemo(
    () => questions.reduce((a, q) => a + (Number(q.marks) || 0), 0),
    [questions],
  );

  async function submit(publish: boolean) {
    if (!meta.title.trim() || !meta.course || !meta.student_group) {
      toast.error("العنوان والمادة والشعبة مطلوبة");
      return;
    }
    const valid = questions.filter((q) => q.question_text.trim() && q.correct_answer.trim());
    if (!valid.length) {
      toast.error("أضف سؤالاً واحداً على الأقل مع إجابته الصحيحة");
      return;
    }
    try {
      await save.mutateAsync({
        ...meta,
        time_limit_minutes: Number(meta.time_limit_minutes) || 20,
        attempts_allowed: Number(meta.attempts_allowed) || 1,
        pass_mark: Number(meta.pass_mark) || 50,
        status: publish ? "Published" : "Draft",
        instructions,
        questions: valid,
      });
      toast.success(publish ? "تم نشر الاختبار للطلاب" : "تم حفظ الاختبار كمسودة");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">اختبار إلكتروني جديد</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>عنوان الاختبار</Label>
            <Input
              value={meta.title}
              onChange={(e) => setField("title", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المادة</Label>
            <SearchableSelect
              options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.course_name }))}
              value={meta.course}
              onChange={(v) => setField("course", v)}
              placeholder="اختر المادة"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الشعبة</Label>
            <SearchableSelect
              options={(classes.data ?? []).map((c) => ({
                value: c.name,
                label: c.student_group_name,
                hint: `${c.students} طالباً`,
              }))}
              value={meta.student_group}
              onChange={(v) => setField("student_group", v)}
              placeholder="اختر الشعبة"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المدة (دقيقة)</Label>
            <Input
              type="number"
              min={1}
              value={meta.time_limit_minutes}
              onChange={(e) => setField("time_limit_minutes", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>عدد المحاولات</Label>
            <Input
              type="number"
              min={1}
              value={meta.attempts_allowed}
              onChange={(e) => setField("attempts_allowed", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>درجة النجاح (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={meta.pass_mark}
              onChange={(e) => setField("pass_mark", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>إظهار الإجابات</Label>
            <SearchableSelect
              options={[
                { value: "Immediately", label: "فور التسليم" },
                { value: "After Close", label: "بعد إغلاق الاختبار" },
                { value: "Never", label: "لا تُعرض" },
              ]}
              value={meta.show_answers_after}
              onChange={(v) => setField("show_answers_after", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>يفتح في</Label>
            <Input
              type="datetime-local"
              value={meta.opens_on}
              onChange={(e) => setField("opens_on", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>يغلق في</Label>
            <Input
              type="datetime-local"
              value={meta.closes_on}
              onChange={(e) => setField("closes_on", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>تعليمات للطلاب</Label>
            <RichText
              value={instructions}
              onChange={setInstructions}
              placeholder="تعليمات الاختبار…"
              minHeight={80}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>
              الأسئلة ({questions.length}) — المجموع {totalMarks} درجة
            </Label>
            <button
              onClick={() => setQuestions((qs) => [...qs, { ...BLANK }])}
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
            >
              <Plus className="size-3.5" />
              سؤال
            </button>
          </div>

          <ul className="space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="num text-xs font-bold text-muted-foreground">سؤال {i + 1}</span>
                  {questions.length > 1 && (
                    <button
                      onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}
                      aria-label="حذف السؤال"
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>

                <Input
                  value={q.question_text}
                  onChange={(e) => updateQuestion(i, { question_text: e.target.value })}
                  placeholder="نص السؤال"
                  className="rounded-lg"
                />

                <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px]">
                  <SearchableSelect
                    options={[
                      { value: "Multiple Choice", label: "اختيار من متعدد" },
                      { value: "True/False", label: "صح أو خطأ" },
                      { value: "Short Answer", label: "إجابة قصيرة" },
                    ]}
                    value={q.question_type}
                    onChange={(v) =>
                      updateQuestion(i, {
                        question_type: v,
                        ...(v === "True/False"
                          ? {
                              option_a: "صح",
                              option_b: "خطأ",
                              option_c: "",
                              option_d: "",
                              correct_answer: "A",
                            }
                          : {}),
                        ...(v === "Short Answer"
                          ? {
                              option_a: "",
                              option_b: "",
                              option_c: "",
                              option_d: "",
                              correct_answer: "",
                            }
                          : {}),
                      })
                    }
                  />
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={q.marks}
                    onChange={(e) => updateQuestion(i, { marks: Number(e.target.value) })}
                    className="num rounded-lg text-center"
                    placeholder="درجة"
                  />
                </div>

                {q.question_type === "Short Answer" ? (
                  <Input
                    value={q.correct_answer}
                    onChange={(e) => updateQuestion(i, { correct_answer: e.target.value })}
                    placeholder="الإجابة الصحيحة"
                    className="mt-2 rounded-lg"
                  />
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {(["A", "B", "C", "D"] as const)
                      .filter((k) => q.question_type !== "True/False" || k === "A" || k === "B")
                      .map((key) => {
                        const field = `option_${key.toLowerCase()}` as keyof DraftQuestion;
                        return (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${i}`}
                              checked={q.correct_answer === key}
                              onChange={() => updateQuestion(i, { correct_answer: key })}
                              className="size-4 accent-primary"
                              title="الإجابة الصحيحة"
                            />
                            <span className="num w-4 text-xs font-bold text-muted-foreground">
                              {key}
                            </span>
                            <Input
                              value={String(q[field] ?? "")}
                              onChange={(e) => updateQuestion(i, { [field]: e.target.value })}
                              placeholder={`الخيار ${key}`}
                              className="h-9 rounded-lg"
                            />
                          </label>
                        );
                      })}
                    <p className="text-[11px] text-muted-foreground">
                      اختر الدائرة بجانب الإجابة الصحيحة.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={() => submit(true)}
            disabled={save.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "نشر للطلاب"}
          </button>
          <button
            onClick={() => submit(false)}
            disabled={save.isPending}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            حفظ كمسودة
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuizResultsDialog({ quiz, onClose }: { quiz: string; onClose: () => void }) {
  const { data, isLoading } = useQuizResults(quiz);
  const review = useReviewAttempt();

  async function award(attempt: string, idx: number, marks: number) {
    try {
      await review.mutateAsync({ attempt, marks: [{ idx, marks_awarded: marks }] });
      toast.success("تم تحديث الدرجة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التصحيح");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">نتائج {data?.quiz.title ?? "الاختبار"}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <TableSkeleton rows={6} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["سلّموا", `${data.summary.sat}/${data.summary.roster}`],
                ["المتوسط", data.summary.average != null ? `${data.summary.average}%` : "—"],
                ["ناجحون", data.summary.passed],
                ["بانتظار التصحيح", data.summary.needs_review],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-border p-3 text-center"
                >
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="num mt-1 text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>

            {/* Which questions the class found hardest. */}
            {data.questions.length > 0 && (
              <div>
                <Label className="mb-2 flex items-center gap-1.5 text-xs">
                  <BarChart3 className="size-3.5" />
                  أداء الصف حسب السؤال
                </Label>
                <ul className="space-y-2">
                  {[...data.questions]
                    .sort((a, b) => a.percent - b.percent)
                    .map((q) => (
                      <li key={q.idx} className="rounded-lg border border-border p-2.5">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="truncate text-xs">{q.text}</span>
                          <span className="num shrink-0 text-xs font-bold">{q.percent}%</span>
                        </div>
                        <ProgressBar
                          value={q.percent}
                          tone={
                            q.percent >= 70 ? "success" : q.percent >= 40 ? "warning" : "danger"
                          }
                        />
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div>
              <Label className="mb-2 block text-xs">المحاولات</Label>
              {data.attempts.length === 0 ? (
                <EmptyBlock title="لم يسلّم أحد بعد" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.attempts.map((a) => (
                    <li
                      key={a.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.student_name}</p>
                        <p className="num text-[11px] text-muted-foreground">
                          المحاولة {a.attempt} • {a.minutes} دقيقة • {a.status_label}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {a.needs_review && <Pill tone="warning">يحتاج تصحيح</Pill>}
                        <span
                          className={`num rounded-lg px-2.5 py-1 text-xs font-bold ${
                            a.passed
                              ? "bg-success-soft text-success"
                              : "bg-destructive-soft text-destructive"
                          }`}
                        >
                          {a.percentage}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {data.not_sat.length > 0 && (
              <div>
                <Label className="mb-2 block text-xs">لم يسلّموا ({data.not_sat.length})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {data.not_sat.map((s) => (
                    <Pill key={s.student} tone="muted">
                      {s.student_name}
                    </Pill>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter className="sm:justify-start">
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

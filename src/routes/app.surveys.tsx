import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Eye,
  MessageSquare,
  Plus,
  Star,
  Trash2,
  Users,
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
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/app-context";
import { isBackOffice } from "@/lib/roles";
import {
  useClasses,
  useDeleteSurvey,
  useSaveSurvey,
  useSubmitSurvey,
  useSurvey,
  useSurveyResults,
  useSurveys,
  type SurveyRow,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/surveys")({
  validateSearch: groupSearch,
  head: () => ({
    meta: [
      { title: "الاستبيانات — Match Education" },
      {
        name: "description",
        content: "استبيانات للطلاب والمعلمين وأولياء الأمور مع نتائج مُجمّعة.",
      },
    ],
  }),
  component: SurveysPage,
});

function SurveysPage() {
  const { role } = useApp();
  return isBackOffice(role) ? <AdminSurveysView /> : <RespondentView />;
}

/* ------------------------------------------------------------------- admin */

function AdminSurveysView() {
  const query = useSurveys();
  const remove = useDeleteSurvey();
  const confirm = useConfirm();

  const { group: groupFromUrl } = Route.useSearch();
  // Arrived from a class: the composer opens on it, aimed at that class.
  const [creating, setCreating] = useState(Boolean(groupFromUrl));
  const [results, setResults] = useState<string | null>(null);

  const items = query.data ?? [];
  const open = items.filter((s) => s.status === "Open");
  const responses = items.reduce((a, s) => a + s.responses, 0);

  async function removeSurvey(survey: SurveyRow) {
    const ok = await confirm({
      title: `حذف «${survey.title}»؟`,
      description: "الاستبيانات التي وصلتها إجابات لا يمكن حذفها — أغلقها بدلاً من ذلك.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(survey.id);
      toast.success("تم حذف الاستبيان");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title="الاستبيانات"
        subtitle="اجمع آراء الطلاب والمعلمين وأولياء الأمور، وشاهد النتائج مُجمّعة"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-4" />
            استبيان جديد
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="إجمالي الاستبيانات"
          value={items.length}
          icon={ClipboardList}
          tone="primary"
        />
        <KpiCard label="مفتوحة الآن" value={open.length} icon={CheckCircle2} tone="accent" />
        <KpiCard label="إجمالي الإجابات" value={responses} icon={Users} tone="info" />
      </div>

      <div className="mt-5">
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          <TableSkeleton rows={4} />
        ) : items.length === 0 ? (
          <EmptyBlock
            title="لا توجد استبيانات"
            description="أنشئ استبياناً لقياس رضا الطلاب أو أولياء الأمور."
            icon={<ClipboardList className="size-6" />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((s) => (
              <div key={s.id} className="card-surface flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-bold">{s.title}</p>
                  <Pill
                    tone={
                      s.status === "Open" ? "success" : s.status === "Closed" ? "muted" : "info"
                    }
                  >
                    {s.status_label}
                  </Pill>
                </div>

                <div className="num mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{s.audience_label}</span>
                  {s.anonymous && <Pill tone="muted">مجهول</Pill>}
                  {s.closes_on && <span>يغلق {s.closes_on}</span>}
                </div>

                <div className="mt-3 rounded-xl bg-secondary/50 p-3 text-center">
                  <p className="num text-2xl font-black">{s.responses}</p>
                  <p className="text-[11px] text-muted-foreground">إجابة</p>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-4">
                  <button
                    onClick={() => setResults(s.id)}
                    className="flex-1 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                  >
                    النتائج
                  </button>
                  <button
                    onClick={() => removeSurvey(s)}
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

      {creating && (
        <SurveyBuilderDialog defaultGroup={groupFromUrl} onClose={() => setCreating(false)} />
      )}
      {results && <ResultsDialog survey={results} onClose={() => setResults(null)} />}
    </>
  );
}

/* --------------------------------------------------------------- responding */

function RespondentView() {
  const query = useSurveys();
  const [answering, setAnswering] = useState<string | null>(null);

  const items = query.data ?? [];
  const pending = items.filter((s) => !s.answered);

  return (
    <>
      <PageHeader
        title="الاستبيانات"
        subtitle="رأيك يساعد المدرسة على التحسين — لن يستغرق الأمر دقائق"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="بانتظار رأيك" value={pending.length} icon={ClipboardList} tone="warm" />
        <KpiCard
          label="أجبت عليها"
          value={items.length - pending.length}
          icon={CheckCircle2}
          tone="accent"
        />
      </div>

      <div className="mt-5">
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          <TableSkeleton rows={3} />
        ) : items.length === 0 ? (
          <EmptyBlock
            title="لا توجد استبيانات حالياً"
            description="سيظهر هنا أي استبيان تطرحه المدرسة."
            icon={<ClipboardList className="size-6" />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((s) => (
              <div key={s.id} className="card-surface flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-bold">{s.title}</p>
                  {s.answered && <Pill tone="success">تم</Pill>}
                </div>

                {s.intro && (
                  <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    <RichTextView html={s.intro} />
                  </div>
                )}

                <div className="num mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {s.anonymous && <Pill tone="muted">🔒 مجهول الهوية</Pill>}
                  {s.closes_on && <span>يغلق {s.closes_on}</span>}
                </div>

                <div className="mt-auto pt-4">
                  <button
                    onClick={() => setAnswering(s.id)}
                    disabled={s.answered || !s.open}
                    className="w-full rounded-lg bg-brand-gradient px-3 py-2.5 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {s.answered ? "شكراً، تم استلام رأيك" : !s.open ? "مغلق" : "شارك برأيك"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {answering && <AnswerDialog survey={answering} onClose={() => setAnswering(null)} />}
    </>
  );
}

function AnswerDialog({ survey, onClose }: { survey: string; onClose: () => void }) {
  const { data, isLoading } = useSurvey(survey);
  const submit = useSubmitSurvey();
  const [answers, setAnswers] = useState<Record<number, string>>({});

  function set(idx: number, value: string) {
    setAnswers((a) => ({ ...a, [idx]: value }));
  }

  /** Multiple choice stores a comma-joined list. */
  function toggle(idx: number, option: string) {
    setAnswers((a) => {
      const current = (a[idx] || "").split(",").filter(Boolean);
      const next = current.includes(option)
        ? current.filter((x) => x !== option)
        : [...current, option];
      return { ...a, [idx]: next.join(",") };
    });
  }

  async function send() {
    if (!data) return;
    const missing = data.questions.filter((q) => q.required && !(answers[q.idx] || "").trim());
    if (missing.length) {
      toast.error(`يرجى الإجابة عن ${missing.length} سؤال إلزامي`);
      return;
    }
    try {
      await submit.mutateAsync({
        survey,
        answers: data.questions.map((q) => ({ idx: q.idx, answer: answers[q.idx] ?? "" })),
      });
      toast.success("شكراً لك — تم استلام رأيك 🙏");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الإرسال");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{data?.title ?? "الاستبيان"}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <TableSkeleton rows={5} />
        ) : (
          <>
            {data.intro && (
              <div className="rounded-xl border border-info/30 bg-info-soft p-3 text-xs">
                <RichTextView html={data.intro} />
              </div>
            )}
            {data.anonymous && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                🔒 إجابتك مجهولة تماماً — لا يُسجَّل اسمك مع الإجابة.
              </p>
            )}

            <ul className="space-y-4">
              {data.questions.map((q) => (
                <li key={q.idx} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold">
                    {q.question_text}
                    {q.required && <span className="mr-1 text-destructive">*</span>}
                  </p>

                  <div className="mt-3">
                    {q.question_type === "Rating" && (
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: q.scale_max }, (_, i) => i + 1).map((v) => (
                          <button
                            key={v}
                            onClick={() => set(q.idx, String(v))}
                            aria-label={`${v}`}
                            className={`grid size-11 place-items-center rounded-xl transition-colors ${
                              Number(answers[q.idx]) >= v
                                ? "bg-warm text-warm-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            <Star
                              className="size-5"
                              fill={Number(answers[q.idx]) >= v ? "currentColor" : "none"}
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {q.question_type === "YesNo" && (
                      <div className="flex gap-2">
                        {["نعم", "لا"].map((o) => (
                          <button
                            key={o}
                            onClick={() => set(q.idx, o)}
                            className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                              answers[q.idx] === o
                                ? "bg-brand-gradient text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.question_type === "Single Choice" && (
                      <div className="space-y-1.5">
                        {q.options.map((o) => (
                          <label
                            key={o}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                              answers[q.idx] === o
                                ? "border-primary bg-primary-soft"
                                : "border-border hover:bg-secondary/40"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${q.idx}`}
                              checked={answers[q.idx] === o}
                              onChange={() => set(q.idx, o)}
                              className="size-4 accent-primary"
                            />
                            <span className="text-sm">{o}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {q.question_type === "Multiple Choice" && (
                      <div className="space-y-1.5">
                        {q.options.map((o) => {
                          const on = (answers[q.idx] || "").split(",").includes(o);
                          return (
                            <label
                              key={o}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                                on
                                  ? "border-primary bg-primary-soft"
                                  : "border-border hover:bg-secondary/40"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggle(q.idx, o)}
                                className="size-4 accent-primary"
                              />
                              <span className="text-sm">{o}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {q.question_type === "Text" && (
                      <textarea
                        rows={3}
                        value={answers[q.idx] ?? ""}
                        onChange={(e) => set(q.idx, e.target.value)}
                        placeholder="اكتب رأيك…"
                        className="w-full rounded-xl border border-border bg-card p-3 text-sm"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={send}
            disabled={submit.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {submit.isPending ? "جارٍ الإرسال…" : "إرسال إجابتي"}
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

/* ----------------------------------------------------------------- builder */

interface DraftQuestion {
  question_text: string;
  question_type: string;
  required: boolean;
  options: string[];
  scale_max: number;
}

const BLANK: DraftQuestion = {
  question_text: "",
  question_type: "Rating",
  required: true,
  options: [],
  scale_max: 5,
};

function SurveyBuilderDialog({
  defaultGroup,
  onClose,
}: {
  defaultGroup?: string | undefined;
  onClose: () => void;
}) {
  const save = useSaveSurvey();

  const [meta, setMeta] = useState({
    title: "",
    // Opened from a class: aimed at that class, not at everyone.
    audience: defaultGroup ? "Classes" : "Students",
    status: "Open",
    opens_on: "",
    closes_on: "",
  });
  const [anonymous, setAnonymous] = useState(true);
  // Compulsory surveys hold the portal shut, so they cannot be anonymous:
  // with no respondent recorded nothing could ever mark them answered.
  const [isRequired, setIsRequired] = useState(false);
  const [classes, setClasses] = useState<string[]>(defaultGroup ? [defaultGroup] : []);
  const classesQuery = useClasses();
  const [intro, setIntro] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([{ ...BLANK }]);

  function update(i: number, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  async function submit() {
    if (!meta.title.trim()) {
      toast.error("عنوان الاستبيان مطلوب");
      return;
    }
    const valid = questions.filter((q) => q.question_text.trim());
    if (!valid.length) {
      toast.error("أضف سؤالاً واحداً على الأقل");
      return;
    }
    try {
      await save.mutateAsync({
        ...meta,
        anonymous: anonymous ? 1 : 0,
        ms_is_required: isRequired ? 1 : 0,
        // Empty means every class, which is what the picker's own hint says.
        ms_student_groups: meta.audience === "Classes" ? classes.join(",") : "",
        intro,
        questions: valid.map((q) => ({ ...q, required: q.required ? 1 : 0 })),
      });
      toast.success("تم إنشاء الاستبيان");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">استبيان جديد</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>العنوان</Label>
            <Input
              value={meta.title}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الجمهور</Label>
            <SearchableSelect
              options={[
                { value: "Students", label: "الطلاب" },
                { value: "Classes", label: "صفوف محدّدة" },
                { value: "Teachers", label: "المعلمون" },
                { value: "Parents", label: "أولياء الأمور" },
                { value: "All", label: "الجميع" },
              ]}
              value={meta.audience}
              onChange={(v) => setMeta((m) => ({ ...m, audience: v }))}
            />
          </div>
          {meta.audience === "Classes" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الصفوف المستهدفة</Label>
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-border p-2.5">
                {(classesQuery.data ?? []).map((c) => {
                  const on = classes.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() =>
                        setClasses((prev) =>
                          on ? prev.filter((x) => x !== c.name) : [...prev, c.name],
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        on
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {c.student_group_name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {classes.length === 0
                  ? "لم تختر صفاً — سيصل الاستبيان إلى جميع الصفوف."
                  : `${classes.length} صفاً محدّداً.`}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>يغلق في</Label>
            <Input
              type="date"
              value={meta.closes_on}
              onChange={(e) => setMeta((m) => ({ ...m, closes_on: e.target.value }))}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>مقدمة</Label>
            <RichText value={intro} onChange={setIntro} placeholder="رأيك يهمنا…" minHeight={70} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">إجابات مجهولة الهوية</p>
              <p className="text-[11px] text-muted-foreground">
                لا يُحفظ اسم المجيب إطلاقاً — يشجّع على الصراحة، لكن يمنع منع التكرار.
              </p>
            </div>
            <Switch
              checked={anonymous}
              onCheckedChange={(v) => {
                setAnonymous(v);
                if (v) setIsRequired(false);
              }}
              disabled={isRequired}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">استبيان إجباري</p>
              <p className="text-[11px] text-muted-foreground">
                لن يُفتح النظام للمستهدفين قبل تعبئته. لا يمكن أن يكون مجهول الهوية، وإلا تعذّر
                معرفة من أجاب فيبقى النظام مغلقاً للأبد.
              </p>
            </div>
            <Switch
              checked={isRequired}
              onCheckedChange={(v) => {
                setIsRequired(v);
                if (v) setAnonymous(false);
              }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>الأسئلة ({questions.length})</Label>
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
                      aria-label="حذف"
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>

                <Input
                  value={q.question_text}
                  onChange={(e) => update(i, { question_text: e.target.value })}
                  placeholder="نص السؤال"
                  className="rounded-lg"
                />

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <SearchableSelect
                    options={[
                      { value: "Rating", label: "تقييم بالنجوم" },
                      { value: "YesNo", label: "نعم / لا" },
                      { value: "Single Choice", label: "اختيار واحد" },
                      { value: "Multiple Choice", label: "اختيار متعدد" },
                      { value: "Text", label: "إجابة نصية" },
                    ]}
                    value={q.question_type}
                    onChange={(v) => update(i, { question_type: v })}
                  />
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 text-xs">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => update(i, { required: e.target.checked })}
                      className="size-4 accent-primary"
                    />
                    سؤال إلزامي
                  </label>
                </div>

                {["Single Choice", "Multiple Choice"].includes(q.question_type) && (
                  <textarea
                    rows={3}
                    value={q.options.join("\n")}
                    onChange={(e) => update(i, { options: e.target.value.split("\n") })}
                    placeholder="خيار في كل سطر"
                    className="mt-2 w-full rounded-lg border border-border bg-card p-2 text-sm"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "نشر الاستبيان"}
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

function ResultsDialog({ survey, onClose }: { survey: string; onClose: () => void }) {
  const { data, isLoading } = useSurveyResults(survey);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">نتائج — {data?.survey.title ?? ""}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <TableSkeleton rows={5} />
        ) : data.summary.responses === 0 ? (
          <EmptyBlock title="لم تصل أي إجابات بعد" icon={<BarChart3 className="size-6" />} />
        ) : (
          <>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="num text-3xl font-black">{data.summary.responses}</p>
              <p className="text-xs text-muted-foreground">إجابة مستلمة</p>
            </div>

            <ul className="space-y-4">
              {data.questions.map((q) => (
                <li key={q.idx} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{q.question}</p>
                    <Pill tone="muted">{q.answered} إجابة</Pill>
                  </div>

                  {q.type === "Rating" && (
                    <div className="mt-3">
                      <p className="num text-2xl font-black text-warm-foreground">
                        ⭐ {q.average ?? "—"} / {q.scale_max}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {(q.distribution ?? []).map((d) => (
                          <li key={d.value} className="flex items-center gap-2">
                            <span className="num w-4 text-xs">{d.value}</span>
                            <div className="flex-1">
                              <ProgressBar
                                value={q.answered ? (d.count / q.answered) * 100 : 0}
                                tone="warning"
                              />
                            </div>
                            <span className="num w-6 text-xs text-muted-foreground">{d.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(q.options ?? []).length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {q.options!.map((o) => (
                        <li key={o.option}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span>{o.option}</span>
                            <span className="num font-bold">
                              {o.percent}% ({o.count})
                            </span>
                          </div>
                          <ProgressBar value={o.percent} tone="primary" />
                        </li>
                      ))}
                    </ul>
                  )}

                  {(q.responses ?? []).length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {q.responses!.slice(0, 20).map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs"
                        >
                          <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
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

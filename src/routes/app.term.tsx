import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GradeCalculation } from "@/components/shared/grade-calculation";
import {
  Eye,
  ArrowUpFromLine,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Lock,
  RotateCcw,
  Send,
  Undo2,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { useApp } from "@/lib/app-context";
import { isBackOffice } from "@/lib/roles";
import {
  useMySubmissions,
  usePublishTerm,
  useReviewTerm,
  useSubmitTerm,
  useTermOverview,
  useUnpublishTerm,
  type TermSubmissionRow,
  useReopenForAppeal,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/term")({
  head: () => ({
    meta: [
      { title: "ترحيل علامات الفصل — Match Education" },
      {
        name: "description",
        content: "ترحيل علامات نهاية الفصل من المعلمين إلى الإدارة، ثم اعتمادها ونشرها للطلاب.",
      },
    ],
  }),
  component: TermPage,
});

/** Colour and icon per workflow state, so status reads at a glance. */
const STATE = {
  Draft: { tone: "muted" as const, icon: Clock, label: "قيد الإدخال" },
  Submitted: { tone: "info" as const, icon: Send, label: "مُرحّل للإدارة" },
  Returned: { tone: "warning" as const, icon: RotateCcw, label: "مُعاد للتعديل" },
  Approved: { tone: "primary" as const, icon: CheckCircle2, label: "معتمد" },
  Published: { tone: "success" as const, icon: CheckCheck, label: "منشور" },
};

function TermPage() {
  const { role } = useApp();
  return isBackOffice(role) ? <AdminTermView /> : <TeacherTermView />;
}

/* ------------------------------------------------------------------ teacher */

function TeacherTermView() {
  const { data, isLoading, error, refetch } = useMySubmissions();
  const submit = useSubmitTerm();
  const confirm = useConfirm();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const rows = data?.rows ?? [];
  const done = rows.filter((r) => ["Submitted", "Approved", "Published"].includes(r.status));
  const returned = rows.filter((r) => r.status === "Returned");
  const pending = rows.filter((r) => r.status === "Draft");

  async function send(row: TermSubmissionRow) {
    const ok = await confirm({
      title: `ترحيل علامات ${row.course}؟`,
      description:
        "بعد الترحيل لن تتمكن من تعديل العلامات إلا إذا أعادتها الإدارة إليك. تأكد من إدخال جميع العلامات أولاً.",
      tone: "question",
      confirmLabel: "ترحيل للإدارة",
    });
    if (!ok) return;
    try {
      const result = await submit.mutateAsync({
        student_group: row.student_group,
        course: row.course,
      });
      toast.success(`تم ترحيل علامات ${result.students} طالباً إلى الإدارة`);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الترحيل");
    }
  }

  return (
    <>
      <PageHeader
        title="ترحيل علامات الفصل"
        subtitle="راجع علامات كل شعبة ومادة، ثم رحّلها إلى الإدارة لاعتمادها"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي المواد" value={rows.length} icon={ArrowUpFromLine} tone="primary" />
        <KpiCard label="بانتظار الإدخال" value={pending.length} icon={Clock} tone="warm" />
        <KpiCard label="مُعادة للتعديل" value={returned.length} icon={RotateCcw} tone="info" />
        <KpiCard label="مُرحّلة" value={done.length} icon={CheckCircle2} tone="accent" />
      </div>

      {returned.length > 0 && (
        <div className="mt-5 rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-warning-foreground">
            <RotateCcw className="size-4" />
            أعادت الإدارة {returned.length} مادة للتعديل
          </p>
          <ul className="mt-2 space-y-1 text-xs text-warning-foreground/80">
            {returned.map((r) => (
              <li key={`${r.student_group}-${r.course}`}>
                • {r.student_group} — {r.course}
                {r.review_notes ? `: ${r.review_notes}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <SectionCard
          title="شُعبي وموادي"
          description={`الفصل: ${data?.academic_term ?? "—"}`}
        >
          {rows.length === 0 ? (
            <EmptyBlock
              title="لا توجد مواد مسندة إليك"
              description="تواصل مع الإدارة لإسناد الشُعب والمواد."
            />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const state = STATE[r.status];
                const StateIcon = state.icon;
                const canSend = r.status === "Draft" || r.status === "Returned";
                const progress = r.students ? (r.entered / r.students) * 100 : 0;
                return (
                  <li
                    key={`${r.student_group}-${r.course}`}
                    className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold">{r.course}</p>
                        <span className="text-xs text-muted-foreground">— {r.student_group}</span>
                        <Pill tone={state.tone}>
                          <StateIcon className="ml-1 inline size-3" />
                          {r.status_label}
                        </Pill>
                      </div>
                      <div className="mt-2 max-w-md">
                        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                          <span>العلامات المُدخلة</span>
                          <span className="num">
                            {r.entered}/{r.students}
                          </span>
                        </div>
                        <ProgressBar
                          value={progress}
                          tone={r.complete ? "success" : progress > 0 ? "primary" : "danger"}
                        />
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        to="/app/gradebook"
                        search={{ group: r.student_group, course: r.course }}
                        className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                      >
                        إدخال العلامات
                      </Link>
                      {canSend ? (
                        <button
                          onClick={() => send(r)}
                          disabled={!r.complete || submit.isPending}
                          title={r.complete ? "ترحيل للإدارة" : "أكمل إدخال جميع العلامات أولاً"}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Send className="size-3.5" />
                          ترحيل
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground">
                          <Lock className="size-3.5" />
                          مُقفل
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

    </>
  );
}

/* -------------------------------------------------------------------- admin */

function AdminTermView() {
  const { data, isLoading, error, refetch } = useTermOverview();
  const review = useReviewTerm();
  const publish = usePublishTerm();
  const unpublish = useUnpublishTerm();
  const reopenAppeal = useReopenForAppeal();
  const [appeal, setAppeal] = useState<
    { student_group: string; course: string; className: string } | null
  >(null);
  const [appealReason, setAppealReason] = useState("");
  const [preview, setPreview] = useState<
    { student_group: string; course: string; className: string } | null
  >(null);

  async function submitAppeal() {
    if (!appeal) return;
    if (!appealReason.trim()) {
      toast.error("يجب كتابة سبب إعادة الفتح");
      return;
    }
    try {
      const res = await reopenAppeal.mutateAsync({
        student_group: appeal.student_group,
        course: appeal.course,
        reason: appealReason.trim(),
      });
      toast.success(res.message_ar || "تم إعادة فتح العلامات");
      setAppeal(null);
      setAppealReason("");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إعادة الفتح");
    }
  }
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const rows = data?.rows ?? [];
  const awaiting = rows.reduce(
    (a, r) => a + r.subjects.filter((s) => s.status === "Submitted").length,
    0,
  );
  const readyToPublish = rows.filter((r) => r.ready && !r.is_published).length;
  const publishedCount = rows.filter((r) => r.is_published).length;

  async function act(submission: string, action: "approve" | "return", course: string) {
    const ok = await confirm({
      title: action === "approve" ? `اعتماد علامات ${course}؟` : `إعادة علامات ${course} للمعلم؟`,
      description:
        action === "approve"
          ? "بعد الاعتماد تصبح المادة جاهزة للنشر ضمن نتائج الشعبة."
          : "سيتمكن المعلم من تعديل العلامات وإعادة ترحيلها.",
      tone: action === "approve" ? "success" : "warning",
      confirmLabel: action === "approve" ? "اعتماد" : "إعادة",
    });
    if (!ok) return;
    try {
      await review.mutateAsync({ submission, action });
      toast.success(action === "approve" ? "تم اعتماد العلامات" : "تمت إعادة العلامات للمعلم");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر تنفيذ الإجراء");
    }
  }

  async function doPublish(group: string, name: string, ready: boolean) {
    const ok = await confirm({
      title: `نشر نتائج ${name}؟`,
      description: ready
        ? "بعد النشر يرى الطلاب وأولياء الأمور معدّلهم الفصلي النهائي."
        : "بعض المواد لم تُعتمد بعد. النشر الآن سيتضمنها كما هي.",
      tone: ready ? "success" : "warning",
      confirmLabel: "نشر النتائج",
    });
    if (!ok) return;
    try {
      const result = await publish.mutateAsync({
        student_group: group,
        ...(ready ? {} : { force: true }),
      });
      toast.success(`تم نشر نتائج ${result.published} مادة`);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر النشر");
    }
  }

  async function doUnpublish(group: string, name: string) {
    const ok = await confirm({
      title: `إعادة فتح نتائج ${name}؟`,
      description:
        "ستختفي النتائج من صفحات الطلاب وأولياء الأمور حتى إعادة النشر. استخدم هذا لتصحيح خطأ فقط.",
      tone: "danger",
      confirmLabel: "إعادة الفتح",
    });
    if (!ok) return;
    try {
      await unpublish.mutateAsync({ student_group: group });
      toast.success("تم إعادة فتح النتائج");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إعادة الفتح");
    }
  }

  return (
    <>
      <PageHeader
        title="اعتماد ونشر نتائج الفصل"
        subtitle="راجع علامات كل مادة بعد ترحيلها من المعلمين، ثم انشر النتائج النهائية للطلاب"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد الشُعب" value={rows.length} icon={ArrowUpFromLine} tone="primary" />
        <KpiCard label="بانتظار المراجعة" value={awaiting} icon={Clock} tone="warm" />
        <KpiCard label="جاهزة للنشر" value={readyToPublish} icon={CheckCircle2} tone="accent" />
        <KpiCard label="منشورة" value={publishedCount} icon={CheckCheck} tone="info" />
      </div>

      <div className="mt-5">
        <SectionCard
          title="حالة الشُعب"
          description={`الفصل: ${data?.academic_term ?? "—"} — اضغط على أي شعبة لعرض موادها`}
        >
          {rows.length === 0 ? (
            <EmptyBlock title="لا توجد شُعب في هذا الفصل" />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const open = expanded === r.student_group;
                return (
                  <li key={r.student_group}>
                    <div className="grid gap-3 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                      <button
                        onClick={() => setExpanded(open ? null : r.student_group)}
                        aria-label={`عرض مواد ${r.name}`}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        {open ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronLeft className="size-4" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold">{r.name}</p>
                          {r.is_published ? (
                            <Pill tone="success">منشورة</Pill>
                          ) : r.ready ? (
                            <Pill tone="primary">جاهزة للنشر</Pill>
                          ) : (
                            <Pill tone="muted">قيد التجميع</Pill>
                          )}
                          {r.returned > 0 && <Pill tone="warning">{r.returned} مُعادة</Pill>}
                        </div>
                        <div className="mt-2 max-w-md">
                          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                            <span>المواد المُرحّلة</span>
                            <span className="num">
                              {r.submitted}/{r.expected || r.submitted}
                            </span>
                          </div>
                          <ProgressBar
                            value={
                              r.expected ? (r.submitted / r.expected) * 100 : r.submitted ? 100 : 0
                            }
                            tone={r.ready ? "success" : "primary"}
                          />
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {r.is_published ? (
                          <button
                            onClick={() => doUnpublish(r.student_group, r.name)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"
                          >
                            <Undo2 className="size-3.5" />
                            إعادة فتح
                          </button>
                        ) : (
                          <button
                            onClick={() => doPublish(r.student_group, r.name, r.ready)}
                            disabled={r.submitted === 0 || publish.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CheckCheck className="size-3.5" />
                            نشر النتائج
                          </button>
                        )}
                      </div>
                    </div>

                    {open && (
                      <div className="mb-4 space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                        {r.subjects.length === 0 ? (
                          <p className="py-2 text-center text-xs text-muted-foreground">
                            لم يُرحّل أي معلم علامات هذه الشعبة بعد.
                          </p>
                        ) : (
                          r.subjects.map((s) => {
                            const state = STATE[s.status as keyof typeof STATE] ?? STATE.Draft;
                            const StateIcon = state.icon;
                            return (
                              <div
                                key={s.id}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-card px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                                    {s.course}
                                    {/* A reopened subject is flagged with how many
                                        marks moved, so the reviewer checks the
                                        teacher touched only the disputed one. */}
                                    {s.reopened_on && (
                                      <span className="shrink-0 rounded-md border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                        {s.changed_count > 0
                                          ? `عُدّلت ${s.changed_count} علامة`
                                          : "أُعيد فتحها"}
                                      </span>
                                    )}
                                  </p>
                                  <p className="num text-[11px] text-muted-foreground">
                                    {s.instructor ?? "—"}
                                    {s.submitted_on ? ` • ${s.submitted_on.slice(0, 16)}` : ""}
                                  </p>
                                  {s.reopened_on && s.reopen_reason && (
                                    <p className="mt-0.5 truncate text-[11px] text-amber-700">
                                      سبب إعادة الفتح: {s.reopen_reason}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Pill tone={state.tone}>
                                    <StateIcon className="ml-1 inline size-3" />
                                    {s.status_label}
                                  </Pill>
                                  {s.status === "Submitted" && s.reopened_on && (
                                    <Link
                                      to="/app/gradebook"
                                      search={{ group: r.student_group, course: s.course }}
                                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary"
                                    >
                                      مراجعة التعديلات
                                    </Link>
                                  )}
                                  {/* Marks must be readable before they are
                                      approved: approving a submission sight
                                      unseen is the one thing the review step
                                      exists to prevent. */}
                                  {(s.status === "Submitted" ||
                                    s.status === "Approved" ||
                                    s.status === "Published") && (
                                    <button
                                      onClick={() =>
                                        setPreview({
                                          student_group: r.student_group,
                                          course: s.course,
                                          className: r.name,
                                        })
                                      }
                                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary"
                                    >
                                      <Eye className="size-3" />
                                      مشاهدة العلامات
                                    </button>
                                  )}
                                  {s.status === "Submitted" && (
                                    <>
                                      <button
                                        onClick={() => act(s.id, "approve", s.course)}
                                        className="rounded-lg bg-success-soft px-2.5 py-1 text-xs font-semibold text-success transition-colors hover:brightness-95"
                                      >
                                        اعتماد
                                      </button>
                                      <button
                                        onClick={() => act(s.id, "return", s.course)}
                                        className="rounded-lg bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-foreground transition-colors hover:brightness-95"
                                      >
                                        إعادة
                                      </button>
                                    </>
                                  )}
                                  {/* Once approved or published there was no way
                                      back for a single subject — an appeal had to
                                      reopen the whole class. This reopens just
                                      this course for this section. */}
                                  {(s.status === "Approved" || s.status === "Published") && (
                                    <button
                                      onClick={() =>
                                        setAppeal({
                                          student_group: r.student_group,
                                          course: s.course,
                                          className: r.name,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20"
                                    >
                                      <Undo2 className="size-3" />
                                      إعادة فتح (طعن)
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
      {preview && (
        <Dialog open onOpenChange={(v) => !v && setPreview(null)}>
          <DialogContent className="max-w-4xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>علامات {preview.course}</DialogTitle>
              <DialogDescription>
                {preview.className} — العلامات كما احتسبها المعلم، قبل الاعتماد.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[65vh] overflow-y-auto">
              <GradeCalculation
                studentGroup={preview.student_group}
                course={preview.course}
                canEdit={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {appeal && (
        <Dialog open onOpenChange={(v) => !v && setAppeal(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إعادة فتح العلامات للتعديل</DialogTitle>
              <DialogDescription>
                {appeal.course} — {appeal.className}. ستعود العلامات للمعلم للتعديل، وتُخفى عن
                الطلاب وأولياء الأمور مؤقتاً حتى إعادة النشر.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="appeal-reason">سبب إعادة الفتح</Label>
              <Textarea
                id="appeal-reason"
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="مثال: طعن الطالب على علامة الاختبار النهائي وتبيّن وجود خطأ في الجمع"
                rows={3}
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                يُحفظ السبب في سجل النتائج مع اسمك وتاريخ الإجراء.
              </p>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setAppeal(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={submitAppeal}
                disabled={reopenAppeal.isPending || !appealReason.trim()}
                className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {reopenAppeal.isPending ? "جارٍ..." : "إعادة الفتح"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

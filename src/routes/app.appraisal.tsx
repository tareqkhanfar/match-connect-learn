import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Award,
  ClipboardCheck,
  Eye,
  MessageSquare,
  Plus,
  Send,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
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
import { isBackOffice } from "@/lib/roles";
import {
  useAcknowledgeObservation,
  useAppraisalOverview,
  useObservation,
  useObservations,
  usePerformanceFile,
  useSaveObservation,
  useShareObservation,
  useTeachers,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/appraisal")({
  head: () => ({
    meta: [
      { title: "تقييم المعلمين — Match Education" },
      {
        name: "description",
        content: "الزيارات الصفية وتقييم أداء المعلمين وملف الأداء لكل معلم.",
      },
    ],
  }),
  component: AppraisalPage,
});

/** Colour a percentage the same way everywhere. */
function tone(percent: number | null): "success" | "primary" | "warning" | "danger" {
  if (percent === null) return "primary";
  if (percent >= 85) return "success";
  if (percent >= 70) return "primary";
  if (percent >= 60) return "warning";
  return "danger";
}

function AppraisalPage() {
  const { role } = useApp();
  return isBackOffice(role) ? <AdminAppraisalView /> : <TeacherAppraisalView />;
}

/* ------------------------------------------------------------------- admin */

function AdminAppraisalView() {
  const overview = useAppraisalOverview();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);

  if (overview.isLoading) return <DashboardSkeleton />;
  if (overview.error) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;

  const rows = overview.data?.rows ?? [];
  const summary = overview.data?.summary;

  return (
    <>
      <PageHeader
        title="تقييم المعلمين"
        subtitle="الزيارات الصفية وملفات الأداء — المعلمون بلا زيارات يظهرون أولاً"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-4" />
            زيارة صفية جديدة
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد المعلمين" value={summary?.teachers ?? 0} icon={Users} tone="primary" />
        <KpiCard label="تمت زيارتهم" value={summary?.observed ?? 0} icon={UserCheck} tone="accent" />
        <KpiCard
          label="بلا زيارات"
          value={summary?.never_observed ?? 0}
          icon={ClipboardCheck}
          tone="warm"
        />
        <KpiCard
          label="متوسط المدرسة"
          value={summary?.school_average != null ? `${summary.school_average}%` : "—"}
          icon={Award}
          tone="info"
        />
      </div>

      <div className="mt-5">
        <SectionCard title="المعلمون" description={`${rows.length} معلماً`}>
          {rows.length === 0 ? (
            <EmptyBlock title="لا يوجد معلمون" />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li
                  key={r.instructor}
                  className="grid gap-3 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      {r.observations === 0 ? (
                        <Pill tone="warning">لم تتم زيارته</Pill>
                      ) : (
                        <Pill tone="muted">{r.latest_rating}</Pill>
                      )}
                      {r.drafts > 0 && <Pill tone="info">{r.drafts} مسودة</Pill>}
                      {r.awaiting_response > 0 && (
                        <Pill tone="primary">{r.awaiting_response} بانتظار رد المعلم</Pill>
                      )}
                    </div>
                    {r.average !== null && (
                      <div className="mt-2 max-w-md">
                        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                          <span>
                            {r.observations} زيارة • آخرها {r.latest}
                          </span>
                          <span className="num">{r.average}%</span>
                        </div>
                        <ProgressBar value={r.average} tone={tone(r.average)} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setFile(r.instructor)}
                    className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                  >
                    ملف الأداء
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {creating && <ObservationDialog onClose={() => setCreating(false)} />}
      {viewing && <ObservationDetailDialog observation={viewing} onClose={() => setViewing(null)} />}
      {file && (
        <PerformanceDialog
          instructor={file}
          onClose={() => setFile(null)}
          onOpenObservation={(id) => {
            setFile(null);
            setViewing(id);
          }}
        />
      )}
    </>
  );
}

/* ----------------------------------------------------------------- teacher */

function TeacherAppraisalView() {
  const file = usePerformanceFile();
  const [viewing, setViewing] = useState<string | null>(null);

  if (file.isLoading) return <DashboardSkeleton />;
  if (file.error) return <ErrorState error={file.error} onRetry={() => file.refetch()} />;

  const d = file.data!;
  const TrendIcon = d.summary.trend === "up" ? TrendingUp : TrendingDown;

  return (
    <>
      <PageHeader title="ملف أدائي" subtitle="الزيارات الصفية وملاحظات الإدارة على أدائك" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد الزيارات" value={d.summary.observations} icon={ClipboardCheck} tone="primary" />
        <KpiCard
          label="متوسط التقييم"
          value={d.summary.average_percent != null ? `${d.summary.average_percent}%` : "—"}
          icon={Award}
          tone="accent"
        />
        <KpiCard label="عدد الشُعب" value={d.teaching.classes} icon={Users} tone="info" />
        <KpiCard label="عدد الطلاب" value={d.teaching.students} icon={UserCheck} tone="warm" />
      </div>

      {d.summary.awaiting_response > 0 && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary-soft p-4 text-sm">
          <MessageSquare className="size-4 shrink-0 text-primary" />
          <span>
            لديك {d.summary.awaiting_response} تقييم بانتظار اطّلاعك — افتحه وسجّل ملاحظتك.
          </span>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <SectionCard title="الزيارات الصفية" description={`${d.observations.length} زيارة`}>
          {d.observations.length === 0 ? (
            <EmptyBlock
              title="لا توجد زيارات بعد"
              description="ستظهر هنا ملاحظات الإدارة بعد أول زيارة صفية."
            />
          ) : (
            <ul className="divide-y divide-border">
              {d.observations.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => setViewing(o.id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5 text-right transition-colors hover:bg-secondary/40"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{o.type_label}</p>
                        {o.status === "Shared" && <Pill tone="info">جديد</Pill>}
                      </div>
                      <p className="num mt-0.5 text-xs text-muted-foreground">
                        {o.date}
                        {o.course ? ` • ${o.course}` : ""}
                        {o.student_group ? ` • ${o.student_group}` : ""}
                      </p>
                      <div className="mt-2 max-w-xs">
                        <ProgressBar value={o.percent} tone={tone(o.percent)} />
                      </div>
                    </div>
                    <span className="num shrink-0 text-sm font-bold">{o.percent}%</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="نشاطي التدريسي" description="من سجلات النظام">
          <dl className="space-y-3 text-sm">
            {[
              ["الشُعب", d.teaching.classes],
              ["المواد", d.teaching.subjects],
              ["الطلاب", d.teaching.students],
              ["الواجبات المُنشأة", d.teaching.assignments],
              ["العلامات المُدخلة", d.teaching.marks_entered],
              ["الفصول المُرحّلة", d.teaching.terms_submitted],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between border-b border-border pb-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="num font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          {d.summary.trend && (
            <p
              className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${
                d.summary.trend === "up" ? "text-success" : "text-warning"
              }`}
            >
              <TrendIcon className="size-3.5" />
              {d.summary.trend === "up"
                ? "أداؤك في تحسّن مقارنة بالزيارة السابقة"
                : d.summary.trend === "down"
                  ? "انخفاض طفيف مقارنة بالزيارة السابقة"
                  : "أداء مستقر"}
            </p>
          )}
        </SectionCard>
      </div>

      {viewing && <ObservationDetailDialog observation={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/* ----------------------------------------------------------------- dialogs */

function ObservationDialog({ onClose }: { onClose: () => void }) {
  const overview = useAppraisalOverview();
  const teachers = useTeachers({ status: "Active" });  // An observation is scheduled for someone still teaching.
  const save = useSaveObservation();

  const [instructor, setInstructor] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("Lesson Observation");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});

  const template = overview.data?.criteria_template ?? [];

  async function submit() {
    if (!instructor) {
      toast.error("اختر المعلم");
      return;
    }
    try {
      const result = await save.mutateAsync({
        instructor,
        observation_date: date,
        observation_type: type,
        strengths,
        improvements,
        criteria: template.map((c) => ({
          ...c,
          score: Number(scores[c.criterion] ?? 0),
        })),
      });
      toast.success(`تم حفظ التقييم — ${result.percent}% (${result.rating})`);
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">زيارة صفية جديدة</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>المعلم</Label>
            <SearchableSelect
              options={(teachers.data ?? []).map((t) => ({
                value: t.id,
                label: t.instructor_name,
                ...(t.department ? { hint: t.department } : {}),
              }))}
              value={instructor}
              onChange={setInstructor}
              placeholder="اختر المعلم"
            />
          </div>
          <div className="space-y-1.5">
            <Label>التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="num rounded-xl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>نوع الزيارة</Label>
            <SearchableSelect
              options={[
                { value: "Lesson Observation", label: "زيارة صفية" },
                { value: "Peer Review", label: "تقييم الأقران" },
                { value: "Annual Appraisal", label: "تقييم سنوي" },
                { value: "Follow-up", label: "زيارة متابعة" },
              ]}
              value={type}
              onChange={setType}
            />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">معايير التقييم</Label>
          <ul className="space-y-2">
            {template.map((c) => (
              <li
                key={c.criterion}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.criterion}</p>
                  <p className="num text-[11px] text-muted-foreground">
                    الوزن {c.weight} • من {c.max_score}
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={c.max_score}
                  step={0.5}
                  value={scores[c.criterion] ?? ""}
                  onChange={(e) => setScores((s) => ({ ...s, [c.criterion]: e.target.value }))}
                  placeholder="0"
                  className="num h-9 w-20 rounded-lg text-center"
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>نقاط القوة</Label>
            <textarea
              rows={3}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              className="w-full rounded-xl border border-border bg-card p-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>جوانب التحسين</Label>
            <textarea
              rows={3}
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              className="w-full rounded-xl border border-border bg-card p-3 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ كمسودة"}
          </button>
          <button onClick={onClose} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold">
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObservationDetailDialog({
  observation,
  onClose,
}: {
  observation: string;
  onClose: () => void;
}) {
  const { role } = useApp();
  const { data, isLoading } = useObservation(observation);
  const share = useShareObservation();
  const acknowledge = useAcknowledgeObservation();
  const confirm = useConfirm();
  const [response, setResponse] = useState("");

  useEffect(() => {
    if (data?.teacher_response) setResponse(data.teacher_response);
  }, [data]);

  const staff = isBackOffice(role);

  async function doShare() {
    const ok = await confirm({
      title: "إرسال التقييم للمعلم؟",
      description: "سيتمكن المعلم من الاطلاع على التقييم والرد عليه.",
      tone: "question",
      confirmLabel: "إرسال",
    });
    if (!ok) return;
    try {
      await share.mutateAsync(observation);
      toast.success("تم إرسال التقييم للمعلم");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الإرسال");
    }
  }

  async function doAcknowledge() {
    try {
      await acknowledge.mutateAsync({ observation, ...(response ? { response } : {}) });
      toast.success("تم تسجيل اطّلاعك");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التسجيل");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {data ? `${data.type_label} — ${data.instructor_name}` : "التقييم"}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <TableSkeleton rows={5} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-lg font-bold text-primary-foreground">
                {data.percent}%
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{data.rating}</p>
                <p className="num text-xs text-muted-foreground">
                  {data.date}
                  {data.course ? ` • ${data.course}` : ""}
                  {data.student_group ? ` • ${data.student_group}` : ""}
                </p>
              </div>
              <Pill tone={data.status === "Acknowledged" ? "success" : "info"}>
                {data.status_label}
              </Pill>
            </div>

            <div>
              <Label className="mb-2 block text-xs">المعايير</Label>
              <ul className="space-y-1.5">
                {data.criteria.map((c) => (
                  <li
                    key={c.criterion}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2"
                  >
                    <span className="truncate text-xs">{c.criterion}</span>
                    <span className="num text-xs font-bold">
                      {c.score}/{c.max_score}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {data.strengths && (
              <div>
                <Label className="mb-1.5 block text-xs">نقاط القوة</Label>
                <p className="rounded-xl border border-border bg-success-soft/40 p-3 text-sm">
                  {data.strengths}
                </p>
              </div>
            )}
            {data.improvements && (
              <div>
                <Label className="mb-1.5 block text-xs">جوانب التحسين</Label>
                <p className="rounded-xl border border-border bg-warm-soft/40 p-3 text-sm">
                  {data.improvements}
                </p>
              </div>
            )}

            {/* The teacher replies; staff read what they wrote. */}
            {role === "teacher" && data.status !== "Acknowledged" ? (
              <div>
                <Label className="mb-1.5 block text-xs">ردّك على التقييم (اختياري)</Label>
                <textarea
                  rows={3}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="اكتب ملاحظتك…"
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm"
                />
              </div>
            ) : (
              data.teacher_response && (
                <div>
                  <Label className="mb-1.5 block text-xs">رد المعلم</Label>
                  <p className="rounded-xl border border-border bg-primary-soft/40 p-3 text-sm">
                    {data.teacher_response}
                  </p>
                </div>
              )
            )}
          </>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          {staff && data?.status === "Draft" && (
            <button
              onClick={doShare}
              disabled={share.isPending}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Send className="size-4" />
              {share.isPending ? "جارٍ الإرسال…" : "إرسال للمعلم"}
            </button>
          )}
          {role === "teacher" && data?.status === "Shared" && (
            <button
              onClick={doAcknowledge}
              disabled={acknowledge.isPending}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Eye className="size-4" />
              {acknowledge.isPending ? "جارٍ التسجيل…" : "اطّلعت على التقييم"}
            </button>
          )}
          <button onClick={onClose} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold">
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PerformanceDialog({
  instructor,
  onClose,
  onOpenObservation,
}: {
  instructor: string;
  onClose: () => void;
  onOpenObservation: (id: string) => void;
}) {
  const { data, isLoading } = usePerformanceFile(instructor);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">ملف الأداء — {data?.name ?? ""}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <TableSkeleton rows={6} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["الزيارات", data.summary.observations],
                ["المتوسط", data.summary.average_percent != null ? `${data.summary.average_percent}%` : "—"],
                ["الشُعب", data.teaching.classes],
                ["الطلاب", data.teaching.students],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-border p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="num mt-1 text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>

            {data.observations.length === 0 ? (
              <EmptyBlock title="لم تتم زيارة هذا المعلم بعد" />
            ) : (
              <ul className="divide-y divide-border">
                {data.observations.map((o) => (
                  <li key={o.id}>
                    <button
                      onClick={() => onOpenObservation(o.id)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-right transition-colors hover:bg-secondary/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{o.type_label}</p>
                        <p className="num text-[11px] text-muted-foreground">
                          {o.date} • {o.status_label}
                        </p>
                      </div>
                      <span className="num text-sm font-bold">{o.percent}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <DialogFooter className="sm:justify-start">
          <button onClick={onClose} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold">
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

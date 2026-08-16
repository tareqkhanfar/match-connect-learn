import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpFromLine,
  Check,
  RotateCcw,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/shared/confirm";
import { errorMessage } from "@/lib/api/error-message";
import { useApp } from "@/lib/app-context";
import {
  useMarkRepeated,
  usePromote,
  usePromotionOptions,
  type PromotionOptions,
  usePromotionPreview,
  usePromotionRules,
  useSavePromotionRules,
  type PromotionRule,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/promotion")({
  head: () => ({
    meta: [
      { title: "ترفيع الطلاب — Match Education" },
      {
        name: "description",
        content: "ترفيع الطلاب من صف إلى صف وفق شروط المدرسة، مع بيان أسباب الحجب.",
      },
    ],
  }),
  component: PromotionPage,
});

/**
 * Moving a year group up a grade.
 *
 * The screen is deliberately a review before an action: the class is evaluated,
 * every name carries its own verdict, and nothing is enrolled until someone
 * reads the list and chooses. The tool this replaces enrolled first and left
 * the checking to whoever noticed afterwards.
 */
function PromotionPage() {
  const { role } = useApp();
  const isAdmin = role === "admin";
  const canView = isAdmin || role === "secretary";

  const options = usePromotionOptions();
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const preview = usePromotionPreview({
    ...(program ? { program } : {}),
    ...(year ? { academic_year: year } : {}),
    ...(term ? { academic_term: term } : {}),
  });
  const data = preview.data;

  // The year and term the school is working in, unless the user picks others.
  useEffect(() => {
    if (!options.data) return;
    setYear((v) => v || options.data.default_year || "");
    setTerm((v) => v || options.data.default_term || "");
  }, [options.data]);

  // A different grade, year or term is a different cohort; carrying a
  // selection across would promote names the administrator never looked at.
  useEffect(() => {
    setPicked([]);
  }, [program, year, term]);

  // Eligible students are pre-selected — that is the common case — and the
  // blocked ones are left for a deliberate choice.
  useEffect(() => {
    if (data) setPicked(data.students.filter((s) => s.eligible).map((s) => s.student));
  }, [data]);

  const chosenBlocked = useMemo(
    () => (data?.students ?? []).filter((s) => picked.includes(s.student) && !s.eligible).length,
    [data, picked],
  );

  if (!canView) {
    return (
      <>
        <PageHeader title="ترفيع الطلاب" subtitle="نقل الطلاب من صف إلى صف" />
        <EmptyBlock
          title="هذه الصفحة للإدارة"
          description="ترفيع الطلاب من صلاحيات مدير المدرسة."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="ترفيع الطلاب"
        subtitle="ينتقل الطالب للصف التالي بعد استيفاء شروط المدرسة"
        actions={
          <button
            onClick={() => setShowRules(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <Settings2 className="size-4" />
            شروط الترفيع
          </button>
        }
      />

      <div className="card-surface mb-5 grid gap-3 p-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">الصف</Label>
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="اختر الصف" />
            </SelectTrigger>
            <SelectContent>
              {(options.data?.programs ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <SelectItemLabel code={p.level ? `مستوى ${p.level}` : "بلا مستوى"}>
                    {p.name}
                  </SelectItemLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">العام الدراسي</Label>
          <Select
            value={year}
            onValueChange={(v) => {
              setYear(v);
              // Terms belong to a year: keeping one from another year would
              // read a cohort that does not exist.
              setTerm("");
            }}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="اختر العام" />
            </SelectTrigger>
            <SelectContent>
              {(options.data?.years ?? []).map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">الفصل الدراسي</Label>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="اختر الفصل" />
            </SelectTrigger>
            <SelectContent>
              {(options.data?.terms ?? [])
                .filter((t) => !year || t.academic_year === year)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <SelectItemLabel code={t.academic_year}>{t.name}</SelectItemLabel>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!program || !year || !term ? (
        <EmptyBlock
          title="اختر الصف والعام والفصل"
          description="الترفيع يتم للصف كاملاً بكل شُعبه، ضمن عام وفصل محدّدين."
          icon={<ArrowUpFromLine className="size-6" />}
        />
      ) : preview.isLoading ? (
        <TableSkeleton />
      ) : !data ? (
        <EmptyBlock title="تعذّر تحميل البيانات" description="حاول مرة أخرى." />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="إجمالي الطلاب" value={data.total} />
            <Stat label="مؤهلون للترفيع" value={data.eligible_count} tone="success" />
            <Stat label="محجوبون" value={data.blocked_count} tone="danger" />
          </div>

          {data.next_program_missing ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive-soft p-3 text-xs">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>
                لم يُحدَّد الصف التالي لـ«{data.program}». اضبط «مستوى الصف» في البرامج — الصف
                التالي هو صاحب المستوى الأعلى بواحد.
              </span>
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              سينتقل الطلاب المحدَّدون من{" "}
              <span className="font-bold text-foreground">{data.program}</span> إلى{" "}
              <span className="font-bold text-primary">{data.next_program}</span>
            </p>
          )}

          <SectionCard
            title={`طلاب ${data.program}`}
            description={`${data.classes.length} شعبة — اضغط على الطالب لتحديده أو إلغاء تحديده`}
          >
            <ul className="space-y-1.5">
              {data.students.map((s) => {
                const on = picked.includes(s.student);
                return (
                  <li key={s.student}>
                    <button
                      onClick={() =>
                        setPicked((p) =>
                          on ? p.filter((x) => x !== s.student) : [...p, s.student],
                        )
                      }
                      className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-right transition-colors ${
                        on
                          ? "border-primary bg-primary-soft"
                          : "border-border hover:bg-secondary/50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                      >
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold">{s.student_name}</span>
                          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {s.class_name}
                          </span>
                          {s.eligible ? (
                            <Pill tone="success">مؤهل</Pill>
                          ) : (
                            <Pill tone="danger">محجوب</Pill>
                          )}
                        </span>
                        {s.blockers.map((b) => (
                          <span
                            key={b.check}
                            className="mt-1 flex items-start gap-1.5 text-[11px] text-muted-foreground"
                          >
                            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-destructive" />
                            <span>
                              <span className="font-semibold">{b.label}</span>
                              {b.detail ? ` — ${b.detail}` : ""}
                            </span>
                          </span>
                        ))}
                      </span>
                      {isAdmin && !s.eligible && (
                        <RepeatButton student={s.student} group={s.student_group} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          {isAdmin && (
            <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
              <span className="num text-sm font-semibold">{picked.length} محدَّد</span>
              {chosenBlocked > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="size-3.5" />
                  منهم {chosenBlocked} لا يستوفون الشروط
                </span>
              )}
              <button
                onClick={() => setConfirming(true)}
                disabled={!picked.length || data.next_program_missing}
                className="mr-auto inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowUpFromLine className="size-4" />
                ترفيع المحدَّدين
              </button>
            </div>
          )}
        </>
      )}

      {showRules && <RulesDialog onClose={() => setShowRules(false)} canEdit={isAdmin} />}

      {confirming && data && (
        <PromoteDialog
          options={options.data}
          data={data}
          students={picked}
          blockedCount={chosenBlocked}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  return (
    <div className="card-surface p-3.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`num mt-0.5 text-2xl font-black ${
          tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** Records that one student stays where they are. */
function RepeatButton({ student, group }: { student: string; group: string }) {
  const mark = useMarkRepeated();
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          const res = await mark.mutateAsync({ student, student_group: group });
          toast.success(res.message_ar || "تم تسجيل الإعادة");
        } catch (err) {
          toast.error(errorMessage(err, "تعذّر التسجيل"));
        }
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-secondary"
      title="تسجيل بقاء الطالب في نفس الصف"
    >
      <RotateCcw className="ml-1 inline size-3" />
      إعادة
    </span>
  );
}

/** The last step: what will happen, and the override if it is needed. */
function PromoteDialog({
  options,
  data,
  students,
  blockedCount,
  onClose,
}: {
  options: PromotionOptions | undefined;
  data: NonNullable<ReturnType<typeof usePromotionPreview>["data"]>;
  students: string[];
  blockedCount: number;
  onClose: () => void;
}) {
  const promote = usePromote();
  const [year, setYear] = useState("");
  const [term, setTerm] = useState("");
  const [reason, setReason] = useState("");

  // The destination is a different year from the one being promoted out of,
  // so nothing is preselected: choosing it is the decision being made.
  const termsOfYear = (options?.terms ?? []).filter((t) => !year || t.academic_year === year);

  async function submit() {
    try {
      const res = await promote.mutateAsync({
        program: data.program,
        students,
        academic_year: data.academic_year,
        academic_term: data.academic_term ?? "",
        new_academic_year: year,
        new_academic_term: term,
        ...(blockedCount > 0 ? { override: 1, override_reason: reason } : {}),
      });
      toast.success(res.message_ar || `تم ترفيع ${res.promoted_count} طالباً`);
      if (res.skipped_count) {
        toast.warning(
          `تُخطّي ${res.skipped_count}: ${res.skipped
            .slice(0, 3)
            .map((s) => `${s.student_name} (${s.reason})`)
            .join("، ")}`,
          { duration: 9000 },
        );
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الترفيع"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>ترفيع {students.length} طالباً</DialogTitle>
          <DialogDescription>
            من {data.program} إلى {data.next_program}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>العام الدراسي الجديد</Label>
            <Select
              value={year}
              onValueChange={(v) => {
                setYear(v);
                setTerm("");
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="اختر العام" />
              </SelectTrigger>
              <SelectContent>
                {(options?.years ?? []).map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>الفصل الدراسي الجديد</Label>
            <Select value={term} onValueChange={setTerm} disabled={!year}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder={year ? "اختر الفصل" : "اختر العام أولاً"} />
              </SelectTrigger>
              <SelectContent>
                {termsOfYear.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              كل تسجيل يُحفظ بعامه وفصله — بدونهما لا يمكن تمييزه لاحقاً.
            </p>
          </div>

          {blockedCount > 0 && (
            <div className="space-y-1.5 rounded-xl border border-destructive/40 bg-destructive-soft p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                <ShieldAlert className="size-4" />
                {blockedCount} من المحدَّدين لا يستوفون الشروط
              </p>
              <p className="text-[11px] text-muted-foreground">
                يمكن ترفيعهم استثناءً، ويُحفظ السبب في سجل الطالب.
              </p>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="مثال: قرار المدير — تسوية مالية موقّعة مع ولي الأمر"
                className="rounded-xl"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={promote.isPending || !year || !term || (blockedCount > 0 && !reason.trim())}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {promote.isPending ? "جارٍ الترفيع…" : "تأكيد الترفيع"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The rules themselves, with the threshold each one measures against. */
function RulesDialog({ onClose, canEdit }: { onClose: () => void; canEdit: boolean }) {
  const query = usePromotionRules();
  const save = useSavePromotionRules();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Record<string, PromotionRule>>({});

  useEffect(() => {
    if (!query.data) return;
    setDraft(Object.fromEntries(query.data.rules.map((r) => [r.key, { ...r }])));
  }, [query.data]);

  const THRESHOLD: Record<string, { field: keyof PromotionRule; label: string }> = {
    no_outstanding_fees: { field: "max_outstanding", label: "أقصى مبلغ مسموح" },
    minimum_average: { field: "min_average", label: "أدنى معدل (%)" },
    attendance_rate: { field: "min_attendance", label: "أدنى نسبة حضور (%)" },
    no_failed_subjects: { field: "max_failed", label: "أقصى عدد مواد راسب فيها" },
  };

  async function submit() {
    const ok = await confirm({
      title: "حفظ شروط الترفيع؟",
      description: "ستُطبَّق هذه الشروط على كل عمليات الترفيع القادمة.",
    });
    if (!ok) return;
    try {
      const res = await save.mutateAsync(draft);
      toast.success(res.message_ar || "تم حفظ الشروط");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-primary" />
            شروط الترفيع
          </DialogTitle>
          <DialogDescription>
            الشرط المُطفأ لا يمنع أحداً. والشرط المُشغَّل يحجب من لا يستوفيه، مع إمكانية الاستثناء
            بسبب مكتوب.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-2.5 overflow-y-auto p-1">
          {Object.values(draft).map((r) => {
            const t = THRESHOLD[r.key];
            return (
              <div key={r.key} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground">{r.help}</p>
                  </div>
                  <Switch
                    checked={Boolean(r.enabled)}
                    disabled={!canEdit}
                    onCheckedChange={(v) =>
                      setDraft((d) => ({ ...d, [r.key]: { ...r, enabled: v ? 1 : 0 } }))
                    }
                  />
                </div>
                {t && Boolean(r.enabled) && (
                  <div className="mt-2 flex items-center gap-2">
                    <Label className="text-[11px]">{t.label}</Label>
                    <Input
                      type="number"
                      value={String(r[t.field] ?? 0)}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [r.key]: { ...r, [t.field]: Number(e.target.value) || 0 },
                        }))
                      }
                      className="num h-9 w-28 rounded-xl"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إغلاق
          </button>
          {canEdit && (
            <button
              onClick={submit}
              disabled={save.isPending}
              className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {save.isPending ? "جارٍ الحفظ…" : "حفظ الشروط"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

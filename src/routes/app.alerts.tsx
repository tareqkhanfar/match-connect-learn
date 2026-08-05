import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertOctagon,
  AlertTriangle,
  Ban,
  Bell,
  CheckCircle2,
  Play,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { StudentPicker } from "@/components/shared/student-picker";
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
  useAcknowledgeAlert,
  useAlertRule,
  useAlertRules,
  useAlerts,
  useAlertsOverview,
  useDeleteAlertRule,
  usePreviewRule,
  useResolveAlert,
  useRuleOptions,
  useRunRules,
  useSaveAlertRule,
  useStudentAlertFile,
  type AlertRuleRow,
  type StudentAlert,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/alerts")({
  head: () => ({
    meta: [
      { title: "التنبيهات والإنذارات — Match Education" },
      {
        name: "description",
        content: "قواعد التنبيهات الآلية، الإنذارات، وحجب الوصول بناءً على شروط تحددها الإدارة.",
      },
    ],
  }),
  component: AlertsPage,
});

/** Colour and icon per severity — used consistently across the page. */
const SEVERITY = {
  Info: { tone: "info" as const, ring: "bg-info-soft text-info", icon: Bell },
  Warning: { tone: "warning" as const, ring: "bg-warm-soft text-warm-foreground", icon: AlertTriangle },
  Serious: { tone: "danger" as const, ring: "bg-destructive-soft text-destructive", icon: ShieldAlert },
  Critical: { tone: "danger" as const, ring: "bg-destructive text-white", icon: AlertOctagon },
};

function AlertsPage() {
  const { role } = useApp();
  return isBackOffice(role) ? <AdminAlertsView /> : <FamilyAlertsView />;
}

/* ------------------------------------------------------------------- admin */

function AdminAlertsView() {
  const overview = useAlertsOverview();
  const rules = useAlertRules();
  const run = useRunRules();
  const remove = useDeleteAlertRule();
  const confirm = useConfirm();

  const [tab, setTab] = useState<"alerts" | "rules">("alerts");
  const [editing, setEditing] = useState<AlertRuleRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [file, setFile] = useState<string | null>(null);

  async function runAll() {
    try {
      const result = await run.mutateAsync(undefined);
      toast.success(
        `تم إصدار ${result.raised} تنبيهاً، ومعالجة ${result.resolved}` +
          (result.escalated ? `، وتصعيد ${result.escalated}` : ""),
      );
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر تشغيل القواعد");
    }
  }

  async function removeRule(rule: AlertRuleRow) {
    const ok = await confirm({
      title: `حذف قاعدة «${rule.name}»؟`,
      description: "التنبيهات المفتوحة تمنع الحذف — عطّل القاعدة بدلاً من ذلك.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(rule.id);
      toast.success("تم حذف القاعدة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  if (overview.isLoading) return <DashboardSkeleton />;
  if (overview.error) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;

  const s = overview.data?.summary;

  return (
    <>
      <PageHeader
        title="التنبيهات والإنذارات"
        subtitle="حدّد القواعد، ويصدر النظام التنبيهات ويصعّدها ويحجب الوصول تلقائياً"
        actions={
          <>
            <button
              onClick={runAll}
              disabled={run.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-secondary active:translate-y-0 disabled:opacity-60"
            >
              <Play className="size-4" />
              {run.isPending ? "جارٍ الفحص…" : "تشغيل القواعد الآن"}
            </button>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="size-4" />
              قاعدة جديدة
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="تنبيهات مفتوحة" value={s?.open ?? 0} icon={Bell} tone="primary" />
        <KpiCard label="طلاب متأثرون" value={s?.students ?? 0} icon={Users} tone="info" />
        <KpiCard label="إنذارات نهائية" value={s?.critical ?? 0} icon={AlertOctagon} tone="warm" />
        <KpiCard label="محجوبون" value={s?.blocked ?? 0} icon={Ban} tone="accent" />
      </div>

      <div className="my-5 inline-flex items-center gap-1 rounded-xl bg-secondary p-1">
        {(
          [
            ["alerts", `التنبيهات (${s?.open ?? 0})`],
            ["rules", `القواعد (${rules.data?.length ?? 0})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              tab === key ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "alerts" ? (
        <>
          {/* Severity breakdown, so the worst is obvious at a glance. */}
          {(overview.data?.by_severity.length ?? 0) > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {overview.data!.by_severity.map((b) => (
                <span
                  key={b.severity}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                    SEVERITY[b.severity as keyof typeof SEVERITY]?.ring ?? "bg-secondary"
                  }`}
                >
                  <span className="text-base">{b.emoji}</span>
                  {b.label}
                  <span className="num">{b.count}</span>
                </span>
              ))}
            </div>
          )}

          <SectionCard
            title="التنبيهات المفتوحة"
            description={`${overview.data?.alerts.length ?? 0} تنبيهاً — اضغط على أي طالب لعرض ملفه`}
          >
            {(overview.data?.alerts.length ?? 0) === 0 ? (
              <EmptyBlock
                title="لا توجد تنبيهات مفتوحة"
                description="شغّل القواعد لفحص الطلاب، أو أضف قاعدة جديدة."
                icon={<CheckCircle2 className="size-6" />}
              />
            ) : (
              <ul className="divide-y divide-border">
                {overview.data!.alerts.map((a) => (
                  <AlertRow key={a.id} alert={a} onOpenFile={() => setFile(a.student)} staff />
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard title="قواعد التنبيه" description={`${rules.data?.length ?? 0} قاعدة`}>
          {rules.isLoading ? (
            <TableSkeleton rows={4} />
          ) : (rules.data?.length ?? 0) === 0 ? (
            <EmptyBlock
              title="لا توجد قواعد"
              description="أضف قاعدة — مثلاً: رسوم متأخرة أكثر من 500، أو نسبة حضور أقل من 80%."
              icon={<ShieldAlert className="size-6" />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {rules.data!.map((r) => (
                <li
                  key={r.id}
                  className="grid gap-3 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base">{r.emoji}</span>
                      <p className="truncate text-sm font-bold">{r.name}</p>
                      <Pill tone={r.enabled ? "success" : "muted"}>
                        {r.enabled ? "مفعّلة" : "معطّلة"}
                      </Pill>
                      {r.open_alerts > 0 && (
                        <Pill tone="warning">{r.open_alerts} تنبيه مفتوح</Pill>
                      )}
                    </div>
                    <p className="num mt-0.5 text-xs text-muted-foreground">
                      {r.trigger_label} {r.operator} {r.threshold}
                      {r.unit ? ` ${r.unit}` : ""}
                      {r.within_days ? ` • خلال ${r.within_days} يوم` : ""}
                      {r.last_run ? ` • آخر فحص ${r.last_run.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setEditing(r)}
                      className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => removeRule(r)}
                      aria-label="حذف"
                      className="rounded-lg bg-secondary px-2.5 py-2 text-destructive hover:bg-destructive-soft"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {(creating || editing) && (
        <RuleDialog
          rule={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {file && <StudentFileDialog student={file} onClose={() => setFile(null)} />}
    </>
  );
}

function AlertRow({
  alert: a,
  onOpenFile,
  staff,
}: {
  alert: StudentAlert;
  onOpenFile?: () => void;
  staff?: boolean;
}) {
  const meta = SEVERITY[a.severity as keyof typeof SEVERITY] ?? SEVERITY.Warning;

  return (
    <li className="grid gap-3 py-3.5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-lg ${meta.ring}`}>
        {a.emoji}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold">{a.title}</p>
          <Pill tone={meta.tone}>{a.severity_label}</Pill>
          <Pill tone="muted">{a.level_label}</Pill>
          {a.blocks_access && <Pill tone="danger">محجوب</Pill>}
          {!a.acknowledged && <Pill tone="info">لم يُطّلع عليه</Pill>}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {a.message}
        </p>
        <p className="num mt-1 text-[11px] text-muted-foreground">
          {staff ? `${a.student_name} • ` : ""}
          {a.trigger_label}: {a.measured}
          {a.unit ? ` ${a.unit}` : ""} (الحد {a.threshold}) • {a.raised_on.slice(0, 10)}
        </p>
      </div>

      {staff && onOpenFile && (
        <button
          onClick={onOpenFile}
          className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
        >
          ملف الطالب
        </button>
      )}
    </li>
  );
}

/* ------------------------------------------------------- student / parent */

function FamilyAlertsView() {
  const { role, session } = useApp();
  const children = session?.scope.children ?? [];
  const [student, setStudent] = useState(session?.scope.student ?? children[0]?.id ?? "");

  const query = useAlerts(student ? { student } : {});
  const acknowledge = useAcknowledgeAlert();

  const items = query.data?.items ?? [];
  const open = items.filter((a) => ["Open", "Acknowledged", "Escalated"].includes(a.status));
  const blocked = open.filter((a) => a.blocks_access);
  const unread = open.filter((a) => !a.acknowledged);

  async function ack(alert: StudentAlert) {
    try {
      await acknowledge.mutateAsync(alert.id);
      toast.success("تم تسجيل اطّلاعك");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التسجيل");
    }
  }

  return (
    <>
      <PageHeader
        title={role === "parent" ? "تنبيهات الأبناء" : "تنبيهاتي"}
        subtitle={
          role === "parent"
            ? "التنبيهات والإنذارات الصادرة من المدرسة بخصوص أبنائك"
            : "التنبيهات الصادرة من المدرسة بخصوصك"
        }
      />

      {/* An access block is the most consequential thing here, so it leads. */}
      {blocked.length > 0 && (
        <div className="mb-5 rounded-2xl border-2 border-destructive bg-destructive-soft p-5">
          <p className="flex items-center gap-2 text-base font-black text-destructive">
            <Ban className="size-5" />
            ⛔ تم تقييد الوصول إلى بعض الصفحات
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            يرجى مراجعة إدارة المدرسة لمعالجة الأمر واستعادة الوصول الكامل.
          </p>
        </div>
      )}

      {role === "parent" && children.length > 1 && (
        <div className="card-surface mb-5 p-4 md:max-w-md">
          <Label className="mb-1.5 block text-xs">الابن</Label>
          <SearchableSelect
            options={children.map((c) => ({ value: c.id, label: c.name }))}
            value={student}
            onChange={setStudent}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="تنبيهات مفتوحة" value={open.length} icon={Bell} tone="primary" />
        <KpiCard label="لم يُطّلع عليها" value={unread.length} icon={AlertTriangle} tone="warm" />
        <KpiCard label="صفحات محجوبة" value={blocked.length} icon={Ban} tone="accent" />
      </div>

      <div className="mt-5">
        {query.isLoading ? (
          <TableSkeleton rows={4} />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyBlock
            title="لا توجد تنبيهات 🎉"
            description="لا يوجد ما يستدعي الانتباه حالياً."
            icon={<CheckCircle2 className="size-6" />}
          />
        ) : (
          <div className="space-y-4">
            {items.map((a) => {
              const meta = SEVERITY[a.severity as keyof typeof SEVERITY] ?? SEVERITY.Warning;
              const closed = ["Resolved", "Dismissed"].includes(a.status);
              return (
                <div
                  key={a.id}
                  className={`card-surface p-5 ${closed ? "opacity-60" : ""} ${
                    a.severity === "Critical" && !closed ? "border-2 border-destructive" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`grid size-14 shrink-0 place-items-center rounded-2xl text-2xl ${meta.ring}`}
                    >
                      {a.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black">{a.title}</p>
                        <Pill tone={meta.tone}>{a.severity_label}</Pill>
                        {closed && <Pill tone="success">{a.status_label}</Pill>}
                      </div>
                      <p className="mt-2 text-sm font-medium leading-relaxed">{a.message}</p>
                      <p className="num mt-2 text-[11px] text-muted-foreground">
                        {a.student_name} • {a.raised_on.slice(0, 10)} • {a.level_label}
                      </p>

                      {!closed && !a.acknowledged && role === "parent" && (
                        <button
                          onClick={() => ack(a)}
                          disabled={acknowledge.isPending}
                          className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
                        >
                          <CheckCircle2 className="size-4" />
                          اطّلعت على التنبيه
                        </button>
                      )}
                      {a.acknowledged && !closed && (
                        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                          <CheckCircle2 className="size-3.5" />
                          تم تسجيل اطّلاعكم
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- dialogs */

function StudentFileDialog({ student, onClose }: { student: string; onClose: () => void }) {
  const { data, isLoading } = useStudentAlertFile(student);
  const resolve = useResolveAlert();
  const confirm = useConfirm();

  async function close(alert: string, dismiss: boolean) {
    const ok = await confirm({
      title: dismiss ? "إلغاء التنبيه؟" : "تأكيد معالجة التنبيه؟",
      description: dismiss
        ? "سيُلغى التنبيه ولن يظهر لولي الأمر."
        : "سيُرفع أي حجب مرتبط بهذا التنبيه.",
      tone: dismiss ? "warning" : "success",
      confirmLabel: dismiss ? "إلغاء التنبيه" : "معالجة",
    });
    if (!ok) return;
    try {
      await resolve.mutateAsync({ alert, dismiss });
      toast.success(dismiss ? "تم إلغاء التنبيه" : "تمت معالجة التنبيه");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التنفيذ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            ملف التنبيهات — {data?.student_name ?? ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <TableSkeleton rows={5} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["الإجمالي", data.summary.total],
                ["مفتوحة", data.summary.open],
                ["إنذارات", data.summary.warnings],
                ["محجوب", data.summary.blocked ? "نعم" : "لا"],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-border p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="num mt-1 text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>

            {data.blocked_pages.length > 0 && (
              <p className="rounded-xl bg-destructive-soft px-3 py-2 text-xs text-destructive">
                ⛔ محجوب عن: {data.blocked_pages.join("، ")}
              </p>
            )}

            {data.alerts.length === 0 ? (
              <EmptyBlock title="لا توجد تنبيهات على هذا الطالب" />
            ) : (
              <ul className="divide-y divide-border">
                {data.alerts.map((a) => {
                  const closed = ["Resolved", "Dismissed"].includes(a.status);
                  return (
                    <li key={a.id} className={`py-3 ${closed ? "opacity-60" : ""}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{a.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{a.title}</p>
                            <Pill tone="muted">{a.status_label}</Pill>
                            <Pill tone="muted">{a.level_label}</Pill>
                          </div>
                          <p className="num mt-0.5 text-[11px] text-muted-foreground">
                            {a.raised_on.slice(0, 10)}
                            {a.acknowledged ? " • اطّلع ولي الأمر" : ""}
                          </p>
                        </div>
                        {!closed && (
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              onClick={() => close(a.id, false)}
                              className="rounded-lg bg-success-soft px-2.5 py-1 text-xs font-semibold text-success"
                            >
                              معالجة
                            </button>
                            <button
                              onClick={() => close(a.id, true)}
                              className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                            >
                              إلغاء
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
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

interface DraftAction {
  action_type: string;
  notify_roles: string;
  escalate_after_days: number;
  block_pages: string[];
}

function RuleDialog({ rule, onClose }: { rule: AlertRuleRow | null; onClose: () => void }) {
  const options = useRuleOptions();
  const save = useSaveAlertRule();
  const preview = usePreviewRule();

  const [form, setForm] = useState({
    rule_name: rule?.name ?? "",
    trigger: rule?.trigger ?? "Fee Overdue Amount",
    operator: rule?.operator ?? ">=",
    threshold: String(rule?.threshold ?? 0),
    within_days: String(rule?.within_days ?? 0),
    severity: rule?.severity ?? "Warning",
    emoji: rule?.emoji ?? "⚠️",
    applies_to: rule?.applies_to ?? "All",
    program: rule?.program ?? "",
    student_group: rule?.student_group ?? "",
    title: rule?.title ?? "",
    message: rule?.message ?? "",
  });
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [actions, setActions] = useState<DraftAction[]>([
    { action_type: "Notify", notify_roles: "student,parent", escalate_after_days: 7, block_pages: [] },
  ]);

  // Load the saved actions when editing.
  const detail = useAlertRule(rule?.id);
  useEffect(() => {
    if (!detail.data?.actions?.length) return;
    setActions(
      detail.data.actions.map((a) => ({
        action_type: a.action_type,
        notify_roles: a.notify_roles || "student,parent",
        escalate_after_days: a.escalate_after_days,
        block_pages: (a.block_pages || "").split(",").filter(Boolean),
      })),
    );
  }, [detail.data]);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const trigger = options.data?.triggers.find((t) => t.code === form.trigger);

  async function runPreview() {
    try {
      await preview.mutateAsync({
        trigger: form.trigger,
        operator: form.operator,
        threshold: Number(form.threshold) || 0,
        within_days: Number(form.within_days) || 0,
        applies_to: form.applies_to,
        program: form.program,
        student_group: form.student_group,
      });
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الفحص");
    }
  }

  async function submit() {
    if (!form.rule_name.trim() || !form.title.trim() || !form.message.trim()) {
      toast.error("اسم القاعدة وعنوان الرسالة ونصها مطلوبة");
      return;
    }
    try {
      await save.mutateAsync({
        ...(rule ? { id: rule.id } : {}),
        ...form,
        threshold: Number(form.threshold) || 0,
        within_days: Number(form.within_days) || 0,
        enabled: enabled ? 1 : 0,
        actions: actions.map((a) => ({ ...a, block_pages: a.block_pages.join(",") })),
      });
      toast.success(rule ? "تم تحديث القاعدة" : "تم إنشاء القاعدة");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {rule ? "تعديل القاعدة" : "قاعدة تنبيه جديدة"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>اسم القاعدة</Label>
            <Input
              value={form.rule_name}
              onChange={(e) => set("rule_name", e.target.value)}
              placeholder="مثال: تأخر سداد الرسوم"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>الشرط</Label>
            <SearchableSelect
              options={(options.data?.triggers ?? []).map((t) => ({
                value: t.code,
                label: t.label,
                hint: t.group,
              }))}
              value={form.trigger}
              onChange={(v) => set("trigger", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>المُقارنة</Label>
            <SearchableSelect
              options={(options.data?.operators ?? []).map((o) => ({
                value: o.code,
                label: o.label,
              }))}
              value={form.operator}
              onChange={(v) => set("operator", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>القيمة {trigger?.unit ? `(${trigger.unit})` : ""}</Label>
            <Input
              type="number"
              value={form.threshold}
              onChange={(e) => set("threshold", e.target.value)}
              className="num rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>خلال آخر (يوم) — اتركه صفراً للكل</Label>
            <Input
              type="number"
              min={0}
              value={form.within_days}
              onChange={(e) => set("within_days", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الخطورة</Label>
            <SearchableSelect
              options={(options.data?.severities ?? []).map((s) => ({
                value: s.code,
                label: `${s.emoji} ${s.label}`,
              }))}
              value={form.severity}
              onChange={(v) => {
                set("severity", v);
                const found = options.data?.severities.find((s) => s.code === v);
                if (found) set("emoji", found.emoji);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>يُطبَّق على</Label>
            <SearchableSelect
              options={[
                { value: "All", label: "كل الطلاب" },
                { value: "Program", label: "صف محدد" },
                { value: "Student Group", label: "شعبة محددة" },
              ]}
              value={form.applies_to}
              onChange={(v) => set("applies_to", v)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runPreview}
              disabled={preview.isPending}
              className="h-10 w-full rounded-xl border border-border text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {preview.isPending ? "جارٍ الفحص…" : "كم طالباً سينطبق عليه؟"}
            </button>
          </div>

          {form.applies_to === "Program" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الصف</Label>
              <SearchableSelect
                options={(options.data?.programs ?? []).map((p) => ({ value: p, label: p }))}
                value={form.program}
                onChange={(v) => set("program", v)}
              />
            </div>
          )}
          {form.applies_to === "Student Group" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الشعبة</Label>
              <SearchableSelect
                options={(options.data?.groups ?? []).map((g) => ({ value: g.id, label: g.name }))}
                value={form.student_group}
                onChange={(v) => set("student_group", v)}
              />
            </div>
          )}
        </div>

        {/* Impact preview, so a threshold is not guessed blind. */}
        {preview.data && (
          <div className="rounded-xl border border-info/30 bg-info-soft p-3">
            <p className="text-sm font-bold">
              ينطبق على <span className="num">{preview.data.matched}</span> طالباً من{" "}
              <span className="num">{preview.data.scope}</span>
            </p>
            {preview.data.sample.length > 0 && (
              <p className="num mt-1 text-[11px] text-muted-foreground">
                مثال: {preview.data.sample.slice(0, 3).map((s) => `${s.name} (${s.value})`).join("، ")}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>عنوان الرسالة</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="تنبيه: رسوم متأخرة {value}"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>نص الرسالة لولي الأمر</Label>
            <textarea
              rows={3}
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder="يوجد مبلغ متأخر قدره {value}. يرجى التوجه إلى قسم المالية."
              className="w-full rounded-xl border border-border bg-card p-3 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              استخدم <span className="num">{"{value}"}</span> للقيمة الفعلية و{" "}
              <span className="num">{"{threshold}"}</span> للحد المحدد.
            </p>
          </div>
        </div>

        {/* Escalation ladder. */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>سُلّم الإجراءات ({actions.length})</Label>
            <button
              onClick={() =>
                setActions((a) => [
                  ...a,
                  {
                    action_type: "Warning",
                    notify_roles: "student,parent",
                    escalate_after_days: 7,
                    block_pages: [],
                  },
                ])
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
            >
              <Plus className="size-3.5" />
              إجراء
            </button>
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            المخالفة الأولى تأخذ الإجراء الأول، والتكرار يصعّد للإجراء التالي.
          </p>

          <ul className="space-y-2">
            {actions.map((a, i) => (
              <li key={i} className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="num text-xs font-bold text-muted-foreground">
                    المستوى {i + 1}
                  </span>
                  {actions.length > 1 && (
                    <button
                      onClick={() => setActions((cur) => cur.filter((_, idx) => idx !== i))}
                      aria-label="حذف"
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <SearchableSelect
                    options={(options.data?.levels ?? []).map((l) => ({
                      value: l.code,
                      label: l.label,
                    }))}
                    value={a.action_type}
                    onChange={(v) =>
                      setActions((cur) =>
                        cur.map((x, idx) => (idx === i ? { ...x, action_type: v } : x)),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    value={a.escalate_after_days}
                    onChange={(e) =>
                      setActions((cur) =>
                        cur.map((x, idx) =>
                          idx === i
                            ? { ...x, escalate_after_days: Number(e.target.value) || 0 }
                            : x,
                        ),
                      )
                    }
                    placeholder="التصعيد بعد (يوم)"
                    className="num h-10 rounded-xl"
                  />
                </div>

                {a.action_type === "Block Access" && (
                  <div className="mt-2">
                    <Label className="mb-1.5 block text-[11px]">الصفحات المحجوبة</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(options.data?.pages ?? []).map((p) => {
                        const on = a.block_pages.includes(p.path);
                        return (
                          <button
                            key={p.path}
                            onClick={() =>
                              setActions((cur) =>
                                cur.map((x, idx) =>
                                  idx === i
                                    ? {
                                        ...x,
                                        block_pages: on
                                          ? x.block_pages.filter((y) => y !== p.path)
                                          : [...x.block_pages, p.path],
                                      }
                                    : x,
                                ),
                              )
                            }
                            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                              on ? "bg-destructive text-white" : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-medium">تفعيل القاعدة</p>
            <p className="text-[11px] text-muted-foreground">
              القواعد المفعّلة تُفحص تلقائياً كل ليلة.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ القاعدة"}
          </button>
          <button onClick={onClose} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold">
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Clock,
  LogIn,
  LogOut,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { useApp } from "@/lib/app-context";
import {
  useActiveSessions,
  useFailedLoginReport,
  useRevokeOtherSessions,
  useSignInHistory,
  type ActiveSession,
  type SignInEntry,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/security")({
  component: SecurityPage,
});

const DT = new Intl.DateTimeFormat("ar", {
  dateStyle: "medium",
  timeStyle: "short",
});

function when(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? "—" : DT.format(d);
}

/** "قبل ٣ ساعات" — relative time reads faster than a timestamp for recency. */
function ago(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.max((Date.now() - d.getTime()) / 1000, 0);
  if (secs < 60) return "الآن";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `قبل ${days} يوم`;
}

function SessionRow({ s }: { s: ActiveSession }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary">
          <MonitorSmartphone className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-semibold">
            {s.device.labelAr}
            {s.isCurrent && <Pill tone="success">هذا الجهاز</Pill>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {s.ip || "—"} · آخر نشاط {ago(s.lastActive) || when(s.lastActive)}
          </p>
        </div>
      </div>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">#{s.ref}</span>
    </div>
  );
}

function HistoryRow({ h }: { h: SignInEntry }) {
  const isLogout = h.operation === "Logout";
  const tone = isLogout ? "text-muted-foreground" : h.success ? "text-emerald-600" : "text-red-600";
  const Icon = isLogout ? LogOut : h.success ? LogIn : ShieldAlert;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className={`size-4 shrink-0 ${tone}`} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {isLogout ? "تسجيل خروج" : h.success ? "تسجيل دخول ناجح" : "محاولة دخول فاشلة"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{h.ip || "—"}</p>
        </div>
      </div>
      <div className="shrink-0 text-left">
        <p className="text-xs font-medium">{ago(h.at)}</p>
        <p className="text-[11px] text-muted-foreground">{when(h.at)}</p>
      </div>
    </div>
  );
}

function SecurityPage() {
  const { role } = useApp();
  const history = useSignInHistory();
  const sessions = useActiveSessions();
  const revoke = useRevokeOtherSessions();
  const confirm = useConfirm();

  const isBackOffice = role === "admin" || role === "secretary";
  const [days] = useState(7);
  const failed = useFailedLoginReport(days);

  const otherCount = (sessions.data?.sessions ?? []).filter((s) => !s.isCurrent).length;

  async function endOtherSessions() {
    const ok = await confirm({
      title: "إنهاء الجلسات الأخرى؟",
      description: `سيتم تسجيل الخروج من ${otherCount} جهاز آخر. لن يتأثر جهازك الحالي.`,
    });
    if (!ok) return;
    try {
      const res = await revoke.mutateAsync();
      toast.success(`تم إنهاء ${res.revoked} جلسة.`);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إنهاء الجلسات");
    }
  }

  const last = history.data?.lastSignIn;
  const failedCount = history.data?.failedAttempts ?? 0;

  return (
    <>
      <PageHeader
        title="أمان الحساب"
        subtitle="آخر عمليات الدخول، الأجهزة المتصلة، وحالة الجلسة."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="آخر دخول سابق" value={last ? ago(last.at) : "—"} icon={Clock} tone="info" />
        <KpiCard label="من عنوان" value={last?.ip || "—"} icon={ShieldCheck} tone="accent" />
        <KpiCard
          label="الأجهزة المتصلة"
          value={sessions.data?.total ?? 0}
          icon={MonitorSmartphone}
          tone="warm"
        />
        <KpiCard
          label="محاولات فاشلة أخيرة"
          value={failedCount}
          icon={failedCount > 0 ? ShieldAlert : ShieldCheck}
          tone={failedCount > 0 ? "warm" : "accent"}
        />
      </div>

      {failedCount > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-700">
              يوجد {failedCount} محاولة دخول فاشلة على حسابك مؤخراً.
            </p>
            <p className="text-amber-700/80">
              إذا لم تكن أنت، غيّر كلمة المرور فوراً وأنهِ الجلسات الأخرى.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="الأجهزة المتصلة حالياً"
          actions={
            otherCount > 0 ? (
              <button
                onClick={endOtherSessions}
                disabled={revoke.isPending}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {revoke.isPending ? "جارٍ الإنهاء..." : "إنهاء الجلسات الأخرى"}
              </button>
            ) : null
          }
        >
          {sessions.error ? (
            <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
          ) : sessions.isLoading ? (
            <TableSkeleton rows={3} />
          ) : (sessions.data?.sessions ?? []).length === 0 ? (
            <EmptyBlock title="لا توجد جلسات" icon={<MonitorSmartphone className="size-6" />} />
          ) : (
            <div className="grid gap-2">
              {sessions.data!.sessions.map((s) => (
                <SessionRow key={s.ref + String(s.lastActive)} s={s} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="سجل الدخول">
          {history.error ? (
            <ErrorState error={history.error} onRetry={() => history.refetch()} />
          ) : history.isLoading ? (
            <TableSkeleton rows={5} />
          ) : (history.data?.history ?? []).length === 0 ? (
            <EmptyBlock title="لا يوجد سجل" icon={<LogIn className="size-6" />} />
          ) : (
            <div className="max-h-[420px] overflow-y-auto pr-1">
              {history.data!.history.map((h) => (
                <HistoryRow key={h.id} h={h} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {isBackOffice && (
        <div className="mt-6">
          <SectionCard title={`محاولات الدخول الفاشلة على مستوى المدرسة (آخر ${days} أيام)`}>
            {failed.error ? (
              <ErrorState error={failed.error} onRetry={() => failed.refetch()} />
            ) : failed.isLoading ? (
              <TableSkeleton rows={4} />
            ) : (failed.data?.entries ?? []).length === 0 ? (
              <EmptyBlock
                title="لا توجد محاولات فاشلة"
                description="لم تُسجَّل أي محاولة دخول فاشلة خلال هذه الفترة."
                icon={<ShieldCheck className="size-6" />}
              />
            ) : (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <KpiCard
                    label="إجمالي المحاولات"
                    value={failed.data!.totalAttempts}
                    icon={Siren}
                    tone="warm"
                  />
                  <KpiCard
                    label="حسابات مستهدفة"
                    value={failed.data!.distinctAccounts}
                    icon={ShieldAlert}
                    tone="primary"
                  />
                  <KpiCard
                    label="عناوين مختلفة"
                    value={failed.data!.distinctIps}
                    icon={MonitorSmartphone}
                    tone="info"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-right text-xs text-muted-foreground">
                        <th className="py-2 font-medium">الحساب</th>
                        <th className="py-2 font-medium">عنوان IP</th>
                        <th className="py-2 font-medium">المحاولات</th>
                        <th className="py-2 font-medium">آخر محاولة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failed.data!.entries.map((e, i) => (
                        <tr key={`${e.user}-${e.ip}-${i}`} className="border-b border-border/60">
                          <td className="py-2 font-medium">{e.user}</td>
                          <td className="py-2 font-mono text-xs">{e.ip || "—"}</td>
                          <td className="py-2">
                            <Pill tone={e.attempts >= 5 ? "danger" : "warning"}>{e.attempts}</Pill>
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {when(e.lastAttempt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Ban, Info, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import { useAcknowledgeAlert, useMyAlerts, type MyAlert } from "@/lib/api/hooks";

/**
 * The warning a student or parent has not yet seen, shown on arrival.
 *
 * A warning that waits quietly on a page nobody visits is not a warning. The
 * escalation ladder — notify, warn, final warning, block — only works if each
 * step actually reaches the family, so the unacknowledged one interrupts once
 * and then stops: acknowledging records that they read it and keeps it on the
 * student's file without nagging them on every page load.
 *
 * The most serious alert is shown first; the server does that ranking.
 */
const TONE: Record<string, { ring: string; badge: string; Icon: typeof Info }> = {
  Info: {
    ring: "border-info/40",
    badge: "bg-info-soft text-info",
    Icon: Info,
  },
  Warning: {
    ring: "border-warning/50",
    badge: "bg-warm-soft text-warm-foreground",
    Icon: AlertTriangle,
  },
  Serious: {
    ring: "border-destructive/50",
    badge: "bg-destructive-soft text-destructive",
    Icon: ShieldAlert,
  },
  Critical: {
    ring: "border-destructive",
    badge: "bg-destructive text-destructive-foreground",
    Icon: Ban,
  },
};

export function AlertPopup() {
  const { data } = useMyAlerts();
  const acknowledge = useAcknowledgeAlert();
  // Dismissed in this session even if acknowledging fails, so a network
  // problem cannot trap someone behind a dialog they cannot close.
  const [seen, setSeen] = useState<string[]>([]);

  const pending = (data?.alerts ?? []).filter((a) => !seen.includes(a.name));
  const alert: MyAlert | undefined = pending[0];
  if (!alert) return null;

  const tone = TONE[alert.severity] ?? TONE["Warning"]!;
  const { Icon } = tone;

  async function confirm() {
    if (!alert) return;
    setSeen((s) => [...s, alert.name]);
    try {
      await acknowledge.mutateAsync(alert.name);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تسجيل الاطّلاع"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && confirm()}>
      <DialogContent className={`sm:max-w-md border-2 ${tone.ring}`} dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5" />
            <span>{alert.title_ar}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-lg px-2 py-1 text-xs font-bold ${tone.badge}`}>
              {alert.emoji} {alert.severity_label}
            </span>
            <span className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold">
              {alert.level_label}
            </span>
            {/* A parent with several children needs to know which one. */}
            {alert.student_name && (
              <span className="text-xs text-muted-foreground">{alert.student_name}</span>
            )}
          </div>

          <p className="text-sm leading-relaxed">{alert.message_ar}</p>

          {alert.blocks_access === 1 && alert.pages.length > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive-soft p-3">
              <p className="text-xs font-bold text-destructive">
                الصفحات المحجوبة حتى معالجة الأمر:
              </p>
              <p className="mt-1 text-xs text-destructive/90">{alert.pages.join("، ")}</p>
            </div>
          )}

          {pending.length > 1 && (
            <p className="text-[11px] text-muted-foreground">
              ولديك {pending.length - 1} تنبيه آخر بعد هذا.
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={confirm}
            disabled={acknowledge.isPending}
            className="h-11 w-full rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {acknowledge.isPending ? "جارٍ…" : "اطّلعت على التنبيه"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

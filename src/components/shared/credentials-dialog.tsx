import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Printer, ShieldAlert, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadRegistrationSlip } from "@/lib/api/export";
import type { Credentials } from "@/lib/api/hooks";

/**
 * Shows the logins created for a family, once.
 *
 * The password exists in readable form only in the response that created the
 * account — it is never stored, so this dialog is the single opportunity to
 * copy or print it. That is stated plainly rather than left for the registrar
 * to discover after closing the window.
 */
export function CredentialsDialog({
  title = "بيانات الدخول",
  student,
  applicant,
  credentials,
  guardians = [],
  printFormat,
  onClose,
}: {
  title?: string;
  student?: string;
  applicant?: string;
  credentials: Credentials | null;
  guardians?: Credentials[];
  /** Blank uses the doctype default set in the ERPNext desk. */
  printFormat?: string;
  onClose: () => void;
}) {
  const [printing, setPrinting] = useState(false);

  const all = [
    ...(credentials ? [{ ...credentials, role: "الطالب" }] : []),
    ...guardians.filter(Boolean).map((g) => ({ ...g, role: "ولي الأمر" })),
  ];

  async function print() {
    setPrinting(true);
    try {
      await downloadRegistrationSlip({
        ...(student ? { student } : {}),
        ...(applicant ? { applicant } : {}),
        ...(credentials ? { credentials } : {}),
        ...(guardians.length ? { guardians } : {}),
        ...(printFormat ? { printFormat } : {}),
      });
      toast.success("تم تجهيز إشعار التسجيل");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّرت الطباعة");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {all.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد بيانات دخول لعرضها.</p>
          ) : (
            all.map((c) => <CredentialCard key={c.user} entry={c} />)
          )}

          <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warm-soft p-3 text-xs text-warm-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p className="leading-relaxed">
              احتفظ بهذه البيانات الآن — لن تتمكن المدرسة من عرض كلمة المرور مرة أخرى بعد إغلاق
              هذه النافذة. عند فقدانها يمكن إصدار كلمة مرور جديدة.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={print}
            disabled={printing || all.length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
          >
            <Printer className="size-4" />
            {printing ? "جارٍ التجهيز…" : "طباعة إشعار التسجيل"}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialCard({ entry }: { entry: Credentials & { role?: string } }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <User className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{entry.name || entry.username}</p>
          {entry.role && <p className="text-[11px] text-muted-foreground">{entry.role}</p>}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="اسم المستخدم" value={entry.username} />
        <Field label="كلمة المرور" value={entry.password} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return (
      <div className="rounded-xl bg-secondary/60 p-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">— غير متاح —</p>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("تعذّر النسخ");
    }
  }

  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="num min-w-0 flex-1 truncate text-sm font-bold tracking-wide">{value}</code>
        <button
          onClick={copy}
          aria-label={`نسخ ${label}`}
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

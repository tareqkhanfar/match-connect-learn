import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, RotateCcw, ShieldAlert, UserPlus } from "lucide-react";
import { SectionCard, Pill } from "@/components/shared/ui-kit";
import { useConfirm } from "@/components/shared/confirm";
import {
  useIssueAccount,
  usePersonAccount,
  useResetAccountPassword,
  type IssuedCredentials,
} from "@/lib/api/hooks";

const DT = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

function when(value: string): string {
  if (!value) return "لم يسجّل دخول بعد";
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : DT.format(d);
}

/**
 * The login on a person's record: what it is, and how to reset it.
 *
 * A password is readable exactly once — at the moment it is issued. There is
 * no "show password" here because the system genuinely cannot recover one; a
 * school that has lost it resets, which is also the honest answer to give a
 * parent asking for theirs.
 */
export function AccountCredentials({
  doctype,
  name,
  canManage,
}: {
  doctype: "Student" | "Instructor" | "Guardian" | "MS Staff Member";
  name: string;
  canManage: boolean;
}) {
  const query = usePersonAccount(doctype, name);
  const issue = useIssueAccount();
  const reset = useResetAccountPassword();
  const confirm = useConfirm();

  // Held only in this component's state, and only until the page is left.
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  const data = query.data;
  const account = data?.account;

  async function copy() {
    if (!issued) return;
    const text = `اسم المستخدم: ${issued.username}\nكلمة المرور: ${issued.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("تم النسخ");
    } catch {
      toast.error("تعذّر النسخ — انسخ البيانات يدوياً");
    }
  }

  async function createAccount() {
    try {
      const res = await issue.mutateAsync({ doctype, name });
      setIssued(res.credentials);
      toast.success(res.message_ar || "تم إنشاء الحساب");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إنشاء الحساب");
    }
  }

  async function resetPassword() {
    const ok = await confirm({
      title: "إعادة تعيين كلمة المرور؟",
      description: "ستتوقف كلمة المرور الحالية عن العمل فوراً، وستظهر الجديدة مرة واحدة فقط.",
    });
    if (!ok) return;
    try {
      const res = await reset.mutateAsync({ doctype, name });
      setIssued(res.credentials);
      toast.success(res.message_ar || "تم إنشاء كلمة مرور جديدة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إعادة التعيين");
    }
  }

  if (query.isLoading) return null;

  return (
    <SectionCard
      title="بيانات الدخول"
      actions={
        canManage ? (
          data?.hasAccount ? (
            <button
              onClick={resetPassword}
              disabled={reset.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              {reset.isPending ? "جارٍ…" : "إعادة تعيين كلمة المرور"}
            </button>
          ) : (
            <button
              onClick={createAccount}
              disabled={issue.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              <UserPlus className="size-3.5" />
              {issue.isPending ? "جارٍ…" : "إنشاء حساب دخول"}
            </button>
          )
        ) : null
      }
    >
      {/* The one moment the password is readable. */}
      {issued && (
        <div className="mb-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
            <KeyRound className="size-4" />
            بيانات الدخول — انسخها الآن
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-700">
            كلمة المرور لن تظهر مرة أخرى. إن فُقدت، أعد تعيينها من هنا.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/30 bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground">اسم المستخدم</p>
              <p className="font-mono text-base font-bold" dir="ltr">
                {issued.username}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-card p-2.5">
              <p className="text-[11px] text-muted-foreground">كلمة المرور</p>
              <p className="font-mono text-base font-bold" dir="ltr">
                {issued.password}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-emerald-500/10"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "تم النسخ" : "نسخ البيانات"}
            </button>
            <button
              onClick={() => setIssued(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              إخفاء
            </button>
          </div>
        </div>
      )}

      {!data?.hasAccount ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          {canManage
            ? "لا يوجد حساب دخول — أنشئ حساباً ليتمكن من استخدام النظام."
            : "لا يوجد حساب دخول."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-muted-foreground">اسم المستخدم</p>
            <p className="mt-0.5 font-mono text-sm font-bold" dir="ltr">
              {account?.username}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">آخر دخول</p>
            <p className="mt-0.5 text-sm">{when(account?.lastLogin ?? "")}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">الحالة</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Pill tone={account?.enabled ? "success" : "muted"}>
                {account?.enabled ? "مفعّل" : "معطّل"}
              </Pill>
              {account?.mustChange && (
                <Pill tone="warning">
                  <ShieldAlert className="ml-1 inline size-3" />
                  سيغيّر كلمة المرور
                </Pill>
              )}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

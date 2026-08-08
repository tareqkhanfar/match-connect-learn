import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api/error-message";
import { useChangePassword, useSession } from "@/lib/api/hooks";

/**
 * Makes a first-time user replace the password printed on their slip.
 *
 * Deliberately not dismissible: the printed credential is the thing being
 * retired, so letting it be skipped would leave it working indefinitely. The
 * dialog is rendered inside the app shell, so the user is signed in and can
 * still sign out from the header if they would rather not continue.
 */
export function ForcePasswordChange() {
  const session = useSession();
  const change = useChangePassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const required = Boolean(session.data?.mustChangePassword);
  if (!required) return null;

  async function submit() {
    if (next.length < 8) {
      toast.error("كلمة المرور الجديدة يجب أن تكون ٨ أحرف على الأقل");
      return;
    }
    if (next !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    if (next === current) {
      toast.error("اختر كلمة مرور مختلفة عن الحالية");
      return;
    }

    try {
      await change.mutateAsync({ current_password: current, new_password: next });
      toast.success("تم تغيير كلمة المرور");
      // The session carries the flag, so refetching is what dismisses this.
      await session.refetch();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تغيير كلمة المرور"));
    }
  }

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md"
        dir="rtl"
        // No close button and no dismiss on outside click or Escape.
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            غيّر كلمة المرور للمتابعة
          </DialogTitle>
        </DialogHeader>

        <p className="flex items-start gap-2 rounded-xl bg-info-soft p-3 text-xs leading-relaxed text-info">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          كلمة المرور الحالية صادرة من المدرسة ومطبوعة على إشعار التسجيل. اختر كلمة مرور خاصة بك
          لحماية حسابك.
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>كلمة المرور الحالية</Label>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>كلمة المرور الجديدة</Label>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground">٨ أحرف على الأقل.</p>
          </div>
          <div className="space-y-1.5">
            <Label>تأكيد كلمة المرور</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={change.isPending || !current || !next || !confirm}
          className="h-11 w-full rounded-xl bg-brand-gradient text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
        >
          {change.isPending ? "جارٍ الحفظ…" : "حفظ والمتابعة"}
        </button>
      </DialogContent>
    </Dialog>
  );
}

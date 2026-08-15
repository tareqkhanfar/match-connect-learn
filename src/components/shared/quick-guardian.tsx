import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveGuardian } from "@/lib/api/hooks";

/**
 * A guardian created from inside the student form.
 *
 * Deliberately the few fields that identify a person, not the full guardian
 * record: the point is to get past "this parent is not on file yet" without
 * abandoning the student being entered. The rest is filled in later on the
 * guardian's own page.
 */
export function QuickGuardianDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", occupation: "" });
  const saveGuardian = useSaveGuardian();

  async function submit() {
    if (!form.name.trim()) {
      toast.error("اسم ولي الأمر مطلوب");
      return;
    }
    try {
      const res = await saveGuardian.mutateAsync(form);
      toast.success("تم إنشاء ولي الأمر وربطه");
      onCreated(res.id);
    } catch (error) {
      toast.error(
        (error as { messageAr?: string }).messageAr ||
          (error as Error).message ||
          "تعذّر إنشاء ولي الأمر",
      );
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            ولي أمر جديد
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>الاسم *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الجوال</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="num rounded-xl"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>البريد الإلكتروني</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded-xl"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المهنة</Label>
            <Input
              value={form.occupation}
              onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
              className="rounded-xl"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={saveGuardian.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saveGuardian.isPending ? "جارٍ…" : "إنشاء وربط"}
          </button>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

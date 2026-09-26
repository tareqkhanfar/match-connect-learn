import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Phone, Plus, Search, UserCog } from "lucide-react";
import { Avatar, PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { IssueAccountsDialog } from "@/components/shared/issue-accounts-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import { useSaveStaff, useStaffList, type StaffMember } from "@/lib/api/hooks";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app/secretaries/")({
  head: () => ({
    meta: [
      { title: "السكرتارية — Match Education" },
      { name: "description", content: "ملفات السكرتارية وحساباتهم." },
    ],
  }),
  component: SecretariesPage,
});

function SecretariesPage() {
  const { role } = useApp();
  const [q, setQ] = useState("");
  const { data, isLoading, error, refetch } = useStaffList();
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [issuing, setIssuing] = useState(false);

  if (role !== "admin")
    return (
      <EmptyBlock title="غير متاح" description="ملفات السكرتارية يطّلع عليها مدير المدرسة فقط." />
    );

  const staff = (data?.staff ?? []).filter(
    (s) => !q.trim() || s.fullName.includes(q.trim()) || s.phone.includes(q.trim()),
  );

  return (
    <>
      <PageHeader
        title="السكرتارية"
        subtitle={`${data?.staff.length ?? 0} من طاقم المكتب — ملفاتهم وحسابات دخولهم`}
        actions={
          <>
            <button
              onClick={() => setIssuing(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold transition-colors hover:bg-secondary"
            >
              <KeyRound className="size-4" />
              إصدار حسابات
            </button>
            <button
              onClick={() => setEditing("new")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
            >
              <Plus className="size-4" />
              إضافة سكرتير/ة
            </button>
          </>
        }
      />

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم أو الهاتف..."
          className="h-11 rounded-xl bg-card pr-9"
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={4} />
      ) : staff.length === 0 ? (
        <EmptyBlock
          title="لا يوجد سكرتارية"
          description="أضف أول ملف من زر «إضافة سكرتير/ة»."
          icon={<UserCog className="size-6" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <Link
              key={s.id}
              to="/app/secretaries/$staffId"
              params={{ staffId: s.id }}
              className="card-surface block p-5 transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="flex items-start gap-3">
                <Avatar name={s.fullName} src={s.image} className="size-12 rounded-2xl text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.jobTitle || "—"}</p>
                </div>
                <Pill tone={s.status === "Active" ? "success" : "muted"}>
                  {s.status === "Active" ? "نشِط" : "غير نشِط"}
                </Pill>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                {s.phone && (
                  <p className="num flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    {s.phone}
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <KeyRound className="size-3.5" />
                  {s.account ? (
                    <span className="num" dir="ltr">
                      {s.account.username}
                    </span>
                  ) : (
                    <span className="font-semibold text-warning">بلا حساب دخول</span>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {editing && (
        <StaffDialog staff={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      {issuing && (
        <IssueAccountsDialog doctype="MS Staff Member" onClose={() => setIssuing(false)} />
      )}
    </>
  );
}

/** Add or edit a secretary's file; a new one can get its login straight away. */
export function StaffDialog({
  staff,
  onClose,
}: {
  staff: StaffMember | null;
  onClose: () => void;
}) {
  const save = useSaveStaff();
  const [form, setForm] = useState({
    fullName: staff?.fullName ?? "",
    jobTitle: staff?.jobTitle ?? "سكرتير/ة",
    status: staff?.status ?? ("Active" as StaffMember["status"]),
    gender: staff?.gender ?? "",
    dateOfBirth: staff?.dateOfBirth ?? "",
    nationalId: staff?.nationalId ?? "",
    phone: staff?.phone ?? "",
    email: staff?.email ?? "",
    joiningDate: staff?.joiningDate ?? "",
    qualification: staff?.qualification ?? "",
    address: staff?.address ?? "",
    notes: staff?.notes ?? "",
  });
  const [createAccount, setCreateAccount] = useState(true);
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    try {
      const res = await save.mutateAsync({
        ...(staff ? { id: staff.id } : {}),
        ...form,
        ...(staff ? {} : { createAccount: createAccount ? 1 : 0 }),
      });
      toast.success(res.message_ar || "تم الحفظ");
      if (res.credentials) setIssued(res.credentials);
      else onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  const field = (k: keyof typeof form, label: string, type = "text", dir?: "ltr") => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        className="rounded-xl"
        {...(dir ? { dir } : {})}
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{staff ? "تعديل ملف" : "سكرتير/ة جديد"}</DialogTitle>
          <DialogDescription>بيانات الملف الشخصي — تظهر لمدير المدرسة فقط.</DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="space-y-3 rounded-xl border border-success/40 bg-success-soft/40 p-4 text-sm">
            <p className="font-bold">تم إنشاء حساب الدخول — انسخه الآن، لن يظهر مرة أخرى:</p>
            <p>
              اسم المستخدم:{" "}
              <b className="num font-mono" dir="ltr">
                {issued.username}
              </b>
            </p>
            <p>
              كلمة المرور:{" "}
              <b className="num font-mono" dir="ltr">
                {issued.password}
              </b>
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {field("fullName", "الاسم الكامل")}
            {field("jobTitle", "المسمى الوظيفي")}
            <div className="space-y-1.5">
              <Label>الجنس</Label>
              <select
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
              >
                <option value="">—</option>
                <option value="Male">ذكر</option>
                <option value="Female">أنثى</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
              >
                <option value="Active">نشِط</option>
                <option value="Inactive">غير نشِط (يُعطَّل حساب الدخول)</option>
              </select>
            </div>
            {field("phone", "الهاتف", "tel", "ltr")}
            {field("email", "البريد الإلكتروني", "email", "ltr")}
            {field("nationalId", "رقم الهوية", "text", "ltr")}
            {field("dateOfBirth", "تاريخ الميلاد", "date")}
            {field("joiningDate", "تاريخ التعيين", "date")}
            {field("qualification", "المؤهل العلمي")}
            <div className="sm:col-span-2">{field("address", "العنوان")}</div>
            <div className="sm:col-span-2">{field("notes", "ملاحظات")}</div>
            {!staff && (
              <div className="flex items-center justify-between rounded-xl border border-border p-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">إنشاء حساب دخول الآن</p>
                  <p className="text-[11px] text-muted-foreground">
                    يظهر اسم المستخدم وكلمة المرور بعد الحفظ مرة واحدة.
                  </p>
                </div>
                <Switch checked={createAccount} onCheckedChange={setCreateAccount} />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
          >
            {issued ? "تم" : "إلغاء"}
          </button>
          {!issued && (
            <button
              onClick={submit}
              disabled={save.isPending}
              className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

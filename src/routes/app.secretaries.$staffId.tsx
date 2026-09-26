import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Avatar, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { Attachments } from "@/components/shared/attachments";
import { AccountCredentials } from "@/components/shared/account-credentials";
import { useConfirm } from "@/components/shared/confirm";
import { errorMessage } from "@/lib/api/error-message";
import { useDeleteStaff, useStaffMember } from "@/lib/api/hooks";
import { useApp } from "@/lib/app-context";
import { StaffDialog } from "./app.secretaries.index";

export const Route = createFileRoute("/app/secretaries/$staffId")({
  head: () => ({ meta: [{ title: "ملف السكرتير — Match Education" }] }),
  component: StaffProfile,
});

const GENDER: Record<string, string> = { Male: "ذكر", Female: "أنثى" };

function StaffProfile() {
  const { staffId } = Route.useParams();
  const { role } = useApp();
  const { data, isLoading, error, refetch } = useStaffMember(
    role === "admin" ? staffId : undefined,
  );
  const remove = useDeleteStaff();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  if (role !== "admin")
    return (
      <EmptyBlock title="غير متاح" description="ملفات السكرتارية يطّلع عليها مدير المدرسة فقط." />
    );
  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  const s = data?.staff;
  if (!s) return <EmptyBlock title="لم يتم العثور على الملف" />;

  async function drop() {
    const ok = await confirm({
      title: `حذف ملف «${s!.fullName}»؟`,
      description: "يُحذف الملف ومرفقاته، ويُعطَّل حساب الدخول.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(s!.id);
      toast.success("تم الحذف");
      void navigate({ to: "/app/secretaries" });
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  const rows: Array<[string, string]> = [
    ["المسمى الوظيفي", s.jobTitle],
    ["الجنس", GENDER[s.gender] ?? ""],
    ["الهاتف", s.phone],
    ["البريد الإلكتروني", s.email],
    ["رقم الهوية", s.nationalId],
    ["تاريخ الميلاد", s.dateOfBirth],
    ["تاريخ التعيين", s.joiningDate],
    ["المؤهل العلمي", s.qualification],
    ["العنوان", s.address],
    ["ملاحظات", s.notes],
  ];

  return (
    <>
      <PageHeader
        title={s.fullName}
        subtitle={s.jobTitle || "السكرتارية"}
        actions={
          <>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:bg-secondary"
            >
              <Pencil className="size-4" />
              تعديل
            </button>
            <button
              onClick={drop}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-bold text-destructive hover:bg-destructive-soft"
            >
              <Trash2 className="size-4" />
              حذف
            </button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="البيانات الشخصية">
            <div className="flex items-center gap-4 p-5 pb-0">
              <Avatar name={s.fullName} src={s.image} className="size-16 rounded-3xl text-lg" />
              <div>
                <p className="text-lg font-black">{s.fullName}</p>
                <Pill tone={s.status === "Active" ? "success" : "muted"}>
                  {s.status === "Active" ? "نشِط" : "غير نشِط"}
                </Pill>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="num truncate text-sm font-semibold">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
          <Attachments
            doctype="MS Staff Member"
            name={s.id}
            title="الوثائق"
            description="عقد العمل، صورة الهوية، الشهادات…"
          />
        </div>
        <div className="space-y-5">
          <AccountCredentials doctype="MS Staff Member" name={s.id} canManage />
        </div>
      </div>

      {editing && <StaffDialog staff={s} onClose={() => setEditing(false)} />}
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  KeyRound,
  Plus,
  Printer,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { CredentialsDialog } from "@/components/shared/credentials-dialog";
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
import { downloadRegistrationSlip } from "@/lib/api/export";
import {
  useAdmissionOptions,
  useAdmitApplicant,
  useApplicant,
  useApplicants,
  useDeleteApplicant,
  useSaveApplicant,
  useTransitionApplicant,
  type AdmitResult,
  type ApplicantRow,
  type Credentials,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/admissions")({
  head: () => ({
    meta: [
      { title: "طلبات الالتحاق — Match Education" },
      {
        name: "description",
        content: "استقبال طلبات الالتحاق، قبولها، وتسجيل الطلاب مع إصدار بيانات الدخول.",
      },
    ],
  }),
  component: AdmissionsPage,
});

const TONE: Record<string, "warning" | "info" | "danger" | "success" | "muted"> = {
  Applied: "warning",
  Approved: "info",
  Rejected: "danger",
  Admitted: "success",
};

const TABS = [
  ["All", "الكل"],
  ["Applied", "مقدَّمة"],
  ["Approved", "مقبولة"],
  ["Rejected", "مرفوضة"],
  ["Admitted", "مُسجَّلة"],
] as const;

function AdmissionsPage() {
  const [status, setStatus] = useState<string>("Applied");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ApplicantRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [issued, setIssued] = useState<AdmitResult | null>(null);

  const query = useApplicants({ status: status === "All" ? "" : status, search, page });
  const remove = useDeleteApplicant();
  const confirm = useConfirm();

  const data = query.data;
  const counts = data?.counts ?? {};

  async function removeApplicant(row: ApplicantRow) {
    const ok = await confirm({
      title: `حذف طلب «${row.name}»؟`,
      description: "لا يمكن حذف طلب أصبح طالباً مسجلاً.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast.success("تم حذف الطلب");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title="طلبات الالتحاق"
        subtitle="استقبل الطلبات، اقبلها، وسجّل الطالب مع إصدار بيانات الدخول تلقائياً"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-4" />
            طلب جديد
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي الطلبات" value={counts["All"] ?? 0} icon={ClipboardList} tone="primary" />
        <KpiCard label="بانتظار القرار" value={counts["Applied"] ?? 0} icon={UserPlus} tone="warm" />
        <KpiCard label="مقبولة" value={counts["Approved"] ?? 0} icon={CheckCircle2} tone="info" />
        <KpiCard label="مُسجَّلة" value={counts["Admitted"] ?? 0} icon={GraduationCap} tone="accent" />
      </div>

      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-secondary p-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setStatus(key);
                setPage(1);
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                status === key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              {label}
              {counts[key] !== undefined && <span className="num mr-1.5">({counts[key]})</span>}
            </button>
          ))}
        </div>

        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="ابحث بالاسم أو رقم الهوية…"
            className="h-10 rounded-xl bg-secondary/60 pr-9"
          />
        </div>
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={5} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyBlock
          title="لا توجد طلبات"
          description="أنشئ طلب التحاق جديداً لبدء عملية التسجيل."
          icon={<ClipboardList className="size-6" />}
        />
      ) : (
        <SectionCard title="الطلبات" description={`${data?.total ?? 0} طلب`}>
          <ul className="divide-y divide-border">
            {data!.items.map((row) => (
              <li
                key={row.id}
                className="grid gap-3 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <button
                  onClick={() => setViewing(row.id)}
                  className="min-w-0 text-right transition-opacity hover:opacity-70"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold">{row.name}</p>
                    <Pill tone={TONE[row.status] ?? "muted"}>{row.statusLabel}</Pill>
                  </div>
                  <p className="num mt-0.5 text-xs text-muted-foreground">
                    {row.id}
                    {row.idNumber ? ` • هوية ${row.idNumber}` : ""}
                    {row.program ? ` • ${row.program}` : ""}
                    {row.appliedOn ? ` • ${row.appliedOn}` : ""}
                  </p>
                </button>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setViewing(row.id)}
                    className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                  >
                    التفاصيل
                  </button>
                  {row.status !== "Admitted" && (
                    <button
                      onClick={() => setEditing(row)}
                      className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                    >
                      تعديل
                    </button>
                  )}
                  <button
                    onClick={() => removeApplicant(row)}
                    aria-label="حذف"
                    className="rounded-lg bg-secondary px-2.5 py-2 text-destructive transition-colors hover:bg-destructive-soft"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {(data?.total ?? 0) > (data?.page_size ?? 20) && (
            <div className="mt-4 flex items-center justify-between">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                السابق
              </button>
              <span className="num text-xs text-muted-foreground">
                صفحة {data!.page} من {Math.ceil(data!.total / data!.page_size)}
              </span>
              <button
                disabled={page >= Math.ceil((data?.total ?? 0) / (data?.page_size ?? 20))}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          )}
        </SectionCard>
      )}

      {(creating || editing) && (
        <ApplicantDialog
          applicant={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {viewing && (
        <ApplicantDetailDialog
          applicant={viewing}
          onClose={() => setViewing(null)}
          onAdmitted={(result) => {
            setViewing(null);
            setIssued(result);
          }}
        />
      )}

      {issued && (
        <CredentialsDialog
          title={`تم تسجيل ${issued.studentName}`}
          student={issued.student}
          credentials={issued.credentials}
          guardians={issued.guardians}
          onClose={() => setIssued(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ form */

function ApplicantDialog({
  applicant,
  onClose,
}: {
  applicant: ApplicantRow | null;
  onClose: () => void;
}) {
  const options = useAdmissionOptions();
  const save = useSaveApplicant();

  const [form, setForm] = useState({
    firstName: applicant?.name?.split(" ")[0] ?? "",
    lastName: applicant?.name?.split(" ").slice(1).join(" ") ?? "",
    idNumber: applicant?.idNumber ?? "",
    program: applicant?.program ?? "",
    academicYear: applicant?.academicYear ?? "",
    email: applicant?.email ?? "",
    mobile: applicant?.mobile ?? "",
    birthDate: applicant?.birthDate ?? "",
    gender: applicant?.gender ?? "",
    nationality: applicant?.nationality ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.firstName.trim()) {
      toast.error("الاسم الأول مطلوب");
      return;
    }
    if (!form.idNumber.trim()) {
      toast.error("رقم الهوية مطلوب");
      return;
    }
    if (!form.program) {
      toast.error("البرنامج مطلوب");
      return;
    }

    try {
      await save.mutateAsync({
        ...(applicant ? { id: applicant.id } : {}),
        ...form,
        academicYear: form.academicYear || options.data?.defaultAcademicYear || "",
      });
      toast.success(applicant ? "تم تحديث الطلب" : "تم إنشاء الطلب");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{applicant ? "تعديل الطلب" : "طلب التحاق جديد"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>الاسم الأول *</Label>
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>اسم العائلة</Label>
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>رقم الهوية *</Label>
            <Input
              value={form.idNumber}
              onChange={(e) => set("idNumber", e.target.value)}
              className="num"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الميلاد</Label>
            <Input
              type="date"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>البرنامج / الصف *</Label>
            <SearchableSelect
              value={form.program}
              onChange={(v) => set("program", v)}
              options={(options.data?.programs ?? []).map((p) => ({ value: p, label: p }))}
              placeholder="اختر البرنامج"
            />
          </div>
          <div className="space-y-1.5">
            <Label>العام الدراسي</Label>
            <SearchableSelect
              value={form.academicYear || (options.data?.defaultAcademicYear ?? "")}
              onChange={(v) => set("academicYear", v)}
              options={(options.data?.academicYears ?? []).map((y) => ({ value: y, label: y }))}
              placeholder="اختر العام"
            />
          </div>

          <div className="space-y-1.5">
            <Label>الجنس</Label>
            <SearchableSelect
              value={form.gender}
              onChange={(v) => set("gender", v)}
              options={(options.data?.genders ?? []).map((g) => ({ value: g, label: g }))}
              placeholder="اختر"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الجنسية</Label>
            <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>البريد الإلكتروني</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الجوال</Label>
            <Input
              value={form.mobile}
              onChange={(e) => set("mobile", e.target.value)}
              className="num"
              inputMode="tel"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- detail */

function ApplicantDetailDialog({
  applicant,
  onClose,
  onAdmitted,
}: {
  applicant: string;
  onClose: () => void;
  onAdmitted: (result: AdmitResult) => void;
}) {
  const query = useApplicant(applicant);
  const move = useTransitionApplicant();
  const admit = useAdmitApplicant();
  const confirm = useConfirm();
  const [printing, setPrinting] = useState(false);

  const d = query.data;

  async function transition(to: string, label: string) {
    const ok = await confirm({
      title: `${label} الطلب؟`,
      description: `سيتم نقل الطلب إلى حالة «${label}».`,
      confirmLabel: label,
      ...(to === "Rejected" ? { tone: "danger" as const } : {}),
    });
    if (!ok) return;
    try {
      await move.mutateAsync({ applicant, to_status: to });
      toast.success(`تم ${label} الطلب`);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر تنفيذ الإجراء");
    }
  }

  async function doAdmit() {
    const ok = await confirm({
      title: "تسجيل الطالب؟",
      description:
        "سيتم إنشاء سجل الطالب وحساب الدخول الخاص به وأولياء أمره. ستظهر كلمة المرور مرة واحدة فقط.",
      confirmLabel: "تسجيل",
    });
    if (!ok) return;
    try {
      const result = await admit.mutateAsync(applicant);
      toast.success("تم التسجيل وإصدار بيانات الدخول");
      onAdmitted(result);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التسجيل");
    }
  }

  async function printSlip() {
    setPrinting(true);
    try {
      await downloadRegistrationSlip(
        d?.student ? { student: d.student } : { applicant },
      );
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
            <UserCheck className="size-5 text-primary" />
            {d?.name ?? "تفاصيل الطلب"}
          </DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <TableSkeleton rows={4} />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : d ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={TONE[d.status] ?? "muted"}>{d.statusLabel}</Pill>
              <span className="num text-xs text-muted-foreground">{d.id}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Fact label="رقم الهوية" value={d.idNumber} />
              <Fact label="البرنامج" value={d.program} />
              <Fact label="العام الدراسي" value={d.academicYear} />
              <Fact label="تاريخ الميلاد" value={d.birthDate} />
              <Fact label="الجنس" value={d.gender} />
              <Fact label="الجوال" value={d.mobile} />
              <Fact label="البريد" value={d.email} />
              <Fact label="تاريخ الطلب" value={d.appliedOn} />
            </div>

            {d.guardians.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold">أولياء الأمور</p>
                <ul className="space-y-1.5">
                  {d.guardians.map((g) => (
                    <li
                      key={g.guardian}
                      className="rounded-xl bg-secondary/60 px-3 py-2 text-sm"
                    >
                      {g.name || g.guardian}
                      {g.relation ? (
                        <span className="text-muted-foreground"> — {g.relation}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d.student && (
              <div className="rounded-xl border border-success/40 bg-success-soft p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-success">
                  <GraduationCap className="size-4" />
                  تم التسجيل كطالب
                </p>
                <p className="num mt-1 text-xs">{d.student}</p>
                {d.credentials && (
                  <p className="num mt-1 text-xs text-muted-foreground">
                    اسم المستخدم: {d.credentials.username}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          {d?.allowedMoves.includes("Approved") && (
            <button
              onClick={() => transition("Approved", "قبول")}
              disabled={move.isPending}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-info-soft px-4 text-sm font-bold text-info disabled:opacity-60"
            >
              <CheckCircle2 className="size-4" />
              قبول
            </button>
          )}
          {d?.status === "Approved" && (
            <button
              onClick={doAdmit}
              disabled={admit.isPending}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              <KeyRound className="size-4" />
              {admit.isPending ? "جارٍ التسجيل…" : "تسجيل وإصدار الحساب"}
            </button>
          )}
          {d?.allowedMoves.includes("Rejected") && (
            <button
              onClick={() => transition("Rejected", "رفض")}
              disabled={move.isPending}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-destructive-soft px-4 text-sm font-bold text-destructive disabled:opacity-60"
            >
              <XCircle className="size-4" />
              رفض
            </button>
          )}
          {d?.allowedMoves.includes("Applied") && (
            <button
              onClick={() => transition("Applied", "إعادة فتح")}
              disabled={move.isPending}
              className="h-11 rounded-xl border border-border px-4 text-sm font-semibold"
            >
              إعادة فتح
            </button>
          )}
          <button
            onClick={printSlip}
            disabled={printing}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"
          >
            <Printer className="size-4" />
            طباعة
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="num mt-0.5 text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}

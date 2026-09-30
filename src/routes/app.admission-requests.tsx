import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  CheckCheck,
  Eye,
  FileCheck2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { HtmlPreviewDialog } from "@/components/shared/html-preview-dialog";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import {
  getAdmissionRequestPreview,
  printHtml,
  useAdmissionRequest,
  useAdmissionRequestOptions,
  useAdmissionRequests,
  useCancelAdmissionRequest,
  useConfirmAdmissionRequest,
  useDeleteAdmissionRequest,
  useReopenAdmissionRequest,
  useRequestToApplication,
  useSaveAdmissionRequest,
  type AdmissionRequestRow,
} from "@/lib/api/hooks";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app/admission-requests")({
  head: () => ({
    meta: [
      { title: "طلبات المتسع — Match Education" },
      { name: "description", content: "طلبات قبل الالتحاق، وخطاب «لا مانع من القبول»." },
    ],
  }),
  component: AdmissionRequestsPage,
});

const TABS = [
  { key: "", label: "الكل" },
  { key: "Draft", label: "مسودات" },
  { key: "Confirmed", label: "مؤكَّدة" },
  { key: "Transferred", label: "مرحَّلة" },
  { key: "Cancelled", label: "ملغاة" },
];

const btn =
  "inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary";

function AdmissionRequestsPage() {
  const { role } = useApp();
  const confirm = useConfirm();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading, error, refetch } = useAdmissionRequests(status, q);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [previewing, setPreviewing] = useState<AdmissionRequestRow | null>(null);
  const confirmReq = useConfirmAdmissionRequest();
  const reopen = useReopenAdmissionRequest();
  const cancel = useCancelAdmissionRequest();
  const remove = useDeleteAdmissionRequest();
  const toApplication = useRequestToApplication();

  if (role !== "admin" && role !== "secretary")
    return <EmptyBlock title="غير متاح" description="طلبات المتسع للإدارة والسكرتاريا فقط." />;

  const rows = data?.requests ?? [];
  const counts = data?.counts ?? {};

  async function run<T>(op: () => Promise<T>, ok: string) {
    try {
      await op();
      toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّرت العملية"));
    }
  }

  async function doConfirm(r: AdmissionRequestRow) {
    await run(() => confirmReq.mutateAsync(r.id), "تم تأكيد الطلب");
  }

  async function doTransfer(r: AdmissionRequestRow) {
    const ok = await confirm({
      title: `ترحيل «${r.name}» إلى طلب التحاق؟`,
      description:
        "يُنشأ طلب التحاق بحالة «مقدَّم» — لا مقبول ولا مرفوض — بالبيانات المشتركة، ولا يعود الطلب قابلًا للتعديل.",
      confirmLabel: "ترحيل",
    });
    if (!ok) return;
    await run(() => toApplication.mutateAsync(r.id), "تم إنشاء طلب الالتحاق");
  }

  async function doReopen(r: AdmissionRequestRow) {
    await run(() => reopen.mutateAsync(r.id), "أُعيد فتح الطلب كمسودة");
  }

  async function doCancel(r: AdmissionRequestRow) {
    const ok = await confirm({
      title: `إلغاء طلب «${r.name}»؟`,
      description: "يبقى الطلب في القائمة كملغى، ويمكن إعادة فتحه.",
      tone: "danger",
      confirmLabel: "إلغاء الطلب",
    });
    if (ok) await run(() => cancel.mutateAsync(r.id), "أُلغي الطلب");
  }

  async function doDelete(r: AdmissionRequestRow) {
    const ok = await confirm({
      title: `حذف طلب «${r.name}»؟`,
      description: "يُحذف نهائيًا.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (ok) await run(() => remove.mutateAsync(r.id), "تم الحذف");
  }

  async function doPrint(r: AdmissionRequestRow) {
    try {
      const res = await getAdmissionRequestPreview(r.id);
      printHtml(res.html, res.title);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّرت الطباعة"));
    }
  }

  return (
    <>
      <PageHeader
        title="طلبات المتسع"
        subtitle="الخطوة قبل طلب الالتحاق: تُدخَل البيانات وتُؤكَّد ويُطبع الخطاب، ثم تُرحَّل إلى طلب التحاق"
        actions={
          <button
            onClick={() => setEditing("new")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Plus className="size-4" />
            طلب متسع جديد
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                status === t.key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              {t.label}
              {t.key && counts[t.key] ? ` (${counts[t.key]})` : ""}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو الهوية أو ولي الأمر…"
            className="h-10 rounded-xl bg-card pr-9"
          />
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="لا توجد طلبات متسع"
          description="ابدأ بزر «طلب متسع جديد»."
          icon={<FileCheck2 className="size-6" />}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card-surface p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{r.name}</span>
                    <Pill tone={r.statusTone as "success" | "warning" | "info" | "muted"}>
                      {r.statusLabel}
                    </Pill>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      r.program && `الصف: ${r.program}`,
                      r.academicYear,
                      r.idNumber && `هوية: ${r.idNumber}`,
                      r.guardianName && `ولي الأمر: ${r.guardianName}`,
                    ]
                      .filter(Boolean)
                      .map((x, i) => (
                        <span key={i}>
                          {i > 0 && " · "}
                          <span className="num">{x}</span>
                        </span>
                      ))}
                  </p>
                  {r.application && (
                    <p className="mt-1 text-xs">
                      طلب الالتحاق:{" "}
                      <Link to="/app/admissions" className="num font-semibold text-primary">
                        {r.application}
                      </Link>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setPreviewing(r)} className={btn}>
                    <Eye className="size-3.5" />
                    معاينة
                  </button>
                  <button onClick={() => doPrint(r)} className={btn}>
                    <Printer className="size-3.5" />
                    طباعة
                  </button>
                  {r.status === "Draft" && (
                    <>
                      <button onClick={() => setEditing(r.id)} className={btn}>
                        <Pencil className="size-3.5" />
                        تعديل
                      </button>
                      <button
                        onClick={() => doConfirm(r)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground"
                      >
                        <CheckCheck className="size-3.5" />
                        تأكيد
                      </button>
                    </>
                  )}
                  {r.status === "Confirmed" && (
                    <>
                      <button
                        onClick={() => doTransfer(r)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground"
                      >
                        <ArrowLeftRight className="size-3.5" />
                        ترحيل إلى طلب التحاق
                      </button>
                      <button onClick={() => doReopen(r)} className={btn}>
                        <RotateCcw className="size-3.5" />
                        إعادة فتح
                      </button>
                    </>
                  )}
                  {r.status === "Cancelled" && (
                    <button onClick={() => doReopen(r)} className={btn}>
                      <RotateCcw className="size-3.5" />
                      إعادة فتح
                    </button>
                  )}
                  {(r.status === "Draft" || r.status === "Confirmed") && (
                    <button
                      onClick={() => doCancel(r)}
                      className={`${btn} border-destructive/40 text-destructive hover:bg-destructive-soft`}
                    >
                      <XCircle className="size-3.5" />
                      إلغاء
                    </button>
                  )}
                  {(r.status === "Draft" || r.status === "Cancelled") && (
                    <button
                      onClick={() => doDelete(r)}
                      aria-label="حذف"
                      className="rounded-lg border border-destructive/40 px-2 py-1.5 text-destructive hover:bg-destructive-soft"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <RequestDialog id={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      {previewing && (
        <HtmlPreviewDialog
          heading={`خطاب المتسع — ${previewing.name}`}
          load={() => getAdmissionRequestPreview(previewing.id)}
          actions={
            previewing.status === "Draft" ? (
              <button
                onClick={() => {
                  void doConfirm(previewing);
                  setPreviewing(null);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground"
              >
                <CheckCheck className="size-4" />
                تأكيد الطلب
              </button>
            ) : previewing.status === "Confirmed" ? (
              <button
                onClick={() => {
                  void doTransfer(previewing);
                  setPreviewing(null);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground"
              >
                <ArrowLeftRight className="size-4" />
                ترحيل إلى طلب التحاق
              </button>
            ) : null
          }
          onClose={() => setPreviewing(null)}
        />
      )}
    </>
  );
}

const EMPTY = {
  firstName: "",
  middleName: "",
  grandfatherName: "",
  lastName: "",
  idNumber: "",
  birthDate: "",
  gender: "",
  program: "",
  academicYear: "",
  guardianName: "",
  guardianMobile: "",
  mobile: "",
  email: "",
  city: "",
  previousSchool: "",
  letterDate: "",
  principal: "",
  notes: "",
};

/** A request written or amended — the same facts the application carries, plus the letter's. */
function RequestDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const opts = useAdmissionRequestOptions();
  const existing = useAdmissionRequest(id ?? undefined);
  const save = useSaveAdmissionRequest();
  const [f, setF] = useState(EMPTY);
  const [docs, setDocs] = useState<string[] | null>(null);
  const set = (k: keyof typeof EMPTY, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    setF({
      firstName: d.firstName,
      middleName: d.middleName,
      grandfatherName: d.grandfatherName,
      lastName: d.lastName,
      idNumber: d.idNumber,
      birthDate: d.birthDate,
      gender: d.gender,
      program: d.program,
      academicYear: d.academicYear,
      guardianName: d.guardianName,
      guardianMobile: d.guardianMobile,
      mobile: d.mobile,
      email: d.email,
      city: d.city,
      previousSchool: d.previousSchool,
      letterDate: d.letterDate,
      principal: d.principal,
      notes: d.notes,
    });
    setDocs(d.documents);
  }, [existing.data]);
  // A new request: this year, and every document asked for unless unticked.
  useEffect(() => {
    if (id || !opts.data) return;
    setF((x) => ({ ...x, academicYear: x.academicYear || opts.data.defaultAcademicYear }));
    setDocs((d) => d ?? opts.data.documents);
  }, [id, opts.data]);

  async function submit() {
    if (!f.firstName.trim()) {
      toast.error("الاسم الأول مطلوب");
      return;
    }
    try {
      await save.mutateAsync({
        ...(id ? { id } : {}),
        ...f,
        documents: docs ?? [],
      });
      toast.success("تم حفظ الطلب");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ الطلب"));
    }
  }

  const text = (k: keyof typeof EMPTY, label: string, type = "text", span = false) => (
    <div className={`space-y-1.5 ${span ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      <Input
        type={type}
        value={f[k]}
        onChange={(e) => set(k, e.target.value)}
        className="rounded-xl"
        {...(type === "tel" || k === "idNumber" || k === "email" ? { dir: "ltr" } : {})}
      />
    </div>
  );
  const choice = (label: string, values: string[], current: string, on: (v: string) => void) => (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => on(current === v ? "" : v)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              current === v ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {v === "Male" ? "ذكر" : v === "Female" ? "أنثى" : v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{id ? "تعديل طلب المتسع" : "طلب متسع جديد"}</DialogTitle>
          <DialogDescription>
            يُحفظ مسودة؛ وعند ترحيله إلى طلب التحاق تنتقل إليه البيانات المشتركة.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {text("firstName", "الاسم الأول *")}
          {text("middleName", "اسم الأب")}
          {text("grandfatherName", "اسم الجد")}
          {text("lastName", "اسم العائلة")}
          {text("idNumber", "رقم الهوية")}
          {text("birthDate", "تاريخ الميلاد", "date")}
          {choice("الجنس", opts.data?.genders ?? [], f.gender, (v) => set("gender", v))}
          {choice("الصف المطلوب", opts.data?.programs ?? [], f.program, (v) => set("program", v))}
          {choice("العام الدراسي", opts.data?.academicYears ?? [], f.academicYear, (v) =>
            set("academicYear", v),
          )}
          {text("guardianName", "ولي الأمر")}
          {text("guardianMobile", "هاتف ولي الأمر", "tel")}
          {text("mobile", "هاتف الطالب", "tel")}
          {text("email", "البريد الإلكتروني", "email")}
          {text("city", "العنوان / المدينة")}
          {text("previousSchool", "المدرسة السابقة")}

          <div className="space-y-1.5 sm:col-span-2">
            <Label>الوثائق المطلوبة من الأهل (تُطبع في الخطاب)</Label>
            <div className="space-y-1 rounded-xl border border-border p-2">
              {(opts.data?.documents ?? []).map((d) => (
                <label
                  key={d}
                  className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 text-xs hover:bg-secondary"
                >
                  <input
                    type="checkbox"
                    checked={(docs ?? []).includes(d)}
                    onChange={(e) =>
                      setDocs((cur) =>
                        e.target.checked ? [...(cur ?? []), d] : (cur ?? []).filter((x) => x !== d),
                      )
                    }
                    className="mt-0.5 size-4"
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
          {text("letterDate", "تاريخ الخطاب (فارغ = تاريخ الطباعة)", "date")}
          {text("principal", "اسم مدير المدرسة")}
          {text("notes", "ملاحظات", "text", true)}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ كمسودة"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

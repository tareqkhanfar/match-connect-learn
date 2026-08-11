import { createFileRoute } from "@tanstack/react-router";
import { Attachments } from "@/components/shared/attachments";
import { PendingAttachments, uploadPending } from "@/components/shared/pending-attachments";
import { useEffect, useState, type ReactNode } from "react";
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
import { errorMessage } from "@/lib/api/error-message";
import {
  useAdmissionOptions,
  useAdmitApplicant,
  useApplicant,
  useApplicants,
  useDeleteApplicant,
  usePrintFormats,
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
  // "All" rather than "Applied": a school whose applications are all decided
  // would otherwise open the screen to an empty list and read it as broken.
  const [status, setStatus] = useState<string>("All");
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
      toast.error(errorMessage(err, "تعذّر الحذف"));
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
        // Distinguish "nothing here yet" from "nothing matches this filter",
        // which look identical but call for opposite actions.
        <EmptyBlock
          title={
            search
              ? "لا توجد نتائج مطابقة"
              : status === "All"
                ? "لا توجد طلبات"
                : `لا توجد طلبات ${TABS.find(([k]) => k === status)?.[1] ?? ""}`
          }
          description={
            search
              ? "جرّب اسماً آخر أو رقم هوية مختلفاً."
              : status === "All"
                ? "أنشئ طلب التحاق جديداً لبدء عملية التسجيل."
                : "غيّر التبويب لعرض بقية الطلبات، أو أنشئ طلباً جديداً."
          }
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

/**
 * The registration form, carrying every field the Student Applicant doctype
 * has. Grouped into the same tabs the desk uses, so a registrar filling this
 * in never has to finish the record in ERPNext afterwards.
 */
function ApplicantDialog({
  applicant,
  onClose,
}: {
  applicant: ApplicantRow | null;
  onClose: () => void;
}) {
  const options = useAdmissionOptions();
  const detail = useApplicant(applicant?.id ?? null);
  const save = useSaveApplicant();

  const [tab, setTab] = useState<
    "basic" | "personal" | "relations" | "address" | "documents"
  >("basic");
  const [form, setForm] = useState<Record<string, string>>({});
  const [guardians, setGuardians] = useState<
    Array<{ guardian: string; relation: string }>
  >([]);
  const [siblings, setSiblings] = useState<
    Array<{ name: string; birthDate: string; gender: string; sameSchool: boolean }>
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Populate once the existing record arrives (or immediately when creating).
  useEffect(() => {
    if (loaded) return;
    if (applicant && !detail.data) return;

    const d = detail.data;
    setForm({
      firstName: d?.firstName ?? applicant?.name?.split(" ")[0] ?? "",
      middleName: d?.middleName ?? "",
      lastName: d?.lastName ?? "",
      idNumber: d?.idNumber ?? applicant?.idNumber ?? "",
      program: d?.program ?? "",
      academicYear: d?.academicYear ?? "",
      academicTerm: d?.academicTerm ?? "",
      studentAdmission: d?.studentAdmission ?? "",
      studentCategory: d?.studentCategory ?? "",
      email: d?.email ?? "",
      mobile: d?.mobile ?? "",
      birthDate: d?.birthDate ?? "",
      gender: d?.gender ?? "",
      bloodGroup: d?.bloodGroup ?? "",
      nationality: d?.nationality ?? "",
      addressLine1: d?.addressLine1 ?? "",
      addressLine2: d?.addressLine2 ?? "",
      city: d?.city ?? "",
      state: d?.state ?? "",
      pincode: d?.pincode ?? "",
      country: d?.country ?? "",
    });
    setGuardians(
      (d?.guardians ?? []).map((g) => ({ guardian: g.guardian, relation: g.relation ?? "" })),
    );
    setSiblings(
      (d?.siblings ?? []).map((s) => ({
        name: s.name ?? "",
        birthDate: s.birthDate ?? "",
        gender: s.gender ?? "",
        sameSchool: s.sameSchool,
      })),
    );
    setLoaded(true);
  }, [applicant, detail.data, loaded]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form["firstName"]?.trim()) {
      toast.error("الاسم الأول مطلوب");
      setTab("basic");
      return;
    }
    if (!form["idNumber"]?.trim()) {
      toast.error("رقم الهوية مطلوب");
      setTab("basic");
      return;
    }
    if (!form["program"]) {
      toast.error("البرنامج مطلوب");
      setTab("basic");
      return;
    }
    // Caught here as well as on the server, so it reads as a field problem
    // rather than a failed save after the whole form was filled in.
    if (form["birthDate"] && form["birthDate"] >= new Date().toISOString().slice(0, 10)) {
      toast.error("تاريخ الميلاد يجب أن يكون قبل تاريخ اليوم");
      setTab("personal");
      return;
    }

    try {
      const saved = await save.mutateAsync({
        ...(applicant ? { id: applicant.id } : {}),
        ...form,
        academicYear: form["academicYear"] || options.data?.defaultAcademicYear || "",
        guardians: guardians.filter((g) => g.guardian),
        siblings: siblings.filter((s) => s.name.trim()),
      });
      toast.success(applicant ? "تم تحديث الطلب" : "تم إنشاء الطلب");

      // Files chosen before the application had an id are uploaded now that
      // it has one. Reported separately so a failed upload does not read as a
      // failed save.
      if (pendingFiles.length > 0 && saved?.id) {
        const uploaded = await uploadPending("Student Applicant", saved.id, pendingFiles);
        if (uploaded > 0) toast.success(`تم رفع ${uploaded} من المرفقات`);
        setPendingFiles([]);
      }

      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  const o = options.data;
  const terms = (o?.academicTerms ?? []).filter(
    (t) => !form["academicYear"] || t.academic_year === form["academicYear"],
  );

  const TAB_LIST = [
    ["basic", "بيانات الطلب"],
    ["personal", "البيانات الشخصية"],
    ["relations", "الأهل والإخوة"],
    ["address", "العنوان"],
    ["documents", "المرفقات"],
  ] as const;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{applicant ? "تعديل الطلب" : "طلب التحاق جديد"}</DialogTitle>
        </DialogHeader>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-secondary p-1">
          {TAB_LIST.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                tab === key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "basic" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم الأول *">
              <Input value={form["firstName"] ?? ""} onChange={(e) => set("firstName", e.target.value)} />
            </Field>
            <Field label="اسم الأب">
              <Input value={form["middleName"] ?? ""} onChange={(e) => set("middleName", e.target.value)} />
            </Field>
            <Field label="اسم العائلة">
              <Input value={form["lastName"] ?? ""} onChange={(e) => set("lastName", e.target.value)} />
            </Field>
            <Field label="رقم الهوية *">
              <Input
                value={form["idNumber"] ?? ""}
                onChange={(e) => set("idNumber", e.target.value)}
                className="num"
                inputMode="numeric"
              />
            </Field>
            <Field label="البرنامج / الصف *">
              <SearchableSelect
                value={form["program"] ?? ""}
                onChange={(v) => set("program", v)}
                options={(o?.programs ?? []).map((p) => ({ value: p, label: p }))}
                placeholder="اختر البرنامج"
              />
            </Field>
            <Field label="العام الدراسي">
              <SearchableSelect
                value={form["academicYear"] || (o?.defaultAcademicYear ?? "")}
                onChange={(v) => set("academicYear", v)}
                options={(o?.academicYears ?? []).map((y) => ({ value: y, label: y }))}
                placeholder="اختر العام"
              />
            </Field>
            <Field label="الفصل الدراسي">
              <SearchableSelect
                value={form["academicTerm"] ?? ""}
                onChange={(v) => set("academicTerm", v)}
                options={terms.map((t) => ({ value: t.name, label: t.name }))}
                placeholder="اختر الفصل"
                clearable
              />
            </Field>
            <Field label="فئة الطالب">
              <SearchableSelect
                value={form["studentCategory"] ?? ""}
                onChange={(v) => set("studentCategory", v)}
                options={(o?.studentCategories ?? []).map((c) => ({ value: c, label: c }))}
                placeholder="اختر الفئة"
                clearable
              />
            </Field>
            <Field label="خطة القبول">
              <SearchableSelect
                value={form["studentAdmission"] ?? ""}
                onChange={(v) => set("studentAdmission", v)}
                options={(o?.studentAdmissions ?? []).map((a) => ({ value: a, label: a }))}
                placeholder="اختر خطة القبول"
                clearable
              />
            </Field>
          </div>
        )}

        {tab === "personal" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="تاريخ الميلاد">
              <Input
                type="date"
                value={form["birthDate"] ?? ""}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </Field>
            <Field label="الجنس">
              <SearchableSelect
                value={form["gender"] ?? ""}
                onChange={(v) => set("gender", v)}
                options={(o?.genders ?? []).map((g) => ({ value: g, label: g }))}
                placeholder="اختر"
                clearable
              />
            </Field>
            <Field label="فصيلة الدم">
              <SearchableSelect
                value={form["bloodGroup"] ?? ""}
                onChange={(v) => set("bloodGroup", v)}
                options={(o?.bloodGroups ?? []).map((b) => ({ value: b, label: b }))}
                placeholder="اختر"
                clearable
              />
            </Field>
            <Field label="الجنسية">
              <Input value={form["nationality"] ?? ""} onChange={(e) => set("nationality", e.target.value)} />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input
                type="email"
                dir="ltr"
                value={form["email"] ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="رقم الجوال">
              <Input
                value={form["mobile"] ?? ""}
                onChange={(e) => set("mobile", e.target.value)}
                className="num"
                inputMode="tel"
              />
            </Field>
          </div>
        )}

        {tab === "relations" && (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold">أولياء الأمور</p>
                <button
                  onClick={() => setGuardians((g) => [...g, { guardian: "", relation: "" }])}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                >
                  <Plus className="size-3.5" />
                  إضافة
                </button>
              </div>
              {guardians.length === 0 ? (
                <p className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
                  لم يُضف أي ولي أمر بعد.
                </p>
              ) : (
                <div className="space-y-2">
                  {guardians.map((g, i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                      <SearchableSelect
                        value={g.guardian}
                        onChange={(v) =>
                          setGuardians((list) =>
                            list.map((x, idx) => (idx === i ? { ...x, guardian: v } : x)),
                          )
                        }
                        options={(o?.guardians ?? []).map((x) => ({
                          value: x.name,
                          label: `${x.guardian_name} (${x.name})`,
                        }))}
                        placeholder="اختر ولي الأمر"
                      />
                      {/* A Select on the doctype, not free text — a typed
                          value would be refused on save. */}
                      <SearchableSelect
                        value={g.relation}
                        onChange={(v) =>
                          setGuardians((list) =>
                            list.map((x, idx) => (idx === i ? { ...x, relation: v } : x)),
                          )
                        }
                        options={(o?.relations ?? []).map((r) => ({
                          value: r.value,
                          label: r.label,
                        }))}
                        placeholder="صلة القرابة"
                        clearable
                      />
                      <button
                        onClick={() => setGuardians((list) => list.filter((_, idx) => idx !== i))}
                        aria-label="حذف"
                        className="rounded-lg bg-secondary px-2.5 text-destructive hover:bg-destructive-soft"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold">الإخوة والأخوات</p>
                <button
                  onClick={() =>
                    setSiblings((s) => [
                      ...s,
                      { name: "", birthDate: "", gender: "", sameSchool: false },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                >
                  <Plus className="size-3.5" />
                  إضافة
                </button>
              </div>
              {siblings.length === 0 ? (
                <p className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
                  لا يوجد إخوة مسجلون.
                </p>
              ) : (
                <div className="space-y-2">
                  {siblings.map((s, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-2"
                    >
                      <Input
                        value={s.name}
                        placeholder="الاسم"
                        onChange={(e) =>
                          setSiblings((l) =>
                            l.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                          )
                        }
                      />
                      <Input
                        type="date"
                        value={s.birthDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) =>
                          setSiblings((l) =>
                            l.map((x, idx) => (idx === i ? { ...x, birthDate: e.target.value } : x)),
                          )
                        }
                      />
                      <SearchableSelect
                        value={s.gender}
                        onChange={(v) =>
                          setSiblings((l) =>
                            l.map((x, idx) => (idx === i ? { ...x, gender: v } : x)),
                          )
                        }
                        options={(o?.genders ?? []).map((g) => ({ value: g, label: g }))}
                        placeholder="الجنس"
                        clearable
                      />
                      <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={s.sameSchool}
                          onChange={(e) =>
                            setSiblings((l) =>
                              l.map((x, idx) =>
                                idx === i ? { ...x, sameSchool: e.target.checked } : x,
                              ),
                            )
                          }
                        />
                        بنفس المدرسة
                      </label>
                      <button
                        onClick={() => setSiblings((l) => l.filter((_, idx) => idx !== i))}
                        aria-label="حذف"
                        className="rounded-lg bg-secondary px-2.5 py-2 text-destructive hover:bg-destructive-soft"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "documents" &&
          (applicant?.id ? (
            <Attachments
              doctype="Student Applicant"
              name={applicant.id}
              title="مرفقات الطلب"
              description="شهادة الميلاد، صورة الهوية، الشهادات السابقة، التقارير الطبية. تنتقل تلقائياً إلى ملف الطالب عند قبول الطلب."
              compact
            />
          ) : (
            <PendingAttachments
              files={pendingFiles}
              onChange={setPendingFiles}
              title="مرفقات الطلب"
              description="اختر الملفات الآن وسيتم رفعها فور حفظ الطلب، ثم تنتقل إلى ملف الطالب عند القبول."
            />
          ))}

        {tab === "address" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="العنوان — سطر 1">
              <Input
                value={form["addressLine1"] ?? ""}
                onChange={(e) => set("addressLine1", e.target.value)}
              />
            </Field>
            <Field label="العنوان — سطر 2">
              <Input
                value={form["addressLine2"] ?? ""}
                onChange={(e) => set("addressLine2", e.target.value)}
              />
            </Field>
            <Field label="المدينة">
              <Input value={form["city"] ?? ""} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="المحافظة">
              <Input value={form["state"] ?? ""} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label="الرمز البريدي">
              <Input
                value={form["pincode"] ?? ""}
                onChange={(e) => set("pincode", e.target.value)}
                className="num"
              />
            </Field>
            <Field label="الدولة">
              <SearchableSelect
                value={form["country"] ?? ""}
                onChange={(v) => set("country", v)}
                options={(o?.countries ?? []).map((c) => ({ value: c, label: c }))}
                placeholder="اختر الدولة"
                clearable
              />
            </Field>
          </div>
        )}

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
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
  const [printFormat, setPrintFormat] = useState("");

  const d = query.data;
  // The formats ERPNext offers for whichever doctype we would print.
  const formats = usePrintFormats(d?.student ? "Student" : "Student Applicant");

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
      toast.error(errorMessage(err, "تعذّر تنفيذ الإجراء"));
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
      toast.error(errorMessage(err, "تعذّر التسجيل"));
    }
  }

  async function printSlip() {
    setPrinting(true);
    try {
      await downloadRegistrationSlip({
        ...(d?.student ? { student: d.student } : { applicant }),
        // Blank means "use whatever the desk has set as the default", which is
        // what keeps this identical to printing from ERPNext.
        ...(printFormat ? { printFormat } : {}),
      });
      toast.success("تم تجهيز إشعار التسجيل");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّرت الطباعة"));
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
                      {g.relationLabel || g.relation ? (
                        <span className="text-muted-foreground">
                          {" "}
                          — {g.relationLabel || g.relation}
                        </span>
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
          {(formats.data?.formats.length ?? 0) > 1 && (
            <div className="min-w-[190px]">
              <SearchableSelect
                value={printFormat}
                onChange={setPrintFormat}
                options={(formats.data?.formats ?? []).map((f) => ({
                  value: f === formats.data?.default ? "" : f,
                  label: f === formats.data?.default ? `${f} (افتراضي)` : f,
                }))}
                placeholder="قالب الطباعة"
                clearable
                clearLabel="القالب الافتراضي"
              />
            </div>
          )}
          <button
            onClick={printSlip}
            disabled={printing}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"
          >
            <Printer className="size-4" />
            {printing ? "جارٍ التجهيز…" : "طباعة"}
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

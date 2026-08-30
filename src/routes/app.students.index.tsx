import { createFileRoute, Link } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, PageHeader, Pill, ProgressBar } from "@/components/shared/ui-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import { BulkActions } from "@/components/shared/bulk-actions";
import { useApp } from "@/lib/app-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { byRole, money, statusMeta } from "@/lib/roles";
import {
  useAdmissionOptions,
  useGuardians,
  useSaveStudent,
  useStudentFilters,
  useStudents,
} from "@/lib/api/hooks";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { QuickGuardianDialog } from "@/components/shared/quick-guardian";
import { PendingAttachments, uploadPending } from "@/components/shared/pending-attachments";
import type { StudentRow } from "@/lib/api/types";

export const Route = createFileRoute("/app/students/")({
  validateSearch: groupSearch,
  head: () => ({
    meta: [
      { title: "إدارة الطلاب — Match Education" },
      {
        name: "description",
        content: "قائمة الطلاب مع البحث والفلترة وملفات الطلاب الأكاديمية والمالية.",
      },
      { property: "og:title", content: "إدارة الطلاب — Match Education" },
      { property: "og:description", content: "ابحث وفلتر وأدر ملفات الطلاب بسهولة." },
    ],
  }),
  component: StudentsPage,
});

/** Debounce the search box so we don't refetch on every keystroke. */
function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function StudentsPage() {
  const { role } = useApp();
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [status, setStatus] = useState("all");
  const [gender, setGender] = useState("all");
  // Enrolment, not fees. Defaults to the students the office works with
  // daily; a leaver keeps every record and has to remain findable.
  const [enrolment, setEnrolment] = useState("active");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const debouncedSearch = useDebounced(search);
  const filtersQuery = useStudentFilters();

  const apiFilters = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(grade !== "all" ? { program: grade } : {}),
    ...(section !== "all" ? { batch: section } : {}),
    ...(status !== "all" ? { payment_status: status } : {}),
    enrolment_status: enrolment,
  };

  const query = useStudents({ ...apiFilters, page, page_size: pageSize });

  // Gender isn't a backend filter, so narrow the current page client-side.
  const rows = (query.data?.items ?? []).filter((s) => gender === "all" || s.gender === gender);

  const grades = filtersQuery.data?.grades ?? [];
  const sections = filtersQuery.data?.sections ?? [];

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const columns: Column<StudentRow>[] = [
    {
      fieldname: "name",
      label: "الطالب",
      render: (s) => (
        <Link
          to="/app/students/$studentId"
          params={{ studentId: s.id }}
          className="flex items-center gap-3"
        >
          <Avatar name={s.name} src={s.image} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold hover:text-primary">
              <span className="truncate">{s.name}</span>
              {/* A leaver stays in the directory, so the row has to say so —
                  otherwise their fees and marks read as a current student's. */}
              {s.enrolmentStatus === "left" && (
                <span
                  className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground"
                  title={
                    s.leftOn
                      ? `غادر في ${s.leftOn}${s.leftReason ? ` — ${s.leftReason}` : ""}`
                      : "غير مقيّد حالياً"
                  }
                >
                  منسحب
                </span>
              )}
            </p>
            <p className="num text-xs text-muted-foreground">{s.id}</p>
          </div>
        </Link>
      ),
    },
    {
      fieldname: "grade",
      label: "الصف",
      render: (s) => [s.grade, s.section].filter(Boolean).join(" - ") || "—",
    },
    { fieldname: "gender", label: "الجنس", hiddenByDefault: true },
    {
      fieldname: "guardian",
      label: "ولي الأمر",
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate">{s.guardian ?? "—"}</p>
          {s.guardianPhone && (
            <p className="num text-xs text-muted-foreground">{s.guardianPhone}</p>
          )}
        </div>
      ),
    },
    { fieldname: "phone", label: "هاتف الطالب", hiddenByDefault: true },
    { fieldname: "email", label: "البريد الإلكتروني", hiddenByDefault: true },
    { fieldname: "birthDate", label: "تاريخ الميلاد", numeric: true, hiddenByDefault: true },
    { fieldname: "address", label: "العنوان", hiddenByDefault: true },
    { fieldname: "enrolled", label: "تاريخ الالتحاق", numeric: true, hiddenByDefault: true },
    {
      fieldname: "attendanceRate",
      label: "الحضور",
      render: (s) => (
        <div className="w-24">
          <ProgressBar
            value={s.attendanceRate}
            tone={
              s.attendanceRate >= 90 ? "success" : s.attendanceRate >= 80 ? "warning" : "danger"
            }
          />
          <span className="num mt-1 block text-xs text-muted-foreground">{s.attendanceRate}%</span>
        </div>
      ),
    },
    { fieldname: "average", label: "المعدل", numeric: true },
    {
      fieldname: "feeTotal",
      label: "الرسوم",
      numeric: true,
      render: (s) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {money(s.feePaid)} / {money(s.feeTotal)}
        </span>
      ),
    },
    {
      fieldname: "status",
      label: "الحالة",
      render: (s) => (
        <Pill
          tone={s.status === "paid" ? "success" : s.status === "partial" ? "warning" : "danger"}
        >
          {statusMeta[s.status]?.label ?? s.status}
        </Pill>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={byRole(role, "إدارة الطلاب", { teacher: "طلابي" })}
        subtitle={`${query.data?.total ?? 0} طالباً في القائمة الحالية`}
        actions={<AddStudentDialog />}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        storageKey="students"
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        search={search}
        onSearchChange={resetPage(setSearch)}
        searchPlaceholder="ابحث بالاسم أو الرقم..."
        page={page}
        pageSize={pageSize}
        total={query.data?.total}
        onPageChange={setPage}
        onPageSizeChange={resetPage(setPageSize)}
        exportDataset="students"
        exportFilters={apiFilters}
        exportTitle="قائمة الطلاب"
        bulkDoctype="Student"
        bulkActions={(selected, clear) => (
          <BulkActions
            doctype="Student"
            selected={selected}
            onDone={clear}
            noun="طالباً"
            fields={[
              {
                field: "enabled",
                label: "الحالة",
                options: [
                  { value: 1, label: "تفعيل" },
                  { value: 0, label: "تعطيل" },
                ],
              },
            ]}
          />
        )}
        emptyTitle="لا توجد نتائج"
        emptyDescription="لم نجد أي طالب يطابق معايير البحث. جرّب تعديل الفلاتر."
        toolbar={
          <>
            <Select value={grade} onValueChange={resetPage(setGrade)}>
              <SelectTrigger className="h-10 w-[150px] rounded-xl">
                <SelectValue placeholder="الصف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الصفوف</SelectItem>
                {grades.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={section} onValueChange={resetPage(setSection)}>
              <SelectTrigger className="h-10 w-[130px] rounded-xl">
                <SelectValue placeholder="الشعبة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الشُعب</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s} value={s}>
                    شعبة {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={gender} onValueChange={resetPage(setGender)}>
              <SelectTrigger className="h-10 w-[120px] rounded-xl">
                <SelectValue placeholder="الجنس" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="ذكر">ذكر</SelectItem>
                <SelectItem value="أنثى">أنثى</SelectItem>
              </SelectContent>
            </Select>
            <Select value={enrolment} onValueChange={resetPage(setEnrolment)}>
              <SelectTrigger className="h-10 w-[150px] rounded-xl">
                <SelectValue placeholder="حالة القيد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">الطلاب المقيّدون</SelectItem>
                <SelectItem value="left">المنسحبون</SelectItem>
                <SelectItem value="all">الجميع</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={resetPage(setStatus)}>
              <SelectTrigger className="h-10 w-[140px] rounded-xl">
                <SelectValue placeholder="حالة الرسوم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="paid">مدفوع</SelectItem>
                <SelectItem value="partial">جزئي</SelectItem>
                <SelectItem value="late">متأخر</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
    </>
  );
}

/** The empty form, defined once so creating and resetting cannot drift. */
const BLANK_STUDENT = {
  first_name: "",
  middle_name: "",
  grandfather_name: "",
  last_name: "",
  gender: "",
  date_of_birth: "",
  phone: "",
  email: "",
  address: "",
  // The rest of what an admission form collects, so a student created
  // here and one arriving through admissions end up with the same record.
  id_number: "",
  nationality: "",
  blood_group: "",
  address_line_2: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
  joining_date: "",
};

function AddStudentDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK_STUDENT });
  const [guardians, setGuardians] = useState<Array<{ guardian: string; relation: string }>>([]);
  const [addingGuardian, setAddingGuardian] = useState(false);
  const saveStudent = useSaveStudent();
  // A large page size: this is a picker, not a browsable list, and paging
  // through it to find one parent would be worse than the problem.
  const guardianOptions = useGuardians({ page_size: 500 });
  // Relation labels come from the same list the admission form uses, so a
  // relationship typed here and one picked there are the same value.
  const formOptions = useAdmissionOptions();
  // Files chosen before the student exists; uploaded once the save returns
  // an id, so a birth certificate in hand does not need a second visit.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.first_name.trim()) {
      toast.error("الاسم الأول مطلوب");
      return;
    }
    try {
      const created = await saveStudent.mutateAsync({
        ...form,
        // Only sent when the user actually picked someone: an empty list
        // would be read as "unlink everyone".
        ...(guardians.some((g) => g.guardian)
          ? { guardians: guardians.filter((g) => g.guardian) }
          : {}),
      });
      toast.success("تم إضافة الطالب بنجاح");

      // Reported separately: a failed upload must not read as a failed save.
      if (pendingFiles.length > 0 && created?.id) {
        const uploaded = await uploadPending("Student", created.id, pendingFiles);
        if (uploaded > 0) toast.success(`تم رفع ${uploaded} من المرفقات`);
        setPendingFiles([]);
      }

      setOpen(false);
      setForm({ ...BLANK_STUDENT });
      setGuardians([]);
      setPendingFiles([]);
    } catch (error) {
      const message =
        (error as { messageAr?: string }).messageAr ||
        (error as Error).message ||
        "تعذّر حفظ الطالب";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-transform hover:scale-[1.02]">
          <Plus className="size-4" />
          إضافة طالب
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <UserPlus className="size-5 text-primary" />
            إضافة طالب جديد
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>الاسم الأول *</Label>
            <Input
              value={form.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              placeholder="أحمد"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>اسم الأب</Label>
            <Input
              value={form.middle_name}
              onChange={(e) => set("middle_name", e.target.value)}
              placeholder="خالد"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>اسم الجد</Label>
            <Input
              value={form.grandfather_name}
              onChange={(e) => set("grandfather_name", e.target.value)}
              placeholder="خالد"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>اسم العائلة</Label>
            <Input
              value={form.last_name}
              onChange={(e) => set("last_name", e.target.value)}
              placeholder="العبد الله"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الجنس</Label>
            <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر الجنس" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">ذكر</SelectItem>
                <SelectItem value="Female">أنثى</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الميلاد</Label>
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => set("date_of_birth", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الجوال</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="0599123456"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>البريد الإلكتروني</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="student@school.ps"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>العنوان</Label>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="رام الله - حي الطيرة"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>رقم الهوية</Label>
            <Input
              value={form.id_number}
              onChange={(e) => set("id_number", e.target.value)}
              className="num rounded-xl"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الجنسية</Label>
            <Input
              value={form.nationality}
              onChange={(e) => set("nationality", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>فصيلة الدم</Label>
            <Select value={form.blood_group} onValueChange={(v) => set("blood_group", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الالتحاق</Label>
            <Input
              type="date"
              value={form.joining_date}
              onChange={(e) => set("joining_date", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>عنوان إضافي</Label>
            <Input
              value={form.address_line_2}
              onChange={(e) => set("address_line_2", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المدينة</Label>
            <Input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المحافظة</Label>
            <Input
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الرمز البريدي</Label>
            <Input
              value={form.pincode}
              onChange={(e) => set("pincode", e.target.value)}
              className="num rounded-xl"
              dir="ltr"
            />
          </div>

          {/* Guardians, with a way to create one without leaving the form —
              a parent who is not on file yet used to mean cancelling, adding
              them elsewhere, and starting the student over. */}
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label>أولياء الأمور</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddingGuardian(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-secondary"
                >
                  <UserPlus className="size-3.5" />
                  ولي أمر جديد
                </button>
                <button
                  type="button"
                  onClick={() => setGuardians((g) => [...g, { guardian: "", relation: "" }])}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold transition-colors hover:bg-secondary"
                >
                  <Plus className="size-3.5" />
                  ربط ولي أمر
                </button>
              </div>
            </div>

            {guardians.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                لم يُربط أي ولي أمر بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {guardians.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <SearchableSelect
                        value={g.guardian}
                        onChange={(v) =>
                          setGuardians((list) =>
                            list.map((x, idx) => (idx === i ? { ...x, guardian: v } : x)),
                          )
                        }
                        options={(guardianOptions.data?.items ?? []).map((x) => ({
                          value: x.id,
                          label: x.name,
                        }))}
                        placeholder="اختر ولي الأمر"
                      />
                    </div>
                    <div className="w-36 shrink-0">
                      <SearchableSelect
                        value={g.relation}
                        onChange={(v) =>
                          setGuardians((list) =>
                            list.map((x, idx) => (idx === i ? { ...x, relation: v } : x)),
                          )
                        }
                        options={(formOptions.data?.relations ?? []).map((r) => ({
                          value: r.value,
                          label: r.label,
                        }))}
                        placeholder="صلة القرابة"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuardians((list) => list.filter((_, idx) => idx !== i))}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <PendingAttachments
              files={pendingFiles}
              onChange={setPendingFiles}
              title="مستندات الطالب"
              description="شهادة الميلاد، صورة الهوية، الشهادات السابقة — تُرفع بعد الحفظ."
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={save}
            disabled={saveStudent.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saveStudent.isPending ? "جارٍ الحفظ…" : "حفظ الطالب"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>

      {/* Creating a parent without losing the half-filled student form. */}
      {addingGuardian && (
        <QuickGuardianDialog
          onClose={() => setAddingGuardian(false)}
          onCreated={(id) => {
            setGuardians((g) => [...g, { guardian: id, relation: "" }]);
            setAddingGuardian(false);
          }}
        />
      )}
    </Dialog>
  );
}

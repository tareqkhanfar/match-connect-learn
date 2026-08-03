import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, PageHeader, Pill, ProgressBar } from "@/components/shared/ui-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
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
import { money, statusMeta } from "@/lib/roles";
import { useSaveStudent, useStudentFilters, useStudents } from "@/lib/api/hooks";
import type { StudentRow } from "@/lib/api/types";

export const Route = createFileRoute("/app/students/")({
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
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [status, setStatus] = useState("all");
  const [gender, setGender] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const debouncedSearch = useDebounced(search);
  const filtersQuery = useStudentFilters();

  const apiFilters = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(grade !== "all" ? { program: grade } : {}),
    ...(section !== "all" ? { batch: section } : {}),
    ...(status !== "all" ? { payment_status: status } : {}),
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
          <Avatar name={s.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold hover:text-primary">{s.name}</p>
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
          {statusMeta[s.status].label}
        </Pill>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="إدارة الطلاب"
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

function AddStudentDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    phone: "",
    email: "",
    address: "",
  });
  const saveStudent = useSaveStudent();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.first_name.trim()) {
      toast.error("الاسم الأول مطلوب");
      return;
    }
    try {
      await saveStudent.mutateAsync(form);
      toast.success("تم إضافة الطالب بنجاح");
      setOpen(false);
      setForm({
        first_name: "",
        middle_name: "",
        last_name: "",
        gender: "",
        date_of_birth: "",
        phone: "",
        email: "",
        address: "",
      });
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
      <DialogContent className="max-w-lg" dir="rtl">
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
    </Dialog>
  );
}

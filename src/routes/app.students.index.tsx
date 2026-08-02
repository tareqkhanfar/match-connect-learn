import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Filter, Plus, Search, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, EmptyState, PageHeader, Pill, ProgressBar } from "@/components/shared/ui-kit";
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
import { ErrorState, TableSkeleton } from "@/components/shared/states";

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
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const debouncedQ = useDebounced(q);
  const filtersQuery = useStudentFilters();

  const { data, isLoading, isFetching, error, refetch } = useStudents({
    search: debouncedQ || undefined,
    program: grade === "all" ? undefined : grade,
    batch: section === "all" ? undefined : section,
    payment_status: status === "all" ? undefined : status,
    page,
    page_size: perPage,
  });

  const current = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const grades = filtersQuery.data?.grades ?? [];
  const sections = filtersQuery.data?.sections ?? [];

  return (
    <>
      <PageHeader
        title="إدارة الطلاب"
        subtitle={`${total} طالباً في القائمة الحالية`}
        actions={
          <>
            <button
              onClick={() => toast.success("تم تجهيز ملف Excel للتحميل")}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">تصدير</span>
            </button>
            <AddStudentDialog />
          </>
        }
      />

      <div className="card-surface mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="ابحث بالاسم، الرقم، أو ولي الأمر..."
              className="h-10 rounded-xl pr-9"
            />
          </div>
          <Select
            value={grade}
            onValueChange={(v) => {
              setGrade(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 rounded-xl">
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
          <Select
            value={section}
            onValueChange={(v) => {
              setSection(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 rounded-xl">
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
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="حالة الرسوم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="paid">مدفوع</SelectItem>
              <SelectItem value="partial">جزئي</SelectItem>
              <SelectItem value="late">متأخر</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        {error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={perPage} />
          </div>
        ) : current.length === 0 ? (
          <EmptyState
            icon={Users}
            title="لا توجد نتائج"
            description="لم نجد أي طالب يطابق معايير البحث. جرّب تعديل الفلاتر أو مسح كلمة البحث."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">الطالب</th>
                  <th className="px-4 py-3 font-semibold">الصف</th>
                  <th className="px-4 py-3 font-semibold">ولي الأمر</th>
                  <th className="px-4 py-3 font-semibold">الحضور</th>
                  <th className="px-4 py-3 font-semibold">المعدل</th>
                  <th className="px-4 py-3 font-semibold">الرسوم</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {current.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {[s.grade, s.section].filter(Boolean).join(" - ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">{s.guardian ?? "—"}</p>
                      {s.guardianPhone && (
                        <p className="num text-xs text-muted-foreground">{s.guardianPhone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-24">
                        <ProgressBar
                          value={s.attendanceRate}
                          tone={
                            s.attendanceRate >= 90
                              ? "success"
                              : s.attendanceRate >= 80
                                ? "warning"
                                : "danger"
                          }
                        />
                        <span className="num mt-1 block text-xs text-muted-foreground">
                          {s.attendanceRate}%
                        </span>
                      </div>
                    </td>
                    <td className="num px-4 py-3 font-semibold">{s.average}</td>
                    <td className="num whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {money(s.feePaid)} / {money(s.feeTotal)}
                    </td>
                    <td className="px-4 py-3">
                      <Pill
                        tone={
                          s.status === "paid"
                            ? "success"
                            : s.status === "partial"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {statusMeta[s.status].label}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {current.length > 0 && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-3">
            <p className="num truncate text-xs text-muted-foreground">
              صفحة {page} من {pages}
              {isFetching && " • جارٍ التحديث…"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                السابق
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
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

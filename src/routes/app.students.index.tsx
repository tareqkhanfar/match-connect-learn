import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Filter, Plus, Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, EmptyState, PageHeader, Pill, ProgressBar } from "@/components/shared/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { grades, money, sections, statusMeta, students } from "@/lib/mock-data";

export const Route = createFileRoute("/app/students/")({
  head: () => ({
    meta: [
      { title: "إدارة الطلاب — Match Education" },
      { name: "description", content: "قائمة الطلاب مع البحث والفلترة وملفات الطلاب الأكاديمية والمالية." },
      { property: "og:title", content: "إدارة الطلاب — Match Education" },
      { property: "og:description", content: "ابحث وفلتر وأدر ملفات الطلاب بسهولة." },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          (s.name.includes(q) || s.id.toLowerCase().includes(q.toLowerCase()) || s.guardian.includes(q)) &&
          (grade === "all" || s.grade === grade) &&
          (section === "all" || s.section === section) &&
          (status === "all" || s.status === status),
      ),
    [q, grade, section, status],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <PageHeader
        title="إدارة الطلاب"
        subtitle={`${filtered.length} طالباً من أصل ${students.length} في القائمة الحالية`}
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
          <Select value={grade} onValueChange={(v) => { setGrade(v); setPage(1); }}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="الصف" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الصفوف</SelectItem>
              {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={section} onValueChange={(v) => { setSection(v); setPage(1); }}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="الشعبة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الشُعب</SelectItem>
              {sections.map((s) => <SelectItem key={s} value={s}>شعبة {s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="حالة الرسوم" /></SelectTrigger>
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
        {current.length === 0 ? (
          <EmptyState icon={Users} title="لا توجد نتائج" description="لم نجد أي طالب يطابق معايير البحث. جرّب تعديل الفلاتر أو مسح كلمة البحث." />
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
                      <Link to="/app/students/$studentId" params={{ studentId: s.id }} className="flex items-center gap-3">
                        <Avatar name={s.name} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold hover:text-primary">{s.name}</p>
                          <p className="num text-xs text-muted-foreground">{s.id}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{s.grade} - {s.section}</td>
                    <td className="px-4 py-3">
                      <p className="truncate">{s.guardian}</p>
                      <p className="num text-xs text-muted-foreground">{s.guardianPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-24">
                        <ProgressBar value={s.attendanceRate} tone={s.attendanceRate >= 90 ? "success" : s.attendanceRate >= 80 ? "warning" : "danger"} />
                        <span className="num mt-1 block text-xs text-muted-foreground">{s.attendanceRate}%</span>
                      </div>
                    </td>
                    <td className="num px-4 py-3 font-semibold">{s.average}</td>
                    <td className="num whitespace-nowrap px-4 py-3 text-muted-foreground">{money(s.feePaid)} / {money(s.feeTotal)}</td>
                    <td className="px-4 py-3">
                      <Pill tone={s.status === "paid" ? "success" : s.status === "partial" ? "warning" : "danger"}>{statusMeta[s.status].label}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {current.length > 0 && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-3">
            <p className="num truncate text-xs text-muted-foreground">صفحة {page} من {pages}</p>
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label>الاسم الكامل</Label>
            <Input placeholder="مثال: أحمد خالد العبد الله" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>الصف</Label>
            <Select>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر الصف" /></SelectTrigger>
              <SelectContent>{grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الشعبة</Label>
            <Select>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر الشعبة" /></SelectTrigger>
              <SelectContent>{sections.map((s) => <SelectItem key={s} value={s}>شعبة {s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>اسم ولي الأمر</Label>
            <Input placeholder="خالد العبد الله" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الجوال</Label>
            <Input placeholder="0599123456" className="rounded-xl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>العنوان</Label>
            <Input placeholder="رام الله - حي الطيرة" className="rounded-xl" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={() => {
              setOpen(false);
              toast.success("تم إضافة الطالب بنجاح");
            }}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground"
          >
            حفظ الطالب
          </button>
          <button onClick={() => setOpen(false)} className="h-10 rounded-xl border border-border px-5 text-sm font-semibold">
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

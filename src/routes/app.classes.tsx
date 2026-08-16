import { createFileRoute, Link } from "@tanstack/react-router";
import { DoorOpen, LayoutGrid, Plus, School, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useConfirm } from "@/components/shared/confirm";
import {
  useClasses,
  useDeleteClass,
  useSaveClass,
  useStudentFilters,
  useTeachers,
  useClassFilterOptions,
} from "@/lib/api/hooks";
import {
  activeFilters,
  type FilterDef,
  type FilterValues,
} from "@/components/shared/table-filters";
import type { ClassRow } from "@/lib/api/types";
import { DataTable, type Column } from "@/components/shared/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/classes")({
  head: () => ({
    meta: [
      { title: "الصفوف والشُعب — Match Education" },
      {
        name: "description",
        content: "إدارة الصفوف الدراسية والشُعب وإسناد المعلمين والمواد لكل شعبة.",
      },
      { property: "og:title", content: "الصفوف والشُعب — Match Education" },
      { property: "og:description", content: "نظّم الصفوف والشُعب وأسند المعلمين والمواد." },
    ],
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const confirm = useConfirm();
  const { role } = useApp();
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const { data, isLoading, error, refetch } = useClasses(activeFilters(filterValues));
  const filterOptions = useClassFilterOptions();
  const deleteClass = useDeleteClass();
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [creating, setCreating] = useState(false);
  const classes = data ?? [];
  const canManage = role === "admin" || role === "secretary";

  const totalStudents = classes.reduce((a, c) => a + (c.students ?? 0), 0);
  const capacity = classes.reduce((a, c) => a + (c.capacity ?? 0), 0);
  const occupancy = capacity > 0 ? Math.round((totalStudents / capacity) * 100) : 0;
  const avgSize = classes.length ? Math.round(totalStudents / classes.length) : 0;

  async function removeClass(row: ClassRow) {
    const ok = await confirm({
      title: `حذف الشعبة «${row.student_group_name}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await deleteClass.mutateAsync(row.name);
      toast.success("تم حذف الشعبة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  const columns: Column<ClassRow>[] = [
    { fieldname: "student_group_name", label: "الشعبة" },
    { fieldname: "program", label: "الصف" },
    { fieldname: "batch", label: "القسم", hiddenByDefault: true },
    { fieldname: "students", label: "عدد الطلاب", numeric: true },
    { fieldname: "capacity", label: "السعة", numeric: true, hiddenByDefault: true },
    { fieldname: "homeroom", label: "مربي الصف" },
    { fieldname: "academic_year", label: "العام الدراسي", hiddenByDefault: true },
    {
      fieldname: "subjects",
      label: "عدد المواد",
      numeric: true,
      render: (c) => c.subjects?.length ?? 0,
    },
    ...(canManage
      ? [
          {
            fieldname: "actions",
            label: "إجراءات",
            alwaysVisible: true,
            render: (c: ClassRow) => (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setEditing(c)}
                  className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                >
                  تعديل
                </button>
                <button
                  onClick={() => removeClass(c)}
                  className="rounded-lg bg-secondary px-2 py-1 text-xs text-destructive hover:bg-destructive-soft"
                  aria-label="حذف"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ),
          } as Column<ClassRow>,
        ]
      : []),
  ];

  const opts = (xs: string[] | undefined) => (xs ?? []).map((x) => ({ value: x, label: x }));
  const classFilters: FilterDef[] = filterOptions.data
    ? [
        { kind: "select", field: "program", label: "الصف", options: opts(filterOptions.data.programs) },
        { kind: "select", field: "batch", label: "الشعبة", options: opts(filterOptions.data.batches) },
        {
          kind: "select",
          field: "academic_year",
          label: "العام الدراسي",
          options: opts(filterOptions.data.academicYears),
        },
        {
          kind: "select",
          field: "academic_term",
          label: "الفصل الدراسي",
          options: opts(filterOptions.data.academicTerms),
        },
        { kind: "text", field: "search", label: "بحث", placeholder: "اسم الشعبة..." },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="الصفوف والشُعب"
        subtitle="إدارة الصفوف الدراسية وإسناد المعلمين والمواد"
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
            <Link
              to="/app/sections"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <LayoutGrid className="size-4" />
              توزيع الطلاب على الشعب
            </Link>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
            >
              <Plus className="size-4" />
              إضافة شعبة
            </button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد الشُعب" value={classes.length} icon={School} tone="primary" />
        <KpiCard label="عدد الطلاب" value={totalStudents} icon={Users} tone="accent" />
        <KpiCard label="نسبة الإشغال" value={`${occupancy}%`} icon={DoorOpen} tone="info" />
        <KpiCard label="متوسط حجم الشعبة" value={avgSize} icon={Users} tone="warm" />
      </div>

      <div className="mt-6">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={6} />
        ) : classes.length === 0 ? (
          <EmptyBlock
            title="لا توجد شُعب مطابقة"
            description={
              Object.keys(activeFilters(filterValues)).length > 0
                ? "لا توجد شعبة مطابقة للفلاتر المحددة."
                : "لم يتم إنشاء أي شعبة لهذا العام الدراسي."
            }
            icon={<School className="size-6" />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((c) => {
              const cap = c.capacity ?? 0;
              const fill = cap > 0 ? (c.students / cap) * 100 : 0;
              return (
                <div
                  key={c.name}
                  className="card-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{c.program ?? c.student_group_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.batch ? `شعبة ${c.batch}` : c.student_group_name}
                      </p>
                    </div>
                    <Pill tone={fill > 90 ? "danger" : fill > 75 ? "warning" : "success"}>
                      {c.students}
                      {cap ? `/${cap}` : ""}
                    </Pill>
                  </div>

                  {cap > 0 && (
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                        <span>نسبة الإشغال</span>
                        <span className="num">{Math.round(fill)}%</span>
                      </div>
                      <ProgressBar
                        value={fill}
                        tone={fill > 90 ? "danger" : fill > 75 ? "warning" : "success"}
                      />
                    </div>
                  )}

                  <div className="mt-4 border-t border-border pt-3 text-sm">
                    <p className="text-xs text-muted-foreground">مربي الصف</p>
                    <p className="mt-0.5 truncate font-semibold">{c.homeroom ?? "غير مُسند"}</p>
                  </div>

                  {(c.subjects?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.subjects!.slice(0, 4).map((s) => (
                        <Pill key={s}>{s}</Pill>
                      ))}
                      {c.subjects!.length > 4 && (
                        <Pill tone="primary">+{c.subjects!.length - 4}</Pill>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={classes}
          rowKey={(c) => c.name}
          storageKey="classes"
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
          filters={classFilters}
          filterValues={filterValues}
          onFiltersChange={setFilterValues}
          exportDataset="classes"
          exportTitle="الصفوف والشُعب"
          emptyTitle="لا توجد شُعب"
        />
      </div>

      {(creating || editing) && (
        <ClassDialog
          klass={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ClassDialog({ klass, onClose }: { klass: ClassRow | null; onClose: () => void }) {
  const save = useSaveClass();
  const filtersQuery = useStudentFilters();
  const teachersQuery = useTeachers({ status: "Active" });  // Assigning a class to a teacher who has left is never intended.

  const [form, setForm] = useState({
    student_group_name: klass?.student_group_name ?? "",
    program: klass?.program ?? "",
    batch: klass?.batch ?? "",
    max_strength: String(klass?.capacity ?? 35),
  });
  const [instructor, setInstructor] = useState(klass?.instructors?.[0]?.id ?? "");

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.student_group_name.trim() || !form.program) {
      toast.error("اسم الشعبة والصف مطلوبان");
      return;
    }
    try {
      await save.mutateAsync({
        ...(klass ? { id: klass.name } : {}),
        ...form,
        max_strength: Number(form.max_strength) || 35,
        ...(instructor ? { instructors: [instructor] } : {}),
      });
      toast.success(klass ? "تم تحديث الشعبة" : "تمت إضافة الشعبة");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{klass ? "تعديل الشعبة" : "شعبة جديدة"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>اسم الشعبة *</Label>
            <Input
              value={form.student_group_name}
              onChange={(e) => set("student_group_name", e.target.value)}
              placeholder="مثال: الصف الأول - أ"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الصف *</Label>
            <Select value={form.program} onValueChange={(v) => set("program", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر الصف" />
              </SelectTrigger>
              <SelectContent>
                {(filtersQuery.data?.grades ?? []).map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>القسم</Label>
            <Select value={form.batch} onValueChange={(v) => set("batch", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر القسم" />
              </SelectTrigger>
              <SelectContent>
                {(filtersQuery.data?.sections ?? []).map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>السعة</Label>
            <Input
              type="number"
              min={1}
              value={form.max_strength}
              onChange={(e) => set("max_strength", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>مربي الصف</Label>
            <Select value={instructor} onValueChange={setInstructor}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر المعلم" />
              </SelectTrigger>
              <SelectContent>
                {(teachersQuery.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.instructor_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

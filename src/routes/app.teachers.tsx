import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Mail, Phone, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useDeleteTeacher, useDepartments, useSaveTeacher, useTeachers } from "@/lib/api/hooks";
import type { TeacherRow } from "@/lib/api/types";
import { useApp } from "@/lib/app-context";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/teachers")({
  head: () => ({
    meta: [
      { title: "إدارة المعلمين — Match Education" },
      { name: "description", content: "قائمة المعلمين والمواد والصفوف المسندة وبيانات التواصل." },
      { property: "og:title", content: "إدارة المعلمين — Match Education" },
      { property: "og:description", content: "أدر الكادر التعليمي ومهامه بسهولة." },
    ],
  }),
  component: TeachersPage,
});

function TeachersPage() {
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const { role } = useApp();
  const { data, isLoading, error, refetch } = useTeachers();
  const deleteTeacher = useDeleteTeacher();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const canManage = role === "admin" || role === "secretary";
  const [view, setView] = useViewMode("teachers");

  const columns: Column<TeacherRow>[] = [
    { fieldname: "instructor_name", label: "الاسم", sortable: true },
    { fieldname: "department", label: "القسم", render: (t) => t.department ?? "—" },
    {
      fieldname: "classes_count",
      label: "عدد الشُعب",
      numeric: true,
      render: (t) => t.classes_count,
    },
    {
      fieldname: "classes",
      label: "الشُعب",
      render: (t) =>
        t.classes.length ? (
          <span className="flex flex-wrap gap-1">
            {t.classes.slice(0, 3).map((c) => (
              <Pill key={c} tone="primary">
                {c}
              </Pill>
            ))}
            {t.classes.length > 3 && (
              <span className="num text-xs text-muted-foreground">+{t.classes.length - 3}</span>
            )}
          </span>
        ) : (
          "—"
        ),
    },
    { fieldname: "phone", label: "الهاتف", numeric: true, render: (t) => t.phone ?? "—" },
    { fieldname: "email", label: "البريد", hiddenByDefault: true, render: (t) => t.email ?? "—" },
    {
      fieldname: "status",
      label: "الحالة",
      render: (t) =>
        t.status ? (
          <Pill tone={t.status === "Active" ? "success" : "muted"}>
            {t.status === "Active" ? "نشِط" : t.status}
          </Pill>
        ) : (
          "—"
        ),
    },
    {
      fieldname: "actions",
      label: "",
      alwaysVisible: true,
      render: (t) =>
        canManage ? (
          <span className="flex gap-1.5">
            <button
              onClick={() => setEditing(t)}
              className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
            >
              تعديل
            </button>
            <button
              onClick={() => removeTeacher(t)}
              aria-label="حذف"
              className="rounded-lg bg-secondary px-2 py-1 text-destructive hover:bg-destructive-soft"
            >
              <Trash2 className="size-3.5" />
            </button>
          </span>
        ) : null,
    },
  ];

  async function removeTeacher(row: TeacherRow) {
    const ok = await confirm({
      title: `حذف المعلم «${row.instructor_name}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await deleteTeacher.mutateAsync(row.id);
      toast.success("تم حذف المعلم");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  const teachers = data ?? [];
  // Filter on the client: the list is small and this keeps typing instant.
  const list = teachers.filter(
    (t) => !q || (t.instructor_name ?? "").includes(q) || (t.department ?? "").includes(q),
  );

  return (
    <>
      <PageHeader
        title="إدارة المعلمين"
        subtitle={`${teachers.length} معلماً ومعلمة في الكادر التعليمي`}
        actions={
          <>
            <ViewToggle mode={view} onChange={setView} />
            {canManage && (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="size-4" />
                إضافة معلم
              </button>
            )}
          </>
        }
      />

      {view === "table" ? (
        <DataTable
          columns={columns}
          rows={list}
          rowKey={(t) => t.id}
          storageKey="teachers"
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
          search={q}
          onSearchChange={setQ}
          searchPlaceholder="ابحث بالاسم أو القسم..."
          exportDataset="teachers"
          exportTitle="قائمة المعلمين"
          emptyTitle="لا يوجد معلمون"
          emptyDescription="لم نجد أي معلم يطابق البحث."
        />
      ) : (
        <>
      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم أو القسم..."
          className="h-11 rounded-xl bg-card pr-9"
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={6} />
      ) : list.length === 0 ? (
        <EmptyBlock
          title="لا يوجد معلمون"
          description="لم نجد أي معلم يطابق البحث."
          icon={<GraduationCap className="size-6" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <div
              key={t.id}
              className="card-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                <Avatar name={t.instructor_name} className="size-12 rounded-2xl text-sm" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{t.instructor_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.department ?? "—"}</p>
                </div>
                {t.status && (
                  <Pill tone={t.status === "Active" ? "success" : "muted"}>
                    {t.status === "Active" ? "نشِط" : t.status}
                  </Pill>
                )}
              </div>

              {(t.phone || t.email) && (
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {t.phone && (
                    <p className="num flex items-center gap-2">
                      <Phone className="size-3.5" />
                      {t.phone}
                    </p>
                  )}
                  {t.email && (
                    <p className="flex items-center gap-2 truncate" dir="ltr">
                      <Mail className="size-3.5" />
                      {t.email}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">الصفوف المسندة</p>
                {t.classes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لم يتم إسناد أي شعبة</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {t.classes.map((c) => (
                      <Pill key={c} tone="primary">
                        {c}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-border pt-3 text-center">
                <p className="text-[11px] text-muted-foreground">عدد الشُعب</p>
                <p className="num text-sm font-bold">{t.classes_count}</p>
              </div>

              {canManage && (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => setEditing(t)}
                    className="flex-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => removeTeacher(t)}
                    className="rounded-lg bg-secondary px-2.5 py-1.5 text-destructive hover:bg-destructive-soft"
                    aria-label="حذف"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {!isLoading && !error && teachers.length > 0 && (
        <div className="mt-6">
          <SectionCard title="توزيع الكادر حسب القسم" description="عدد المعلمين لكل قسم">
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(teachers.map((t) => t.department ?? "غير محدد"))).map((s) => (
                <div
                  key={s}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>{s}</span>
                  <span className="num rounded-md bg-primary-soft px-1.5 text-xs font-bold text-primary">
                    {teachers.filter((t) => (t.department ?? "غير محدد") === s).length}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {(creating || editing) && (
        <TeacherDialog
          teacher={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function TeacherDialog({ teacher, onClose }: { teacher: TeacherRow | null; onClose: () => void }) {
  const save = useSaveTeacher();
  const departmentsQuery = useDepartments();
  const [form, setForm] = useState({
    instructor_name: teacher?.instructor_name ?? "",
    gender: teacher?.gender ?? "",
    department: teacher?.department ?? "",
    status: teacher?.status ?? "Active",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.instructor_name.trim()) {
      toast.error("اسم المعلم مطلوب");
      return;
    }
    try {
      await save.mutateAsync({ ...(teacher ? { id: teacher.id } : {}), ...form });
      toast.success(teacher ? "تم تحديث المعلم" : "تمت إضافة المعلم");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{teacher ? "تعديل معلم" : "معلم جديد"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>اسم المعلم *</Label>
            <Input
              value={form.instructor_name}
              onChange={(e) => set("instructor_name", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الجنس</Label>
            <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">ذكر</SelectItem>
                <SelectItem value="Female">أنثى</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">نشِط</SelectItem>
                <SelectItem value="Left">منتهي الخدمة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>القسم</Label>
            <Select value={form.department} onValueChange={(v) => set("department", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر القسم" />
              </SelectTrigger>
              <SelectContent>
                {(departmentsQuery.data ?? []).map((d) => (
                  <SelectItem key={d.name} value={d.name}>
                    {d.name}
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

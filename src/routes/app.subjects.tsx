import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { KpiCard, PageHeader, Pill } from "@/components/shared/ui-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useConfirm } from "@/components/shared/confirm";
import { byRole } from "@/lib/roles";
import { useDeleteSubject, useSaveSubject, useStudentFilters, useSubjects } from "@/lib/api/hooks";
import type { SubjectRow } from "@/lib/api/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/subjects")({
  head: () => ({
    meta: [
      { title: "المواد الدراسية — Match Education" },
      {
        name: "description",
        content: "قائمة المواد الدراسية وربطها بالصفوف والمعلمين وعدد الحصص الأسبوعية.",
      },
      { property: "og:title", content: "المواد الدراسية — Match Education" },
      { property: "og:description", content: "أدر المناهج والمواد وربطها بالصفوف والمعلمين." },
    ],
  }),
  component: SubjectsPage,
});

// Cycle card accents so the grid stays visually varied.
const ACCENTS = [
  "bg-primary-soft text-primary",
  "bg-success-soft text-accent",
  "bg-warm-soft text-warm-foreground",
  "bg-info-soft text-info",
  "bg-success-soft text-success",
  "bg-destructive-soft text-destructive",
];

function SubjectsPage() {
  const confirm = useConfirm();
  const { role } = useApp();
  const { data, isLoading, error, refetch } = useSubjects();
  const deleteSubject = useDeleteSubject();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [view, setView] = useViewMode("subjects");

  const columns: Column<SubjectRow>[] = [
    { fieldname: "course_name", label: "المادة", sortable: true },
    { fieldname: "code", label: "الرمز", numeric: true, render: (s) => s.code || "—" },
    { fieldname: "department", label: "القسم", render: (s) => s.department ?? "—" },
    { fieldname: "teacher", label: "المعلم", render: (s) => s.teacher ?? "—" },
    {
      fieldname: "grades",
      label: "الصفوف",
      render: (s) =>
        s.grades.length ? (
          <span className="flex flex-wrap gap-1">
            {s.grades.slice(0, 3).map((g) => (
              <Pill key={g} tone="primary">
                {g}
              </Pill>
            ))}
            {s.grades.length > 3 && (
              <span className="num text-xs text-muted-foreground">+{s.grades.length - 3}</span>
            )}
          </span>
        ) : (
          "—"
        ),
    },
    {
      fieldname: "actions",
      label: "",
      alwaysVisible: true,
      render: (s) =>
        canManage ? (
          <span className="flex gap-1.5">
            <button
              onClick={() => setEditing(s)}
              className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
            >
              تعديل
            </button>
            <button
              onClick={() => removeSubject(s)}
              aria-label="حذف"
              className="rounded-lg bg-secondary px-2 py-1 text-destructive hover:bg-destructive-soft"
            >
              <Trash2 className="size-3.5" />
            </button>
          </span>
        ) : null,
    },
  ];
  const canManage = role === "admin" || role === "secretary";

  async function removeSubject(row: SubjectRow) {
    const ok = await confirm({
      title: `حذف المادة «${row.course_name}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await deleteSubject.mutateAsync(row.id);
      toast.success("تم حذف المادة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }
  const subjects = data ?? [];

  const withTeacher = subjects.filter((s) => s.teacher).length;
  const gradesCovered = new Set(subjects.flatMap((s) => s.grades)).size;

  return (
    <>
      <PageHeader
        title={byRole(role, "المواد الدراسية", { teacher: "موادي" })}
        subtitle="إدارة المناهج وربطها بالصفوف والمعلمين"
        actions={
          <>
            <ViewToggle mode={view} onChange={setView} />
            {canManage && (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="size-4" />
                إضافة مادة
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="عدد المواد" value={subjects.length} icon={BookOpen} tone="primary" />
        <KpiCard label="الصفوف المغطّاة" value={gradesCovered} icon={GraduationCap} tone="info" />
        <KpiCard label="مواد لها معلم" value={withTeacher} icon={Users} tone="warm" />
      </div>

      <div className="mt-6">
        {view === "table" ? (
          <DataTable
            columns={columns}
            rows={subjects}
            rowKey={(s) => s.id}
            storageKey="subjects"
            isLoading={isLoading}
            error={error}
            onRetry={() => refetch()}
            exportDataset="subjects"
            exportTitle="المواد الدراسية"
            emptyTitle="لا توجد مواد دراسية"
          />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={6} />
        ) : subjects.length === 0 ? (
          <EmptyBlock title="لا توجد مواد دراسية" icon={<BookOpen className="size-6" />} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((s, i) => (
              <div
                key={s.id}
                className="card-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                  <div
                    className={`grid size-11 shrink-0 place-items-center rounded-2xl ${ACCENTS[i % ACCENTS.length]}`}
                  >
                    <BookOpen className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{s.course_name}</p>
                    {s.department && (
                      <p className="truncate text-xs text-muted-foreground">{s.department}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-3 text-sm">
                  <p className="text-xs text-muted-foreground">المعلم المسؤول</p>
                  <p className="mt-0.5 truncate font-semibold">{s.teacher ?? "غير مُسند"}</p>
                </div>

                {canManage && (
                  <div className="mt-3 flex gap-2 border-t border-border pt-3">
                    <button
                      onClick={() => setEditing(s)}
                      className="flex-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => removeSubject(s)}
                      className="rounded-lg bg-secondary px-2.5 py-1.5 text-destructive hover:bg-destructive-soft"
                      aria-label="حذف"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}

                <div className="mt-3">
                  <p className="mb-2 text-xs text-muted-foreground">الصفوف ({s.grades.length})</p>
                  {s.grades.length === 0 ? (
                    <p className="text-xs text-muted-foreground">غير مرتبطة بأي صف</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {s.grades.slice(0, 6).map((g) => (
                        <Pill key={g}>{g.replace("الصف ", "")}</Pill>
                      ))}
                      {s.grades.length > 6 && <Pill tone="muted">+{s.grades.length - 6}</Pill>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <SubjectDialog
          subject={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function SubjectDialog({ subject, onClose }: { subject: SubjectRow | null; onClose: () => void }) {
  const save = useSaveSubject();
  const filtersQuery = useStudentFilters();
  const [name, setName] = useState(subject?.course_name ?? "");
  const [department, setDepartment] = useState(subject?.department ?? "");
  const [programs, setPrograms] = useState<string[]>(subject?.grades ?? []);

  function toggleProgram(p: string) {
    setPrograms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("اسم المادة مطلوب");
      return;
    }
    try {
      await save.mutateAsync({
        ...(subject ? { id: subject.id } : {}),
        course_name: name,
        department,
        programs,
      });
      toast.success(subject ? "تم تحديث المادة" : "تمت إضافة المادة");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{subject ? "تعديل مادة" : "مادة جديدة"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>اسم المادة *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>القسم</Label>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الصفوف التي تُدرَّس فيها</Label>
            <div className="flex flex-wrap gap-2 rounded-xl border border-border p-3">
              {(filtersQuery.data?.grades ?? []).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleProgram(g)}
                  className={
                    programs.includes(g)
                      ? "rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                      : "rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft"
                  }
                >
                  {g.replace("الصف ", "")}
                </button>
              ))}
            </div>
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

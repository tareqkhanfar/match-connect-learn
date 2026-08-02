import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { KpiCard, PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useSubjects } from "@/lib/api/hooks";

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
  const { role } = useApp();
  const { data, isLoading, error, refetch } = useSubjects();
  const subjects = data ?? [];

  const withTeacher = subjects.filter((s) => s.teacher).length;
  const gradesCovered = new Set(subjects.flatMap((s) => s.grades)).size;

  return (
    <>
      <PageHeader
        title="المواد الدراسية"
        subtitle="إدارة المناهج وربطها بالصفوف والمعلمين"
        actions={
          role === "admin" ? (
            <button
              onClick={() => toast.info("إضافة مادة غير مفعّلة بعد")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
            >
              <Plus className="size-4" />
              إضافة مادة
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="عدد المواد" value={subjects.length} icon={BookOpen} tone="primary" />
        <KpiCard label="الصفوف المغطّاة" value={gradesCovered} icon={GraduationCap} tone="info" />
        <KpiCard label="مواد لها معلم" value={withTeacher} icon={Users} tone="warm" />
      </div>

      <div className="mt-6">
        {error ? (
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
    </>
  );
}

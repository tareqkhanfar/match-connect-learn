import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Clock, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { KpiCard, PageHeader, Pill } from "@/components/shared/ui-kit";
import { subjects } from "@/lib/mock-data";

export const Route = createFileRoute("/app/subjects")({
  head: () => ({
    meta: [
      { title: "المواد الدراسية — Match Education" },
      { name: "description", content: "قائمة المواد الدراسية وربطها بالصفوف والمعلمين وعدد الحصص الأسبوعية." },
      { property: "og:title", content: "المواد الدراسية — Match Education" },
      { property: "og:description", content: "أدر المناهج والمواد وربطها بالصفوف والمعلمين." },
    ],
  }),
  component: SubjectsPage,
});

const bgFor: Record<string, string> = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-success-soft text-accent",
  warm: "bg-warm-soft text-warm-foreground",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  destructive: "bg-destructive-soft text-destructive",
};

function SubjectsPage() {
  return (
    <>
      <PageHeader
        title="المواد الدراسية"
        subtitle="إدارة المناهج وربطها بالصفوف والمعلمين"
        actions={
          <button
            onClick={() => toast.success("تم فتح نموذج إضافة مادة")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Plus className="size-4" />
            إضافة مادة
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد المواد" value={subjects.length} icon={BookOpen} tone="primary" />
        <KpiCard label="إجمالي الحصص الأسبوعية" value={subjects.reduce((a, s) => a + s.weeklyHours, 0)} icon={Clock} tone="accent" />
        <KpiCard label="مواد أساسية" value={8} icon={BookOpen} tone="info" />
        <KpiCard label="معلمو المواد" value={subjects.length} icon={Users} tone="warm" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((s) => (
          <div key={s.id} className="card-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
              <div className={`grid size-11 shrink-0 place-items-center rounded-2xl ${bgFor[s.color]}`}>
                <BookOpen className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold">{s.name}</p>
                <p className="num truncate text-xs text-muted-foreground" dir="ltr">{s.code}</p>
              </div>
              <Pill tone="primary">{s.weeklyHours} حصص</Pill>
            </div>

            <div className="mt-4 border-t border-border pt-3 text-sm">
              <p className="text-xs text-muted-foreground">المعلم المسؤول</p>
              <p className="mt-0.5 truncate font-semibold">{s.teacher}</p>
            </div>

            <div className="mt-3">
              <p className="mb-2 text-xs text-muted-foreground">الصفوف</p>
              <div className="flex flex-wrap gap-1.5">
                {s.grades.map((g) => (
                  <Pill key={g}>{g.replace("الصف ", "")}</Pill>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

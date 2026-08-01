import { createFileRoute } from "@tanstack/react-router";
import { DoorOpen, Plus, School, Users } from "lucide-react";
import { toast } from "sonner";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { classes, students, subjectNames } from "@/lib/mock-data";

export const Route = createFileRoute("/app/classes")({
  head: () => ({
    meta: [
      { title: "الصفوف والشُعب — Match Education" },
      { name: "description", content: "إدارة الصفوف الدراسية والشُعب وإسناد المعلمين والمواد لكل شعبة." },
      { property: "og:title", content: "الصفوف والشُعب — Match Education" },
      { property: "og:description", content: "نظّم الشُعب، السعة، ومربي الصف والمواد المسندة." },
    ],
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const totalStudents = classes.reduce((a, c) => a + c.students, 0);
  const capacity = classes.reduce((a, c) => a + c.capacity, 0);

  return (
    <>
      <PageHeader
        title="الصفوف والشُعب"
        subtitle="إدارة الصفوف الدراسية وإسناد المعلمين والمواد"
        actions={
          <button
            onClick={() => toast.success("تم فتح نموذج إضافة شعبة")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Plus className="size-4" />
            إضافة شعبة
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد الشُعب" value={classes.length} icon={School} tone="primary" />
        <KpiCard label="عدد الطلاب" value={totalStudents} icon={Users} tone="accent" />
        <KpiCard label="نسبة الإشغال" value={`${Math.round((totalStudents / capacity) * 100)}%`} icon={DoorOpen} tone="info" />
        <KpiCard label="متوسط حجم الشعبة" value={Math.round(totalStudents / classes.length)} icon={Users} tone="warm" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => {
          const fill = (c.students / c.capacity) * 100;
          return (
            <div key={c.id} className="card-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{c.grade}</p>
                  <p className="text-xs text-muted-foreground">شعبة {c.section} • قاعة {c.room}</p>
                </div>
                <Pill tone={fill > 90 ? "danger" : fill > 75 ? "warning" : "success"}>
                  {c.students}/{c.capacity}
                </Pill>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>نسبة الإشغال</span>
                  <span className="num">{Math.round(fill)}%</span>
                </div>
                <ProgressBar value={fill} tone={fill > 90 ? "danger" : fill > 75 ? "warning" : "success"} />
              </div>

              <div className="mt-4 border-t border-border pt-3 text-sm">
                <p className="text-xs text-muted-foreground">مربي الصف</p>
                <p className="mt-0.5 truncate font-semibold">{c.homeroom}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.subjects.slice(0, 4).map((s) => (
                  <Pill key={s}>{s}</Pill>
                ))}
                {c.subjects.length > 4 && <Pill tone="primary">+{c.subjects.length - 4}</Pill>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <SectionCard title="جدول إسناد المواد" description="المواد المسندة لكل شعبة">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-3 pl-2 font-semibold">الشعبة</th>
                  {subjectNames.slice(0, 7).map((s) => (
                    <th key={s} className="whitespace-nowrap pb-3 pl-2 font-semibold">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {classes.slice(0, 8).map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap py-2.5 pl-2 font-medium">{c.grade} - {c.section}</td>
                    {subjectNames.slice(0, 7).map((s, i) => (
                      <td key={s} className="num py-2.5 pl-2 text-muted-foreground">{2 + ((i + c.students) % 4)} حصص</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="num mt-4 text-xs text-muted-foreground">إجمالي الطلاب المسجلين في النظام: {students.length * 9}</p>
        </SectionCard>
      </div>
    </>
  );
}

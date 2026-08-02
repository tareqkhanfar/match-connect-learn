import { createFileRoute } from "@tanstack/react-router";
import { DoorOpen, Plus, School, Users } from "lucide-react";
import { toast } from "sonner";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useClasses } from "@/lib/api/hooks";

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
  const { role } = useApp();
  const { data, isLoading, error, refetch } = useClasses();
  const classes = data ?? [];

  const totalStudents = classes.reduce((a, c) => a + (c.students ?? 0), 0);
  const capacity = classes.reduce((a, c) => a + (c.capacity ?? 0), 0);
  const occupancy = capacity > 0 ? Math.round((totalStudents / capacity) * 100) : 0;
  const avgSize = classes.length ? Math.round(totalStudents / classes.length) : 0;

  return (
    <>
      <PageHeader
        title="الصفوف والشُعب"
        subtitle="إدارة الصفوف الدراسية وإسناد المعلمين والمواد"
        actions={
          role === "admin" ? (
            <button
              onClick={() => toast.info("إضافة شعبة غير مفعّلة بعد")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
            >
              <Plus className="size-4" />
              إضافة شعبة
            </button>
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
            title="لا توجد شُعب"
            description="لم يتم إنشاء أي شعبة لهذا العام الدراسي."
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

      {!isLoading && !error && classes.length > 0 && (
        <div className="mt-6">
          <SectionCard title="ملخص الشُعب" description="عدد الطلاب والمعلمين المسندين لكل شعبة">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-3 pl-2 font-semibold">الشعبة</th>
                    <th className="pb-3 pl-2 font-semibold">الصف</th>
                    <th className="pb-3 pl-2 font-semibold">عدد الطلاب</th>
                    <th className="pb-3 pl-2 font-semibold">مربي الصف</th>
                    <th className="pb-3 pl-2 font-semibold">عدد المواد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {classes.map((c) => (
                    <tr key={c.name}>
                      <td className="whitespace-nowrap py-2.5 pl-2 font-medium">
                        {c.student_group_name}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-2 text-muted-foreground">
                        {c.program ?? "—"}
                      </td>
                      <td className="num py-2.5 pl-2">{c.students}</td>
                      <td className="whitespace-nowrap py-2.5 pl-2 text-muted-foreground">
                        {c.homeroom ?? "—"}
                      </td>
                      <td className="num py-2.5 pl-2 text-muted-foreground">
                        {c.subjects?.length ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="num mt-4 text-xs text-muted-foreground">
              إجمالي الطلاب في الشُعب المعروضة: {totalStudents}
            </p>
          </SectionCard>
        </div>
      )}
    </>
  );
}

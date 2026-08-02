import { Link } from "@tanstack/react-router";
import { Award, ClipboardCheck, Megaphone, NotebookPen, Users, Wallet } from "lucide-react";
import { Avatar, KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useDashboard } from "@/lib/api/hooks";
import type { ParentDashboard as ParentDashboardData } from "@/lib/api/types";
import { money } from "@/lib/roles";

export function ParentDashboard() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const d = data as ParentDashboardData;
  const kids = d.children ?? [];
  const announcements = d.announcements ?? [];

  if (kids.length === 0) {
    return (
      <>
        <PageHeader title="متابعة الأبناء" subtitle="نظرة سريعة على مستوى أبنائك الأكاديمي وحضورهم ورسومهم" />
        <EmptyBlock
          title="لا يوجد أبناء مرتبطون بحسابك"
          description="يرجى التواصل مع إدارة المدرسة لربط حسابك بملفات أبنائك."
          icon={<Users className="size-6" />}
        />
      </>
    );
  }

  const due = kids.reduce((a, k) => a + (k.outstanding_fees ?? 0), 0);
  const avgAttendance = Math.round(kids.reduce((a, k) => a + (k.attendance_rate ?? 0), 0) / kids.length);
  const avgScore = Math.round(kids.reduce((a, k) => a + (k.average ?? 0), 0) / kids.length);

  return (
    <>
      <PageHeader title="متابعة الأبناء" subtitle="نظرة سريعة على مستوى أبنائك الأكاديمي وحضورهم ورسومهم" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد الأبناء" value={kids.length} icon={Users} tone="primary" />
        <KpiCard label="متوسط الحضور" value={`${avgAttendance}%`} icon={ClipboardCheck} tone="accent" />
        <KpiCard label="متوسط المعدل" value={`${avgScore}%`} icon={Award} tone="info" />
        <KpiCard label="رسوم مستحقة" value={money(due)} icon={Wallet} tone="warm" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {kids.map((k) => (
          <SectionCard
            key={k.student.id}
            title={k.student.name}
            description={[k.student.program, k.student.batch ? `شعبة ${k.student.batch}` : null]
              .filter(Boolean)
              .join(" • ")}
            actions={
              <Link
                to="/app/students/$studentId"
                params={{ studentId: k.student.id }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                الملف الكامل
              </Link>
            }
          >
            <div className="flex items-center gap-3">
              <Avatar name={k.student.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{k.student.name}</p>
                <p className="num truncate text-xs text-muted-foreground">{k.student.id}</p>
              </div>
              <Pill tone={k.outstanding_fees > 0 ? "warning" : "success"}>
                {k.outstanding_fees > 0 ? "رسوم متبقية" : "مدفوع"}
              </Pill>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">المعدل</p>
                <p className="num mt-1 text-lg font-bold">{k.average}%</p>
                <div className="mt-2">
                  <ProgressBar value={k.average} tone={k.average >= 75 ? "success" : "primary"} />
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">الحضور</p>
                <p className="num mt-1 text-lg font-bold">{k.attendance_rate}%</p>
                <div className="mt-2">
                  <ProgressBar
                    value={k.attendance_rate}
                    tone={k.attendance_rate >= 85 ? "success" : k.attendance_rate >= 70 ? "primary" : "danger"}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">واجبات مستحقة</p>
                <p className="num mt-1 flex items-center gap-2 text-lg font-bold">
                  <NotebookPen className="size-4 text-muted-foreground" />
                  {k.pending_assignments}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">رسوم متبقية</p>
                <p className="num mt-1 text-lg font-bold">{money(k.outstanding_fees)}</p>
              </div>
            </div>

            {k.grades.length > 0 && (
              <ul className="mt-4 space-y-2.5 border-t border-border pt-4">
                {k.grades.map((g) => (
                  <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{g.subject}</p>
                        <span className="num shrink-0 text-xs text-muted-foreground">
                          {g.score}/{g.max}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <ProgressBar
                          value={g.percentage}
                          tone={g.percentage >= 75 ? "success" : g.percentage >= 50 ? "primary" : "danger"}
                        />
                      </div>
                    </div>
                    {g.grade && <Pill tone="muted">{g.grade}</Pill>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        ))}
      </div>

      {announcements.length > 0 && (
        <div className="mt-5">
          <SectionCard
            title="إعلانات المدرسة"
            description="آخر التحديثات"
            actions={<Megaphone className="size-4 text-muted-foreground" />}
          >
            <ul className="divide-y divide-border">
              {announcements.map((a) => (
                <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="num mt-1 text-[11px] text-muted-foreground">
                      {a.date} • {a.audience}
                    </p>
                  </div>
                  <Pill tone={a.type === "تنبيه" ? "danger" : a.type === "حدث" ? "info" : "primary"}>{a.type}</Pill>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </>
  );
}

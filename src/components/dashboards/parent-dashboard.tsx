import { Award, ClipboardCheck, Megaphone, Wallet } from "lucide-react";
import { Avatar, KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { announcements, childrenOfParent, money, statusMeta } from "@/lib/mock-data";

export function ParentDashboard() {
  const kids = childrenOfParent;
  const due = kids.reduce((a, k) => a + (k.feeTotal - k.feePaid), 0);

  return (
    <>
      <PageHeader title="متابعة الأبناء" subtitle="نظرة سريعة على مستوى أبنائك الأكاديمي وحضورهم ورسومهم" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد الأبناء" value={kids.length} icon={Award} tone="primary" />
        <KpiCard label="متوسط الحضور" value={`${Math.round(kids.reduce((a, k) => a + k.attendanceRate, 0) / kids.length)}%`} icon={ClipboardCheck} tone="accent" />
        <KpiCard label="متوسط المعدل" value={`${Math.round(kids.reduce((a, k) => a + k.average, 0) / kids.length)}%`} icon={Award} tone="info" />
        <KpiCard label="رسوم مستحقة" value={money(due)} icon={Wallet} tone="warm" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {kids.map((k) => (
          <SectionCard key={k.id} title={k.name} description={`${k.grade} - شعبة ${k.section}`} actions={<Pill tone={k.status === "paid" ? "success" : k.status === "partial" ? "warning" : "danger"}>{statusMeta[k.status].label}</Pill>}>
            <div className="flex items-center gap-4">
              <Avatar name={k.name} className="size-14 rounded-2xl text-base" />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>المعدل العام</span>
                    <span className="num font-semibold text-foreground">{k.average}%</span>
                  </div>
                  <ProgressBar value={k.average} tone={k.average >= 85 ? "success" : "primary"} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>نسبة الحضور</span>
                    <span className="num font-semibold text-foreground">{k.attendanceRate}%</span>
                  </div>
                  <ProgressBar value={k.attendanceRate} tone={k.attendanceRate >= 90 ? "success" : k.attendanceRate >= 80 ? "warning" : "danger"} />
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">الرسوم الكلية</p>
                <p className="num mt-1 text-sm font-bold">{money(k.feeTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">المدفوع</p>
                <p className="num mt-1 text-sm font-bold text-success">{money(k.feePaid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">المتبقي</p>
                <p className="num mt-1 text-sm font-bold text-destructive">{money(k.feeTotal - k.feePaid)}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <div className="mt-5">
        <SectionCard title="إعلانات المدرسة" description="آخر المستجدات" actions={<Megaphone className="size-4 text-muted-foreground" />}>
          <ul className="divide-y divide-border">
            {announcements.map((a) => (
              <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                  <p className="num mt-1 text-[11px] text-muted-foreground">{a.date}</p>
                </div>
                <Pill tone={a.type === "تنبيه" ? "danger" : a.type === "حدث" ? "info" : "primary"}>{a.type}</Pill>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}

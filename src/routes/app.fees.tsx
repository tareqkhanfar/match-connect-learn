import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Download, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Avatar, KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { feeCollection, money, statusMeta, students } from "@/lib/mock-data";

export const Route = createFileRoute("/app/fees")({
  head: () => ({
    meta: [
      { title: "الرسوم المالية — Match Education" },
      { name: "description", content: "هيكل الرسوم، فواتير الطلاب، حالة الدفع وتقارير التحصيل بالشيكل." },
      { property: "og:title", content: "الرسوم المالية — Match Education" },
      { property: "og:description", content: "تابع التحصيل والفواتير وحالات الدفع بدقة." },
    ],
  }),
  component: FeesPage,
});

function FeesPage() {
  const total = students.reduce((a, s) => a + s.feeTotal, 0);
  const paid = students.reduce((a, s) => a + s.feePaid, 0);
  const late = students.filter((s) => s.status === "late");

  return (
    <>
      <PageHeader
        title="الرسوم المالية"
        subtitle="متابعة التحصيل والفواتير وحالات الدفع"
        actions={
          <button
            onClick={() => toast.success("تم تجهيز تقرير التحصيل")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:bg-secondary"
          >
            <Download className="size-4" />
            تصدير التقرير
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي الرسوم" value={money(total)} icon={Wallet} tone="primary" />
        <KpiCard label="المُحصّل" value={money(paid)} icon={CheckCircle2} tone="accent" />
        <KpiCard label="المتبقي" value={money(total - paid)} icon={AlertCircle} tone="warm" />
        <KpiCard label="حالات متأخرة" value={late.length} icon={AlertCircle} tone="info" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SectionCard title="تقرير التحصيل الشهري" description="المُحصّل مقابل المتوقع (₪)">
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={feeCollection}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.75rem", fontSize: "12px", direction: "rtl" }} />
                <Legend wrapperStyle={{ fontSize: 12, direction: "rtl" }} formatter={(v) => (v === "collected" ? "المُحصّل" : "المتوقع")} />
                <Bar dataKey="expected" fill="var(--muted)" radius={[8, 8, 0, 0]} maxBarSize={26} />
                <Bar dataKey="collected" fill="var(--chart-2)" radius={[8, 8, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="هيكل الرسوم" description="لكل مرحلة دراسية">
          <ul className="space-y-3">
            {[
              { stage: "المرحلة الأساسية الدنيا (١-٤)", amount: 1200 },
              { stage: "المرحلة الأساسية العليا (٥-٩)", amount: 1700 },
              { stage: "المرحلة الثانوية (١٠-١٢)", amount: 2200 },
              { stage: "رسوم النشاطات والمواصلات", amount: 450 },
            ].map((f) => (
              <li key={f.stage} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3.5">
                <p className="truncate text-sm font-medium">{f.stage}</p>
                <span className="num text-sm font-bold text-primary">{money(f.amount)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard title="فواتير الطلاب" description="حالة الدفع لكل طالب">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-3 font-semibold">الطالب</th>
                  <th className="pb-3 font-semibold">الصف</th>
                  <th className="pb-3 font-semibold">الإجمالي</th>
                  <th className="pb-3 font-semibold">المدفوع</th>
                  <th className="pb-3 font-semibold">المتبقي</th>
                  <th className="pb-3 font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.slice(0, 14).map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-secondary/40">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} />
                        <div className="min-w-0"><p className="truncate font-semibold">{s.name}</p><p className="num text-xs text-muted-foreground">{s.id}</p></div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-3 text-muted-foreground">{s.grade} - {s.section}</td>
                    <td className="num py-3">{money(s.feeTotal)}</td>
                    <td className="num py-3 text-success">{money(s.feePaid)}</td>
                    <td className="num py-3 text-destructive">{money(s.feeTotal - s.feePaid)}</td>
                    <td className="py-3"><Pill tone={s.status === "paid" ? "success" : s.status === "partial" ? "warning" : "danger"}>{statusMeta[s.status].label}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

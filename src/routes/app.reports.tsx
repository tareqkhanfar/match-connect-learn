import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Download, FileText, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { attendanceTrend, feeCollection, performanceData } from "@/lib/mock-data";

export const Route = createFileRoute("/app/reports")({
  head: () => ({
    meta: [
      { title: "التقارير — Match Education" },
      {
        name: "description",
        content: "تقارير أكاديمية وحضور ومالية قابلة للتصدير إلى PDF وExcel.",
      },
      { property: "og:title", content: "التقارير — Match Education" },
      { property: "og:description", content: "حلّل الأداء الأكاديمي والحضور والتحصيل المالي." },
    ],
  }),
  component: ReportsPage,
});

const reportCards = [
  {
    title: "تقرير الأداء الأكاديمي",
    desc: "معدلات الطلاب حسب المادة والصف",
    icon: BarChart3,
    tone: "primary" as const,
  },
  {
    title: "تقرير الحضور والغياب",
    desc: "نسب الحضور الشهرية وحالات الغياب المتكرر",
    icon: FileText,
    tone: "info" as const,
  },
  {
    title: "تقرير التحصيل المالي",
    desc: "المُحصّل والمتبقي وحالات التأخير",
    icon: Wallet,
    tone: "success" as const,
  },
];

function ReportsPage() {
  return (
    <>
      <PageHeader title="التقارير" subtitle="تقارير أكاديمية وحضور ومالية قابلة للتصدير" />

      <div className="grid gap-4 md:grid-cols-3">
        {reportCards.map((r) => (
          <div key={r.title} className="card-surface p-5">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
              <r.icon className="size-5" />
            </div>
            <p className="mt-3 font-bold">{r.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => toast.success("تم تجهيز ملف PDF")}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-gradient text-xs font-bold text-primary-foreground"
              >
                <Download className="size-3.5" /> PDF
              </button>
              <button
                onClick={() => toast.success("تم تجهيز ملف Excel")}
                className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-border text-xs font-semibold hover:bg-secondary"
              >
                <Download className="size-3.5" /> Excel
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <SectionCard title="مقارنة الحضور الشهري" description="النسبة المئوية">
          <div className="h-[270px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    direction: "rtl",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="present"
                  stroke="var(--chart-1)"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="absent"
                  stroke="var(--chart-5)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="ملخص التحصيل المالي" description="آخر ٦ أشهر">
          <ul className="space-y-3">
            {feeCollection.map((f) => {
              const pct = Math.round((f.collected / f.expected) * 100);
              return (
                <li
                  key={f.month}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{f.month}</p>
                    <p className="num text-xs text-muted-foreground">
                      {f.collected.toLocaleString("en-US")} / {f.expected.toLocaleString("en-US")} ₪
                    </p>
                  </div>
                  <Pill tone={pct >= 90 ? "success" : pct >= 75 ? "warning" : "danger"}>
                    {pct}%
                  </Pill>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard title="متوسط الدرجات حسب المادة" description="جميع الصفوف">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-3 font-semibold">المادة</th>
                  <th className="pb-3 font-semibold">المتوسط</th>
                  <th className="pb-3 font-semibold">أعلى درجة</th>
                  <th className="pb-3 font-semibold">أدنى درجة</th>
                  <th className="pb-3 font-semibold">التقدير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {performanceData.map((p) => (
                  <tr key={p.subject}>
                    <td className="py-3 font-medium">{p.subject}</td>
                    <td className="num py-3 font-bold">{p.average}</td>
                    <td className="num py-3 text-success">{Math.min(100, p.average + 9)}</td>
                    <td className="num py-3 text-destructive">{p.average - 22}</td>
                    <td className="py-3">
                      <Pill
                        tone={p.average >= 85 ? "success" : p.average >= 75 ? "primary" : "warning"}
                      >
                        {p.average >= 85 ? "ممتاز" : p.average >= 75 ? "جيد جداً" : "جيد"}
                      </Pill>
                    </td>
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

import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, Printer, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exams, performanceData, students, subjectNames } from "@/lib/mock-data";

export const Route = createFileRoute("/app/exams")({
  head: () => ({
    meta: [
      { title: "الامتحانات والدرجات — Match Education" },
      { name: "description", content: "جدول الامتحانات، إدخال الدرجات، حساب المعدلات وبطاقة درجات قابلة للطباعة." },
      { property: "og:title", content: "الامتحانات والدرجات — Match Education" },
      { property: "og:description", content: "أدر الامتحانات وأدخل الدرجات واطبع بطاقة الدرجات." },
    ],
  }),
  component: ExamsPage,
});

function ExamsPage() {
  const roster = students.slice(0, 12);
  const [scores, setScores] = useState<Record<string, string>>({});

  return (
    <>
      <PageHeader title="الامتحانات والدرجات" subtitle="جدول الامتحانات، إدخال الدرجات، وبطاقات الدرجات" />

      <Tabs defaultValue="schedule" dir="rtl">
        <TabsList className="mb-4 h-auto flex-wrap rounded-xl p-1">
          <TabsTrigger value="schedule" className="rounded-lg">جدول الامتحانات</TabsTrigger>
          <TabsTrigger value="entry" className="rounded-lg">إدخال الدرجات</TabsTrigger>
          <TabsTrigger value="report" className="rounded-lg">بطاقة الدرجات</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <SectionCard title="جدول امتحانات الفصل الثاني" description={`${exams.length} امتحاناً مجدولاً`}>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-semibold">المادة</th>
                    <th className="pb-3 font-semibold">الصف</th>
                    <th className="pb-3 font-semibold">التاريخ</th>
                    <th className="pb-3 font-semibold">الوقت</th>
                    <th className="pb-3 font-semibold">المدة</th>
                    <th className="pb-3 font-semibold">القاعة</th>
                    <th className="pb-3 font-semibold">النوع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {exams.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-secondary/40">
                      <td className="py-3 font-semibold">{e.subject}</td>
                      <td className="py-3 text-muted-foreground">{e.grade}</td>
                      <td className="num py-3">{e.date}</td>
                      <td className="num py-3 text-muted-foreground">{e.time}</td>
                      <td className="py-3 text-muted-foreground">{e.duration}</td>
                      <td className="num py-3 text-muted-foreground">{e.room}</td>
                      <td className="py-3"><Pill tone={e.type === "نهائي" ? "danger" : e.type === "نصفي" ? "warning" : "info"}>{e.type}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="entry">
          <SectionCard
            title="إدخال درجات الرياضيات"
            description="الصف التاسع - شعبة أ • الامتحان النهائي (من ١٠٠)"
            actions={
              <button
                onClick={() => toast.success("تم حفظ الدرجات بنجاح")}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-gradient px-3.5 text-xs font-bold text-primary-foreground"
              >
                <Save className="size-3.5" />
                حفظ
              </button>
            }
          >
            <ul className="space-y-2">
              {roster.map((s) => (
                <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="num text-xs text-muted-foreground">{s.id}</p>
                  </div>
                  <Input
                    type="number"
                    max={100}
                    min={0}
                    value={scores[s.id] ?? String(s.average)}
                    onChange={(e) => setScores((p) => ({ ...p, [s.id]: e.target.value }))}
                    className="num h-9 w-20 rounded-lg text-center"
                  />
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="report">
          <SectionCard
            title="بطاقة الدرجات"
            description={`${students[0]!.name} • ${students[0]!.grade}`}
            actions={
              <button
                onClick={() => window.print()}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3.5 text-xs font-semibold hover:bg-secondary"
              >
                <Printer className="size-3.5" />
                طباعة PDF
              </button>
            }
          >
            <div className="rounded-2xl border border-border p-6">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-b border-border pb-4">
                <div className="grid size-12 place-items-center rounded-2xl bg-brand-gradient text-primary-foreground">
                  <FileSpreadsheet className="size-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold">مدرسة Match Education النموذجية</p>
                  <p className="text-xs text-muted-foreground">بطاقة درجات الفصل الثاني — العام الدراسي ٢٠٢٥/٢٠٢٦</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <p><span className="text-muted-foreground">الطالب: </span>{students[0]!.name}</p>
                <p><span className="text-muted-foreground">الصف: </span>{students[0]!.grade} - {students[0]!.section}</p>
                <p className="num"><span className="text-muted-foreground">الرقم: </span>{students[0]!.id}</p>
              </div>

              <table className="mt-5 w-full text-right text-sm">
                <thead className="bg-secondary/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="rounded-r-lg px-3 py-2 font-semibold">المادة</th>
                    <th className="px-3 py-2 font-semibold">الدرجة</th>
                    <th className="px-3 py-2 font-semibold">من</th>
                    <th className="rounded-l-lg px-3 py-2 font-semibold">التقدير</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subjectNames.slice(0, 8).map((s, i) => {
                    const v = performanceData[i % performanceData.length]!.average;
                    return (
                      <tr key={s}>
                        <td className="px-3 py-2.5 font-medium">{s}</td>
                        <td className="num px-3 py-2.5 font-bold">{v}</td>
                        <td className="num px-3 py-2.5 text-muted-foreground">100</td>
                        <td className="px-3 py-2.5">
                          <Pill tone={v >= 90 ? "success" : v >= 80 ? "primary" : v >= 70 ? "info" : "warning"}>
                            {v >= 90 ? "ممتاز" : v >= 80 ? "جيد جداً" : v >= 70 ? "جيد" : "مقبول"}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
                <div className="rounded-xl bg-secondary/60 p-3"><p className="text-xs text-muted-foreground">المجموع</p><p className="num text-lg font-bold">648 / 800</p></div>
                <div className="rounded-xl bg-primary-soft p-3"><p className="text-xs text-muted-foreground">المعدل</p><p className="num text-lg font-bold text-primary">81%</p></div>
                <div className="rounded-xl bg-success-soft p-3"><p className="text-xs text-muted-foreground">التقدير العام</p><p className="text-lg font-bold text-success">جيد جداً</p></div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MapPin, Phone, Printer, User, Wallet } from "lucide-react";
import { Avatar, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money, performanceData, statusMeta, students } from "@/lib/mock-data";

export const Route = createFileRoute("/app/students/$studentId")({
  loader: ({ params }) => {
    const student = students.find((s) => s.id === params.studentId);
    if (!student) throw notFound();
    return { student };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.student.name ?? "ملف الطالب";
    return {
      meta: [
        { title: `${name} — ملف الطالب | Match Education` },
        { name: "description", content: `ملف الطالب ${name}: البيانات الشخصية، السجل الأكاديمي، الحضور والرسوم.` },
        { property: "og:title", content: `${name} — ملف الطالب` },
        { property: "og:description", content: "بيانات شخصية، سجل أكاديمي، حضور ورسوم في صفحة واحدة." },
      ],
    };
  },
  component: StudentProfile,
});

function StudentProfile() {
  const { student: s } = Route.useLoaderData();
  const remaining = s.feeTotal - s.feePaid;

  return (
    <>
      <Link to="/app/students" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ArrowRight className="size-4" />
        عودة إلى قائمة الطلاب
      </Link>

      <PageHeader
        title={s.name}
        subtitle={`${s.grade} - شعبة ${s.section} • رقم الطالب ${s.id}`}
        actions={
          <button
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <Printer className="size-4" />
            طباعة الملف
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="card-surface p-5 text-center">
            <Avatar name={s.name} className="mx-auto size-20 rounded-3xl text-xl" />
            <p className="mt-3 text-lg font-bold">{s.name}</p>
            <p className="text-sm text-muted-foreground">{s.grade} - شعبة {s.section}</p>
            <div className="mt-3 flex justify-center">
              <Pill tone={s.status === "paid" ? "success" : s.status === "partial" ? "warning" : "danger"}>
                الرسوم: {statusMeta[s.status].label}
              </Pill>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <p className="text-xs text-muted-foreground">المعدل</p>
                <p className="num text-xl font-bold">{s.average}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الحضور</p>
                <p className="num text-xl font-bold">{s.attendanceRate}%</p>
              </div>
            </div>
          </div>

          <SectionCard title="بيانات شخصية">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3"><User className="size-4 shrink-0 text-muted-foreground" /><span className="text-muted-foreground">النوع:</span> {s.gender}</li>
              <li className="flex items-center gap-3"><CalendarDays className="size-4 shrink-0 text-muted-foreground" /><span className="text-muted-foreground">الميلاد:</span> <span className="num">{s.birthDate}</span></li>
              <li className="flex items-center gap-3"><MapPin className="size-4 shrink-0 text-muted-foreground" /><span className="text-muted-foreground">السكن:</span> {s.address}</li>
              <li className="flex items-center gap-3"><CalendarDays className="size-4 shrink-0 text-muted-foreground" /><span className="text-muted-foreground">تاريخ التسجيل:</span> <span className="num">{s.enrolled}</span></li>
            </ul>
          </SectionCard>

          <SectionCard title="ولي الأمر">
            <p className="font-semibold">{s.guardian}</p>
            <p className="num mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="size-4" /> {s.guardianPhone}
            </p>
          </SectionCard>
        </div>

        <Tabs defaultValue="academic" dir="rtl">
          <TabsList className="mb-4 h-auto flex-wrap rounded-xl p-1">
            <TabsTrigger value="academic" className="rounded-lg">السجل الأكاديمي</TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-lg">الحضور</TabsTrigger>
            <TabsTrigger value="fees" className="rounded-lg">الرسوم</TabsTrigger>
          </TabsList>

          <TabsContent value="academic">
            <SectionCard title="درجات المواد" description="الفصل الثاني ٢٠٢٥/٢٠٢٦">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-3 font-semibold">المادة</th>
                      <th className="pb-3 font-semibold">الواجبات</th>
                      <th className="pb-3 font-semibold">النصفي</th>
                      <th className="pb-3 font-semibold">النهائي</th>
                      <th className="pb-3 font-semibold">المجموع</th>
                      <th className="pb-3 font-semibold">التقدير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {performanceData.map((p, i) => {
                      const total = Math.min(100, p.average + (i % 3) - 1);
                      const gradeLetter = total >= 90 ? "ممتاز" : total >= 80 ? "جيد جداً" : total >= 70 ? "جيد" : "مقبول";
                      return (
                        <tr key={p.subject}>
                          <td className="py-3 font-medium">{p.subject}</td>
                          <td className="num py-3 text-muted-foreground">{Math.round(total * 0.2)}/20</td>
                          <td className="num py-3 text-muted-foreground">{Math.round(total * 0.3)}/30</td>
                          <td className="num py-3 text-muted-foreground">{Math.round(total * 0.5)}/50</td>
                          <td className="num py-3 font-bold">{total}</td>
                          <td className="py-3">
                            <Pill tone={total >= 90 ? "success" : total >= 80 ? "primary" : total >= 70 ? "info" : "warning"}>{gradeLetter}</Pill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="attendance">
            <SectionCard title="سجل الحضور" description="آخر ٣٠ يوماً دراسياً">
              <div className="grid grid-cols-10 gap-2">
                {Array.from({ length: 30 }, (_, i) => {
                  const absent = i % 11 === 3;
                  const late = i % 9 === 5;
                  return (
                    <div
                      key={i}
                      className={`num grid aspect-square place-items-center rounded-lg text-xs font-semibold ${
                        absent ? "bg-destructive-soft text-destructive" : late ? "bg-warning-soft text-warm-foreground" : "bg-success-soft text-success"
                      }`}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
                <div><p className="text-xs text-muted-foreground">أيام حضور</p><p className="num text-lg font-bold text-success">25</p></div>
                <div><p className="text-xs text-muted-foreground">تأخر</p><p className="num text-lg font-bold text-warm-foreground">3</p></div>
                <div><p className="text-xs text-muted-foreground">غياب</p><p className="num text-lg font-bold text-destructive">2</p></div>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="fees">
            <SectionCard title="الرسوم المالية" description="العام الدراسي الحالي" actions={<Wallet className="size-4 text-muted-foreground" />}>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-secondary/60 p-4"><p className="text-xs text-muted-foreground">إجمالي الرسوم</p><p className="num mt-1 text-lg font-bold">{money(s.feeTotal)}</p></div>
                <div className="rounded-xl bg-success-soft p-4"><p className="text-xs text-muted-foreground">المدفوع</p><p className="num mt-1 text-lg font-bold text-success">{money(s.feePaid)}</p></div>
                <div className="rounded-xl bg-destructive-soft p-4"><p className="text-xs text-muted-foreground">المتبقي</p><p className="num mt-1 text-lg font-bold text-destructive">{money(remaining)}</p></div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>نسبة السداد</span>
                  <span className="num">{Math.round((s.feePaid / s.feeTotal) * 100)}%</span>
                </div>
                <ProgressBar value={(s.feePaid / s.feeTotal) * 100} tone={remaining === 0 ? "success" : "warning"} />
              </div>
              <table className="mt-6 w-full text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="pb-3 font-semibold">القسط</th><th className="pb-3 font-semibold">المبلغ</th><th className="pb-3 font-semibold">تاريخ الاستحقاق</th><th className="pb-3 font-semibold">الحالة</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[1, 2, 3].map((n) => {
                    const amount = Math.round(s.feeTotal / 3);
                    const paid = s.feePaid >= amount * n;
                    return (
                      <tr key={n}>
                        <td className="py-3">القسط {n === 1 ? "الأول" : n === 2 ? "الثاني" : "الثالث"}</td>
                        <td className="num py-3">{money(amount)}</td>
                        <td className="num py-3 text-muted-foreground">2026-0{n + 6}-01</td>
                        <td className="py-3"><Pill tone={paid ? "success" : "danger"}>{paid ? "مدفوع" : "متأخر"}</Pill></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

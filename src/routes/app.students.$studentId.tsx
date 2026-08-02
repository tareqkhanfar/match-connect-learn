import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MapPin, Phone, Printer, User, Wallet } from "lucide-react";
import { Avatar, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useStudent } from "@/lib/api/hooks";
import { money, statusMeta } from "@/lib/roles";

export const Route = createFileRoute("/app/students/$studentId")({
  head: () => ({
    meta: [
      { title: "ملف الطالب | Match Education" },
      {
        name: "description",
        content: "ملف الطالب: البيانات الشخصية، السجل الأكاديمي، الحضور والرسوم.",
      },
      { property: "og:title", content: "ملف الطالب" },
      {
        property: "og:description",
        content: "بيانات شخصية، سجل أكاديمي، حضور ورسوم في صفحة واحدة.",
      },
    ],
  }),
  component: StudentProfilePage,
});

const ATTENDANCE_LABELS: Record<string, string> = {
  Present: "حاضر",
  Absent: "غائب",
  Leave: "إجازة",
};

function StudentProfilePage() {
  const { studentId } = Route.useParams();
  const { data, isLoading, error, refetch } = useStudent(studentId);

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return <EmptyBlock title="لم يتم العثور على الطالب" />;

  const { profile, guardians, academics, attendance, fees, groups } = data;

  return (
    <>
      <Link
        to="/app/students"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowRight className="size-4" />
        عودة إلى قائمة الطلاب
      </Link>

      <PageHeader
        title={profile.name}
        subtitle={[
          profile.grade,
          profile.section ? `شعبة ${profile.section}` : null,
          `رقم الطالب ${profile.id}`,
        ]
          .filter(Boolean)
          .join(" • ")}
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="card-surface p-5 text-center">
            <Avatar name={profile.name} className="mx-auto size-20 rounded-3xl text-xl" />
            <p className="mt-3 text-lg font-bold">{profile.name}</p>
            <p className="num text-xs text-muted-foreground">{profile.id}</p>
            <div className="mt-3 flex justify-center gap-2">
              <Pill tone={profile.active ? "success" : "muted"}>
                {profile.active ? "نشِط" : "غير نشِط"}
              </Pill>
              <Pill tone="primary">{profile.gender}</Pill>
            </div>

            <ul className="mt-5 space-y-2.5 text-right text-sm">
              {profile.birthDate && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <CalendarDays className="size-4 shrink-0" />
                  <span className="num">{profile.birthDate}</span>
                </li>
              )}
              {profile.phone && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <Phone className="size-4 shrink-0" />
                  <span className="num">{profile.phone}</span>
                </li>
              )}
              {profile.address && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <MapPin className="size-4 shrink-0" />
                  <span className="truncate">{profile.address}</span>
                </li>
              )}
              {profile.email && (
                <li className="flex items-center gap-2.5 truncate text-muted-foreground" dir="ltr">
                  <User className="size-4 shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </li>
              )}
            </ul>
          </div>

          <SectionCard title="أولياء الأمور">
            {guardians.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا يوجد ولي أمر مرتبط</p>
            ) : (
              <ul className="space-y-3">
                {guardians.map((g) => (
                  <li key={g.id} className="rounded-xl border border-border p-3">
                    <p className="truncate text-sm font-semibold">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.relation ?? "—"}</p>
                    {g.phone && <p className="num mt-1 text-xs text-muted-foreground">{g.phone}</p>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {groups.length > 0 && (
            <SectionCard title="الشُعب">
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => (
                  <Pill key={g.name} tone="primary">
                    {g.student_group_name}
                  </Pill>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        <div>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <div className="card-surface p-4">
              <p className="text-xs text-muted-foreground">نسبة الحضور</p>
              <p className="num mt-1 text-2xl font-bold">{attendance.rate}%</p>
              <div className="mt-2">
                <ProgressBar
                  value={attendance.rate}
                  tone={
                    attendance.rate >= 85 ? "success" : attendance.rate >= 70 ? "warning" : "danger"
                  }
                />
              </div>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs text-muted-foreground">عدد النتائج</p>
              <p className="num mt-1 text-2xl font-bold">{academics.length}</p>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs text-muted-foreground">الرسوم المتبقية</p>
              <p className="num mt-1 text-2xl font-bold">{money(fees.outstanding)}</p>
              <Pill
                tone={
                  fees.status === "paid"
                    ? "success"
                    : fees.status === "partial"
                      ? "warning"
                      : "danger"
                }
              >
                {statusMeta[fees.status].label}
              </Pill>
            </div>
          </div>

          <Tabs defaultValue="academics" dir="rtl">
            <TabsList className="mb-4 h-auto flex-wrap rounded-xl p-1">
              <TabsTrigger value="academics" className="rounded-lg">
                السجل الأكاديمي
              </TabsTrigger>
              <TabsTrigger value="attendance" className="rounded-lg">
                الحضور
              </TabsTrigger>
              <TabsTrigger value="fees" className="rounded-lg">
                الرسوم
              </TabsTrigger>
            </TabsList>

            <TabsContent value="academics">
              <SectionCard title="النتائج" description={`${academics.length} نتيجة مسجّلة`}>
                {academics.length === 0 ? (
                  <EmptyBlock title="لا توجد نتائج مسجّلة" />
                ) : (
                  <ul className="space-y-3">
                    {academics.map((g) => (
                      <li
                        key={g.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"
                      >
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
                              tone={
                                g.percentage >= 75
                                  ? "success"
                                  : g.percentage >= 50
                                    ? "warning"
                                    : "danger"
                              }
                            />
                          </div>
                        </div>
                        {g.grade && <Pill tone="muted">{g.grade}</Pill>}
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="attendance">
              <SectionCard
                title="سجل الحضور"
                description={`حاضر ${attendance.present} • غائب ${attendance.absent} • إجازة ${attendance.leave}`}
              >
                {attendance.recent.length === 0 ? (
                  <EmptyBlock title="لا يوجد سجل حضور" />
                ) : (
                  <ul className="space-y-2">
                    {attendance.recent.map((a) => (
                      <li
                        key={a.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="num text-sm font-medium">{a.date}</p>
                          <p className="truncate text-xs text-muted-foreground">{a.group}</p>
                        </div>
                        <Pill
                          tone={
                            a.status === "Present"
                              ? "success"
                              : a.status === "Leave"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {ATTENDANCE_LABELS[a.status] ?? a.status}
                        </Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="fees">
              <SectionCard
                title="الفواتير"
                description={`الإجمالي ${money(fees.total)} • المدفوع ${money(fees.paid)}`}
                actions={<Wallet className="size-4 text-muted-foreground" />}
              >
                {fees.invoices.length === 0 ? (
                  <EmptyBlock title="لا توجد فواتير" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="pb-3 font-semibold">رقم الفاتورة</th>
                          <th className="pb-3 font-semibold">التاريخ</th>
                          <th className="pb-3 font-semibold">الاستحقاق</th>
                          <th className="pb-3 font-semibold">الإجمالي</th>
                          <th className="pb-3 font-semibold">المدفوع</th>
                          <th className="pb-3 font-semibold">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {fees.invoices.map((f) => (
                          <tr key={f.id}>
                            <td className="num py-3">{f.id}</td>
                            <td className="num py-3 text-muted-foreground">{f.date}</td>
                            <td className="num py-3 text-muted-foreground">{f.due_date}</td>
                            <td className="num py-3">{money(f.total)}</td>
                            <td className="num py-3 text-success">{money(f.paid)}</td>
                            <td className="py-3">
                              <Pill
                                tone={
                                  f.status === "paid"
                                    ? "success"
                                    : f.status === "partial"
                                      ? "warning"
                                      : "danger"
                                }
                              >
                                {statusMeta[f.status].label}
                              </Pill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

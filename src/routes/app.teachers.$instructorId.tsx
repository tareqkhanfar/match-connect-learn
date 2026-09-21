import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Award,
  CalendarCog,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Eye,
  FileText,
  Printer,
  Users,
} from "lucide-react";
import { Avatar, KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { useApp } from "@/lib/app-context";
import { isBackOffice } from "@/lib/roles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { Attachments } from "@/components/shared/attachments";
import { AccountCredentials } from "@/components/shared/account-credentials";
import { usePattern, useTeacherDossier, useTeacherGridOptions } from "@/lib/api/hooks";
import { EditRecordButton, RecordFields } from "@/components/shared/record-fields";

export const Route = createFileRoute("/app/teachers/$instructorId")({
  component: TeacherProfile,
});

const DATE = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });

function d(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? "—" : DATE.format(parsed);
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function Empty({ title }: { title: string }) {
  return <EmptyBlock title={title} icon={<FileText className="size-6" />} />;
}

function Table({ head, rows }: { head: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap py-2 pl-4 font-medium last:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {cells.map((c, j) => (
                <td key={j} className="py-2.5 pl-4 align-middle last:pl-0">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeacherProfile() {
  const { instructorId } = Route.useParams();
  const { role } = useApp();
  const { data, isLoading, error, refetch } = useTeacherDossier(instructorId);
  const [editing, setEditing] = useState(false);
  // The week as a grid, which is how a timetable is read. The dated lessons
  // are the same week repeated, and a list of them is a list to scan.
  const pattern = usePattern({ instructor: instructorId });
  const gridOptions = useTeacherGridOptions();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return <Empty title="لا توجد بيانات" />;

  const { profile, summary, groups, lessons, observations, assignments } = data;
  const backOffice = isBackOffice(role);

  return (
    <>
      <PageHeader
        title={profile.name}
        subtitle={[profile.designation, profile.department, profile.id].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/app/teachers"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <ArrowRight className="size-3.5" />
              القائمة
            </Link>
            {backOffice && !editing && <EditRecordButton onClick={() => setEditing(true)} />}
            {backOffice && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                <Printer className="size-3.5" />
                طباعة
              </button>
            )}
          </div>
        }
      />

      <div className="mt-6 card-surface p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={profile.name} src={profile.image} className="size-22 rounded-2xl text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{profile.name}</h2>
              <Pill tone={profile.status === "Active" ? "success" : "muted"}>
                {profile.status === "Active" ? "نشط" : profile.status || "—"}
              </Pill>
              {profile.hasLogin && <Pill tone="info">لديه حساب دخول</Pill>}
            </div>

            {backOffice ? (
              <RecordFields
                embedded
                doctype="Instructor"
                name={profile.id}
                editing={editing}
                onEditingChange={setEditing}
                onSaved={() => refetch()}
              />
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                <Field label="رقم المعلم" value={profile.id} />
                <Field label="القسم" value={profile.department} />
                <Field label="المسمى الوظيفي" value={profile.designation} />
                <Field label="الجنس" value={profile.gender} />
                <Field
                  label="الهاتف"
                  value={
                    profile.phone ? (
                      <a href={`tel:${profile.phone}`} dir="ltr" className="hover:text-primary">
                        {profile.phone}
                      </a>
                    ) : null
                  }
                />
                <Field
                  label="البريد"
                  value={
                    profile.email ? (
                      <a href={`mailto:${profile.email}`} dir="ltr" className="hover:text-primary">
                        {profile.email}
                      </a>
                    ) : null
                  }
                />
                <Field label="تاريخ التعيين" value={d(profile.joined)} />
                <Field label="ملف الموظف" value={profile.employee} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="الشُعب" value={summary.groups} icon={BookOpen} tone="primary" />
        <KpiCard label="الطلاب" value={summary.students} icon={Users} tone="accent" />
        <KpiCard label="الحصص المجدولة" value={summary.lessons} icon={CalendarDays} tone="info" />
        <KpiCard
          label="حصص أسبوعية"
          value={summary.periodsPerWeek}
          icon={ClipboardList}
          tone="warm"
        />
      </div>

      <div className="mt-6">
        <Tabs defaultValue="groups" dir="rtl">
          <TabsList className="mb-4 h-auto flex-wrap justify-start rounded-xl p-1">
            <TabsTrigger value="groups" className="rounded-lg">
              الشُعب والطلاب
            </TabsTrigger>
            <TabsTrigger value="timetable" className="rounded-lg">
              الجدول
            </TabsTrigger>
            <TabsTrigger value="assignments" className="rounded-lg">
              الواجبات
            </TabsTrigger>
            <TabsTrigger value="observations" className="rounded-lg">
              الملاحظات الصفية
            </TabsTrigger>
            <TabsTrigger value="documents" className="rounded-lg">
              المستندات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="groups">
            <SectionCard title={`الشُعب التي يدرّسها (${groups.length})`}>
              {groups.length === 0 ? (
                <Empty title="لا توجد شُعب" />
              ) : (
                <Table
                  head={["الشعبة", "الصف", "العام الدراسي", "الطلاب", "الحالة", ""]}
                  rows={groups.map((g) => [
                    <span className="font-medium">{g.name}</span>,
                    g.program ?? "—",
                    g.academicYear ?? "—",
                    <span className="tabular-nums">{g.students}</span>,
                    <Pill tone={g.active ? "success" : "muted"}>
                      {g.active ? "نشطة" : "معطّلة"}
                    </Pill>,
                    <Link
                      to="/app/classes"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Eye className="size-3.5" />
                      عرض
                    </Link>,
                  ])}
                />
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="timetable">
            <SectionCard
              title="الجدول الأسبوعي"
              description="أسبوع هذا المعلم كما هو محفوظ في بناء الجدول"
              actions={
                backOffice ? (
                  <Link
                    to="/app/timetable-teacher"
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                  >
                    <CalendarCog className="size-3.5" />
                    تعديل الجدول
                  </Link>
                ) : undefined
              }
            >
              <TeacherWeek
                slots={pattern.data?.slots ?? []}
                periods={(gridOptions.data?.periods ?? []).filter((p) => !p.isBreak)}
                days={(gridOptions.data?.days ?? []).filter((x) =>
                  (gridOptions.data?.workingDays ?? []).includes(x.value),
                )}
                loading={pattern.isLoading || gridOptions.isLoading}
              />
            </SectionCard>

            {lessons.length > 0 && (
              <div className="mt-4">
                <SectionCard title="الحصص القادمة" description="الحصص المؤرخة المولّدة من الجدول">
                  <Table
                    head={["التاريخ", "المادة", "من", "إلى", "الشعبة", "القاعة"]}
                    rows={lessons.slice(0, 20).map((l) => [
                      d(l.date),
                      <span className="font-medium">{l.course}</span>,
                      <span dir="ltr">{l.from?.slice(0, 5)}</span>,
                      <span dir="ltr">{l.to?.slice(0, 5)}</span>,
                      l.group ?? "—",
                      l.room ?? "—",
                    ])}
                  />
                </SectionCard>
              </div>
            )}
          </TabsContent>

          <TabsContent value="assignments">
            <SectionCard title="الواجبات التي أنشأها">
              {assignments.length === 0 ? (
                <Empty title="لا توجد واجبات" />
              ) : (
                <Table
                  head={["الواجب", "المادة", "تاريخ التسليم", "الحالة"]}
                  rows={assignments.map((a) => [
                    <span className="font-medium">{a.title}</span>,
                    a.course ?? "—",
                    d(a.dueDate),
                    a.status ?? "—",
                  ])}
                />
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="observations">
            <SectionCard title="الملاحظات الصفية">
              {observations.length === 0 ? (
                <Empty title="لا توجد ملاحظات" />
              ) : (
                <Table
                  head={["التاريخ", "المُلاحِظ", "التقييم", "الملخص", "الحالة"]}
                  rows={observations.map((o) => [
                    d(o.date),
                    o.observer ?? "—",
                    o.rating ? (
                      <Pill tone="info">
                        <Award className="ml-1 inline size-3" />
                        {o.rating}
                      </Pill>
                    ) : (
                      "—"
                    ),
                    <span className="text-muted-foreground">{o.summary || "—"}</span>,
                    o.status ?? "—",
                  ])}
                />
              )}
            </SectionCard>
          </TabsContent>
          <TabsContent value="documents" className="space-y-6">
            <AccountCredentials doctype="Instructor" name={profile.id} canManage={backOffice} />
            <Attachments
              doctype="Instructor"
              name={profile.id}
              title="مستندات المعلم"
              description="الشهادات العلمية، السيرة الذاتية، العقد، وصورة الهوية."
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

/** A teacher's saved week: periods down the side, days across the top. */
function TeacherWeek({
  slots,
  periods,
  days,
  loading,
}: {
  slots: Array<{ day: string; period: number; course: string | null; studentGroup?: string | null; room: string | null }>;
  periods: Array<{ order: number; from: string; to: string }>;
  days: Array<{ value: string; label: string }>;
  loading: boolean;
}) {
  if (loading) return <p className="py-6 text-center text-sm text-muted-foreground">جارِ التحميل…</p>;
  if (!slots.length || !periods.length || !days.length) {
    return <Empty title="لا يوجد جدول أسبوعي محفوظ لهذا المعلم" />;
  }
  const at = new Map(slots.map((s) => [`${s.day}#${s.period}`, s]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-20 text-xs font-medium text-muted-foreground">الحصة</th>
            {days.map((d) => (
              <th key={d.value} className="min-w-[9rem] rounded-lg bg-secondary/60 px-2 py-2 text-xs font-bold">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p, index) => (
            <tr key={p.order}>
              <td className="whitespace-nowrap rounded-lg bg-secondary/40 px-2 py-2 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                <span className="block font-bold">{index + 1}</span>
                <span dir="ltr">{p.from}</span>
              </td>
              {days.map((day) => {
                const cell = at.get(`${day.value}#${p.order}`);
                return (
                  <td key={day.value} className="align-top">
                    {cell ? (
                      <div className="h-full rounded-lg border border-primary/20 bg-primary-soft/50 px-2 py-2">
                        <p className="truncate text-xs font-bold">{cell.course}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {cell.studentGroup ?? ""}
                        </p>
                        {cell.room && (
                          <p className="truncate text-[10px] text-muted-foreground">{cell.room}</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid h-full min-h-[3rem] place-items-center rounded-lg border border-dashed border-border/60 text-[11px] text-muted-foreground/50">
                        —
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

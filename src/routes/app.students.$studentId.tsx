import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Mail,
  Phone,
  Printer,
  ShieldCheck,
  Smile,
  User,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { StudentEvaluationDialog } from "@/components/shared/student-evaluation";
import { StudentPhoto } from "@/components/shared/student-photo";
import { useApp } from "@/lib/app-context";
import { isBackOffice, money } from "@/lib/roles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { Attachments } from "@/components/shared/attachments";
import { AccountCredentials } from "@/components/shared/account-credentials";
import { useStudentDossier } from "@/lib/api/hooks";
import { EditRecordButton, RecordFields } from "@/components/shared/record-fields";

export const Route = createFileRoute("/app/students/$studentId")({
  component: StudentProfile,
});

const DATE = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });

function d(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? "—" : DATE.format(parsed);
}

/** A labelled value; the building block of every detail block here. */
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

/** A plain table; every tab uses the same one so the page reads consistently. */
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

/**
 * The week as a grid: periods down the side, days across the top.
 *
 * Course Schedule holds one row per dated lesson, so a term is dozens of
 * near-identical rows — unreadable as a list. The backend collapses them onto
 * a weekly pattern and this draws it, which is how a family expects to read a
 * timetable.
 */
function WeeklyGrid({
  timetable,
}: {
  timetable: {
    days: Array<{ value: string; label: string }>;
    periods: string[];
    /** The rows of the grid: the school day, period by period, with the times
     *  this student's class runs them at. `order` is 0 for a lesson recorded
     *  outside the school day, which keeps a row of its own. */
    periodRows?: Array<{ order: number; from: string; to: string }>;
    cells: Array<{
      day: string;
      from: string;
      to: string;
      course: string;
      instructor: string | null;
      room: string | null;
    }>;
  };
}) {
  const at = new Map<string, (typeof timetable.cells)[number]>();
  for (const c of timetable.cells) at.set(`${c.day}|${c.from}`, c);
  // Every period of the school day, numbered as the school numbers them — a
  // free period is part of a timetable, and dropping its row shifted every
  // period below it up.
  const rows = timetable.periodRows?.length
    ? timetable.periodRows
    : timetable.periods.map((from, i) => ({ order: i + 1, from, to: "" }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-20 text-xs font-medium text-muted-foreground">الحصة</th>
            {timetable.days.map((day) => (
              <th
                key={day.value}
                className="min-w-[9rem] rounded-lg bg-secondary/60 px-2 py-2 text-xs font-bold"
              >
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((period) => (
            <tr key={`${period.order}#${period.from}`}>
              <td className="whitespace-nowrap rounded-lg bg-secondary/40 px-2 py-2 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                {period.order > 0 && <span className="block font-bold">الحصة {period.order}</span>}
                <span dir="ltr">
                  {period.from}
                  {period.to ? `–${period.to}` : ""}
                </span>
              </td>
              {timetable.days.map((day) => {
                const cell = at.get(`${day.value}|${period.from}`);
                if (!cell) {
                  return (
                    <td
                      key={day.value}
                      className="rounded-lg border border-dashed border-border/60 px-2 py-2 text-center text-[11px] text-muted-foreground/50"
                    >
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={day.value}
                    className="rounded-lg border border-primary/20 bg-primary-soft/50 px-2 py-2 align-top"
                  >
                    <p className="truncate text-xs font-bold">{cell.course}</p>
                    {cell.instructor && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {cell.instructor}
                      </p>
                    )}
                    <p className="text-[10px] tabular-nums text-muted-foreground" dir="ltr">
                      {cell.from}–{cell.to}
                      {cell.room ? ` · ${cell.room}` : ""}
                    </p>
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

function StudentProfile() {
  const { studentId } = Route.useParams();
  const { role } = useApp();
  const { data, isLoading, error, refetch } = useStudentDossier(studentId);
  const [assessing, setAssessing] = useState(false);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return <Empty title="لا توجد بيانات" />;

  const {
    profile,
    enrollments,
    guardians,
    attendance,
    grades,
    courses,
    behaviour,
    health,
    assignments,
    quizzes,
    billing,
    services,
    alerts,
    timetable,
    timetableGrid,
  } = data;

  const backOffice = isBackOffice(role);
  // A teacher assesses; a family reads. The forms themselves decide what is
  // published to whom, so the button is simply staff-only here.
  const canAssess = backOffice || role === "teacher";
  const openAlerts = alerts.filter((a) => (a.status ?? "").toLowerCase() !== "resolved");

  return (
    <>
      <PageHeader
        title={profile.name}
        subtitle={[profile.grade, profile.section && `شعبة ${profile.section}`, profile.id]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/app/students"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <ArrowRight className="size-3.5" />
              القائمة
            </Link>
            {backOffice && !editing && <EditRecordButton onClick={() => setEditing(true)} />}
            {canAssess && (
              <button
                onClick={() => setAssessing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                <ClipboardList className="size-3.5" />
                تقييم بنموذج
              </button>
            )}
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

      {/* Identity card ------------------------------------------------- */}
      <div className="mt-6 card-surface p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <StudentPhoto
            student={profile.id}
            name={profile.name}
            image={profile.image}
            canEdit={backOffice}
            onChange={() => refetch()}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{profile.name}</h2>
              <Pill tone={profile.active ? "success" : "muted"}>
                {profile.active ? "نشط" : "غير نشط"}
              </Pill>
              {profile.hasLogin && <Pill tone="info">لديه حساب دخول</Pill>}
              {openAlerts.length > 0 && <Pill tone="danger">{openAlerts.length} تنبيه مفتوح</Pill>}
            </div>

            {backOffice ? (
              <RecordFields
                embedded
                doctype="Student"
                name={profile.id}
                editing={editing}
                onEditingChange={setEditing}
                onSaved={() => refetch()}
              />
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                <Field label="رقم الطالب" value={profile.id} />
                <Field label="الجنس" value={profile.gender} />
                <Field
                  label="تاريخ الميلاد"
                  value={
                    profile.birthDate
                      ? `${d(profile.birthDate)}${profile.age ? ` (${profile.age} سنة)` : ""}`
                      : "—"
                  }
                />
                <Field label="الجنسية" value={profile.nationality} />
                <Field
                  label="الهاتف"
                  value={
                    profile.phone ? (
                      <a href={`tel:${profile.phone}`} className="hover:text-primary" dir="ltr">
                        {profile.phone}
                      </a>
                    ) : null
                  }
                />
                <Field
                  label="البريد"
                  value={
                    profile.email ? (
                      <a href={`mailto:${profile.email}`} className="hover:text-primary" dir="ltr">
                        {profile.email}
                      </a>
                    ) : null
                  }
                />
                <Field label="فصيلة الدم" value={profile.bloodGroup} />
                <Field label="تاريخ الالتحاق" value={d(profile.joined)} />
                <Field label="المدينة" value={profile.city} />
                <Field label="العنوان" value={profile.address} />
                <Field label="العام الدراسي" value={profile.academicYear} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Headline numbers ----------------------------------------------- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="نسبة الحضور"
          value={`${attendance.rate}%`}
          icon={CalendarDays}
          tone="info"
        />
        <KpiCard
          label="المعدل العام"
          value={grades.average !== null ? `${grades.average}%` : "—"}
          icon={Award}
          tone="accent"
        />
        <KpiCard label="نقاط السلوك" value={behaviour.net} icon={Smile} tone="primary" />
        <KpiCard
          label="المتبقي عليه"
          value={money(billing.outstanding)}
          icon={CreditCard}
          tone="warm"
        />
      </div>

      {openAlerts.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="font-semibold text-amber-700">
              {openAlerts.length} تنبيه مفتوح على هذا الطالب
            </p>
            <p className="truncate text-amber-700/80">
              {openAlerts.map((a) => a.title || a.rule).join("، ")}
            </p>
          </div>
        </div>
      )}

      {/* Everything else, one tab per area ------------------------------ */}
      <div className="mt-6">
        <Tabs defaultValue="academics" dir="rtl">
          <TabsList className="mb-4 h-auto flex-wrap justify-start rounded-xl p-1">
            <TabsTrigger value="academics" className="rounded-lg">
              الأكاديمي
            </TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-lg">
              الحضور
            </TabsTrigger>
            <TabsTrigger value="assignments" className="rounded-lg">
              الواجبات والاختبارات
            </TabsTrigger>
            <TabsTrigger value="behaviour" className="rounded-lg">
              السلوك
            </TabsTrigger>
            <TabsTrigger value="health" className="rounded-lg">
              الصحة
            </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-lg">
              المالية
            </TabsTrigger>
            <TabsTrigger value="services" className="rounded-lg">
              الخدمات
            </TabsTrigger>
            <TabsTrigger value="timetable" className="rounded-lg">
              الجدول
            </TabsTrigger>
            <TabsTrigger value="family" className="rounded-lg">
              الأسرة والتسجيل
            </TabsTrigger>
            <TabsTrigger value="documents" className="rounded-lg">
              المستندات
            </TabsTrigger>
          </TabsList>

          {/* --- Academics --- */}
          <TabsContent value="academics" className="space-y-6">
            <SectionCard title="نتائج التقييم">
              {grades.results.length === 0 ? (
                <Empty title="لا توجد نتائج بعد" />
              ) : (
                <Table
                  head={["المادة", "الخطة", "الدرجة", "النسبة", "التقدير", "الفصل"]}
                  rows={grades.results.map((r) => [
                    <span className="font-medium">{r.course}</span>,
                    r.plan ?? "—",
                    `${r.score} / ${r.maxScore}`,
                    r.percentage !== null ? (
                      <div className="flex items-center gap-2">
                        <ProgressBar value={r.percentage} />
                        <span className="tabular-nums">{r.percentage}%</span>
                      </div>
                    ) : (
                      "—"
                    ),
                    r.grade ? <Pill tone="info">{r.grade}</Pill> : "—",
                    r.academicTerm ?? "—",
                  ])}
                />
              )}
            </SectionCard>

            <SectionCard title="سجل الدرجات التفصيلي">
              {grades.gradebook.length === 0 ? (
                <Empty title="لا توجد مدخلات" />
              ) : (
                <Table
                  head={["المادة", "المكوّن", "النوع", "الدرجة", "النسبة"]}
                  rows={grades.gradebook.map((g) => [
                    g.course,
                    <span className="font-medium">{g.component}</span>,
                    g.type ?? "—",
                    `${g.score} / ${g.maxScore}`,
                    <span className="tabular-nums">{g.percentage}%</span>,
                  ])}
                />
              )}
            </SectionCard>

            <SectionCard title={`المواد المسجّلة (${courses.length})`}>
              {courses.length === 0 ? (
                <Empty title="لا توجد مواد" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {courses.map((c) => (
                    <span
                      key={c.id}
                      className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm"
                    >
                      {c.course}
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* --- Attendance --- */}
          <TabsContent value="attendance" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-4">
              <KpiCard label="حاضر" value={attendance.present} icon={CalendarDays} tone="accent" />
              <KpiCard label="غائب" value={attendance.absent} icon={CalendarDays} tone="warm" />
              <KpiCard label="متأخر" value={attendance.late} icon={CalendarDays} tone="primary" />
              <KpiCard
                label="إجمالي الأيام"
                value={attendance.total}
                icon={CalendarDays}
                tone="info"
              />
            </div>
            <SectionCard title="آخر سجلات الحضور">
              {attendance.recent.length === 0 ? (
                <Empty title="لا توجد سجلات" />
              ) : (
                <Table
                  head={["التاريخ", "الحالة", "الشعبة"]}
                  rows={attendance.recent.map((a) => [
                    d(a.date),
                    <Pill
                      tone={
                        a.status === "Present"
                          ? "success"
                          : a.status === "Absent"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {a.status === "Present" ? "حاضر" : a.status === "Absent" ? "غائب" : a.status}
                    </Pill>,
                    a.group ?? "—",
                  ])}
                />
              )}
            </SectionCard>
          </TabsContent>

          {/* --- Assignments & quizzes --- */}
          <TabsContent value="assignments" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="واجبات مُسلّمة"
                value={assignments.submitted}
                icon={ClipboardList}
                tone="info"
              />
              <KpiCard
                label="واجبات مُصححة"
                value={assignments.graded}
                icon={ClipboardList}
                tone="accent"
              />
              <KpiCard
                label="متوسط الواجبات"
                value={assignments.averagePercent !== null ? `${assignments.averagePercent}%` : "—"}
                icon={Award}
                tone="primary"
              />
            </div>

            <SectionCard title="الواجبات">
              {assignments.items.length === 0 ? (
                <Empty title="لا توجد واجبات" />
              ) : (
                <Table
                  head={["الواجب", "الحالة", "تاريخ التسليم", "الدرجة", "الملاحظات"]}
                  rows={assignments.items.map((a) => [
                    <span className="font-medium">{a.title || a.assignment}</span>,
                    a.status ?? "—",
                    d(a.submittedOn),
                    a.maxScore ? `${a.score} / ${a.maxScore}` : "—",
                    <span className="text-muted-foreground">{a.feedback || "—"}</span>,
                  ])}
                />
              )}
            </SectionCard>

            <SectionCard title="محاولات الاختبارات القصيرة">
              {quizzes.length === 0 ? (
                <Empty title="لا توجد محاولات" />
              ) : (
                <Table
                  head={["الاختبار", "المحاولة", "الدرجة", "النسبة", "النتيجة", "التاريخ"]}
                  rows={quizzes.map((q) => [
                    <span className="font-medium">{q.title || q.quiz}</span>,
                    q.attempt,
                    `${q.score} / ${q.total}`,
                    <span className="tabular-nums">{q.percentage}%</span>,
                    <Pill tone={q.passed ? "success" : "danger"}>
                      {q.passed ? "ناجح" : "راسب"}
                    </Pill>,
                    d(q.submittedOn),
                  ])}
                />
              )}
            </SectionCard>
          </TabsContent>

          {/* --- Behaviour --- */}
          <TabsContent value="behaviour" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="نقاط إيجابية"
                value={behaviour.positivePoints}
                icon={Smile}
                tone="accent"
              />
              <KpiCard
                label="نقاط سلبية"
                value={behaviour.negativePoints}
                icon={AlertTriangle}
                tone="warm"
              />
              <KpiCard label="الصافي" value={behaviour.net} icon={Award} tone="primary" />
            </div>
            <SectionCard title="سجل السلوك">
              {behaviour.records.length === 0 ? (
                <Empty title="لا توجد ملاحظات سلوكية" />
              ) : (
                <Table
                  head={[
                    "التاريخ",
                    "النوع",
                    "الفئة",
                    "النقاط",
                    "الوصف",
                    "الإجراء",
                    "أُبلغ ولي الأمر",
                  ]}
                  rows={behaviour.records.map((b) => [
                    d(b.date),
                    b.type ?? "—",
                    b.category ?? "—",
                    <span className={b.points >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {b.points > 0 ? `+${b.points}` : b.points}
                    </span>,
                    <span className="text-muted-foreground">{b.description || "—"}</span>,
                    b.action ?? "—",
                    b.parentNotified ? (
                      <Pill tone="success">نعم</Pill>
                    ) : (
                      <Pill tone="muted">لا</Pill>
                    ),
                  ])}
                />
              )}
            </SectionCard>
          </TabsContent>

          {/* --- Health --- */}
          <TabsContent value="health" className="space-y-6">
            <SectionCard title="الملف الصحي">
              {!health.record ? (
                <Empty title="لا يوجد ملف صحي" />
              ) : (
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
                  <Field label="فصيلة الدم" value={health.record.bloodGroup} />
                  <Field
                    label="الطول"
                    value={health.record.heightCm ? `${health.record.heightCm} سم` : null}
                  />
                  <Field
                    label="الوزن"
                    value={health.record.weightKg ? `${health.record.weightKg} كغ` : null}
                  />
                  <Field label="آخر فحص" value={d(health.record.lastCheckup)} />
                  <Field label="أمراض مزمنة" value={health.record.conditions} />
                  <Field label="الحساسية" value={health.record.allergies} />
                  <Field label="أدوية" value={health.record.medications} />
                  <Field label="احتياجات خاصة" value={health.record.specialNeeds} />
                  <Field label="التطعيمات" value={health.record.immunisations} />
                  <Field label="جهة الطوارئ" value={health.record.emergencyContact} />
                  <Field label="هاتف الطوارئ" value={health.record.emergencyPhone} />
                  <Field label="الطبيب" value={health.record.physician} />
                  <Field label="هاتف الطبيب" value={health.record.physicianPhone} />
                  <Field label="ملاحظات" value={health.record.notes} />
                </div>
              )}
            </SectionCard>

            <SectionCard title="زيارات العيادة">
              {health.visits.length === 0 ? (
                <Empty title="لا توجد زيارات" />
              ) : (
                <Table
                  head={["التاريخ", "النوع", "الشكوى", "العلاج", "النتيجة", "أُبلغ ولي الأمر"]}
                  rows={health.visits.map((v) => [
                    d(v.date),
                    v.type ?? "—",
                    v.complaint ?? "—",
                    v.treatment ?? "—",
                    v.outcome ?? "—",
                    v.parentNotified ? (
                      <Pill tone="success">نعم</Pill>
                    ) : (
                      <Pill tone="muted">لا</Pill>
                    ),
                  ])}
                />
              )}
            </SectionCard>
          </TabsContent>

          {/* --- Billing --- */}
          <TabsContent value="billing" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="إجمالي المفوتر"
                value={money(billing.billed)}
                icon={CreditCard}
                tone="info"
              />
              <KpiCard
                label="المدفوع"
                value={money(billing.paid)}
                icon={CreditCard}
                tone="accent"
              />
              <KpiCard
                label="المتبقي"
                value={money(billing.outstanding)}
                icon={CreditCard}
                tone="warm"
              />
            </div>
            <SectionCard title="الفواتير">
              {billing.invoices.length === 0 ? (
                <Empty title="لا توجد فواتير" />
              ) : (
                <Table
                  head={["الفاتورة", "التاريخ", "الاستحقاق", "الإجمالي", "المتبقي", "الحالة"]}
                  rows={billing.invoices.map((inv) => [
                    <span className="font-mono text-xs">{inv.id}</span>,
                    d(inv.date),
                    <span>
                      {d(inv.dueDate)}
                      {inv.overdueDays > 0 && (
                        <Pill tone="danger">متأخر {inv.overdueDays} يوم</Pill>
                      )}
                    </span>,
                    money(inv.total),
                    money(inv.outstanding),
                    inv.draft ? (
                      <Pill tone="muted">مسودة</Pill>
                    ) : (
                      <Pill tone={inv.outstanding > 0 ? "warning" : "success"}>
                        {inv.outstanding > 0 ? "غير مسدد" : "مسدد"}
                      </Pill>
                    ),
                  ])}
                />
              )}
            </SectionCard>
          </TabsContent>

          {/* --- Services --- */}
          <TabsContent value="services" className="space-y-6">
            <SectionCard title="المكتبة">
              {services.library.length === 0 ? (
                <Empty title="لا توجد إعارات" />
              ) : (
                <Table
                  head={["الكتاب", "الحالة", "تاريخ الإعارة", "الاستحقاق", "الإرجاع"]}
                  rows={services.library.map((l) => [
                    <span className="font-medium">{l.book}</span>,
                    l.overdue ? (
                      <Pill tone="danger">متأخر</Pill>
                    ) : (
                      <Pill tone="muted">{l.status}</Pill>
                    ),
                    d(l.issued),
                    d(l.due),
                    l.returned ? d(l.returned) : "—",
                  ])}
                />
              )}
            </SectionCard>

            <SectionCard title="النقل">
              {services.transport.length === 0 ? (
                <Empty title="غير مشترك في النقل" />
              ) : (
                <Table
                  head={["المسار", "الموقف", "من", "إلى", "الحالة"]}
                  rows={services.transport.map((t) => [
                    <span className="font-medium">{t.route}</span>,
                    t.stop ?? "—",
                    d(t.from),
                    t.to ? d(t.to) : "—",
                    <Pill tone={t.active ? "success" : "muted"}>{t.active ? "نشط" : "منتهٍ"}</Pill>,
                  ])}
                />
              )}
            </SectionCard>

            <SectionCard title="الأنشطة">
              {services.activities.length === 0 ? (
                <Empty title="لا توجد أنشطة" />
              ) : (
                <Table
                  head={["النشاط", "الحالة", "موافقة ولي الأمر", "تاريخ التسجيل", "حضر"]}
                  rows={services.activities.map((a) => [
                    <span className="font-medium">{a.activity}</span>,
                    a.status ?? "—",
                    a.consent ?? "—",
                    d(a.enrolledOn),
                    a.attended ? <Pill tone="success">نعم</Pill> : <Pill tone="muted">لا</Pill>,
                  ])}
                />
              )}
            </SectionCard>
          </TabsContent>

          {/* --- Timetable --- */}
          <TabsContent value="timetable" className="space-y-6">
            <SectionCard title="الجدول الأسبوعي">
              {/* A week with nothing in it is still a week: the same rows, every
                  cell empty. Replacing the grid with a notice made a class
                  whose timetable is not built yet look like a broken screen. */}
              {timetableGrid.periodRows?.length || timetableGrid.periods.length ? (
                <>
                  {timetableGrid.cells.length === 0 && (
                    <p className="mb-3 rounded-xl border border-dashed border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                      لا توجد حصص مجدولة — الشبكة تعرض أوقات الحصص كما هي معرّفة.
                    </p>
                  )}
                  <WeeklyGrid timetable={timetableGrid} />
                </>
              ) : (
                <Empty title="لا توجد حصص" />
              )}
            </SectionCard>

            {timetable.length > 0 && (
              <SectionCard title="آخر الحصص بالتاريخ">
                <Table
                  head={["التاريخ", "المادة", "من", "إلى", "المعلم", "القاعة"]}
                  rows={timetable.slice(0, 20).map((t) => [
                    d(t.date),
                    <span className="font-medium">{t.course}</span>,
                    <span dir="ltr" className="tabular-nums">
                      {t.from}
                    </span>,
                    <span dir="ltr" className="tabular-nums">
                      {t.to}
                    </span>,
                    t.instructor ?? "—",
                    t.room ?? "—",
                  ])}
                />
              </SectionCard>
            )}
          </TabsContent>

          {/* --- Family & enrolment --- */}
          <TabsContent value="family" className="space-y-6">
            <SectionCard title="أولياء الأمور">
              {guardians.length === 0 ? (
                <Empty title="لا يوجد أولياء أمور مرتبطين" />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {guardians.map((g) => (
                    <div key={g.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold">{g.name}</p>
                        {g.relation && <Pill tone="info">{g.relation}</Pill>}
                      </div>
                      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        {g.phone && (
                          <p className="flex items-center gap-2">
                            <Phone className="size-3.5" />
                            <a href={`tel:${g.phone}`} dir="ltr" className="hover:text-primary">
                              {g.phone}
                            </a>
                          </p>
                        )}
                        {g.email && (
                          <p className="flex items-center gap-2">
                            <Mail className="size-3.5" />
                            <a href={`mailto:${g.email}`} dir="ltr" className="hover:text-primary">
                              {g.email}
                            </a>
                          </p>
                        )}
                        {g.occupation && (
                          <p className="flex items-center gap-2">
                            <User className="size-3.5" />
                            {g.occupation}
                          </p>
                        )}
                        {g.hasLogin && (
                          <Pill tone="success">
                            <ShieldCheck className="ml-1 inline size-3" />
                            لديه حساب
                          </Pill>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="سجل التسجيل">
              {enrollments.length === 0 ? (
                <Empty title="لا توجد تسجيلات" />
              ) : (
                <Table
                  head={["الصف", "الشعبة", "العام", "الفصل", "التاريخ", "الحالة"]}
                  rows={enrollments.map((e) => [
                    <span className="font-medium">{e.program}</span>,
                    e.batch ?? "—",
                    e.academicYear ?? "—",
                    e.academicTerm ?? "—",
                    d(e.date),
                    <Pill tone={e.submitted ? "success" : "muted"}>
                      {e.submitted ? "معتمد" : "مسودة"}
                    </Pill>,
                  ])}
                />
              )}
            </SectionCard>

            {alerts.length > 0 && (
              <SectionCard title="التنبيهات">
                <Table
                  head={["التنبيه", "الخطورة", "الحالة", "تاريخ الإطلاق", "تاريخ الإغلاق"]}
                  rows={alerts.map((a) => [
                    <span className="font-medium">{a.title || a.rule}</span>,
                    a.severity ?? "—",
                    <Pill
                      tone={(a.status ?? "").toLowerCase() === "resolved" ? "success" : "warning"}
                    >
                      {a.status}
                    </Pill>,
                    d(a.raisedOn),
                    a.resolvedOn ? d(a.resolvedOn) : "—",
                  ])}
                />
              </SectionCard>
            )}
          </TabsContent>
          <TabsContent value="documents" className="space-y-6">
            <AccountCredentials doctype="Student" name={profile.id} canManage={backOffice} />
            <Attachments
              doctype="Student"
              name={profile.id}
              title="مستندات الطالب"
              description="شهادة الميلاد، صورة الهوية، الشهادات السابقة، وأي وثائق أخرى."
            />
            {enrollments[0] && (
              <Attachments
                doctype="Program Enrollment"
                name={enrollments[0].id}
                title="مستندات التسجيل"
                description={`مرفقات تسجيل ${enrollments[0].program}.`}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {assessing && (
        <StudentEvaluationDialog
          student={profile.id}
          studentName={profile.name}
          {...(profile.section ? { studentGroup: profile.section } : {})}
          onClose={() => setAssessing(false)}
        />
      )}
    </>
  );
}

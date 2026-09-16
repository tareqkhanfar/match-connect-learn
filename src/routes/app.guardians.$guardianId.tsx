import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CreditCard,
  GraduationCap,
  Mail,
  Phone,
  Printer,
  Users,
} from "lucide-react";
import { Avatar, KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { AccountCredentials } from "@/components/shared/account-credentials";
import { Attachments } from "@/components/shared/attachments";
import { useApp } from "@/lib/app-context";
import { isBackOffice, money } from "@/lib/roles";
import { useGuardianDossier } from "@/lib/api/hooks";
import { EditRecordButton, RecordFields } from "@/components/shared/record-fields";

export const Route = createFileRoute("/app/guardians/$guardianId")({
  component: GuardianProfile,
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

function GuardianProfile() {
  const { guardianId } = Route.useParams();
  const { role } = useApp();
  const { data, isLoading, error, refetch } = useGuardianDossier(guardianId);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return <EmptyBlock title="لا توجد بيانات" icon={<Users className="size-6" />} />;

  const { profile, children, summary } = data;
  const backOffice = isBackOffice(role);

  return (
    <>
      <PageHeader
        title={profile.name}
        subtitle={[profile.occupation, profile.id].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/app/guardians"
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

      {/* Identity ------------------------------------------------------- */}
      <div className="mt-6 card-surface p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={profile.name} src={profile.image} className="size-20 rounded-2xl text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{profile.name}</h2>
              {profile.hasLogin && <Pill tone="info">لديه حساب دخول</Pill>}
              {summary.needsAttention > 0 && (
                <Pill tone="warning">{summary.needsAttention} أبناء عليهم مستحقات</Pill>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="رقم ولي الأمر" value={profile.id} />
              <Field label="رقم الهوية" value={profile.idNumber} />
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
                label="هاتف بديل"
                value={profile.altPhone ? <span dir="ltr">{profile.altPhone}</span> : null}
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
              <Field label="الجنس" value={profile.gender} />
              <Field label="الجنسية" value={profile.nationality} />
              <Field label="تاريخ الميلاد" value={d(profile.birthDate)} />
              <Field label="المهنة" value={profile.occupation} />
              <Field label="المسمى الوظيفي" value={profile.designation} />
              <Field label="المؤهل" value={profile.education} />
              <Field label="عنوان العمل" value={profile.workAddress} />
            </div>
          </div>
        </div>
      </div>

      {backOffice && (
        <RecordFields
          doctype="Guardian"
          name={profile.id}
          editing={editing}
          onEditingChange={setEditing}
          onSaved={() => refetch()}
        />
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="عدد الأبناء" value={summary.children} icon={Users} tone="primary" />
        <KpiCard
          label="إجمالي المستحقات"
          value={money(summary.outstanding)}
          icon={CreditCard}
          tone={summary.outstanding > 0 ? "warm" : "accent"}
        />
        <KpiCard
          label="أبناء عليهم مستحقات"
          value={summary.needsAttention}
          icon={Briefcase}
          tone="info"
        />
      </div>

      {/* The children — the reason this page exists ---------------------- */}
      <div className="mt-6">
        <SectionCard title={`الأبناء (${children.length})`}>
          {children.length === 0 ? (
            <EmptyBlock
              title="لا يوجد أبناء مرتبطون"
              description="اربط الطلاب بولي الأمر من شاشة أولياء الأمور."
              icon={<GraduationCap className="size-6" />}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {children.map((c) => (
                <Link
                  key={c.id}
                  to="/app/students/$studentId"
                  params={{ studentId: c.id }}
                  className="rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} src={c.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{c.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[c.program, c.batch && `شعبة ${c.batch}`, c.relation]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {!c.active && <Pill tone="muted">غير نشط</Pill>}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-secondary/50 p-2">
                      <p className="text-[10px] text-muted-foreground">الحضور</p>
                      <p className="text-sm font-bold tabular-nums">{c.attendanceRate}%</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-2">
                      <p className="text-[10px] text-muted-foreground">الغياب</p>
                      <p className="text-sm font-bold tabular-nums">{c.absences}</p>
                    </div>
                    <div
                      className={`rounded-lg p-2 ${
                        c.outstanding > 0 ? "bg-amber-500/15" : "bg-secondary/50"
                      }`}
                    >
                      <p className="text-[10px] text-muted-foreground">المستحق</p>
                      <p className="text-sm font-bold tabular-nums">{money(c.outstanding)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {backOffice && (
        <div className="mt-6 space-y-6">
          <AccountCredentials doctype="Guardian" name={profile.id} canManage />
          <Attachments
            doctype="Guardian"
            name={profile.id}
            title="مستندات ولي الأمر"
            description="صورة الهوية، إثبات العنوان، أو أي وثيقة أخرى."
          />
        </div>
      )}
    </>
  );
}

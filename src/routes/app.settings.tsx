import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  LayoutGrid,
  MessagesSquare,
  Save,
  School,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/error-message";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { MailPolicySettings } from "@/components/shared/mail-policy-settings";
import { PrintDesignsSection } from "@/components/settings/print-designs";
import { useApp } from "@/lib/app-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DashboardSkeleton, ErrorState } from "@/components/shared/states";
import { useSaveSettings, useSetOpenMessaging, useSettings } from "@/lib/api/hooks";
import { useMyWorkspaces } from "@/lib/api/workspaces";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — Match Education" },
      {
        name: "description",
        content: "إعدادات المدرسة، السنة الدراسية والفصول، والأدوار والصلاحيات.",
      },
      { property: "og:title", content: "الإعدادات — Match Education" },
      { property: "og:description", content: "اضبط بيانات المدرسة والعام الدراسي والصلاحيات." },
    ],
  }),
  component: SettingsPage,
});

const COUNT_LABELS: Record<string, string> = {
  students: "الطلاب",
  instructors: "المعلمون",
  guardians: "أولياء الأمور",
  programs: "الصفوف",
  courses: "المواد",
  student_groups: "الشُعب",
};

function SettingsPage() {
  const { role, access } = useApp();
  const { data, isLoading, error, refetch } = useSettings();
  const saveSettings = useSaveSettings();
  const setOpenMessaging = useSetOpenMessaging();
  const workspaces = useMyWorkspaces();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    current_year: "",
    current_term: "",
  });

  // Seed the form once the server values arrive.
  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.school.name ?? "",
      email: data.school.email ?? "",
      phone: data.school.phone ?? "",
      current_year: data.academic.current_year ?? "",
      current_term: data.academic.current_term ?? "",
    });
  }, [data]);

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    try {
      await saveSettings.mutateAsync({ ...form, company: data!.school.company });
      toast.success("تم حفظ الإعدادات");
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr ||
        (err as Error).message ||
        "تعذّر حفظ الإعدادات";
      toast.error(message);
    }
  }

  // Only offer terms that belong to the selected year.
  const termsForYear = data.academic.terms.filter(
    (t) => !form.current_year || t.academic_year === form.current_year,
  );

  return (
    <>
      <PageHeader
        title="الإعدادات"
        subtitle="بيانات المدرسة والعام الدراسي والصلاحيات"
        actions={
          <button
            onClick={save}
            disabled={saveSettings.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            <Save className="size-4" />
            {saveSettings.isPending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
          </button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="بيانات المدرسة"
          description="المعلومات الأساسية"
          actions={<School className="size-4 text-muted-foreground" />}
        >
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>اسم المدرسة</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="rounded-xl"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="num rounded-xl"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>الدولة</Label>
                <Input value={data.school.country ?? "—"} disabled className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>العملة</Label>
                <Input
                  value={data.school.currency ?? "—"}
                  disabled
                  className="rounded-xl"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="العام الدراسي" description="السنة والفصل النشِط حالياً">
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>السنة الدراسية</Label>
              <Select
                value={form.current_year}
                onValueChange={(v) => {
                  set("current_year", v);
                  // Clear the term when the year changes so they stay consistent.
                  set("current_term", "");
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="اختر السنة" />
                </SelectTrigger>
                <SelectContent>
                  {data.academic.years.map((y) => (
                    <SelectItem key={y.name} value={y.name}>
                      {y.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الفصل الدراسي</Label>
              <Select value={form.current_term} onValueChange={(v) => set("current_term", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="اختر الفصل" />
                </SelectTrigger>
                <SelectContent>
                  {termsForYear.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              تُستخدم هذه القيم كافتراضي في التقارير ولوحات التحكم.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard
          title="صلاحيات المراسلة"
          description="من يستطيع كل دور مراسلته — الشبكة تُطبَّق على البريد فوراً"
        >
          <MailPolicySettings canEdit={role === "admin"} />
        </SectionCard>
      </div>

      {/* Workspaces and built pages decide what a whole department works
          from; the Administrator account alone builds them. */}
      {workspaces.data?.canBuild && (
        <div className="mt-5">
          <SectionCard
            title="مساحات العمل والصفحات"
            description="مساحة عمل لكل قسم بأزرارها، وصفحة لكل نموذج — وإسنادها للمستخدمين"
            actions={<LayoutGrid className="size-4 text-muted-foreground" />}
          >
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                ابنِ مساحة عمل لقسم (الإرشاد مثلاً) بأزرار تفتح شاشات النظام أو صفحات مبنية من
                النماذج، ثم أسندها لمستخدمين أو لأدوار كاملة وحدّد ما يبدأ به كل مستخدم. من لا مساحة
                له يبقى على القائمة الأساسية لدوره.
              </p>
              <Link
                to="/app/workspaces"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                <LayoutGrid className="size-4" />
                إدارة مساحات العمل والصفحات
              </Link>
            </div>
          </SectionCard>
        </div>
      )}

      {/* How the system's printed pages look — the administration's alone. */}
      {role === "admin" && (
        <div className="mt-5">
          <PrintDesignsSection />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="الأدوار والصلاحيات"
          description="عدد المستخدمين في كل دور"
          actions={<ShieldCheck className="size-4 text-muted-foreground" />}
        >
          <ul className="space-y-2.5">
            {data.roles.map((r) => (
              <li
                key={r.role}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.label}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    {r.role}
                  </p>
                </div>
                <Pill tone={r.users > 0 ? "primary" : "muted"}>{r.users} مستخدم</Pill>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="سياسة المراسلة"
          description="من يستطيع الطالب مراسلته"
          actions={<MessagesSquare className="size-4 text-muted-foreground" />}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">السماح للطالب بمراسلة الجميع</p>
              <p className="mt-1 text-xs text-muted-foreground">
                عند الإيقاف يستطيع الطالب مراسلة معلميه وإدارة المدرسة فقط. في كل الأحوال تستطيع
                الإدارة الاطلاع على محادثات الطلاب.
              </p>
            </div>
            <Switch
              checked={data.policies?.student_open_messaging ?? false}
              disabled={setOpenMessaging.isPending}
              onCheckedChange={async (on) => {
                try {
                  await setOpenMessaging.mutateAsync(on);
                  toast.success(on ? "تم السماح بالمراسلة المفتوحة" : "تم تقييد مراسلة الطلاب");
                } catch (err) {
                  const message =
                    (err as { messageAr?: string }).messageAr ||
                    (err as Error).message ||
                    "تعذّر تحديث السياسة";
                  toast.error(message);
                }
              }}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="الحضور والغياب"
          description="من يأخذ الحضور"
          actions={<ClipboardCheck className="size-4 text-muted-foreground" />}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">الحضور لمربي الصف فقط</p>
              <p className="mt-1 text-xs text-muted-foreground">
                عند التفعيل لا يأخذ الحضور من المعلمين إلا مربي الصف، ولشعبته فقط، إضافةً إلى
                الإدارة والسكرتارية. عند الإيقاف يأخذه كل معلم للشعب التي يدرّسها.
              </p>
            </div>
            <Switch
              checked={data.policies?.attendance_homeroom_only ?? false}
              disabled={saveSettings.isPending}
              onCheckedChange={async (on) => {
                try {
                  await saveSettings.mutateAsync({ attendance_homeroom_only: on ? 1 : 0 });
                  toast.success(on ? "أصبح الحضور لمربي الصف فقط" : "أصبح الحضور لكل معلم في شعبه");
                } catch (err) {
                  toast.error(errorMessage(err, "تعذّر تحديث الإعداد"));
                }
              }}
            />
          </div>
        </SectionCard>

        {/* Opening the money to the vice principal is the principal's call —
            the vice principal shares this screen but not this switch. */}
        {!access.staffRole && (
          <SectionCard
            title="نائب المدير"
            description="صلاحيات نائب المدير على كامل المدرسة ما عدا الأمور المالية"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 text-sm">
                <p className="font-medium">إظهار الأمور المالية لنائب المدير</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  معطّل افتراضياً: لا يرى نائب المدير الرسوم والفواتير وأرصدة الطلاب. عند التفعيل
                  تظهر له الشاشات المالية كما تظهر للمدير.
                </p>
              </div>
              <Switch
                checked={data.policies?.vp_sees_finance ?? false}
                disabled={saveSettings.isPending}
                onCheckedChange={async (on) => {
                  try {
                    await saveSettings.mutateAsync({ vp_sees_finance: on ? 1 : 0 });
                    toast.success(
                      on
                        ? "أصبحت الأمور المالية ظاهرة لنائب المدير"
                        : "أُخفيت الأمور المالية عن نائب المدير",
                    );
                  } catch (err) {
                    toast.error(errorMessage(err, "تعذّر تحديث الإعداد"));
                  }
                }}
              />
            </div>
          </SectionCard>
        )}

        <SectionCard title="ملخص النظام" description="أعداد السجلات الحالية">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.counts).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">{COUNT_LABELS[key] ?? key}</p>
                <p className="num mt-1 text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

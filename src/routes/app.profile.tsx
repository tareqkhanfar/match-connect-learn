import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Save, ShieldCheck, User as UserIcon } from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DashboardSkeleton, ErrorState } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useChangePassword, useMyProfile, useSaveMyProfile } from "@/lib/api/hooks";

export const Route = createFileRoute("/app/profile")({
  head: () => ({
    meta: [
      { title: "ملفي الشخصي — Match Education" },
      {
        name: "description",
        content: "بياناتك الشخصية، تفضيلات الإشعارات والعرض، وتغيير كلمة المرور.",
      },
      { property: "og:title", content: "ملفي الشخصي — Match Education" },
      { property: "og:description", content: "أدر حسابك وتفضيلاتك." },
    ],
  }),
  component: ProfilePage,
});

/** Labels for the record behind the login, per persona. */
const LINKED_LABELS: Record<string, string> = {
  id: "الرقم",
  name: "الاسم",
  email: "البريد",
  phone: "الهاتف",
  date_of_birth: "تاريخ الميلاد",
  gender: "الجنس",
  blood_group: "فصيلة الدم",
  program: "الصف",
  batch: "الشعبة",
  academic_year: "العام الدراسي",
  department: "القسم",
  groups: "عدد الشُعب",
  occupation: "المهنة",
  children: "عدد الأبناء",
};

const LINKED_TITLES: Record<string, string> = {
  student: "بيانات الطالب",
  instructor: "بيانات المعلم",
  guardian: "بيانات ولي الأمر",
};

const NOTIFY_FIELDS: Array<{ key: string; label: string; hint: string }> = [
  {
    key: "notify_announcements",
    label: "إعلانات المدرسة",
    hint: "تنبيه عند نشر إعلان جديد",
  },
  { key: "notify_grades", label: "العلامات", hint: "تنبيه عند رصد علامة جديدة" },
  { key: "notify_attendance", label: "الحضور والغياب", hint: "تنبيه عند تسجيل غياب" },
  { key: "notify_email", label: "نسخة بالبريد", hint: "إرسال نسخة من التنبيهات إلى بريدك" },
];

function ProfilePage() {
  const { data, isLoading, error, refetch } = useMyProfile();
  const saveProfile = useSaveMyProfile();
  const changePassword = useChangePassword();

  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });

  // Seed the form once the profile arrives.
  useEffect(() => {
    if (!data) return;
    setForm({
      first_name: data.profile.first_name ?? "",
      last_name: data.profile.last_name ?? "",
      phone: data.profile.phone ?? "",
    });
    setPrefs(data.preferences);
  }, [data]);

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const p = data!.profile;
  const linked = p.linked as Record<string, unknown> | null;

  async function save() {
    try {
      await saveProfile.mutateAsync({ ...form, preferences: prefs });
      toast.success("تم حفظ التغييرات");
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر الحفظ";
      toast.error(message);
    }
  }

  async function submitPassword() {
    if (passwords.next !== passwords.confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    try {
      await changePassword.mutateAsync({
        current_password: passwords.current,
        new_password: passwords.next,
      });
      toast.success("تم تغيير كلمة المرور");
      setPasswords({ current: "", next: "", confirm: "" });
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr ||
        (err as Error).message ||
        "تعذّر تغيير كلمة المرور";
      toast.error(message);
    }
  }

  return (
    <>
      <PageHeader
        title="ملفي الشخصي"
        subtitle="بياناتك، تفضيلاتك، وأمان حسابك"
        actions={
          <button
            onClick={save}
            disabled={saveProfile.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-60"
          >
            <Save className="size-4" />
            {saveProfile.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <SectionCard
            title="بيانات الحساب"
            description={p.email}
            actions={<UserIcon className="size-4 text-muted-foreground" />}
          >
            <div className="mb-4 flex items-center gap-3">
              {p.image ? (
                <img src={p.image} alt="" className="size-14 rounded-xl object-cover" />
              ) : (
                <div className="grid size-14 place-items-center rounded-xl bg-brand-gradient text-lg font-bold text-primary-foreground">
                  {p.full_name.trim().slice(0, 2)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{p.full_name}</p>
                <Pill tone="primary">{p.persona_label}</Pill>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>الاسم الأول</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>اسم العائلة</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="num rounded-xl"
                  placeholder="05xxxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input value={p.email} disabled className="rounded-xl" />
                <p className="text-[11px] text-muted-foreground">يغيّره مدير المدرسة فقط.</p>
              </div>
            </div>
          </SectionCard>

          {linked && (
            <SectionCard
              title={LINKED_TITLES[String(linked["type"])] ?? "البيانات المرتبطة"}
              description="من سجلات المدرسة"
            >
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {Object.entries(linked)
                  .filter(([k, v]) => k !== "type" && v !== null && v !== "")
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-3 border-b border-border pb-2"
                    >
                      <dt className="text-xs text-muted-foreground">{LINKED_LABELS[k] ?? k}</dt>
                      <dd className="num truncate text-sm font-medium">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
            </SectionCard>
          )}
        </div>

        <div className="space-y-5">
          <SectionCard title="التنبيهات" description="اختر ما تريد أن تُنبَّه عليه">
            <ul className="space-y-3">
              {NOTIFY_FIELDS.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                  </div>
                  <Switch
                    checked={prefs[f.key] === "1"}
                    onCheckedChange={(on) => setPrefs((s) => ({ ...s, [f.key]: on ? "1" : "0" }))}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="العرض" description="تفضيلات الواجهة">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>اللغة</Label>
                <SearchableSelect
                  options={[
                    { value: "ar", label: "العربية", code: "AR" },
                    { value: "en", label: "English", code: "EN" },
                  ]}
                  value={prefs["language"] ?? "ar"}
                  onChange={(v) => setPrefs((s) => ({ ...s, language: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>كثافة العرض</Label>
                <SearchableSelect
                  options={[
                    { value: "comfortable", label: "مريح" },
                    { value: "compact", label: "مضغوط" },
                  ]}
                  value={prefs["density"] ?? "comfortable"}
                  onChange={(v) => setPrefs((s) => ({ ...s, density: v }))}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="كلمة المرور"
            description="غيّرها بانتظام"
            actions={<ShieldCheck className="size-4 text-muted-foreground" />}
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>كلمة المرور الحالية</Label>
                <Input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords((s) => ({ ...s, current: e.target.value }))}
                  className="rounded-xl"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>كلمة المرور الجديدة</Label>
                <Input
                  type="password"
                  value={passwords.next}
                  onChange={(e) => setPasswords((s) => ({ ...s, next: e.target.value }))}
                  className="rounded-xl"
                  autoComplete="new-password"
                />
                <p className="text-[11px] text-muted-foreground">٨ أحرف على الأقل.</p>
              </div>
              <div className="space-y-1.5">
                <Label>تأكيد كلمة المرور</Label>
                <Input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords((s) => ({ ...s, confirm: e.target.value }))}
                  className="rounded-xl"
                  autoComplete="new-password"
                />
              </div>
              <button
                onClick={submitPassword}
                disabled={
                  changePassword.isPending ||
                  !passwords.current ||
                  !passwords.next ||
                  !passwords.confirm
                }
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-secondary hover:shadow-soft active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound className="size-4" />
                {changePassword.isPending ? "جارٍ التغيير…" : "تغيير كلمة المرور"}
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

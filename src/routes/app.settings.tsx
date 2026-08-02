import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roleLabels } from "@/lib/roles";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — Match Education" },
      {
        name: "description",
        content: "إعدادات السنة الدراسية والفصول وبيانات المدرسة والأدوار والصلاحيات.",
      },
      { property: "og:title", content: "الإعدادات — Match Education" },
      { property: "og:description", content: "اضبط السنة الدراسية والصلاحيات وبيانات المدرسة." },
    ],
  }),
  component: SettingsPage,
});

const permissions = [
  { label: "إدارة الطلاب والمعلمين", roles: ["admin"] },
  { label: "تسجيل الحضور", roles: ["admin", "teacher"] },
  { label: "إدخال الدرجات", roles: ["admin", "teacher"] },
  { label: "إدارة الرسوم المالية", roles: ["admin"] },
  { label: "عرض التقارير", roles: ["admin", "teacher"] },
  { label: "متابعة الأبناء", roles: ["parent"] },
];

function SettingsPage() {
  return (
    <>
      <PageHeader
        title="الإعدادات"
        subtitle="بيانات المدرسة، السنة الدراسية، والأدوار والصلاحيات"
        actions={
          <button
            onClick={() => toast.success("تم حفظ الإعدادات")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Save className="size-4" />
            حفظ التغييرات
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="بيانات المدرسة">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>اسم المدرسة</Label>
              <Input defaultValue="مدرسة Match Education النموذجية" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>المدينة</Label>
              <Input defaultValue="رام الله" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>الهاتف</Label>
              <Input defaultValue="022951234" className="num rounded-xl" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>البريد الرسمي</Label>
              <Input defaultValue="info@match-edu.ps" className="rounded-xl" dir="ltr" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="السنة الدراسية والفصول">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>السنة الدراسية</Label>
              <Select defaultValue="2025-2026">
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-2026">٢٠٢٥ / ٢٠٢٦</SelectItem>
                  <SelectItem value="2024-2025">٢٠٢٤ / ٢٠٢٥</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الفصل الحالي</Label>
              <Select defaultValue="t2">
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="t1">الفصل الأول</SelectItem>
                  <SelectItem value="t2">الفصل الثاني</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>بداية العام</Label>
              <Input defaultValue="2025-09-01" className="num rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>نهاية العام</Label>
              <Input defaultValue="2026-06-15" className="num rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>العملة</Label>
              <Input defaultValue="شيكل ₪" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>حد الغياب المسموح</Label>
              <Input defaultValue="12" className="num rounded-xl" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="الأدوار والصلاحيات"
          description="صلاحيات كل دور في النظام"
          className="lg:col-span-2"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-3 font-semibold">الصلاحية</th>
                  <th className="pb-3 font-semibold">الأدوار المسموحة</th>
                  <th className="pb-3 font-semibold">مُفعّلة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {permissions.map((p) => (
                  <tr key={p.label}>
                    <td className="py-3 font-medium">{p.label}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.roles.map((r) => (
                          <Pill key={r} tone="primary">
                            {roleLabels[r as keyof typeof roleLabels]}
                          </Pill>
                        ))}
                      </div>
                    </td>
                    <td className="py-3">
                      <Switch defaultChecked />
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

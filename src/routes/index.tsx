import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GraduationCap, Users, BookOpen, HeartHandshake, ShieldCheck, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { roleLabels, type Role } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — Match Education" },
      { name: "description", content: "سجّل الدخول إلى نظام Match Education لإدارة المدرسة: الطلاب، الحضور، الدرجات والرسوم." },
      { property: "og:title", content: "تسجيل الدخول — Match Education" },
      { property: "og:description", content: "بوابة الدخول لمديري المدارس والمعلمين والطلاب وأولياء الأمور." },
    ],
  }),
  component: LoginPage,
});

const roleCards: { role: Role; icon: typeof Users; hint: string }[] = [
  { role: "admin", icon: ShieldCheck, hint: "إدارة كاملة للمدرسة" },
  { role: "teacher", icon: BookOpen, hint: "الصفوف والحضور والدرجات" },
  { role: "student", icon: GraduationCap, hint: "جدولي ودرجاتي وواجباتي" },
  { role: "parent", icon: HeartHandshake, hint: "متابعة الأبناء" },
];

function LoginPage() {
  const { signIn } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("admin");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    signIn(role);
    navigate({ to: "/app" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-sidebar bg-mesh p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-brand-gradient text-primary-foreground shadow-glow">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <p className="text-lg font-bold text-sidebar-foreground">Match Education</p>
            <p className="text-xs text-sidebar-foreground/60">نظام إدارة المدارس المتكامل</p>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="text-4xl font-extrabold leading-snug text-sidebar-foreground">
            مدرستك بالكامل
            <span className="block text-primary"> في مكان واحد ذكي</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/70">
            من تسجيل الحضور اليومي إلى بطاقات الدرجات والرسوم المالية والتواصل مع أولياء الأمور — كل ذلك بواجهة عربية
            أنيقة وسريعة.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { n: "٦٤٨", l: "طالب وطالبة" },
              { n: "٢٤", l: "معلماً ومعلمة" },
              { n: "٩٤٪", l: "حضور اليوم" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 px-4 py-3 backdrop-blur">
                <p className="text-2xl font-bold text-sidebar-foreground">{s.n}</p>
                <p className="mt-1 text-xs text-sidebar-foreground/60">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/40">© ٢٠٢٦ Match Education — جميع الحقوق محفوظة</p>
      </div>

      <div className="flex items-center justify-center bg-background px-5 py-12">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-11 place-items-center rounded-2xl bg-brand-gradient text-primary-foreground">
              <GraduationCap className="size-5" />
            </div>
            <p className="text-lg font-bold">Match Education</p>
          </div>

          <h2 className="text-2xl font-bold">مرحباً بعودتك 👋</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">اختر دورك وسجّل الدخول لمتابعة يومك الدراسي.</p>

          <div className="mt-7 space-y-2">
            <Label className="text-sm font-semibold">اختر الدور</Label>
            <div className="grid grid-cols-2 gap-3">
              {roleCards.map((c) => (
                <button
                  type="button"
                  key={c.role}
                  onClick={() => setRole(c.role)}
                  className={cn(
                    "rounded-2xl border p-3.5 text-right transition-all duration-200",
                    role === c.role
                      ? "border-primary bg-primary-soft shadow-soft"
                      : "border-border bg-card hover:border-primary/40 hover:bg-secondary/60",
                  )}
                >
                  <c.icon className={cn("size-5", role === c.role ? "text-primary" : "text-muted-foreground")} />
                  <p className="mt-2 text-sm font-bold">{roleLabels[c.role]}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{c.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" defaultValue="admin@match-edu.ps" className="h-11 rounded-xl" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" defaultValue="123456" className="h-11 rounded-xl" required />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <input type="checkbox" className="size-4 rounded accent-primary" defaultChecked />
              تذكّرني
            </label>
            <button type="button" className="font-medium text-primary hover:underline">
              نسيت كلمة المرور؟
            </button>
          </div>

          <button
            type="submit"
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-bold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            دخول إلى النظام
            <ArrowLeft className="size-4" />
          </button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            بيانات العرض جاهزة — اضغط دخول لتجربة النظام كاملاً.
          </p>
        </form>
      </div>
    </div>
  );
}

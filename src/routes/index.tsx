import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  GraduationCap,
  BookOpen,
  HeartHandshake,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — Match Education" },
      {
        name: "description",
        content:
          "سجّل الدخول إلى نظام Match Education لإدارة المدرسة: الطلاب، الحضور، الدرجات والرسوم.",
      },
      { property: "og:title", content: "تسجيل الدخول — Match Education" },
      {
        property: "og:description",
        content: "بوابة الدخول لمديري المدارس والمعلمين والطلاب وأولياء الأمور.",
      },
    ],
  }),
  component: LoginPage,
});

// Shown as context only — the actual role comes from the account's own
// permissions on the backend, never from a choice made here.
const roleHints = [
  { icon: ShieldCheck, label: "مدير المدرسة", hint: "إدارة كاملة للمدرسة" },
  { icon: BookOpen, label: "معلم", hint: "الصفوف والحضور والدرجات" },
  { icon: GraduationCap, label: "طالب", hint: "جدولي ودرجاتي وواجباتي" },
  { icon: HeartHandshake, label: "ولي أمر", hint: "متابعة الأبناء" },
];

function LoginPage() {
  const { signIn, signingIn, signInError, signedIn, ready } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Already signed in? Skip the login screen.
  useEffect(() => {
    if (ready && signedIn) navigate({ to: "/app" });
  }, [ready, signedIn, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await signIn(email, password);
      navigate({ to: "/app" });
    } catch {
      // The error message is surfaced from context below.
    }
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
            من تسجيل الحضور اليومي إلى بطاقات الدرجات والرسوم المالية والتواصل مع أولياء الأمور — كل
            ذلك بواجهة عربية أنيقة وسريعة.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { n: "٦٤٨", l: "طالب وطالبة" },
              { n: "٢٤", l: "معلماً ومعلمة" },
              { n: "٩٤٪", l: "حضور اليوم" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 px-4 py-3 backdrop-blur"
              >
                <p className="text-2xl font-bold text-sidebar-foreground">{s.n}</p>
                <p className="mt-1 text-xs text-sidebar-foreground/60">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/40">
          © ٢٠٢٦ Match Education — جميع الحقوق محفوظة
        </p>
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
          <p className="mt-1.5 text-sm text-muted-foreground">
            سجّل الدخول بحسابك — يتم تحديد صلاحياتك تلقائياً حسب دورك في المدرسة.
          </p>

          <div className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">اسم المستخدم أو البريد الإلكتروني</Label>
              <Input
                id="email"
                // Deliberately not type="email": accounts issued by the school
                // log in with a username like st1260342, and the browser's own
                // validation would reject it before the request is ever sent.
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="st1260342 أو name@school.ps"
                className="h-11 rounded-xl"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-11 rounded-xl"
                required
              />
            </div>
          </div>

          {signInError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-3.5 py-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{signInError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={signingIn}
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-bold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {signingIn ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                جارٍ تسجيل الدخول…
              </>
            ) : (
              <>
                دخول إلى النظام
                <ArrowLeft className="size-4" />
              </>
            )}
          </button>

          <div className="mt-7 grid grid-cols-2 gap-3">
            {roleHints.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-border bg-card p-3.5 text-right"
              >
                <c.icon className="size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-bold">{c.label}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{c.hint}</p>
              </div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}

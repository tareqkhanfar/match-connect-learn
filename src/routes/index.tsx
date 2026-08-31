import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  GraduationCap,
  BookOpen,
  HeartHandshake,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginBackdrop } from "@/components/auth/login-backdrop";

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

const stats = [
  { n: "٦٤٨", l: "طالب وطالبة" },
  { n: "٢٤", l: "معلماً ومعلمة" },
  { n: "٩٤٪", l: "حضور اليوم" },
];

function Logo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/brand/match-systems-logo.png"
      alt="Match Systems"
      className={className}
      // The mark is decorative next to the wordmark, but it is also the only
      // branding on mobile, so it keeps a real alt text.
      width={256}
      height={217}
    />
  );
}

function LoginPage() {
  const { signIn, signingIn, signInError, signedIn, ready } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Already signed in? Skip the login screen. Signing in lands on مساحة العمل
  // rather than the dashboard: the first thing anyone does is go somewhere,
  // and this is the screen that shows where they can go.
  useEffect(() => {
    if (ready && signedIn) navigate({ to: "/app/workspace" });
  }, [ready, signedIn, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await signIn(email, password);
      navigate({ to: "/app/workspace" });
    } catch {
      // The error message is surfaced from context below.
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------------------------------------------------------- */}
      {/* Brand panel                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <LoginBackdrop />

        <div className="relative flex items-center gap-3.5">
          <div className="grid size-14 place-items-center rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-white/20">
            <Logo className="size-full object-contain" />
          </div>
          <div>
            <p className="text-lg font-bold text-sidebar-foreground">Match Education</p>
            <p className="text-xs text-sidebar-foreground/60">نظام إدارة المدارس المتكامل</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-extrabold leading-snug text-sidebar-foreground xl:text-5xl">
            مدرستك بالكامل
            <span className="block bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent">
              في مكان واحد ذكي
            </span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-sidebar-foreground/70">
            من تسجيل الحضور اليومي إلى بطاقات الدرجات والرسوم المالية والتواصل مع أولياء الأمور — كل
            ذلك بواجهة عربية أنيقة وسريعة.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <div
                key={s.l}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-md"
              >
                <p className="text-2xl font-bold text-sidebar-foreground xl:text-3xl">{s.n}</p>
                <p className="mt-1 text-xs text-sidebar-foreground/60">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-sidebar-foreground/40">
          <p>© ٢٠٢٦ Match Systems — جميع الحقوق محفوظة</p>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            اتصال آمن ومشفّر
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Form panel                                                        */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <form onSubmit={submit} className="w-full max-w-md">
          {/* On mobile the brand panel is hidden, so the logo appears here. */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="grid size-16 place-items-center rounded-2xl bg-card p-2 shadow-card ring-1 ring-border">
              <Logo className="size-full object-contain" />
            </div>
            <div>
              <p className="text-lg font-bold">Match Education</p>
              <p className="text-xs text-muted-foreground">نظام إدارة المدارس المتكامل</p>
            </div>
          </div>

          <div className="text-center lg:text-right">
            <h2 className="text-2xl font-bold sm:text-3xl">مرحباً بعودتك 👋</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              سجّل الدخول بحسابك — يتم تحديد صلاحياتك تلقائياً حسب دورك في المدرسة.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">اسم المستخدم أو البريد الإلكتروني</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
                  className="h-12 rounded-xl pr-10"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-12 rounded-xl pl-11 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  // A generated 8-character password is easy to mistype, and a
                  // parent on a phone has no way to check what they entered.
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
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

          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            نسيت كلمة المرور؟ تواصل مع إدارة المدرسة لإعادة تعيينها.
          </p>

          <div className="mt-8 border-t border-border pt-6">
            <p className="mb-3 text-center text-xs font-medium text-muted-foreground lg:text-right">
              يخدم النظام جميع أفراد المدرسة
            </p>
            <div className="grid grid-cols-2 gap-3">
              {roleHints.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-border bg-card p-3.5 text-right transition-colors hover:border-primary/30 hover:bg-primary-soft/40"
                >
                  <c.icon className="size-5 text-primary" />
                  <p className="mt-2 text-sm font-bold">{c.label}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{c.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] text-muted-foreground lg:hidden">
            © ٢٠٢٦ Match Systems — جميع الحقوق محفوظة
          </p>
        </form>
      </div>
    </div>
  );
}

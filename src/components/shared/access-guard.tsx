import { useLocation, useNavigate } from "@tanstack/react-router";
import { Ban, ClipboardList, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useMyBlocks, usePendingSurveys } from "@/lib/api/hooks";

/**
 * Stops a blocked student from opening a page a rule has closed.
 *
 * The block is enforced on the server too — every endpoint scopes by persona
 * — so this is about telling the family *why* they cannot get in, rather than
 * letting them hit an empty page and guess.
 */
export function AccessGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data } = useMyBlocks();
  const pending = usePendingSurveys();

  // Two kinds of block: named pages, and the whole portal. The second cannot
  // be a list of paths — it has to close routes added after the rule was
  // written — so it is a flag, with the alerts page kept open. A student who
  // cannot read why they are locked out has no way back in.
  const everything = data?.everything === true;
  const allowed = data?.allowed ?? ["/app/alerts", "/app"];
  const blocked = everything
    ? !allowed.includes(pathname)
    : (data?.blocked ?? []).includes(pathname);

  // A compulsory survey holds everything shut until it is answered. The
  // survey page itself stays open — otherwise there is no way to answer it and
  // no way out — as does the alerts page, which may explain the block.
  const owed = pending.data?.surveys ?? [];
  const surveyPageOpen = pathname.startsWith("/app/surveys") || pathname === "/app/alerts";
  if (owed.length > 0 && !surveyPageOpen && !blocked) {
    const first = owed[0]!;
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="card-surface overflow-hidden border-2 border-primary">
          <div className="bg-primary-soft p-8 text-center">
            <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-brand-gradient text-white">
              <ClipboardList className="size-10" />
            </span>
            <h1 className="mt-4 text-xl font-black text-primary">📋 استبيان إجباري بانتظارك</h1>
            <p className="mt-2 text-sm leading-relaxed">
              لا يمكن متابعة استخدام النظام قبل تعبئة
              {owed.length > 1 ? ` ${owed.length} استبيانات إجبارية` : " الاستبيان التالي"}.
            </p>
          </div>

          <div className="space-y-2 p-6">
            {owed.map((s2) => (
              <div key={s2.id} className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-black">{s2.title}</p>
                {s2.closes_on && (
                  <p className="num mt-1 text-xs text-muted-foreground">يغلق في {s2.closes_on}</p>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-muted/30 p-4">
            <button
              onClick={() => void navigate({ to: "/app/surveys" })}
              className="h-11 w-full rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground"
            >
              تعبئة «{first.title}» الآن
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!blocked) return <>{children}</>;

  const reason = (data?.reasons ?? []).find((r) => (r.pages.length ? true : false));

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="card-surface overflow-hidden border-2 border-destructive">
        <div className="bg-destructive-soft p-8 text-center">
          <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-destructive text-4xl text-white">
            <Ban className="size-10" />
          </span>
          <h1 className="mt-4 text-xl font-black text-destructive">
            {everything ? "⛔ تم تعليق الوصول إلى النظام" : "⛔ هذه الصفحة غير متاحة حالياً"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed">
            {everything
              ? "تم تعليق وصولك إلى جميع صفحات النظام بناءً على تنبيه صادر من إدارة المدرسة. يمكنك الاطّلاع على التنبيهات فقط."
              : "تم تقييد الوصول إلى هذه الصفحة بناءً على تنبيه صادر من إدارة المدرسة."}
          </p>
        </div>

        {reason && (
          <div className="space-y-3 p-6">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="flex items-center gap-2 text-sm font-black">
                <span className="text-xl">{reason.emoji}</span>
                {reason.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{reason.message}</p>
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-warm-soft p-3 text-xs text-warm-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              يُرفع التقييد تلقائياً بمجرد معالجة السبب لدى الإدارة.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border bg-muted/30 p-4">
          <button
            onClick={() => void navigate({ to: "/app/alerts" })}
            className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground"
          >
            عرض التنبيهات
          </button>
          <button
            onClick={() => void navigate({ to: "/app" })}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}

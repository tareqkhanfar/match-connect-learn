import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppProvider } from "../lib/app-context";
import { ConfirmProvider } from "../components/shared/confirm";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">٤٠٤</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير متوفرة أو تم نقلها إلى مكان آخر.
        </p>
        <div className="mt-6">
          <Link
            to="/app"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            العودة إلى لوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  );
}

/** A page's script from before the last deploy is gone from the server; the
 * tab still asks for it by its old name. A fresh load fixes it. */
const STALE_BUNDLE =
  /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError|Loading chunk|Unable to preload CSS/i;
const RELOADED_KEY = "ms-stale-bundle-reload";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const message = String(error?.message ?? error ?? "");
  const stale = STALE_BUNDLE.test(message);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  useEffect(() => {
    if (!stale) return;
    try {
      // Once per minute at most, so a page that is truly broken does not loop.
      const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
      if (Date.now() - last < 60_000) return;
      sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
    } catch {
      /* storage unavailable: reload anyway */
    }
    window.location.reload();
  }, [stale]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">تعذّر تحميل الصفحة</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stale
            ? "صدر تحديث جديد للنظام. أعد تحميل الصفحة لاستخدامه."
            : "حدث خطأ غير متوقع. يمكنك المحاولة مرة أخرى أو العودة للرئيسية."}
        </p>
        {message && !stale && (
          // The reason, small, so a report from the school names the fault.
          <p
            dir="ltr"
            className="mt-3 break-words rounded-lg bg-muted px-3 py-2 text-left font-mono text-[11px] text-muted-foreground"
          >
            {message.slice(0, 300)}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (stale) {
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            الصفحة الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover",
      },
      // Installed-to-homescreen behaviour on iOS and the Android chrome tint.
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Match Education" },
      { name: "theme-color", content: "#3b2f8f" },
      { title: "Match Education — نظام إدارة المدارس" },
      {
        name: "description",
        content: "نظام متكامل لإدارة المدارس: الطلاب، المعلمون، الحضور، الدرجات والرسوم.",
      },
      { name: "author", content: "Match Education" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap",
      },
      // The .ico carries 16-256px for older browsers and Windows; the PNG is
      // what modern browsers prefer, and the Apple icon is opaque because iOS
      // paints black behind transparency.
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Vite reports a missing page script before React sees it; reload onto the
  // new build instead of showing the error page.
  useEffect(() => {
    const onPreloadError = (event: Event) => {
      try {
        const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
        if (Date.now() - last < 60_000) return;
        sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
      } catch {
        /* storage unavailable: reload anyway */
      }
      event.preventDefault();
      window.location.reload();
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <ConfirmProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster position="top-center" richColors closeButton />
        </ConfirmProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

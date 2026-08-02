import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { ready, signedIn } = useApp();
  const navigate = useNavigate();

  // Guard the whole /app subtree: no session means back to the login screen.
  useEffect(() => {
    if (ready && !signedIn) navigate({ to: "/" });
  }, [ready, signedIn, navigate]);

  if (!ready || !signedIn) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-sm">جارٍ التحقق من الجلسة…</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

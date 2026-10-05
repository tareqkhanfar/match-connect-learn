import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useApp } from "@/lib/app-context";
import { landOnDefault, useActiveWorkspace } from "@/lib/active-workspace";

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

  // Someone given a workspace starts there, once per sign-in; after that the
  // dashboard is one click away like any other screen.
  const { session } = useApp();
  const workspace = useActiveWorkspace();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!session?.user || workspace.loading) return;
    const to = landOnDefault(session.user, workspace.defaultId, pathname);
    if (to) navigate({ to, replace: true });
    // Only when the session or the workspaces settle, not on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, workspace.loading, workspace.defaultId]);

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

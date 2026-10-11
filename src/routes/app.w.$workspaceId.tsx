import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutGrid, Pencil } from "lucide-react";
import { DashboardSkeleton, EmptyBlock } from "@/components/shared/states";
import { WorkspaceView } from "@/components/workspaces/workspace-view";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useApp } from "@/lib/app-context";
import { useWorkspaceShortcuts } from "@/lib/api/hooks";

export const Route = createFileRoute("/app/w/$workspaceId")({
  head: () => ({
    meta: [
      { title: "مساحة العمل — Match Education" },
      { name: "description", content: "أزرار مساحة العمل التي أعدّتها المدرسة لك." },
    ],
  }),
  component: WorkspaceHome,
});

/** A built workspace's home: its blocks, for whoever was given it. */
function WorkspaceHome() {
  const { workspaceId } = Route.useParams();
  const { role, allows } = useApp();
  const ws = useActiveWorkspace();
  const shortcuts = useWorkspaceShortcuts();
  const workspace = ws.workspaces.find((w) => w.id === workspaceId);

  // Opening a workspace's home makes it the one being worked in, so the
  // sidebar follows a link someone was sent as well as the switcher.
  useEffect(() => {
    if (workspace && ws.active?.id !== workspace.id) ws.setActive(workspace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  if (ws.loading) return <DashboardSkeleton />;
  if (!workspace) {
    return (
      <EmptyBlock
        title="مساحة العمل غير متاحة لك"
        description="ربما أُلغي إسنادها لك أو أُوقفت. ارجع إلى مساحة عملك."
        icon={<LayoutGrid className="size-6" />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <WorkspaceView
        title={workspace.title}
        icon={workspace.icon}
        color={workspace.color}
        description={workspace.description}
        layout={workspace.layout}
        role={role}
        shortcuts={shortcuts.data?.shortcuts}
        allows={allows}
        headerActions={
          ws.canBuild ? (
            <Link
              to="/app/workspaces/$workspaceId"
              params={{ workspaceId: workspace.id }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <Pencil className="size-3.5" />
              تعديل مساحة العمل
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}

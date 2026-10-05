import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, LayoutGrid, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveWorkspace, workspaceHome } from "@/lib/active-workspace";
import { cn } from "@/lib/utils";
import { wsColor, wsIcon } from "@/lib/workspace-icons";

const BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-xl border border-border px-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary md:px-3";

/**
 * The header's way back to everything — and, for someone given workspaces,
 * the way between them. Without any it stays the plain link it always was.
 */
export function WorkspaceSwitcher() {
  const ws = useActiveWorkspace();
  const navigate = useNavigate();

  if (!ws.workspaces.length) {
    return (
      <Link to="/app/workspace" className={BUTTON} title="مساحة العمل">
        <LayoutGrid className="size-[18px]" />
        <span className="hidden lg:inline">مساحة العمل</span>
      </Link>
    );
  }

  const ActiveIcon = ws.active ? wsIcon(ws.active.icon) : LayoutGrid;
  const choose = (id: string) => {
    ws.setActive(id);
    void navigate({ to: workspaceHome(id) });
  };

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger className={cn(BUTTON, "max-w-[15rem]")} title="تبديل مساحة العمل">
        <ActiveIcon className="size-[18px] shrink-0" />
        <span className="hidden truncate lg:inline">
          {ws.active ? ws.active.title : "مساحة العمل"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground">
          مساحات العمل
        </DropdownMenuLabel>
        {ws.workspaces.map((w) => {
          const Icon = wsIcon(w.icon);
          const on = ws.active?.id === w.id;
          return (
            <DropdownMenuItem key={w.id} onSelect={() => choose(w.id)} className="gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-lg",
                  wsColor(w.color).tile,
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{w.title}</span>
              {w.id === ws.defaultId && (
                <span className="text-[10px] text-muted-foreground">الافتراضية</span>
              )}
              {on && <Check className="size-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        {!ws.hideSystem && (
          <DropdownMenuItem onSelect={() => choose("")} className="gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
              <LayoutGrid className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">القائمة الأساسية</span>
            {!ws.defaultId && <span className="text-[10px] text-muted-foreground">الافتراضية</span>}
            {!ws.active && <Check className="size-4 shrink-0 text-primary" />}
          </DropdownMenuItem>
        )}
        {ws.canBuild && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void navigate({ to: "/app/workspaces" })}
              className="gap-2"
            >
              <Settings2 className="size-4 text-muted-foreground" />
              إدارة مساحات العمل والصفحات
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

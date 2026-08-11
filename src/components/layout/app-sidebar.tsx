import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronsLeft, LogOut, X } from "lucide-react";
import { groupFor, groupsForRole, labelFor, navForRole } from "@/lib/nav";
import { useApp } from "@/lib/app-context";
import { roleLabels } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: Props) {
  const { role, session, signOut } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = navForRole(role);

  const content = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        {/* The brand mark carries its own colours, so it sits on a light plate
            rather than the gradient the generic icon needed. */}
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/95 p-1.5 shadow-glow">
          <img
            src="/brand/match-systems-logo.png"
            alt="Match Systems"
            width={256}
            height={217}
            className="size-full object-contain"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight">Match Education</p>
            <p className="truncate text-xs text-sidebar-foreground/60">نظام إدارة المدارس</p>
          </div>
        )}
        <button
          onClick={onCloseMobile}
          className="grid size-8 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
          aria-label="إغلاق القائمة"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groupsForRole(role).map((group) => {
          const groupItems = items.filter((i) => groupFor(i, role) === group);
          if (!groupItems.length) return null;
          return (
            <div key={group}>
              {!collapsed && (
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
                  {group}
                </p>
              )}
              <ul className="space-y-1">
                {groupItems.map((item) => {
                  const active =
                    item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={onCloseMobile}
                        title={collapsed ? labelFor(item, role) : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          collapsed && "justify-center px-2",
                        )}
                      >
                        <item.icon className="size-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{labelFor(item, role)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="rounded-xl bg-sidebar-accent/60 px-3 py-2.5">
            <p className="text-xs text-sidebar-foreground/60">مسجَّل الدخول كـ</p>
            <p className="truncate text-sm font-semibold">{session?.name || roleLabels[role]}</p>
            {session?.name && (
              <p className="truncate text-[11px] text-sidebar-foreground/60">{roleLabels[role]}</p>
            )}
          </div>
        )}
        <Link
          to="/"
          onClick={signOut}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-destructive/15 hover:text-destructive",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut className="size-[18px] shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </Link>
        <button
          onClick={onToggle}
          className={cn(
            "hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent lg:flex",
            collapsed && "justify-center px-2",
          )}
        >
          <ChevronsLeft
            className={cn("size-[18px] shrink-0 transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed && <span>طيّ الشريط</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-l border-sidebar-border transition-[width] duration-300 lg:block",
          collapsed ? "w-[78px]" : "w-[268px]",
        )}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="absolute inset-y-0 right-0 w-[280px] animate-in slide-in-from-right duration-300">
            {content}
          </div>
        </div>
      )}
    </>
  );
}

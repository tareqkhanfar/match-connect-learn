import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronsLeft, ExternalLink, LogOut, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resolveItem } from "@/components/workspaces/workspace-view";
import { useActiveWorkspace, workspaceHome } from "@/lib/active-workspace";
import { groupFor, groupsForRole, labelFor, navForRole } from "@/lib/nav";
import { useApp } from "@/lib/app-context";
import { roleLabels } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { wsIcon } from "@/lib/workspace-icons";

interface SideItem {
  key: string;
  to: string;
  label: string;
  icon: LucideIcon;
  external: boolean;
}

interface SideGroup {
  title: string;
  items: SideItem[];
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

/** Which sections the reader left open, so the sidebar is where they put it. */
const OPEN_KEY = "ms-sidebar-open";
const CLOSED_WS_KEY = "ms-sidebar-closed-ws";

function readOpen(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OPEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export function AppSidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: Props) {
  const { role, session, signOut } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const workspace = useActiveWorkspace().active;

  // The role's menu, or — for someone working in a workspace the school
  // built — that workspace's sections and buttons, with its home first.
  const sections = useMemo<SideGroup[]>(() => {
    if (workspace) {
      const home: SideGroup = {
        title: workspace.title,
        items: [
          {
            key: "home",
            to: workspaceHome(workspace.id),
            label: "الرئيسية",
            icon: wsIcon(workspace.icon),
            external: false,
          },
        ],
      };
      const blocks = workspace.layout.blocks
        .filter((b) => b.items?.length)
        .map((b) => ({
          title: b.title || workspace.title,
          items: (b.items ?? [])
            .map((i) => resolveItem(i, role))
            .filter((i) => i !== null)
            .map((i) => ({
              key: i.id,
              to: i.href,
              label: i.label,
              icon: i.icon,
              external: i.external,
            })),
        }))
        .filter((g) => g.items.length);
      return [home, ...blocks];
    }
    const items = navForRole(role);
    return groupsForRole(role)
      .map((group) => ({
        title: group,
        items: items
          .filter((i) => groupFor(i, role) === group)
          .map((i) => ({
            key: i.to,
            to: i.to,
            label: labelFor(i, role),
            icon: i.icon,
            external: false,
          })),
      }))
      .filter((g) => g.items.length);
  }, [workspace, role]);

  const isActive = (to: string) =>
    to === "/app" ? pathname === "/app" : pathname === to || pathname.startsWith(`${to}/`);

  // The section holding the current page. Resolved from the longest matching
  // route so /app/students/EDU-001 opens السجلات rather than nothing.
  const activeGroup = (() => {
    let best: { title: string; length: number } | null = null;
    for (const g of sections) {
      for (const i of g.items) {
        if (!i.external && isActive(i.to) && (!best || i.to.length > best.length)) {
          best = { title: g.title, length: i.to.length };
        }
      }
    }
    return best?.title ?? null;
  })();

  const [open, setOpen] = useState<string[]>(() => (activeGroup ? [activeGroup] : []));

  // Server and client must agree on the first render, so the stored choice is
  // read after mount rather than during it.
  useEffect(() => {
    const stored = readOpen();
    setOpen(stored ?? (activeGroup ? [activeGroup] : []));
    // Only on mount: afterwards the reader's clicks are what decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigating into a collapsed section opens it — otherwise the page you are
  // on is the one entry you cannot see.
  useEffect(() => {
    if (activeGroup)
      setOpen((prev) => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
  }, [activeGroup]);

  // A workspace has a few sections the school chose, so they start open and
  // stay open unless closed; the role's twelve start closed. Kept apart so
  // one does not reshuffle the other.
  const [closedWs, setClosedWs] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CLOSED_WS_KEY);
      if (raw) setClosedWs(JSON.parse(raw) as string[]);
    } catch {
      // Everything open, then.
    }
  }, []);
  const isOpen = (group: string) =>
    workspace ? !closedWs.includes(group) || group === activeGroup : open.includes(group);

  function toggleGroup(group: string) {
    if (workspace) {
      setClosedWs((prev) => {
        const next = prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group];
        try {
          window.localStorage.setItem(CLOSED_WS_KEY, JSON.stringify(next));
        } catch {
          // Not worth failing the click over.
        }
        return next;
      });
      return;
    }
    setOpen((prev) => {
      const next = prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group];
      try {
        window.localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {
        // A browser refusing storage is not a reason to refuse the click.
      }
      return next;
    });
  }

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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => {
          const group = section.title;
          const groupItems = section.items;
          // Collapsed to icons there is no room for a heading, and no way to
          // press one either, so every section stays open.
          const expanded = collapsed || isOpen(group);
          const hasActive = groupItems.some((i) => !i.external && isActive(i.to));
          return (
            <div key={group} className={collapsed ? "mb-4" : "mb-0.5"}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={expanded}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors",
                    hasActive
                      ? "text-sidebar-foreground/80"
                      : "text-sidebar-foreground/45 hover:text-sidebar-foreground/70",
                  )}
                >
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 transition-transform duration-200",
                      expanded ? "" : "-rotate-90",
                    )}
                  />
                  <span className="truncate">{group}</span>
                  {/* A closed section holding the current page still says so. */}
                  {!expanded && hasActive && (
                    <span className="size-1.5 shrink-0 rounded-full bg-sidebar-primary" />
                  )}
                </button>
              )}
              <ul className={cn("space-y-1", expanded ? "" : "hidden")}>
                {groupItems.map((item) => {
                  const active = !item.external && isActive(item.to);
                  const cls = cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-2",
                  );
                  const body = (
                    <>
                      <item.icon className="size-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.external && (
                        <ExternalLink className="ms-auto size-3 shrink-0 opacity-60" />
                      )}
                    </>
                  );
                  return (
                    <li key={item.key}>
                      {item.external || item.to.includes("?") ? (
                        <a
                          href={item.to}
                          onClick={onCloseMobile}
                          title={collapsed ? item.label : undefined}
                          className={cls}
                          {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
                        >
                          {body}
                        </a>
                      ) : (
                        <Link
                          to={item.to}
                          onClick={onCloseMobile}
                          title={collapsed ? item.label : undefined}
                          className={cls}
                        >
                          {body}
                        </Link>
                      )}
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

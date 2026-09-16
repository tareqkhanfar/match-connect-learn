import { Link } from "@tanstack/react-router";
import { LayoutGrid, Menu, Moon, Sun } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { MailBadge } from "./mail-badge";
import { HeaderStatus } from "./header-status";
import { PeriodSwitcher } from "./period-switcher";
import { SchoolBrand, HolidayBanner } from "./school-brand";
import { ChildSwitcher } from "./child-switcher";
import { UserMenu } from "./user-menu";
import { AccessGuard } from "@/components/shared/access-guard";
import { AlertPopup } from "@/components/shared/alert-popup";
import { ForcePasswordChange } from "@/components/shared/force-password-change";
import { useEffect, useState, type ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { MobileTabBar } from "./mobile-tabbar";
import { useApp } from "@/lib/app-context";
import { roleLabels } from "@/lib/roles";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return (parts[0]![0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Whether the reader left the sidebar open. Collapsed unless they said so. */
const SIDEBAR_KEY = "ms-sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  // Collapsed by default: مساحة العمل is where you go to find a screen, and
  // the sidebar is for moving between the few you already know. A reader who
  // opens it keeps it open.
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, session, theme, toggleTheme } = useApp();
  const displayName = session?.name ?? "";

  // Server and client must agree on the first render, so the stored choice is
  // read after mount rather than during it.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_KEY);
      if (stored !== null) setCollapsed(stored === "1");
    } catch {
      // A browser refusing storage keeps the default.
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // Not worth failing the click over.
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar
        collapsed={collapsed}
        onToggle={toggleSidebar}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-card/85 pt-safe backdrop-blur-md">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 md:gap-3 md:px-6 md:py-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid size-10 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary lg:hidden"
              aria-label="فتح القائمة"
            >
              <Menu className="size-5" />
            </button>
            {/* The brand takes the space the global search used to occupy;
                each list screen has its own search and filter bar. */}
            <SchoolBrand />
            <div className="col-start-3 flex items-center gap-1.5 md:gap-2">
              {/* The way back to everything. First thing in the row because it
                  is the most used, and labelled on wide screens because an
                  icon alone does not say "مساحة العمل". */}
              <Link
                to="/app/workspace"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary md:px-3"
                title="مساحة العمل"
              >
                <LayoutGrid className="size-[18px]" />
                <span className="hidden lg:inline">مساحة العمل</span>
              </Link>
              {/* On a phone the header keeps only what a thumb needs; the rest
                  moves into the drawer and the bottom tab bar. */}
              <div className="hidden items-center gap-2 md:flex">
                <PeriodSwitcher />
                <HeaderStatus />
              </div>
              <ChildSwitcher />
              <button
                onClick={toggleTheme}
                className="hidden size-10 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary md:grid"
                aria-label="تبديل المظهر"
              >
                {theme === "dark" ? (
                  <Sun className="size-[18px]" />
                ) : (
                  <Moon className="size-[18px]" />
                )}
              </button>
              <MailBadge />
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
          <HolidayBanner />
        </header>

        <main className="min-w-0 flex-1 px-3 py-5 pb-28 sm:px-4 md:px-6 md:py-8 md:pb-8">
          <div className="mx-auto w-full max-w-[1400px] animate-in fade-in duration-500">
            {/* A rule may close a page to a student; say why rather than
                showing an empty screen. */}
            <AccessGuard>{children}</AccessGuard>
            {/* An unacknowledged warning interrupts once, on arrival. */}
            <AlertPopup />
          </div>
        </main>
      </div>

      {/* Phones navigate from the thumb zone rather than a hidden drawer. */}
      <MobileTabBar onOpenMore={() => setMobileOpen(true)} />

      {/* Blocks the app while the user is still on the issued password. */}
      <ForcePasswordChange />
    </div>
  );
}

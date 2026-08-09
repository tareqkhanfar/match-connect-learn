import { Menu, Moon, Search, Sun } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { HeaderStatus } from "./header-status";
import { ChildSwitcher } from "./child-switcher";
import { UserMenu } from "./user-menu";
import { ChatWidget } from "./chat-widget";
import { AccessGuard } from "@/components/shared/access-guard";
import { ForcePasswordChange } from "@/components/shared/force-password-change";
import { useState, type ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { useApp } from "@/lib/app-context";
import { roleLabels } from "@/lib/roles";
import { Input } from "@/components/ui/input";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return (parts[0]![0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, session, theme, toggleTheme } = useApp();
  const displayName = session?.name ?? "";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid size-10 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary lg:hidden"
              aria-label="فتح القائمة"
            >
              <Menu className="size-5" />
            </button>
            <div className="relative hidden min-w-0 md:block">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث عن طالب، معلم، أو صف..."
                className="h-10 rounded-xl bg-secondary/60 pr-9"
              />
            </div>
            <div className="col-start-3 flex items-center gap-2">
              {/* A guardian picks the child once, here, and every screen
                  follows that choice. */}
              <HeaderStatus />
              <ChildSwitcher />
              <button
                onClick={toggleTheme}
                className="grid size-10 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary"
                aria-label="تبديل المظهر"
              >
                {theme === "dark" ? (
                  <Sun className="size-[18px]" />
                ) : (
                  <Moon className="size-[18px]" />
                )}
              </button>
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
          <div className="mx-auto w-full max-w-[1400px] animate-in fade-in duration-500">
            {/* A rule may close a page to a student; say why rather than
                showing an empty screen. */}
            <AccessGuard>{children}</AccessGuard>
          </div>
        </main>
      </div>

      {/* Blocks the app while the user is still on the issued password. */}
      <ForcePasswordChange />
      <ChatWidget />
    </div>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut, Moon, Settings, Sun, User as UserIcon, LifeBuoy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/lib/app-context";
import { roleLabels } from "@/lib/roles";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export function UserMenu() {
  const { session, role, theme, toggleTheme, signOut } = useApp();
  const navigate = useNavigate();
  const displayName = session?.name || session?.email || "مستخدم";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="قائمة المستخدم"
          className="flex items-center gap-2.5 rounded-xl border border-border py-1 pl-2 pr-1.5 transition-all hover:border-primary/50 hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {session?.image ? (
            <img src={session.image} alt="" className="size-8 rounded-lg object-cover" />
          ) : (
            <div className="grid size-8 place-items-center rounded-lg bg-brand-gradient text-xs font-bold text-primary-foreground">
              {initials(displayName)}
            </div>
          )}
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-semibold leading-tight">{displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{roleLabels[role]}</p>
          </div>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60 text-right">
        <DropdownMenuLabel className="flex items-center gap-3 py-3">
          {session?.image ? (
            <img src={session.image} alt="" className="size-9 rounded-lg object-cover" />
          ) : (
            <div className="grid size-9 place-items-center rounded-lg bg-brand-gradient text-sm font-bold text-primary-foreground">
              {initials(displayName)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-[11px] font-normal text-muted-foreground">
              {session?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void navigate({ to: "/app/profile" })} className="gap-2">
          <UserIcon className="size-4" />
          ملفي الشخصي
        </DropdownMenuItem>

        {/* School-wide settings are admin-only; everyone else gets the
            personal preferences that live on the profile page. */}
        {role === "admin" && (
          <DropdownMenuItem
            onSelect={() => void navigate({ to: "/app/settings" })}
            className="gap-2"
          >
            <Settings className="size-4" />
            إعدادات المدرسة
          </DropdownMenuItem>
        )}

        {/* Theme lives here too, so the header stays uncluttered on mobile. */}
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
          className="gap-2"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="gap-2">
          <Link to="/app/communication">
            <LifeBuoy className="size-4" />
            المساعدة والدعم
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => signOut()}
          className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="size-4" />
          تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

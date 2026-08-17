import { Link, useRouterState } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { navForRole, labelFor, type NavItem } from "@/lib/nav";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

/**
 * A native-feeling bottom tab bar for phones (iOS + Android).
 *
 * Phones get four primary destinations plus "المزيد", which opens the same
 * drawer the sidebar uses. It is hidden from `lg:` up, where the sidebar takes
 * over, and it respects the iPhone home-indicator inset.
 */
const PREFERRED: Record<string, string[]> = {
  admin: ["/app", "/app/students", "/app/attendance", "/app/fees"],
  secretary: ["/app", "/app/students", "/app/attendance", "/app/fees"],
  teacher: ["/app", "/app/attendance", "/app/gradebook", "/app/assignments"],
  student: ["/app", "/app/timetable", "/app/assignments", "/app/marks"],
  parent: ["/app", "/app/attendance", "/app/marks", "/app/fees"],
};

export function MobileTabBar({ onOpenMore }: { onOpenMore: () => void }) {
  const { role } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = navForRole(role);

  const wanted = PREFERRED[role] ?? ["/app"];
  const picked: NavItem[] = [];
  for (const to of wanted) {
    const found = items.find((i) => i.to === to);
    if (found) picked.push(found);
  }
  for (const item of items) {
    if (picked.length >= 4) break;
    if (!picked.some((p) => p.to === item.to)) picked.push(item);
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-safe backdrop-blur-xl lg:hidden"
      aria-label="التنقل السريع"
    >
      <ul className="grid grid-cols-5">
        {picked.slice(0, 4).map((item) => {
          const active =
            item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1 text-[10px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-xl transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <item.icon className="size-[19px]" />
                </span>
                <span className="max-w-full truncate leading-none">
                  {labelFor(item, role)}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            onClick={onOpenMore}
            className="flex min-h-[56px] w-full flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1 text-[10px] font-semibold text-muted-foreground"
          >
            <span className="grid size-8 place-items-center rounded-xl">
              <MoreHorizontal className="size-[19px]" />
            </span>
            <span className="leading-none">المزيد</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

import { Check, ChevronDown, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/lib/app-context";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return (parts[0]![0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Lets a guardian choose which child the whole system is showing.
 *
 * Sits in the header rather than on each screen: the choice applies
 * everywhere, so making it once at the top is both fewer clicks and less
 * ambiguous than a picker repeated per page.
 *
 * Hidden for a guardian with one child — there is nothing to choose — and for
 * every other persona.
 */
export function ChildSwitcher() {
  const { role, activeChild, setActiveChild, children_ } = useApp();

  if (role !== "parent" || children_.length < 2) return null;

  const current = children_.find((c) => c.id === activeChild) ?? children_[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex h-10 max-w-[240px] items-center gap-2 rounded-xl border border-border bg-card px-2.5 text-sm font-semibold transition-colors hover:bg-secondary">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-gradient text-[11px] font-bold text-primary-foreground">
            {initials(current.name)}
          </span>
          <span className="min-w-0 truncate">{current.name}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          اختر الابن / الابنة
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children_.map((child) => (
          <DropdownMenuItem
            key={child.id}
            onClick={() => setActiveChild(child.id)}
            className="flex items-center gap-2"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-[11px] font-bold">
              {initials(child.name)}
            </span>
            <span className="min-w-0 flex-1 truncate">{child.name}</span>
            {child.id === current.id && <Check className="size-4 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

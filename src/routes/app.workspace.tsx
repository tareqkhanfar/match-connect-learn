import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpLeft, Search, Star, X } from "lucide-react";
import { EmptyBlock } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";
import { useWorkspaceShortcuts } from "@/lib/api/hooks";
import { groupFor, groupsForRole, labelFor, navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/workspace")({
  head: () => ({
    meta: [
      { title: "مساحة العمل — Match Education" },
      {
        name: "description",
        content: "كل أقسام النظام في شاشة واحدة، مع الاختصارات والمفضّلة والبحث السريع.",
      },
    ],
  }),
  component: WorkspacePage,
});

/** Which links the reader pinned. Per browser, like the sidebar's open sections. */
const PINS_KEY = "ms-workspace-pins";

function readPins(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const TONE: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-secondary text-muted-foreground",
};

/**
 * مساحة العمل — every section of the system on one screen.
 *
 * A sidebar is a good way to return to a screen you know and a poor way to see
 * what exists: forty-seven entries behind twelve collapsed headings is a list
 * you scroll, not a place you look.
 *
 * Laid out the way a desk is: the numbers that might change what you do first,
 * then everything else as plain lists under headings. Deliberately quiet —
 * this is a place to leave, not a place to look at, and a wall of coloured
 * tiles makes forty-seven links harder to read rather than easier.
 *
 * The sidebar and this screen both read `navItems`, so a screen added to one
 * appears in the other without anyone remembering to add it twice.
 */
function WorkspacePage() {
  const { role, session } = useApp();
  const [query, setQuery] = useState("");
  const [pins, setPins] = useState<string[]>(() => readPins());
  const shortcuts = useWorkspaceShortcuts();

  const items = useMemo(() => navForRole(role), [role]);
  const groups = useMemo(() => groupsForRole(role), [role]);

  function togglePin(to: string) {
    setPins((prev) => {
      const next = prev.includes(to) ? prev.filter((p) => p !== to) : [...prev, to];
      try {
        window.localStorage.setItem(PINS_KEY, JSON.stringify(next));
      } catch {
        // A browser refusing storage is not a reason to refuse the click.
      }
      return next;
    });
  }

  const needle = query.trim();
  const matches = useMemo(() => {
    if (!needle) return null;
    return items.filter(
      (i) => labelFor(i, role).includes(needle) || groupFor(i, role).includes(needle),
    );
  }, [needle, items, role]);

  const pinned = items.filter((i) => pins.includes(i.to));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">مساحة العمل</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {session?.name ? `أهلاً ${session.name}` : "كل أقسام النظام في مكان واحد"}
            {shortcuts.data?.academic_year ? ` · ${shortcuts.data.academic_year}` : ""}
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن شاشة…"
            className="h-10 rounded-xl ps-9 pe-9"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute inset-y-0 end-3 my-auto grid size-6 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
              aria-label="مسح البحث"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* The numbers first: a shortcut without one is a second link to what is
          already in the sidebar. "٣٩ فاتورة غير مدفوعة" is read and opened;
          "الفواتير" is read and left. */}
      {!matches && (shortcuts.data?.shortcuts.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="mb-2.5 text-xs font-bold text-muted-foreground">اختصاراتك</h2>
          <div className="flex flex-wrap gap-2">
            {shortcuts.data!.shortcuts.map((s) => (
              <Link
                key={s.key}
                to={s.route}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
              >
                <span className="font-semibold">{s.label}</span>
                <ArrowUpLeft className="size-3.5 shrink-0 text-muted-foreground" />
                {/* A zero is worth showing: "no unpaid invoices" is an answer,
                    and hiding it would make the row jump about as data moves. */}
                <span
                  className={cn(
                    "num rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                    s.count > 0 ? (TONE[s.tone] ?? TONE["muted"]) : TONE["muted"],
                  )}
                >
                  {s.count}
                  {s.hint ? ` ${s.hint}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {matches ? (
        matches.length === 0 ? (
          <EmptyBlock
            title="لا شاشة بهذا الاسم"
            description="جرّب كلمة أخرى، أو تصفّح الأقسام بمسح البحث."
            icon={<Search className="size-6" />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card
              title={`نتائج البحث (${matches.length})`}
              items={matches}
              role={role}
              pins={pins}
              onPin={togglePin}
            />
          </div>
        )
      ) : (
        <>
          <h2 className="mb-2.5 text-xs font-bold text-muted-foreground">الأقسام</h2>
          <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pinned.length > 0 && (
              <Card
                title="المفضّلة"
                items={pinned}
                role={role}
                pins={pins}
                onPin={togglePin}
                accent
              />
            )}
            {groups.map((group) => {
              const groupItems = items.filter((i) => groupFor(i, role) === group);
              if (groupItems.length === 0) return null;
              return (
                <Card
                  key={group}
                  title={group}
                  items={groupItems}
                  role={role}
                  pins={pins}
                  onPin={togglePin}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Card({
  title,
  items,
  role,
  pins,
  onPin,
  accent,
}: {
  title: string;
  items: ReturnType<typeof navForRole>;
  role: Parameters<typeof labelFor>[1];
  pins: string[];
  onPin: (to: string) => void;
  accent?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-4",
        accent ? "border-primary/30" : "border-border",
      )}
    >
      <h3
        className={cn("mb-3 flex items-center gap-1.5 text-sm font-bold", accent && "text-primary")}
      >
        {accent && <Star className="size-3.5 fill-current" />}
        {title}
      </h3>

      <ul className="space-y-0.5">
        {items.map((item) => {
          const pinned = pins.includes(item.to);
          return (
            <li key={item.to} className="group flex items-center gap-1">
              <Link
                to={item.to}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 text-sm text-foreground/85 transition-colors hover:text-primary"
              >
                <item.icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="truncate">{labelFor(item, role)}</span>
                <ArrowUpLeft className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>

              {/* Outside the link, so pinning does not navigate. */}
              <button
                onClick={() => onPin(item.to)}
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded transition-opacity",
                  pinned
                    ? "text-warning opacity-100"
                    : "text-muted-foreground opacity-0 hover:bg-secondary group-hover:opacity-100",
                )}
                aria-label={pinned ? "إزالة من المفضّلة" : "إضافة للمفضّلة"}
                title={pinned ? "إزالة من المفضّلة" : "إضافة للمفضّلة"}
              >
                <Star className={cn("size-3", pinned && "fill-current")} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

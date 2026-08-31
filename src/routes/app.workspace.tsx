import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LayoutGrid, Search, Star, X } from "lucide-react";
import { PageHeader } from "@/components/shared/ui-kit";
import { EmptyBlock } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";
import { groupFor, groupsForRole, labelFor, navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/workspace")({
  head: () => ({
    meta: [
      { title: "مساحة العمل — Match Education" },
      {
        name: "description",
        content: "كل أقسام النظام في شاشة واحدة، مع المفضّلة والبحث السريع.",
      },
    ],
  }),
  component: WorkspacePage,
});

/** Which tiles the reader pinned. Per browser, like the sidebar's open sections. */
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

/**
 * مساحة العمل — every section of the system on one screen.
 *
 * A sidebar is a good way to move between screens you already know and a poor
 * way to see what exists: forty-six entries behind twelve collapsed headings
 * is a list you scroll, not a place you look. This is the other view of the
 * same list — grouped, with room for an icon, and searchable, so finding a
 * screen does not depend on remembering which heading it lives under.
 *
 * The two stay in step because both read `navItems`: a screen added to the
 * sidebar appears here without anyone remembering to add it twice.
 */
function WorkspacePage() {
  const { role, session } = useApp();
  const [query, setQuery] = useState("");
  const [pins, setPins] = useState<string[]>(() => readPins());

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
    <>
      <PageHeader
        title="مساحة العمل"
        subtitle={
          session?.name
            ? `أهلاً ${session.name} — كل أقسام النظام في مكان واحد`
            : "كل أقسام النظام في مكان واحد"
        }
      />

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن شاشة…"
          className="h-11 rounded-xl ps-9 pe-9"
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

      {matches ? (
        matches.length === 0 ? (
          <EmptyBlock
            title="لا شاشة بهذا الاسم"
            description="جرّب كلمة أخرى، أو تصفّح الأقسام بمسح البحث."
            icon={<LayoutGrid className="size-6" />}
          />
        ) : (
          <Section
            title={`نتائج البحث (${matches.length})`}
            items={matches}
            role={role}
            pins={pins}
            onPin={togglePin}
          />
        )
      ) : (
        <>
          {pinned.length > 0 && (
            <Section
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
              <Section
                key={group}
                title={group}
                items={groupItems}
                role={role}
                pins={pins}
                onPin={togglePin}
              />
            );
          })}
        </>
      )}
    </>
  );
}

function Section({
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
    <section className="mb-7">
      <h2
        className={cn(
          "mb-3 flex items-center gap-2 text-sm font-bold",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {accent && <Star className="size-4 fill-current" />}
        {title}
      </h2>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const pinned = pins.includes(item.to);
          return (
            <div key={item.to} className="group relative">
              <Link
                to={item.to}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <item.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {labelFor(item, role)}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {groupFor(item, role)}
                  </span>
                </span>
              </Link>

              {/* The pin sits outside the link so pressing it does not navigate. */}
              <button
                onClick={() => onPin(item.to)}
                className={cn(
                  "absolute end-2 top-2 grid size-7 place-items-center rounded-lg transition-opacity",
                  pinned
                    ? "text-warning opacity-100"
                    : "text-muted-foreground opacity-0 hover:bg-secondary group-hover:opacity-100",
                )}
                aria-label={pinned ? "إزالة من المفضّلة" : "إضافة للمفضّلة"}
                title={pinned ? "إزالة من المفضّلة" : "إضافة للمفضّلة"}
              >
                <Star className={cn("size-3.5", pinned && "fill-current")} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

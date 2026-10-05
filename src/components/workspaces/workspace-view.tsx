import { Link } from "@tanstack/react-router";
import {
  ArrowUpLeft,
  ExternalLink,
  FileText,
  LayoutGrid,
  Link2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceShortcut } from "@/lib/api/hooks";
import type { WsBlock, WsItem, WsLayout } from "@/lib/api/workspaces";
import { labelFor, navItems } from "@/lib/nav";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { wsColor, wsIcon } from "@/lib/workspace-icons";

export interface ResolvedItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  external: boolean;
  color: string;
}

/**
 * What a button opens and how it reads, for this role. A screen the role
 * cannot open is left out: a workspace arranges screens, it does not grant
 * them, and a button that leads to "not allowed" is worse than none.
 */
export function resolveItem(
  item: WsItem,
  role: Role,
  pageLabels?: Record<string, { title: string; icon: string }>,
): ResolvedItem | null {
  if (item.kind === "screen") {
    const path = item.target.split("?")[0] ?? item.target;
    const nav = navItems.find((n) => n.to === path);
    if (nav && !nav.roles.includes(role)) return null;
    return {
      id: item.id,
      label: item.label || (nav ? labelFor(nav, role) : item.target),
      icon: item.icon ? wsIcon(item.icon) : (nav?.icon ?? LayoutGrid),
      href: item.target,
      external: false,
      color: item.color,
    };
  }
  if (item.kind === "page") {
    const page = pageLabels?.[item.target];
    return {
      id: item.id,
      label: item.label || page?.title || "صفحة",
      icon: wsIcon(item.icon || page?.icon, FileText),
      href: `/app/p/${item.target}`,
      external: false,
      color: item.color,
    };
  }
  return {
    id: item.id,
    label: item.label || item.target.replace(/^https?:\/\//, ""),
    icon: wsIcon(item.icon, Link2),
    href: item.target,
    external: true,
    color: item.color,
  };
}

/** A link that knows whether it leaves the system, or does nothing (preview). */
export function ItemLink({
  item,
  preview,
  className,
  children,
  onClick,
}: {
  item: ResolvedItem;
  preview?: boolean | undefined;
  className?: string;
  children: ReactNode;
  onClick?: (() => void) | undefined;
}) {
  if (preview) return <div className={className}>{children}</div>;
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  if (item.href.includes("?")) {
    return (
      <a href={item.href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

const TONE: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-secondary text-muted-foreground",
};

/**
 * A workspace as its people see it: big buttons for what is done daily,
 * lists of links for the rest, the counts worth acting on, a note.
 * Consecutive link lists share a row, the way a desk's drawers do.
 */
export function WorkspaceView({
  title,
  icon,
  color,
  description,
  layout,
  role,
  shortcuts,
  pageLabels,
  preview,
  headerActions,
}: {
  title: string;
  icon: string;
  color: string;
  description?: string | undefined;
  layout: WsLayout;
  role: Role;
  shortcuts?: WorkspaceShortcut[] | undefined;
  pageLabels?: Record<string, { title: string; icon: string }> | undefined;
  preview?: boolean;
  headerActions?: ReactNode;
}) {
  const Icon = wsIcon(icon);
  const rows: Array<WsBlock | WsBlock[]> = [];
  for (const block of layout.blocks) {
    const last = rows[rows.length - 1];
    if (block.type === "links") {
      if (Array.isArray(last)) last.push(block);
      else rows.push([block]);
    } else rows.push(block);
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl",
            wsColor(color).tile,
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black">{title || "مساحة عمل بلا اسم"}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {headerActions}
      </div>

      {layout.blocks.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          لا أقسام في مساحة العمل هذه بعد.
        </p>
      )}

      {rows.map((row, index) =>
        Array.isArray(row) ? (
          <div key={index} className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {row.map((block) => (
              <LinksBlock
                key={block.id}
                block={block}
                role={role}
                pageLabels={pageLabels}
                preview={preview}
              />
            ))}
          </div>
        ) : row.type === "shortcuts" ? (
          <ShortcutsBlock
            key={row.id}
            block={row}
            role={role}
            pageLabels={pageLabels}
            preview={preview}
          />
        ) : row.type === "numbers" ? (
          <NumbersBlock key={row.id} block={row} shortcuts={shortcuts} preview={preview} />
        ) : (
          <TextBlock key={row.id} block={row} />
        ),
      )}
    </div>
  );
}

function BlockTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2.5 text-xs font-bold text-muted-foreground">{children}</h2>;
}

function ShortcutsBlock({
  block,
  role,
  pageLabels,
  preview,
}: {
  block: WsBlock;
  role: Role;
  pageLabels?: Record<string, { title: string; icon: string }> | undefined;
  preview?: boolean | undefined;
}) {
  const items = (block.items ?? [])
    .map((i) => resolveItem(i, role, pageLabels))
    .filter((i): i is ResolvedItem => !!i);
  return (
    <section>
      {block.title && <BlockTitle>{block.title}</BlockTitle>}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          لا أزرار في هذا القسم.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <ItemLink
              key={item.id}
              item={item}
              preview={preview}
              className="group flex min-h-[7.5rem] flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-right transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
            >
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-xl transition-transform group-hover:scale-105",
                  wsColor(item.color).tile,
                )}
              >
                <item.icon className="size-5" />
              </span>
              <span className="flex w-full items-end justify-between gap-2">
                <span className="text-sm font-bold leading-snug">{item.label}</span>
                {item.external ? (
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ArrowUpLeft className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </span>
            </ItemLink>
          ))}
        </div>
      )}
    </section>
  );
}

function LinksBlock({
  block,
  role,
  pageLabels,
  preview,
}: {
  block: WsBlock;
  role: Role;
  pageLabels?: Record<string, { title: string; icon: string }> | undefined;
  preview?: boolean | undefined;
}) {
  const items = (block.items ?? [])
    .map((i) => resolveItem(i, role, pageLabels))
    .filter((i): i is ResolvedItem => !!i);
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold">{block.title || "روابط"}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا روابط.</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <ItemLink
                item={item}
                preview={preview}
                className="group flex items-center gap-2 rounded-lg py-1.5 text-sm text-foreground/85 transition-colors hover:text-primary"
              >
                <item.icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <span className="truncate">{item.label}</span>
                {item.external && (
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                )}
              </ItemLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NumbersBlock({
  block,
  shortcuts,
  preview,
}: {
  block: WsBlock;
  shortcuts?: WorkspaceShortcut[] | undefined;
  preview?: boolean | undefined;
}) {
  const wanted = block.cards ?? [];
  const cards = (shortcuts ?? []).filter((s) => wanted.includes(s.key));
  cards.sort((a, b) => wanted.indexOf(a.key) - wanted.indexOf(b.key));
  return (
    <section>
      {block.title && <BlockTitle>{block.title}</BlockTitle>}
      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {preview ? "تظهر الأرقام هنا لكل مستخدم بحسب دوره." : "لا أرقام متاحة لدورك هنا."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cards.map((s) => {
            const body = (
              <>
                <span className="font-semibold">{s.label}</span>
                <span
                  className={cn(
                    "num rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                    s.count > 0 ? (TONE[s.tone] ?? TONE["muted"]) : TONE["muted"],
                  )}
                >
                  {s.count}
                  {s.hint ? ` ${s.hint}` : ""}
                </span>
              </>
            );
            const cls =
              "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/40";
            return preview ? (
              <div key={s.key} className={cls}>
                {body}
              </div>
            ) : (
              <Link key={s.key} to={s.route} className={cls}>
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TextBlock({ block }: { block: WsBlock }) {
  return (
    <section className="rounded-2xl border border-border bg-secondary/40 p-4">
      {block.title && <h3 className="mb-1.5 text-sm font-bold">{block.title}</h3>}
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
        {block.text || "—"}
      </p>
    </section>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

const tones = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-success-soft text-accent",
  warm: "bg-warm-soft text-warm-foreground",
  info: "bg-info-soft text-info",
} as const;

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  tone?: keyof typeof tones;
}) {
  return (
    <div className="card-surface group p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="num mt-2 text-3xl font-bold tracking-tight">{value}</p>
          {trend && <p className="mt-2 text-xs font-medium text-accent">{trend}</p>}
        </div>
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl transition-transform group-hover:scale-105",
            tones[tone],
          )}
        >
          <Icon className="size-6" />
        </div>
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-surface overflow-hidden", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold">{title}</h2>
          {description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="size-7" />
      </div>
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "success" | "warning" | "danger" | "info" | "primary";
}) {
  const map = {
    muted: "bg-secondary text-secondary-foreground border-border",
    success: "bg-success-soft text-success border-success/30",
    warning: "bg-warning-soft text-warm-foreground border-warning/40",
    danger: "bg-destructive-soft text-destructive border-destructive/30",
    info: "bg-info-soft text-info border-info/30",
    primary: "bg-primary-soft text-primary border-primary/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        map[tone],
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const map = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={cn("h-full rounded-full transition-all duration-700", map[tone])}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .replace("أ. ", "")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <div
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-xs font-bold text-primary",
        className,
      )}
    >
      {initials}
    </div>
  );
}

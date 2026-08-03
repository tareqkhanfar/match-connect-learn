import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Generic block skeleton used while a query is in flight. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-secondary", className)} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-[360px] xl:col-span-2" />
        <Skeleton className="h-[360px]" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "تعذّر تحميل البيانات",
}: {
  error?: unknown;
  onRetry?: (() => void) | undefined;
  title?: string | undefined;
}) {
  // Endpoints send an Arabic message; fall back to the English one.
  const message =
    (error as { messageAr?: string })?.messageAr ||
    (error as Error)?.message ||
    "حدث خطأ غير متوقع أثناء الاتصال بالخادم.";

  return (
    <div className="grid place-items-center rounded-2xl border border-destructive/25 bg-destructive-soft/40 px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function LoadingRow({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function EmptyBlock({
  title = "لا توجد بيانات",
  description,
  icon,
  action,
}: {
  title?: string | undefined;
  description?: string | undefined;
  icon?: ReactNode | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <p className="mt-4 text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

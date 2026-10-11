import type { ReactNode } from "react";
import { CalendarRange, RotateCcw } from "lucide-react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { ProgressBar } from "@/components/shared/ui-kit";
import { Input } from "@/components/ui/input";
import type { ReportFilters } from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import { ReportChart, type ChartType } from "./report-chart";
import { isoDate, TD, TH, type TileTone } from "./report-utils";

/**
 * The pieces every report screen is built from, so the leadership and the
 * nursing screens read the same way: a filter bar, a row of figures, then
 * each report as a chart over the table it was drawn from.
 */

// --- Dates -------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function monthStart(): string {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

// --- Filter bar ----------------------------------------------------------------------

interface Choice {
  id: string;
  label: string;
}

/** A change to the filters; an empty value clears that filter. */
type FilterPatch = { [K in keyof ReportFilters]?: string | undefined };

export function ReportFilterBar({
  filters,
  onChange,
  defaults,
  programs = [],
  sections = [],
  teachers,
  showTeacher = false,
  showSection = true,
  showDates = true,
  extra,
}: {
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
  /** The range the server opens on (the term so far) — «الفصل الحالي» returns to it. */
  defaults?: { dateFrom: string; dateTo: string } | undefined;
  programs?: Choice[];
  sections?: Array<Choice & { program: string }>;
  teachers?: Array<{ id: string; name: string }> | undefined;
  showTeacher?: boolean;
  showSection?: boolean;
  showDates?: boolean;
  extra?: ReactNode;
}) {
  const set = (patch: FilterPatch) => {
    const next: ReportFilters = { ...filters };
    for (const [k, v] of Object.entries(patch) as Array<
      [keyof ReportFilters, string | undefined]
    >) {
      if (v) next[k] = v;
      else delete next[k];
    }
    onChange(next);
  };
  const shownSections = filters.program
    ? sections.filter((s) => s.program === filters.program)
    : sections;
  const today = isoDate(new Date());

  const presets: Array<[string, () => FilterPatch]> = [
    // Clearing the dates returns to the server's own default: the term so far.
    ["الفصل الحالي", () => ({ date_from: undefined, date_to: undefined })],
    ["هذا الشهر", () => ({ date_from: monthStart(), date_to: today })],
    ["آخر 30 يوماً", () => ({ date_from: daysAgo(29), date_to: today })],
    ["آخر 7 أيام", () => ({ date_from: daysAgo(6), date_to: today })],
  ];

  return (
    <div className="card-surface mb-5 space-y-3 p-4">
      {showDates && (
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            من
            <Input
              type="date"
              value={filters.date_from ?? defaults?.dateFrom ?? ""}
              max={filters.date_to ?? undefined}
              onChange={(e) => set({ date_from: e.target.value })}
              className="h-9 w-[9.5rem] rounded-xl"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            إلى
            <Input
              type="date"
              value={filters.date_to ?? defaults?.dateTo ?? ""}
              min={filters.date_from ?? undefined}
              onChange={(e) => set({ date_to: e.target.value })}
              className="h-9 w-[9.5rem] rounded-xl"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {presets.map(([label, patch]) => (
              <button
                key={label}
                type="button"
                onClick={() => set(patch())}
                className="h-8 rounded-lg border border-border px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {programs.length > 0 && (
          <SearchableSelect
            value={filters.program ?? ""}
            onChange={(v) => set({ program: v, student_group: undefined })}
            options={programs.map((p) => ({ value: p.id, label: p.label }))}
            placeholder="كل الصفوف"
            clearable
            clearLabel="كل الصفوف"
          />
        )}
        {showSection && sections.length > 0 && (
          <SearchableSelect
            value={filters.student_group ?? ""}
            onChange={(v) => set({ student_group: v })}
            options={shownSections.map((s) => ({ value: s.id, label: s.label }))}
            placeholder="كل الشعب"
            clearable
            clearLabel="كل الشعب"
          />
        )}
        {showTeacher && teachers && teachers.length > 0 && (
          <SearchableSelect
            value={filters.teacher ?? ""}
            onChange={(v) => set({ teacher: v })}
            options={teachers.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="كل المعلمين"
            clearable
            clearLabel="كل المعلمين"
          />
        )}
        <div className="flex items-center gap-2">
          {extra}
          {Object.keys(filters).length > 0 && (
            <button
              type="button"
              onClick={() => onChange({})}
              className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              إعادة الضبط
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Figures -------------------------------------------------------------------------

const TILE_TONES: Record<TileTone, string> = {
  neutral: "text-foreground",
  good: "text-success",
  warn: "text-warm-foreground",
  bad: "text-destructive",
  info: "text-primary",
};

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: TileTone;
}) {
  return (
    <div className="card-surface min-w-0 p-4">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={cn("num mt-1.5 text-2xl font-bold tracking-tight", TILE_TONES[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{children}</div>
  );
}

// --- Cells ---------------------------------------------------------------------------

export function PctCell({
  pct,
  good = 90,
  fair = 60,
}: {
  pct: number | null;
  good?: number;
  fair?: number;
}) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const tone = pct >= good ? "success" : pct >= fair ? "warning" : "danger";
  return (
    <div className="flex min-w-[7rem] items-center gap-2">
      <span className="num w-11 shrink-0 text-xs font-semibold">{pct}%</span>
      <ProgressBar value={pct} tone={tone} />
    </div>
  );
}

/** A table that scrolls inside its card on a phone, never the page. */
export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[36rem] text-right text-sm">{children}</table>
    </div>
  );
}

export function Num({
  value,
  muted0 = true,
}: {
  value: number | null | undefined;
  muted0?: boolean;
}) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("num", muted0 && value === 0 && "text-muted-foreground")}>{value}</span>
  );
}

// --- A report block: the chart over its table ------------------------------------------

export function ReportBlock({
  title,
  description,
  actions,
  chart,
  children,
  className,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
  chart?: ReactNode;
  children?: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn("card-surface min-w-0 overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="space-y-5 p-5">
        {chart}
        {children}
      </div>
    </section>
  );
}

/** A label → count breakdown as a chart and a two-column table with each share. */
export function CountBlock({
  title,
  description,
  rows,
  defaultType = "bar",
  valueLabel = "العدد",
  labelHeading = "البند",
  storageKey,
  className,
}: {
  title: string;
  description?: string;
  rows: Array<{ label: string; count: number }>;
  defaultType?: ChartType;
  valueLabel?: string;
  labelHeading?: string;
  storageKey?: string;
  className?: string | undefined;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <ReportBlock
      title={title}
      description={description}
      className={className}
      chart={
        <ReportChart
          rows={rows}
          labelKey="label"
          series={[{ key: "count", label: valueLabel }]}
          defaultType={defaultType}
          types={["bar", "hbar", "pie", "donut", "line", "area", "radar"]}
          height={260}
          {...(storageKey ? { storageKey } : {})}
        />
      }
    >
      {rows.length > 0 && (
        <TableFrame>
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>{labelHeading}</th>
              <th className={TH}>{valueLabel}</th>
              <th className={TH}>النسبة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={cn(TD, "font-medium")}>{r.label}</td>
                <td className={TD}>
                  <Num value={r.count} />
                </td>
                <td className={TD}>
                  <span className="num text-xs text-muted-foreground">
                    {total ? `${Math.round((r.count / total) * 1000) / 10}%` : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </ReportBlock>
  );
}

// --- Tabs ----------------------------------------------------------------------------

export function ReportTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: ReadonlyArray<{ key: K; label: string; icon: typeof CalendarRange }>;
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="mb-4 flex max-w-full flex-wrap gap-1 rounded-xl bg-secondary p-1">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
            value === key ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** A small segmented picker (a metric, a grouping). */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ key: K; label: string }>;
  value: K;
  onChange: (k: K) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
      <div className="flex flex-wrap gap-0.5 rounded-lg border border-border p-0.5">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
              value === o.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

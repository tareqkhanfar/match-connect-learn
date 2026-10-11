import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  AreaChart as AreaIcon,
  BarChart3,
  BarChartHorizontal,
  Donut,
  Layers,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Radar as RadarIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/**
 * One chart for every report, its type chosen by the reader.
 *
 * The same rows read differently as bars (who is furthest behind), a line
 * (how it moved over the term) or a pie (what share each part takes), and
 * which of those matters depends on who is asking — so the report gives a
 * sensible default and the reader may switch. The table beside it is the
 * exact view; the chart is for seeing the shape.
 *
 * Colours are a CVD-checked categorical palette, each slot stepped separately
 * for the dark theme (validated with the dataviz palette script, adjacent
 * pairs), and always assigned in the same order so a series keeps its colour
 * when the type changes. Recharts has no right-to-left mode, so the plot is
 * drawn left-to-right and mirrored by axis: categories start on the right and
 * horizontal bars grow leftwards, as an Arabic reader expects.
 */

export type ChartType = "bar" | "hbar" | "stacked" | "line" | "area" | "pie" | "donut" | "radar";

export interface ReportSeries<K extends string = string> {
  key: K;
  label: string;
}

const PALETTE_LIGHT = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6",
  "#e34948",
];
const PALETTE_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];
// «أخرى» is not a category of its own, so it gets no hue.
const OTHER = { light: "#8a8a86", dark: "#77766f" };
const MAX_SLICES = 8;

const TYPE_META: Record<ChartType, { label: string; icon: typeof BarChart3 }> = {
  bar: { label: "أعمدة", icon: BarChart3 },
  hbar: { label: "أشرطة", icon: BarChartHorizontal },
  stacked: { label: "مكدّس", icon: Layers },
  line: { label: "خطي", icon: LineIcon },
  area: { label: "مساحي", icon: AreaIcon },
  pie: { label: "دائري", icon: PieIcon },
  donut: { label: "حلقي", icon: Donut },
  radar: { label: "راداري", icon: RadarIcon },
};

const ALL_TYPES: ChartType[] = ["bar", "hbar", "stacked", "line", "area", "pie", "donut", "radar"];

function readStored(key: string | undefined): ChartType | null {
  if (!key) return null;
  try {
    const v = window.localStorage.getItem(`report-chart:${key}`);
    return v && (ALL_TYPES as string[]).includes(v) ? (v as ChartType) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string | undefined, type: ChartType) {
  if (!key) return;
  try {
    window.localStorage.setItem(`report-chart:${key}`, type);
  } catch {
    // A private window refuses storage; the choice just is not remembered.
  }
}

/** A long Arabic label shortened for an axis; the tooltip shows it whole. */
function short(text: unknown, max = 16): string {
  const s = String(text ?? "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function formatValue(v: unknown, suffix: string): string {
  if (typeof v !== "number") return String(v ?? "—");
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}${suffix}`;
}

interface ReportChartProps<T extends object> {
  rows: readonly T[];
  /** The field naming each category (a teacher, a section, a day). */
  labelKey: Extract<keyof T, string>;
  /** The numeric fields to draw, with their Arabic names. */
  series: ReadonlyArray<ReportSeries<Extract<keyof T, string>>>;
  defaultType?: ChartType;
  /** The types offered; defaults to everything that suits the data. */
  types?: ChartType[];
  /** Appended to values: "%" for rates. */
  valueSuffix?: string;
  /** Fixes the value axis (100 for percentages). */
  domainMax?: number;
  /** Height of the plot in pixels; horizontal bars grow with the rows. */
  height?: number;
  /** Cartesian charts show at most this many categories, in the order given. */
  maxCategories?: number;
  /** Remembers the reader's choice for this chart between visits. */
  storageKey?: string;
  emptyText?: string;
  className?: string;
  /** Rendered at the start of the toolbar (a title, a note). */
  caption?: ReactNode;
}

type Row = Record<string, unknown>;

export function ReportChart<T extends object>({
  rows,
  labelKey,
  series,
  defaultType = "bar",
  types,
  valueSuffix = "",
  domainMax,
  height = 300,
  maxCategories = 40,
  storageKey,
  emptyText = "لا توجد بيانات للرسم",
  className,
  caption,
}: ReportChartProps<T>) {
  const offered = useMemo(() => {
    const base = types ?? ALL_TYPES;
    return base.filter((t) => {
      if (t === "stacked") return series.length > 1;
      if (t === "radar") return rows.length >= 3;
      return true;
    });
  }, [types, series.length, rows.length]);

  const [type, setType] = useState<ChartType>(defaultType);
  // Read after mount: the server render has no storage, and reading it during
  // the first render would make the two disagree.
  useEffect(() => {
    const stored = readStored(storageKey);
    if (stored) setType(stored);
  }, [storageKey]);
  const active: ChartType = offered.includes(type)
    ? type
    : offered.includes(defaultType)
      ? defaultType
      : (offered[0] ?? "bar");

  function choose(t: ChartType) {
    setType(t);
    writeStored(storageKey, t);
  }

  const data = rows as unknown as readonly Row[];
  const cartesian = useMemo(() => data.slice(0, maxCategories), [data, maxCategories]);
  const pieKey = series[0]?.key ?? "";

  // A pie of thirty slivers says nothing: the largest seven are kept and the
  // rest folded into «أخرى».
  const slices = useMemo(() => {
    const sorted = [...data]
      .map((r) => ({ label: String(r[labelKey] ?? "—"), value: Number(r[pieKey] ?? 0) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    if (sorted.length <= MAX_SLICES) return sorted;
    const head = sorted.slice(0, MAX_SLICES - 1);
    const rest = sorted.slice(MAX_SLICES - 1).reduce((s, r) => s + r.value, 0);
    return [...head, { label: "أخرى", value: rest, other: true }];
  }, [data, labelKey, pieKey]);

  // Colours live on the component's root, light and dark, so the plot and
  // the legend under it read the same variables.
  const rootId = `rc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { config, css } = useMemo(() => {
    const c: ChartConfig = {};
    const light: string[] = [];
    const dark: string[] = [];
    series.forEach((s, i) => {
      c[s.key] = { label: s.label };
      light.push(`--color-${s.key}: ${PALETTE_LIGHT[i % PALETTE_LIGHT.length] ?? OTHER.light};`);
      dark.push(`--color-${s.key}: ${PALETTE_DARK[i % PALETTE_DARK.length] ?? OTHER.dark};`);
    });
    slices.forEach((s, i) => {
      const other = "other" in s;
      light.push(`--color-slice${i}: ${other ? OTHER.light : (PALETTE_LIGHT[i] ?? OTHER.light)};`);
      dark.push(`--color-slice${i}: ${other ? OTHER.dark : (PALETTE_DARK[i] ?? OTHER.dark)};`);
    });
    return {
      config: c,
      css: `[data-rc="${rootId}"]{${light.join("")}} .dark [data-rc="${rootId}"]{${dark.join("")}}`,
    };
  }, [series, slices, rootId]);

  const empty =
    data.length === 0 ||
    data.every((r) => series.every((s) => !Number(r[s.key] ?? 0))) ||
    ((active === "pie" || active === "donut") && slices.length === 0);

  const plotHeight =
    active === "hbar" || (active === "stacked" && cartesian.length > 8)
      ? Math.max(height, cartesian.length * (series.length > 1 ? 34 : 28) + 60)
      : height;

  const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
  const many = cartesian.length > 6;
  const valueDomain: [number, number | "auto"] = [0, domainMax ?? "auto"];

  function renderChart() {
    const tooltip = (
      <Tooltip
        cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        content={<ChartTip suffix={valueSuffix} />}
      />
    );
    const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />;
    const xCat = (
      <XAxis
        dataKey={labelKey}
        reversed
        tick={axisTick}
        tickLine={false}
        axisLine={{ stroke: "var(--border)" }}
        interval={many ? 0 : "preserveStartEnd"}
        angle={many ? -40 : 0}
        textAnchor={many ? "end" : "middle"}
        height={many ? 78 : 30}
        tickFormatter={(v: unknown) => short(v, many ? 14 : 20)}
      />
    );
    const yVal = (
      <YAxis
        orientation="right"
        tick={axisTick}
        tickLine={false}
        axisLine={false}
        width={44}
        domain={valueDomain}
        allowDecimals={false}
        tickFormatter={(v: number) => `${v}${valueSuffix}`}
      />
    );

    switch (active) {
      case "hbar":
        return (
          <BarChart data={cartesian as Row[]} layout="vertical" margin={{ left: 8, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              reversed
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              domain={valueDomain}
              allowDecimals={false}
              tickFormatter={(v: number) => `${v}${valueSuffix}`}
            />
            <YAxis
              type="category"
              dataKey={labelKey}
              orientation="right"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={120}
              interval={0}
              tickFormatter={(v: unknown) => short(v, 18)}
            />
            {tooltip}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={`var(--color-${s.key})`}
                radius={[4, 0, 0, 4]}
                maxBarSize={22}
                stroke="var(--card)"
                strokeWidth={1}
              />
            ))}
          </BarChart>
        );
      case "bar":
      case "stacked":
        return (
          <BarChart data={cartesian as Row[]} margin={{ top: 8, left: 4, right: 4 }}>
            {grid}
            {xCat}
            {yVal}
            {tooltip}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={`var(--color-${s.key})`}
                maxBarSize={32}
                stroke="var(--card)"
                strokeWidth={active === "stacked" ? 2 : 1}
                {...(active === "stacked"
                  ? {
                      stackId: "all",
                      radius: (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) as [
                        number,
                        number,
                        number,
                        number,
                      ],
                    }
                  : { radius: [4, 4, 0, 0] as [number, number, number, number] })}
              />
            ))}
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={cartesian as Row[]} margin={{ top: 8, left: 4, right: 4 }}>
            {grid}
            {xCat}
            {yVal}
            <Tooltip content={<ChartTip suffix={valueSuffix} />} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                dot={
                  cartesian.length <= 31 ? { r: 4, strokeWidth: 2, stroke: "var(--card)" } : false
                }
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
              />
            ))}
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={cartesian as Row[]} margin={{ top: 8, left: 4, right: 4 }}>
            {grid}
            {xCat}
            {yVal}
            <Tooltip content={<ChartTip suffix={valueSuffix} />} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={`var(--color-${s.key})`}
                fill={`var(--color-${s.key})`}
                fillOpacity={series.length > 1 ? 0.15 : 0.25}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );
      case "pie":
      case "donut": {
        const total = slices.reduce((s, r) => s + r.value, 0);
        return (
          <PieChart>
            <Tooltip content={<ChartTip suffix={valueSuffix} total={total} />} />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius={active === "donut" ? "55%" : 0}
              outerRadius="80%"
              paddingAngle={slices.length > 1 ? 1 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
              label={
                slices.length <= 6
                  ? ({ percent }: { percent?: number }) =>
                      percent && percent >= 0.06 ? `${Math.round(percent * 100)}%` : ""
                  : false
              }
              labelLine={false}
            >
              {slices.map((s, i) => (
                <Cell key={s.label} fill={`var(--color-slice${i})`} />
              ))}
            </Pie>
          </PieChart>
        );
      }
      case "radar":
        return (
          <RadarChart data={cartesian.slice(0, 12) as Row[]} outerRadius="72%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey={labelKey}
              tick={axisTick}
              tickFormatter={(v: unknown) => short(v, 12)}
            />
            <PolarRadiusAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              domain={valueDomain}
            />
            <Tooltip content={<ChartTip suffix={valueSuffix} />} />
            {series.map((s) => (
              <Radar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={`var(--color-${s.key})`}
                fill={`var(--color-${s.key})`}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        );
    }
  }

  const legendItems =
    active === "pie" || active === "donut"
      ? slices.map((s, i) => ({ key: `slice${i}`, label: s.label, value: s.value }))
      : series.length > 1
        ? series.map((s) => ({
            key: s.key as string,
            label: s.label,
            value: null as number | null,
          }))
        : [];

  return (
    <div data-rc={rootId} className={cn("min-w-0", className)}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-xs text-muted-foreground">{caption}</div>
        <div
          role="radiogroup"
          aria-label="نوع الرسم"
          className="flex max-w-full flex-wrap items-center gap-0.5 rounded-xl bg-secondary p-1"
        >
          {offered.map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            const on = t === active;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                title={meta.label}
                onClick={() => choose(t)}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors",
                  on
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {empty ? (
        <div
          className="grid place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground"
          style={{ height: Math.min(height, 200) }}
        >
          {emptyText}
        </div>
      ) : (
        <>
          <div dir="ltr" className="w-full">
            <ChartContainer
              config={config}
              className="aspect-auto w-full"
              style={{ height: plotHeight }}
            >
              {renderChart()}
            </ChartContainer>
          </div>
          {legendItems.length > 0 && (
            <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
              {legendItems.map((item) => (
                <li key={item.key} className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: `var(--color-${item.key})` }}
                  />
                  <span className="truncate text-muted-foreground">{item.label}</span>
                  {item.value !== null && <span className="num font-semibold">{item.value}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** The tooltip, written right-to-left and showing zeros (the stock one hides them). */
function ChartTip({
  active,
  payload,
  label,
  suffix,
  total,
}: TooltipProps<number, string> & { suffix: string; total?: number }) {
  if (!active || !payload?.length) return null;
  const first = payload[0];
  const heading =
    total !== undefined ? String(first?.name ?? "") : String(label ?? first?.payload?.label ?? "");
  return (
    <div
      dir="rtl"
      className="grid min-w-[9rem] gap-1.5 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl"
    >
      {heading && <p className="font-semibold">{heading}</p>}
      {payload.map((item, i) => {
        const color =
          (item.payload as { fill?: string } | undefined)?.fill ?? item.color ?? "currentColor";
        return (
          <div key={`${item.dataKey ?? i}`} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
              {total !== undefined ? "العدد" : item.name}
            </span>
            <span className="num font-semibold">
              {formatValue(item.value, suffix)}
              {total ? (
                <span className="ms-1 text-muted-foreground">
                  ({Math.round((Number(item.value) / total) * 100)}%)
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

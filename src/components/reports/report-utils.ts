/** Helpers the report screens share — kept apart from the components for fast refresh. */

export type TileTone = "neutral" | "good" | "warn" | "bad" | "info";

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** A rate's tone: what the leadership would circle in red. */
export function rateTone(pct: number | null | undefined, good = 90, fair = 60): TileTone {
  if (pct === null || pct === undefined) return "neutral";
  return pct >= good ? "good" : pct >= fair ? "warn" : "bad";
}

export function pctText(pct: number | null | undefined): string {
  return pct === null || pct === undefined ? "—" : `${pct}%`;
}

export function outcomeTone(key: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (key === "Returned to Class") return "success";
  if (key === "Sent Home") return "warning";
  if (key === "Referred to Hospital") return "danger";
  if (key === "Rest in Clinic") return "info";
  return "muted";
}

export const TH =
  "whitespace-nowrap px-3 pb-2.5 text-start text-xs font-semibold text-muted-foreground";
export const TD = "px-3 py-2.5 align-middle";

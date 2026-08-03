import { cn } from "@/lib/utils";

/** Colour band for a percentage — shared by every grade display. */
export function gradeTone(percentage: number) {
  if (percentage >= 90) return "bg-success-soft text-success border-success/30";
  if (percentage >= 80) return "bg-primary-soft text-primary border-primary/30";
  if (percentage >= 65) return "bg-info-soft text-info border-info/30";
  if (percentage >= 50) return "bg-warning-soft text-warm-foreground border-warning/40";
  return "bg-destructive-soft text-destructive border-destructive/30";
}

export function progressTone(percentage: number): "success" | "primary" | "warning" | "danger" {
  if (percentage >= 80) return "success";
  if (percentage >= 65) return "primary";
  if (percentage >= 50) return "warning";
  return "danger";
}

interface Props {
  percentage: number;
  grade?: string | undefined;
  emoji?: string | undefined;
  label?: string | undefined;
  /** Show the percentage next to the letter. */
  showPercentage?: boolean | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  className?: string | undefined;
}

/** A letter grade with its emoji, e.g. "🎉 A — 92.5%". */
export function GradeBadge({
  percentage,
  grade,
  emoji,
  label,
  showPercentage = true,
  size = "md",
  className,
}: Props) {
  const sizes = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3.5 py-1.5 text-sm gap-2",
  };

  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center rounded-full border font-bold whitespace-nowrap",
        gradeTone(percentage),
        sizes[size],
        className,
      )}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      {grade && <span>{grade}</span>}
      {showPercentage && <span className="num">{percentage}%</span>}
    </span>
  );
}

/** Large emoji + percentage, for the top of a report card. */
export function GradeHero({
  percentage,
  grade,
  emoji,
  label,
  caption,
}: {
  percentage: number;
  grade: string;
  emoji: string;
  label: string;
  caption?: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-5 text-center", gradeTone(percentage))}>
      <div className="text-4xl leading-none" aria-hidden>
        {emoji}
      </div>
      <p className="num mt-2 text-3xl font-extrabold">{percentage}%</p>
      <p className="mt-1 text-sm font-bold">
        {grade} — {label}
      </p>
      {caption && <p className="mt-1 text-xs opacity-80">{caption}</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";

export type ViewMode = "cards" | "table";

/**
 * Switch a listing between cards and a table.
 *
 * Cards read better for a handful of rich records; the table is what gives a
 * page export, sorting and column control. Remembering the choice per screen
 * means a user who prefers one never has to re-pick it.
 */
export function useViewMode(storageKey: string, initial: ViewMode = "cards") {
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return initial;
    const saved = window.localStorage.getItem(`ms-view-${storageKey}`);
    return saved === "cards" || saved === "table" ? saved : initial;
  });

  useEffect(() => {
    window.localStorage.setItem(`ms-view-${storageKey}`, mode);
  }, [storageKey, mode]);

  return [mode, setMode] as const;
}

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-secondary p-1">
      <button
        onClick={() => onChange("cards")}
        aria-label="عرض البطاقات"
        aria-pressed={mode === "cards"}
        title="بطاقات"
        className={`grid size-8 place-items-center rounded-lg transition-colors ${
          mode === "cards" ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid className="size-4" />
      </button>
      <button
        onClick={() => onChange("table")}
        aria-label="عرض الجدول"
        aria-pressed={mode === "table"}
        title="جدول (مع تصدير وتحكم بالأعمدة)"
        className={`grid size-8 place-items-center rounded-lg transition-colors ${
          mode === "table" ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Table2 className="size-4" />
      </button>
    </div>
  );
}

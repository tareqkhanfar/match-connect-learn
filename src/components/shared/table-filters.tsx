import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/shared/searchable-select";

/**
 * One filter a table offers.
 *
 * Declared by the screen rather than inferred from the data, because only the
 * screen knows which field the server actually filters on — guessing produces
 * controls that look right and quietly do nothing.
 */
export type FilterDef =
  | {
      kind: "select";
      field: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      placeholder?: string;
    }
  | { kind: "text"; field: string; label: string; placeholder?: string }
  | { kind: "date"; field: string; label: string }
  | { kind: "dateRange"; field: string; label: string };

export type FilterValues = Record<string, string>;

/** Drop empty values so they are never sent as filters. */
export function activeFilters(values: FilterValues): FilterValues {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== "" && v !== undefined && v !== null),
  );
}

/**
 * A collapsible filter bar shared by every table in the system.
 *
 * Collapsed by default with a count of what is applied, so a screen with six
 * filters is not permanently a wall of controls.
 */
export function TableFilters({
  filters,
  values,
  onChange,
  alwaysOpen = false,
}: {
  filters: FilterDef[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  alwaysOpen?: boolean;
}) {
  const [open, setOpen] = useState(alwaysOpen);
  const active = useMemo(() => Object.keys(activeFilters(values)).length, [values]);

  if (!filters.length) return null;

  function set(field: string, value: string) {
    onChange({ ...values, [field]: value });
  }

  function clearAll() {
    onChange({});
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        {!alwaysOpen && (
          <button
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
              active
                ? "border-primary/40 bg-primary-soft text-primary"
                : "border-border bg-card hover:bg-secondary"
            }`}
          >
            <Filter className="size-3.5" />
            تصفية
            {active > 0 && <span className="num">({active})</span>}
          </button>
        )}

        {/* Applied filters stay visible when the panel is closed, so nobody
            wonders why a table looks empty. */}
        {!open &&
          Object.entries(activeFilters(values)).map(([field, value]) => {
            const def = filters.find((f) => f.field === field);
            if (!def) return null;
            const shown =
              def.kind === "select"
                ? (def.options.find((o) => o.value === value)?.label ?? value)
                : value;
            return (
              <button
                key={field}
                onClick={() => set(field, "")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-semibold hover:bg-destructive-soft hover:text-destructive"
              >
                <span className="text-muted-foreground">{def.label}:</span>
                {shown}
                <X className="size-3" />
              </button>
            );
          })}

        {active > 0 && (
          <button
            onClick={clearAll}
            className="h-9 rounded-xl px-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
          >
            مسح الكل
          </button>
        )}
      </div>

      {open && (
        <div className="card-surface mt-2 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {filters.map((f) => (
            <div key={f.field} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>

              {f.kind === "select" && (
                <SearchableSelect
                  value={values[f.field] ?? ""}
                  onChange={(v) => set(f.field, v)}
                  options={f.options}
                  placeholder={f.placeholder ?? "الكل"}
                  clearable
                  clearLabel="الكل"
                />
              )}

              {f.kind === "text" && (
                <Input
                  value={values[f.field] ?? ""}
                  placeholder={f.placeholder ?? ""}
                  onChange={(e) => set(f.field, e.target.value)}
                  className="h-10"
                />
              )}

              {f.kind === "date" && (
                <Input
                  type="date"
                  value={values[f.field] ?? ""}
                  onChange={(e) => set(f.field, e.target.value)}
                  className="h-10"
                />
              )}

              {f.kind === "dateRange" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={values[`${f.field}_from`] ?? ""}
                    onChange={(e) => set(`${f.field}_from`, e.target.value)}
                    className="h-10"
                    aria-label={`${f.label} من`}
                  />
                  <span className="text-xs text-muted-foreground">إلى</span>
                  <Input
                    type="date"
                    value={values[`${f.field}_to`] ?? ""}
                    onChange={(e) => set(`${f.field}_to`, e.target.value)}
                    className="h-10"
                    aria-label={`${f.label} إلى`}
                  />
                </div>
              )}
            </div>
          ))}

          {!alwaysOpen && (
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <button
                onClick={() => setOpen(false)}
                className="h-9 rounded-xl border border-border px-4 text-xs font-semibold hover:bg-secondary"
              >
                إخفاء
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

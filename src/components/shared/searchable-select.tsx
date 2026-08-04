import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Option {
  /** The stored value, usually the record id. */
  value: string;
  /** Human-readable name. */
  label: string;
  /** Short code shown beside the label; searchable in its own right. */
  code?: string;
  /** Extra line under the label, e.g. a class or a program. */
  hint?: string;
  disabled?: boolean;
}

/** Normalise for search: fold Arabic orthographic variants and drop marks. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // harakat and tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

/** Does the option match the query, by name or by code? */
function matches(option: Option, query: string): boolean {
  if (!query) return true;
  const q = normalise(query);
  return (
    normalise(option.label).includes(q) ||
    normalise(option.code ?? "").includes(q) ||
    normalise(option.hint ?? "").includes(q) ||
    normalise(option.value).includes(q)
  );
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /** Show an "all" entry that clears the selection — handy for filters. */
  clearable?: boolean;
  clearLabel?: string;
  /**
   * Notified as the user types. Supply this when the option list is fetched
   * from the server; local filtering still runs over whatever has arrived.
   */
  onSearchChange?: ((query: string) => void) | undefined;
}

/**
 * A single-select dropdown with a search box, showing "code — name" and
 * matching on either. Replaces the plain Select wherever the list is long
 * enough that scrolling it is a chore.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "اختر…",
  searchPlaceholder = "ابحث بالاسم أو الرمز…",
  emptyText = "لا توجد نتائج.",
  disabled = false,
  className,
  clearable = false,
  clearLabel = "الكل",
  onSearchChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function updateQuery(next: string) {
    setQuery(next);
    onSearchChange?.(next);
  }

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  // When the caller fetches on search, the server has already filtered; running
  // the local filter as well would hide rows it deliberately returned.
  const filtered = useMemo(
    () => (onSearchChange ? options : options.filter((o) => matches(o, query))),
    [options, query, onSearchChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 text-sm transition-colors",
            "hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            "disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-right">
            {selected ? (
              <>
                {selected.code && (
                  <span className="num shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {selected.code}
                  </span>
                )}
                <span className="truncate">{selected.label}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        dir="rtl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={updateQuery}
            className="text-right"
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearable && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                    updateQuery("");
                  }}
                  className="gap-2"
                >
                  <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
                  <span className="text-muted-foreground">{clearLabel}</span>
                </CommandItem>
              )}
              {filtered.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled ?? false}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                    updateQuery("");
                  }}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      option.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.code && (
                    <span className="num shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {option.code}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {option.hint}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface MultiSelectProps extends Omit<SearchableSelectProps, "value" | "onChange"> {
  values: string[];
  onChange: (values: string[]) => void;
  /** Cap the number of chips rendered before collapsing to a count. */
  maxChips?: number;
}

/** The same control, but accumulating several values as removable chips. */
export function SearchableMultiSelect({
  options,
  values,
  onChange,
  placeholder = "اختر…",
  searchPlaceholder = "ابحث بالاسم أو الرمز…",
  emptyText = "لا توجد نتائج.",
  disabled = false,
  className,
  maxChips = 6,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => options.filter((o) => matches(o, query)), [options, query]);
  const selected = useMemo(
    () => values.map((v) => options.find((o) => o.value === v)).filter(Boolean) as Option[],
    [values, options],
  );

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 text-sm transition-colors",
              "hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              "disabled:cursor-not-allowed disabled:opacity-60",
              className,
            )}
          >
            <span className="truncate text-right text-muted-foreground">
              {values.length ? `${values.length} محدد` : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          dir="rtl"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
              className="text-right"
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled ?? false}
                    onSelect={() => toggle(option.value)}
                    className="gap-2"
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        values.includes(option.value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option.code && (
                      <span className="num shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {option.code}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.hint && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {option.hint}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.slice(0, maxChips).map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-soft px-2 py-1 text-xs font-medium text-primary"
            >
              {option.label}
              <button
                type="button"
                onClick={() => toggle(option.value)}
                aria-label={`إزالة ${option.label}`}
                className="rounded transition-colors hover:bg-primary/20"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {selected.length > maxChips && (
            <span className="inline-flex items-center rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">
              +{selected.length - maxChips}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

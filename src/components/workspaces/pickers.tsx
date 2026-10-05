import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WS_COLORS, WS_ICONS, wsColor, wsIcon } from "@/lib/workspace-icons";

/** A grid of the allowed icons, in a popover. Empty clears it. */
export function IconPicker({
  value,
  onChange,
  color,
  allowEmpty,
  emptyLabel = "تلقائية",
}: {
  value: string;
  onChange: (v: string) => void;
  color?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = wsIcon(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-2 text-xs hover:bg-secondary"
        type="button"
      >
        <span className={cn("grid size-6 place-items-center rounded-md", wsColor(color).tile)}>
          <Icon className="size-3.5" />
        </span>
        {value ? "تغيير الأيقونة" : allowEmpty ? emptyLabel : "اختر أيقونة"}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="grid grid-cols-8 gap-1">
          {allowEmpty && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={cn(
                "col-span-2 rounded-md border px-1 text-[10px]",
                !value ? "border-primary text-primary" : "border-border text-muted-foreground",
              )}
            >
              {emptyLabel}
            </button>
          )}
          {Object.entries(WS_ICONS).map(([key, I]) => (
            <button
              key={key}
              type="button"
              title={key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={cn(
                "grid size-8 place-items-center rounded-md transition-colors",
                value === key ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
              )}
            >
              <I className="size-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ColorPicker({
  value,
  onChange,
  allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowEmpty && (
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "h-6 rounded-full border px-2 text-[10px]",
            !value ? "border-primary text-primary" : "border-border text-muted-foreground",
          )}
        >
          تلقائي
        </button>
      )}
      {Object.entries(WS_COLORS).map(([key, c]) => (
        <button
          key={key}
          type="button"
          title={c.label}
          onClick={() => onChange(key)}
          className={cn(
            "size-6 rounded-full ring-offset-2 ring-offset-background transition-shadow",
            c.dot,
            value === key ? "ring-2 ring-foreground/60" : "",
          )}
        />
      ))}
    </div>
  );
}

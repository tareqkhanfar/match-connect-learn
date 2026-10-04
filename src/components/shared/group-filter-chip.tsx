import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { School, X } from "lucide-react";
import { useClasses } from "@/lib/api/hooks";

/**
 * «الشعبة: …» — shown on a screen opened from a section's connections panel
 * whose data is narrowed to that section without a section field of its own.
 * Without it the reader saw a filtered list and empty filters, and could
 * neither tell why nor undo it. ✕ drops the section from the address.
 */
export function GroupFilterChip({ group }: { group: string | undefined }) {
  const classes = useClasses();
  const navigate = useNavigate();
  if (!group) return null;
  const label = classes.data?.find((c) => c.name === group)?.student_group_name ?? group;
  return (
    <span className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary-soft px-3 text-xs font-bold text-primary">
      <School className="size-3.5" />
      الشعبة: {label}
      <button
        onClick={() =>
          void navigate({
            to: ".",
            // Every route here shares the `groupSearch` shape; the reducer is
            // typed loosely because it runs on whichever of them is open.
            search: ((prev: Record<string, unknown>) => {
              const { group: _drop, ...rest } = prev;
              void _drop;
              return rest;
            }) as never,
          })
        }
        aria-label="إلغاء تحديد الشعبة"
        className="rounded p-0.5 hover:bg-primary/20"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

/**
 * Keep a screen's own section field in step with the address. A field filled
 * from `?group=` only when the screen first mounts went stale when the panel
 * opened the same screen again for another section: the data followed the
 * address, the field did not.
 */
export function useGroupFromUrl(groupFromUrl: string | undefined, setGroup: (g: string) => void) {
  useEffect(() => {
    if (groupFromUrl) setGroup(groupFromUrl);
    // Only a change in the address should move the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFromUrl]);
}

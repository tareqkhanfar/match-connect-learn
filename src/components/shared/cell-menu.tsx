import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A right-click menu for grid cells.
 *
 * One instance for the whole grid, opened at the pointer. Radix's per-trigger
 * context menu was closing itself the instant it opened after other popovers
 * on the page had been used, and a grid of forty triggers is forty menus'
 * worth of machinery for what is, at any moment, one open list.
 */
export function CellMenu({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Open towards the start side (left, in Arabic) and stay on screen — also
  // when a group expands inside it and the menu grows after opening.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      const margin = 8;
      let left = x - width;
      if (left < margin) left = Math.min(x, window.innerWidth - width - margin);
      let top = y;
      if (top + height > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - height - margin);
      }
      setPos((p) => (p.left === left && p.top === top ? p : { left, top }));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [x, y]);

  // Set up once per opening. The parent re-renders while the menu is open (a
  // background check returning), and re-running this would pull keyboard
  // focus back to the first item mid-choice.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onClose = () => closeRef.current();
    ref.current?.querySelector<HTMLButtonElement>("[data-menu-item]:not(:disabled)")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const items = [
        ...(ref.current?.querySelectorAll<HTMLButtonElement>("[data-menu-item]:not(:disabled)") ??
          []),
      ];
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === "ArrowDown" ? at + 1 : at - 1;
      items[(next + items.length) % items.length]?.focus();
    };
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="menu"
      dir="rtl"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 max-h-[calc(100vh-16px)] w-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{ left: pos.left, top: pos.top }}
    >
      {children}
    </div>
  );
}

export function CellMenuLabel({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <div
      className={cn(
        "truncate px-2 py-1.5 text-xs",
        muted ? "text-[11px] text-muted-foreground" : "font-bold",
      )}
    >
      {children}
    </div>
  );
}

export function CellMenuSeparator() {
  return <div className="-mx-1 my-1 h-px bg-border" />;
}

export function CellMenuItem({
  icon,
  children,
  hint,
  onSelect,
  disabled,
  danger,
}: {
  icon?: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-menu-item
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-40",
        danger && "text-destructive hover:text-destructive focus-visible:text-destructive",
      )}
    >
      {icon && <span className="shrink-0 [&_svg]:size-3.5">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[10px] text-muted-foreground">{hint}</span>}
    </button>
  );
}

/** A group that opens in place — no flyout to chase across a right-to-left screen. */
export function CellMenuGroup({
  icon,
  title,
  defaultOpen,
  disabled,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button
        type="button"
        role="menuitem"
        data-menu-item
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-xs outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
      >
        {icon && <span className="shrink-0 [&_svg]:size-3.5">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronDown
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mb-1 me-1 ms-3 max-h-56 overflow-y-auto border-s border-border ps-1">
          {children}
        </div>
      )}
    </div>
  );
}

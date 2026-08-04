import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmTone = "danger" | "warning" | "info" | "success" | "question";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Extra content between the description and the buttons. */
  body?: ReactNode;
}

const TONE: Record<ConfirmTone, { icon: LucideIcon; ring: string; button: string }> = {
  danger: {
    icon: Trash2,
    ring: "bg-destructive-soft text-destructive",
    button: "bg-destructive text-white hover:brightness-110",
  },
  warning: {
    icon: AlertTriangle,
    ring: "bg-warning-soft text-warning",
    button: "bg-warning text-warning-foreground hover:brightness-105",
  },
  info: {
    icon: Info,
    ring: "bg-info-soft text-info",
    button: "bg-brand-gradient text-primary-foreground",
  },
  success: {
    icon: CheckCircle2,
    ring: "bg-success-soft text-success",
    button: "bg-success text-success-foreground hover:brightness-105",
  },
  question: {
    icon: HelpCircle,
    ring: "bg-primary-soft text-primary",
    button: "bg-brand-gradient text-primary-foreground",
  },
};

type Resolver = (ok: boolean) => void;

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * Replaces window.confirm with a themed dialog.
 *
 * The native prompt is unstyled, ignores RTL, and cannot carry an icon or a
 * warning tone — so a destructive action looked exactly like a harmless one.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<{ resolve: Resolver } | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => setResolver({ resolve }));
  }, []);

  function settle(ok: boolean) {
    resolver?.resolve(ok);
    setResolver(null);
    setOptions(null);
  }

  const tone = TONE[options?.tone ?? "question"];
  const Icon = tone.icon;

  // The callback identity is stable, so consumers never re-render on open.
  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <Dialog open={Boolean(options)} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone.ring}`}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 pt-1">
                <DialogTitle className="text-right">{options?.title}</DialogTitle>
              </div>
            </div>
          </DialogHeader>

          {options?.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{options.description}</p>
          )}
          {options?.body}

          <DialogFooter className="gap-2 sm:justify-start">
            <button
              onClick={() => settle(true)}
              className={`h-10 rounded-xl px-5 text-sm font-bold shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0 ${tone.button}`}
            >
              {options?.confirmLabel ?? "تأكيد"}
            </button>
            <button
              onClick={() => settle(false)}
              className="h-10 rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              {options?.cancelLabel ?? "إلغاء"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/**
 * `const confirm = useConfirm()` then `await confirm({ title, tone })`.
 *
 * Falls back to window.confirm outside the provider, so a component can never
 * silently skip the question.
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  return (
    ctx ??
    (async (options: ConfirmOptions) => window.confirm(options.title))
  );
}

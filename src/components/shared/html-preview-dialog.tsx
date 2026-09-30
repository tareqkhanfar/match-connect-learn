import { Printer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import { printHtml } from "@/lib/api/hooks";

/**
 * A printable page shown as it will print, in a frame, with a print button.
 * `load` fetches the page's HTML; `actions` adds the screen's own buttons
 * (confirm, move on…) beside «طباعة».
 */
export function HtmlPreviewDialog({
  heading,
  load,
  actions,
  onClose,
}: {
  heading: string;
  load: () => Promise<{ html: string; title: string }>;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const [page, setPage] = useState<{ html: string; title: string } | null>(null);
  useEffect(() => {
    load()
      .then(setPage)
      .catch((err) => toast.error(errorMessage(err, "تعذّرت المعاينة")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>هكذا تُطبع.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {page ? (
            <iframe
              title="معاينة"
              className="h-[56rem] w-full"
              srcDoc={`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>body{padding:12px;background:#fff}</style></head><body>${page.html}</body></html>`}
            />
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">جارِ تجهيز المعاينة…</p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
          >
            إغلاق
          </button>
          <button
            disabled={!page}
            onClick={() => page && printHtml(page.html, page.title)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-5 text-sm font-bold hover:bg-secondary disabled:opacity-50"
          >
            <Printer className="size-4" />
            طباعة
          </button>
          {actions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

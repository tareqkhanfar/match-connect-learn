import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBulkDelete, useBulkOptions, useBulkUpdate } from "@/lib/api/hooks";

/** A field the bulk bar can set, with the values it offers. */
export interface BulkField {
  field: string;
  label: string;
  options: Array<{ value: string | number; label: string }>;
}

interface BulkActionsProps {
  doctype: string;
  selected: string[];
  onDone: () => void;
  /** Which settable fields to surface; filtered by what the role may change. */
  fields?: BulkField[];
  /** Noun used in the confirmation copy, e.g. "طالباً". */
  noun?: string;
}

/**
 * The buttons inside DataTable's bulk bar.
 *
 * What is offered comes from the server (bulk_options), so a role never sees
 * an action it would be refused anyway.
 */
export function BulkActions({
  doctype,
  selected,
  onDone,
  fields = [],
  noun = "سجل",
}: BulkActionsProps) {
  const options = useBulkOptions(doctype);
  const bulkDelete = useBulkDelete();
  const bulkUpdate = useBulkUpdate();
  const [confirming, setConfirming] = useState(false);

  const allowedFields = fields.filter((f) => options.data?.fields.includes(f.field));

  function report(result: { failed: Array<{ name: string; reason: string }> }, done: number) {
    if (result.failed.length === 0) {
      toast.success(`تم تنفيذ العملية على ${done} ${noun}`);
    } else {
      // Partial success is the common case (a row is still linked elsewhere),
      // so say what got through rather than reporting a blanket failure.
      toast.warning(
        `نجح ${done} وفشل ${result.failed.length} — ${result.failed[0]?.reason ?? ""}`,
      );
    }
    onDone();
  }

  async function applyValue(field: string, value: string | number) {
    try {
      const result = await bulkUpdate.mutateAsync({ doctype, records: selected, field, value });
      report(result, result.updated);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر تنفيذ العملية");
    }
  }

  async function remove() {
    try {
      const result = await bulkDelete.mutateAsync({ doctype, records: selected });
      report(result, result.deleted);
      setConfirming(false);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  const busy = bulkDelete.isPending || bulkUpdate.isPending;

  return (
    <>
      {busy && <Loader2 className="size-4 animate-spin text-primary" />}

      {allowedFields.map((f) =>
        f.options.map((o) => (
          <button
            key={`${f.field}-${o.value}`}
            onClick={() => applyValue(f.field, o.value)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-card px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            <Check className="size-3.5" />
            {o.label}
          </button>
        )),
      )}

      {options.data?.can_delete && (
        <button
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-card px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
          حذف
        </button>
      )}

      {!options.isLoading && !options.data?.can_delete && allowedFields.length === 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <X className="size-3.5" />
          لا توجد إجراءات متاحة لصلاحيتك
        </span>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            سيتم حذف {selected.length} {noun}. لا يمكن التراجع عن هذا الإجراء. السجلات المرتبطة
            بسجلات أخرى سيتم تخطيها.
          </p>
          <DialogFooter className="gap-2 sm:justify-start">
            <button
              onClick={remove}
              disabled={bulkDelete.isPending}
              className="h-10 rounded-xl bg-destructive px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              {bulkDelete.isPending ? "جارٍ الحذف…" : "حذف"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
            >
              إلغاء
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

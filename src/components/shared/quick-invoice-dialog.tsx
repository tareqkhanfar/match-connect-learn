import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Receipt, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { StudentPicker } from "@/components/shared/student-picker";
import { Pill } from "@/components/shared/ui-kit";
import { errorMessage } from "@/lib/api/error-message";
import { money } from "@/lib/roles";
import {
  useInvoiceStudent,
  useStructureOptions,
  useStructurePreview,
} from "@/lib/api/hooks";

/**
 * Bills one student from a Fee Structure.
 *
 * A school prices per grade, so choosing a structure is the whole decision —
 * picking line items one at a time is the wrong shape of work. The desk cannot
 * do this at all: `Fees` ships read-only in v16 and Fee Schedule only bills a
 * whole Student Group, so this fills that gap.
 *
 * The output is a Sales Invoice against the student's Customer, which is where
 * v16 keeps school billing.
 */
export function QuickInvoiceDialog({
  student: initialStudent,
  onClose,
  onCreated,
}: {
  student?: string;
  onClose: () => void;
  onCreated?: (invoice: { id: string; total: number }) => void;
}) {
  const [student, setStudent] = useState(initialStudent ?? "");
  const [structure, setStructure] = useState("");
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  const options = useStructureOptions(student || null);
  const preview = useStructurePreview(structure || null);
  const create = useInvoiceStudent();

  // Pre-select the structure that matches the student's own grade and year.
  useEffect(() => {
    if (structure || !options.data) return;
    const match = options.data.structures.find((s) => s.suggested);
    if (match) setStructure(match.id);
  }, [options.data, structure]);

  // A different student may need a different structure.
  useEffect(() => {
    setStructure("");
  }, [student]);

  async function submit() {
    if (!student) {
      toast.error("اختر الطالب");
      return;
    }
    if (!structure) {
      toast.error("اختر هيكل الرسوم");
      return;
    }
    try {
      const result = await create.mutateAsync({
        student,
        fee_structure: structure,
        posting_date: postingDate,
        due_date: dueDate,
        submit: 1,
      });
      toast.success(`تم إصدار الفاتورة ${result.id}`);
      onCreated?.({ id: result.id, total: result.total });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر إصدار الفاتورة"));
    }
  }

  const structures = options.data?.structures ?? [];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            فاتورة رسوم من هيكل الرسوم
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>الطالب *</Label>
            <StudentPicker value={student} onChange={setStudent} />
          </div>

          {student && (
            <div className="space-y-1.5">
              <Label>هيكل الرسوم *</Label>
              <SearchableSelect
                value={structure}
                onChange={setStructure}
                options={structures.map((s) => ({
                  value: s.id,
                  label: `${s.program ?? s.id} — ${money(s.total)}${
                    s.suggested ? " ★" : ""
                  }`,
                }))}
                placeholder={
                  options.isLoading ? "جارٍ التحميل…" : "اختر هيكل الرسوم"
                }
              />
              {options.data?.studentProgram && (
                <p className="text-[11px] text-muted-foreground">
                  صف الطالب: {options.data.studentProgram}
                  {options.data.studentAcademicYear
                    ? ` • ${options.data.studentAcademicYear}`
                    : ""}
                  {structures.some((s) => s.suggested) ? " — ★ الهياكل المطابقة" : ""}
                </p>
              )}
            </div>
          )}

          {preview.data && (
            <div className="card-surface p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                <FileText className="size-4 text-primary" />
                بنود الفاتورة
              </p>
              <ul className="divide-y divide-border">
                {preview.data.components.map((c, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="min-w-0 truncate">{c.description || c.category}</span>
                    <span className="num shrink-0 font-semibold">{money(c.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm font-bold">الإجمالي</span>
                <span className="num text-lg font-black text-primary">
                  {money(preview.data.total)}
                </span>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>تاريخ الفاتورة</Label>
              <Input
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الاستحقاق</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-xl bg-info-soft p-3 text-xs text-info">
            <Sparkles className="mt-0.5 size-4 shrink-0" />
            تُصدر الفاتورة كـ <Pill tone="info">Sales Invoice</Pill> على عميل الطالب، فتظهر في
            حسابات ERPNext وتقارير الذمم بشكل قياسي.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={submit}
            disabled={create.isPending || !student || !structure}
            className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {create.isPending ? "جارٍ الإصدار…" : "إصدار الفاتورة"}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

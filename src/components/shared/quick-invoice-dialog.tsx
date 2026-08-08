import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Plus, Receipt, Save, Trash2 } from "lucide-react";
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
import { useConfirm } from "@/components/shared/confirm";
import { errorMessage } from "@/lib/api/error-message";
import { money } from "@/lib/roles";
import {
  useInvoiceStudent,
  useStructureOptions,
  useStructurePreview,
  useStudentEnrollments,
  useSubmitInvoice,
  type StudentInvoice,
} from "@/lib/api/hooks";

interface Line {
  item: string;
  description: string;
  amount: number;
}

/**
 * Bills one student, from a Fee Structure or by hand.
 *
 * The structure is a starting point, not a constraint: every line can be
 * renamed, repriced, removed, or added to before anything is posted. The
 * invoice is saved as a draft first, so a mistake costs nothing — only
 * submitting writes to the ledger.
 *
 * Every school invoice carries the Program Enrollment it belongs to. That link
 * is enforced on the document itself, so it holds in the ERPNext desk too.
 */
export function QuickInvoiceDialog({
  student: initialStudent,
  onClose,
  onCreated,
}: {
  student?: string;
  onClose: () => void;
  onCreated?: (invoice: StudentInvoice) => void;
}) {
  const [student, setStudent] = useState(initialStudent ?? "");
  const [enrollment, setEnrollment] = useState("");
  const [structure, setStructure] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [touched, setTouched] = useState(false);
  const [draft, setDraft] = useState<StudentInvoice | null>(null);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  const options = useStructureOptions(student || null);
  const enrollments = useStudentEnrollments(student || null);
  const preview = useStructurePreview(structure || null);
  const save = useInvoiceStudent();
  const post = useSubmitInvoice();
  const confirm = useConfirm();

  // Pre-select the structure matching the student's own grade and year.
  useEffect(() => {
    if (structure || !options.data) return;
    const match = options.data.structures.find((s) => s.suggested);
    if (match) setStructure(match.id);
  }, [options.data, structure]);

  // One enrolment is the common case; only ask when there is a real choice.
  useEffect(() => {
    if (enrollment || !enrollments.data?.length) return;
    if (enrollments.data.length === 1) setEnrollment(enrollments.data[0]!.id);
  }, [enrollments.data, enrollment]);

  // Load the structure's lines — but never overwrite edits already made.
  useEffect(() => {
    if (!preview.data || touched) return;
    setLines(
      preview.data.components.map((c) => ({
        item: c.item ?? c.category,
        description: c.description || c.category,
        amount: c.amount,
      })),
    );
  }, [preview.data, touched]);

  // A different student means a different grade, so start over.
  useEffect(() => {
    setStructure("");
    setEnrollment("");
    setLines([]);
    setTouched(false);
    setDraft(null);
  }, [student]);

  const total = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  function editLine(index: number, patch: Partial<Line>) {
    setTouched(true);
    setLines((list) => list.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setTouched(true);
    setLines((list) => list.filter((_, i) => i !== index));
  }

  function addLine() {
    setTouched(true);
    setLines((list) => [...list, { item: "", description: "", amount: 0 }]);
  }

  function validate(): string | null {
    if (!student) return "اختر الطالب";
    if (!enrollment) return "اختر التسجيل الدراسي";
    if (!lines.length) return "أضف بنداً واحداً على الأقل";
    if (lines.some((l) => !l.item)) return "كل بند يحتاج صنفاً";
    if (lines.some((l) => !(Number(l.amount) > 0))) return "كل بند يحتاج مبلغاً أكبر من صفر";
    return null;
  }

  async function saveDraft(): Promise<StudentInvoice | null> {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return null;
    }
    try {
      const result = await save.mutateAsync({
        student,
        program_enrollment: enrollment,
        ...(draft ? { invoice: draft.id } : {}),
        components: lines.map((l) => ({
          item: l.item,
          amount: Number(l.amount),
          description: l.description,
        })),
        posting_date: postingDate,
        due_date: dueDate,
        submit: 0,
      });
      setDraft(result);
      toast.success(`تم حفظ المسودة ${result.id}`);
      return result;
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
      return null;
    }
  }

  async function saveAndSubmit() {
    const saved = await saveDraft();
    if (!saved) return;

    const ok = await confirm({
      title: "اعتماد الفاتورة؟",
      description: `سيتم تسجيل القيد المحاسبي بمبلغ ${money(total)}. بعد الاعتماد لا يمكن التعديل — يلزم إلغاء وتعديل.`,
      confirmLabel: "اعتماد",
    });
    if (!ok) return;

    try {
      const posted = await post.mutateAsync(saved.id);
      toast.success(`تم اعتماد الفاتورة ${posted.id}`);
      onCreated?.(posted);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الاعتماد"));
    }
  }

  const busy = save.isPending || post.isPending;
  const enrollmentRows = enrollments.data ?? [];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            فاتورة رسوم
            {draft && <Pill tone="muted">مسودة {draft.id}</Pill>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>الطالب *</Label>
              <StudentPicker value={student} onChange={setStudent} />
            </div>
            <div className="space-y-1.5">
              <Label>التسجيل الدراسي *</Label>
              <SearchableSelect
                value={enrollment}
                onChange={setEnrollment}
                options={enrollmentRows.map((e) => ({
                  value: e.id,
                  label: `${e.program ?? e.id} — ${e.academicYear ?? ""}`,
                }))}
                placeholder={
                  !student
                    ? "اختر الطالب أولاً"
                    : enrollments.isLoading
                      ? "جارٍ التحميل…"
                      : enrollmentRows.length
                        ? "اختر التسجيل"
                        : "لا يوجد تسجيل معتمد"
                }
                disabled={!student || !enrollmentRows.length}
              />
              {student && !enrollments.isLoading && !enrollmentRows.length && (
                <p className="text-[11px] text-destructive">
                  هذا الطالب غير مسجّل في أي برنامج — سجّله أولاً قبل الفوترة.
                </p>
              )}
            </div>
          </div>

          {student && (
            <div className="space-y-1.5">
              <Label>هيكل الرسوم (نقطة بداية — يمكن تعديل البنود بعدها)</Label>
              <SearchableSelect
                value={structure}
                onChange={(v) => {
                  setStructure(v);
                  // An explicit new choice replaces the lines.
                  setTouched(false);
                }}
                options={(options.data?.structures ?? []).map((s) => ({
                  value: s.id,
                  label: `${s.program ?? s.id} — ${money(s.total)}${s.suggested ? " ★" : ""}`,
                }))}
                placeholder={options.isLoading ? "جارٍ التحميل…" : "اختر هيكل الرسوم"}
                clearable
                clearLabel="بدون هيكل (بنود يدوية)"
              />
            </div>
          )}

          <div className="card-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <FileText className="size-4 text-primary" />
                بنود الفاتورة
              </p>
              <button
                onClick={addLine}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
              >
                <Plus className="size-3.5" />
                بند جديد
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
                اختر هيكل رسوم أو أضف بنداً يدوياً.
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] items-center gap-2"
                  >
                    <Input
                      value={line.description}
                      placeholder="الوصف"
                      onChange={(e) => editLine(i, { description: e.target.value })}
                    />
                    <Input
                      type="number"
                      className="num"
                      value={String(line.amount)}
                      min={0}
                      step="0.01"
                      onChange={(e) => editLine(i, { amount: Number(e.target.value) })}
                    />
                    <button
                      onClick={() => removeLine(i)}
                      aria-label="حذف البند"
                      className="rounded-lg bg-secondary px-2.5 py-2 text-destructive transition-colors hover:bg-destructive-soft"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-bold">الإجمالي</span>
              <span className="num text-lg font-black text-primary">{money(total)}</span>
            </div>
          </div>

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

          <p className="rounded-xl bg-info-soft p-3 text-xs leading-relaxed text-info">
            تُحفظ كمسودة أولاً — لا يُسجَّل أي قيد محاسبي قبل الاعتماد. بعد الاعتماد يلزم إلغاء
            الفاتورة لتعديلها، حفاظاً على سلامة السجل المحاسبي.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={saveAndSubmit}
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            <CheckCircle2 className="size-4" />
            {busy ? "جارٍ…" : "حفظ واعتماد"}
          </button>
          <button
            onClick={saveDraft}
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"
          >
            <Save className="size-4" />
            حفظ كمسودة
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

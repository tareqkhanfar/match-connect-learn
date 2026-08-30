import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Pill } from "@/components/shared/ui-kit";
import { errorMessage } from "@/lib/api/error-message";
import {
  useEvaluationForm,
  useEvaluationForms,
  useSaveEvaluationEntry,
  useStudentEvaluations,
} from "@/lib/api/hooks";

/**
 * Assessing one pupil, from their own page.
 *
 * The grid is for filling a class in one sitting; this is for the other real
 * case — something happened today, to this child, and the teacher is already
 * looking at them. Same forms, same answers, one row.
 */
export function StudentEvaluationDialog({
  student,
  studentName,
  studentGroup,
  onClose,
}: {
  student: string;
  studentName?: string | undefined;
  studentGroup?: string | undefined;
  onClose: () => void;
}) {
  const forms = useEvaluationForms();
  const [formId, setFormId] = useState("");
  const form = useEvaluationForm(formId || undefined);
  const history = useStudentEvaluations(student);
  const save = useSaveEvaluationEntry();

  const [values, setValues] = useState<Record<string, { value?: string; note?: string }>>({});
  const [notes, setNotes] = useState("");
  const [published, setPublished] = useState(false);

  // A form already filled in for this pupil opens on what was recorded, so
  // saving again edits it rather than starting from nothing.
  useEffect(() => {
    if (!formId) return;
    const prior = history.data?.entries.find((e) => e.form === formId);
    if (!prior) {
      setValues({});
      setNotes("");
      setPublished(false);
      return;
    }
    const next: Record<string, { value?: string; note?: string }> = {};
    for (const a of prior.answers) {
      const criterion = form.data?.criteria.find((c) => c.item === a.item);
      if (criterion) next[criterion.key] = { value: a.value, ...(a.note ? { note: a.note } : {}) };
    }
    setValues(next);
    setNotes(prior.notes ?? "");
    setPublished(prior.is_published);
  }, [formId, form.data, history.data]);

  async function submit() {
    if (!formId) {
      toast.error("اختر النموذج");
      return;
    }
    if (Object.keys(values).length === 0) {
      toast.error("لم تُقيَّم أي بند");
      return;
    }
    try {
      const res = await save.mutateAsync({
        form: formId,
        student,
        ...(studentGroup ? { student_group: studentGroup } : {}),
        values,
        notes,
        is_published: published ? 1 : 0,
      });
      toast.success(`تم حفظ التقييم — المجموع ${res.total} (${res.percent}%)`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحفظ"));
    }
  }

  const active = (forms.data?.forms ?? []).filter((f) => f.is_active);
  const criteria = form.data?.criteria ?? [];
  const scale = form.data?.scale ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            تقييم {studentName ?? "الطالب"}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto p-1">
          <div>
            <Label className="text-xs">النموذج</Label>
            <Select value={formId} onValueChange={setFormId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر النموذج" />
              </SelectTrigger>
              <SelectContent>
                {active.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.title} — {f.form_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!formId ? (
            <EmptyBlock
              title="اختر نموذجاً للبدء"
              description="ستظهر بنود النموذج لتقييم هذا الطالب عليها."
              icon={<ClipboardList className="size-6" />}
            />
          ) : form.isLoading ? (
            <TableSkeleton rows={4} />
          ) : (
            <>
              {form.data?.categories.map((cat) => (
                <div key={cat} className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-xs font-bold text-muted-foreground">{cat}</p>
                  <ul className="space-y-2">
                    {criteria
                      .filter((c) => c.category === cat)
                      .map((c) => (
                        <CriterionRow
                          key={c.key}
                          item={c.item}
                          scaleType={form.data!.scale_type}
                          scale={scale}
                          maxScore={c.max_score}
                          value={values[c.key]?.value ?? ""}
                          onChange={(v) =>
                            setValues((s) => ({ ...s, [c.key]: { ...(s[c.key] ?? {}), value: v } }))
                          }
                        />
                      ))}
                  </ul>
                </div>
              ))}

              {criteria.some((c) => !c.category) && (
                <div className="rounded-xl border border-border p-3">
                  <ul className="space-y-2">
                    {criteria
                      .filter((c) => !c.category)
                      .map((c) => (
                        <CriterionRow
                          key={c.key}
                          item={c.item}
                          scaleType={form.data!.scale_type}
                          scale={scale}
                          maxScore={c.max_score}
                          value={values[c.key]?.value ?? ""}
                          onChange={(v) =>
                            setValues((s) => ({ ...s, [c.key]: { ...(s[c.key] ?? {}), value: v } }))
                          }
                        />
                      ))}
                  </ul>
                </div>
              )}

              <div>
                <Label className="text-xs">ملاحظة عامة</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
                <Switch checked={published} onCheckedChange={setPublished} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    {published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    ظاهر للطالب وولي الأمر
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    التقييم غير المنشور ملاحظة عمل للمعلم، لا تقرير.
                  </span>
                </span>
              </label>
            </>
          )}

          {(history.data?.entries.length ?? 0) > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">تقييمات سابقة</p>
              <ul className="space-y-1">
                {history.data!.entries.slice(0, 5).map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold">{e.form_title}</span>
                    <span className="num">
                      {e.total}/{e.max}
                    </span>
                    <Pill tone={e.is_published ? "success" : "muted"}>
                      {e.is_published ? "ظاهر" : "مخفي"}
                    </Pill>
                    <span className="num text-[10px] text-muted-foreground">
                      {e.evaluated_on.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            إغلاق
          </button>
          <button
            onClick={() => void submit()}
            disabled={save.isPending || !formId}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            حفظ التقييم
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CriterionRow({
  item,
  scaleType,
  scale,
  maxScore,
  value,
  onChange,
}: {
  item: string;
  scaleType: string;
  scale: Array<{ label: string; tone: string }>;
  maxScore: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1 text-xs">{item}</span>
      {scaleType === "علامة رقمية" ? (
        <Input
          type="number"
          max={maxScore || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="num h-8 w-24 text-center"
        />
      ) : scaleType === "نص" ? (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-48" />
      ) : (
        <span className="flex flex-wrap gap-1">
          {scale.map((o) => (
            <button
              key={o.label}
              onClick={() => onChange(value === o.label ? "" : o.label)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                value === o.label
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-primary-soft hover:text-primary"
              }`}
            >
              {o.label}
            </button>
          ))}
        </span>
      )}
    </li>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GripVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/api/error-message";
import {
  useEvaluationForm,
  useEvaluationForms,
  useSaveEvaluationForm,
  type EvaluationCriterion,
  type EvaluationScaleOption,
} from "@/lib/api/hooks";

/**
 * Building a form: its criteria, its domains, and the words it is answered
 * with. Shared by السلوك والتقييم and by the forms screen, so a school edits
 * one definition wherever it opens it.
 */
type DraftCriterion = Pick<EvaluationCriterion, "category" | "item" | "max_score">;

export function EvaluationFormBuilder({
  form,
  defaultType,
  onClose,
}: {
  form: string | null;
  defaultType?: string | undefined;
  onClose: () => void;
}) {
  const existing = useEvaluationForm(form ?? undefined);
  const meta = useEvaluationForms();
  const save = useSaveEvaluationForm();

  const [title, setTitle] = useState("");
  const [formType, setFormType] = useState(defaultType ?? "سلوك");
  const [scaleType, setScaleType] = useState("مقياس");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState<DraftCriterion[]>([
    { category: "", item: "", max_score: 0 },
  ]);
  const [scale, setScale] = useState<
    Array<Pick<EvaluationScaleOption, "label" | "score" | "tone">>
  >([]);

  // Load the saved form once it arrives; a new form starts on a preset so the
  // first thing a teacher sees is a working scale, not an empty table.
  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setTitle(d.title);
      setFormType(d.form_type);
      setScaleType(d.scale_type);
      setDescription(d.description ?? "");
      setCriteria(
        d.criteria.map((c) => ({ category: c.category, item: c.item, max_score: c.max_score })),
      );
      setScale(d.scale.map((s) => ({ label: s.label, score: s.score, tone: s.tone })));
    } else if (!form && meta.data?.presets["مقياس"] && scale.length === 0) {
      setScale(meta.data.presets["مقياس"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data, meta.data, form]);

  const needsScale = scaleType === "مقياس" || scaleType === "نعم/لا";

  function applyPreset(key: string) {
    const preset = meta.data?.presets[key];
    if (preset) setScale(preset);
  }

  async function submit() {
    const rows = criteria.filter((c) => c.item.trim());
    if (!title.trim()) {
      toast.error("اسم النموذج مطلوب.");
      return;
    }
    if (rows.length === 0) {
      toast.error("أضف بنداً واحداً على الأقل.");
      return;
    }
    if (needsScale && scale.filter((s) => s.label.trim()).length === 0) {
      toast.error("حدّد خيارات المقياس.");
      return;
    }
    try {
      const res = await save.mutateAsync({
        ...(form ? { form } : {}),
        title: title.trim(),
        form_type: formType,
        scale_type: scaleType,
        description,
        criteria: rows.map((c, i) => ({ ...c, sort_order: i })),
        scale: scale.filter((s) => s.label.trim()).map((s, i) => ({ ...s, sort_order: i })),
      });
      toast.success(
        res.used_by > 0
          ? `تم الحفظ. النموذج مستخدم في ${res.used_by} تقييماً سابقاً.`
          : "تم حفظ النموذج.",
      );
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحفظ."));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{form ? "تعديل النموذج" : "نموذج تقييم جديد"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-4 overflow-y-auto p-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Label>اسم النموذج</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: تقييم سلوك الطالب في الصف"
              />
            </div>
            <div>
              <Label>النوع</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(meta.data?.form_types ?? ["سلوك"]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>آلية التقييم</Label>
              <Select value={scaleType} onValueChange={setScaleType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(meta.data?.scale_types ?? ["مقياس"]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>وصف مختصر</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {needsScale && (
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>خيارات المقياس</Label>
                <div className="flex gap-1.5">
                  {Object.keys(meta.data?.presets ?? {}).map((k) => (
                    <button
                      key={k}
                      onClick={() => applyPreset(k)}
                      className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-secondary"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-1.5">
                {scale.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Input
                      value={s.label}
                      onChange={(e) =>
                        setScale(
                          scale.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                        )
                      }
                      placeholder="دائماً"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={s.score}
                      onChange={(e) =>
                        setScale(
                          scale.map((x, j) =>
                            j === i ? { ...x, score: Number(e.target.value) || 0 } : x,
                          ),
                        )
                      }
                      className="w-24"
                      title="القيمة التي يحتسبها النظام لهذا الخيار"
                    />
                    <button
                      onClick={() => setScale(scale.filter((_, j) => j !== i))}
                      className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"
                      aria-label="حذف الخيار"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setScale([...scale, { label: "", score: 0, tone: "muted" }])}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                + خيار
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                القيمة تُستخدم لحساب المجموع، فيمكن بناء نموذج من كلمات ويبقى قابلاً للجمع.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border p-3">
            <Label className="mb-2 block">البنود</Label>
            <ul className="space-y-1.5">
              {criteria.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <GripVertical className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={c.category}
                    onChange={(e) =>
                      setCriteria(
                        criteria.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)),
                      )
                    }
                    placeholder="المجال (اختياري)"
                    className="w-44 shrink-0"
                  />
                  <Textarea
                    value={c.item}
                    onChange={(e) =>
                      setCriteria(
                        criteria.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)),
                      )
                    }
                    placeholder="نص البند — مثال: يستمع لزملائه دون مقاطعة"
                    rows={1}
                    className="min-h-10 flex-1"
                  />
                  {scaleType === "علامة رقمية" && (
                    <Input
                      type="number"
                      value={c.max_score}
                      onChange={(e) =>
                        setCriteria(
                          criteria.map((x, j) =>
                            j === i ? { ...x, max_score: Number(e.target.value) || 0 } : x,
                          ),
                        )
                      }
                      className="w-24 shrink-0"
                      title="العلامة العظمى لهذا البند"
                    />
                  )}
                  <button
                    onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}
                    className="mt-1 rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"
                    aria-label="حذف البند"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setCriteria([...criteria, { category: "", item: "", max_score: 0 }])}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              + بند
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              البنود التي تحمل نفس المجال تُعرض تحت عنوان واحد في جدول التقييم.
            </p>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            تراجع
          </button>
          <button
            onClick={() => void submit()}
            disabled={save.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            حفظ النموذج
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

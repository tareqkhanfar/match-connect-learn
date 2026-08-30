import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Eye, EyeOff, GripVertical, Layers, Plus, Save, Trash2 } from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useConfirm } from "@/components/shared/confirm";
import { EvaluationFormBuilder } from "@/components/shared/evaluation-form-builder";
import { errorMessage } from "@/lib/api/error-message";
import { groupSearch } from "@/lib/preselect";
import {
  useClasses,
  useDeleteEvaluationForm,
  useEvaluationForm,
  useEvaluationForms,
  useEvaluationGrid,
  usePublishEvaluations,
  useSaveEvaluationForm,
  useSaveEvaluationGrid,
  type EvaluationCriterion,
  type EvaluationScaleOption,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/evaluations")({
  validateSearch: groupSearch,
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const { group: groupFromUrl } = Route.useSearch();
  const [tab, setTab] = useState<"fill" | "forms">("fill");
  const [formId, setFormId] = useState<string>("");
  const [group, setGroup] = useState(groupFromUrl ?? "");
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="نماذج التقييم"
        subtitle="نماذج تعرّفها المدرسة بنفسها — سلوك، مهارات، تقارير الروضة — ثم تُملأ لطالب أو لشعبة كاملة."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" />
            نموذج جديد
          </button>
        }
      />

      <div className="mb-5 flex gap-1 rounded-xl border border-border bg-card p-1">
        {[
          { key: "fill" as const, label: "تعبئة التقييم" },
          { key: "forms" as const, label: "إدارة النماذج" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              tab === t.key
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fill" ? (
        <FillTab formId={formId} setFormId={setFormId} group={group} setGroup={setGroup} />
      ) : (
        <FormsTab onEdit={setEditing} />
      )}

      {(creating || editing) && (
        <EvaluationFormBuilder
          form={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------
 * The grid — a whole class against one form
 * ---------------------------------------------------------------------- */

function FillTab({
  formId,
  setFormId,
  group,
  setGroup,
}: {
  formId: string;
  setFormId: (v: string) => void;
  group: string;
  setGroup: (v: string) => void;
}) {
  const forms = useEvaluationForms();
  const classes = useClasses();
  const grid = useEvaluationGrid(formId || undefined, group || undefined);
  const saveGrid = useSaveEvaluationGrid();
  const publish = usePublishEvaluations();

  // Edits live here until saved, so a slow connection never loses a column
  // of typing and the sheet does not jump under the teacher's hands.
  const [draft, setDraft] = useState<
    Record<string, Record<string, { value?: string; note?: string; score?: number }>>
  >({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft({});
    setNotes({});
  }, [formId, group]);

  const form = grid.data?.form;
  const criteria = form?.criteria ?? [];
  const scale = form?.scale ?? [];
  const students = grid.data?.students ?? [];
  const saved = grid.data?.answers ?? {};

  const dirty = Object.keys(draft).length > 0 || Object.keys(notes).length > 0;

  function valueFor(student: string, key: string): string {
    return draft[student]?.[key]?.value ?? saved[student]?.[key]?.value ?? "";
  }

  function setValue(student: string, key: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      [student]: { ...(prev[student] ?? {}), [key]: { ...(prev[student]?.[key] ?? {}), value } },
    }));
  }

  async function submit() {
    const rows: Record<string, { values: Record<string, { value?: string }>; notes?: string }> = {};
    for (const student of students) {
      const edits = draft[student.id];
      const note = notes[student.id];
      if (!edits && note === undefined) continue;
      // Everything the pupil has, not only what changed: the server rewrites
      // the answer set, so sending a partial row would erase the rest.
      const values: Record<string, { value?: string }> = {};
      for (const c of criteria) {
        const v = valueFor(student.id, c.key);
        if (v) values[c.key] = { value: v };
      }
      rows[student.id] = { values, ...(note !== undefined ? { notes: note } : {}) };
    }
    if (Object.keys(rows).length === 0) {
      toast.error("لا توجد تغييرات لحفظها.");
      return;
    }
    try {
      const res = await saveGrid.mutateAsync({ form: formId, student_group: group, rows });
      toast.success(`تم حفظ تقييم ${res.saved} طالباً.`);
      setDraft({});
      setNotes({});
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحفظ."));
    }
  }

  async function togglePublish(show: boolean) {
    const entries = students.map((s) => s.entry).filter((e): e is string => Boolean(e));
    if (entries.length === 0) {
      toast.error("لا توجد تقييمات محفوظة بعد.");
      return;
    }
    try {
      await publish.mutateAsync({ entries, is_published: show ? 1 : 0 });
      toast.success(show ? "أصبحت التقييمات ظاهرة للأهالي." : "تم إخفاء التقييمات.");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر التحديث."));
    }
  }

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]">
        <div>
          <Label className="text-xs">النموذج</Label>
          <Select value={formId} onValueChange={setFormId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر النموذج" />
            </SelectTrigger>
            <SelectContent>
              {(forms.data?.forms ?? [])
                .filter((f) => f.is_active)
                .map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.title} — {f.form_type}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">الشعبة</Label>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger>
              <SelectValue placeholder="اختر الشعبة" />
            </SelectTrigger>
            <SelectContent>
              {(classes.data ?? []).map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.student_group_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={() => void submit()}
            disabled={!dirty || saveGrid.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            <Save className="size-4" />
            حفظ
          </button>
        </div>
      </div>

      {!formId || !group ? (
        <EmptyBlock
          title="اختر نموذجاً وشعبة"
          description="سيظهر جدول التقييم: الطلاب في الصفوف والبنود في الأعمدة."
          icon={<ClipboardList className="size-6" />}
        />
      ) : grid.isLoading ? (
        <TableSkeleton rows={6} />
      ) : students.length === 0 ? (
        <EmptyBlock
          title="لا يوجد طلاب في هذه الشعبة"
          icon={<ClipboardList className="size-6" />}
        />
      ) : (
        <SectionCard
          title={form?.title ?? "التقييم"}
          description={
            form?.scale_type === "مقياس"
              ? `اختر لكل بند: ${scale.map((s) => s.label).join(" / ")}`
              : "أدخل القيمة لكل بند."
          }
          actions={
            <div className="flex gap-1.5">
              <button
                onClick={() => void togglePublish(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                <Eye className="size-3.5" />
                إظهار للأهالي
              </button>
              <button
                onClick={() => void togglePublish(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                <EyeOff className="size-3.5" />
                إخفاء
              </button>
            </div>
          }
        >
          {/* Wide sheets scroll inside their own box; the page never does. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                {(form?.categories.length ?? 0) > 0 && (
                  <tr>
                    <th className="sticky right-0 z-10 bg-card" />
                    {form!.categories.map((cat) => {
                      const span = criteria.filter((c) => c.category === cat).length;
                      return (
                        <th
                          key={cat}
                          colSpan={span}
                          className="border-b border-s border-border bg-secondary/60 px-2 py-1.5 text-center text-[11px] font-bold"
                        >
                          {cat}
                        </th>
                      );
                    })}
                    {criteria.some((c) => !c.category) && (
                      <th
                        colSpan={criteria.filter((c) => !c.category).length}
                        className="border-b border-s border-border bg-secondary/60 px-2 py-1.5 text-center text-[11px] font-bold"
                      >
                        بنود عامة
                      </th>
                    )}
                    <th className="border-b border-s border-border bg-secondary/60" />
                  </tr>
                )}
                <tr>
                  <th className="sticky right-0 z-10 min-w-44 border-b border-border bg-card px-2 py-2 text-start text-xs font-bold">
                    الطالب
                  </th>
                  {criteria.map((c) => (
                    <th
                      key={c.key}
                      className="w-32 border-b border-s border-border px-1.5 py-2 align-bottom text-[11px] font-semibold"
                      title={c.help_text ?? c.item}
                    >
                      <span className="line-clamp-3">{c.item}</span>
                    </th>
                  ))}
                  <th className="w-24 border-b border-s border-border px-2 py-2 text-[11px] font-bold">
                    المجموع
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/30">
                    <td className="sticky right-0 z-10 border-b border-border bg-card px-2 py-1.5">
                      <span className="block truncate text-xs font-semibold">{s.name}</span>
                      {s.is_published && (
                        <span className="text-[10px] text-success">ظاهر للأهل</span>
                      )}
                    </td>
                    {criteria.map((c) => (
                      <td key={c.key} className="border-b border-s border-border p-1">
                        {form?.scale_type === "علامة رقمية" ? (
                          <Input
                            type="number"
                            value={valueFor(s.id, c.key)}
                            onChange={(e) => setValue(s.id, c.key, e.target.value)}
                            className="h-8 text-center text-xs"
                          />
                        ) : form?.scale_type === "نص" ? (
                          <Input
                            value={valueFor(s.id, c.key)}
                            onChange={(e) => setValue(s.id, c.key, e.target.value)}
                            className="h-8 text-xs"
                          />
                        ) : (
                          <select
                            value={valueFor(s.id, c.key)}
                            onChange={(e) => setValue(s.id, c.key, e.target.value)}
                            className={cn(
                              "h-8 w-full rounded-lg border border-border bg-background px-1 text-center text-xs",
                              valueFor(s.id, c.key) && "font-semibold",
                            )}
                          >
                            <option value="">—</option>
                            {scale.map((o) => (
                              <option key={o.label} value={o.label}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    ))}
                    <td className="num border-b border-s border-border px-2 py-1.5 text-center text-xs font-bold">
                      {s.entry ? `${s.total}` : "—"}
                      {s.entry && form?.max_total ? (
                        <span className="text-muted-foreground">/{form.max_total}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------
 * Managing the forms themselves
 * ---------------------------------------------------------------------- */

function FormsTab({ onEdit }: { onEdit: (id: string) => void }) {
  const [type, setType] = useState("");
  const { data, isLoading } = useEvaluationForms(type || undefined);
  const remove = useDeleteEvaluationForm();
  const confirm = useConfirm();

  async function drop(id: string, title: string, used: number) {
    const ok = await confirm({
      title: `حذف النموذج «${title}»؟`,
      description:
        used > 0
          ? `النموذج مستخدم في ${used} تقييماً، لذلك سيتم تعطيله بدل حذفه حتى تبقى التقييمات السابقة مقروءة.`
          : "لم يُستخدم بعد، وسيُحذف نهائياً.",
      confirmLabel: used > 0 ? "تعطيل" : "حذف",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ form: id });
      toast.success(used > 0 ? "تم تعطيل النموذج." : "تم حذف النموذج.");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحذف."));
    }
  }

  return (
    <SectionCard
      title="النماذج"
      actions={
        <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="كل الأنواع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {(data?.form_types ?? []).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : (data?.forms.length ?? 0) === 0 ? (
        <EmptyBlock
          title="لا توجد نماذج بعد"
          description="أنشئ نموذجاً وحدّد بنوده ومقياسه، ثم استخدمه لتقييم طالب أو شعبة كاملة."
          icon={<Layers className="size-6" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {data!.forms.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{f.title}</span>
                  <Pill tone="primary">{f.form_type}</Pill>
                  <Pill>{f.scale_type}</Pill>
                  {!f.is_active && <Pill tone="danger">معطّل</Pill>}
                </p>
                <p className="num text-[11px] text-muted-foreground">
                  {f.criteria_count} بنداً · استُخدم في {f.entry_count} تقييماً
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => onEdit(f.id)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  تعديل
                </button>
                <button
                  onClick={() => void drop(f.id, f.title, f.entry_count)}
                  className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"
                  aria-label="حذف"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------
 * Building a form
 * ---------------------------------------------------------------------- */

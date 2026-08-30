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
import { EvaluationGrid } from "@/components/shared/evaluation-grid";
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

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
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
      </div>

      {!formId || !group ? (
        <EmptyBlock
          title="اختر نموذجاً وشعبة"
          description="سيظهر جدول التقييم: الطلاب في الصفوف والبنود في الأعمدة."
          icon={<ClipboardList className="size-6" />}
        />
      ) : (
        <EvaluationGrid form={formId} studentGroup={group} />
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

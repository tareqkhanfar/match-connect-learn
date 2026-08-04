import { createFileRoute } from "@tanstack/react-router";
import { Plus, Scale, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useConfirm } from "@/components/shared/confirm";
import {
  useDeleteScheme,
  useSaveScheme,
  useSchemes,
  useStudentFilters,
  useSubjects,
  type GradeScheme,
  type SchemeComponent,
} from "@/lib/api/hooks";
import { isBackOffice } from "@/lib/roles";

export const Route = createFileRoute("/app/schemes")({
  head: () => ({
    meta: [
      { title: "خطط التقييم — Match Education" },
      {
        name: "description",
        content: "حدّد مكوّنات التقييم وأوزانها لكل مادة، مع الدرجات الإضافية.",
      },
    ],
  }),
  component: SchemesPage,
});

const TYPES = ["Exam", "Quiz", "Activity", "Homework", "Participation", "Project", "Bonus"];
const TYPE_AR: Record<string, string> = {
  Exam: "امتحان",
  Quiz: "اختبار قصير",
  Activity: "نشاط",
  Homework: "واجب",
  Participation: "مشاركة",
  Project: "مشروع",
  Bonus: "درجة إضافية",
};

function SchemesPage() {
  const confirm = useConfirm();
  const { role } = useApp();
  const canManage = isBackOffice(role);

  const query = useSchemes();
  const deleteScheme = useDeleteScheme();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GradeScheme | null>(null);

  const schemes = query.data ?? [];

  async function remove(s: GradeScheme) {
    const ok = await confirm({
      title: `حذف خطة «${s.scheme_name}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await deleteScheme.mutateAsync(s.id);
      toast.success("تم حذف الخطة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title="خطط التقييم"
        subtitle="مكوّنات علامة كل مادة وأوزانها — مجموع الأوزان لازم يساوي ١٠٠٪"
        actions={
          canManage ? (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
            >
              <Plus className="size-4" />
              خطة جديدة
            </button>
          ) : null
        }
      />

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={4} />
      ) : schemes.length === 0 ? (
        <EmptyBlock
          title="لا توجد خطط تقييم"
          description="أنشئ خطة لتحديد كيف تُحتسب علامة المادة."
          icon={<Scale className="size-6" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schemes.map((s) => (
            <SectionCard
              key={s.id}
              title={s.scheme_name}
              description={[s.course, s.program].filter(Boolean).join(" • ") || "لكل المواد"}
              actions={s.is_default ? <Pill tone="primary">افتراضية</Pill> : null}
            >
              <ul className="space-y-2">
                {s.components.map((c) => (
                  <li
                    key={c.component_name}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium">
                      {c.component_type === "Bonus" && (
                        <Sparkles className="ml-1 inline size-3 text-success" />
                      )}
                      {c.component_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.type_label ?? TYPE_AR[c.component_type] ?? c.component_type}
                    </span>
                    <span className="num text-xs font-bold">
                      {c.weight}% <span className="text-muted-foreground">/ {c.max_score}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  مجموع الأوزان:{" "}
                  <span className="num font-bold text-foreground">{s.total_weight}%</span>
                </span>
                {canManage && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(s)}
                      className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => remove(s)}
                      className="rounded-lg bg-secondary px-2.5 py-1.5 text-destructive hover:bg-destructive-soft"
                      aria-label="حذف"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <SchemeDialog
          scheme={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function SchemeDialog({ scheme, onClose }: { scheme: GradeScheme | null; onClose: () => void }) {
  const save = useSaveScheme();
  const subjectsQuery = useSubjects();
  const filtersQuery = useStudentFilters();

  const [name, setName] = useState(scheme?.scheme_name ?? "");
  const [course, setCourse] = useState(scheme?.course ?? "");
  const [program, setProgram] = useState(scheme?.program ?? "");
  const [components, setComponents] = useState<SchemeComponent[]>(
    scheme?.components ?? [
      { component_name: "امتحان نصفي", component_type: "Exam", weight: 30, max_score: 100 },
      { component_name: "امتحان نهائي", component_type: "Exam", weight: 40, max_score: 100 },
      { component_name: "أنشطة", component_type: "Activity", weight: 20, max_score: 20 },
      { component_name: "مشاركة", component_type: "Participation", weight: 10, max_score: 10 },
    ],
  );

  // Bonus rows sit outside the 100%, so exclude them from the total.
  const graded = components.filter((c) => c.component_type !== "Bonus");
  const totalWeight = graded.reduce((a, c) => a + Number(c.weight || 0), 0);
  const balanced = Math.abs(totalWeight - 100) < 0.01;

  function update(i: number, patch: Partial<SchemeComponent>) {
    setComponents((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addRow(type = "Exam") {
    setComponents((prev) => [
      ...prev,
      { component_name: "", component_type: type, weight: 0, max_score: 100 },
    ]);
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("اسم الخطة مطلوب");
      return;
    }
    if (!balanced) {
      toast.error(`مجموع الأوزان ${totalWeight}% — يجب أن يساوي 100%`);
      return;
    }
    if (components.some((c) => !c.component_name.trim())) {
      toast.error("كل مكوّن يحتاج اسماً");
      return;
    }
    try {
      await save.mutateAsync({
        ...(scheme ? { id: scheme.id } : {}),
        scheme_name: name,
        course: course || null,
        program: program || null,
        components,
      });
      toast.success(scheme ? "تم تحديث الخطة" : "تم إنشاء الخطة");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {scheme ? "تعديل خطة التقييم" : "خطة تقييم جديدة"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label>اسم الخطة *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: خطة الرياضيات — الصف الأول"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المادة</Label>
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="كل المواد" />
              </SelectTrigger>
              <SelectContent>
                {(subjectsQuery.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.course_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الصف</Label>
            <Select value={program} onValueChange={setProgram}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="كل الصفوف" />
              </SelectTrigger>
              <SelectContent>
                {(filtersQuery.data?.grades ?? []).map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>مجموع الأوزان</Label>
            <div
              className={
                balanced
                  ? "flex h-10 items-center justify-center rounded-xl border border-success/40 bg-success-soft text-sm font-bold text-success"
                  : "flex h-10 items-center justify-center rounded-xl border border-destructive/40 bg-destructive-soft text-sm font-bold text-destructive"
              }
            >
              {totalWeight}% {balanced ? "✓" : "⚠"}
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <Label>المكوّنات</Label>
            <div className="flex gap-2">
              <button
                onClick={() => addRow("Exam")}
                className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
              >
                + مكوّن
              </button>
              <button
                onClick={() => addRow("Bonus")}
                className="rounded-lg bg-success-soft px-2.5 py-1 text-xs font-semibold text-success"
              >
                + درجة إضافية
              </button>
            </div>
          </div>

          {components.map((c, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_70px_70px_auto] items-center gap-2 rounded-xl border border-border p-2"
            >
              <Input
                value={c.component_name}
                onChange={(e) => update(i, { component_name: e.target.value })}
                placeholder="اسم المكوّن"
                className="h-9 rounded-lg"
              />
              <Select
                value={c.component_type}
                onValueChange={(v) => update(i, { component_type: v })}
              >
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_AR[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={c.weight}
                onChange={(e) => update(i, { weight: Number(e.target.value) })}
                className="num h-9 rounded-lg text-center"
                title="الوزن %"
              />
              <Input
                type="number"
                value={c.max_score}
                onChange={(e) => update(i, { max_score: Number(e.target.value) })}
                className="num h-9 rounded-lg text-center"
                title="الدرجة العظمى"
              />
              <button
                onClick={() => setComponents((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded-lg bg-secondary px-2 py-1.5 text-destructive hover:bg-destructive-soft"
                aria-label="حذف المكوّن"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            الأعمدة: الاسم • النوع • الوزن ٪ • الدرجة العظمى. الدرجات الإضافية لا تدخل في الـ١٠٠٪.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

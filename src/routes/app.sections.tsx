import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  LayoutGrid,
  Pencil,
  Repeat,
  Shuffle,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  useDistributeStudents,
  useMoveStudents,
  useProgramSections,
  useSaveSection,
  useSectionOptions,
  useSwapStudents,
  useWithdrawStudents,
  type SectionInfo,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/sections")({
  component: SectionsPage,
});

/** Error text from the API envelope, with a readable fallback. */
function why(err: unknown, fallback: string): string {
  return (err as { messageAr?: string })?.messageAr || fallback;
}

function SectionColumn({
  section,
  selected,
  onToggle,
  onSelectAll,
  onEdit,
}: {
  section: SectionInfo;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (section: SectionInfo, checked: boolean) => void;
  onEdit: (section: SectionInfo) => void;
}) {
  const allSelected =
    section.students.length > 0 && section.students.every((s) => selected.has(s.id));
  const full = section.spaceLeft !== null && section.spaceLeft <= 0;

  return (
    <div className="flex min-h-[220px] flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{section.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {section.count}
            {section.capacity ? ` / ${section.capacity}` : ""} طالب
            {section.batch ? ` · دفعة ${section.batch}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {full && <Pill tone="warning">مكتملة</Pill>}
          <button
            onClick={() => onEdit(section)}
            className="grid size-7 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary"
            aria-label={`تعديل ${section.name}`}
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      </div>

      {section.students.length > 0 && (
        <label className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(section, e.target.checked)}
            className="size-3.5 accent-primary"
          />
          تحديد الكل
        </label>
      )}

      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: 340 }}>
        {section.students.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">لا يوجد طلاب</p>
        ) : (
          <ul className="space-y-1">
            {section.students.map((s) => (
              <li key={s.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                    selected.has(s.id) ? "bg-primary-soft" : "hover:bg-secondary"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => onToggle(s.id)}
                    className="size-3.5 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {s.rollNumber !== null && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      #{s.rollNumber}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SectionsPage() {
  const options = useSectionOptions();
  const confirm = useConfirm();

  const [program, setProgram] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const view = useProgramSections(program || undefined, year || undefined);

  // Selection is keyed by student, and every student sits in one place, so a
  // single set is enough to know both who and where.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string>("");
  const [editing, setEditing] = useState<SectionInfo | "new" | null>(null);

  const move = useMoveStudents();
  const withdraw = useWithdrawStudents();
  const swap = useSwapStudents();
  const distribute = useDistributeStudents();

  const sections = view.data?.sections ?? [];
  const unassigned = view.data?.unassigned ?? [];

  /** Which section each selected student currently sits in. */
  const homeOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sections) for (const st of s.students) map.set(st.id, s.id);
    return map;
  }, [sections]);

  const selectedIds = [...selected];
  const sourceSections = new Set(selectedIds.map((id) => homeOf.get(id) ?? "__unassigned"));
  const singleSource = sourceSections.size === 1 ? [...sourceSections][0] : null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll(section: SectionInfo, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of section.students) checked ? next.add(s.id) : next.delete(s.id);
      return next;
    });
  }

  async function doMove() {
    if (!target || selectedIds.length === 0) return;
    if (!singleSource) {
      toast.error("اختر طلاباً من شعبة واحدة فقط للنقل.");
      return;
    }
    try {
      const res = await move.mutateAsync({
        students: selectedIds,
        from_section: singleSource === "__unassigned" ? "" : singleSource,
        to_section: target,
      });
      toast.success(res.message_ar || "تم النقل");
      setSelected(new Set());
    } catch (err) {
      toast.error(why(err, "تعذّر النقل"));
    }
  }

  async function doWithdraw() {
    if (selectedIds.length === 0 || !singleSource || singleSource === "__unassigned") {
      toast.error("اختر طلاباً من شعبة واحدة للسحب.");
      return;
    }
    const ok = await confirm({
      title: `سحب ${selectedIds.length} طالب من الشعبة؟`,
      description: "سيبقى الطالب مسجلاً في الصف، وسيُزال فقط من الشعبة بانتظار إعادة التوزيع.",
    });
    if (!ok) return;
    try {
      const res = await withdraw.mutateAsync({ students: selectedIds, section: singleSource });
      toast.success(res.message_ar || "تم السحب");
      setSelected(new Set());
    } catch (err) {
      toast.error(why(err, "تعذّر السحب"));
    }
  }

  async function doSwap() {
    const [first, second] = selectedIds;
    if (!first || !second || selectedIds.length !== 2) {
      toast.error("اختر طالبين اثنين فقط للتبديل.");
      return;
    }
    try {
      const res = await swap.mutateAsync({ student_a: first, student_b: second });
      toast.success(res.message_ar || "تم التبديل");
      setSelected(new Set());
    } catch (err) {
      toast.error(why(err, "تعذّر التبديل"));
    }
  }

  async function doDistribute() {
    if (sections.length === 0) return;
    const ok = await confirm({
      title: `توزيع ${unassigned.length} طالب تلقائياً؟`,
      description: "سيتم التوزيع بالتساوي على الشعب مع مراعاة السعة القصوى لكل شعبة.",
    });
    if (!ok) return;
    try {
      const res = await distribute.mutateAsync({
        program,
        ...(year ? { academic_year: year } : {}),
        sections: sections.map((s) => s.id),
        strategy: "balanced",
      });
      toast.success(res.message_ar || "تم التوزيع");
      setSelected(new Set());
    } catch (err) {
      toast.error(why(err, "تعذّر التوزيع"));
    }
  }

  const busy = move.isPending || withdraw.isPending || swap.isPending || distribute.isPending;

  return (
    <>
      <PageHeader
        title="توزيع الطلاب على الشعب"
        subtitle="قسّم الصف إلى شعب، وانقل أو بدّل أو اسحب الطلاب — وتتحدّث دفعة التسجيل تلقائياً."
        actions={
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            <UserPlus className="size-3.5" />
            شعبة جديدة
          </button>
        }
      />

      {/* Choosing the grade ------------------------------------------- */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>الصف</Label>
          <Select value={program} onValueChange={(v) => { setProgram(v); setSelected(new Set()); }}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="اختر الصف" />
            </SelectTrigger>
            <SelectContent>
              {(options.data?.programs ?? []).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>العام الدراسي</Label>
          <Select value={year} onValueChange={(v) => { setYear(v); setSelected(new Set()); }}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="الكل" />
            </SelectTrigger>
            <SelectContent>
              {(options.data?.academicYears ?? []).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!program ? (
        <div className="mt-6">
          <EmptyBlock
            title="اختر صفاً للبدء"
            description="بعد اختيار الصف ستظهر شعبه وطلابه غير الموزعين."
            icon={<LayoutGrid className="size-6" />}
          />
        </div>
      ) : view.error ? (
        <div className="mt-6">
          <ErrorState error={view.error} onRetry={() => view.refetch()} />
        </div>
      ) : view.isLoading ? (
        <div className="mt-6"><TableSkeleton rows={5} /></div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <KpiCard label="عدد الشعب" value={view.data?.totals.sections ?? 0} icon={LayoutGrid} tone="primary" />
            <KpiCard label="طلاب موزعون" value={view.data?.totals.placed ?? 0} icon={Users} tone="accent" />
            <KpiCard label="بانتظار التوزيع" value={view.data?.totals.unassigned ?? 0} icon={UserPlus} tone="warm" />
          </div>

          {/* Action bar appears only when something is selected --------- */}
          {selectedIds.length > 0 && (
            <div className="sticky top-20 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft/70 p-3 backdrop-blur">
              <span className="text-sm font-bold">{selectedIds.length} محدد</span>

              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="h-9 w-48 rounded-lg bg-card text-xs">
                  <SelectValue placeholder="انقل إلى شعبة..." />
                </SelectTrigger>
                <SelectContent>
                  {sections
                    .filter((s) => s.id !== singleSource)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.spaceLeft !== null ? ` (متبقٍ ${s.spaceLeft})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <button
                onClick={doMove}
                disabled={!target || busy}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                <ArrowLeftRight className="size-3.5" />
                نقل
              </button>

              <button
                onClick={doSwap}
                disabled={selectedIds.length !== 2 || busy}
                title="اختر طالبين من شعبتين مختلفتين"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-50"
              >
                <Repeat className="size-3.5" />
                تبديل
              </button>

              <button
                onClick={doWithdraw}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-card px-3 py-2 text-xs font-medium text-destructive disabled:opacity-50"
              >
                <UserMinus className="size-3.5" />
                سحب من الشعبة
              </button>

              <button
                onClick={() => setSelected(new Set())}
                className="mr-auto text-xs text-muted-foreground hover:text-foreground"
              >
                إلغاء التحديد
              </button>
            </div>
          )}

          {/* Students with no section yet ------------------------------- */}
          {unassigned.length > 0 && (
            <div className="mt-6">
              <SectionCard
                title={`بانتظار التوزيع (${unassigned.length})`}
                actions={
                  sections.length > 0 ? (
                    <button
                      onClick={doDistribute}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                      <Shuffle className="size-3.5" />
                      توزيع تلقائي متوازن
                    </button>
                  ) : null
                }
              >
                <div className="flex flex-wrap gap-2">
                  {unassigned.map((s) => (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        selected.has(s.id)
                          ? "border-primary bg-primary-soft"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="size-3.5 accent-primary"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {/* The sections themselves ----------------------------------- */}
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sections.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyBlock
                  title="لا توجد شعب لهذا الصف"
                  description="أنشئ شعبة أولاً ثم وزّع الطلاب عليها."
                  icon={<LayoutGrid className="size-6" />}
                />
              </div>
            ) : (
              sections.map((s) => (
                <SectionColumn
                  key={s.id}
                  section={s}
                  selected={selected}
                  onToggle={toggle}
                  onSelectAll={selectAll}
                  onEdit={setEditing}
                />
              ))
            )}
          </div>
        </>
      )}

      {editing && (
        <SectionDialog
          section={editing === "new" ? null : editing}
          program={program}
          academicYear={year}
          batches={options.data?.batches ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function SectionDialog({
  section,
  program,
  academicYear,
  batches,
  onClose,
}: {
  section: SectionInfo | null;
  program: string;
  academicYear: string;
  batches: string[];
  onClose: () => void;
}) {
  const save = useSaveSection();
  const [name, setName] = useState(section?.name ?? "");
  const [batch, setBatch] = useState(section?.batch ?? "");
  const [capacity, setCapacity] = useState(String(section?.capacity ?? ""));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const year = academicYear || section?.academicYear || "";
      const res = await save.mutateAsync({
        ...(section ? { name: section.id } : {}),
        ...(name ? { student_group_name: name } : {}),
        ...(program ? { program } : {}),
        ...(batch ? { batch } : {}),
        ...(year ? { academic_year: year } : {}),
        max_strength: Number(capacity) || 0,
      });
      toast.success(res.message_ar || "تم الحفظ");
      onClose();
    } catch (err) {
      toast.error(why(err, "تعذّر الحفظ"));
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{section ? "تعديل الشعبة" : "شعبة جديدة"}</DialogTitle>
          <DialogDescription>
            {section
              ? "تغيير الدفعة يُحدّث تسجيل جميع طلاب الشعبة تلقائياً."
              : "ستُنشأ الشعبة ضمن الصف والعام الدراسي المحددين."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sec-name">اسم الشعبة</Label>
            <Input
              id="sec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: الصف الأول - أ"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>الدفعة</Label>
            <Select value={batch} onValueChange={setBatch}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="اختر الدفعة" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sec-cap">السعة القصوى</Label>
            <Input
              id="sec-cap"
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="اتركها فارغة لعدم التحديد"
              className="h-11 rounded-xl"
              dir="ltr"
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {save.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

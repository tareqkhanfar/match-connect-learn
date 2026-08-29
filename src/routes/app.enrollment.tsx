import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck, CheckCircle2, GraduationCap, Plus, Trash2, UserCheck } from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { StudentPicker } from "@/components/shared/student-picker";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { errorMessage } from "@/lib/api/error-message";
import {
  useCancelEnrollment,
  useEnrollmentDetail,
  useEnrollmentOptions,
  useEnrollments,
  useSaveEnrollment,
  useSubmitEnrollment,
  type EnrollmentRow,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/enrollment")({
  head: () => ({
    meta: [
      { title: "التسجيل الدراسي — Match Education" },
      {
        name: "description",
        content: "تسجيل الطلاب في البرامج والشعب، وإدارة التسجيلات القائمة.",
      },
    ],
  }),
  component: EnrollmentPage,
});

const TONE: Record<number, "muted" | "success" | "danger"> = {
  0: "muted",
  1: "success",
  2: "danger",
};

function EnrollmentPage() {
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const query = useEnrollments({ search, program, page, page_size: 25 });
  const options = useEnrollmentOptions();

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const submitted = items.filter((e) => e.docstatus === 1).length;
  const drafts = items.filter((e) => e.docstatus === 0).length;

  return (
    <>
      <PageHeader
        title="التسجيل الدراسي"
        subtitle="سجّل الطلاب في البرامج والشعب — التسجيل هو أساس الحضور والعلامات والرسوم"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-4" />
            تسجيل جديد
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="إجمالي التسجيلات" value={total} icon={BookOpenCheck} tone="primary" />
        <KpiCard label="معتمدة (بهذه الصفحة)" value={submitted} icon={CheckCircle2} tone="accent" />
        <KpiCard label="مسودات" value={drafts} icon={UserCheck} tone="warm" />
      </div>

      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="ابحث باسم الطالب أو رقمه…"
            className="h-10 rounded-xl bg-secondary/60 pr-9"
          />
        </div>
        <div className="min-w-[200px]">
          <SearchableSelect
            value={program}
            onChange={(v) => {
              setProgram(v);
              setPage(1);
            }}
            options={(options.data?.programs ?? []).map((p) => ({ value: p, label: p }))}
            placeholder="كل البرامج"
            clearable
            clearLabel="كل البرامج"
          />
        </div>
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={6} />
      ) : items.length === 0 ? (
        <EmptyBlock
          title={search || program ? "لا توجد نتائج مطابقة" : "لا توجد تسجيلات"}
          description={
            search || program ? "جرّب بحثاً آخر أو غيّر البرنامج." : "سجّل طالباً في برنامج لتبدأ."
          }
          icon={<BookOpenCheck className="size-6" />}
        />
      ) : (
        <SectionCard title="التسجيلات" description={`${total} تسجيل`}>
          <ul className="divide-y divide-border">
            {items.map((e) => (
              <li
                key={e.id}
                className="grid gap-3 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <button
                  onClick={() => setViewing(e.id)}
                  className="min-w-0 text-right transition-opacity hover:opacity-70"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold">{e.studentName ?? e.student}</p>
                    <Pill tone={TONE[e.docstatus] ?? "muted"}>{e.status}</Pill>
                  </div>
                  <p className="num mt-0.5 text-xs text-muted-foreground">
                    {e.id}
                    {e.program ? ` • ${e.program}` : ""}
                    {e.academicYear ? ` • ${e.academicYear}` : ""}
                    {e.batch ? ` • ${e.batch}` : ""}
                  </p>
                </button>
                <button
                  onClick={() => setViewing(e.id)}
                  className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                >
                  التفاصيل
                </button>
              </li>
            ))}
          </ul>

          {total > 25 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                السابق
              </button>
              <span className="num text-xs text-muted-foreground">
                صفحة {page} من {Math.ceil(total / 25)}
              </span>
              <button
                disabled={page >= Math.ceil(total / 25)}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          )}
        </SectionCard>
      )}

      {creating && <EnrollmentDialog onClose={() => setCreating(false)} />}
      {viewing && <DetailDialog enrollment={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/* -------------------------------------------------------------- creating */

function EnrollmentDialog({ onClose }: { onClose: () => void }) {
  const [student, setStudent] = useState("");
  const [program, setProgram] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [academicTerm, setAcademicTerm] = useState("");
  const [batch, setBatch] = useState("");
  const [category, setCategory] = useState("");
  const [enrolledOn, setEnrolledOn] = useState(new Date().toISOString().slice(0, 10));

  // Courses come from the chosen programme, so the registrar can see what the
  // student will actually be enrolled in before saving.
  const options = useEnrollmentOptions(program || undefined);
  const save = useSaveEnrollment();

  const terms = (options.data?.academicTerms ?? []).filter(
    (t) => !academicYear || t.academic_year === academicYear,
  );
  const required = (options.data?.courses ?? []).filter((c) => c.required);

  async function submit() {
    if (!student) {
      toast.error("اختر الطالب");
      return;
    }
    if (!program) {
      toast.error("اختر البرنامج");
      return;
    }
    try {
      const result = await save.mutateAsync({
        student,
        program,
        academicYear: academicYear || options.data?.defaultAcademicYear || "",
        academicTerm,
        batch,
        category,
        enrolledOn,
        submit: 1,
      });
      toast.success(`تم التسجيل ${result.id}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التسجيل"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            تسجيل طالب في برنامج
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>الطالب *</Label>
            <StudentPicker value={student} onChange={setStudent} />
          </div>

          <div className="space-y-1.5">
            <Label>البرنامج / الصف *</Label>
            <SearchableSelect
              value={program}
              onChange={setProgram}
              options={(options.data?.programs ?? []).map((p) => ({ value: p, label: p }))}
              placeholder="اختر البرنامج"
            />
          </div>

          <div className="space-y-1.5">
            <Label>العام الدراسي</Label>
            <SearchableSelect
              value={academicYear || (options.data?.defaultAcademicYear ?? "")}
              onChange={setAcademicYear}
              options={(options.data?.academicYears ?? []).map((y) => ({ value: y, label: y }))}
              placeholder="اختر العام"
            />
          </div>

          <div className="space-y-1.5">
            <Label>الفصل الدراسي</Label>
            <SearchableSelect
              value={academicTerm}
              onChange={setAcademicTerm}
              options={terms.map((t) => ({ value: t.name, label: t.name }))}
              placeholder="اختياري"
              clearable
            />
          </div>

          <div className="space-y-1.5">
            <Label>الشعبة</Label>
            <SearchableSelect
              value={batch}
              onChange={setBatch}
              options={(options.data?.batches ?? []).map((b) => ({ value: b, label: b }))}
              placeholder="اختياري"
              clearable
            />
          </div>

          <div className="space-y-1.5">
            <Label>فئة الطالب</Label>
            <SearchableSelect
              value={category}
              onChange={setCategory}
              options={(options.data?.categories ?? []).map((c) => ({ value: c, label: c }))}
              placeholder="اختياري"
              clearable
            />
          </div>

          <div className="space-y-1.5">
            <Label>تاريخ التسجيل</Label>
            <Input type="date" value={enrolledOn} onChange={(e) => setEnrolledOn(e.target.value)} />
          </div>
        </div>

        {program && (
          <div className="card-surface p-4">
            <p className="text-sm font-bold">المواد التي سيُسجَّل بها</p>
            {required.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                لا توجد مواد إجبارية معرّفة لهذا البرنامج.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {required.map((c) => (
                  <Pill key={c.course} tone="info">
                    {c.course}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {save.isPending ? "جارٍ التسجيل…" : "تسجيل"}
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

/* ---------------------------------------------------------------- detail */

function DetailDialog({ enrollment, onClose }: { enrollment: string; onClose: () => void }) {
  const query = useEnrollmentDetail(enrollment);
  const submit = useSubmitEnrollment();
  const cancel = useCancelEnrollment();
  const confirm = useConfirm();

  const d = query.data;

  async function doSubmit() {
    try {
      await submit.mutateAsync(enrollment);
      toast.success("تم اعتماد التسجيل");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الاعتماد"));
    }
  }

  async function doCancel() {
    const ok = await confirm({
      title: "إلغاء التسجيل؟",
      description:
        "سيتم إلغاء التسجيل وحذف تسجيلات المواد المرتبطة به. لا يمكن الإلغاء إذا كانت هناك فواتير مرتبطة.",
      tone: "danger",
      confirmLabel: "إلغاء التسجيل",
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync(enrollment);
      toast.success("تم إلغاء التسجيل");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الإلغاء"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{d?.studentName ?? "تفاصيل التسجيل"}</DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <TableSkeleton rows={4} />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : d ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={TONE[d.docstatus] ?? "muted"}>{d.status}</Pill>
              <span className="num text-xs text-muted-foreground">{d.id}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Fact label="البرنامج" value={d.program} />
              <Fact label="العام الدراسي" value={d.academicYear} />
              <Fact label="الفصل" value={d.academicTerm} />
              <Fact label="الشعبة" value={d.batch} />
              <Fact label="الفئة" value={d.category} />
              <Fact label="تاريخ التسجيل" value={d.enrolledOn} />
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">
                المواد المسجّلة
                <span className="num mr-1.5 text-xs text-muted-foreground">
                  ({d.courseEnrollments.length})
                </span>
              </p>
              {d.courseEnrollments.length === 0 ? (
                <p className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
                  لم تُنشأ تسجيلات مواد بعد — تُنشأ تلقائياً عند اعتماد التسجيل.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {d.courseEnrollments.map((c) => (
                    <Pill key={c.name} tone="info">
                      {c.course}
                    </Pill>
                  ))}
                </div>
              )}
            </div>

            {d.invoices.length > 0 && (
              // Shown up front, because these are exactly what will refuse a
              // cancellation.
              <div className="rounded-xl border border-warning/40 bg-warm-soft p-3">
                <p className="text-sm font-bold text-warm-foreground">
                  فواتير مرتبطة ({d.invoices.length})
                </p>
                <ul className="mt-1.5 space-y-1">
                  {d.invoices.map((i) => (
                    <li key={i.name} className="num text-xs">
                      {i.name} — {i.grand_total} (متبقٍ {i.outstanding_amount})
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-warm-foreground">
                  لا يمكن إلغاء التسجيل قبل إلغاء هذه الفواتير.
                </p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          {d?.docstatus === 0 && (
            <button
              onClick={doSubmit}
              disabled={submit.isPending}
              className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              {submit.isPending ? "جارٍ الاعتماد…" : "اعتماد التسجيل"}
            </button>
          )}
          {d && d.docstatus !== 2 && (
            <button
              onClick={doCancel}
              disabled={cancel.isPending || d.invoices.length > 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-destructive-soft px-4 text-sm font-bold text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              إلغاء التسجيل
            </button>
          )}
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="num mt-0.5 text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}

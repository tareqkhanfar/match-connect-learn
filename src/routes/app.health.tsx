import { createFileRoute } from "@tanstack/react-router";
import { Activity, HeartPulse, Plus, Stethoscope, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { useConfirm } from "@/components/shared/confirm";
import {
  useDeleteHealthVisit,
  useHealthRecord,
  useSaveHealthRecord,
  useSaveHealthVisit,
  useStudents,
} from "@/lib/api/hooks";
import { byRole, isBackOffice } from "@/lib/roles";

export const Route = createFileRoute("/app/health")({
  head: () => ({
    meta: [
      { title: "الصحة المدرسية — Match Education" },
      {
        name: "description",
        content: "السجل الصحي للطالب: الحساسية، الأمراض المزمنة، الأدوية وزيارات العيادة.",
      },
    ],
  }),
  component: HealthPage,
});

const VISIT_TYPES = ["Illness", "Injury", "Medication", "Checkup", "Other"];
const VISIT_TYPE_AR: Record<string, string> = {
  Illness: "مرض",
  Injury: "إصابة",
  Medication: "دواء",
  Checkup: "فحص",
  Other: "أخرى",
};
const OUTCOMES = ["Returned to Class", "Sent Home", "Referred to Hospital", "Rest in Clinic"];
const OUTCOME_AR: Record<string, string> = {
  "Returned to Class": "عاد للصف",
  "Sent Home": "أُرسل للمنزل",
  "Referred to Hospital": "حُوّل للمستشفى",
  "Rest in Clinic": "استراحة في العيادة",
};

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function HealthPage() {
  const confirm = useConfirm();
  const { role, session } = useApp();
  const canEdit = isBackOffice(role);
  // Students and parents land straight on their own record — for a guardian
  // that is whichever child is chosen in the header, not simply the first.
  const ownStudent = useViewedStudent();

  const [selected, setSelected] = useState(ownStudent);

  // Follow the header when the guardian switches child.
  useEffect(() => {
    if (ownStudent) setSelected(ownStudent);
  }, [ownStudent]);
  const [studentSearch, setStudentSearch] = useState("");
  const debouncedSearch = useDebounced(studentSearch);

  const studentsQuery = useStudents({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    page_size: 20,
  });

  const query = useHealthRecord(selected || undefined);
  const deleteVisit = useDeleteHealthVisit();

  const [editingRecord, setEditingRecord] = useState(false);
  const [addingVisit, setAddingVisit] = useState(false);

  const record = query.data?.record;
  const visits = query.data?.visits ?? [];

  async function removeVisit(id: string) {
    const ok = await confirm({
      title: "حذف هذه الزيارة؟",
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await deleteVisit.mutateAsync(id);
      toast.success("تم حذف الزيارة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title={byRole(role, "الصحة المدرسية", { student: "ملفي الصحي", parent: "صحة الأبناء" })}
        subtitle="السجل الصحي وزيارات العيادة"
        actions={
          canEdit && selected ? (
            <>
              <button
                onClick={() => setEditingRecord(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:bg-secondary"
              >
                <HeartPulse className="size-4" />
                {record ? "تعديل السجل" : "إنشاء السجل"}
              </button>
              <button
                onClick={() => setAddingVisit(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
              >
                <Plus className="size-4" />
                زيارة عيادة
              </button>
            </>
          ) : null
        }
      />

      {/* Back office picks a student; students/parents are pinned to their own. */}
      {canEdit && (
        <div className="card-surface mb-5 grid gap-3 p-4 md:grid-cols-2">
          <Input
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder="ابحث عن طالب..."
            className="h-10 rounded-xl"
          />
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="اختر الطالب" />
            </SelectTrigger>
            <SelectContent>
              {(studentsQuery.data?.items ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!selected ? (
        <EmptyBlock title="اختر طالباً لعرض سجله الصحي" icon={<HeartPulse className="size-6" />} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <SectionCard
            title="السجل الصحي"
            description={query.data?.student_name ?? ""}
            actions={<Stethoscope className="size-4 text-muted-foreground" />}
          >
            {!record ? (
              <EmptyBlock
                title="لا يوجد سجل صحي"
                description={canEdit ? "أنشئ السجل من الزر أعلى الصفحة." : undefined}
              />
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <Field label="فصيلة الدم" value={record.blood_group} />
                <Field label="آخر فحص" value={record.last_checkup} />
                <Field label="الطول (سم)" value={record.height_cm} />
                <Field label="الوزن (كغ)" value={record.weight_kg} />
                <Field label="الحساسية" value={record.allergies} wide />
                <Field label="الأمراض المزمنة" value={record.chronic_conditions} wide />
                <Field label="الأدوية" value={record.medications} wide />
                <Field label="احتياجات خاصة" value={record.special_needs} wide />
                <Field label="التطعيمات" value={record.immunisations} wide />
                <Field label="جهة الطوارئ" value={record.emergency_contact_name} />
                <Field label="هاتف الطوارئ" value={record.emergency_contact_phone} />
                <Field label="الطبيب" value={record.physician_name} />
                <Field label="هاتف الطبيب" value={record.physician_phone} />
                <Field label="ملاحظات" value={record.notes} wide />
              </dl>
            )}
          </SectionCard>

          <SectionCard
            title="زيارات العيادة"
            description={`${visits.length} زيارة`}
            actions={<Activity className="size-4 text-muted-foreground" />}
          >
            {visits.length === 0 ? (
              <EmptyBlock title="لا توجد زيارات مسجّلة" />
            ) : (
              <ul className="space-y-2.5">
                {visits.map((v) => (
                  <li key={v.id} className="rounded-xl border border-border p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="num text-xs text-muted-foreground">{v.date}</p>
                        <p className="mt-0.5 truncate text-sm font-semibold">
                          {v.complaint || v.type}
                        </p>
                        {v.treatment && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            العلاج: {v.treatment}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Pill tone="info">{v.type}</Pill>
                          <Pill tone="muted">{v.outcome}</Pill>
                          {v.parent_notified && <Pill tone="success">أُبلغ ولي الأمر</Pill>}
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => removeVisit(v.id)}
                          className="rounded-lg bg-secondary px-2 py-1 text-destructive hover:bg-destructive-soft"
                          aria-label="حذف الزيارة"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      {editingRecord && (
        <HealthRecordDialog
          student={selected}
          record={record ?? null}
          onClose={() => setEditingRecord(false)}
        />
      )}
      {addingVisit && <VisitDialog student={selected} onClose={() => setAddingVisit(false)} />}
    </>
  );
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string | number | null | undefined;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function HealthRecordDialog({
  student,
  record,
  onClose,
}: {
  student: string;
  record: NonNullable<ReturnType<typeof useHealthRecord>["data"]>["record"];
  onClose: () => void;
}) {
  const save = useSaveHealthRecord();
  const [form, setForm] = useState({
    blood_group: record?.blood_group ?? "",
    height_cm: record?.height_cm != null ? String(record.height_cm) : "",
    weight_kg: record?.weight_kg != null ? String(record.weight_kg) : "",
    allergies: record?.allergies ?? "",
    chronic_conditions: record?.chronic_conditions ?? "",
    medications: record?.medications ?? "",
    special_needs: record?.special_needs ?? "",
    immunisations: record?.immunisations ?? "",
    last_checkup: record?.last_checkup ?? "",
    emergency_contact_name: record?.emergency_contact_name ?? "",
    emergency_contact_phone: record?.emergency_contact_phone ?? "",
    physician_name: record?.physician_name ?? "",
    physician_phone: record?.physician_phone ?? "",
    notes: record?.notes ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    try {
      await save.mutateAsync({
        student,
        ...form,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      });
      toast.success("تم حفظ السجل الصحي");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">السجل الصحي</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>فصيلة الدم</Label>
            <Select value={form.blood_group} onValueChange={(v) => set("blood_group", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>آخر فحص</Label>
            <Input
              type="date"
              value={form.last_checkup}
              onChange={(e) => set("last_checkup", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الطول (سم)</Label>
            <Input
              type="number"
              value={form.height_cm}
              onChange={(e) => set("height_cm", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الوزن (كغ)</Label>
            <Input
              type="number"
              value={form.weight_kg}
              onChange={(e) => set("weight_kg", e.target.value)}
              className="num rounded-xl"
            />
          </div>

          {(
            [
              ["allergies", "الحساسية"],
              ["chronic_conditions", "الأمراض المزمنة"],
              ["medications", "الأدوية"],
              ["special_needs", "احتياجات خاصة"],
              ["immunisations", "التطعيمات"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5 sm:col-span-2">
              <Label>{label}</Label>
              <Textarea
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                rows={2}
                className="rounded-xl"
              />
            </div>
          ))}

          <div className="space-y-1.5">
            <Label>جهة الطوارئ</Label>
            <Input
              value={form.emergency_contact_name}
              onChange={(e) => set("emergency_contact_name", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>هاتف الطوارئ</Label>
            <Input
              value={form.emergency_contact_phone}
              onChange={(e) => set("emergency_contact_phone", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الطبيب</Label>
            <Input
              value={form.physician_name}
              onChange={(e) => set("physician_name", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>هاتف الطبيب</Label>
            <Input
              value={form.physician_phone}
              onChange={(e) => set("physician_phone", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>ملاحظات</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="rounded-xl"
            />
          </div>
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

function VisitDialog({ student, onClose }: { student: string; onClose: () => void }) {
  const save = useSaveHealthVisit();
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().slice(0, 16),
    visit_type: "Illness",
    complaint: "",
    treatment: "",
    outcome: "Returned to Class",
    parent_notified: "0",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    try {
      await save.mutateAsync({
        student,
        ...form,
        visit_date: form.visit_date.replace("T", " ") + ":00",
        parent_notified: Number(form.parent_notified),
      });
      toast.success("تم تسجيل الزيارة");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">زيارة عيادة</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>التاريخ والوقت</Label>
              <Input
                type="datetime-local"
                value={form.visit_date}
                onChange={(e) => set("visit_date", e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={form.visit_type} onValueChange={(v) => set("visit_type", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {VISIT_TYPE_AR[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>الشكوى</Label>
            <Textarea
              value={form.complaint}
              onChange={(e) => set("complaint", e.target.value)}
              rows={2}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>العلاج المقدَّم</Label>
            <Textarea
              value={form.treatment}
              onChange={(e) => set("treatment", e.target.value)}
              rows={2}
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>النتيجة</Label>
              <Select value={form.outcome} onValueChange={(v) => set("outcome", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {OUTCOME_AR[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>إبلاغ ولي الأمر</Label>
              <Select value={form.parent_notified} onValueChange={(v) => set("parent_notified", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">لا</SelectItem>
                  <SelectItem value="1">نعم</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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

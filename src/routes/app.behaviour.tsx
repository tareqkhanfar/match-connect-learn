import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { ClipboardList, Minus, Plus, ShieldAlert, ThumbsUp, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KpiCard, PageHeader, Pill } from "@/components/shared/ui-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { useConfirm } from "@/components/shared/confirm";
import { EvaluationFormBuilder } from "@/components/shared/evaluation-form-builder";
import { errorMessage } from "@/lib/api/error-message";
import {
  useBehaviour,
  useClasses,
  useDeleteBehaviour,
  useDeleteEvaluationForm,
  useEvaluationForms,
  useEvaluationGrid,
  usePublishEvaluations,
  useSaveEvaluationGrid,
  useSaveBehaviour,
  useStudents,
  type BehaviourRow,
} from "@/lib/api/hooks";
import { byRole, isBackOffice } from "@/lib/roles";

export const Route = createFileRoute("/app/behaviour")({
  validateSearch: groupSearch,
  head: () => ({
    meta: [
      { title: "السلوك والانضباط — Match Education" },
      {
        name: "description",
        content: "سجل السلوك الإيجابي والمخالفات مع نظام نقاط ومتابعة أولياء الأمور.",
      },
    ],
  }),
  component: BehaviourPage,
});

const CATEGORIES = [
  "Participation",
  "Helpfulness",
  "Academic Excellence",
  "Late Arrival",
  "Disruption",
  "Uniform",
  "Homework",
  "Other",
];

const CATEGORY_AR: Record<string, string> = {
  Participation: "مشاركة",
  Helpfulness: "تعاون",
  "Academic Excellence": "تميّز أكاديمي",
  "Late Arrival": "تأخر",
  Disruption: "إزعاج",
  Uniform: "الزي المدرسي",
  Homework: "واجبات",
  Other: "أخرى",
};

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function BehaviourPage() {
  const confirm = useConfirm();
  const { role } = useApp();
  const canEdit = isBackOffice(role) || role === "teacher";

  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">();
  const [editing, setEditing] = useState<BehaviourRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"records" | "assess" | "forms">("records");
  // How many form assessments exist for the pupil in view — the fourth number
  // beside the three the records give, so the strip describes the whole
  // picture rather than half of it.
  const behaviourForms = useEvaluationForms("سلوك");
  const evaluationCount = (behaviourForms.data?.forms ?? []).reduce((n, f) => n + f.entry_count, 0);

  const debouncedSearch = useDebounced(search);

  const viewed = useViewedStudent();
  const filters = {
    // Scoped to the child picked in the header for a family.
    ...(viewed ? { student: viewed } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(type !== "all" ? { record_type: type } : {}),
    ...(category !== "all" ? { category } : {}),
    ...(fromDate ? { from_date: fromDate } : {}),
    ...(toDate ? { to_date: toDate } : {}),
  };

  const query = useBehaviour({
    filters,
    page,
    page_size: pageSize,
    ...(sortField ? { sort_field: sortField } : {}),
    ...(sortOrder ? { sort_order: sortOrder } : {}),
  });

  const deleteBehaviour = useDeleteBehaviour();

  const rows = query.data?.items ?? [];
  const summary = query.data?.summary;

  async function remove(row: BehaviourRow) {
    const ok = await confirm({
      title: `حذف سجل «${row.student_name}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await deleteBehaviour.mutateAsync(row.id);
      toast.success("تم حذف السجل");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  const columns: Column<BehaviourRow>[] = [
    {
      fieldname: "student_name",
      label: "الطالب",
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.student_name}</p>
          <p className="num text-xs text-muted-foreground">{r.student}</p>
        </div>
      ),
    },
    { fieldname: "date", label: "التاريخ", sortable: true, numeric: true },
    {
      fieldname: "type",
      label: "النوع",
      sortable: true,
      render: (r) => <Pill tone={r.type_raw === "Positive" ? "success" : "danger"}>{r.type}</Pill>,
    },
    {
      fieldname: "points",
      label: "النقاط",
      numeric: true,
      render: (r) => (
        <span className={r.points >= 0 ? "font-bold text-success" : "font-bold text-destructive"}>
          {r.points > 0 ? `+${r.points}` : r.points}
        </span>
      ),
    },
    {
      fieldname: "category",
      label: "التصنيف",
      render: (r) =>
        r.category
          ? r.category
              .split(",")
              .map((c) => CATEGORY_AR[c.trim()] ?? c.trim())
              .join("، ")
          : "—",
    },
    { fieldname: "student_group", label: "الشعبة", hiddenByDefault: true },
    { fieldname: "description", label: "الوصف", hiddenByDefault: true },
    { fieldname: "action_taken", label: "الإجراء المتخذ", hiddenByDefault: true },
    {
      fieldname: "parent_notified",
      label: "أُبلغ ولي الأمر",
      hiddenByDefault: true,
      render: (r) => (r.parent_notified ? "نعم" : "لا"),
    },
  ];

  if (canEdit) {
    columns.push({
      fieldname: "actions",
      label: "إجراءات",
      alwaysVisible: true,
      render: (r) => (
        <div className="flex gap-1.5">
          <button
            onClick={() => setEditing(r)}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
          >
            تعديل
          </button>
          <button
            onClick={() => remove(r)}
            className="rounded-lg bg-secondary px-2 py-1 text-xs text-destructive hover:bg-destructive-soft"
            aria-label="حذف"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    });
  }

  return (
    <>
      <PageHeader
        title={byRole(role, "السلوك والتقييم", {
          student: "سلوكي وتقييمي",
          parent: "سلوك الأبناء وتقييمهم",
        })}
        subtitle="حادثة مفردة تُسجَّل، ومعايير متكرّرة تُقيَّم — كلاهما هنا"
        actions={
          canEdit && tab === "records" ? (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
            >
              <Plus className="size-4" />
              سجل جديد
            </button>
          ) : null
        }
      />

      {/* One screen, because they answer the same question about a pupil in
          two ways. A record is "this happened on Tuesday"; an assessment is
          "how does this pupil do, on the things we said we care about". A
          teacher looking into a child's conduct wants both without leaving. */}
      {canEdit && (
        <div className="mb-5 flex gap-1 rounded-xl border border-border bg-card p-1">
          {[
            { key: "records" as const, label: "سجلات السلوك" },
            { key: "assess" as const, label: "التقييم بالنماذج" },
            { key: "forms" as const, label: "إدارة النماذج" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {canEdit && tab === "assess" && <BehaviourAssessTab />}
      {canEdit && tab === "forms" && <BehaviourFormsTab />}

      {tab === "records" && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-4">
            <KpiCard
              label="سجلات إيجابية"
              value={summary?.positive ?? 0}
              icon={ThumbsUp}
              tone="accent"
            />
            <KpiCard
              label="مخالفات"
              value={summary?.negative ?? 0}
              icon={ShieldAlert}
              tone="warm"
            />
            <KpiCard
              label="صافي النقاط"
              value={summary?.net_points ?? 0}
              icon={Minus}
              tone="primary"
            />
            <KpiCard
              label="تقييمات بالنماذج"
              value={evaluationCount}
              icon={ClipboardList}
              tone="info"
            />
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            storageKey="behaviour"
            isLoading={query.isLoading}
            isFetching={query.isFetching}
            error={query.error}
            onRetry={() => query.refetch()}
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="ابحث باسم الطالب..."
            sortField={sortField}
            sortOrder={sortOrder}
            onSortChange={(f, o) => {
              setSortField(f);
              setSortOrder(o);
            }}
            page={page}
            pageSize={pageSize}
            total={query.data?.total}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            exportDataset="behaviour"
            exportFilters={filters}
            exportTitle="السلوك والانضباط"
            emptyTitle="لا توجد سجلات سلوكية"
            toolbar={
              <>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    setType(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 w-[130px] rounded-xl">
                    <SelectValue placeholder="النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    <SelectItem value="Positive">إيجابي</SelectItem>
                    <SelectItem value="Negative">سلبي</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={category}
                  onValueChange={(v) => {
                    setCategory(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 w-[150px] rounded-xl">
                    <SelectValue placeholder="التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل التصنيفات</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_AR[c] ?? c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-[145px] rounded-xl"
                  aria-label="من تاريخ"
                />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-[145px] rounded-xl"
                  aria-label="إلى تاريخ"
                />
              </>
            }
          />
        </>
      )}

      {(creating || editing) && (
        <BehaviourDialog
          record={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function BehaviourDialog({
  record,
  onClose,
}: {
  record: BehaviourRow | null;
  onClose: () => void;
}) {
  const save = useSaveBehaviour();
  const [studentSearch, setStudentSearch] = useState("");
  const debouncedStudent = useDebounced(studentSearch);
  const studentsQuery = useStudents({
    ...(debouncedStudent ? { search: debouncedStudent } : {}),
    page_size: 20,
  });

  const [form, setForm] = useState({
    student: record?.student ?? "",
    record_type: record?.type_raw ?? "Positive",
    points: String(Math.abs(record?.points ?? 1)),
    category: record?.category ?? "",
    record_date: record?.date ?? new Date().toISOString().slice(0, 10),
    description: record?.description ?? "",
    action_taken: record?.action_taken ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.student) {
      toast.error("اختر الطالب");
      return;
    }
    try {
      await save.mutateAsync({
        ...(record ? { id: record.id } : {}),
        ...form,
        points: Number(form.points) || 1,
      });
      toast.success(record ? "تم تحديث السجل" : "تمت إضافة السجل");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {record ? "تعديل السجل السلوكي" : "سجل سلوكي جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {!record && (
            <div className="space-y-1.5">
              <Label>الطالب *</Label>
              {/* One control instead of a search box stacked above a dropdown:
                  the search is inside the list, which is where a user expects
                  it and which keeps the two in step. */}
              <SearchableSelect
                options={(studentsQuery.data?.items ?? []).map((s) => ({
                  value: s.id,
                  label: s.name,
                  hint: s.id,
                }))}
                value={form.student}
                onChange={(v) => set("student", v)}
                onSearchChange={setStudentSearch}
                placeholder="اختر الطالب"
                searchPlaceholder="ابحث بالاسم أو الرقم…"
                emptyText="لا يوجد طالب بهذا الاسم"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={form.record_type} onValueChange={(v) => set("record_type", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Positive">إيجابي</SelectItem>
                  <SelectItem value="Negative">سلبي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>النقاط</Label>
              <Input
                type="number"
                min={1}
                value={form.points}
                onChange={(e) => set("points", e.target.value)}
                className="num rounded-xl"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>التصنيف (يمكن اختيار أكثر من واحد)</Label>
              {/* One incident is often several things at once — late *and* no
                  homework — so the categories are checkboxes stored as a
                  comma-separated list rather than a single choice. */}
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-border p-2.5">
                {CATEGORIES.map((c) => {
                  const chosen = form.category
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  const on = chosen.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        set(
                          "category",
                          (on ? chosen.filter((x) => x !== c) : [...chosen, c]).join(","),
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                        on
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {CATEGORY_AR[c] ?? c}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={form.record_date}
                onChange={(e) => set("record_date", e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>الوصف</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الإجراء المتخذ</Label>
            <Textarea
              value={form.action_taken}
              onChange={(e) => set("action_taken", e.target.value)}
              rows={2}
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

/* -------------------------------------------------------------------------
 * Assessing against a form — the second half of the same question
 * ---------------------------------------------------------------------- */

/**
 * A whole class against one behaviour form.
 *
 * The same grid as mark entry, for the same reason: a teacher answering
 * fifteen criteria for thirty pupils will not open thirty dialogs. Edits are
 * held here until saved, so a slow connection cannot lose a column of typing.
 */
function BehaviourAssessTab() {
  const forms = useEvaluationForms("سلوك");
  const classes = useClasses();
  const [formId, setFormId] = useState("");
  const [group, setGroup] = useState("");
  const grid = useEvaluationGrid(formId || undefined, group || undefined);
  const saveGrid = useSaveEvaluationGrid();
  const publish = usePublishEvaluations();

  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    setDraft({});
  }, [formId, group]);

  const form = grid.data?.form;
  const criteria = form?.criteria ?? [];
  const scale = form?.scale ?? [];
  const students = grid.data?.students ?? [];
  const saved = grid.data?.answers ?? {};
  const dirty = Object.keys(draft).length > 0;

  const active = (forms.data?.forms ?? []).filter((f) => f.is_active);

  function valueFor(student: string, key: string): string {
    return draft[student]?.[key] ?? saved[student]?.[key]?.value ?? "";
  }

  async function submit() {
    const rows: Record<string, { values: Record<string, { value?: string }> }> = {};
    for (const s of students) {
      if (!draft[s.id]) continue;
      // The server replaces the answer set, so a partial row would erase the
      // criteria the teacher did not touch this time.
      const values: Record<string, { value?: string }> = {};
      for (const c of criteria) {
        const v = valueFor(s.id, c.key);
        if (v) values[c.key] = { value: v };
      }
      rows[s.id] = { values };
    }
    if (Object.keys(rows).length === 0) {
      toast.error("لا توجد تغييرات لحفظها");
      return;
    }
    try {
      const res = await saveGrid.mutateAsync({ form: formId, student_group: group, rows });
      toast.success(`تم حفظ تقييم ${res.saved} طالباً`);
      setDraft({});
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحفظ"));
    }
  }

  async function setVisible(show: boolean) {
    const entries = students.map((s) => s.entry).filter((e): e is string => Boolean(e));
    if (entries.length === 0) {
      toast.error("لا توجد تقييمات محفوظة بعد");
      return;
    }
    try {
      await publish.mutateAsync({ entries, is_published: show ? 1 : 0 });
      toast.success(show ? "أصبحت التقييمات ظاهرة للأهالي" : "تم إخفاء التقييمات");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر التحديث"));
    }
  }

  if (active.length === 0 && !forms.isLoading) {
    return (
      <EmptyBlock
        title="لا توجد نماذج سلوك بعد"
        description="النموذج مجموعة معايير تعرّفها المدرسة — الاستماع، الالتزام، احترام الزملاء — ثم تُقيَّم عليها الشعبة كاملة."
        icon={<ClipboardList className="size-6" />}
      />
    );
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
              {active.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.title}
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
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            حفظ
          </button>
        </div>
      </div>

      {!formId || !group ? (
        <EmptyBlock
          title="اختر نموذجاً وشعبة"
          description="سيظهر جدول التقييم: الطلاب في الصفوف والمعايير في الأعمدة."
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
        <div className="card-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold">{form?.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {form?.scale_type === "مقياس"
                  ? scale.map((o) => o.label).join(" / ")
                  : "أدخل القيمة لكل معيار"}
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => void setVisible(true)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                إظهار للأهالي
              </button>
              <button
                onClick={() => void setVisible(false)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                إخفاء
              </button>
            </div>
          </div>

          {/* Wide sheets scroll inside their own box; the page never does. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                {(form?.categories.length ?? 0) > 0 && (
                  <tr>
                    <th className="sticky right-0 z-10 bg-card" />
                    {form!.categories.map((cat) => (
                      <th
                        key={cat}
                        colSpan={criteria.filter((c) => c.category === cat).length}
                        className="border-b border-s border-border bg-secondary/60 px-2 py-1.5 text-center text-[11px] font-bold"
                      >
                        {cat}
                      </th>
                    ))}
                    {criteria.some((c) => !c.category) && (
                      <th
                        colSpan={criteria.filter((c) => !c.category).length}
                        className="border-b border-s border-border bg-secondary/60 px-2 py-1.5 text-center text-[11px] font-bold"
                      >
                        معايير عامة
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
                        {form?.scale_type === "علامة رقمية" || form?.scale_type === "نص" ? (
                          <Input
                            {...(form.scale_type === "علامة رقمية" ? { type: "number" } : {})}
                            value={valueFor(s.id, c.key)}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [s.id]: { ...(d[s.id] ?? {}), [c.key]: e.target.value },
                              }))
                            }
                            className="h-8 text-center text-xs"
                          />
                        ) : (
                          <select
                            value={valueFor(s.id, c.key)}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [s.id]: { ...(d[s.id] ?? {}), [c.key]: e.target.value },
                              }))
                            }
                            className={`h-8 w-full rounded-lg border border-border bg-background px-1 text-center text-xs ${
                              valueFor(s.id, c.key) ? "font-semibold" : ""
                            }`}
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
                      {s.entry ? s.total : "—"}
                      {s.entry && form?.max_total ? (
                        <span className="text-muted-foreground">/{form.max_total}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/** The behaviour forms themselves — created and edited where they are used. */
function BehaviourFormsTab() {
  const { data, isLoading } = useEvaluationForms("سلوك");
  const remove = useDeleteEvaluationForm();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function drop(id: string, title: string, used: number) {
    const ok = await confirm({
      title: `حذف النموذج «${title}»؟`,
      description:
        used > 0
          ? `النموذج مستخدم في ${used} تقييماً، لذلك سيُعطَّل بدل حذفه حتى تبقى التقييمات السابقة مقروءة.`
          : "لم يُستخدم بعد، وسيُحذف نهائياً.",
      confirmLabel: used > 0 ? "تعطيل" : "حذف",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ form: id });
      toast.success(used > 0 ? "تم تعطيل النموذج" : "تم حذف النموذج");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحذف"));
    }
  }

  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">نماذج السلوك</p>
          <p className="text-[11px] text-muted-foreground">
            المعايير التي تُقيَّم عليها الشعبة — تعرّفها المدرسة بنفسها.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          <Plus className="size-3.5" />
          نموذج جديد
        </button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : (data?.forms.length ?? 0) === 0 ? (
        <EmptyBlock
          title="لا توجد نماذج بعد"
          description="مثال: «سلوك الطالب في الصف» بمعايير الاستماع والالتزام واحترام الزملاء، تُقيَّم بـ دائماً / أحياناً / أبداً."
          icon={<ClipboardList className="size-6" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {data!.forms.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{f.title}</span>
                  <Pill>{f.scale_type}</Pill>
                  {!f.is_active && <Pill tone="danger">معطّل</Pill>}
                </p>
                <p className="num text-[11px] text-muted-foreground">
                  {f.criteria_count} معياراً · استُخدم في {f.entry_count} تقييماً
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => setEditing(f.id)}
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

      {(creating || editing) && (
        <EvaluationFormBuilder
          form={editing}
          defaultType="سلوك"
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

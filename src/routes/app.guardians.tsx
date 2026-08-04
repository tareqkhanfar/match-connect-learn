import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, Plus, Trash2, Users } from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import { BulkActions } from "@/components/shared/bulk-actions";
import { StudentPicker } from "@/components/shared/student-picker";
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
import {
  useGuardians,
  useLinkGuardian,
  useSaveGuardian,
  useUnlinkGuardian,
  type GuardianRow,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/guardians")({
  head: () => ({
    meta: [
      { title: "أولياء الأمور — Match Education" },
      {
        name: "description",
        content: "سجل أولياء الأمور وبيانات التواصل والأبناء المرتبطين بكل ولي أمر.",
      },
    ],
  }),
  component: GuardiansPage,
});

const RELATIONS = [
  { value: "Father", label: "الأب" },
  { value: "Mother", label: "الأم" },
  { value: "Guardian", label: "وصي" },
  { value: "Other", label: "أخرى" },
];

function GuardiansPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<GuardianRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState<GuardianRow | null>(null);

  const query = useGuardians({ search, page, page_size: pageSize });
  const unlink = useUnlinkGuardian();

  async function removeLink(guardian: string, student: string, name: string) {
    if (!window.confirm(`فك ارتباط ${name} بولي الأمر؟`)) return;
    try {
      await unlink.mutateAsync({ student, guardian });
      toast.success("تم فك الارتباط");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر فك الارتباط");
    }
  }

  const columns: Column<GuardianRow>[] = [
    { fieldname: "name", label: "الاسم", sortable: true },
    { fieldname: "phone", label: "الهاتف", numeric: true, render: (g) => g.phone ?? "—" },
    { fieldname: "email", label: "البريد", render: (g) => g.email ?? "—" },
    {
      fieldname: "occupation",
      label: "المهنة",
      hiddenByDefault: true,
      render: (g) => g.occupation ?? "—",
    },
    {
      fieldname: "children_count",
      label: "عدد الأبناء",
      numeric: true,
      render: (g) => g.children_count,
    },
    {
      fieldname: "children",
      label: "الأبناء",
      render: (g) =>
        g.children.length ? (
          <span className="flex flex-wrap gap-1">
            {g.children.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-0.5 text-xs"
              >
                <Link
                  to="/app/students/$studentId"
                  params={{ studentId: c.id }}
                  className="hover:text-primary hover:underline"
                >
                  {c.name}
                </Link>
                <button
                  onClick={() => removeLink(g.id, c.id, c.name)}
                  aria-label={`فك ارتباط ${c.name}`}
                  className="rounded text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
          </span>
        ) : (
          <Pill tone="warning">لا يوجد</Pill>
        ),
    },
    {
      fieldname: "actions",
      label: "",
      alwaysVisible: true,
      render: (g) => (
        <span className="flex gap-1.5">
          <button
            onClick={() => setLinking(g)}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
          >
            ربط ابن
          </button>
          <button
            onClick={() => setEditing(g)}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
          >
            تعديل
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="أولياء الأمور"
        subtitle="سجل أولياء الأمور، بيانات التواصل، والأبناء المرتبطين بكل منهم"
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-4" />
            إضافة ولي أمر
          </button>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(g) => g.id}
        storageKey="guardians"
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="ابحث باسم ولي الأمر..."
        page={page}
        pageSize={pageSize}
        total={query.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        exportDataset="guardians"
        exportTitle="أولياء الأمور"
        bulkDoctype="Guardian"
        bulkActions={(selected, clear) => (
          <BulkActions
            doctype="Guardian"
            selected={selected}
            onDone={clear}
            noun="ولي أمر"
          />
        )}
        emptyTitle="لا يوجد أولياء أمور"
        emptyDescription="أضف ولي أمر واربطه بأبنائه."
      />

      {(creating || editing) && (
        <GuardianDialog
          guardian={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {linking && <LinkChildDialog guardian={linking} onClose={() => setLinking(null)} />}
    </>
  );
}

function GuardianDialog({
  guardian,
  onClose,
}: {
  guardian: GuardianRow | null;
  onClose: () => void;
}) {
  const save = useSaveGuardian();
  const [form, setForm] = useState({
    name: guardian?.name ?? "",
    email: guardian?.email ?? "",
    phone: guardian?.phone ?? "",
    alternate_phone: guardian?.alternate_phone ?? "",
    occupation: guardian?.occupation ?? "",
  });

  async function submit() {
    if (!form.name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    try {
      await save.mutateAsync({ ...(guardian ? { id: guardian.id } : {}), ...form });
      toast.success(guardian ? "تم تحديث ولي الأمر" : "تم إضافة ولي الأمر");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {guardian ? "تعديل ولي أمر" : "إضافة ولي أمر"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>الاسم الكامل</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الهاتف</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="num rounded-xl"
              placeholder="05xxxxxxxx"
            />
          </div>
          <div className="space-y-1.5">
            <Label>هاتف بديل</Label>
            <Input
              value={form.alternate_phone}
              onChange={(e) => setForm((f) => ({ ...f, alternate_phone: e.target.value }))}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>البريد الإلكتروني</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded-xl"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المهنة</Label>
            <Input
              value={form.occupation}
              onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
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

function LinkChildDialog({ guardian, onClose }: { guardian: GuardianRow; onClose: () => void }) {
  const link = useLinkGuardian();
  const [student, setStudent] = useState("");
  const [relation, setRelation] = useState("Father");

  async function submit() {
    if (!student) {
      toast.error("اختر الطالب");
      return;
    }
    try {
      await link.mutateAsync({ student, guardian: guardian.id, relation });
      toast.success("تم ربط الطالب بولي الأمر");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الربط");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">ربط ابن بـ {guardian.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>الطالب</Label>
            <StudentPicker value={student} onChange={setStudent} />
          </div>
          <div className="space-y-1.5">
            <Label>صلة القرابة</Label>
            <SearchableSelect options={RELATIONS} value={relation} onChange={setRelation} />
          </div>
          {guardian.children.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <Users className="size-3.5" />
                الأبناء الحاليون
              </p>
              <div className="flex flex-wrap gap-1.5">
                {guardian.children.map((c) => (
                  <Pill key={c.id} tone="primary">
                    {c.name}
                  </Pill>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={link.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {link.isPending ? "جارٍ الربط…" : "ربط"}
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

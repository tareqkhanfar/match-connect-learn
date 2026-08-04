import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Library, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KpiCard, PageHeader, Pill } from "@/components/shared/ui-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useApp } from "@/lib/app-context";
import { useConfirm } from "@/components/shared/confirm";
import {
  useBooks,
  useDeleteBook,
  useIssueBook,
  useLoans,
  useReturnBook,
  useSaveBook,
  useStudents,
  type BookRow,
  type LoanRow,
} from "@/lib/api/hooks";
import { byRole, isBackOffice } from "@/lib/roles";

export const Route = createFileRoute("/app/library")({
  head: () => ({
    meta: [
      { title: "المكتبة — Match Education" },
      { name: "description", content: "فهرس الكتب وإعارات الطلاب ومتابعة النسخ المتاحة." },
    ],
  }),
  component: LibraryPage,
});

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function LibraryPage() {
  const { role } = useApp();
  const canManage = isBackOffice(role);

  return (
    <>
      <PageHeader title={byRole(role, "المكتبة", { student: "مكتبتي", parent: "استعارات الأبناء" })} subtitle="فهرس الكتب وإعارات الطلاب" />
      <Tabs defaultValue="books" dir="rtl">
        <TabsList className="mb-4 h-auto flex-wrap rounded-xl p-1">
          <TabsTrigger value="books" className="rounded-lg">
            الكتب
          </TabsTrigger>
          <TabsTrigger value="loans" className="rounded-lg">
            الإعارات
          </TabsTrigger>
        </TabsList>
        <TabsContent value="books">
          <BooksTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="loans">
          <LoansTab canManage={canManage} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function BooksTab({ canManage }: { canManage: boolean }) {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">();
  const [editing, setEditing] = useState<BookRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [issuing, setIssuing] = useState<BookRow | null>(null);

  const debouncedSearch = useDebounced(search);
  const filters = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(availableOnly === "yes" ? { available_only: 1 } : {}),
  };

  const query = useBooks({
    filters,
    page,
    page_size: pageSize,
    ...(sortField ? { sort_field: sortField } : {}),
    ...(sortOrder ? { sort_order: sortOrder } : {}),
  });
  const deleteBook = useDeleteBook();

  const rows = query.data?.items ?? [];
  const totalCopies = rows.reduce((a, b) => a + b.total_copies, 0);
  const available = rows.reduce((a, b) => a + b.available_copies, 0);

  async function remove(row: BookRow) {
    const ok = await confirm({
      title: `حذف «${row.title}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await deleteBook.mutateAsync(row.id);
      toast.success("تم حذف الكتاب");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  const columns: Column<BookRow>[] = [
    { fieldname: "title", label: "العنوان", sortable: true },
    { fieldname: "author", label: "المؤلف", sortable: true },
    { fieldname: "category", label: "التصنيف", sortable: true },
    { fieldname: "language", label: "اللغة", hiddenByDefault: true },
    { fieldname: "isbn", label: "ISBN", hiddenByDefault: true },
    { fieldname: "publisher", label: "الناشر", hiddenByDefault: true },
    { fieldname: "published_year", label: "سنة النشر", numeric: true, hiddenByDefault: true },
    { fieldname: "shelf", label: "الرف", hiddenByDefault: true },
    { fieldname: "total_copies", label: "إجمالي النسخ", numeric: true },
    {
      fieldname: "available_copies",
      label: "المتاح",
      numeric: true,
      render: (r) => (
        <Pill tone={r.available_copies > 0 ? "success" : "danger"}>{r.available_copies}</Pill>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      fieldname: "actions",
      label: "إجراءات",
      alwaysVisible: true,
      render: (r) => (
        <div className="flex gap-1.5">
          <button
            onClick={() => setIssuing(r)}
            disabled={r.available_copies <= 0}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft hover:text-primary disabled:opacity-40"
          >
            إعارة
          </button>
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
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="عدد العناوين"
          value={query.data?.total ?? 0}
          icon={Library}
          tone="primary"
        />
        <KpiCard label="إجمالي النسخ" value={totalCopies} icon={BookOpen} tone="info" />
        <KpiCard label="النسخ المتاحة" value={available} icon={BookOpen} tone="accent" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        storageKey="books"
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="ابحث بالعنوان أو المؤلف أو ISBN..."
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
        exportDataset="books"
        exportFilters={filters}
        exportTitle="المكتبة"
        emptyTitle="لا توجد كتب"
        toolbar={
          <>
            <Select
              value={availableOnly}
              onValueChange={(v) => {
                setAvailableOnly(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-[150px] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الكتب</SelectItem>
                <SelectItem value="yes">المتاحة فقط</SelectItem>
              </SelectContent>
            </Select>
            {canManage && (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
              >
                <Plus className="size-4" />
                كتاب جديد
              </button>
            )}
          </>
        }
      />

      {(creating || editing) && (
        <BookDialog
          book={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {issuing && <IssueDialog book={issuing} onClose={() => setIssuing(null)} />}
    </>
  );
}

function BookDialog({ book, onClose }: { book: BookRow | null; onClose: () => void }) {
  const save = useSaveBook();
  const [form, setForm] = useState({
    title: book?.title ?? "",
    author: book?.author ?? "",
    isbn: book?.isbn ?? "",
    category: book?.category ?? "",
    language: book?.language ?? "Arabic",
    publisher: book?.publisher ?? "",
    published_year: book?.published_year ? String(book.published_year) : "",
    shelf: book?.shelf ?? "",
    total_copies: String(book?.total_copies ?? 1),
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("عنوان الكتاب مطلوب");
      return;
    }
    try {
      await save.mutateAsync({
        ...(book ? { id: book.id } : {}),
        ...form,
        total_copies: Number(form.total_copies) || 1,
        published_year: form.published_year ? Number(form.published_year) : null,
      });
      toast.success(book ? "تم تحديث الكتاب" : "تمت إضافة الكتاب");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{book ? "تعديل كتاب" : "كتاب جديد"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>العنوان *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المؤلف</Label>
            <Input
              value={form.author}
              onChange={(e) => set("author", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>التصنيف</Label>
            <Input
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>اللغة</Label>
            <Select value={form.language} onValueChange={(v) => set("language", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arabic">العربية</SelectItem>
                <SelectItem value="English">الإنجليزية</SelectItem>
                <SelectItem value="Other">أخرى</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>عدد النسخ</Label>
            <Input
              type="number"
              min={1}
              value={form.total_copies}
              onChange={(e) => set("total_copies", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>ISBN</Label>
            <Input
              value={form.isbn}
              onChange={(e) => set("isbn", e.target.value)}
              className="num rounded-xl"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الرف</Label>
            <Input
              value={form.shelf}
              onChange={(e) => set("shelf", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الناشر</Label>
            <Input
              value={form.publisher}
              onChange={(e) => set("publisher", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>سنة النشر</Label>
            <Input
              type="number"
              value={form.published_year}
              onChange={(e) => set("published_year", e.target.value)}
              className="num rounded-xl"
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

function IssueDialog({ book, onClose }: { book: BookRow; onClose: () => void }) {
  const issue = useIssueBook();
  const [studentSearch, setStudentSearch] = useState("");
  const debounced = useDebounced(studentSearch);
  const studentsQuery = useStudents({ ...(debounced ? { search: debounced } : {}), page_size: 20 });

  const [student, setStudent] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  async function submit() {
    if (!student) {
      toast.error("اختر الطالب");
      return;
    }
    try {
      await issue.mutateAsync({ book: book.id, student, due_date: dueDate });
      toast.success("تم إعارة الكتاب");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّرت الإعارة");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">إعارة: {book.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>ابحث عن الطالب</Label>
            <Input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="اسم الطالب..."
              className="rounded-xl"
            />
            <Select value={student} onValueChange={setStudent}>
              <SelectTrigger className="rounded-xl">
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
          <div className="space-y-1.5">
            <Label>تاريخ الاستحقاق</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={issue.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {issue.isPending ? "جارٍ…" : "إعارة"}
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

function LoansTab({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const debounced = useDebounced(search);

  const filters = {
    ...(debounced ? { search: debounced } : {}),
    ...(status !== "all" ? { status } : {}),
  };
  const query = useLoans({ filters, page, page_size: pageSize });
  const returnBook = useReturnBook();

  const rows = query.data?.items ?? [];
  const summary = query.data?.summary ?? {};

  async function markReturned(row: LoanRow, newStatus: "Returned" | "Lost") {
    try {
      await returnBook.mutateAsync({ loan: row.id, status: newStatus });
      toast.success(newStatus === "Returned" ? "تم استلام الكتاب" : "تم تسجيل الكتاب كمفقود");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التحديث");
    }
  }

  const columns: Column<LoanRow>[] = [
    { fieldname: "book_title", label: "الكتاب" },
    { fieldname: "student_name", label: "الطالب" },
    { fieldname: "issue_date", label: "تاريخ الإعارة", numeric: true },
    { fieldname: "due_date", label: "الاستحقاق", numeric: true },
    { fieldname: "return_date", label: "تاريخ الإرجاع", numeric: true, hiddenByDefault: true },
    {
      fieldname: "status",
      label: "الحالة",
      render: (r) => (
        <Pill
          tone={
            r.status_raw === "Returned"
              ? "success"
              : r.status_raw === "Overdue"
                ? "danger"
                : r.status_raw === "Lost"
                  ? "muted"
                  : "info"
          }
        >
          {r.status}
        </Pill>
      ),
    },
    { fieldname: "notes", label: "ملاحظات", hiddenByDefault: true },
  ];

  if (canManage) {
    columns.push({
      fieldname: "actions",
      label: "إجراءات",
      alwaysVisible: true,
      render: (r) =>
        r.status_raw === "Issued" || r.status_raw === "Overdue" ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => markReturned(r, "Returned")}
              className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
            >
              <RotateCcw className="size-3.5" />
              إرجاع
            </button>
            <button
              onClick={() => markReturned(r, "Lost")}
              className="rounded-lg bg-secondary px-2.5 py-1 text-xs text-destructive hover:bg-destructive-soft"
            >
              مفقود
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    });
  }

  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KpiCard label="مُعارة حالياً" value={summary["Issued"] ?? 0} icon={BookOpen} tone="info" />
        <KpiCard label="متأخرة" value={summary["Overdue"] ?? 0} icon={BookOpen} tone="warm" />
        <KpiCard label="أُعيدت" value={summary["Returned"] ?? 0} icon={RotateCcw} tone="accent" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        storageKey="loans"
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="ابحث بالطالب أو الكتاب..."
        page={page}
        pageSize={pageSize}
        total={query.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        exportDataset="loans"
        exportFilters={filters}
        exportTitle="إعارات الكتب"
        emptyTitle="لا توجد إعارات"
        toolbar={
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-[150px] rounded-xl">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="Issued">مُعارة</SelectItem>
              <SelectItem value="Overdue">متأخرة</SelectItem>
              <SelectItem value="Returned">أُعيدت</SelectItem>
              <SelectItem value="Lost">مفقودة</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </>
  );
}

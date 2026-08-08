import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Download, Plus, Receipt, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import type { FeeRow } from "@/lib/api/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyBlock, ErrorState, Skeleton, TableSkeleton } from "@/components/shared/states";
import { QuickInvoiceDialog } from "@/components/shared/quick-invoice-dialog";
import { useApp } from "@/lib/app-context";
import {
  useFeeCollection,
  useFeePayments,
  useFeeFormOptions,
  useFees,
  useRecordPayment,
  useSaveFee,
} from "@/lib/api/hooks";
import { isBackOffice, money, statusMeta } from "@/lib/roles";
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
import { StudentPicker } from "@/components/shared/student-picker";

export const Route = createFileRoute("/app/fees")({
  head: () => ({
    meta: [
      { title: "الرسوم المالية — Match Education" },
      {
        name: "description",
        content: "هيكل الرسوم، فواتير الطلاب، حالة الدفع وتقارير التحصيل بالشيكل.",
      },
      { property: "og:title", content: "الرسوم المالية — Match Education" },
      { property: "og:description", content: "تابع التحصيل والفواتير وحالات الدفع بدقة." },
    ],
  }),
  component: FeesPage,
});

function FeesPage() {
  const { role } = useApp();
  const isAdmin = role === "admin";
  // Raising invoices and taking payments is a back-office job.
  const canBill = isBackOffice(role);
  const [invoicing, setInvoicing] = useState(false);
  const [quickInvoice, setQuickInvoice] = useState(false);
  const [paying, setPaying] = useState<{ id: string; student: string; outstanding: number } | null>(
    null,
  );
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const feesQuery = useFees({
    status: status === "all" ? undefined : status,
    page,
    page_size: perPage,
  });
  // The collection chart is admin-only on the backend.
  const collectionQuery = useFeeCollection(6, isAdmin);

  const items = feesQuery.data?.items ?? [];
  const total = feesQuery.data?.total ?? 0;
  const summary = feesQuery.data?.summary;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const lateCount = collectionQuery.data?.by_status.find((s) => s.status === "late")?.count ?? 0;

  const apiFilters = { ...(status !== "all" ? { status } : {}) };

  const columns: Column<FeeRow>[] = [
    {
      fieldname: "student_name",
      label: "الطالب",
      render: (f) => (
        <div className="flex items-center gap-3">
          <Avatar name={f.student_name ?? ""} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{f.student_name}</p>
            <p className="num text-xs text-muted-foreground">{f.id}</p>
          </div>
        </div>
      ),
    },
    { fieldname: "grade", label: "الصف" },
    { fieldname: "date", label: "تاريخ الإصدار", numeric: true, hiddenByDefault: true },
    { fieldname: "due_date", label: "تاريخ الاستحقاق", numeric: true },
    { fieldname: "term", label: "الفصل", hiddenByDefault: true },
    { fieldname: "total", label: "الإجمالي", numeric: true, render: (f) => money(f.total) },
    {
      fieldname: "paid",
      label: "المدفوع",
      numeric: true,
      render: (f) => <span className="text-success">{money(f.paid)}</span>,
    },
    {
      fieldname: "outstanding",
      label: "المتبقي",
      numeric: true,
      render: (f) => <span className="text-destructive">{money(f.outstanding)}</span>,
    },
    {
      fieldname: "status",
      label: "الحالة",
      render: (f) => (
        <Pill
          tone={
            f.status === "paid"
              ? "success"
              : f.status === "partial"
                ? "warning"
                : f.status === "draft"
                  ? "muted"
                  : "danger"
          }
        >
          {/* Fall back to the raw value: an unrecognised status must never
              take down the whole finance screen. */}
          {statusMeta[f.status]?.label ?? f.status_label ?? f.status}
        </Pill>
      ),
    },
    ...(canBill
      ? [
          {
            fieldname: "actions",
            label: "",
            alwaysVisible: true,
            render: (f: FeeRow) =>
              f.outstanding > 0 ? (
                <button
                  onClick={() =>
                    setPaying({
                      id: f.id,
                      student: f.student_name ?? f.student ?? f.id,
                      outstanding: f.outstanding,
                    })
                  }
                  className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                >
                  تسجيل دفعة
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              ),
          } as Column<FeeRow>,
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={
          role === "student" ? "رسومي" : role === "parent" ? "رسوم الأبناء" : "الرسوم المالية"
        }
        subtitle={
          canBill
            ? "إصدار الفواتير، تسجيل الدفعات، ومتابعة التحصيل"
            : "فواتيرك وحالة السداد"
        }
        actions={
          canBill ? (
            <>
              <button
                onClick={() => setQuickInvoice(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Receipt className="size-4" />
                فاتورة من هيكل الرسوم
              </button>
              <button
                onClick={() => setInvoicing(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-secondary active:translate-y-0"
              >
                <Plus className="size-4" />
                فاتورة يدوية
              </button>
            </>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="إجمالي الرسوم"
          value={money(summary?.total ?? 0)}
          icon={Wallet}
          tone="primary"
        />
        <KpiCard
          label="المُحصّل"
          value={money(summary?.collected ?? 0)}
          icon={CheckCircle2}
          tone="accent"
        />
        <KpiCard
          label="المتبقي"
          value={money(summary?.outstanding ?? 0)}
          icon={AlertCircle}
          tone="warm"
        />
        <KpiCard
          label={isAdmin ? "حالات متأخرة" : "نسبة التحصيل"}
          value={isAdmin ? lateCount : `${summary?.collection_rate ?? 0}%`}
          icon={AlertCircle}
          tone="info"
        />
      </div>

      {isAdmin && (
        <div className="mt-6">
          <SectionCard title="تقرير التحصيل الشهري" description="المُحصّل مقابل المتوقع (₪)">
            {collectionQuery.isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : collectionQuery.error ? (
              <ErrorState error={collectionQuery.error} onRetry={() => collectionQuery.refetch()} />
            ) : (collectionQuery.data?.months.length ?? 0) === 0 ? (
              <EmptyBlock title="لا توجد بيانات تحصيل بعد" />
            ) : (
              <div className="h-[300px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collectionQuery.data!.months}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                        direction: "rtl",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, direction: "rtl" }}
                      formatter={(v) => (v === "collected" ? "المُحصّل" : "المتوقع")}
                    />
                    <Bar
                      dataKey="expected"
                      fill="var(--muted)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={26}
                    />
                    <Bar
                      dataKey="collected"
                      fill="var(--chart-2)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={26}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      <div className="mt-5">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(f) => f.id}
          storageKey="fees"
          isLoading={feesQuery.isLoading}
          isFetching={feesQuery.isFetching}
          error={feesQuery.error}
          onRetry={() => feesQuery.refetch()}
          page={page}
          pageSize={perPage}
          total={total}
          onPageChange={setPage}
          exportDataset="fees"
          exportFilters={apiFilters}
          exportTitle="الرسوم المالية"
          emptyTitle="لا توجد فواتير"
          emptyDescription="لم يتم إصدار أي فواتير مطابقة للفلتر الحالي."
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
                <SelectItem value="paid">مدفوع</SelectItem>
                <SelectItem value="partial">جزئي</SelectItem>
                <SelectItem value="late">متأخر</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </div>
      {invoicing && <InvoiceDialog onClose={() => setInvoicing(false)} />}
      {quickInvoice && <QuickInvoiceDialog onClose={() => setQuickInvoice(false)} />}
      {paying && <PaymentDialog fee={paying} onClose={() => setPaying(null)} />}
    </>
  );
}

/** Raise a fee invoice for one student. */
function InvoiceDialog({ onClose }: { onClose: () => void }) {
  const options = useFeeFormOptions();
  const save = useSaveFee();
  const [student, setStudent] = useState("");
  const [structure, setStructure] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  const chosen = options.data?.structures.find((s) => s.id === structure);

  async function submit() {
    if (!student) {
      toast.error("اختر الطالب");
      return;
    }
    if (!structure) {
      toast.error("اختر هيكل الرسوم");
      return;
    }
    try {
      const result = await save.mutateAsync({
        student,
        fee_structure: structure,
        due_date: dueDate,
      });
      toast.success(`تم إصدار الفاتورة بقيمة ${money(result.grand_total)}`);
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إصدار الفاتورة");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">فاتورة رسوم جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>الطالب</Label>
            <StudentPicker value={student} onChange={setStudent} />
          </div>
          <div className="space-y-1.5">
            <Label>هيكل الرسوم</Label>
            <SearchableSelect
              options={(options.data?.structures ?? []).map((st) => ({
                value: st.id,
                label: [st.program, st.academic_term].filter(Boolean).join(" — ") || st.name,
                code: st.id,
                hint: money(st.total),
              }))}
              value={structure}
              onChange={setStructure}
              placeholder={options.isLoading ? "جارٍ التحميل…" : "اختر هيكل الرسوم"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ الاستحقاق</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="num rounded-xl"
            />
          </div>
          {chosen && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">إجمالي الفاتورة</span>
                <span className="num font-bold">{money(chosen.total)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الإصدار…" : "إصدار الفاتورة"}
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

/** Take a payment against an invoice, and show what has been paid so far. */
function PaymentDialog({
  fee,
  onClose,
}: {
  fee: { id: string; student: string; outstanding: number };
  onClose: () => void;
}) {
  const options = useFeeFormOptions();
  const payments = useFeePayments(fee.id);
  const record = useRecordPayment();

  const [amount, setAmount] = useState(String(fee.outstanding));
  const [mode, setMode] = useState("");
  const [reference, setReference] = useState("");

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    if (value > fee.outstanding) {
      toast.error(`المبلغ أكبر من المتبقي (${money(fee.outstanding)})`);
      return;
    }
    try {
      const result = await record.mutateAsync({
        fees: fee.id,
        amount: value,
        ...(mode ? { mode_of_payment: mode } : {}),
        ...(reference ? { reference_no: reference } : {}),
      });
      toast.success(
        result.outstanding > 0
          ? `تم تسجيل الدفعة — المتبقي ${money(result.outstanding)}`
          : "تم سداد الفاتورة بالكامل",
      );
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر تسجيل الدفعة");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">تسجيل دفعة — {fee.student}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
            <span className="text-sm text-muted-foreground">المبلغ المتبقي</span>
            <span className="num text-lg font-bold text-destructive">
              {money(fee.outstanding)}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>المبلغ</Label>
              <Input
                type="number"
                min={0}
                max={fee.outstanding}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="num rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>طريقة الدفع</Label>
              <SearchableSelect
                options={(options.data?.modes ?? []).map((m) => ({ value: m, label: m }))}
                value={mode}
                onChange={setMode}
                placeholder="اختر الطريقة"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>رقم المرجع (اختياري)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="rounded-xl"
                placeholder="رقم الشيك أو الإيصال"
              />
            </div>
          </div>

          {(payments.data?.length ?? 0) > 0 && (
            <div>
              <Label className="mb-2 block text-xs">الدفعات السابقة</Label>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {payments.data!.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="num text-xs text-muted-foreground">
                      {p.date} {p.mode ? `• ${p.mode}` : ""}
                    </span>
                    <span className="num text-sm font-semibold">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={record.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {record.isPending ? "جارٍ التسجيل…" : "تسجيل الدفعة"}
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

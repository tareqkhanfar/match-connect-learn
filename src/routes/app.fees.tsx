import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Download, Wallet } from "lucide-react";
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
import { useApp } from "@/lib/app-context";
import { useFeeCollection, useFees } from "@/lib/api/hooks";
import { money, statusMeta } from "@/lib/roles";

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
          tone={f.status === "paid" ? "success" : f.status === "partial" ? "warning" : "danger"}
        >
          {statusMeta[f.status].label}
        </Pill>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="الرسوم المالية" subtitle="متابعة التحصيل والفواتير وحالات الدفع" />

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
    </>
  );
}

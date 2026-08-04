import { createFileRoute } from "@tanstack/react-router";
import { Bus, MapPin, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useConfirm } from "@/components/shared/confirm";
import {
  useDeleteRoute,
  useDeleteTransportAssignment,
  useRoutes,
  useSaveRoute,
  useSaveTransportAssignment,
  useStudents,
  useTransportAssignments,
  type RouteRow,
  type TransportAssignmentRow,
} from "@/lib/api/hooks";
import { byRole, isBackOffice, money } from "@/lib/roles";

export const Route = createFileRoute("/app/transport")({
  head: () => ({
    meta: [
      { title: "النقل المدرسي — Match Education" },
      { name: "description", content: "خطوط الباصات والمحطات وإسناد الطلاب." },
    ],
  }),
  component: TransportPage,
});

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function TransportPage() {
  const { role } = useApp();
  const canManage = isBackOffice(role);

  return (
    <>
      <PageHeader title={byRole(role, "النقل المدرسي", { student: "نقلي المدرسي", parent: "نقل الأبناء" })} subtitle="الخطوط والمحطات وإسناد الطلاب" />
      <Tabs defaultValue="routes" dir="rtl">
        <TabsList className="mb-4 h-auto flex-wrap rounded-xl p-1">
          <TabsTrigger value="routes" className="rounded-lg">
            الخطوط
          </TabsTrigger>
          <TabsTrigger value="assignments" className="rounded-lg">
            إسناد الطلاب
          </TabsTrigger>
        </TabsList>
        <TabsContent value="routes">
          <RoutesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab canManage={canManage} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function RoutesTab({ canManage }: { canManage: boolean }) {
  const confirm = useConfirm();
  const query = useRoutes();
  const deleteRoute = useDeleteRoute();
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [creating, setCreating] = useState(false);

  const routes = query.data ?? [];
  const totalSeats = routes.reduce((a, r) => a + r.capacity, 0);
  const assigned = routes.reduce((a, r) => a + r.assigned, 0);

  async function remove(route: RouteRow) {
    const ok = await confirm({
      title: `حذف الخط «${route.route_name}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await deleteRoute.mutateAsync(route.id);
      toast.success("تم حذف الخط");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KpiCard label="عدد الخطوط" value={routes.length} icon={Bus} tone="primary" />
        <KpiCard label="إجمالي المقاعد" value={totalSeats} icon={Users} tone="info" />
        <KpiCard label="الطلاب المسندون" value={assigned} icon={Users} tone="accent" />
      </div>

      {canManage && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Plus className="size-4" />
            خط جديد
          </button>
        </div>
      )}

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={4} />
      ) : routes.length === 0 ? (
        <EmptyBlock title="لا توجد خطوط نقل" icon={<Bus className="size-6" />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {routes.map((r) => {
            const fill = r.capacity ? (r.assigned / r.capacity) * 100 : 0;
            return (
              <div key={r.id} className="card-surface p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{r.route_name}</p>
                    <p className="num truncate text-xs text-muted-foreground">
                      {r.vehicle_number || "—"}
                    </p>
                  </div>
                  <Pill tone={r.active ? "success" : "muted"}>{r.active ? "نشِط" : "متوقف"}</Pill>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>الإشغال</span>
                    <span className="num">
                      {r.assigned}/{r.capacity}
                    </span>
                  </div>
                  <ProgressBar
                    value={fill}
                    tone={fill > 90 ? "danger" : fill > 70 ? "warning" : "success"}
                  />
                </div>

                <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                  <p>السائق: {r.driver_name || "—"}</p>
                  {r.driver_phone && <p className="num">{r.driver_phone}</p>}
                  <p className="num">
                    الذهاب {r.departure_time?.slice(0, 5) || "—"} • العودة{" "}
                    {r.return_time?.slice(0, 5) || "—"}
                  </p>
                  {r.monthly_fee > 0 && <p>الرسوم الشهرية: {money(r.monthly_fee)}</p>}
                </div>

                {r.stops.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.stops.slice(0, 4).map((s) => (
                      <Pill key={s}>
                        <MapPin className="ml-1 inline size-3" />
                        {s}
                      </Pill>
                    ))}
                    {r.stops.length > 4 && <Pill tone="muted">+{r.stops.length - 4}</Pill>}
                  </div>
                )}

                {canManage && (
                  <div className="mt-4 flex gap-2 border-t border-border pt-3">
                    <button
                      onClick={() => setEditing(r)}
                      className="flex-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => remove(r)}
                      className="rounded-lg bg-secondary px-2.5 py-1.5 text-destructive hover:bg-destructive-soft"
                      aria-label="حذف"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <RouteDialog
          route={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function RouteDialog({ route, onClose }: { route: RouteRow | null; onClose: () => void }) {
  const save = useSaveRoute();
  const [form, setForm] = useState({
    route_name: route?.route_name ?? "",
    vehicle_number: route?.vehicle_number ?? "",
    driver_name: route?.driver_name ?? "",
    driver_phone: route?.driver_phone ?? "",
    capacity: String(route?.capacity ?? 30),
    departure_time: route?.departure_time?.slice(0, 5) ?? "07:00",
    return_time: route?.return_time?.slice(0, 5) ?? "14:00",
    monthly_fee: String(route?.monthly_fee ?? 0),
    stops: (route?.stops ?? []).join("\n"),
    active: route ? (route.active ? "1" : "0") : "1",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.route_name.trim()) {
      toast.error("اسم الخط مطلوب");
      return;
    }
    try {
      await save.mutateAsync({
        ...(route ? { id: route.id } : {}),
        ...form,
        capacity: Number(form.capacity) || 0,
        monthly_fee: Number(form.monthly_fee) || 0,
        active: Number(form.active),
        stops: form.stops
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast.success(route ? "تم تحديث الخط" : "تمت إضافة الخط");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{route ? "تعديل الخط" : "خط نقل جديد"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>اسم الخط *</Label>
            <Input
              value={form.route_name}
              onChange={(e) => set("route_name", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>رقم المركبة</Label>
            <Input
              value={form.vehicle_number}
              onChange={(e) => set("vehicle_number", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>السعة</Label>
            <Input
              type="number"
              min={0}
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>اسم السائق</Label>
            <Input
              value={form.driver_name}
              onChange={(e) => set("driver_name", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>هاتف السائق</Label>
            <Input
              value={form.driver_phone}
              onChange={(e) => set("driver_phone", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>وقت الذهاب</Label>
            <Input
              type="time"
              value={form.departure_time}
              onChange={(e) => set("departure_time", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>وقت العودة</Label>
            <Input
              type="time"
              value={form.return_time}
              onChange={(e) => set("return_time", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الرسوم الشهرية</Label>
            <Input
              type="number"
              min={0}
              value={form.monthly_fee}
              onChange={(e) => set("monthly_fee", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select value={form.active} onValueChange={(v) => set("active", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">نشِط</SelectItem>
                <SelectItem value="0">متوقف</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>المحطات (محطة في كل سطر)</Label>
            <Textarea
              value={form.stops}
              onChange={(e) => set("stops", e.target.value)}
              rows={4}
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

function AssignmentsTab({ canManage }: { canManage: boolean }) {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(search);

  const routesQuery = useRoutes();
  const filters = {
    ...(debounced ? { search: debounced } : {}),
    ...(routeFilter !== "all" ? { route: routeFilter } : {}),
  };
  const query = useTransportAssignments({ filters, page, page_size: pageSize });
  const remove = useDeleteTransportAssignment();

  async function unassign(row: TransportAssignmentRow) {
    const ok = await confirm({
      title: `إلغاء إسناد «${row.student_name}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast.success("تم إلغاء الإسناد");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الإلغاء");
    }
  }

  const columns: Column<TransportAssignmentRow>[] = [
    { fieldname: "student_name", label: "الطالب" },
    { fieldname: "route_name", label: "الخط" },
    { fieldname: "stop", label: "المحطة" },
    { fieldname: "start_date", label: "من تاريخ", numeric: true, hiddenByDefault: true },
    { fieldname: "end_date", label: "إلى تاريخ", numeric: true, hiddenByDefault: true },
    {
      fieldname: "active",
      label: "الحالة",
      render: (r) => (
        <Pill tone={r.active ? "success" : "muted"}>{r.active ? "نشِط" : "منتهٍ"}</Pill>
      ),
    },
    { fieldname: "notes", label: "ملاحظات", hiddenByDefault: true },
  ];

  if (canManage) {
    columns.push({
      fieldname: "actions",
      label: "إجراءات",
      alwaysVisible: true,
      render: (r) => (
        <button
          onClick={() => unassign(r)}
          className="rounded-lg bg-secondary px-2 py-1 text-destructive hover:bg-destructive-soft"
          aria-label="إلغاء الإسناد"
        >
          <Trash2 className="size-3.5" />
        </button>
      ),
    });
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(r) => r.id}
        storageKey="transport"
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
        page={page}
        pageSize={pageSize}
        total={query.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        exportDataset="transport"
        exportFilters={filters}
        exportTitle="النقل المدرسي"
        emptyTitle="لا يوجد طلاب مسندون"
        toolbar={
          <>
            <Select
              value={routeFilter}
              onValueChange={(v) => {
                setRouteFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-[180px] rounded-xl">
                <SelectValue placeholder="الخط" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الخطوط</SelectItem>
                {(routesQuery.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.route_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
              >
                <Plus className="size-4" />
                إسناد طالب
              </button>
            )}
          </>
        }
      />

      {creating && <AssignDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function AssignDialog({ onClose }: { onClose: () => void }) {
  const save = useSaveTransportAssignment();
  const routesQuery = useRoutes({ active: 1 });
  const [studentSearch, setStudentSearch] = useState("");
  const debounced = useDebounced(studentSearch);
  const studentsQuery = useStudents({ ...(debounced ? { search: debounced } : {}), page_size: 20 });

  const [form, setForm] = useState({ student: "", route: "", stop: "" });
  const selectedRoute = (routesQuery.data ?? []).find((r) => r.id === form.route);

  async function submit() {
    if (!form.student || !form.route) {
      toast.error("اختر الطالب والخط");
      return;
    }
    try {
      await save.mutateAsync({ ...form, active: 1 });
      toast.success("تم إسناد الطالب");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الإسناد");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">إسناد طالب لخط</DialogTitle>
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
            <Select
              value={form.student}
              onValueChange={(v) => setForm((f) => ({ ...f, student: v }))}
            >
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
            <Label>الخط</Label>
            <Select value={form.route} onValueChange={(v) => setForm((f) => ({ ...f, route: v }))}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختر الخط" />
              </SelectTrigger>
              <SelectContent>
                {(routesQuery.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id} disabled={r.seats_left <= 0}>
                    {r.route_name} ({r.seats_left} مقعد متاح)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedRoute && selectedRoute.stops.length > 0 && (
            <div className="space-y-1.5">
              <Label>المحطة</Label>
              <Select value={form.stop} onValueChange={(v) => setForm((f) => ({ ...f, stop: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="اختر المحطة" />
                </SelectTrigger>
                <SelectContent>
                  {selectedRoute.stops.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ…" : "إسناد"}
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

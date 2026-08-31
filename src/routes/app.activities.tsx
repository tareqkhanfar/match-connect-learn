import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  Plus,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { RichText, RichTextView } from "@/components/shared/rich-text";
import { SearchableSelect } from "@/components/shared/searchable-select";
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
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { byRole, isBackOffice, money } from "@/lib/roles";
import {
  useActivities,
  useActivityOptions,
  useActivityParticipants,
  useDeleteActivity,
  useGiveConsent,
  useMarkActivityAttendance,
  useRegisterActivity,
  useSaveActivity,
  useWithdrawActivity,
  type ActivityRow,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/activities")({
  validateSearch: groupSearch,
  head: () => ({
    meta: [
      { title: "الأنشطة والرحلات — Match Education" },
      {
        name: "description",
        content: "الأنشطة اللاصفية والنوادي والرحلات المدرسية مع التسجيل وموافقة ولي الأمر.",
      },
    ],
  }),
  component: ActivitiesPage,
});

const TYPE_TONE: Record<string, string> = {
  Trip: "bg-info-soft text-info",
  Club: "bg-primary-soft text-primary",
  Competition: "bg-warm-soft text-warm-foreground",
  Sports: "bg-success-soft text-success",
  Workshop: "bg-secondary text-foreground",
};

function ActivitiesPage() {
  const { role } = useApp();
  const staff = isBackOffice(role) || role === "teacher";
  const canManage = isBackOffice(role) || role === "teacher";

  const { group: groupFromUrl } = Route.useSearch();
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<ActivityRow | null>(null);

  const query = useActivities({
    ...(type ? { activity_type: type } : {}),
    ...(search ? { search } : {}),
    page_size: 50,
  });
  const options = useActivityOptions(canManage);
  const remove = useDeleteActivity();
  const confirm = useConfirm();

  const items = query.data?.items ?? [];
  const upcoming = items.filter((a) => a.upcoming);
  const openNow = items.filter((a) => a.open);
  const myCount = items.reduce((a, x) => a + x.my_enrolments.length, 0);
  const awaitingConsent = items.reduce(
    (a, x) => a + x.my_enrolments.filter((e) => e.consent_status === "Pending").length,
    0,
  );

  async function removeActivity(activity: ActivityRow) {
    const ok = await confirm({
      title: `حذف «${activity.title}»؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(activity.id);
      toast.success("تم حذف النشاط");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title={byRole(role, "الأنشطة والرحلات", {
          student: "أنشطتي",
          parent: "أنشطة الأبناء",
        })}
        subtitle={byRole(role, "النوادي والرحلات والمسابقات المدرسية", {
          student: "سجّل في الأنشطة والرحلات المتاحة لك",
          parent: "سجّل أبناءك ووافق على مشاركتهم في الرحلات",
        })}
        actions={
          canManage ? (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="size-4" />
              نشاط جديد
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="أنشطة قادمة" value={upcoming.length} icon={CalendarDays} tone="primary" />
        <KpiCard label="التسجيل مفتوح" value={openNow.length} icon={Ticket} tone="accent" />
        {staff ? (
          <>
            <KpiCard
              label="إجمالي المسجّلين"
              value={items.reduce((a, x) => a + x.registered, 0)}
              icon={Users}
              tone="info"
            />
            <KpiCard
              label="في قائمة الانتظار"
              value={items.reduce((a, x) => a + x.waitlisted, 0)}
              icon={Clock}
              tone="warm"
            />
          </>
        ) : (
          <>
            <KpiCard label="تسجيلاتي" value={myCount} icon={CheckCircle2} tone="info" />
            <KpiCard
              label="بانتظار الموافقة"
              value={awaitingConsent}
              icon={ClipboardList}
              tone="warm"
            />
          </>
        )}
      </div>

      <div className="card-surface my-5 grid gap-3 p-4 md:grid-cols-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن نشاط…"
          className="h-10 rounded-xl"
        />
        <SearchableSelect
          options={(options.data?.types ?? []).map((t) => ({ value: t.code, label: t.label }))}
          value={type}
          onChange={setType}
          placeholder="كل الأنواع"
          clearable
          clearLabel="كل الأنواع"
        />
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyBlock
          title="لا توجد أنشطة"
          description={canManage ? "أنشئ نشاطاً جديداً للبدء." : "سيظهر هنا كل نشاط متاح لك."}
          icon={<Ticket className="size-6" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              staff={staff}
              canManage={canManage}
              onEdit={() => setEditing(a)}
              onDelete={() => removeActivity(a)}
              onView={() => setViewing(a)}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ActivityDialog
          activity={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {viewing && <ParticipantsDialog activity={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function ActivityCard({
  activity: a,
  staff,
  canManage,
  onEdit,
  onDelete,
  onView,
}: {
  activity: ActivityRow;
  staff: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const { role, session } = useApp();
  const register = useRegisterActivity();
  const withdraw = useWithdrawActivity();
  const consent = useGiveConsent();
  const confirm = useConfirm();

  // The child comes from the header switcher, so registering an activity
  // always applies to whoever the parent is currently viewing.
  const child = useViewedStudent();

  async function join() {
    try {
      const result = await register.mutateAsync({
        activity: a.id,
        ...(role === "parent" && child ? { student: child } : {}),
      });
      toast[result.waitlisted ? "warning" : "success"](
        result.waitlisted ? "تمت الإضافة لقائمة الانتظار" : "تم التسجيل في النشاط",
      );
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر التسجيل");
    }
  }

  async function leave(enrolmentId: string, name: string) {
    const ok = await confirm({
      title: `الانسحاب من «${a.title}»؟`,
      description: `سيتم إلغاء تسجيل ${name}.`,
      tone: "warning",
      confirmLabel: "انسحاب",
    });
    if (!ok) return;
    try {
      const result = await withdraw.mutateAsync(enrolmentId);
      toast.success(
        result.promoted ? `تم الانسحاب — ورُقّي ${result.promoted}` : "تم الانسحاب من النشاط",
      );
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الانسحاب");
    }
  }

  async function respond(enrolmentId: string, granted: boolean) {
    try {
      await consent.mutateAsync({ enrolment: enrolmentId, granted: granted ? 1 : 0 });
      toast.success(granted ? "تمت الموافقة على المشاركة" : "تم رفض المشاركة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر تسجيل الموافقة");
    }
  }

  const fillRate = a.capacity ? (a.registered / a.capacity) * 100 : 0;

  return (
    <div className="card-surface flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{a.title}</p>
          <p className="num mt-0.5 text-xs text-muted-foreground">
            {a.start_date}
            {a.from_time ? ` • ${a.from_time.slice(0, 5)}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${
            TYPE_TONE[a.type] ?? "bg-secondary text-foreground"
          }`}
        >
          {a.type_label}
        </span>
      </div>

      <div className="num mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {a.location && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {a.location}
          </span>
        )}
        {a.fee > 0 && <span>الرسوم {money(a.fee)}</span>}
        {a.requires_consent && <Pill tone="warning">تحتاج موافقة ولي الأمر</Pill>}
      </div>

      {a.capacity > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>المقاعد</span>
            <span className="num">
              {a.registered}/{a.capacity}
              {a.waitlisted > 0 ? ` (+${a.waitlisted} انتظار)` : ""}
            </span>
          </div>
          <ProgressBar value={fillRate} tone={a.full ? "danger" : "primary"} />
        </div>
      )}

      {a.description && (
        <div className="mt-3 line-clamp-2 text-xs text-muted-foreground">
          <RichTextView html={a.description} />
        </div>
      )}

      {/* What the viewer's own children are doing with this activity. */}
      {a.my_enrolments.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {a.my_enrolments.map((e) => (
            <li key={e.id} className="rounded-lg bg-secondary/50 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold">{e.student_name}</span>
                <Pill
                  tone={
                    e.status === "Confirmed"
                      ? "success"
                      : e.status === "Waitlisted"
                        ? "warning"
                        : e.status === "Withdrawn"
                          ? "muted"
                          : "info"
                  }
                >
                  {e.status_label}
                </Pill>
              </div>
              {e.consent_status === "Pending" && role === "parent" && (
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => respond(e.id, true)}
                    className="flex-1 rounded-lg bg-success px-2 py-1.5 text-[11px] font-bold text-success-foreground"
                  >
                    أوافق على المشاركة
                  </button>
                  <button
                    onClick={() => respond(e.id, false)}
                    className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold"
                  >
                    رفض
                  </button>
                </div>
              )}
              {e.status !== "Withdrawn" && e.consent_status !== "Pending" && (
                <button
                  onClick={() => leave(e.id, e.student_name)}
                  className="mt-2 w-full rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                >
                  انسحاب
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center gap-2 pt-4">
        {staff ? (
          <>
            <button
              onClick={onView}
              className="flex-1 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
            >
              المشاركون ({a.registered})
            </button>
            {canManage && (
              <>
                <button
                  onClick={onEdit}
                  className="rounded-lg bg-secondary px-2.5 py-2 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
                >
                  تعديل
                </button>
                <button
                  onClick={onDelete}
                  aria-label="حذف"
                  className="rounded-lg bg-secondary px-2.5 py-2 text-destructive hover:bg-destructive-soft"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
          </>
        ) : (
          <div className="w-full space-y-2">
            <button
              onClick={join}
              disabled={!a.open || register.isPending}
              className="w-full rounded-lg bg-brand-gradient px-3 py-2 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!a.open ? "التسجيل مغلق" : a.full ? "مكتمل — الانضمام لقائمة الانتظار" : "سجّل الآن"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityDialog({
  activity,
  onClose,
}: {
  activity: ActivityRow | null;
  onClose: () => void;
}) {
  const options = useActivityOptions();
  const save = useSaveActivity();

  const [form, setForm] = useState({
    title: activity?.title ?? "",
    activity_type: activity?.type ?? "Trip",
    status: activity?.status ?? "Open",
    start_date: activity?.start_date ?? "",
    end_date: activity?.end_date ?? "",
    from_time: activity?.from_time?.slice(0, 5) ?? "",
    to_time: activity?.to_time?.slice(0, 5) ?? "",
    location: activity?.location ?? "",
    capacity: String(activity?.capacity ?? 0),
    fee: String(activity?.fee ?? 0),
    supervisor: activity?.supervisor ?? "",
    target_audience: activity?.audience ?? "All",
    program: activity?.program ?? "",
    student_group: activity?.student_group ?? "",
    registration_deadline: activity?.registration_deadline ?? "",
  });
  const [requiresConsent, setRequiresConsent] = useState(activity?.requires_consent ?? false);
  const [description, setDescription] = useState(activity?.description ?? "");

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.title.trim() || !form.start_date) {
      toast.error("العنوان وتاريخ البداية مطلوبان");
      return;
    }
    try {
      await save.mutateAsync({
        ...(activity ? { id: activity.id } : {}),
        ...form,
        capacity: Number(form.capacity) || 0,
        fee: Number(form.fee) || 0,
        requires_consent: requiresConsent ? 1 : 0,
        description,
        ...(form.from_time ? { from_time: `${form.from_time}:00` } : {}),
        ...(form.to_time ? { to_time: `${form.to_time}:00` } : {}),
      });
      toast.success(activity ? "تم تحديث النشاط" : "تم إنشاء النشاط");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {activity ? "تعديل النشاط" : "نشاط جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>عنوان النشاط</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>النوع</Label>
            <SearchableSelect
              options={(options.data?.types ?? []).map((t) => ({ value: t.code, label: t.label }))}
              value={form.activity_type}
              onChange={(v) => set("activity_type", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <SearchableSelect
              options={(options.data?.statuses ?? []).map((t) => ({
                value: t.code,
                label: t.label,
              }))}
              value={form.status}
              onChange={(v) => set("status", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>تاريخ البداية</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>تاريخ النهاية</Label>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
              className="num rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>من الساعة</Label>
            <Input
              type="time"
              value={form.from_time}
              onChange={(e) => set("from_time", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>إلى الساعة</Label>
            <Input
              type="time"
              value={form.to_time}
              onChange={(e) => set("to_time", e.target.value)}
              className="num rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>المكان</Label>
            <Input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>المشرف</Label>
            <SearchableSelect
              options={(options.data?.supervisors ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              }))}
              value={form.supervisor}
              onChange={(v) => set("supervisor", v)}
              placeholder="اختر المشرف"
              clearable
              clearLabel="بدون مشرف"
            />
          </div>

          <div className="space-y-1.5">
            <Label>السعة (0 = غير محدودة)</Label>
            <Input
              type="number"
              min={0}
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              className="num rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الرسوم</Label>
            <Input
              type="number"
              min={0}
              value={form.fee}
              onChange={(e) => set("fee", e.target.value)}
              className="num rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>مفتوح لـ</Label>
            <SearchableSelect
              options={[
                { value: "All", label: "كل المدرسة" },
                { value: "Program", label: "صف محدد" },
                { value: "Student Group", label: "شعبة محددة" },
              ]}
              value={form.target_audience}
              onChange={(v) => set("target_audience", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>آخر موعد للتسجيل</Label>
            <Input
              type="date"
              value={form.registration_deadline}
              onChange={(e) => set("registration_deadline", e.target.value)}
              className="num rounded-xl"
            />
          </div>

          {form.target_audience === "Program" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الصف</Label>
              <SearchableSelect
                options={(options.data?.programs ?? []).map((p) => ({ value: p, label: p }))}
                value={form.program}
                onChange={(v) => set("program", v)}
              />
            </div>
          )}
          {form.target_audience === "Student Group" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>الشعبة</Label>
              <SearchableSelect
                options={(options.data?.groups ?? []).map((g) => ({ value: g.id, label: g.name }))}
                value={form.student_group}
                onChange={(v) => set("student_group", v)}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">يتطلب موافقة ولي الأمر</p>
              <p className="text-[11px] text-muted-foreground">
                لن يُثبَّت تسجيل الطالب حتى يوافق ولي أمره — مناسب للرحلات.
              </p>
            </div>
            <Switch checked={requiresConsent} onCheckedChange={setRequiresConsent} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>الوصف</Label>
            <RichText value={description} onChange={setDescription} placeholder="تفاصيل النشاط…" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
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

function ParticipantsDialog({ activity, onClose }: { activity: ActivityRow; onClose: () => void }) {
  const { data, isLoading } = useActivityParticipants(activity.id);
  const markAttendance = useMarkActivityAttendance();
  const [attended, setAttended] = useState<Record<string, boolean>>({});

  async function saveAttendance() {
    const entries = Object.entries(attended).map(([id, value]) => ({
      id,
      attended: value ? 1 : 0,
    }));
    if (!entries.length) return;
    try {
      await markAttendance.mutateAsync(entries);
      toast.success("تم حفظ الحضور");
      setAttended({});
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر حفظ الحضور");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">المشاركون — {activity.title}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">مؤكد</p>
                <p className="num mt-1 text-lg font-bold text-success">{data?.confirmed ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">قائمة الانتظار</p>
                <p className="num mt-1 text-lg font-bold text-warning">{data?.waitlisted ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">بانتظار الموافقة</p>
                <p className="num mt-1 text-lg font-bold">{data?.awaiting_consent ?? 0}</p>
              </div>
            </div>

            {(data?.rows.length ?? 0) === 0 ? (
              <EmptyBlock title="لم يسجّل أحد بعد" />
            ) : (
              <ul className="divide-y divide-border">
                {data!.rows.map((r) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.student_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.status_label}
                        {activity.requires_consent ? ` • ${r.consent_label}` : ""}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={attended[r.id] ?? r.attended}
                        onChange={(e) => setAttended((s) => ({ ...s, [r.id]: e.target.checked }))}
                        className="size-4 accent-primary"
                      />
                      حضر
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={saveAttendance}
            disabled={markAttendance.isPending || Object.keys(attended).length === 0}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {markAttendance.isPending ? "جارٍ الحفظ…" : "حفظ الحضور"}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

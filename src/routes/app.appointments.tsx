import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  Inbox,
  MapPin,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/shared/confirm";
import { errorMessage } from "@/lib/api/error-message";
import { useApp } from "@/lib/app-context";
import {
  useAppointments,
  useAvailability,
  useBookAppointment,
  useBookableStaff,
  useMyChildren,
  useMyOfficeHours,
  useSaveOfficeHours,
  useSetAppointmentStatus,
  type Appointment,
  type OfficeHour,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/appointments")({
  component: AppointmentsPage,
});

const DAYS = [
  { key: "Sunday", label: "الأحد" },
  { key: "Monday", label: "الإثنين" },
  { key: "Tuesday", label: "الثلاثاء" },
  { key: "Wednesday", label: "الأربعاء" },
  { key: "Thursday", label: "الخميس" },
  { key: "Friday", label: "الجمعة" },
  { key: "Saturday", label: "السبت" },
];

function AppointmentsPage() {
  const { role } = useApp();
  const isStaff = role === "admin" || role === "secretary" || role === "teacher";
  // Staff live in their queue; a family comes here to book, so each lands on
  // the tab they actually came for.
  const [tab, setTab] = useState<"queue" | "book" | "hours">(isStaff ? "queue" : "book");

  const tabs = [
    { key: "queue" as const, label: "مواعيدي", show: true },
    { key: "book" as const, label: "حجز موعد", show: true },
    { key: "hours" as const, label: "ساعاتي المكتبية", show: isStaff },
  ].filter((t) => t.show);

  return (
    <>
      <PageHeader
        title="المواعيد والساعات المكتبية"
        subtitle={
          isStaff
            ? "حدّد أوقات استقبالك، وتابع طلبات المواعيد الواردة إليك."
            : "احجز موعداً مع معلّمي أبنائك أو مع إدارة المدرسة ضمن أوقاتهم المتاحة."
        }
      />

      <div className="mb-5 flex gap-1 rounded-xl border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              tab === t.key
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "queue" && <AppointmentQueue />}
      {tab === "book" && <BookingTab />}
      {tab === "hours" && isStaff && <OfficeHoursEditor />}
    </>
  );
}

/* -------------------------------------------------------------------------
 * The queue
 * ---------------------------------------------------------------------- */

function AppointmentQueue() {
  const [status, setStatus] = useState<string>("");
  const { data, isLoading } = useAppointments("all", status || undefined);
  const setAppointmentStatus = useSetAppointmentStatus();
  const confirm = useConfirm();
  const [declining, setDeclining] = useState<Appointment | null>(null);

  const rows = data?.appointments ?? [];
  const counts = data?.counts;

  async function decide(row: Appointment, next: string) {
    if (next === "Cancelled") {
      const ok = await confirm({
        title: "إلغاء الموعد؟",
        description: `${row.staff_name} — ${row.date} الساعة ${row.from_time}`,
        confirmLabel: "إلغاء الموعد",
        tone: "danger",
      });
      if (!ok) return;
    }
    try {
      await setAppointmentStatus.mutateAsync({ appointment: row.id, status: next });
      toast.success(next === "Cancelled" ? "تم إلغاء الموعد." : "تم تحديث الموعد.");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر إتمام العملية."));
    }
  }

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <CountCard
          label="بانتظار ردّك"
          value={counts?.awaiting_me ?? 0}
          icon={<Inbox className="size-4" />}
          tone="warning"
        />
        <CountCard
          label="مواعيد مؤكَّدة قادمة"
          value={counts?.upcoming ?? 0}
          icon={<Check className="size-4" />}
          tone="success"
        />
        <CountCard
          label="طلباتي المفتوحة"
          value={counts?.mine_open ?? 0}
          icon={<Clock className="size-4" />}
          tone="primary"
        />
      </div>

      <SectionCard
        title="المواعيد"
        actions={
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="Requested">بانتظار الموافقة</SelectItem>
              <SelectItem value="Confirmed">مؤكَّد</SelectItem>
              <SelectItem value="Declined">معتذَر عنه</SelectItem>
              <SelectItem value="Cancelled">ملغى</SelectItem>
              <SelectItem value="Completed">تم</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : rows.length === 0 ? (
          <EmptyBlock
            title="لا توجد مواعيد"
            description="لم يُحجز أي موعد بعد ضمن هذه الحالة."
            icon={<CalendarClock className="size-6" />}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="grid w-16 shrink-0 place-items-center rounded-xl border border-border bg-secondary/40 p-2">
                  <span className="text-[10px] text-muted-foreground">{row.day_label}</span>
                  <span className="num text-sm font-bold">{row.from_time}</span>
                  <span className="num text-[10px] text-muted-foreground">{row.date.slice(5)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{row.subject}</span>
                    <Pill tone={row.status_tone as never}>{row.status_label}</Pill>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.is_staff ? `طلبه: ${row.requester_name}` : `مع: ${row.staff_name}`}
                    {row.student_name ? ` · بخصوص ${row.student_name}` : ""}
                    {row.location ? ` · ${row.location}` : ""}
                  </p>
                  {row.notes && <p className="mt-1 text-xs text-foreground/80">{row.notes}</p>}
                  {row.decline_reason && (
                    <p className="mt-1 text-xs text-destructive">
                      سبب الاعتذار: {row.decline_reason}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1.5">
                  {row.can_decide && (
                    <>
                      <button
                        onClick={() => void decide(row, "Confirmed")}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                      >
                        <Check className="ms-1 inline size-3.5" />
                        تأكيد
                      </button>
                      <button
                        onClick={() => setDeclining(row)}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        <X className="ms-1 inline size-3.5" />
                        اعتذار
                      </button>
                    </>
                  )}
                  {row.is_staff && row.status === "Confirmed" && (
                    <button
                      onClick={() => void decide(row, "Completed")}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                    >
                      تم اللقاء
                    </button>
                  )}
                  {row.can_cancel && (
                    <button
                      onClick={() => void decide(row, "Cancelled")}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {declining && <DeclineDialog appointment={declining} onClose={() => setDeclining(null)} />}
    </>
  );
}

function DeclineDialog({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const setAppointmentStatus = useSetAppointmentStatus();

  async function submit() {
    if (!reason.trim()) {
      toast.error("يرجى ذكر سبب الاعتذار.");
      return;
    }
    try {
      await setAppointmentStatus.mutateAsync({
        appointment: appointment.id,
        status: "Declined",
        reason: reason.trim(),
      });
      toast.success("تم الاعتذار عن الموعد.");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر إتمام العملية."));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>الاعتذار عن الموعد</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {appointment.requester_name} — {appointment.date} الساعة {appointment.from_time}
          </p>
          <div>
            <Label>سبب الاعتذار</Label>
            {/* Required by the server too: an unexplained refusal sends the
                family back to the phone, which is what this replaced. */}
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: لديّ اجتماع في هذا الوقت — يرجى اختيار موعد آخر."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            تراجع
          </button>
          <button
            onClick={() => void submit()}
            disabled={setAppointmentStatus.isPending}
            className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            إرسال الاعتذار
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
 * Booking
 * ---------------------------------------------------------------------- */

function BookingTab() {
  const { role } = useApp();
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState<string>("");
  const { data: dir, isLoading } = useBookableStaff(search || undefined);
  const { data: avail, isLoading: loadingSlots } = useAvailability(staff || undefined);
  const [slot, setSlot] = useState<{ date: string; from_time: string } | null>(null);

  const list = dir?.staff ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <SectionCard title="مع من؟">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم…"
          className="mb-3"
        />
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : list.length === 0 ? (
          <EmptyBlock
            title="لا يوجد من يمكن حجز موعد معه"
            description={
              role === "student" || role === "parent"
                ? "تظهر هنا أسماء معلّمي صفوفك وإدارة المدرسة."
                : "لم يُعثر على موظفين مطابقين."
            }
            icon={<User className="size-6" />}
          />
        ) : (
          <ul className="-mx-2 max-h-[26rem] space-y-1 overflow-y-auto">
            {list.map((s) => (
              <li key={s.user}>
                <button
                  onClick={() => {
                    setStaff(s.user);
                    setSlot(null);
                  }}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-start transition-colors",
                    staff === s.user
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-secondary",
                  )}
                >
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {s.subjects.length > 0 ? s.subjects.join("، ") : "إدارة المدرسة"}
                  </p>
                  {/* Someone with no published hours cannot be booked, and
                      saying so here saves a click into an empty week. */}
                  {!s.has_hours && (
                    <span className="mt-1 inline-block text-[10px] text-muted-foreground">
                      لم يحدّد ساعات استقبال بعد
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={staff ? `الأوقات المتاحة — ${avail?.staff_name ?? ""}` : "الأوقات المتاحة"}
      >
        {!staff ? (
          <EmptyBlock
            title="اختر الموظف أولاً"
            description="ستظهر هنا الأوقات المتاحة خلال الأسبوعين القادمين."
            icon={<CalendarDays className="size-6" />}
          />
        ) : loadingSlots ? (
          <TableSkeleton rows={4} />
        ) : !avail?.has_hours ? (
          <EmptyBlock
            title="لا توجد ساعات مكتبية"
            description="لم يحدّد هذا الموظف أوقات استقبال بعد."
            icon={<Clock className="size-6" />}
          />
        ) : avail.days.length === 0 ? (
          <EmptyBlock
            title="لا توجد أوقات متاحة"
            description="كل المواعيد محجوزة خلال الفترة القادمة — جرّب لاحقاً."
            icon={<Clock className="size-6" />}
          />
        ) : (
          <div className="space-y-4">
            {avail.days.map((day) => (
              <div key={day.date}>
                <p className="mb-2 text-xs font-bold text-muted-foreground">
                  {day.day_label} <span className="num">{day.date}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {day.slots.map((s) => (
                    <button
                      key={`${day.date}-${s.from_time}`}
                      onClick={() => setSlot({ date: day.date, from_time: s.from_time })}
                      className="num rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-primary hover:bg-primary/10"
                    >
                      {s.from_time}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {slot && staff && (
        <BookDialog
          staff={staff}
          staffName={avail?.staff_name ?? ""}
          date={slot.date}
          fromTime={slot.from_time}
          onClose={() => setSlot(null)}
        />
      )}
    </div>
  );
}

function BookDialog({
  staff,
  staffName,
  date,
  fromTime,
  onClose,
}: {
  staff: string;
  staffName: string;
  date: string;
  fromTime: string;
  onClose: () => void;
}) {
  const { role } = useApp();
  const isFamily = role === "student" || role === "parent";
  const { data: children } = useMyChildren();
  const book = useBookAppointment();
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [student, setStudent] = useState("");

  const kids = children?.students ?? [];

  async function submit() {
    if (!subject.trim()) {
      toast.error("يرجى ذكر سبب الموعد.");
      return;
    }
    try {
      await book.mutateAsync({
        staff_user: staff,
        date,
        from_time: fromTime,
        subject: subject.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(student ? { student } : {}),
      });
      toast.success("تم إرسال طلب الموعد.");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر إتمام العملية."));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>طلب موعد</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
            <p className="font-semibold">{staffName}</p>
            <p className="num mt-0.5 text-xs text-muted-foreground">
              {date} — الساعة {fromTime}
            </p>
          </div>

          {isFamily && kids.length > 1 && (
            <div>
              <Label>بخصوص الطالب</Label>
              <Select value={student} onValueChange={setStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الطالب" />
                </SelectTrigger>
                <SelectContent>
                  {kids.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>سبب الموعد</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثال: متابعة مستوى الرياضيات"
            />
          </div>
          <div>
            <Label>تفاصيل (اختياري)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            تراجع
          </button>
          <button
            onClick={() => void submit()}
            disabled={book.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            تأكيد الطلب
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
 * The weekly grid a member of staff declares
 * ---------------------------------------------------------------------- */

function OfficeHoursEditor() {
  const { data, isLoading } = useMyOfficeHours();
  const save = useSaveOfficeHours();
  const [rows, setRows] = useState<OfficeHour[] | null>(null);

  // The saved grid until the reader touches it; their edits after that.
  const hours = rows ?? data?.hours ?? [];
  const lessonsByDay = useMemo(() => {
    const map: Record<string, NonNullable<typeof data>["teaching"]> = {};
    for (const t of data?.teaching ?? []) (map[t.day] ||= []).push(t);
    return map;
  }, [data]);

  function update(index: number, patch: Partial<OfficeHour>) {
    setRows(hours.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  function add(day: string) {
    setRows([
      ...hours,
      {
        day,
        from_time: "10:00",
        to_time: "11:00",
        slot_minutes: 15,
        location: null,
        is_active: true,
        allow_students: true,
        allow_guardians: true,
        notes: null,
      },
    ]);
  }

  async function submit() {
    try {
      await save.mutateAsync({ hours });
      toast.success("تم حفظ الساعات المكتبية.");
      setRows(null);
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر إتمام العملية."));
    }
  }

  if (isLoading) return <TableSkeleton rows={6} />;

  return (
    <SectionCard
      title="ساعاتي المكتبية"
      description="حدّد أوقات استقبالك أسبوعياً. تُطرح منها الحصص التي تدرّسها والمواعيد المحجوزة تلقائياً."
      actions={
        <button
          onClick={() => void submit()}
          disabled={save.isPending || rows === null}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          حفظ
        </button>
      }
    >
      <div className="space-y-4">
        {DAYS.map((day) => {
          const dayRows = hours.map((h, i) => ({ h, i })).filter(({ h }) => h.day === day.key);
          const lessons = lessonsByDay[day.key] ?? [];
          return (
            <div key={day.key} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold">{day.label}</p>
                <button
                  onClick={() => add(day.key)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-secondary"
                >
                  <Plus className="size-3.5" />
                  فترة
                </button>
              </div>

              {/* What the teacher is already teaching that day, so they do not
                  declare themselves free during their own lesson. */}
              {lessons.length > 0 && (
                <p className="mb-2 text-[11px] text-muted-foreground">
                  حصصك: {lessons.map((l) => `${l.from_time}–${l.to_time}`).join("، ")}
                </p>
              )}

              {dayRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد فترات استقبال.</p>
              ) : (
                <ul className="space-y-2">
                  {dayRows.map(({ h, i }) => (
                    <li
                      key={i}
                      className="grid gap-2 rounded-lg bg-secondary/40 p-2.5 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
                    >
                      <div>
                        <Label className="text-[11px]">من</Label>
                        <Input
                          type="time"
                          value={h.from_time}
                          onChange={(e) => update(i, { from_time: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">إلى</Label>
                        <Input
                          type="time"
                          value={h.to_time}
                          onChange={(e) => update(i, { to_time: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">مدة الموعد (دقيقة)</Label>
                        <Input
                          type="number"
                          min={5}
                          max={120}
                          value={h.slot_minutes}
                          onChange={(e) =>
                            update(i, { slot_minutes: Number(e.target.value) || 15 })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">المكان</Label>
                        <Input
                          value={h.location ?? ""}
                          onChange={(e) => update(i, { location: e.target.value })}
                          placeholder="غرفة المعلمين"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => setRows(hours.filter((_, j) => j !== i))}
                          className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"
                          aria-label="حذف الفترة"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 sm:col-span-5">
                        <label className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={h.allow_students}
                            onCheckedChange={(v) => update(i, { allow_students: v })}
                          />
                          يحجز الطلاب
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={h.allow_guardians}
                            onCheckedChange={(v) => update(i, { allow_guardians: v })}
                          />
                          يحجز أولياء الأمور
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={h.is_active}
                            onCheckedChange={(v) => update(i, { is_active: v })}
                          />
                          مفعّلة
                        </label>
                        {h.location && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="size-3" />
                            {h.location}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function CountCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          tone === "warning" && "bg-warning/15 text-warning",
          tone === "success" && "bg-success/15 text-success",
          tone === "primary" && "bg-primary/15 text-primary",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="num text-xl font-black">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CalendarOff, PartyPopper, Plus, Trash2 } from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthView, WeekView, toKey, type CalendarEntry } from "@/components/shared/calendar-views";
import { useDeleteHoliday, useHolidays, useSaveHoliday, type HolidayRow } from "@/lib/api/hooks";

export const Route = createFileRoute("/app/calendar")({
  head: () => ({
    meta: [
      { title: "التقويم الدراسي — Match Education" },
      {
        name: "description",
        content: "العطل الرسمية والإجازات المدرسية، وأثرها على الحصص والامتحانات والحضور.",
      },
    ],
  }),
  component: CalendarPage,
});

const DATE = new Intl.DateTimeFormat("ar", { dateStyle: "full" });

function niceDate(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : DATE.format(d);
}

function CalendarPage() {
  const query = useHolidays();
  const save = useSaveHoliday();
  const remove = useDeleteHoliday();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<HolidayRow | "new" | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [cursor, setCursor] = useState(() => new Date());

  // `?? []` builds a new array every render, so every memo downstream
  // recomputed on each one. Memoised so the identity is stable.
  const holidays = useMemo(() => query.data?.holidays ?? [], [query.data]);
  const canEdit = query.data?.canEdit ?? false;

  const { upcoming, past, weekly, oneOff } = useMemo(() => {
    return {
      upcoming: holidays.filter((h) => !h.past),
      past: holidays.filter((h) => h.past),
      weekly: holidays.filter((h) => h.weeklyOff),
      oneOff: holidays.filter((h) => !h.weeklyOff),
    };
  }, [holidays]);

  const visible = showPast ? holidays : upcoming;

  /** date -> entry, so a calendar cell is a map lookup rather than a scan. */
  const entries = useMemo(() => {
    const map = new Map<string, CalendarEntry>();
    for (const h of holidays) {
      map.set(h.date, {
        date: h.date,
        label: h.description || (h.weeklyOff ? "عطلة أسبوعية" : "عطلة"),
        weeklyOff: h.weeklyOff,
      });
    }
    return map;
  }, [holidays]);

  const todayKey = toKey(new Date());

  function moveCursor(delta: number) {
    setCursor((prev) => {
      const next = new Date(prev);
      if (view === "week") next.setDate(next.getDate() + delta * 7);
      else next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  /** Clicking a day opens the editor for it — add, or edit what is there. */
  function pickDay(key: string) {
    if (!canEdit) return;
    const existing = holidays.find((h) => h.date === key && !h.weeklyOff);
    if (existing) {
      setEditing(existing);
    } else if (entries.get(key)?.weeklyOff) {
      // A weekly off is generated from the list's own rule, not a row to edit.
      toast.info("هذه عطلة أسبوعية تُدار من إعدادات قائمة العطل.");
    } else {
      setEditing({ id: "", date: key, description: "", weeklyOff: false, past: false });
    }
  }

  async function removeHoliday(h: HolidayRow) {
    const ok = await confirm({
      title: "حذف هذه العطلة؟",
      description: `${niceDate(h.date)} — ${h.description ?? "عطلة"}. سيصبح هذا اليوم يوم دوام عادي.`,
    });
    if (!ok) return;
    try {
      const res = await remove.mutateAsync(h.id);
      toast.success(res.message_ar || "تم الحذف");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title="التقويم الدراسي"
        subtitle="العطل الرسمية والإجازات. تنعكس تلقائياً على الحضور والحصص والامتحانات."
        actions={
          canEdit ? (
            <button
              onClick={() => setEditing("new")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
            >
              <Plus className="size-4" />
              إضافة عطلة
            </button>
          ) : null
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="إجمالي أيام العطل"
          value={holidays.length}
          icon={CalendarDays}
          tone="primary"
        />
        <KpiCard label="عطل قادمة" value={upcoming.length} icon={PartyPopper} tone="accent" />
        <KpiCard label="عطل رسمية" value={oneOff.length} icon={CalendarOff} tone="warm" />
        <KpiCard label="عطل أسبوعية" value={weekly.length} icon={CalendarDays} tone="info" />
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm">
        <CalendarOff className="mt-0.5 size-4 shrink-0 text-info" />
        <p className="leading-relaxed text-info">
          في أيام العطل لا يمكن تسجيل الحضور، ولا جدولة امتحانات، ولا توليد حصص — يتخطاها النظام
          تلقائياً عند بناء الجدول.
        </p>
      </div>

      <div className="mt-6">
        <SectionCard
          title={
            view === "list"
              ? showPast
                ? `كل العطل (${holidays.length})`
                : `العطل القادمة (${upcoming.length})`
              : "التقويم"
          }
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border p-0.5">
                {(
                  [
                    ["month", "شهري"],
                    ["week", "أسبوعي"],
                    ["list", "قائمة"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setView(value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      view === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {view !== "list" && (
                <button
                  onClick={() => setCursor(new Date())}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                >
                  اليوم
                </button>
              )}
              {view === "list" && past.length > 0 && (
                <button
                  onClick={() => setShowPast((v) => !v)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                >
                  {showPast ? "إخفاء السابقة" : `عرض السابقة (${past.length})`}
                </button>
              )}
            </div>
          }
        >
          {query.error ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : query.isLoading ? (
            <TableSkeleton rows={6} />
          ) : view === "month" ? (
            <MonthView
              cursor={cursor}
              entries={entries}
              today={todayKey}
              onMove={moveCursor}
              {...(canEdit ? { onPick: pickDay } : {})}
            />
          ) : view === "week" ? (
            <WeekView
              cursor={cursor}
              entries={entries}
              today={todayKey}
              onMove={moveCursor}
              {...(canEdit ? { onPick: pickDay } : {})}
            />
          ) : visible.length === 0 ? (
            <EmptyBlock
              title="لا توجد عطل"
              description="أضف العطل الرسمية ليتم استثناؤها من الحضور والجدول والامتحانات."
              icon={<CalendarDays className="size-6" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 pl-4 font-medium">التاريخ</th>
                    <th className="py-2 pl-4 font-medium">المناسبة</th>
                    <th className="py-2 pl-4 font-medium">النوع</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((h) => (
                    <tr
                      key={h.id}
                      className={`border-b border-border/60 last:border-0 ${
                        h.past ? "opacity-55" : ""
                      }`}
                    >
                      <td className="py-2.5 pl-4">
                        <span className="font-medium">{niceDate(h.date)}</span>
                        <span
                          className="block text-[11px] tabular-nums text-muted-foreground"
                          dir="ltr"
                        >
                          {h.date}
                        </span>
                      </td>
                      <td className="py-2.5 pl-4">{h.description || "عطلة"}</td>
                      <td className="py-2.5 pl-4">
                        {h.weeklyOff ? (
                          <Pill tone="muted">أسبوعية</Pill>
                        ) : (
                          <Pill tone="warning">رسمية</Pill>
                        )}
                      </td>
                      <td className="py-2.5">
                        {canEdit && !h.weeklyOff && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditing(h)}
                              className="rounded-lg border border-border px-2 py-1 text-[11px] transition-colors hover:bg-secondary"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => removeHoliday(h)}
                              disabled={remove.isPending}
                              className="grid size-7 place-items-center rounded-lg border border-destructive/30 text-destructive transition-colors hover:bg-destructive-soft disabled:opacity-50"
                              aria-label="حذف"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {editing && (
        <HolidayDialog
          holiday={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (vars) => {
            try {
              const res = await save.mutateAsync(vars);
              toast.success(res.message_ar || "تم الحفظ");
              setEditing(null);
            } catch (err) {
              toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
            }
          }}
          saving={save.isPending}
        />
      )}
    </>
  );
}

function HolidayDialog({
  holiday,
  onClose,
  onSave,
  saving,
}: {
  holiday: HolidayRow | null;
  onClose: () => void;
  onSave: (vars: { date: string; description?: string; holiday?: string }) => Promise<void>;
  saving: boolean;
}) {
  const [date, setDate] = useState(holiday?.date ?? "");
  const [description, setDescription] = useState(holiday?.description ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      toast.error("يجب تحديد التاريخ");
      return;
    }
    void onSave({
      date,
      ...(description ? { description } : {}),
      ...(holiday?.id ? { holiday: holiday.id } : {}),
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{holiday?.id ? "تعديل العطلة" : "إضافة عطلة"}</DialogTitle>
          <DialogDescription>
            سيتم استثناء هذا اليوم من الحضور والحصص والامتحانات في جميع أنحاء النظام.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hol-date">التاريخ</Label>
            <Input
              id="hol-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-xl"
              dir="ltr"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hol-desc">المناسبة</Label>
            <Input
              id="hol-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: عيد الفطر"
              className="h-11 rounded-xl"
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

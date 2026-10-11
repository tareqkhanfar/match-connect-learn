import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  BellRing,
  CalendarDays,
  CalendarOff,
  FileCheck2,
  MapPin,
  Plus,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  MonthView,
  WeekView,
  addDays,
  parseDay,
  startOfWeek,
  toKey,
  type CalendarEntry,
} from "@/components/shared/calendar-views";
import { ColorPicker } from "@/components/workspaces/pickers";
import { errorMessage } from "@/lib/api/error-message";
import {
  useAgendaEvents,
  useAgendaOptions,
  useDeleteAgendaEvent,
  useDeleteAgendaType,
  useSaveAgendaEvent,
  useSaveAgendaType,
  type AgendaAudience,
  type AgendaEvent,
  type AgendaEventPayload,
  type AgendaOptions,
  type AgendaType,
} from "@/lib/api/agenda";
import { cn } from "@/lib/utils";
import { wsColor } from "@/lib/workspace-icons";

export const Route = createFileRoute("/app/calendar")({
  head: () => ({
    meta: [
      { title: "التقويم الدراسي والأجندة — Match Education" },
      {
        name: "description",
        content:
          "أجندة المدرسة: العطل والامتحانات والأنشطة والرحلات والاجتماعات، وأثرها على الدوام.",
      },
    ],
  }),
  component: CalendarPage,
});

const DATE = new Intl.DateTimeFormat("ar", { dateStyle: "full" });
const MONTH = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" });

function niceDate(value: string): string {
  const d = parseDay(value);
  return Number.isNaN(d.getTime()) ? value : DATE.format(d);
}

function span(ev: AgendaEvent) {
  const when = ev.from === ev.to ? niceDate(ev.from) : `${niceDate(ev.from)} — ${niceDate(ev.to)}`;
  return ev.allDay || !ev.fromTime ? when : `${when} · ${ev.fromTime}–${ev.toTime}`;
}

/** The days an event covers, as keys. */
function daysOf(ev: AgendaEvent): string[] {
  const out: string[] = [];
  let d = parseDay(ev.from);
  const end = parseDay(ev.to || ev.from);
  for (let i = 0; i < 130 && d <= end; i++) {
    out.push(toKey(d));
    d = addDays(d, 1);
  }
  return out;
}

const EFFECT_LABELS: Array<[keyof AgendaType, string, typeof Ban]> = [
  ["closes_school", "عطلة: لا حضور ولا حصص ولا امتحانات", Ban],
  ["no_lessons", "تُعلَّق حصص الفئة المعنية", CalendarOff],
  ["exam_period", "فترة امتحانات", FileCheck2],
  ["staff_only", "للطاقم فقط", Users],
  ["notify", "تنبيه الفئة عند الإضافة", BellRing],
];

/**
 * التقويم الدراسي — the school's agenda.
 *
 * Every day can hold events of a type — a holiday, exams, an activity, a
 * trip, a meeting — and the type says what the event does: a holiday closes
 * the day for attendance, lessons and exams; a trip suspends the section's
 * lessons; an exam period shows in exam scheduling. The office edits it;
 * everyone else sees what is theirs.
 */
function CalendarPage() {
  const options = useAgendaOptions();
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showWeekly, setShowWeekly] = useState(true);
  const [editing, setEditing] = useState<AgendaEventPayload | null>(null);
  const [viewing, setViewing] = useState<AgendaEvent | null>(null);
  const [managing, setManaging] = useState(false);

  // The query window: a month view's six weeks, a week, or the next months.
  const range = useMemo(() => {
    if (view === "list") {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      return { from: toKey(from), to: toKey(addDays(from, 190)) };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = view === "week" ? startOfWeek(cursor) : startOfWeek(first);
    return { from: toKey(start), to: toKey(addDays(start, view === "week" ? 7 : 42)) };
  }, [view, cursor]);

  const query = useAgendaEvents(range.from, range.to);
  const canEdit = options.data?.canEdit ?? false;
  const types = useMemo(() => options.data?.types ?? [], [options.data]);
  const typeMap = useMemo(() => new Map(types.map((t) => [t.key, t])), [types]);

  const events = useMemo(
    () =>
      (query.data?.events ?? []).filter(
        (e) => !hidden.has(e.type) && (showWeekly || e.source !== "weekly"),
      ),
    [query.data, hidden, showWeekly],
  );

  const entries = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const ev of events) {
      for (const key of daysOf(ev)) {
        const list = map.get(key) ?? [];
        list.push({
          id: `${ev.source}:${ev.id}:${key}`,
          date: key,
          label: ev.status === "مبدئي" ? `${ev.title} (مبدئي)` : ev.title,
          color: ev.color,
          weeklyOff: ev.source === "weekly",
          closed: !!ev.closesSchool,
        });
        map.set(key, list);
      }
    }
    return map;
  }, [events]);

  const byEntryId = useMemo(() => {
    const m = new Map<string, AgendaEvent>();
    for (const ev of events) m.set(`${ev.source}:${ev.id}`, ev);
    return m;
  }, [events]);

  const todayKey = toKey(new Date());

  function moveCursor(delta: number) {
    setCursor((prev) => {
      const next = new Date(prev);
      if (view === "week") next.setDate(next.getDate() + delta * 7);
      else next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  function blank(date: string): AgendaEventPayload {
    const first = types.find((t) => t.isActive) ?? types[0];
    return {
      title: "",
      type: first?.key ?? "",
      status: "مؤكد",
      from: date,
      to: date,
      allDay: 1,
      fromTime: "",
      toTime: "",
      audience: "school",
      groups: [],
      programs: [],
      location: "",
      description: "",
      noLessons: 0,
      notify: 1,
    };
  }

  function open(ev: AgendaEvent) {
    if (canEdit && ev.source === "event") {
      setEditing({
        id: ev.id,
        title: ev.title,
        type: ev.type,
        status: ev.status,
        from: ev.from,
        to: ev.to,
        allDay: ev.allDay,
        fromTime: ev.fromTime,
        toTime: ev.toTime,
        audience: ev.audience,
        groups: ev.groups,
        programs: ev.programs,
        location: ev.location,
        description: ev.description,
        noLessons: ev.noLessons && !typeMap.get(ev.type)?.no_lessons ? 1 : 0,
        notify: 0,
      });
    } else setViewing(ev);
  }

  function openEntry(entry: CalendarEntry) {
    const [source, id] = entry.id.split(":");
    const ev = byEntryId.get(`${source}:${id}`);
    if (ev) open(ev);
  }

  const upcomingClosed = useMemo(() => {
    const limit = toKey(addDays(new Date(), 30));
    const days = new Set<string>();
    for (const ev of query.data?.events ?? []) {
      if (!ev.closesSchool || ev.source === "weekly") continue;
      for (const d of daysOf(ev)) if (d >= todayKey && d <= limit) days.add(d);
    }
    return days.size;
  }, [query.data, todayKey]);

  const nextEvent = useMemo(
    () => (query.data?.events ?? []).find((e) => e.source === "event" && e.to >= todayKey),
    [query.data, todayKey],
  );

  if (options.isLoading) return <TableSkeleton rows={6} />;
  if (options.error) return <ErrorState error={options.error} onRetry={() => options.refetch()} />;

  const listEvents = events.filter((e) => e.source !== "weekly" && e.to >= todayKey);
  const months = new Map<string, AgendaEvent[]>();
  for (const ev of listEvents) {
    const label = MONTH.format(parseDay(ev.from));
    months.set(label, [...(months.get(label) ?? []), ev]);
  }

  return (
    <>
      <PageHeader
        title="التقويم الدراسي والأجندة"
        subtitle="العطل والامتحانات والأنشطة والرحلات والاجتماعات — ولكل نوع أثره على الدوام"
        actions={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setManaging(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-secondary"
              >
                <Settings2 className="size-4" />
                أنواع الأجندة
              </button>
              <button
                onClick={() => setEditing(blank(todayKey))}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
              >
                <Plus className="size-4" />
                حدث جديد
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="أيام عطلة خلال 30 يوماً"
          value={upcomingClosed}
          icon={CalendarOff}
          tone="warm"
        />
        <KpiCard
          label="أحداث في هذه الفترة"
          value={(query.data?.events ?? []).filter((e) => e.source === "event").length}
          icon={CalendarDays}
          tone="primary"
        />
        <KpiCard
          label="الحدث القادم"
          value={nextEvent ? nextEvent.title : "—"}
          icon={BellRing}
          tone="info"
          {...(nextEvent ? { trend: niceDate(nextEvent.from) } : {})}
        />
      </div>

      <SectionCard
        className="mt-5"
        title="الأجندة"
        description={
          canEdit ? "اضغط على أي يوم لإضافة حدث، وعلى الحدث لتعديله" : "اضغط على الحدث لتفاصيله"
        }
        actions={
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            {(
              [
                ["month", "شهر"],
                ["week", "أسبوع"],
                ["list", "القادم"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium",
                  view === k ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        }
      >
        {/* The types double as the legend and the filter. */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {types
            .filter((t) => t.isActive)
            .map((t) => {
              const off = hidden.has(t.key);
              return (
                <button
                  key={t.key}
                  onClick={() =>
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (next.has(t.key)) next.delete(t.key);
                      else next.add(t.key);
                      return next;
                    })
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-opacity",
                    off ? "border-dashed border-border opacity-50" : "border-transparent",
                    off ? "" : wsColor(t.color).tile,
                  )}
                  title={off ? "إظهار" : "إخفاء"}
                >
                  <span className={cn("size-2 rounded-full", wsColor(t.color).dot)} />
                  {t.label}
                </button>
              );
            })}
          <label className="ms-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Switch checked={showWeekly} onCheckedChange={setShowWeekly} />
            العطل الأسبوعية
          </label>
        </div>

        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : view === "month" ? (
          <MonthView
            cursor={cursor}
            entries={entries}
            today={todayKey}
            onMove={moveCursor}
            onPick={canEdit ? (key) => setEditing(blank(key)) : undefined}
            onOpen={openEntry}
          />
        ) : view === "week" ? (
          <WeekView
            cursor={cursor}
            entries={entries}
            today={todayKey}
            onMove={moveCursor}
            onPick={canEdit ? (key) => setEditing(blank(key)) : undefined}
            onOpen={openEntry}
          />
        ) : listEvents.length === 0 ? (
          <EmptyBlock
            title="لا أحداث قادمة"
            description={
              canEdit
                ? "أضف عطلة أو امتحانات أو نشاطاً من زر «حدث جديد»."
                : "لا شيء على الأجندة بعد."
            }
            icon={<CalendarDays className="size-6" />}
          />
        ) : (
          <div className="space-y-5">
            {[...months.entries()].map(([label, list]) => (
              <div key={label}>
                <p className="mb-2 text-xs font-bold text-muted-foreground">{label}</p>
                <ul className="space-y-1.5">
                  {list.map((ev) => (
                    <li key={`${ev.source}:${ev.id}`}>
                      <button
                        onClick={() => open(ev)}
                        className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-right transition-colors hover:border-primary/40"
                      >
                        <span
                          className={cn(
                            "mt-1 size-2.5 shrink-0 rounded-full",
                            wsColor(ev.color).dot,
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{ev.title}</span>
                          <span className="block text-xs text-muted-foreground">{span(ev)}</span>
                          {ev.location && (
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="size-3" />
                              {ev.location}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                              wsColor(ev.color).tile,
                            )}
                          >
                            {ev.typeLabel}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {ev.audienceLabel}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {editing && options.data && (
        <EventDialog initial={editing} options={options.data} onClose={() => setEditing(null)} />
      )}
      {viewing && <EventDetails ev={viewing} onClose={() => setViewing(null)} />}
      {managing && options.data && <TypesDialog types={types} onClose={() => setManaging(false)} />}
    </>
  );
}

// --- one event ---------------------------------------------------------------------

function EventDialog({
  initial,
  options,
  onClose,
}: {
  initial: AgendaEventPayload;
  options: AgendaOptions;
  onClose: () => void;
}) {
  const save = useSaveAgendaEvent();
  const remove = useDeleteAgendaEvent();
  const confirm = useConfirm();
  const [form, setForm] = useState<AgendaEventPayload>(initial);
  const set = <K extends keyof AgendaEventPayload>(k: K, v: AgendaEventPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const type = options.types.find((t) => t.key === form.type);
  const effects = EFFECT_LABELS.filter(([k]) => type && Number(type[k]));

  function toggle(list: "groups" | "programs", id: string) {
    setForm((f) => ({
      ...f,
      [list]: f[list].includes(id) ? f[list].filter((x) => x !== id) : [...f[list], id],
    }));
  }

  function submit() {
    if (!form.title.trim()) {
      toast.error("اكتب عنوان الحدث");
      return;
    }
    save.mutate(
      { ...form, to: form.to || form.from },
      {
        onSuccess: () => {
          toast.success(form.id ? "تم تحديث الحدث" : "أُضيف الحدث إلى الأجندة");
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر الحفظ")),
      },
    );
  }

  async function del() {
    if (!form.id) return;
    const ok = await confirm({
      title: "حذف الحدث",
      description: type?.closes_school
        ? "سيُحذف الحدث وتعود أيامه أيام دوام عادية."
        : "سيُحذف الحدث من الأجندة.",
      confirmLabel: "حذف",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(form.id, {
      onSuccess: () => {
        toast.success("حُذف الحدث");
        onClose();
      },
      onError: (e) => toast.error(errorMessage(e, "تعذّر الحذف")),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{form.id ? "تعديل الحدث" : "حدث جديد على الأجندة"}</DialogTitle>
        </DialogHeader>

        <div>
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">النوع</p>
          <div className="flex flex-wrap gap-1.5">
            {options.types
              .filter((t) => t.isActive || t.key === form.type)
              .map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => set("type", t.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors",
                    form.type === t.key
                      ? cn(wsColor(t.color).tile, "border-current")
                      : "border-border hover:bg-secondary",
                  )}
                >
                  <span className={cn("size-2 rounded-full", wsColor(t.color).dot)} />
                  {t.label}
                </button>
              ))}
          </div>
          {effects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {effects.map(([k, label, Icon]) => (
                <span
                  key={k}
                  className="flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Icon className="size-3" />
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1 text-[11px] text-muted-foreground">العنوان</p>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={
                type?.closes_school ? "مثلاً: عطلة عيد الفطر" : "مثلاً: رحلة الصف السابع إلى أريحا"
              }
              autoFocus
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">من تاريخ</p>
            <Input
              type="date"
              value={form.from}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, from: v, to: f.to && f.to >= v ? f.to : v }));
              }}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">إلى تاريخ</p>
            <Input
              type="date"
              value={form.to}
              min={form.from}
              onChange={(e) => set("to", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={!!form.allDay} onCheckedChange={(v) => set("allDay", v ? 1 : 0)} />
            طوال اليوم
          </label>
          {!form.allDay && (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={form.fromTime ?? ""}
                onChange={(e) => set("fromTime", e.target.value)}
              />
              <span className="text-xs text-muted-foreground">إلى</span>
              <Input
                type="time"
                value={form.toTime ?? ""}
                onChange={(e) => set("toTime", e.target.value)}
              />
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">لمن</p>
          <div className="flex flex-wrap gap-1.5">
            {options.audiences.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => set("audience", a.key as AgendaAudience)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs",
                  form.audience === a.key
                    ? "border-primary bg-primary-soft/50 font-bold text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          {form.audience === "programs" && (
            <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border p-2">
              {options.programs.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle("programs", p.id)}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[11px]",
                    form.programs.includes(p.id)
                      ? "border-primary bg-primary-soft/50 font-bold text-primary"
                      : "border-border",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {form.audience === "groups" && (
            <div className="mt-2 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border p-2">
              {options.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggle("groups", g.id)}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[11px]",
                    form.groups.includes(g.id)
                      ? "border-primary bg-primary-soft/50 font-bold text-primary"
                      : "border-border",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
          {type?.closes_school && form.audience !== "school" && form.audience !== "staff" ? (
            <p className="mt-1.5 text-[11px] text-warning">
              عطلة لصفوف أو شعب بعينها لا تُغلق المدرسة كلها — تُعلَّق حصص هذه الفئة فقط.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">المكان</p>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">الحالة</p>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="مؤكد">مؤكد</option>
              <option value="مبدئي">مبدئي</option>
              <option value="ملغى">ملغى (يُبقى في السجل بلا أثر)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1 text-[11px] text-muted-foreground">الوصف</p>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          {!type?.no_lessons && !type?.closes_school && (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={!!form.noLessons}
                onCheckedChange={(v) => set("noLessons", v ? 1 : 0)}
              />
              تعليق حصص الفئة المعنية في هذا الحدث
            </label>
          )}
          {type?.notify ? (
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={!!form.notify} onCheckedChange={(v) => set("notify", v ? 1 : 0)} />
              {form.id ? "إرسال تنبيه (إن لم يُرسل من قبل)" : "تنبيه الفئة المعنية الآن"}
            </label>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {form.id ? (
            <button
              onClick={() => void del()}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
              حذف
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={submit}
            disabled={save.isPending}
            className="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventDetails({ ev, onClose }: { ev: AgendaEvent; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", wsColor(ev.color).dot)} />
            {ev.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                wsColor(ev.color).tile,
              )}
            >
              {ev.typeLabel}
            </span>
            <Pill tone="muted">{ev.audienceLabel}</Pill>
            {ev.status !== "مؤكد" && <Pill tone="warning">{ev.status}</Pill>}
          </div>
          <p className="text-muted-foreground">{span(ev)}</p>
          {ev.location && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" />
              {ev.location}
            </p>
          )}
          {ev.description && <p className="whitespace-pre-line">{ev.description}</p>}
          {ev.closesSchool ? (
            <p className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-700 dark:text-rose-300">
              المدرسة مغلقة: لا حضور ولا حصص ولا امتحانات.
            </p>
          ) : ev.noLessons ? (
            <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              تُعلَّق حصص الفئة المعنية في هذا اليوم.
            </p>
          ) : null}
          {ev.source === "holiday" && (
            <p className="text-[11px] text-muted-foreground">
              عطلة مسجّلة في قائمة العطل من خارج الأجندة.
            </p>
          )}
          {ev.source === "weekly" && (
            <p className="text-[11px] text-muted-foreground">
              عطلة أسبوعية من إعدادات قائمة العطل.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- the types ---------------------------------------------------------------------------

function TypesDialog({ types, onClose }: { types: AgendaType[]; onClose: () => void }) {
  const save = useSaveAgendaType();
  const remove = useDeleteAgendaType();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Partial<AgendaType> & { label: string }>({
    label: "",
    color: "blue",
  });

  function update(t: AgendaType, patch: Partial<AgendaType>) {
    save.mutate(
      { ...t, ...patch },
      { onError: (e) => toast.error(errorMessage(e, "تعذّر الحفظ")) },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>أنواع الأجندة وأثرها على النظام</DialogTitle>
        </DialogHeader>
        <p className="text-xs leading-relaxed text-muted-foreground">
          لكل نوع لونه وأثره: «عطلة» تُغلق المدرسة فلا حضور ولا حصص ولا امتحانات، «تُعلَّق الحصص»
          يُوقف حصص الفئة المعنية (رحلة، يوم نشاط) فلا يُطالَب حضورها ولا دفتر حصصها، «فترة
          امتحانات» تظهر في جدولة الامتحانات، «للطاقم فقط» لا يراه الطلاب وأولياء الأمور، و«تنبيه»
          يُرسل إشعاراً عند الإضافة.
        </p>
        <div className="space-y-2">
          {types.map((t) => (
            <div
              key={t.key}
              className={cn(
                "rounded-xl border p-3",
                t.isActive ? "border-border" : "border-dashed opacity-70",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("size-3 rounded-full", wsColor(t.color).dot)} />
                <Input
                  defaultValue={t.label}
                  className="h-8 max-w-[12rem]"
                  onBlur={(e) =>
                    e.target.value.trim() &&
                    e.target.value !== t.label &&
                    update(t, { label: e.target.value.trim() })
                  }
                />
                <ColorPicker value={t.color} onChange={(color) => update(t, { color })} />
                <label className="ms-auto flex items-center gap-1.5 text-[11px]">
                  <Switch
                    checked={!!t.isActive}
                    onCheckedChange={(v) => update(t, { isActive: v ? 1 : 0 })}
                  />
                  فعّال
                </label>
                {!t.isSystem && (
                  <button
                    onClick={async () => {
                      if (
                        !(await confirm({
                          title: "حذف النوع",
                          description: t.label,
                          confirmLabel: "حذف",
                          tone: "danger",
                        }))
                      )
                        return;
                      remove.mutate(t.key, {
                        onError: (e) => toast.error(errorMessage(e, "تعذّر الحذف")),
                      });
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {EFFECT_LABELS.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5 text-[11px]">
                    <Switch
                      checked={!!Number(t[k])}
                      onCheckedChange={(v) => update(t, { [k]: v ? 1 : 0 })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3">
          <Input
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="نوع جديد، مثلاً: يوم مفتوح"
            className="h-8 max-w-[14rem]"
          />
          <ColorPicker
            value={draft.color ?? "blue"}
            onChange={(color) => setDraft((d) => ({ ...d, color }))}
          />
          <button
            onClick={() => {
              if (!draft.label.trim()) return;
              save.mutate(
                { ...draft, label: draft.label.trim(), isActive: 1, sortOrder: types.length + 1 },
                {
                  onSuccess: () => setDraft({ label: "", color: "blue" }),
                  onError: (e) => toast.error(errorMessage(e, "تعذّر الإضافة")),
                },
              );
            }}
            className="ms-auto flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            <Plus className="size-3.5" />
            إضافة نوع
          </button>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-secondary"
          >
            تم
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Coffee, Plus, Save, Trash2, Users, Wand2 } from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/error-message";
import {
  useApplyBellTimes,
  useAssignBellSchedule,
  useBellSchedules,
  useDeleteBellSchedule,
  useSaveBellSchedule,
  type BellPeriod,
  type BellSchedule,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/bell-schedules")({
  head: () => ({
    meta: [
      { title: "أوقات الدوام — Match Education" },
      {
        name: "description",
        content:
          "تعريف اليوم الدراسي لكل صف: عدد الحصص ومدّتها ووقت الاستراحة، وإسناده للصفوف والشُعب.",
      },
    ],
  }),
  component: BellSchedulesPage,
});

const BLANK: BellPeriod = { name: "", order: 0, from: "08:00", to: "08:45", isBreak: false };

/** Minutes between two "HH:MM" times, or 0 when either is unreadable. */
function minutesOf(time: string) {
  const [h = NaN, m = NaN] = (time || "").split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? NaN : h * 60 + m;
}

function minutesBetween(from: string, to: string) {
  const a = minutesOf(from);
  const b = minutesOf(to);
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : b - a;
}

function addMinutes(time: string, minutes: number) {
  const base = minutesOf(time);
  if (Number.isNaN(base)) return time;
  const total = base + minutes;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * The school day, defined once and assigned.
 *
 * A school rarely runs one bell: the younger grades take their break before
 * the fourth lesson and the older ones after it, and a kindergarten may run
 * five lessons where a secondary year runs eight. Each of those is a schedule
 * here; a grade — or a single section — is pointed at the one it follows, and
 * every screen that draws a timetable reads it.
 */
function BellSchedulesPage() {
  const query = useBellSchedules();
  const save = useSaveBellSchedule();
  const remove = useDeleteBellSchedule();
  const assign = useAssignBellSchedule();
  const apply = useApplyBellTimes();
  const confirm = useConfirm();

  const [selected, setSelected] = useState<string | null>(null);
  // Starting a new schedule is its own state, not "nothing selected": with
  // nothing selected the page picks the first schedule for you, so "new"
  // snapped straight back to an existing one and saving overwrote it.
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [rows, setRows] = useState<BellPeriod[]>([]);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof apply.mutateAsync>> | null>(
    null,
  );

  // The generator: what a school actually says out loud — "seven lessons of
  // forty-five minutes starting at eight, break after the third".
  const [count, setCount] = useState(7);
  const [length, setLength] = useState(45);
  const [start, setStart] = useState("08:00");
  const [gap, setGap] = useState(0);
  const [breakAfter, setBreakAfter] = useState(3);
  const [breakLength, setBreakLength] = useState(25);

  // `?? []` is a new array each render, and two effects depend on it.
  const schedules = useMemo(() => query.data?.schedules ?? [], [query.data]);
  const current = schedules.find((s) => s.name === selected) ?? null;

  useEffect(() => {
    if (!selected && !creating && schedules.length) setSelected(schedules[0]!.name);
  }, [schedules, selected, creating]);

  useEffect(() => {
    if (!current || creating) return;
    setTitle(current.title);
    setIsDefault(current.isDefault);
    setRows(current.periods.map((p) => ({ ...p })));
    setDirty(false);
    setPreview(null);
  }, [current?.name, current?.periods]);

  // Numbering is the server's, but the screen shows what it will be so the
  // numbers a school reads here are the numbers its register will hold.
  const numbered = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.from.localeCompare(b.from));
    let lesson = 0;
    return sorted.map((row) => {
      if (row.isBreak) return { ...row, order: 0 };
      lesson += 1;
      return { ...row, order: lesson };
    });
  }, [rows]);

  const overlap = useMemo(() => {
    for (let i = 1; i < numbered.length; i++) {
      const before = numbered[i - 1]!;
      const row = numbered[i]!;
      if (row.from < before.to) return `${row.name || "حصة"} تتداخل مع ${before.name || "حصة"}`;
      if (row.from >= row.to) return `${row.name || "حصة"}: وقت النهاية قبل البداية`;
    }
    return null;
  }, [numbered]);

  const lessons = numbered.filter((r) => !r.isBreak).length;
  const dayEnds = numbered.length ? numbered[numbered.length - 1]!.to : "—";

  function edit(index: number, patch: Partial<BellPeriod>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  function generate() {
    const out: BellPeriod[] = [];
    let at = start;
    for (let i = 1; i <= count; i++) {
      const end = addMinutes(at, length);
      out.push({ name: `الحصة ${i}`, order: i, from: at, to: end, isBreak: false });
      at = end;
      if (i === breakAfter && breakLength > 0) {
        const breakEnd = addMinutes(at, breakLength);
        out.push({ name: "استراحة", order: 0, from: at, to: breakEnd, isBreak: true });
        at = breakEnd;
      } else if (gap > 0 && i < count) {
        at = addMinutes(at, gap);
      }
    }
    setRows(out);
    setDirty(true);
  }

  async function onSave() {
    if (overlap) {
      toast.error(overlap);
      return;
    }
    if (!title.trim()) {
      toast.error("اكتب اسماً للتوقيت");
      return;
    }
    try {
      const saved = await save.mutateAsync({
        ...(current && !creating ? { name: current.name } : {}),
        title: title.trim(),
        periods: numbered,
        is_default: isDefault ? 1 : 0,
      });
      setCreating(false);
      setSelected(saved.name);
      setDirty(false);
      toast.success(creating ? "تم إنشاء التوقيت" : "تم حفظ التوقيت");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر إكمال العملية"));
    }
  }

  function startNew() {
    setCreating(true);
    setSelected(null);
    setTitle("");
    setIsDefault(false);
    setRows([{ ...BLANK, name: "الحصة 1", order: 1 }]);
    setDirty(true);
    setPreview(null);
  }

  async function onDelete(schedule: BellSchedule) {
    const yes = await confirm({
      title: `حذف «${schedule.title}»؟`,
      description: "لا يمكن حذف توقيت مسنَد إلى صف أو شعبة.",
      confirmLabel: "حذف",
      tone: "danger",
    });
    if (!yes) return;
    try {
      await remove.mutateAsync(schedule.name);
      setSelected(null);
      toast.success("تم الحذف");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر إكمال العملية"));
    }
  }

  async function onApply(dryRun: boolean) {
    if (!current) return;
    try {
      const result = await apply.mutateAsync({ name: current.name, dry_run: dryRun ? 1 : 0 });
      if (dryRun) {
        setPreview(result);
        if (!result.slots && !result.lessons) toast.success("الجداول المحفوظة مطابقة لهذا التوقيت");
      } else {
        setPreview(null);
        toast.success(result.message_ar ?? "تم تطبيق الأوقات");
      }
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر إكمال العملية"));
    }
  }

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <>
      <PageHeader
        title="أوقات الدوام"
        subtitle="اليوم الدراسي لكل صف: عدد الحصص ومدّتها ووقت الاستراحة"
        actions={
          <button
            type="button"
            onClick={startNew}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            توقيت جديد
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
        {/* The schedules the school has --------------------------------- */}
        <SectionCard title="التوقيتات" description="اختر توقيتاً لتعديله">
          {schedules.length === 0 ? (
            <EmptyBlock
              title="لا يوجد توقيت بعد"
              description="ابدأ بتوقيت واحد للمدرسة، ثم أضف توقيتاً آخر للصفوف التي تختلف عنه."
              icon={<Clock className="size-6" />}
            />
          ) : (
            <ul className="space-y-1.5">
              {schedules.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setSelected(s.name);
                    }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-right transition-colors",
                      s.name === selected
                        ? "border-primary bg-primary-soft"
                        : "border-border hover:bg-secondary/60",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold">{s.title}</span>
                      {s.isDefault && <Pill tone="success">الافتراضي</Pill>}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {s.lessons} حصص · {s.programs.length} صف · {s.studentGroups.length} شعبة
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-5">
          {/* The day itself ------------------------------------------- */}
          <SectionCard
            title={current && !creating ? `تعديل «${current.title}»` : "توقيت جديد"}
            description="كل سطر حصة أو استراحة. الترقيم يتبع الوقت، والاستراحة بلا رقم."
            actions={
              <div className="flex items-center gap-2">
                {current && !creating && (
                  <button
                    type="button"
                    onClick={() => onDelete(current)}
                    className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive-soft"
                  >
                    <Trash2 className="size-3.5" />
                    حذف
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!dirty || save.isPending || !!overlap}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">اسم التوقيت</span>
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="مثال: دوام الصفوف الدنيا"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => {
                      setIsDefault(e.target.checked);
                      setDirty(true);
                    }}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="text-xs">
                    التوقيت الافتراضي — للشُعب التي لا جدول لها ولم يُسنَد لها توقيت. لا يغيّر
                    جدولاً مبنياً.
                  </span>
                </label>
              </div>

              {/* The generator ---------------------------------------- */}
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                  <Wand2 className="size-3.5" />
                  توليد سريع
                </p>
                <div className="grid gap-2 text-[11px] sm:grid-cols-3 lg:grid-cols-6">
                  <label>
                    <span className="mb-1 block text-muted-foreground">عدد الحصص</span>
                    <Input
                      type="number"
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                      className="h-8"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-muted-foreground">مدة الحصة (د)</span>
                    <Input
                      type="number"
                      value={length}
                      onChange={(e) => setLength(Number(e.target.value))}
                      className="h-8"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-muted-foreground">بداية الدوام</span>
                    <Input
                      type="time"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className="h-8"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-muted-foreground">فاصل بين الحصص (د)</span>
                    <Input
                      type="number"
                      value={gap}
                      onChange={(e) => setGap(Number(e.target.value))}
                      className="h-8"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-muted-foreground">استراحة بعد الحصة</span>
                    <Input
                      type="number"
                      value={breakAfter}
                      onChange={(e) => setBreakAfter(Number(e.target.value))}
                      className="h-8"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-muted-foreground">مدة الاستراحة (د)</span>
                    <Input
                      type="number"
                      value={breakLength}
                      onChange={(e) => setBreakLength(Number(e.target.value))}
                      className="h-8"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={generate}
                  className="mt-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-secondary"
                >
                  توليد الجدول — يستبدل السطور أدناه
                </button>
              </div>

              {/* The rows --------------------------------------------- */}
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-1 text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground">
                      <th className="w-12 px-2 text-right">#</th>
                      <th className="px-2 text-right">الاسم</th>
                      <th className="w-28 px-2 text-right">من</th>
                      <th className="w-28 px-2 text-right">إلى</th>
                      <th className="w-20 px-2 text-right">المدة</th>
                      <th className="w-24 px-2 text-right">استراحة</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {numbered.map((row, index) => (
                      <tr
                        key={`${row.from}-${index}`}
                        className={cn(row.isBreak && "text-muted-foreground")}
                      >
                        <td className="rounded-r-lg bg-secondary/40 px-2 py-1.5 text-center text-xs font-bold">
                          {row.isBreak ? <Coffee className="mx-auto size-3.5" /> : row.order}
                        </td>
                        <td className="bg-secondary/20 px-1 py-1">
                          <Input
                            value={row.name}
                            onChange={(e) =>
                              edit(rows.indexOf(rows[index]!), { name: e.target.value })
                            }
                            className="h-8"
                            placeholder={row.isBreak ? "استراحة" : `الحصة ${row.order}`}
                          />
                        </td>
                        <td className="bg-secondary/20 px-1 py-1">
                          <Input
                            type="time"
                            value={row.from}
                            onChange={(e) => edit(index, { from: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="bg-secondary/20 px-1 py-1">
                          <Input
                            type="time"
                            value={row.to}
                            onChange={(e) => edit(index, { to: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="bg-secondary/20 px-2 py-1 text-center text-xs tabular-nums">
                          {minutesBetween(row.from, row.to)} د
                        </td>
                        <td className="bg-secondary/20 px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={row.isBreak}
                            onChange={(e) => edit(index, { isBreak: e.target.checked })}
                            className="size-4 accent-[var(--primary)]"
                          />
                        </td>
                        <td className="rounded-l-lg bg-secondary/20 px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setRows((prev) => prev.filter((_, i) => i !== index));
                              setDirty(true);
                            }}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            title="حذف السطر"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const last = numbered[numbered.length - 1];
                    setRows((prev) => [
                      ...prev,
                      last
                        ? { ...BLANK, from: last.to, to: addMinutes(last.to, 45) }
                        : { ...BLANK },
                    ]);
                    setDirty(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                >
                  <Plus className="size-3.5" />
                  إضافة سطر
                </button>
                <span className="text-[11px] text-muted-foreground">
                  {lessons} حصة · ينتهي الدوام {dayEnds}
                </span>
                {overlap && (
                  <span className="rounded-lg bg-destructive-soft px-2 py-1 text-[11px] font-bold text-destructive">
                    {overlap}
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          {current && !creating && (
            <>
              <Assignment schedule={current} />

              {/* Making the built weeks follow ---------------------- */}
              <SectionCard
                title="تطبيق الأوقات على الجداول المحفوظة"
                description="الجداول المبنية تحمل أوقاتها القديمة حتى تُطبَّق. الحصص التي رُصد لها حضور أو نيابة لا تُمَس."
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onApply(true)}
                    disabled={apply.isPending}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    {apply.isPending ? "جارٍ الفحص…" : "معاينة التغييرات"}
                  </button>
                  {preview && (preview.slots > 0 || preview.lessons > 0) && (
                    <button
                      type="button"
                      onClick={() => onApply(false)}
                      disabled={apply.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Check className="size-3.5" />
                      تطبيق على {preview.slots} حصة و{preview.lessons} حصة مجدولة
                    </button>
                  )}
                </div>
                {preview && (
                  <div className="mt-3 space-y-2 text-[11px]">
                    <p className="text-muted-foreground">
                      {preview.groups} شعبة مسنَدة لهذا التوقيت · {preview.slots} حصة في الجدول
                      الأسبوعي · {preview.lessons} حصة مجدولة قادمة
                      {preview.protected > 0 && ` · ${preview.protected} محمية (حضور أو نيابة)`}
                    </p>
                    {preview.sections && preview.sections.length > 0 && (
                      <p className="rounded-lg bg-secondary/50 p-2 leading-relaxed">
                        <b>الشُعب التي ستتغيّر:</b> {preview.sections.join("، ")}
                      </p>
                    )}
                    {preview.sample?.map((c, i) => (
                      <p key={i} className="tabular-nums text-muted-foreground">
                        {c.group} — الحصة {c.order}: {c.was} ← {c.now}
                      </p>
                    ))}
                    {preview.missing.length > 0 && (
                      <p className="rounded-lg bg-warm-soft p-2 text-warm-foreground">
                        حصص محفوظة لا يعرّفها هذا التوقيت: {preview.missing.join("، ")}
                      </p>
                    )}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** Who follows this schedule: whole grades, and single sections that differ. */
function Assignment({ schedule }: { schedule: BellSchedule }) {
  const query = useBellSchedules();
  const assign = useAssignBellSchedule();
  const programs = query.data?.programs ?? [];
  const groups = query.data?.studentGroups ?? [];

  async function toggleProgram(name: string, on: boolean) {
    try {
      await assign.mutateAsync({ name: on ? schedule.name : null, programs: [name] });
      toast.success(on ? "تم الإسناد" : "تم إلغاء الإسناد");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر إكمال العملية"));
    }
  }

  async function toggleGroup(name: string, on: boolean) {
    try {
      await assign.mutateAsync({ name: on ? schedule.name : null, student_groups: [name] });
      toast.success(on ? "تم الإسناد" : "تم إلغاء الإسناد");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر إكمال العملية"));
    }
  }

  return (
    <SectionCard
      title="الصفوف والشُعب التي تتبع هذا التوقيت"
      description="الشعبة التي لها توقيت خاص تتجاوز توقيت صفّها"
      actions={<Users className="size-4 text-muted-foreground" />}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold">الصفوف</p>
          <ul className="max-h-64 space-y-1 overflow-y-auto pe-1">
            {programs.map((p) => {
              const on = p.schedule === schedule.name;
              return (
                <li key={p.name}>
                  <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-secondary/60">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => toggleProgram(p.name, e.target.checked)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="truncate">{p.program_name || p.name}</span>
                    {p.schedule && !on && (
                      <span className="me-auto shrink-0 text-[10px] text-muted-foreground">
                        {p.schedule}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold">شُعب بتوقيت خاص</p>
          <ul className="max-h-64 space-y-1 overflow-y-auto pe-1">
            {groups.map((g) => {
              const on = g.schedule === schedule.name;
              return (
                <li key={g.name}>
                  <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-secondary/60">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => toggleGroup(g.name, e.target.checked)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="truncate">{g.student_group_name || g.name}</span>
                    {g.schedule && !on && (
                      <span className="me-auto shrink-0 text-[10px] text-muted-foreground">
                        {g.schedule}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}

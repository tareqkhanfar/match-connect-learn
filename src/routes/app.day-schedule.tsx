import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  CalendarClock,
  DoorOpen,
  RotateCcw,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
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
import { errorMessage } from "@/lib/api/error-message";
import {
  useAvailableInstructors,
  useSwapCandidates,
  useCoverReport,
  useDayLessons,
  useGridOptions,
  useRecordChange,
  useSwapLessons,
  useUndoChange,
  type DayLesson,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/day-schedule")({
  head: () => ({
    meta: [
      { title: "جدول اليوم والمناوبات — Match Education" },
      {
        name: "description",
        content: "إدارة الطوارئ اليومية: معلم بديل، تبديل حصص، تغيير قاعة، وتقرير المناوبات.",
      },
    ],
  }),
  component: DaySchedulePage,
});

function DaySchedulePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [group, setGroup] = useState("");
  const [tab, setTab] = useState<"day" | "cover">("day");
  const [acting, setActing] = useState<DayLesson | null>(null);
  const [swapping, setSwapping] = useState<DayLesson | null>(null);

  const options = useGridOptions();
  const query = useDayLessons({ date, ...(group ? { student_group: group } : {}) });
  const undo = useUndoChange();
  const confirm = useConfirm();

  const lessons = query.data?.lessons ?? [];
  const changed = lessons.filter((l) => l.change);

  async function revert(lesson: DayLesson) {
    if (!lesson.change) return;
    const ok = await confirm({
      title: "التراجع عن التغيير؟",
      description: "ستعود الحصة إلى المعلم والقاعة الأصليين.",
      confirmLabel: "تراجع",
    });
    if (!ok) return;
    try {
      await undo.mutateAsync(lesson.change.id);
      toast.success("تمت إعادة الحصة كما كانت");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التراجع"));
    }
  }

  return (
    <>
      <PageHeader
        title="جدول اليوم والمناوبات"
        subtitle="عالج الطوارئ اليومية دون المساس بالجدول الأسبوعي"
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-secondary p-1">
          {(
            [
              ["day", "جدول اليوم", CalendarClock],
              ["cover", "تقرير المناوبات", Users],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                tab === key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "day" && (
          <>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-auto rounded-xl"
            />
            <div className="min-w-[220px]">
              <SearchableSelect
                value={group}
                onChange={setGroup}
                options={(options.data?.groups ?? []).map((g) => ({
                  value: g.name,
                  label: g.student_group_name || g.name,
                }))}
                placeholder="كل الشعب"
                clearable
                clearLabel="كل الشعب"
              />
            </div>
          </>
        )}
      </div>

      {tab === "cover" ? (
        <CoverTab />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="حصص اليوم" value={lessons.length} icon={CalendarClock} tone="primary" />
            <KpiCard label="عليها تغيير" value={changed.length} icon={UserCheck} tone="warm" />
            <KpiCard
              label="بدون تغيير"
              value={lessons.length - changed.length}
              icon={Users}
              tone="accent"
            />
          </div>

          <div className="mt-5">
            {query.error ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : query.isLoading ? (
              <TableSkeleton rows={5} />
            ) : lessons.length === 0 ? (
              <EmptyBlock
                title="لا توجد حصص في هذا اليوم"
                description="اختر تاريخاً آخر، أو ولّد حصص الفصل من شاشة بناء الجدول."
                icon={<CalendarClock className="size-6" />}
              />
            ) : (
              <SectionCard title="حصص اليوم" description={`${lessons.length} حصة`}>
                <ul className="divide-y divide-border">
                  {lessons.map((l) => (
                    <li
                      key={l.id}
                      className="grid gap-3 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num rounded-lg bg-secondary px-2 py-0.5 text-xs font-bold">
                            {l.from} - {l.to}
                          </span>
                          <p
                            className={`truncate text-sm font-bold ${
                              l.cancelled ? "text-destructive line-through" : ""
                            }`}
                          >
                            {l.course}
                          </p>
                          {l.change && (
                            <Pill tone={l.change.type === "Cancelled" ? "danger" : "warning"}>
                              {l.change.typeLabel}
                            </Pill>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {l.instructorName || l.instructor || "—"}
                          {l.room ? ` • ${l.room}` : ""}
                          {l.studentGroup ? ` • ${l.studentGroup}` : ""}
                        </p>
                        {l.change?.originalInstructorName && (
                          <p className="mt-0.5 text-[11px] text-warm-foreground">
                            ينوب عن {l.change.originalInstructorName}
                            {l.change.reasonLabel ? ` — ${l.change.reasonLabel}` : ""}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {l.change ? (
                          <button
                            onClick={() => revert(l)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-destructive-soft hover:text-destructive"
                          >
                            <RotateCcw className="size-3.5" />
                            تراجع
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setActing(l)}
                              className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary"
                            >
                              تغيير
                            </button>
                            <button
                              onClick={() => setSwapping(l)}
                              aria-label="تبديل"
                              title="تبديل مع حصة أخرى"
                              className="rounded-lg bg-secondary px-2.5 py-2 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
                            >
                              <ArrowLeftRight className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        </>
      )}

      {acting && (
        <ChangeDialog
          lesson={acting}
          reasons={query.data?.reasons ?? []}
          rooms={options.data?.rooms ?? []}
          onClose={() => setActing(null)}
        />
      )}

      {swapping && <SwapDialog lesson={swapping} onClose={() => setSwapping(null)} />}
    </>
  );
}

/* ---------------------------------------------------------------- change */

function ChangeDialog({
  lesson,
  reasons,
  rooms,
  onClose,
}: {
  lesson: DayLesson;
  reasons: Array<{ value: string; label: string }>;
  rooms: Array<{ name: string; room_name: string | null }>;
  onClose: () => void;
}) {
  const [type, setType] = useState("Substitute");
  const [instructor, setInstructor] = useState("");
  const [room, setRoom] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Only teachers actually free for this slot are offered.
  const teachers = useAvailableInstructors(type === "Substitute" ? lesson.id : null);
  const record = useRecordChange();

  async function submit() {
    if (type === "Substitute" && !instructor) {
      toast.error("اختر المعلم البديل");
      return;
    }
    if (type === "Room Change" && !room) {
      toast.error("اختر القاعة الجديدة");
      return;
    }
    try {
      await record.mutateAsync({
        course_schedule: lesson.id,
        change_type: type,
        ...(instructor ? { instructor } : {}),
        ...(room ? { room } : {}),
        ...(reason ? { reason } : {}),
        ...(notes ? { notes } : {}),
      });
      toast.success("تم تسجيل التغيير");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تسجيل التغيير"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {lesson.course} — {lesson.from} إلى {lesson.to}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>نوع التغيير</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Substitute", "معلم بديل", UserCheck],
                ["Room Change", "تغيير قاعة", DoorOpen],
                ["Cancelled", "إلغاء الحصة", X],
              ].map(([value, label, Icon]) => {
                const I = Icon as typeof UserCheck;
                return (
                  <button
                    key={value as string}
                    onClick={() => setType(value as string)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      type === value
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    <I className="size-3.5" />
                    {label as string}
                  </button>
                );
              })}
            </div>
          </div>

          {type === "Substitute" && (
            <div className="space-y-1.5">
              <Label>المعلم البديل *</Label>

              {/* Everyone is listed, free in green and busy in red with the
                  reason. Hiding the busy ones answered "who can cover?" but
                  not "why can't he?" — which is the question that follows. */}
              {teachers.isLoading ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  جارٍ التحقق من التوفر…
                </p>
              ) : (
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {(teachers.data?.available ?? []).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setInstructor(t.id)}
                      className={`w-full rounded-xl border p-2.5 text-right transition-colors ${
                        instructor === t.id
                          ? "border-emerald-500 bg-emerald-500/15"
                          : "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                      }`}
                    >
                      <span className="text-sm font-bold">{t.name}</span>
                      <span className="mr-2 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        متاح
                      </span>
                    </button>
                  ))}
                  {(teachers.data?.busy ?? []).map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-destructive/30 bg-destructive-soft/40 p-2.5"
                    >
                      <span className="text-sm font-bold text-muted-foreground">{t.name}</span>
                      <span className="mr-2 rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                        مشغول
                      </span>
                      {t.reason && (
                        <p className="mt-1 text-[11px] leading-relaxed text-destructive/90">
                          {t.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                الأخضر متاح في هذا الوقت، والأحمر مشغول مع سبب انشغاله.
              </p>
            </div>
          )}

          {type === "Room Change" && (
            <div className="space-y-1.5">
              <Label>القاعة الجديدة *</Label>
              <SearchableSelect
                value={room}
                onChange={setRoom}
                options={rooms.map((r) => ({ value: r.name, label: r.room_name || r.name }))}
                placeholder="اختر القاعة"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>السبب</Label>
            <SearchableSelect
              value={reason}
              onChange={setReason}
              options={reasons}
              placeholder="اختياري"
              clearable
            />
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={submit}
            disabled={record.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {record.isPending ? "جارٍ التسجيل…" : "تسجيل التغيير"}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ swap */

function SwapDialog({ lesson, onClose }: { lesson: DayLesson; onClose: () => void }) {
  const [second, setSecond] = useState("");
  const [reason, setReason] = useState("");
  const swap = useSwapLessons();

  // The server works out which swaps are actually possible — same class, and
  // both teachers free for each other's period.
  const options = useSwapCandidates(lesson.id);
  const rows = options.data?.candidates ?? [];
  const availableCount = options.data?.availableCount ?? 0;

  async function submit() {
    if (!second) {
      toast.error("اختر الحصة المقابلة");
      return;
    }
    try {
      await swap.mutateAsync({
        first: lesson.id,
        second,
        ...(reason ? { reason } : {}),
      });
      toast.success("تم تبديل المعلمين بين الحصتين");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التبديل"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-primary" />
            تبديل معلمَي حصتين
          </DialogTitle>
        </DialogHeader>

        <div className="card-surface p-3">
          <p className="text-xs text-muted-foreground">الحصة الأولى</p>
          <p className="text-sm font-bold">
            {lesson.course} — {lesson.instructorName || lesson.instructor}
          </p>
          <p className="num text-xs text-muted-foreground">
            {lesson.from} - {lesson.to} • {lesson.studentGroup}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>الحصة المقابلة *</Label>

          {/* Green is free, red is not — with the reason on the row itself,
              so an impossible swap is obvious before it is attempted. */}
          {options.isLoading ? (
            <p className="py-3 text-center text-xs text-muted-foreground">جارٍ الفحص…</p>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-border p-3 text-center text-xs text-muted-foreground">
              لا توجد حصص أخرى لهذه الشعبة في هذا اليوم.
            </p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {rows.map((c) => {
                const picked = second === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => c.available && setSecond(c.id)}
                    disabled={!c.available}
                    className={`w-full rounded-xl border p-2.5 text-right transition-colors ${
                      !c.available
                        ? "cursor-not-allowed border-destructive/30 bg-destructive-soft/40"
                        : picked
                          ? "border-emerald-500 bg-emerald-500/15"
                          : "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">
                        {c.course} — {c.instructorName || c.instructor}
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          c.available
                            ? "bg-emerald-500/20 text-emerald-700"
                            : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {c.available ? "متاح" : "غير متاح"}
                      </span>
                    </div>
                    <p className="num mt-0.5 text-[11px] text-muted-foreground">
                      {c.from} - {c.to}
                    </p>
                    {!c.available && c.reason && (
                      <p className="mt-1 text-[11px] leading-relaxed text-destructive/90">
                        {c.reason}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            يتبادل المعلمان الحصتين، وتبقى كل شعبة في وقتها وقاعتها. التبديل داخل الشعبة نفسها فقط.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>السبب</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={submit}
            disabled={swap.isPending || !second || availableCount === 0}
            className="h-11 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {swap.isPending ? "جارٍ التبديل…" : "تبديل"}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ cover report */

function CoverTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const report = useCoverReport({
    ...(from ? { from_date: from } : {}),
    ...(to ? { to_date: to } : {}),
  });

  const d = report.data;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">من</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 w-auto"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">إلى</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 w-auto"
          />
        </div>
      </div>

      {report.isLoading ? (
        <TableSkeleton rows={5} />
      ) : report.error ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : !d || d.total === 0 ? (
        <EmptyBlock
          title="لا توجد مناوبات في هذه الفترة"
          description="ستظهر هنا كل حالة نيابة أو تبديل مسجّلة."
          icon={<Users className="size-6" />}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard title="الأكثر مناوبة" description="عدد الحصص التي غطّاها كل معلم">
              <ul className="divide-y divide-border">
                {d.byCovering.map((r) => (
                  <li key={r.instructor} className="flex items-center justify-between py-2.5">
                    <span className="min-w-0 truncate text-sm font-semibold">{r.instructor}</span>
                    <span className="num shrink-0 rounded-lg bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                      {r.periods}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="الأكثر غياباً" description="عدد الحصص التي نُوب عنها">
              <ul className="divide-y divide-border">
                {d.byAbsent.map((r) => (
                  <li key={r.instructor} className="flex items-center justify-between py-2.5">
                    <span className="min-w-0 truncate text-sm font-semibold">{r.instructor}</span>
                    <span className="num shrink-0 rounded-lg bg-warm-soft px-2.5 py-1 text-xs font-bold text-warm-foreground">
                      {r.periods}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title="السجل" description={`${d.total} حالة`}>
            <ul className="divide-y divide-border">
              {d.entries.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-xs text-muted-foreground">{e.date}</span>
                    <Pill tone="info">{e.typeLabel}</Pill>
                    <p className="text-sm font-semibold">
                      {e.covered} <span className="text-muted-foreground">ناب عن</span>{" "}
                      {e.coveredFor}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.course}
                    {e.studentGroup ? ` • ${e.studentGroup}` : ""}
                    {e.reason ? ` • ${e.reason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </>
  );
}

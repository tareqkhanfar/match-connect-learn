import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/shared/ui-kit";
import { errorMessage } from "@/lib/api/error-message";
import {
  useGenerateSheet,
  type GenerationSummary,
  type SchoolSheet,
  type SheetJob,
} from "@/lib/api/school-timetable";
import { cn } from "@/lib/utils";

/**
 * Turn the saved week into the term's dated lessons — what attendance, the
 * gradebook and the families' timetable actually read. A whole school is
 * thousands of lessons, so it runs in the background and reports as it goes.
 */
export function GenerateDialog({
  open,
  onOpenChange,
  sheet,
  summary,
  job,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheet: SchoolSheet;
  summary: GenerationSummary;
  job: SheetJob | undefined;
  onStarted: () => void;
}) {
  const generate = useGenerateSheet();
  const [from, setFrom] = useState(summary.defaultFrom);
  const [to, setTo] = useState(summary.defaultTo);
  const [audience, setAudience] = useState(summary.audience || "draft");
  const [programs, setPrograms] = useState<string[]>([]);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFresh(false);
    setFrom(summary.defaultFrom);
    setTo(summary.defaultTo);
    setAudience(summary.audience || "draft");
  }, [open, summary]);

  const allPrograms = useMemo(
    () => [...new Set(sheet.groups.map((g) => g.program).filter(Boolean))],
    [sheet.groups],
  );
  const withWeek = useMemo(() => new Set(sheet.slots.map((s) => s.group)), [sheet.slots]);
  const chosen = sheet.groups.filter(
    (g) => withWeek.has(g.id) && (!programs.length || programs.includes(g.program)),
  );
  const running = job?.state === "running";

  async function start() {
    if (!from || !to) {
      toast.error("حدّد تاريخ البداية والنهاية");
      return;
    }
    if (to < from) {
      toast.error("تاريخ النهاية قبل تاريخ البداية");
      return;
    }
    try {
      await generate.mutateAsync({
        from_date: from,
        to_date: to,
        audience,
        ...(programs.length ? { groups: chosen.map((g) => g.id) } : {}),
      });
      setFresh(false);
      onStarted();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر بدء التوليد"));
    }
  }

  const reasons = Object.entries(job?.reasons ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-5 text-primary" />
            توليد حصص الفصل من الجدول
          </DialogTitle>
        </DialogHeader>

        {job &&
        (job.state === "running" ||
          ((job.state === "done" || job.state === "stalled") && !fresh)) ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                {job.state === "running" ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : job.state === "done" ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <TriangleAlert className="size-4 text-destructive" />
                )}
                {job.state === "running"
                  ? job.mode === "sync"
                    ? "تحديث الحصص المولّدة لتطابق الجدول…"
                    : "جارٍ توليد الحصص…"
                  : job.state === "done"
                    ? "اكتمل"
                    : "توقف التوليد — لم يصل تقدّم منذ مدة. يمكنك البدء من جديد."}
              </div>
              <ProgressBar value={job.total ? ((job.done ?? 0) / job.total) * 100 : 0} />
              <p className="num mt-2 text-xs text-muted-foreground">
                {job.done ?? 0} / {job.total ?? 0} شعبة
                {job.current ? ` — الآن: ${job.current}` : ""}
              </p>
              <div className="num mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  ["أُنشئت", job.created ?? 0, "text-success"],
                  ["حُذفت", job.removed ?? 0, ""],
                  ["محفوظة", job.kept ?? 0, "text-info"],
                  ["تُخطّيت", job.skipped ?? 0, (job.skipped ?? 0) ? "text-warm-foreground" : ""],
                ].map(([label, value, tone]) => (
                  <div key={label as string} className="rounded-lg bg-muted/40 p-2">
                    <p className={cn("text-base font-black", tone as string)}>{value as number}</p>
                    <p className="text-[10px] text-muted-foreground">{label as string}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                «محفوظة»: حصص سُجّل فيها حضور أو تبديل، لا يمسّها التوليد.
              </p>
            </div>
            {reasons.length > 0 && (
              <div className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-xs">
                <p className="mb-1 font-bold">أسباب التخطّي</p>
                <ul className="space-y-0.5">
                  {reasons.slice(0, 5).map(([why, n]) => (
                    <li key={why} className="flex gap-2">
                      <span className="num font-bold">{n}×</span>
                      <span className="min-w-0 flex-1">{why || "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(job.errors ?? []).length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-xs text-destructive">
                {(job.errors ?? []).slice(0, 6).map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            )}
            {!running && (
              <div className="flex gap-2">
                <button
                  onClick={() => onOpenChange(false)}
                  className="h-10 flex-1 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
                >
                  إغلاق
                </button>
                <button
                  onClick={() => setFresh(true)}
                  className="h-10 flex-1 rounded-xl bg-brand-gradient text-sm font-bold text-primary-foreground"
                >
                  توليد جديد
                </button>
              </div>
            )}
            {running && (
              <p className="text-center text-[11px] text-muted-foreground">
                يمكنك إغلاق هذه النافذة؛ يستمر التوليد في الخادم ويظهر تقدّمه أعلى الصفحة.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-xl bg-info-soft p-3 text-xs leading-relaxed text-info">
              <Info className="mt-0.5 size-4 shrink-0" />
              يستبدل الحصص المؤرّخة للشعب المختارة في هذه الفترة بما في الجدول المحفوظ، ويُبقي كل
              حصة سُجّل فيها حضور أو تبديل كما هي. العطل في التقويم تُتخطّى تلقائياً.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-semibold">
                من
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  dir="ltr"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                إلى
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
              </label>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">من يرى الحصص</p>
              <div className="grid grid-cols-3 gap-1.5">
                {summary.audiences.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAudience(a.value)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-[11px] font-semibold leading-tight",
                      audience === a.value
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border hover:bg-secondary",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">
                الصفوف{" "}
                <span className="font-normal text-muted-foreground">
                  (بلا اختيار = المدرسة كلها)
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allPrograms.map((p) => {
                  const on = programs.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() =>
                        setPrograms(on ? programs.filter((x) => x !== p) : [...programs, p])
                      }
                      className={cn(
                        "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-secondary",
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="num text-xs text-muted-foreground">
              سيُولَّد لـ {chosen.length} شعبة
              {summary.lessons
                ? ` — يوجد حالياً ${summary.lessons} حصة مولّدة من اليوم حتى ${summary.generatedTo}`
                : ""}
              .
            </p>
            <button
              onClick={() => void start()}
              disabled={generate.isPending || chosen.length === 0}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {generate.isPending && <Loader2 className="size-4 animate-spin" />}
              بدء التوليد
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

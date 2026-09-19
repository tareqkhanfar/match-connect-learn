import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/error-message";
import {
  useGenerateTeacherLessons,
  useTeacherLessonsStatus,
  type LessonSync,
  type TimetableAudience,
} from "@/lib/api/hooks";

const DATE = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });
const fmt = (d: string) => (d ? DATE.format(new Date(d)) : "—");

/**
 * Turn one teacher's saved week into dated lessons (Course Schedule).
 *
 * Only this teacher's lessons in the range are replaced; other teachers in
 * the same sections are untouched. Lessons with attendance or a recorded
 * substitution stay, and the result lists every lesson that could not be
 * created and why — nothing fails silently.
 */
export function GenerateTeacherLessonsDialog({
  instructor,
  teacherName,
  open,
  onOpenChange,
}: {
  instructor: string;
  teacherName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const status = useTeacherLessonsStatus(open ? instructor : undefined);
  const generate = useGenerateTeacherLessons();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [audience, setAudience] = useState<TimetableAudience>("draft");
  const [result, setResult] = useState<LessonSync | null>(null);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setFrom("");
      setTo("");
      return;
    }
    const s = status.data;
    if (!s) return;
    setFrom((v) => v || s.from);
    setTo((v) => v || s.to);
    // Regenerating keeps the audience the lessons already have, so a
    // published timetable is not unpublished by accident.
    if (s.generated) setAudience(s.audience);
  }, [open, status.data]);

  function run() {
    if (!from || !to) {
      toast.error("حدّد تاريخي البداية والنهاية");
      return;
    }
    if (to < from) {
      toast.error("تاريخ النهاية قبل تاريخ البداية");
      return;
    }
    generate.mutate(
      { instructor, from_date: from, to_date: to, audience },
      {
        onSuccess: (res) => {
          setResult(res);
          if (!res.skipped.length) toast.success(`تم توليد ${res.created} حصة`);
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر توليد الحصص")),
      },
    );
  }

  const s = status.data;

  return (
    <Dialog open={open} onOpenChange={(v) => !generate.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-5 text-primary" />
            توليد الحصص — {teacherName}
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <p className="text-[11px] text-muted-foreground">أُنشئت</p>
                <p className="text-lg font-bold tabular-nums">{result.created}</p>
              </div>
              <div className="rounded-lg bg-secondary/60 p-2">
                <p className="text-[11px] text-muted-foreground">استُبدلت</p>
                <p className="text-lg font-bold tabular-nums">{result.removed}</p>
              </div>
              <div className="rounded-lg bg-secondary/60 p-2">
                <p className="text-[11px] text-muted-foreground">بقيت كما هي</p>
                <p className="text-lg font-bold tabular-nums">{result.keptAttended}</p>
              </div>
            </div>
            {result.keptAttended > 0 && (
              <p className="text-[11px] text-muted-foreground">
                الحصص التي بقيت كما هي عليها حضور مسجّل أو تبديل/مناوبة، فلا تُحذف.
              </p>
            )}
            {result.skipped.length > 0 ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10">
                <p className="flex items-center gap-2 border-b border-amber-500/30 p-2.5 text-xs font-bold">
                  <AlertTriangle className="size-4 text-amber-600" />
                  تعذّر توليد {result.skipped.length} حصة:
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto p-2.5 text-[11px]">
                  {result.skipped.slice(0, 50).map((k, i) => (
                    <li key={i}>
                      <span className="font-mono" dir="ltr">
                        {k.date}
                      </span>
                      {k.course ? ` — ${k.course}` : ""}: {k.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                وُلّدت كل الحصص بنجاح من {fmt(result.from ?? from)} إلى {fmt(result.to ?? to)}.
              </p>
            )}
            <DialogFooter>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                تم
              </button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
              تُنشأ حصة مؤرخة لكل حصة في جدول المعلم المحفوظ، في كل يوم دراسي ضمن الفترة. تُستبدل
              حصص <b>هذا المعلم وحده</b> في الفترة، ولا تُمسّ حصص المعلمين الآخرين. الحصص التي عليها
              حضور أو تبديل تبقى كما هي، وتُتخطّى أيام العطل.
            </div>

            {status.isLoading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> جارِ التحميل…
              </p>
            ) : s ? (
              <p className="text-xs">
                {s.slots} حصة أسبوعية في الجدول المحفوظ.{" "}
                {s.generated > 0
                  ? `مولّد حالياً: ${s.generated} حصة حتى ${fmt(s.generatedTo)} — وتتحدّث تلقائياً عند كل حفظ.`
                  : "لم تُولَّد حصص لهذا المعلم بعد."}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">من تاريخ</p>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">إلى تاريخ</p>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">من يرى الحصص؟</p>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as TimetableAudience)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="draft">مسودة — الإدارة فقط</option>
                <option value="teachers">المعلمون</option>
                <option value="all">المعلمون والطلاب وأولياء الأمور</option>
              </select>
            </div>

            <DialogFooter className="gap-2">
              <button
                onClick={() => onOpenChange(false)}
                disabled={generate.isPending}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={run}
                disabled={generate.isPending || (!s?.slots && !s?.generated)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {generate.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CalendarPlus className="size-3.5" />
                )}
                {generate.isPending ? "جارٍ التوليد…" : "توليد"}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/shared/ui-kit";
import { apiPost } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import { useExamConflicts, type ExamConflicts } from "@/lib/api/hooks";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Put a date on a mark column.
 *
 * Conflicts are shown, not enforced. Two papers on one day is a judgement a
 * teacher makes with the timetable in front of them; this screen's job is to
 * put the timetable in front of them — pupil by pupil, with what each one
 * already sits — and then let them decide.
 */
export function ScheduleExamDialog({
  studentGroup,
  course,
  title,
  existing,
  onClose,
}: {
  studentGroup: string;
  course: string;
  title: string;
  existing?: { id: string; date: string; from_time: string; to_time: string } | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const check = useExamConflicts();
  const [date, setDate] = useState(existing?.date ?? "");
  const [fromTime, setFromTime] = useState(existing?.from_time ?? "");
  const [toTime, setToTime] = useState(existing?.to_time ?? "");
  const [conflicts, setConflicts] = useState<ExamConflicts | null>(null);
  const [saving, setSaving] = useState(false);

  // Looking ahead as soon as there is a date to look at: a teacher who has to
  // press a button to find out about clashes will not press it.
  useEffect(() => {
    if (!date) {
      setConflicts(null);
      return;
    }
    let cancelled = false;
    void check
      .mutateAsync({
        student_group: studentGroup,
        schedule_date: date,
        ...(fromTime ? { from_time: fromTime } : {}),
        ...(toTime ? { to_time: toTime } : {}),
        ...(existing?.id ? { exam: existing.id } : {}),
      })
      .then((res) => {
        if (!cancelled) setConflicts(res);
      })
      .catch(() => {
        if (!cancelled) setConflicts(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, fromTime, toTime, studentGroup]);

  async function save(acknowledge: boolean) {
    if (!date) {
      toast.error("حدّد تاريخ الاستحقاق.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost<{
        id?: string;
        conflicts?: ExamConflicts;
        needs_confirmation?: boolean;
      }>("exams.save_exam", {
        payload: {
          ...(existing?.id ? { id: existing.id } : {}),
          student_group: studentGroup,
          course,
          title,
          schedule_date: date,
          ...(fromTime ? { from_time: fromTime } : {}),
          ...(toTime ? { to_time: toTime } : {}),
          ...(acknowledge ? { acknowledge_conflicts: 1 } : {}),
        },
      } as unknown as Record<string, unknown>);
      toast.success("تم حفظ موعد الامتحان.");
      void qc.invalidateQueries({ queryKey: ["column-exams"] });
      void qc.invalidateQueries({ queryKey: ["exams"] });
      onClose();
      return;
    } catch (e) {
      // The server answers a first save with the conflict table rather than a
      // refusal; it arrives here as a failed envelope carrying that table.
      const detail = (e as { data?: { conflicts?: ExamConflicts; needs_confirmation?: boolean } })
        .data;
      if (detail?.needs_confirmation && detail.conflicts) {
        setConflicts(detail.conflicts);
        toast.warning(errorMessage(e, "هناك تعارضات — راجع الجدول."));
      } else {
        toast.error(errorMessage(e, "تعذّر حفظ الموعد."));
      }
    } finally {
      setSaving(false);
    }
  }

  const hasConflicts = (conflicts?.total ?? 0) > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            تعيين موعد: {title}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto p-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>تاريخ الاستحقاق</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>من الساعة</Label>
              <Input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
            </div>
            <div>
              <Label>إلى الساعة</Label>
              <Input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            إن تركت الوقت فارغاً، يختار النظام حصة الشعبة في ذلك اليوم — وأول حصة غير محجوزة إن كان
            لها امتحان آخر.
          </p>

          {conflicts?.holiday && (
            <p className="rounded-xl border border-destructive/40 bg-destructive-soft p-2.5 text-xs font-semibold text-destructive">
              هذا اليوم عطلة: {conflicts.holiday}
            </p>
          )}

          {hasConflicts && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold">
                <AlertTriangle className="size-4 text-warning" />
                لدى <span className="num">{conflicts!.total}</span> طالباً امتحانات أخرى في هذا
                اليوم
                {conflicts!.overlapping > 0 && (
                  <Pill tone="danger">
                    <span className="num">{conflicts!.overlapping}</span> منها في نفس الوقت
                  </Pill>
                )}
              </p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                هذا تنبيه لا منع — يمكنك المتابعة إن كان ذلك مقصوداً.
              </p>
              <div className="max-h-56 overflow-auto rounded-lg border border-border bg-card">
                <table className="w-full min-w-max text-xs">
                  <thead className="sticky top-0 bg-secondary/70">
                    <tr>
                      <th className="px-2 py-1.5 text-start font-semibold">الطالب</th>
                      <th className="px-2 py-1.5 text-start font-semibold">الامتحان المحجوز</th>
                      <th className="px-2 py-1.5 text-start font-semibold">المادة</th>
                      <th className="px-2 py-1.5 text-start font-semibold">الشعبة</th>
                      <th className="px-2 py-1.5 font-semibold">الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts!.students.map((s) =>
                      s.conflicts.map((c, i) => (
                        <tr key={`${s.student}-${c.exam}`} className="border-t border-border">
                          {i === 0 && (
                            <td
                              rowSpan={s.conflicts.length}
                              className="px-2 py-1.5 align-top font-semibold"
                            >
                              {s.name}
                              {s.overlapping && (
                                <span className="mt-0.5 block text-[10px] text-destructive">
                                  تعارض في نفس الوقت
                                </span>
                              )}
                            </td>
                          )}
                          <td className="px-2 py-1.5">{c.title}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{c.course}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{c.student_group}</td>
                          <td className="num px-2 py-1.5 text-center">
                            {c.from_time ? (
                              <span className={c.overlapping ? "font-bold text-destructive" : ""}>
                                <Clock className="ms-1 inline size-3" />
                                {c.from_time}–{c.to_time}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {date && !hasConflicts && !check.isPending && (
            <p className="rounded-xl border border-success/40 bg-success/10 p-2.5 text-xs font-semibold text-success">
              لا توجد امتحانات أخرى لطلاب هذه الشعبة في هذا اليوم.
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            تراجع
          </button>
          <button
            onClick={() => void save(hasConflicts)}
            disabled={saving || !date}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {hasConflicts ? "حفظ رغم التعارض" : "حفظ الموعد"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

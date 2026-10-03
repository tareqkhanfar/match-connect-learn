import { useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { HtmlPreviewDialog } from "@/components/shared/html-preview-dialog";
import { apiGet } from "@/lib/api/client";

/** A date `n` days from an ISO date, as an ISO date. Noon keeps it clear of
 *  any time-zone edge. */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The Sunday the school week of `iso` starts on (the server reads it the same way). */
function sundayOf(iso: string): string {
  return addDays(iso, -new Date(`${iso}T12:00:00`).getDay());
}

function slashed(iso: string): string {
  return iso.replaceAll("-", "/");
}

/**
 * The Hijri date (Umm al-Qura) the browser knows, as 1448/04/12. Done here
 * rather than on the server because the browser carries the official
 * calendar; the server only has an arithmetical one that can be a day out.
 */
function hijri(iso: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(new Date(`${iso}T12:00:00`));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const year = get("year").replace(/\D/g, "");
    return year ? `${year}/${get("month")}/${get("day")}` : "";
  } catch {
    return "";
  }
}

/**
 * «طباعة الخطة الأسبوعية»: pick the section and the week, then the sheet the
 * school hands round — subjects down, Sunday to Thursday across, each square
 * the preparation its teacher wrote for that day.
 */
export function WeeklyPlanDialog({
  classes,
  initialGroup,
  initialWeek,
  onClose,
}: {
  classes: Array<{ name: string; student_group_name: string }>;
  initialGroup: string;
  initialWeek: string | undefined;
  onClose: () => void;
}) {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [group, setGroup] = useState(initialGroup || classes[0]?.name || "");
  const [week, setWeek] = useState(sundayOf(initialWeek || todayIso));
  const [previewing, setPreviewing] = useState(false);
  const thursday = addDays(week, 4);
  const label = classes.find((c) => c.name === group)?.student_group_name ?? group;

  if (previewing)
    return (
      <HtmlPreviewDialog
        heading={`الخطة الأسبوعية — ${label}`}
        load={() =>
          apiGet<{ html: string; title: string }>("weekly_plan.weekly_plan", {
            student_group: group,
            week_start: week,
            hijri_from: hijri(week),
            hijri_to: hijri(thursday),
          })
        }
        onClose={onClose}
      />
    );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>طباعة الخطة الأسبوعية</DialogTitle>
          <DialogDescription>
            المواد × أيام الأسبوع، وفي كل خانة تحضير الحصة كما أدخله المعلم.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label>الشعبة</Label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
            >
              {classes.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.student_group_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>الأسبوع</Label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeek(addDays(week, -7))}
                className="grid size-10 place-items-center rounded-xl border border-border hover:bg-secondary"
                aria-label="الأسبوع السابق"
              >
                <ChevronRight className="size-4" />
              </button>
              <div className="flex-1 rounded-xl border border-border px-3 py-2 text-center">
                <span className="num font-bold" dir="ltr">
                  {slashed(week)} – {slashed(thursday)}
                </span>
                {hijri(week) && (
                  <span className="num block text-[11px] text-muted-foreground" dir="ltr">
                    {hijri(week)} – {hijri(thursday)} هـ
                  </span>
                )}
              </div>
              <button
                onClick={() => setWeek(addDays(week, 7))}
                className="grid size-10 place-items-center rounded-xl border border-border hover:bg-secondary"
                aria-label="الأسبوع التالي"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>
            {week !== sundayOf(todayIso) && (
              <button
                onClick={() => setWeek(sundayOf(todayIso))}
                className="text-xs font-semibold text-primary hover:underline"
              >
                العودة إلى هذا الأسبوع
              </button>
            )}
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
          >
            إلغاء
          </button>
          <button
            onClick={() => setPreviewing(true)}
            disabled={!group}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <Printer className="size-4" />
            معاينة وطباعة
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

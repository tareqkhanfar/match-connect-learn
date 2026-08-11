import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import { useAcademicContext, useUpcomingHolidays } from "@/lib/api/hooks";

/**
 * The school's own name and logo in the header, and in the browser tab.
 *
 * The name comes from the Company record rather than being hardcoded, so a
 * school sees itself rather than the vendor. The logo falls back to the Match
 * Systems mark when the school has not uploaded one.
 */
const FALLBACK_LOGO = "/brand/match-systems-logo.png";

export function SchoolBrand() {
  const { data } = useAcademicContext();
  const school = data?.school;
  // A Company logo that was deleted, or points at a private path the browser
  // cannot read, would otherwise render as a broken image in the header.
  const [logoFailed, setLogoFailed] = useState(false);

  // The tab title carries the school name — several schools are often open in
  // adjacent tabs, and "Match Education" in all of them is unusable.
  useEffect(() => {
    if (!school?.name) return;
    const previous = document.title;
    const suffix = document.title.includes("—")
      ? document.title.split("—")[0]?.trim()
      : document.title;
    document.title = suffix ? `${suffix} — ${school.name}` : school.name;
    return () => {
      document.title = previous;
    };
  }, [school?.name]);

  if (!school) return null;

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/95 p-1 ring-1 ring-border">
        <img
          src={!logoFailed && school.logo ? school.logo : FALLBACK_LOGO}
          alt={school.name}
          className="size-full object-contain"
          onError={() => setLogoFailed(true)}
        />
      </div>
      <div className="hidden min-w-0 md:block">
        <p className="truncate text-sm font-bold leading-tight">{school.name}</p>
        {data?.academicTerm && (
          <p className="truncate text-[11px] text-muted-foreground">{data.academicTerm}</p>
        )}
      </div>
    </div>
  );
}

/**
 * A strip that appears only when the school is closed today, or a holiday is
 * imminent. Silent otherwise — a banner that is always there stops being read.
 */
export function HolidayBanner() {
  const { data } = useUpcomingHolidays(14);
  if (!data) return null;

  if (data.todayIsHoliday) {
    return (
      <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-800 md:px-6">
        <PartyPopper className="size-4 shrink-0" />
        <span>
          اليوم عطلة رسمية{data.todayReason ? ` — ${data.todayReason}` : ""}. لا يمكن تسجيل الحضور
          أو جدولة الحصص والامتحانات اليوم.
        </span>
      </div>
    );
  }

  // The next holiday, if it is close enough to be worth mentioning.
  const next = data.holidays.find((h) => h.inDays > 0 && h.inDays <= 7);
  if (!next) return null;

  return (
    <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-1.5 text-[11px] text-muted-foreground md:px-6">
      <PartyPopper className="size-3.5 shrink-0" />
      <span>
        عطلة قادمة: {next.reason} بعد {next.inDays} {next.inDays === 1 ? "يوم" : "أيام"} (
        {next.date})
      </span>
    </div>
  );
}

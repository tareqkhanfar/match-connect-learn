import { useEffect, useState } from "react";
import { Clock, ShieldCheck, ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSessionStatus } from "@/lib/api/hooks";

/** Arabic weekday and date, e.g. "الأحد ٩ أغسطس". */
const DATE_FMT = new Intl.DateTimeFormat("ar", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const TIME_FMT = new Intl.DateTimeFormat("ar", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function remainingLabel(seconds: number): string {
  if (seconds <= 0) return "انتهت الجلسة";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} س ${m} د`;
  if (m > 0) return `${m} دقيقة`;
  return `${seconds} ثانية`;
}

/**
 * The clock in the header, plus how much of the session is left.
 *
 * The clock ticks locally but is anchored to the server's time, so a device
 * with a wrong clock still shows the school's time — the one that decides
 * whether a lesson has started or a deadline has passed.
 */
export function HeaderStatus() {
  const { data } = useSessionStatus();
  const [now, setNow] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Offset between the server clock and this device's clock.
  const [skewMs, setSkewMs] = useState(0);

  useEffect(() => {
    if (!data?.serverTime) return;
    // The API returns a naive datetime in the site's timezone; treating it as
    // local time is what makes the displayed clock match the school's.
    const server = new Date(data.serverTime.replace(" ", "T"));
    if (!Number.isNaN(server.getTime())) {
      setSkewMs(server.getTime() - Date.now());
    }
    setRemaining(data.remainingSeconds ?? null);
  }, [data?.serverTime, data?.remainingSeconds]);

  useEffect(() => {
    const tick = () => {
      setNow(new Date(Date.now() + skewMs));
      setRemaining((r) => (r === null ? null : Math.max(r - 1, 0)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [skewMs]);

  // Nothing is rendered until the first tick, so the server-rendered markup
  // and the first client render agree (a live clock would otherwise mismatch
  // during hydration).
  if (!now) return null;

  const lowTime = remaining !== null && remaining > 0 && remaining < 15 * 60;

  return (
    <div className="hidden items-center gap-3 lg:flex">
      <div className="flex flex-col items-end leading-tight">
        <span className="flex items-center gap-1.5 font-semibold tabular-nums">
          <Clock className="size-3.5 text-muted-foreground" />
          {TIME_FMT.format(now)}
        </span>
        <span className="text-[11px] text-muted-foreground">{DATE_FMT.format(now)}</span>
      </div>

      {remaining !== null && (
        <Link
          to="/app/security"
          title={`تنتهي الجلسة خلال ${remainingLabel(remaining)}`}
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
            lowTime
              ? "border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
              : "border-border text-muted-foreground hover:bg-secondary"
          }`}
        >
          {lowTime ? (
            <ShieldAlert className="size-3.5" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          <span className="tabular-nums">{remainingLabel(remaining)}</span>
        </Link>
      )}
    </div>
  );
}

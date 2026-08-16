import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useSurveys } from "@/lib/api/hooks";

/**
 * "There is a survey waiting for you", on the home page.
 *
 * Surveys sat on their own page and were missed, so schools chased answers by
 * hand. This puts the newest open one where everyone lands, and makes it
 * pulse: a survey that closes on Thursday is worth interrupting for, and a
 * quiet line of text is not.
 *
 * The pulse is a slow opacity fade rather than a hard blink — a hard blink is
 * unpleasant to sit next to, and `prefers-reduced-motion` turns it off
 * entirely for anyone who finds movement difficult.
 */
export function SurveyBanner() {
  const surveys = useSurveys();
  // The listing already scopes to what this person may see and to open
  // surveys; what is left is whether they have answered it.
  const open = (surveys.data ?? []).filter((s) => s.open && !s.answered);

  if (!open.length) return null;
  const first = open[0]!;

  return (
    <>
      <style>{`
        @keyframes ms-survey-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        .ms-survey-blink { animation: ms-survey-pulse 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ms-survey-blink { animation: none; }
        }
      `}</style>

      <Link
        to="/app/surveys"
        className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary-soft p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-soft"
      >
        <span className="ms-survey-blink grid size-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
          <ClipboardList className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="ms-survey-blink block text-sm font-black text-primary">
            {open.length > 1 ? `جديد… ${open.length} استبيانات بانتظارك` : "جديد… استبيان بانتظارك"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {first.title}
            {first.closes_on ? ` — يغلق في ${first.closes_on}` : ""}
          </span>
        </span>
        <span className="shrink-0 rounded-xl bg-brand-gradient px-3 py-1.5 text-xs font-bold text-primary-foreground">
          عبّئه الآن
        </span>
      </Link>
    </>
  );
}

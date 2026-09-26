import { Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";

/** The way into the help centre, kept in the header so it is found when needed. */
export function HelpBadge() {
  return (
    <Link
      to="/app/help"
      className="grid size-9 place-items-center rounded-xl transition-colors hover:bg-secondary"
      aria-label="المساعدة"
      title="المساعدة — فيديوهات وأسئلة شائعة"
    >
      <LifeBuoy className="size-[18px]" />
    </Link>
  );
}

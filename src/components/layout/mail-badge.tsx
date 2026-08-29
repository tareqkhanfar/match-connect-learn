import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useMailFolders } from "@/lib/api/hooks";

/**
 * The envelope in the header.
 *
 * The bell carries alerts; mail is a different thing and people look for it
 * in a different place. A count is shown rather than a bare dot because "you
 * have mail" and "you have eleven unread" call for different urgency.
 */
export function MailBadge() {
  const folders = useMailFolders();
  const unread = folders.data?.unread ?? 0;

  return (
    <Link
      to="/app/mail"
      className="relative grid size-9 place-items-center rounded-xl transition-colors hover:bg-secondary"
      aria-label={unread > 0 ? `البريد — ${unread} غير مقروءة` : "البريد"}
      title={unread > 0 ? `${unread} رسالة غير مقروءة` : "البريد"}
    >
      <Mail className="size-[18px]" />
      {unread > 0 && (
        <span className="num absolute -top-0.5 left-0 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

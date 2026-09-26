import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  CheckCheck,
  ClipboardCheck,
  Megaphone,
  MessageSquare,
  NotebookPen,
  Award,
  Printer,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useMarkNotificationRead, useNotifications, type NotificationItem } from "@/lib/api/hooks";

const ICON_BY_CATEGORY: Record<string, LucideIcon> = {
  message: MessageSquare,
  announcement: Megaphone,
  assignment: NotebookPen,
  grading: NotebookPen,
  grade: Award,
  attendance: ClipboardCheck,
  fee: Wallet,
  print: Printer,
};

const TONE_CLASS: Record<string, string> = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

/** "منذ ٣ ساعات" style relative time, falling back to the raw date. */
function relativeTime(value: string): string {
  if (!value) return "";
  const then = new Date(value.replace(" ", "T"));
  if (Number.isNaN(then.getTime())) return value;
  const minutes = Math.round((Date.now() - then.getTime()) / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return then.toISOString().slice(0, 10);
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data, isLoading } = useNotifications(30);
  const markRead = useMarkNotificationRead();

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  // Close on an outside click or Escape, like any other popover.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openItem(item: NotificationItem) {
    if (!item.read) markRead.mutate({ notification: item.id });
    setOpen(false);
    void navigate({ to: item.link });
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `الإشعارات (${unread} غير مقروء)` : "الإشعارات"}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="num absolute -left-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-[min(92vw,24rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="text-sm font-bold">الإشعارات</p>
            {unread > 0 && (
              <button
                onClick={() => markRead.mutate({ all: true })}
                disabled={markRead.isPending}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
              >
                <CheckCheck className="size-3.5" />
                تعليم الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <BellOff className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">لا توجد إشعارات حالياً.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const Icon = ICON_BY_CATEGORY[item.category] ?? Bell;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => openItem(item)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-right transition-colors hover:bg-secondary ${
                          item.read ? "opacity-60" : ""
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
                            TONE_CLASS[item.tone] ?? TONE_CLASS["info"]
                          }`}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{item.title}</span>
                            {!item.read && (
                              <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
                            )}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                            {item.body}
                          </span>
                          <span className="num mt-1 block text-[11px] text-muted-foreground">
                            {item.category_label} • {relativeTime(item.time)}
                            {item.count && item.count > 1 ? ` • ${item.count} رسائل` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

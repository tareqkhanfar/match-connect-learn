import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, MessagesSquare, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { RichText, RichTextView } from "@/components/shared/rich-text";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { byRole, isBackOffice } from "@/lib/roles";
import type { AnnouncementRow } from "@/lib/api/types";
import {
  useAnnouncements,
  useContacts,
  useDeleteAnnouncement,
  useInbox,
  useSaveAnnouncement,
  useSendMessage,
  useThread,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/communication")({
  head: () => ({
    meta: [
      { title: "التواصل والإعلانات — Match Education" },
      {
        name: "description",
        content: "لوحة إعلانات المدرسة، رسائل بين المعلمين وأولياء الأمور، وإشعارات فورية.",
      },
      { property: "og:title", content: "التواصل والإعلانات — Match Education" },
      { property: "og:description", content: "أعلن، راسِل، وتابع الإشعارات في مكان واحد." },
    ],
  }),
  component: CommunicationPage,
});

function CommunicationPage() {
  const { role } = useApp();
  // Mirrors the backend guard on save_announcement.
  const canPost = role === "admin" || role === "secretary" || role === "teacher";
  // Only the back office may edit or remove an announcement once posted.
  const canManageAnnouncements = isBackOffice(role);

  const announcementsQuery = useAnnouncements();
  // A guardian with several children reads one inbox per child; the switcher
  // above the list scopes it. Staff and students have no child to pick.
  const viewedChild = useViewedStudent();
  const inboxQuery = useInbox(50, role === "parent" ? viewedChild || undefined : undefined);
  const deleteAnnouncement = useDeleteAnnouncement();

  const [openThread, setOpenThread] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementRow | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<AnnouncementRow | null>(null);

  const announcements = announcementsQuery.data ?? [];
  const messages = inboxQuery.data ?? [];

  return (
    <>
      <PageHeader
        title={byRole(role, "التواصل والإعلانات", {
          student: "الإعلانات والرسائل",
          parent: "الإعلانات والرسائل",
        })}
        subtitle="لوحة الإعلانات والرسائل"
        actions={
          <>
            <button
              onClick={() => setComposing(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:bg-secondary"
            >
              <Send className="size-4" />
              رسالة جديدة
            </button>
            {canPost && (
              <button
                onClick={() => setPostingAnnouncement(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
              >
                <Plus className="size-4" />
                إعلان جديد
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SectionCard
          title="لوحة الإعلانات"
          description={`${announcements.length} إعلاناً`}
          actions={<Megaphone className="size-4 text-muted-foreground" />}
        >
          {announcementsQuery.error ? (
            <ErrorState
              error={announcementsQuery.error}
              onRetry={() => announcementsQuery.refetch()}
            />
          ) : announcementsQuery.isLoading ? (
            <TableSkeleton rows={5} />
          ) : announcements.length === 0 ? (
            <EmptyBlock title="لا توجد إعلانات" icon={<Megaphone className="size-6" />} />
          ) : (
            <ul className="divide-y divide-border">
              {announcements.map((a) => (
                <li key={a.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Pill
                        tone={a.type === "تنبيه" ? "danger" : a.type === "حدث" ? "info" : "primary"}
                      >
                        {a.type}
                      </Pill>
                      {canManageAnnouncements && (
                        <>
                          <button
                            onClick={() => setEditingAnnouncement(a)}
                            title="تعديل"
                            aria-label={`تعديل ${a.title}`}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingAnnouncement(a)}
                            title="حذف"
                            aria-label={`حذف ${a.title}`}
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {a.body && (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      <RichTextView html={a.body} />
                    </div>
                  )}
                  <p className="num mt-1.5 text-[11px] text-muted-foreground">
                    {a.date} • {a.audience}
                    {a.expires_on ? ` • ينتهي ${a.expires_on}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="الرسائل"
          description={`${messages.length} محادثة`}
          actions={<MessagesSquare className="size-4 text-muted-foreground" />}
        >
          {inboxQuery.error ? (
            <ErrorState error={inboxQuery.error} onRetry={() => inboxQuery.refetch()} />
          ) : inboxQuery.isLoading ? (
            <TableSkeleton rows={4} />
          ) : messages.length === 0 ? (
            <EmptyBlock
              title="لا توجد رسائل"
              description="ابدأ محادثة جديدة من زر «رسالة جديدة»."
              icon={<MessagesSquare className="size-6" />}
            />
          ) : (
            <ul className="space-y-2">
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => setOpenThread(m.thread)}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3 text-right transition-colors hover:bg-secondary/50"
                  >
                    <Avatar name={m.from} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{m.from}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.preview}</p>
                      {m.role && <p className="text-[11px] text-muted-foreground">{m.role}</p>}
                    </div>
                    {m.unread && <span className="size-2 rounded-full bg-destructive" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {openThread && <ThreadDialog thread={openThread} onClose={() => setOpenThread(null)} />}
      {composing && <ComposeDialog onClose={() => setComposing(false)} />}
      {postingAnnouncement && <AnnouncementDialog onClose={() => setPostingAnnouncement(false)} />}
      {editingAnnouncement && (
        <AnnouncementDialog
          existing={editingAnnouncement}
          onClose={() => setEditingAnnouncement(null)}
        />
      )}

      {deletingAnnouncement && (
        <Dialog open onOpenChange={(o) => !o && setDeletingAnnouncement(null)}>
          <DialogContent className="max-w-xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">حذف الإعلان</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              هل تريد حذف «{deletingAnnouncement.title}»؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <DialogFooter className="gap-2 sm:justify-start">
              <button
                onClick={async () => {
                  try {
                    await deleteAnnouncement.mutateAsync(deletingAnnouncement.id);
                    toast.success("تم حذف الإعلان");
                    setDeletingAnnouncement(null);
                  } catch (err) {
                    const message =
                      (err as { messageAr?: string }).messageAr ||
                      (err as Error).message ||
                      "تعذّر حذف الإعلان";
                    toast.error(message);
                  }
                }}
                disabled={deleteAnnouncement.isPending}
                className="h-10 rounded-xl bg-destructive px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                {deleteAnnouncement.isPending ? "جارٍ الحذف…" : "حذف"}
              </button>
              <button
                onClick={() => setDeletingAnnouncement(null)}
                className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
              >
                إلغاء
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ThreadDialog({ thread, onClose }: { thread: string; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useThread(thread);
  const send = useSendMessage();
  const [reply, setReply] = useState("");

  const other = data?.messages.find((m) => !m.outgoing);

  async function sendReply() {
    if (!reply.trim() || !data) return;
    const recipient = other?.sender ?? data.messages[0]?.recipient;
    if (!recipient) return;
    try {
      await send.mutateAsync({ recipient, body: reply, thread });
      setReply("");
      toast.success("تم إرسال الرسالة");
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر الإرسال";
      toast.error(message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">المحادثة</DialogTitle>
        </DialogHeader>

        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={4} />
        ) : (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {data!.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-3 text-sm ${
                  m.outgoing ? "bg-primary-soft text-primary" : "border border-border bg-card"
                }`}
              >
                <p className="text-[11px] font-semibold opacity-80">{m.sender_name}</p>
                <RichTextView html={m.body} />
                <p className="num mt-1 text-[10px] opacity-60">{m.sent_on}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="اكتب ردك…"
            className="rounded-xl"
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={sendReply}
            disabled={send.isPending || !reply.trim()}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {send.isPending ? "جارٍ الإرسال…" : "إرسال"}
          </button>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComposeDialog({ onClose }: { onClose: () => void }) {
  const contactsQuery = useContacts();
  const send = useSendMessage();
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  async function submit() {
    if (!recipient || !body.trim()) {
      toast.error("اختر المستلم واكتب نص الرسالة");
      return;
    }
    try {
      await send.mutateAsync({ recipient, body, subject });
      toast.success("تم إرسال الرسالة");
      onClose();
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر الإرسال";
      toast.error(message);
    }
  }

  const contacts = contactsQuery.data ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">رسالة جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>المستلم</Label>
            {contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {contactsQuery.isLoading ? "جارٍ التحميل…" : "لا توجد جهات اتصال متاحة"}
              </p>
            ) : (
              <Select value={recipient} onValueChange={setRecipient}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="اختر المستلم" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.user} value={c.user}>
                      {c.name} — {c.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>الموضوع</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الرسالة</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="rounded-xl"
              rows={5}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={send.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {send.isPending ? "جارٍ الإرسال…" : "إرسال"}
          </button>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Composer for a new announcement, or editor for an existing one. */
function AnnouncementDialog({
  existing,
  onClose,
}: {
  existing?: AnnouncementRow;
  onClose: () => void;
}) {
  const save = useSaveAnnouncement();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [type, setType] = useState(existing?.type_raw ?? "Announcement");
  const [audience, setAudience] = useState("All");
  const [expiresOn, setExpiresOn] = useState(existing?.expires_on ?? "");

  async function submit() {
    if (!title.trim()) {
      toast.error("العنوان مطلوب");
      return;
    }
    try {
      await save.mutateAsync({
        ...(existing ? { id: existing.id } : {}),
        title,
        body,
        type,
        audience,
        ...(expiresOn ? { expires_on: expiresOn } : {}),
      });
      toast.success(existing ? "تم تحديث الإعلان" : "تم نشر الإعلان");
      onClose();
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر نشر الإعلان";
      toast.error(message);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {existing ? "تعديل الإعلان" : "إعلان جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>العنوان</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Announcement">إعلان</SelectItem>
                  <SelectItem value="Event">حدث</SelectItem>
                  <SelectItem value="Alert">تنبيه</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الجمهور</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">الجميع</SelectItem>
                  <SelectItem value="Students">الطلاب</SelectItem>
                  <SelectItem value="Teachers">المعلمون</SelectItem>
                  <SelectItem value="Parents">أولياء الأمور</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>ينتهي في (اختياري)</Label>
            <Input
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
              className="num rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">
              بعد هذا التاريخ لن يظهر الإعلان في لوحة الإعلانات.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>النص</Label>
            <RichText
              value={body}
              onChange={setBody}
              placeholder="اكتب نص الإعلان… يمكنك التنسيق والترقيم"
              disabled={save.isPending}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : existing ? "حفظ التعديلات" : "نشر"}
          </button>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

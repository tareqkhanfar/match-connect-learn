import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  CornerUpLeft,
  FileEdit,
  Ban,
  Clock,
  FileStack,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  PenSquare,
  Search,
  Send,
  Star,
  Trash2,
  Upload,
  Users2,
  X,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichText, sanitizeHtml } from "@/components/shared/rich-text";
import { AudiencePicker, type AudienceChoice } from "@/components/shared/audience-picker";
import { RecipientPicker } from "@/components/shared/recipient-picker";
import { useConfirm } from "@/components/shared/confirm";
import { apiUpload, fileUrl } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import {
  useApplyMailTemplate,
  useDeleteMailTemplate,
  useDeleteDraft,
  useMailTemplates,
  useCancelSchedule,
  usePreviewRecipients,
  useSaveMailTemplate,
  type RecipientPreview,
  useMailFlags,
  useMailFolders,
  useMailList,
  useMailMessage,
  useMarkAllRead,
  useSendMail,
  type MailMessage,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/mail")({
  validateSearch: groupSearch,
  head: () => ({
    meta: [
      { title: "البريد — Match Education" },
      { name: "description", content: "بريد المدرسة: الوارد والصادر والأرشيف." },
    ],
  }),
  component: MailPage,
});

const MAX_FILE_MB = 15;

const FOLDER_ICON: Record<string, typeof Inbox> = {
  inbox: Inbox,
  sent: Send,
  scheduled: Clock,
  drafts: FileEdit,
  archive: Archive,
  starred: Star,
  trash: Trash2,
};

/**
 * The mailbox.
 *
 * Three panes on a desktop — folders, list, message — collapsing to one on a
 * phone, where the list gives way to the message being read. A school office
 * works this on a laptop and a parent reads it on a phone, and neither should
 * get the other's layout.
 */
function MailPage() {
  const [folder, setFolder] = useState("inbox");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState<null | { reply?: MailMessage; draft?: MailMessage }>(
    null,
  );

  const folders = useMailFolders();
  const list = useMailList(folder, search || undefined);
  const markAll = useMarkAllRead();

  const messages = list.data?.messages ?? [];

  return (
    <>
      <div className="flex h-[calc(100vh-7.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card">
        {/* Toolbar — one row, like every mail client, rather than a page
            header with buttons floating beside it. */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <button
            onClick={() => setComposing({})}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5"
          >
            <PenSquare className="size-4" />
            إنشاء
          </button>

          <div className="relative min-w-0 flex-1">
            <Search className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في المراسلات…"
              className="h-9 rounded-xl border-transparent bg-secondary pr-8 text-xs focus-visible:border-border"
            />
          </div>

          {(folders.data?.unread ?? 0) > 0 && (
            <button
              onClick={async () => {
                try {
                  const r = await markAll.mutateAsync();
                  toast.success(r.message_ar || "تم");
                } catch (err) {
                  toast.error(errorMessage(err, "تعذّر التحديث"));
                }
              }}
              className="hidden h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-secondary sm:inline-flex"
              title="تعليم كل الرسائل كمقروءة"
            >
              <CheckCheck className="size-3.5" />
              تعليم الكل
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Folders */}
          <nav className="hidden w-48 shrink-0 overflow-y-auto border-l border-border p-2 sm:block">
            <ul className="space-y-0.5">
              {(folders.data?.folders ?? []).map((f) => {
                const Icon = FOLDER_ICON[f.key] ?? Inbox;
                const active = folder === f.key;
                const unread = f.key === "inbox" ? (folders.data?.unread ?? 0) : 0;
                return (
                  <li key={f.key}>
                    <button
                      onClick={() => {
                        setFolder(f.key);
                        setOpenId(null);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-right text-[13px] transition-colors ${
                        active ? "bg-primary-soft font-bold text-primary" : "hover:bg-secondary"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{f.label}</span>
                      {unread > 0 ? (
                        <span className="num rounded bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                          {unread}
                        </span>
                      ) : f.count > 0 ? (
                        <span className="num text-[10px] text-muted-foreground">{f.count}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Message list — dense rows separated by lines, not floating cards. */}
          <div
            className={`min-w-0 shrink-0 overflow-y-auto border-l border-border ${
              openId ? "hidden w-[360px] lg:block" : "w-full lg:w-[360px]"
            }`}
          >
            {list.isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
            ) : messages.length === 0 ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div className="text-muted-foreground">
                  <Mail className="mx-auto size-9 opacity-40" />
                  <p className="mt-2 text-sm">
                    لا رسائل في {list.data?.folder_label ?? "هذا المجلد"}
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {messages.map((m) => (
                  <MailRow
                    key={m.id}
                    message={m}
                    folder={folder}
                    selected={openId === m.id}
                    onOpen={() =>
                      folder === "drafts" ? setComposing({ draft: m }) : setOpenId(m.id)
                    }
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Reading pane */}
          <div className={`min-w-0 flex-1 ${openId ? "" : "hidden lg:block"}`}>
            {openId ? (
              <ReadingPane
                message={openId}
                onReply={(m) => setComposing({ reply: m })}
                onClose={() => setOpenId(null)}
              />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center">
                <div className="text-muted-foreground">
                  <Mail className="mx-auto size-10 opacity-30" />
                  <p className="mt-2 text-sm">اختر رسالة لقراءتها</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {composing && (
        <Composer
          reply={composing.reply}
          draft={composing.draft}
          onClose={() => setComposing(null)}
        />
      )}
    </>
  );
}

/**
 * One row in the message list.
 *
 * Dense and separated by a rule, the way a mail client packs a screenful:
 * sender, subject, snippet, date, with the actions appearing on hover rather
 * than taking permanent space. Unread is bold with a dot, which is the
 * convention every reader already knows.
 */
function MailRow({
  message: m,
  folder,
  selected,
  onOpen,
}: {
  message: MailMessage;
  folder: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const flags = useMailFlags();
  const who = m.audience_label
    ? `${m.audience_label} (${m.audience_count})`
    : m.outgoing
      ? m.recipients.map((r) => r.name).join("، ") || "—"
      : m.sender_name;
  const unread = !m.is_read && !m.outgoing;

  async function flag(patch: Record<string, number>) {
    try {
      await flags.mutateAsync({ message: m.id, ...patch });
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التحديث"));
    }
  }

  return (
    <li
      className={`group relative cursor-pointer transition-colors ${
        selected
          ? "bg-primary-soft"
          : unread
            ? "bg-card hover:bg-secondary/50"
            : "hover:bg-secondary/50"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className="flex items-start gap-2 px-3 py-2.5"
      >
        {/* The unread dot sits where a reader's eye already scans for it. */}
        <span className="mt-1.5 flex w-2 shrink-0 justify-center">
          {unread && <span className="size-2 rounded-full bg-primary" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span
              className={`min-w-0 flex-1 truncate text-[13px] ${unread ? "font-black" : "font-semibold"}`}
            >
              {m.outgoing ? `إلى: ${who}` : who}
            </span>
            <span className="num shrink-0 text-[10px] text-muted-foreground">
              {(m.sent_on || "").slice(5, 16)}
            </span>
          </span>

          <span className="flex items-center gap-1.5">
            <span className={`min-w-0 flex-1 truncate text-xs ${unread ? "font-bold" : ""}`}>
              {m.subject}
            </span>
            {m.my_kind === "cc" && <Pill tone="muted">نسخة</Pill>}
            {m.is_draft && <Pill tone="warning">مسودة</Pill>}
            {m.attachments.length > 0 && (
              <Paperclip className="size-3 shrink-0 text-muted-foreground" />
            )}
          </span>

          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {m.preview}
          </span>
        </span>
      </div>

      {/* Row actions, revealed on hover — permanent buttons on every row make
          a list of forty look like a control panel. */}
      <span className="absolute left-2 top-2 hidden gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-sm group-hover:flex">
        <button
          onClick={() => void flag({ is_starred: m.is_starred ? 0 : 1 })}
          className="rounded p-1 hover:bg-secondary"
          title={m.is_starred ? "إزالة التمييز" : "تمييز"}
        >
          <Star
            className={`size-3.5 ${m.is_starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
          />
        </button>
        {!m.outgoing && (
          <button
            onClick={() => void flag({ is_read: m.is_read ? 0 : 1 })}
            className="rounded p-1 text-muted-foreground hover:bg-secondary"
            title={m.is_read ? "تعليم كغير مقروءة" : "تعليم كمقروءة"}
          >
            {m.is_read ? <Mail className="size-3.5" /> : <MailOpen className="size-3.5" />}
          </button>
        )}
        {folder !== "trash" && (
          <button
            onClick={() => void flag({ is_archived: m.is_archived ? 0 : 1 })}
            className="rounded p-1 text-muted-foreground hover:bg-secondary"
            title={m.is_archived ? "إرجاع للوارد" : "أرشفة"}
          >
            {m.is_archived ? (
              <ArchiveRestore className="size-3.5" />
            ) : (
              <Archive className="size-3.5" />
            )}
          </button>
        )}
        <button
          onClick={() => void flag({ is_deleted: folder === "trash" ? 0 : 1 })}
          className="rounded p-1 text-destructive hover:bg-destructive-soft"
          title={folder === "trash" ? "استعادة" : "حذف"}
        >
          <Trash2 className="size-3.5" />
        </button>
      </span>
    </li>
  );
}

/** The message beside the list, as a mail client shows it. */
function ReadingPane({
  message,
  onReply,
  onClose,
}: {
  message: string;
  onReply: (m: MailMessage) => void;
  onClose: () => void;
}) {
  const query = useMailMessage(message);
  const m = query.data;

  if (query.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
      </div>
    );
  }
  if (!m) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-sm text-muted-foreground">تعذّر عرض الرسالة.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border p-3.5">
        <h2 className="text-base font-black">{m.subject}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* A closed message says so where the reply button was, rather than
              leaving a gap the reader has to interpret. The server refuses the
              reply either way. */}
          {m.no_reply ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[11px] font-semibold text-muted-foreground">
              <Ban className="size-3.5" />
              لا تقبل الردود
            </span>
          ) : (
            <button
              onClick={() => onReply(m)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-xs font-bold text-primary-foreground"
            >
              <CornerUpLeft className="size-3.5" />
              رد
            </button>
          )}
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl border border-border hover:bg-secondary"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
        {m.is_scheduled && <ScheduledBanner message={m} />}
        {m.send_failed_reason && (
          <p className="rounded-xl border border-destructive/40 bg-destructive-soft p-2.5 text-xs font-semibold text-destructive">
            {m.send_failed_reason}
          </p>
        )}
        <MessageBody m={m} />
        {(m.thread_messages ?? []).length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-bold text-muted-foreground">بقية المحادثة</p>
            {(m.thread_messages ?? []).map((t) => (
              <div key={t.id} className="rounded-xl border border-border p-2.5">
                <MessageBody m={t} compact />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The header and body of one message, shared by the pane and the thread. */
function MessageBody({ m, compact }: { m: MailMessage; compact?: boolean }) {
  const to = m.recipients.filter((r) => r.kind === "to");
  const cc = m.recipients.filter((r) => r.kind === "cc");
  const bcc = m.recipients.filter((r) => r.kind === "bcc");

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-black text-primary-foreground">
          {(m.sender_name || "؟").trim().charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-[13px] font-bold">{m.sender_name}</span>
            <span className="num text-[11px] text-muted-foreground">
              {(m.sent_on || "").slice(0, 16)}
            </span>
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
            {m.audience_label ? (
              <span>
                إلى: {m.audience_label} <span className="num">({m.audience_count} مستلماً)</span>
              </span>
            ) : (
              to.length > 0 && <span>إلى: {to.map((r) => r.name).join("، ")}</span>
            )}
            {cc.length > 0 && <span>نسخة: {cc.map((r) => r.name).join("، ")}</span>}
            {/* Only ever populated for the sender and the blind recipient
                themselves; the server strips it for everyone else. */}
            {bcc.length > 0 && <span>مخفية: {bcc.map((r) => r.name).join("، ")}</span>}
          </p>
        </div>
      </div>

      <div
        className={`prose prose-sm mt-3 max-w-none leading-relaxed ${compact ? "text-xs" : "text-sm"}`}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.body ?? "") }}
      />

      {m.attachments.length > 0 && (
        <div className="mt-3 border-t border-border pt-2.5">
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">
            {m.attachments.length} مرفقاً
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {m.attachments.map((a) => (
              <li key={a.file_url}>
                <a
                  href={fileUrl(a.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary"
                >
                  <Paperclip className="size-3.5 text-muted-foreground" />
                  <span className="max-w-40 truncate">{a.file_name}</span>
                  <span className="num text-[10px] text-muted-foreground">
                    {Math.round((a.file_size || 0) / 1024)} ك.ب
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A message waiting for its send time, and the way back out of it. */
function ScheduledBanner({ message }: { message: MailMessage }) {
  const cancel = useCancelSchedule();
  const confirm = useConfirm();

  async function pull() {
    const ok = await confirm({
      title: "سحب الرسالة المجدولة؟",
      description: "ستعود إلى المسودات ويمكنك تعديلها وإرسالها لاحقاً.",
      confirmLabel: "سحب",
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync({ message: message.id });
      toast.success("أُعيدت إلى المسودات");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر السحب"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-2.5">
      <Clock className="size-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-1 text-xs font-semibold">
        مجدولة للإرسال في <span className="num">{message.scheduled_for.slice(0, 16)}</span>
      </p>
      <button
        onClick={() => void pull()}
        disabled={cancel.isPending}
        className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50"
      >
        سحب وإعادتها مسودة
      </button>
    </div>
  );
}

/** Writing a message. */
function Composer({
  reply,
  draft,
  onClose,
}: {
  reply?: MailMessage | undefined;
  draft?: MailMessage | undefined;
  onClose: () => void;
}) {
  const send = useSendMail();
  const discard = useDeleteDraft();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);

  // A reply goes back to one person, so it starts in the named-people mode
  // with the sender filled in; a fresh message starts on the audience.
  const [choice, setChoice] = useState<AudienceChoice>({
    groups: [],
    users: reply
      ? [reply.sender]
      : (draft?.recipients ?? []).filter((r) => r.kind === "to").map((r) => r.user),
    ...(draft?.audience_key
      ? { audience: draft.audience_key, audienceLabel: draft.audience_label ?? undefined }
      : {}),
  });
  const [cc, setCc] = useState<string[]>(
    (draft?.recipients ?? []).filter((r) => r.kind === "cc").map((r) => r.user),
  );
  const [bcc, setBcc] = useState<string[]>(
    (draft?.recipients ?? []).filter((r) => r.kind === "bcc").map((r) => r.user),
  );
  const [showCc, setShowCc] = useState(cc.length > 0 || bcc.length > 0);
  const [subject, setSubject] = useState(
    reply
      ? reply.subject.startsWith("رد: ")
        ? reply.subject
        : `رد: ${reply.subject}`
      : (draft?.subject ?? ""),
  );
  const [body, setBody] = useState(draft?.body ?? "");
  const [files, setFiles] = useState(draft?.attachments ?? []);
  const [uploading, setUploading] = useState(0);

  // How the message goes out, as opposed to what it says.
  const [noReply, setNoReply] = useState(Boolean(draft?.no_reply));
  const [copyGuardians, setCopyGuardians] = useState(Boolean(draft?.copy_guardians));
  const [scheduledFor, setScheduledFor] = useState(
    draft?.scheduled_for ? draft.scheduled_for.slice(0, 16) : "",
  );
  const [showTemplates, setShowTemplates] = useState(false);
  const [preview, setPreview] = useState<RecipientPreview[] | null>(null);
  const [previewGroups, setPreviewGroups] = useState<
    Array<{ kind: string; label: string; count: number }>
  >([]);

  const previewRecipients = usePreviewRecipients();
  const applyTemplate = useApplyMailTemplate();

  /** What the server would resolve this to — asked before sending, not after. */
  async function runPreview() {
    try {
      const res = await previewRecipients.mutateAsync({
        to: choice.users,
        cc,
        bcc,
        ...(choice.audience ? { audience: choice.audience, audience_groups: choice.groups } : {}),
        copy_guardians: copyGuardians ? 1 : 0,
      });
      setPreview(res.recipients);
      setPreviewGroups(res.groups);
      if (res.total === 0) toast.error("لن تصل الرسالة إلى أحد بهذا التحديد.");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حساب المستلمين"));
    }
  }

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const chosen = Array.from(list);
    setUploading(chosen.length);
    const added: Array<{ file_url: string; file_name: string | null; file_size: number }> = [];
    for (const file of chosen) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name}: أكبر من ${MAX_FILE_MB} ميجابايت`);
        continue;
      }
      try {
        const res = await apiUpload<{ file_url: string; file_name: string; file_size: number }>(
          "mail.upload_attachment",
          file,
          draft ? { message: draft.id } : {},
        );
        added.push(res);
      } catch (err) {
        toast.error(errorMessage(err, `تعذّر رفع ${file.name}`));
      }
    }
    setUploading(0);
    if (added.length) setFiles((f) => [...f, ...added]);
    if (input.current) input.current.value = "";
  }

  async function submit(asDraft: boolean) {
    if (!asDraft && !choice.audience && choice.users.length === 0) {
      toast.error("اختر جمهوراً أو أضف مستلماً واحداً على الأقل");
      return;
    }
    if (!asDraft && !subject.trim()) {
      toast.error("عنوان الرسالة مطلوب");
      return;
    }
    try {
      const res = await send.mutateAsync({
        ...(draft ? { message: draft.id } : {}),
        subject,
        body,
        to: choice.users,
        cc,
        bcc,
        ...(choice.audience ? { audience: choice.audience, audience_groups: choice.groups } : {}),
        is_draft: asDraft ? 1 : 0,
        no_reply: noReply ? 1 : 0,
        copy_guardians: copyGuardians ? 1 : 0,
        // The input gives "YYYY-MM-DDTHH:mm"; the server wants a space.
        ...(scheduledFor && !asDraft
          ? { scheduled_for: `${scheduledFor.replace("T", " ")}:00` }
          : {}),
        ...(reply ? { reply_to: reply.id } : {}),
        attachments: files.map((f) => ({
          file_url: f.file_url,
          file_name: f.file_name ?? "",
          file_size: f.file_size,
        })),
      });
      toast.success(
        res.message_ar ||
          (asDraft ? "تم حفظ المسودة" : scheduledFor ? "تمت جدولة الرسالة" : "تم الإرسال"),
      );
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الإرسال"));
    }
  }

  async function drop() {
    if (!draft) return onClose();
    const ok = await confirm({
      title: "حذف المسودة؟",
      description: "سيُحذف ما كُتب ومرفقاته.",
    });
    if (!ok) return;
    try {
      await discard.mutateAsync({ message: draft.id });
      toast.success("تم حذف المسودة");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailOpen className="size-5 text-primary" />
            {reply ? "رد على رسالة" : draft ? "متابعة المسودة" : "رسالة جديدة"}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-2.5 overflow-y-auto p-1">
          <AudiencePicker value={choice} onChange={setChoice} />
          {showCc ? (
            <>
              <RecipientPicker label="نسخة" value={cc} onChange={setCc} />
              <RecipientPicker label="نسخة مخفية" value={bcc} onChange={setBcc} />
              <p className="text-[11px] text-muted-foreground">
                المستلمون في «نسخة مخفية» لا يظهرون لبقية المستلمين.
              </p>
            </>
          ) : (
            <button
              onClick={() => setShowCc(true)}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              + إضافة نسخة / نسخة مخفية
            </button>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>الموضوع</Label>
              <button
                onClick={() => setShowTemplates(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold hover:bg-primary-soft hover:text-primary"
              >
                <FileStack className="size-3.5" />
                القوالب
              </button>
            </div>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>نص الرسالة</Label>
            <RichText value={body} onChange={setBody} placeholder="اكتب رسالتك…" minHeight={140} />
          </div>

          {/* How it goes out. Kept together and below the body so writing the
              message is not interrupted by decisions about delivering it. */}
          <div className="space-y-2 rounded-xl border border-border p-3">
            <label className="flex items-start gap-2.5">
              <Switch checked={copyGuardians} onCheckedChange={setCopyGuardians} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">إرسال نسخة لأولياء أمور الطلاب</span>
                <span className="block text-[11px] text-muted-foreground">
                  تُضاف تلقائياً لكل طالب من المستلمين، حتى لو لم تحدّد وليّ أمره.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5">
              <Switch checked={noReply} onCheckedChange={setNoReply} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">منع الرد على الرسالة</span>
                <span className="block text-[11px] text-muted-foreground">
                  مناسب للتعاميم — لن يظهر زر الرد للمستلمين.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-52 flex-1 space-y-1.5">
                <Label className="text-xs">موعد الإرسال (اختياري)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              {scheduledFor && (
                <button
                  onClick={() => setScheduledFor("")}
                  className="h-10 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-secondary"
                >
                  إرسال فوري
                </button>
              )}
            </div>
            {scheduledFor && (
              <p className="text-[11px] text-muted-foreground">
                تبقى في مجلد «المجدولة» حتى موعدها، ويمكنك سحبها قبل ذلك.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <button
                onClick={() => void runPreview()}
                disabled={previewRecipients.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary disabled:opacity-50"
              >
                {previewRecipients.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Users2 className="size-3.5" />
                )}
                معاينة المستلمين
              </button>
              {previewGroups.map((g) => (
                <Pill key={g.kind} tone="info">
                  {g.label}: <span className="num">{g.count}</span>
                </Pill>
              ))}
            </div>

            {preview && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                <ul className="divide-y divide-border text-xs">
                  {preview.map((r) => (
                    <li key={r.user} className="flex items-center gap-2 px-2.5 py-1.5">
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {r.kind === "student"
                          ? "طالب"
                          : r.kind === "guardian"
                            ? "وليّ أمر"
                            : "موظف"}
                        {r.copy === "cc" ? " · نسخة" : r.copy === "bcc" ? " · مخفية" : ""}
                      </span>
                      {/* A disabled account is still stored as a recipient but
                          nobody reads it, which is worth saying before sending. */}
                      {!r.enabled && <Pill tone="danger">معطّل</Pill>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>المرفقات ({files.length})</Label>
              <button
                onClick={() => input.current?.click()}
                disabled={uploading > 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary disabled:opacity-50"
              >
                {uploading > 0 ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    جارٍ رفع {uploading}…
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    إرفاق ملفات
                  </>
                )}
              </button>
              <input
                ref={input}
                type="file"
                multiple
                onChange={(e) => void pick(e.target.files)}
                className="hidden"
              />
            </div>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li
                    key={f.file_url}
                    className="flex items-center gap-2 rounded-lg border border-border p-1.5"
                  >
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-xs">{f.file_name}</span>
                    <button
                      onClick={() => setFiles((l) => l.filter((_, idx) => idx !== i))}
                      className="rounded p-0.5 text-destructive hover:bg-destructive-soft"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          {draft && (
            <button
              onClick={() => void drop()}
              className="mr-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive hover:bg-destructive-soft"
            >
              <Trash2 className="size-4" />
              حذف المسودة
            </button>
          )}
          <button
            onClick={() => void submit(true)}
            disabled={send.isPending}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-40"
          >
            حفظ كمسودة
          </button>
          <button
            onClick={() => void submit(false)}
            disabled={send.isPending || uploading > 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-4" />
            {send.isPending ? "جارٍ الإرسال…" : "إرسال"}
          </button>
        </DialogFooter>
      </DialogContent>

      {showTemplates && (
        <TemplatePicker
          currentSubject={subject}
          currentBody={body}
          onClose={() => setShowTemplates(false)}
          onPick={async (template) => {
            const filled = await applyTemplate.mutateAsync({
              template,
              ...(choice.groups[0] ? { student_group: choice.groups[0] } : {}),
            });
            if (filled.subject) setSubject(filled.subject);
            if (filled.body) setBody(filled.body);
            setShowTemplates(false);
            toast.success("تم تطبيق القالب.");
          }}
        />
      )}
    </Dialog>
  );
}

/**
 * Pick, keep or delete a message template.
 *
 * A template is a message a teacher writes often enough to be worth keeping.
 * Placeholders are filled by the server when one is applied, so the tokens
 * have a single meaning wherever a template is used.
 */
function TemplatePicker({
  currentSubject,
  currentBody,
  onPick,
  onClose,
}: {
  currentSubject: string;
  currentBody: string;
  onPick: (template: string) => Promise<void>;
  onClose: () => void;
}) {
  const { data, isLoading } = useMailTemplates();
  const saveTemplate = useSaveMailTemplate();
  const deleteTemplate = useDeleteMailTemplate();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [shared, setShared] = useState(false);

  const templates = data?.templates ?? [];

  async function keepCurrent() {
    if (!title.trim()) {
      toast.error("اسم القالب مطلوب");
      return;
    }
    try {
      await saveTemplate.mutateAsync({
        title: title.trim(),
        subject: currentSubject,
        body: currentBody,
        is_shared: shared ? 1 : 0,
      });
      toast.success("تم حفظ القالب");
      setSaving(false);
      setTitle("");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ القالب"));
    }
  }

  async function remove(template: string, name: string) {
    const ok = await confirm({
      title: `حذف القالب «${name}»؟`,
      description: "لن يؤثر ذلك على الرسائل المُرسلة.",
      confirmLabel: "حذف",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteTemplate.mutateAsync({ template });
      toast.success("تم حذف القالب");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="size-5 text-primary" />
            قوالب الرسائل
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
          {isLoading ? (
            <TableSkeleton rows={3} />
          ) : templates.length === 0 ? (
            <EmptyBlock
              title="لا توجد قوالب بعد"
              description="احفظ رسالتك الحالية كقالب لاستخدامها لاحقاً."
              icon={<FileStack className="size-6" />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {templates.map((t) => (
                <li key={t.name} className="flex items-start gap-2 py-2.5">
                  <button onClick={() => void onPick(t.name)} className="min-w-0 flex-1 text-start">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{t.title}</span>
                      <Pill>{t.category}</Pill>
                      {!t.mine && <Pill tone="info">من {t.owner_name}</Pill>}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.subject || "بلا عنوان"}
                    </p>
                  </button>
                  {t.mine && (
                    <button
                      onClick={() => void remove(t.name, t.title)}
                      className="shrink-0 rounded p-1 text-destructive hover:bg-destructive-soft"
                      aria-label="حذف القالب"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-border p-3">
            {saving ? (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">اسم القالب</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: إشعار غياب"
                    className="rounded-xl"
                    autoFocus
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={shared} onCheckedChange={setShared} />
                  مشاركته مع الزملاء (للقراءة فقط)
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => void keepCurrent()}
                    disabled={saveTemplate.isPending}
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    حفظ
                  </button>
                  <button
                    onClick={() => setSaving(false)}
                    className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSaving(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + حفظ الرسالة الحالية كقالب
              </button>
            )}
          </div>

          {(data?.placeholders.length ?? 0) > 0 && (
            <p className="text-[11px] text-muted-foreground">
              رموز تُستبدل تلقائياً عند الاستخدام:{" "}
              {data!.placeholders.map((p) => p.token).join("، ")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

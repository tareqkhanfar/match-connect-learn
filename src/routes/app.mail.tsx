import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  CornerUpLeft,
  FileEdit,
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
  X,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useDeleteDraft,
  useMailFlags,
  useMailFolders,
  useMailList,
  useMailMessage,
  useMarkAllRead,
  useSendMail,
  type MailMessage,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/mail")({
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
      <PageHeader
        title="البريد"
        subtitle="رسائل المدرسة — الوارد والصادر والأرشيف"
        actions={
          <div className="flex gap-2">
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
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:bg-secondary"
              >
                <CheckCheck className="size-4" />
                تعليم الكل كمقروء
              </button>
            )}
            <button
              onClick={() => setComposing({})}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5"
            >
              <PenSquare className="size-4" />
              رسالة جديدة
            </button>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[190px_minmax(0,360px)_minmax(0,1fr)]">
        <nav className="card-surface h-fit p-2">
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
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-right text-sm transition-colors ${
                      active ? "bg-primary-soft font-bold text-primary" : "hover:bg-secondary"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{f.label}</span>
                    {unread > 0 ? (
                      <span className="num rounded-md bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
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

        <div className="min-w-0">
          <div className="relative mb-2.5">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في العنوان أو النص أو المرسِل…"
              className="h-10 rounded-xl pr-9"
            />
          </div>

          {list.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
          ) : messages.length === 0 ? (
            <EmptyBlock
              title={`لا رسائل في ${list.data?.folder_label ?? "هذا المجلد"}`}
              description="ستظهر الرسائل هنا فور وصولها."
              icon={<Mail className="size-6" />}
            />
          ) : (
            <ul className="space-y-1.5">
              {messages.map((m) => (
                <MailRow
                  key={m.id}
                  message={m}
                  folder={folder}
                  onOpen={() =>
                    folder === "drafts" ? setComposing({ draft: m }) : setOpenId(m.id)
                  }
                />
              ))}
            </ul>
          )}
        </div>

        <div className="hidden min-w-0 lg:block">
          {openId ? (
            <ReadingPane
              message={openId}
              onReply={(m) => setComposing({ reply: m })}
              onClose={() => setOpenId(null)}
            />
          ) : (
            <div className="card-surface grid h-full min-h-80 place-items-center p-6 text-center">
              <div className="text-muted-foreground">
                <Mail className="mx-auto size-10 opacity-40" />
                <p className="mt-2 text-sm">اختر رسالة لقراءتها</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* On a phone the reading pane takes the screen, which is the only
          layout that works there. */}
      {openId && (
        <div className="lg:hidden">
          <MessageView
            message={openId}
            onClose={() => setOpenId(null)}
            onReply={(m) => {
              setOpenId(null);
              setComposing({ reply: m });
            }}
          />
        </div>
      )}
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

/** One row in the list. Unread is bold, as every mail client has taught. */
function MailRow({
  message: m,
  folder,
  onOpen,
}: {
  message: MailMessage;
  folder: string;
  onOpen: () => void;
}) {
  const flags = useMailFlags();
  // An audience send reads as its audience. Listing two hundred guardians in
  // a row is unreadable and tells the sender nothing they did not know.
  const people = m.audience_label
    ? `${m.audience_label} (${m.audience_count})`
    : m.recipients.map((r) => r.name).join("، ");

  async function flag(patch: Record<string, number>) {
    try {
      await flags.mutateAsync({ message: m.id, ...patch });
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التحديث"));
    }
  }

  return (
    <li
      className={`card-surface flex items-start gap-2 p-2.5 transition-colors hover:bg-secondary/40 ${
        !m.is_read && !m.outgoing ? "border-r-4 border-r-primary" : ""
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          void flag({ is_starred: m.is_starred ? 0 : 1 });
        }}
        className="mt-0.5 shrink-0"
        aria-label="تمييز"
      >
        <Star
          className={`size-4 ${m.is_starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
        />
      </button>

      <button onClick={onOpen} className="min-w-0 flex-1 text-right">
        <span className="flex items-center gap-1.5">
          <span
            className={`truncate text-sm ${!m.is_read && !m.outgoing ? "font-black" : "font-semibold"}`}
          >
            {m.outgoing ? `إلى: ${people || "—"}` : m.sender_name}
          </span>
          {m.my_kind === "cc" && <Pill tone="muted">نسخة</Pill>}
          {m.my_kind === "bcc" && <Pill tone="muted">مخفية</Pill>}
          {m.is_draft && <Pill tone="warning">مسودة</Pill>}
          {m.attachments.length > 0 && (
            <Paperclip className="size-3 shrink-0 text-muted-foreground" />
          )}
        </span>
        <span className={`block truncate text-xs ${!m.is_read && !m.outgoing ? "font-bold" : ""}`}>
          {m.subject}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">{m.preview}</span>
      </button>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="num text-[10px] text-muted-foreground">
          {(m.sent_on || "").slice(0, 16)}
        </span>
        <span className="flex gap-0.5">
          {folder !== "trash" && (
            <button
              onClick={() => void flag({ is_archived: m.is_archived ? 0 : 1 })}
              className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
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
            className="rounded-lg p-1 text-destructive hover:bg-destructive-soft"
            title={folder === "trash" ? "استعادة" : "نقل للمحذوفات"}
          >
            <Trash2 className="size-3.5" />
          </button>
        </span>
      </span>
    </li>
  );
}

/** Reading one message, with the rest of its thread underneath. */
function MessageView({
  message,
  onClose,
  onReply,
}: {
  message: string;
  onClose: () => void;
  onReply: (m: MailMessage) => void;
}) {
  const query = useMailMessage(message);
  const m = query.data;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="pl-6">{m?.subject ?? "الرسالة"}</DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : !m ? (
          <p className="py-10 text-center text-sm text-muted-foreground">تعذّر عرض الرسالة.</p>
        ) : (
          <div className="max-h-[62vh] space-y-3 overflow-y-auto p-1">
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
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إغلاق
          </button>
          {m && (
            <button
              onClick={() => onReply(m)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground"
            >
              <CornerUpLeft className="size-4" />
              رد
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessageBody({ m, compact }: { m: MailMessage; compact?: boolean }) {
  const to = m.recipients.filter((r) => r.kind === "to");
  const cc = m.recipients.filter((r) => r.kind === "cc");
  const bcc = m.recipients.filter((r) => r.kind === "bcc");

  return (
    <div>
      <p className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-bold">{m.sender_name}</span>
        <span className="num text-muted-foreground">{(m.sent_on || "").slice(0, 16)}</span>
      </p>
      <p className="mt-0.5 space-x-2 text-[11px] text-muted-foreground">
        {m.audience_label ? (
          <span>
            إلى: {m.audience_label} <span className="num">({m.audience_count} مستلماً)</span>
          </span>
        ) : (
          to.length > 0 && <span>إلى: {to.map((r) => r.name).join("، ")}</span>
        )}
        {cc.length > 0 && <span>· نسخة: {cc.map((r) => r.name).join("، ")}</span>}
        {/* Only ever populated for the sender and the blind recipient; the
            server strips it for everyone else. */}
        {bcc.length > 0 && <span>· مخفية: {bcc.map((r) => r.name).join("، ")}</span>}
      </p>
      <div
        className={`prose prose-sm mt-2 max-w-none leading-relaxed ${compact ? "text-xs" : "text-sm"}`}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.body ?? "") }}
      />
      {m.attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {m.attachments.map((a) => (
            <li key={a.file_url}>
              <a
                href={fileUrl(a.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-[11px] font-semibold hover:bg-primary-soft hover:text-primary"
              >
                <Paperclip className="size-3" />
                {a.file_name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
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
      <div className="card-surface grid h-full min-h-80 place-items-center">
        <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
      </div>
    );
  }
  if (!m) {
    return (
      <div className="card-surface grid h-full min-h-80 place-items-center">
        <p className="text-sm text-muted-foreground">تعذّر عرض الرسالة.</p>
      </div>
    );
  }

  return (
    <div className="card-surface flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border p-3.5">
        <h2 className="text-base font-black">{m.subject}</h2>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => onReply(m)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-xs font-bold text-primary-foreground"
          >
            <CornerUpLeft className="size-3.5" />
            رد
          </button>
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
        ...(reply ? { reply_to: reply.id } : {}),
        attachments: files.map((f) => ({
          file_url: f.file_url,
          file_name: f.file_name ?? "",
          file_size: f.file_size,
        })),
      });
      toast.success(res.message_ar || (asDraft ? "تم حفظ المسودة" : "تم الإرسال"));
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
            <Label>الموضوع</Label>
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
    </Dialog>
  );
}

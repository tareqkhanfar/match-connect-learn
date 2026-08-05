import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Eye,
  Maximize2,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { RichText, RichTextView } from "@/components/shared/rich-text";
import { FileList, FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { SearchableMultiSelect } from "@/components/shared/searchable-select";
import {
  useAudience,
  useConversation,
  useInbox,
  useSendChat,
  type ConversationMessage,
} from "@/lib/api/hooks";
import { Input } from "@/components/ui/input";

type Panel = "list" | "thread" | "compose";
type Target = "people" | "groups" | "courses";

const TARGET_META: Record<Target, { label: string; icon: typeof Users; hint: string }> = {
  people: { label: "أشخاص", icon: Users, hint: "اختر مستلمين بالاسم" },
  groups: { label: "شُعب", icon: Users, hint: "إرسال لكل طلاب الشعبة" },
  courses: { label: "مواد", icon: BookOpen, hint: "إرسال لكل المسجّلين في المادة" },
};

/**
 * A floating chat launcher, available on every page.
 *
 * Three panels share one popover: the conversation list, an open thread, and
 * the composer.
 */
export function ChatWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("list");
  const [thread, setThread] = useState<string | null>(null);

  const inbox = useInbox(30);
  const unread = (inbox.data ?? []).reduce((a, m) => a + (m.unread_count ?? 0), 0);

  function openThread(id: string) {
    setThread(id);
    setPanel("thread");
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `المحادثات (${unread} غير مقروء)` : "المحادثات"}
        className="fixed bottom-5 left-5 z-40 grid size-14 place-items-center rounded-2xl bg-brand-gradient text-primary-foreground shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        {!open && unread > 0 && (
          <span className="num absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          dir="rtl"
          className="fixed bottom-24 left-5 z-40 flex h-[min(70vh,34rem)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          {panel === "list" && (
            <ConversationList
              onOpen={openThread}
              onCompose={() => setPanel("compose")}
              onClose={() => setOpen(false)}
              onExpand={() => {
                setOpen(false);
                void navigate({ to: "/app/chat" });
              }}
            />
          )}
          {panel === "thread" && thread && (
            <ThreadPanel thread={thread} onBack={() => setPanel("list")} />
          )}
          {panel === "compose" && (
            <ComposePanel onBack={() => setPanel("list")} onSent={() => setPanel("list")} />
          )}
        </div>
      )}
    </>
  );
}

function PanelHeader({
  title,
  subtitle,
  onBack,
  onClose,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  onBack?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-3">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="رجوع"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowRight className="size-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{title}</p>
        {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function ConversationList({
  onOpen,
  onCompose,
  onClose,
  onExpand,
}: {
  onOpen: (thread: string) => void;
  onCompose: () => void;
  onClose: () => void;
  onExpand: () => void;
}) {
  const { data, isLoading } = useInbox(30);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const all = data ?? [];
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter(
      (m) =>
        (m.from ?? "").toLowerCase().includes(q) ||
        (m.subject ?? "").toLowerCase().includes(q) ||
        (m.preview ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <>
      <PanelHeader
        title="المحادثات"
        onClose={onClose}
        action={
          <span className="flex items-center gap-1.5">
            <button
              onClick={onExpand}
              title="فتح صفحة المحادثات الكاملة"
              aria-label="فتح صفحة المحادثات الكاملة"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Maximize2 className="size-4" />
            </button>
            <button
              onClick={onCompose}
              className="rounded-lg bg-brand-gradient px-2.5 py-1.5 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              جديدة
            </button>
          </span>
        }
      />

      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في المحادثات…"
            className="h-9 rounded-lg pr-8 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {query ? "لا توجد نتائج." : "لا توجد محادثات بعد."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => onOpen(m.thread)}
                  className="flex w-full items-start gap-3 px-3 py-3 text-right transition-colors hover:bg-secondary"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                    {(m.from ?? "?").trim().slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{m.from}</span>
                      {m.unread_count > 0 && (
                        <span className="num shrink-0 rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-4 text-white">
                          {m.unread_count}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {m.subject ? `${m.subject} — ` : ""}
                      {m.preview}
                    </span>
                    <span className="num mt-0.5 block text-[10px] text-muted-foreground">
                      {m.role} • {(m.time ?? "").slice(0, 16)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ThreadPanel({ thread, onBack }: { thread: string; onBack: () => void }) {
  const { data, isLoading } = useConversation(thread);
  const send = useSendChat();
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [attaching, setAttaching] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);

  async function submit() {
    const plain = reply.replace(/<[^>]*>/g, "").trim();
    if (!plain && files.length === 0) return;

    // Reply to whoever is not us; on a fresh thread that is the only other party.
    const recipient =
      data?.messages.find((m) => !m.outgoing)?.sender ?? data?.messages[0]?.recipient;
    if (!recipient) {
      toast.error("تعذّر تحديد المستلم");
      return;
    }

    try {
      await send.mutateAsync({
        body: reply,
        recipients: [recipient],
        thread,
        ...(files.length ? { files } : {}),
      });
      setReply("");
      setFiles([]);
      setAttaching(false);
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر الإرسال";
      toast.error(message);
    }
  }

  return (
    <>
      <PanelHeader
        title={data?.participants.map((p) => p.name).join("، ") || "المحادثة"}
        subtitle={data?.subject ?? undefined}
        onBack={onBack}
      />

      {data?.observing && (
        <p className="flex items-center gap-2 border-b border-border bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          <Eye className="size-3.5 shrink-0" />
          أنت تطالع هذه المحادثة بصلاحية الإدارة.
        </p>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : (
          (data?.messages ?? []).map((m) => <Bubble key={m.id} message={m} />)
        )}
        <div ref={endRef} />
      </div>

      {!data?.observing && (
        <div className="border-t border-border p-2">
          {attaching && (
            <div className="mb-2">
              <FileUpload files={files} onChange={setFiles} maxFiles={5} hint="حتى ٥ ملفات" />
            </div>
          )}
          <RichText
            value={reply}
            onChange={setReply}
            placeholder="اكتب رسالتك…"
            minHeight={72}
            disabled={send.isPending}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={submit}
              disabled={send.isPending}
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-gradient text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
            >
              <Send className="size-4" />
              {send.isPending ? "جارٍ الإرسال…" : "إرسال"}
            </button>
            <button
              onClick={() => setAttaching((a) => !a)}
              aria-label="إرفاق ملف"
              className={`grid size-9 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary ${
                attaching || files.length ? "bg-primary-soft text-primary" : "text-muted-foreground"
              }`}
            >
              <Paperclip className="size-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({ message }: { message: ConversationMessage }) {
  return (
    <div className={`flex ${message.outgoing ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
          message.outgoing
            ? "bg-primary-soft text-primary"
            : "border border-border bg-background"
        }`}
      >
        {!message.outgoing && (
          <p className="mb-0.5 text-[11px] font-semibold opacity-70">{message.sender_name}</p>
        )}
        <RichTextView html={message.body} />
        {message.files.length > 0 && (
          <div className="mt-2">
            <FileList files={message.files} />
          </div>
        )}
        <p className="num mt-1 text-[10px] opacity-60">{message.sent_on.slice(0, 16)}</p>
      </div>
    </div>
  );
}

function ComposePanel({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const { data, isLoading } = useAudience();
  const send = useSendChat();

  const [target, setTarget] = useState<Target>("people");
  const [selected, setSelected] = useState<Record<Target, string[]>>({
    people: [],
    groups: [],
    courses: [],
  });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [attaching, setAttaching] = useState(false);

  const options = useMemo(() => {
    if (!data) return [];
    if (target === "people")
      return data.people.map((p) => ({ value: p.user, label: p.name, hint: p.role }));
    if (target === "groups")
      return data.groups.map((g) => ({
        value: g.id,
        label: g.name,
        hint: `${g.members} طالباً`,
      }));
    return data.courses.map((c) => ({ value: c.id, label: c.name, code: c.id }));
  }, [data, target]);

  const total = selected.people.length + selected.groups.length + selected.courses.length;

  async function submit() {
    const plain = body.replace(/<[^>]*>/g, "").trim();
    if (!total) {
      toast.error("اختر مستلماً واحداً على الأقل");
      return;
    }
    if (!plain && files.length === 0) {
      toast.error("اكتب رسالة أو أرفق ملفاً");
      return;
    }
    try {
      const result = await send.mutateAsync({
        body,
        ...(subject ? { subject } : {}),
        ...(selected.people.length ? { recipients: selected.people } : {}),
        ...(selected.groups.length ? { groups: selected.groups } : {}),
        ...(selected.courses.length ? { courses: selected.courses } : {}),
        ...(files.length ? { files } : {}),
      });
      toast.success(`تم الإرسال إلى ${result.sent} مستلم`);
      onSent();
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر الإرسال";
      toast.error(message);
    }
  }

  return (
    <>
      <PanelHeader title="رسالة جديدة" onBack={onBack} />

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* How to address: individuals, a whole section, or a course. */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
          {(Object.keys(TARGET_META) as Target[]).map((t) => {
            const meta = TARGET_META[t];
            const disabled = t === "groups" && (data?.groups.length ?? 0) === 0;
            return (
              <button
                key={t}
                onClick={() => setTarget(t)}
                disabled={disabled}
                className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  target === t ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {meta.label}
                {selected[t].length > 0 && (
                  <span className="num mr-1 text-primary">({selected[t].length})</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">{TARGET_META[target].hint}</p>

        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : (
          <SearchableMultiSelect
            options={options}
            values={selected[target]}
            onChange={(v) => setSelected((s) => ({ ...s, [target]: v }))}
            placeholder={`اختر ${TARGET_META[target].label}`}
          />
        )}

        {data?.policy.restricted && target === "people" && (
          <p className="rounded-lg bg-muted/50 px-2.5 py-2 text-[11px] text-muted-foreground">
            يمكنك مراسلة معلميك وإدارة المدرسة فقط.
          </p>
        )}

        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="الموضوع (اختياري)"
          className="h-9 rounded-lg text-sm"
        />

        <RichText
          value={body}
          onChange={setBody}
          placeholder="اكتب رسالتك…"
          minHeight={110}
          disabled={send.isPending}
        />

        {attaching && <FileUpload files={files} onChange={setFiles} maxFiles={5} />}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-2">
        <button
          onClick={submit}
          disabled={send.isPending}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-gradient text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
        >
          <Send className="size-4" />
          {send.isPending ? "جارٍ الإرسال…" : total ? `إرسال (${total})` : "إرسال"}
        </button>
        <button
          onClick={() => setAttaching((a) => !a)}
          aria-label="إرفاق ملف"
          className={`grid size-9 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary ${
            attaching || files.length ? "bg-primary-soft text-primary" : "text-muted-foreground"
          }`}
        >
          <Paperclip className="size-4" />
        </button>
      </div>
    </>
  );
}

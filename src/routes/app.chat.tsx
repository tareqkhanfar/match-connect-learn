import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, MessageCircle, Paperclip, Plus, Search, Send, Users } from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { RichText, RichTextView } from "@/components/shared/rich-text";
import { FileList, FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { SearchableMultiSelect } from "@/components/shared/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAudience,
  useConversation,
  useInbox,
  useSendChat,
  type ConversationMessage,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/chat")({
  head: () => ({
    meta: [
      { title: "المحادثات — Match Education" },
      {
        name: "description",
        content: "صفحة المحادثات الكاملة بين المعلمين والطلاب وأولياء الأمور.",
      },
    ],
  }),
  component: ChatPage,
});

type Target = "people" | "groups" | "courses";

const TARGET_LABEL: Record<Target, string> = {
  people: "أشخاص",
  groups: "شُعب",
  courses: "مواد",
};

/**
 * The full-page chat.
 *
 * Two columns on a desktop — conversations beside the open thread — which is
 * what the floating widget cannot give you. The widget stays for quick
 * replies; this is for actually working through a day's messages.
 */
function ChatPage() {
  const inbox = useInbox(100);
  const [thread, setThread] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);

  const rows = (inbox.data ?? []).filter((m) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (m.from ?? "").toLowerCase().includes(q) ||
      (m.subject ?? "").toLowerCase().includes(q) ||
      (m.preview ?? "").toLowerCase().includes(q)
    );
  });

  const unread = (inbox.data ?? []).reduce((a, m) => a + (m.unread_count ?? 0), 0);

  // Open the newest conversation on a wide screen, so the pane is not empty.
  useEffect(() => {
    if (!thread && rows.length && window.innerWidth >= 1024) setThread(rows[0]!.thread);
  }, [rows, thread]);

  return (
    <>
      <PageHeader
        title="المحادثات"
        subtitle={unread ? `لديك ${unread} رسالة غير مقروءة` : "كل مراسلاتك في مكان واحد"}
        actions={
          <button
            onClick={() => setComposing(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-4" />
            رسالة جديدة
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Conversation list */}
        <div className="card-surface flex max-h-[calc(100vh-14rem)] flex-col overflow-hidden">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في المحادثات…"
                className="h-10 rounded-xl pr-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {inbox.error ? (
              <ErrorState error={inbox.error} onRetry={() => inbox.refetch()} />
            ) : inbox.isLoading ? (
              <TableSkeleton rows={6} />
            ) : rows.length === 0 ? (
              <EmptyBlock
                title={query ? "لا توجد نتائج" : "لا توجد محادثات"}
                description={query ? undefined : "ابدأ محادثة جديدة من الزر أعلاه."}
                icon={<MessageCircle className="size-6" />}
              />
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => setThread(m.thread)}
                      className={`flex w-full items-start gap-3 px-3 py-3 text-right transition-colors hover:bg-secondary ${
                        thread === m.thread ? "bg-primary-soft" : ""
                      }`}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-xs font-bold text-primary">
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
        </div>

        {/* Open thread */}
        <div className="card-surface flex max-h-[calc(100vh-14rem)] flex-col overflow-hidden">
          {thread ? (
            <ThreadPane thread={thread} />
          ) : (
            <div className="grid flex-1 place-items-center p-10 text-center">
              <div>
                <MessageCircle className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">اختر محادثة لعرضها</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  أو ابدأ محادثة جديدة من الزر أعلى الصفحة.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {composing && <ComposeDialog onClose={() => setComposing(false)} />}
    </>
  );
}

function ThreadPane({ thread }: { thread: string }) {
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
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الإرسال");
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-xs font-bold text-primary">
          <Users className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {data?.participants.map((p) => p.name).join("، ") || "المحادثة"}
          </p>
          {data?.subject && (
            <p className="truncate text-[11px] text-muted-foreground">{data.subject}</p>
          )}
        </div>
        {data?.observing && (
          <Pill tone="warning">
            <Eye className="ml-1 inline size-3" />
            مطالعة إدارية
          </Pill>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : (
          (data?.messages ?? []).map((m) => <Bubble key={m.id} message={m} />)
        )}
        <div ref={endRef} />
      </div>

      {!data?.observing && (
        <div className="border-t border-border p-3">
          {attaching && (
            <div className="mb-2">
              <FileUpload files={files} onChange={setFiles} maxFiles={5} />
            </div>
          )}
          <RichText
            value={reply}
            onChange={setReply}
            placeholder="اكتب رسالتك…"
            minHeight={90}
            disabled={send.isPending}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={submit}
              disabled={send.isPending}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
            >
              <Send className="size-4" />
              {send.isPending ? "جارٍ الإرسال…" : "إرسال"}
            </button>
            <button
              onClick={() => setAttaching((a) => !a)}
              aria-label="إرفاق ملف"
              className={`grid size-10 place-items-center rounded-xl border border-border transition-colors hover:bg-secondary ${
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
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          message.outgoing ? "bg-primary-soft text-primary" : "border border-border bg-background"
        }`}
      >
        {!message.outgoing && (
          <p className="mb-1 text-[11px] font-semibold opacity-70">{message.sender_name}</p>
        )}
        <RichTextView html={message.body} />
        {message.files.length > 0 && (
          <div className="mt-2">
            <FileList files={message.files} />
          </div>
        )}
        <p className="num mt-1.5 text-[10px] opacity-60">{message.sent_on.slice(0, 16)}</p>
      </div>
    </div>
  );
}

function ComposeDialog({ onClose }: { onClose: () => void }) {
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

  const options =
    target === "people"
      ? (data?.people ?? []).map((p) => ({ value: p.user, label: p.name, hint: p.role }))
      : target === "groups"
        ? (data?.groups ?? []).map((g) => ({
            value: g.id,
            label: g.name,
            hint: `${g.members} طالباً`,
          }))
        : (data?.courses ?? []).map((c) => ({ value: c.id, label: c.name }));

  const total = selected.people.length + selected.groups.length + selected.courses.length;

  async function submit() {
    if (!total) {
      toast.error("اختر مستلماً واحداً على الأقل");
      return;
    }
    const plain = body.replace(/<[^>]*>/g, "").trim();
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
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الإرسال");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">رسالة جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
            {(Object.keys(TARGET_LABEL) as Target[]).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                disabled={t === "groups" && (data?.groups.length ?? 0) === 0}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  target === t ? "bg-card shadow-soft" : "text-muted-foreground"
                }`}
              >
                {TARGET_LABEL[t]}
                {selected[t].length > 0 && (
                  <span className="num mr-1 text-primary">({selected[t].length})</span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <TableSkeleton rows={3} />
          ) : (
            <SearchableMultiSelect
              options={options}
              values={selected[target]}
              onChange={(v) => setSelected((s) => ({ ...s, [target]: v }))}
              placeholder={`اختر ${TARGET_LABEL[target]}`}
            />
          )}

          {data?.policy.restricted && target === "people" && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
              يمكنك مراسلة معلميك وإدارة المدرسة فقط.
            </p>
          )}

          <div className="space-y-1.5">
            <Label>الموضوع (اختياري)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>الرسالة</Label>
            <RichText value={body} onChange={setBody} placeholder="اكتب رسالتك…" minHeight={130} />
          </div>

          {attaching && <FileUpload files={files} onChange={setFiles} maxFiles={5} />}
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={send.isPending}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <Send className="size-4" />
            {send.isPending ? "جارٍ الإرسال…" : total ? `إرسال (${total})` : "إرسال"}
          </button>
          <button
            onClick={() => setAttaching((a) => !a)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"
          >
            <Paperclip className="size-4" />
            إرفاق
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  CirclePlay,
  EyeOff,
  LifeBuoy,
  Link2,
  MessageCircleQuestion,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { RichText, RichTextView } from "@/components/shared/rich-text";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fileUrl } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import {
  markHelpViewed,
  uploadHelpVideo,
  useDeleteHelpArticle,
  useHelpArticles,
  useSaveHelpArticle,
  type HelpArticle,
  type HelpAudience,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/help")({
  head: () => ({
    meta: [
      { title: "المساعدة — Match Education" },
      { name: "description", content: "فيديوهات شرح وأسئلة شائعة عن استخدام النظام." },
    ],
  }),
  component: HelpPage,
});

const AUDIENCES: Array<{ value: HelpAudience; label: string }> = [
  { value: "admin", label: "الإدارة" },
  { value: "secretary", label: "السكرتاريا" },
  { value: "teacher", label: "المعلمون" },
  { value: "student", label: "الطلاب" },
  { value: "parent", label: "أولياء الأمور" },
];

/** The YouTube thumbnail, when the video is on YouTube — a still beats a grey box. */
function thumbnail(a: HelpArticle): string {
  const m = a.embedUrl.match(/youtube\.com\/embed\/([\w-]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : "";
}

function HelpPage() {
  const { data, isLoading, error, refetch } = useHelpArticles();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState<"all" | "Video" | "Question">("all");
  const [playing, setPlaying] = useState<HelpArticle | null>(null);
  const [editing, setEditing] = useState<HelpArticle | "new" | null>(null);
  const canEdit = data?.canEdit ?? false;

  const articles = useMemo(() => data?.articles ?? [], [data]);
  const topics = useMemo(
    () => [...new Set(articles.map((a) => a.topic).filter(Boolean))],
    [articles],
  );
  const list = articles.filter((a) => {
    if (topic && a.topic !== topic) return false;
    if (kind !== "all" && a.kind !== kind) return false;
    if (!q.trim()) return true;
    const needle = q.trim();
    // The answer is HTML; searching its text finds a word the title lacks.
    const text = a.body.replace(/<[^>]+>/g, " ");
    return a.title.includes(needle) || a.topic.includes(needle) || text.includes(needle);
  });
  const videos = list.filter((a) => a.kind === "Video");
  const questions = list.filter((a) => a.kind === "Question");

  function open(a: HelpArticle) {
    setPlaying(a);
    markHelpViewed(a.name);
  }

  return (
    <>
      <PageHeader
        title="مركز المساعدة"
        subtitle="فيديوهات تشرح خطوة بخطوة، وأجوبة لأكثر الأسئلة تكراراً."
        actions={
          canEdit && (
            <button
              onClick={() => setEditing("new")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
            >
              <Plus className="size-4" />
              إضافة مادة
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث: رصد العلامات، الحضور، كلمة المرور…"
            className="h-11 rounded-xl bg-card pr-9"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {[
            { key: "all" as const, label: "الكل" },
            { key: "Video" as const, label: "فيديوهات" },
            { key: "Question" as const, label: "أسئلة شائعة" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setKind(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                kind === t.key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {topics.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {["", ...topics].map((t) => (
            <button
              key={t || "all"}
              onClick={() => setTopic(t)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                topic === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-secondary"
              }`}
            >
              {t || "كل المواضيع"}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={5} />
      ) : list.length === 0 ? (
        <EmptyBlock
          title={articles.length ? "لا نتائج" : "لا توجد مواد مساعدة بعد"}
          description={
            articles.length
              ? "جرّب كلمة أخرى أو موضوعاً آخر."
              : canEdit
                ? "أضف أول فيديو أو سؤال من زر «إضافة مادة»."
                : "ستظهر هنا فيديوهات الشرح والأسئلة الشائعة فور إضافتها."
          }
          icon={<LifeBuoy className="size-6" />}
        />
      ) : (
        <div className="space-y-8">
          {videos.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
                <CirclePlay className="size-4 text-primary" />
                فيديوهات الشرح
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {videos.map((a) => (
                  <div key={a.name} className="card-surface overflow-hidden">
                    <button
                      onClick={() => open(a)}
                      className="group relative block aspect-video w-full bg-gradient-to-br from-primary/80 to-primary"
                    >
                      {thumbnail(a) && (
                        <img
                          src={thumbnail(a)}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/40">
                        <CirclePlay className="size-14 text-white drop-shadow" />
                      </span>
                    </button>
                    <div className="p-4">
                      <ArticleMeta article={a} canEdit={canEdit} onEdit={() => setEditing(a)} />
                      <button onClick={() => open(a)} className="mt-1 text-right">
                        <p className="font-bold hover:text-primary">{a.title}</p>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {questions.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
                <MessageCircleQuestion className="size-4 text-primary" />
                الأسئلة الشائعة
              </h2>
              <div className="space-y-2">
                {questions.map((a) => (
                  <details
                    key={a.name}
                    className="card-surface group p-0"
                    onToggle={(e) => (e.currentTarget.open ? markHelpViewed(a.name) : undefined)}
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                      <MessageCircleQuestion className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 font-bold">{a.title}</span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-border px-4 pb-4 pt-3">
                      <RichTextView html={a.body} />
                      {(a.videoFile || a.embedUrl) && (
                        <button
                          onClick={() => open(a)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary"
                        >
                          <CirclePlay className="size-4" />
                          شاهد الفيديو
                        </button>
                      )}
                      <div className="mt-3">
                        <ArticleMeta article={a} canEdit={canEdit} onEdit={() => setEditing(a)} />
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {playing && <PlayerDialog article={playing} onClose={() => setPlaying(null)} />}
      {editing && (
        <EditorDialog
          article={editing === "new" ? null : editing}
          topics={topics}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ArticleMeta({
  article: a,
  canEdit,
  onEdit,
}: {
  article: HelpArticle;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const remove = useDeleteHelpArticle();
  const confirm = useConfirm();

  async function drop() {
    const ok = await confirm({
      title: `حذف «${a.title}»؟`,
      description: "ستختفي من مركز المساعدة لدى الجميع.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(a.name);
      toast.success("تم الحذف");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      {a.topic && <Pill tone="primary">{a.topic}</Pill>}
      {canEdit && (
        <>
          {!a.isPublished && (
            <Pill tone="warning">
              <EyeOff className="inline size-3" /> مسودة
            </Pill>
          )}
          <span>
            {a.audience.length
              ? a.audience.map((p) => AUDIENCES.find((x) => x.value === p)?.label).join("، ")
              : "للجميع"}
          </span>
          <span className="num">· {a.views} مشاهدة</span>
          <span className="mr-auto flex gap-1">
            <button
              onClick={onEdit}
              aria-label="تعديل"
              className="rounded-lg bg-secondary p-1.5 hover:bg-primary-soft hover:text-primary"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={drop}
              aria-label="حذف"
              className="rounded-lg bg-secondary p-1.5 text-destructive hover:bg-destructive-soft"
            >
              <Trash2 className="size-3.5" />
            </button>
          </span>
        </>
      )}
    </div>
  );
}

function PlayerDialog({ article: a, onClose }: { article: HelpArticle; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{a.title}</DialogTitle>
          {a.topic && <DialogDescription>{a.topic}</DialogDescription>}
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          {a.videoFile ? (
            <video src={fileUrl(a.videoFile)} controls autoPlay className="size-full" />
          ) : a.embedUrl ? (
            <iframe
              src={a.embedUrl}
              title={a.title}
              className="size-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : null}
        </div>
        {a.body && (
          <div className="max-h-[30vh] overflow-y-auto">
            <RichTextView html={a.body} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditorDialog({
  article,
  topics,
  onClose,
}: {
  article: HelpArticle | null;
  topics: string[];
  onClose: () => void;
}) {
  const save = useSaveHelpArticle();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    kind: article?.kind ?? ("Video" as HelpArticle["kind"]),
    title: article?.title ?? "",
    topic: article?.topic ?? "",
    audience: article?.audience ?? ([] as HelpAudience[]),
    body: article?.body ?? "",
    videoFile: article?.videoFile ?? "",
    videoUrl: article?.videoUrl ?? "",
    sortOrder: article?.sortOrder ?? 0,
    isPublished: article ? !!article.isPublished : true,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function pickVideo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadHelpVideo(file);
      setForm((f) => ({ ...f, videoFile: url, videoUrl: "" }));
      toast.success("تم رفع الفيديو");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر رفع الفيديو — جرّب رابط YouTube للملفات الكبيرة"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submit() {
    try {
      await save.mutateAsync({
        ...(article ? { name: article.name } : {}),
        ...form,
        isPublished: form.isPublished ? 1 : 0,
      });
      toast.success("تم الحفظ");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{article ? "تعديل مادة مساعدة" : "مادة مساعدة جديدة"}</DialogTitle>
          <DialogDescription>تظهر لكل من تختارهم أدناه في «مركز المساعدة».</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "Video" as const, label: "فيديو شرح", icon: CirclePlay },
              { v: "Question" as const, label: "سؤال وجواب", icon: MessageCircleQuestion },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => set("kind", o.v)}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold ${
                  form.kind === o.v
                    ? "border-primary bg-primary-soft/40 text-primary"
                    : "border-border"
                }`}
              >
                <o.icon className="size-4" />
                {o.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>{form.kind === "Video" ? "عنوان الفيديو" : "السؤال"}</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={
                form.kind === "Video"
                  ? "مثال: كيف أرصد العلامات"
                  : "مثال: نسيت كلمة المرور، ماذا أفعل؟"
              }
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label>الموضوع</Label>
            <Input
              value={form.topic}
              onChange={(e) => set("topic", e.target.value)}
              placeholder="مثال: العلامات، الحضور، الرسائل"
              list="help-topics"
              className="rounded-xl"
            />
            <datalist id="help-topics">
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label>لمن تظهر</Label>
            <div className="flex flex-wrap gap-1.5">
              {AUDIENCES.map((o) => {
                const on = form.audience.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() =>
                      set(
                        "audience",
                        on
                          ? form.audience.filter((x) => x !== o.value)
                          : [...form.audience, o.value],
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {form.audience.length ? "تظهر لمن اخترتهم فقط." : "لم تختر أحداً — تظهر للجميع."}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <Label>الفيديو {form.kind === "Question" && "(اختياري)"}</Label>
            {form.videoFile ? (
              <div className="flex items-center gap-2 text-xs">
                <CirclePlay className="size-4 text-primary" />
                <span className="min-w-0 flex-1 truncate" dir="ltr">
                  {form.videoFile.split("/").pop()}
                </span>
                <button
                  type="button"
                  onClick={() => set("videoFile", "")}
                  className="rounded-lg bg-secondary px-2 py-1 text-destructive"
                >
                  إزالة
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                >
                  <Upload className="size-3.5" />
                  {uploading ? "جارٍ الرفع…" : "رفع ملف فيديو (MP4)"}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                  className="hidden"
                  onChange={(e) => pickVideo(e.target.files?.[0])}
                />
                <div className="relative">
                  <Link2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={form.videoUrl}
                    onChange={(e) => set("videoUrl", e.target.value)}
                    placeholder="أو الصق رابط YouTube أو Vimeo أو Google Drive"
                    className="rounded-xl pr-9"
                    dir="ltr"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  للفيديوهات الطويلة يُفضَّل رفعها على YouTube (غير مدرج) ولصق الرابط.
                </p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{form.kind === "Video" ? "شرح مختصر (اختياري)" : "الجواب"}</Label>
            <RichText
              value={form.body}
              onChange={(v) => set("body", v)}
              placeholder={
                form.kind === "Video" ? "ماذا يشرح هذا الفيديو؟" : "اكتب الجواب خطوة بخطوة…"
              }
              minHeight={110}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
                className="rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm font-medium">منشور</span>
              <Switch checked={form.isPublished} onCheckedChange={(v) => set("isPublished", v)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={save.isPending || uploading}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

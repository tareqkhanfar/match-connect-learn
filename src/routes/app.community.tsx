import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Award,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Heart,
  Loader2,
  MessageCircle,
  Pin,
  Plus,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichText, sanitizeHtml } from "@/components/shared/rich-text";
import { useConfirm } from "@/components/shared/confirm";
import { apiUpload, fileUrl } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import {
  useAddComment,
  useClasses,
  useCommunityChannels,
  useCommunityFeed,
  useCommunityPost,
  useDeleteComment,
  useDeletePost,
  useHideComment,
  useSavePost,
  useStudents,
  useToggleLike,
  type CommunityPost,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/community")({
  validateSearch: groupSearch,
  head: () => ({
    meta: [
      { title: "مجتمع المدرسة — Match Education" },
      {
        name: "description",
        content: "إنجازات الطلاب وأنشطة الصفوف، يتفاعل معها الطلاب وأولياء الأمور.",
      },
    ],
  }),
  component: CommunityPage,
});

const MAX_PHOTO_MB = 10;

/**
 * The school's feed.
 *
 * Staff post achievements and activities; families read, like and reply. What
 * each person sees is the server's decision — a post about one child reaches
 * that family alone — and this screen renders what it was given rather than
 * filtering anything itself.
 */
function CommunityPage() {
  const { role } = useApp();
  // Which channel is showing. Empty is "all".
  const [channel, setChannel] = useState("");
  const channels = useCommunityChannels();
  const query = useCommunityFeed(undefined, channel || undefined);
  const [composing, setComposing] = useState<CommunityPost | "new" | null>(null);
  const [openPost, setOpenPost] = useState<string | null>(null);

  const posts = query.data?.posts ?? [];
  const canPost = query.data?.can_post ?? false;
  // Two channels means "all" and "general" only — nothing to choose between.
  const tabs = channels.data?.channels ?? [];

  return (
    <>
      <PageHeader
        title="مجتمع المدرسة"
        subtitle={canPost ? "شارك إنجازات الطلاب وأنشطة الصفوف" : "إنجازات وأنشطة صفوف أبنائك"}
        actions={
          canPost ? (
            <button
              onClick={() => setComposing("new")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5"
            >
              <Plus className="size-4" />
              منشور جديد
            </button>
          ) : null
        }
      />

      {/* Channels. Chips rather than a dropdown: the subjects are few, they
          read at a glance, and a dropdown hides the very names that are half
          the point. Hidden when there is nothing to choose between. */}
      {tabs.length > 2 && (
        <div className="mx-auto mb-4 max-w-2xl">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {tabs.map((t) => {
              const active = t.key === channel;
              return (
                <button
                  key={t.key || "all"}
                  onClick={() => setChannel(t.key)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span
                      className={cn(
                        "num rounded px-1 text-[10px] font-bold",
                        active ? "bg-white/20" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {canPost && (
        <div className="mx-auto mb-4 max-w-2xl">
          <button
            onClick={() => setComposing("new")}
            className="card-surface flex w-full items-center gap-3 p-3.5 text-right transition-colors hover:bg-secondary/40"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-primary-foreground">
              <Award className="size-5" />
            </span>
            <span className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
              شارك إنجازاً أو نشاطاً…
            </span>
            <span className="hidden shrink-0 items-center gap-1 rounded-xl bg-primary-soft px-3 py-2 text-xs font-bold text-primary sm:flex">
              <ImageIcon className="size-3.5" />
              صور
            </span>
          </button>
        </div>
      )}

      {query.isLoading ? (
        <TableSkeleton />
      ) : posts.length === 0 ? (
        <EmptyBlock
          title="لا توجد منشورات بعد"
          description={
            canPost
              ? "انشر إنجازاً أو نشاطاً ليراه الطلاب وأولياء الأمور."
              : "ستظهر هنا إنجازات وأنشطة الصفوف عندما ينشرها المعلمون."
          }
          icon={<Users className="size-6" />}
        />
      ) : (
        <ul className="mx-auto max-w-2xl space-y-3">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              role={role}
              onOpen={() => setOpenPost(p.id)}
              onEdit={() => setComposing(p)}
            />
          ))}
        </ul>
      )}

      {composing && (
        <PostComposer
          post={composing === "new" ? null : composing}
          onClose={() => setComposing(null)}
        />
      )}
      {openPost && <PostThread post={openPost} onClose={() => setOpenPost(null)} />}
    </>
  );
}

/** One post in the feed. */
function PostCard({
  post: p,
  role,
  onOpen,
  onEdit,
}: {
  post: CommunityPost;
  role: string;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const like = useToggleLike();
  const remove = useDeletePost();
  const confirm = useConfirm();

  async function toggle() {
    try {
      await like.mutateAsync({ post: p.id });
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تسجيل الإعجاب"));
    }
  }

  async function drop() {
    const ok = await confirm({
      title: `حذف منشور «${p.title}»؟`,
      description: "سيُحذف المنشور وصوره وتعليقاته وإعجاباته نهائياً.",
    });
    if (!ok) return;
    try {
      const res = await remove.mutateAsync({ post: p.id });
      toast.success(res.message_ar || "تم الحذف");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  return (
    <li className="card-surface overflow-hidden">
      <div className="flex items-start gap-2.5 p-3.5 pb-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-black text-primary-foreground">
          {(p.author_name ?? "؟").trim().charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-black">{p.title}</span>
            {p.pinned && (
              <Pill tone="warning">
                <Pin className="ml-0.5 inline size-2.5" />
                مثبّت
              </Pill>
            )}
            {!p.is_published && <Pill tone="muted">مسودة</Pill>}
          </p>
          <p className="num mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{p.author_name}</span>
            <span>· {p.posted_on.slice(0, 16)}</span>
            <span>· {p.type_label}</span>
            {p.class_name && <span>· {p.class_name}</span>}
            {p.student_name && <span>· {p.student_name}</span>}
          </p>
        </div>
      </div>

      {p.body && (
        <div
          className="prose prose-sm max-w-none px-3.5 pb-2 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.body) }}
        />
      )}

      {p.photos.length > 0 && (
        <ul className={`grid gap-0.5 ${p.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {p.photos.slice(0, 4).map((ph, i) => (
            <li key={ph.file_url} className="relative">
              <img
                src={fileUrl(ph.file_url)}
                alt={ph.caption ?? ""}
                loading="lazy"
                className={`w-full object-cover ${
                  p.photos.length === 1 ? "max-h-96" : "aspect-square"
                }`}
              />
              {/* The fourth tile carries the rest rather than hiding them with
                  no sign there were more. */}
              {i === 3 && p.photos.length > 4 && (
                <span className="num absolute inset-0 grid place-items-center bg-black/55 text-lg font-black text-white">
                  +{p.photos.length - 4}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {(p.like_count > 0 || p.comment_count > 0) && (
        <div className="num flex items-center gap-3 px-3.5 py-1.5 text-[11px] text-muted-foreground">
          {p.like_count > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="size-3 fill-destructive text-destructive" />
              {p.like_count}
            </span>
          )}
          {p.comment_count > 0 && (
            <button onClick={onOpen} className="hover:underline">
              {p.comment_count} تعليقاً
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border p-2">
        <button
          onClick={() => void toggle()}
          disabled={like.isPending}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            p.liked_by_me ? "bg-destructive-soft text-destructive" : "hover:bg-secondary"
          }`}
        >
          <Heart className={`size-3.5 ${p.liked_by_me ? "fill-current" : ""}`} />
          {p.like_count > 0 && <span className="num">{p.like_count}</span>}
          إعجاب
        </button>
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          <MessageCircle className="size-3.5" />
          {p.comment_count > 0 && <span className="num">{p.comment_count}</span>}
          {p.allow_comments ? "تعليق" : "التعليقات"}
        </button>
        {p.can_edit && (
          <span className="mr-auto flex gap-1.5">
            <button
              onClick={onEdit}
              className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-secondary"
            >
              تعديل
            </button>
            <button
              onClick={() => void drop()}
              className="rounded-lg border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive-soft"
            >
              <Trash2 className="size-3" />
            </button>
          </span>
        )}
      </div>
      <span className="hidden">{role}</span>
    </li>
  );
}

/** The post with its comment thread. */
function PostThread({ post, onClose }: { post: string; onClose: () => void }) {
  const query = useCommunityPost(post);
  const add = useAddComment();
  const remove = useDeleteComment();
  const hide = useHideComment();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const data = query.data;
  const comments = data?.comments ?? [];
  const roots = comments.filter((c) => !c.parent_comment);

  async function submit() {
    const text = body.trim();
    if (!text) return;
    try {
      await add.mutateAsync({
        post,
        body: text,
        ...(replyTo ? { parent_comment: replyTo.id } : {}),
      });
      setBody("");
      setReplyTo(null);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر إضافة التعليق"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{data?.title ?? "المنشور"}</DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : (
          <div className="max-h-[55vh] space-y-2.5 overflow-y-auto p-1">
            {roots.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                لا توجد تعليقات بعد — كن أول من يعلّق.
              </p>
            ) : (
              roots.map((c) => (
                <div key={c.id}>
                  <CommentRow
                    comment={c}
                    onReply={() => setReplyTo({ id: c.id, name: c.author_name ?? "" })}
                    onDelete={async () => {
                      try {
                        await remove.mutateAsync({ comment: c.id });
                      } catch (err) {
                        toast.error(errorMessage(err, "تعذّر الحذف"));
                      }
                    }}
                    onHide={async () => {
                      try {
                        await hide.mutateAsync({ comment: c.id, hidden: c.is_hidden ? 0 : 1 });
                      } catch (err) {
                        toast.error(errorMessage(err, "تعذّر الإخفاء"));
                      }
                    }}
                  />
                  <div className="mt-1.5 space-y-1.5 pr-6">
                    {comments
                      .filter((r) => r.parent_comment === c.id)
                      .map((r) => (
                        <CommentRow
                          key={r.id}
                          comment={r}
                          onDelete={async () => {
                            try {
                              await remove.mutateAsync({ comment: r.id });
                            } catch (err) {
                              toast.error(errorMessage(err, "تعذّر الحذف"));
                            }
                          }}
                          onHide={async () => {
                            try {
                              await hide.mutateAsync({
                                comment: r.id,
                                hidden: r.is_hidden ? 0 : 1,
                              });
                            } catch (err) {
                              toast.error(errorMessage(err, "تعذّر الإخفاء"));
                            }
                          }}
                        />
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {data?.allow_comments ? (
          <div className="space-y-1.5">
            {replyTo && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                رد على {replyTo.name}
                <button onClick={() => setReplyTo(null)} className="text-destructive">
                  <X className="size-3" />
                </button>
              </p>
            )}
            <div className="flex gap-1.5">
              <Input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder="اكتب تعليقاً…"
                maxLength={1000}
                className="rounded-xl"
              />
              <button
                onClick={() => void submit()}
                disabled={add.isPending || !body.trim()}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-primary-foreground disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-secondary p-2.5 text-center text-xs text-muted-foreground">
            التعليقات مغلقة على هذا المنشور.
          </p>
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إغلاق
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommentRow({
  comment: c,
  onReply,
  onDelete,
  onHide,
}: {
  comment: {
    id: string;
    body: string;
    author_name: string | null;
    posted_on: string;
    is_hidden: boolean;
    can_delete: boolean;
    can_hide: boolean;
  };
  onReply?: () => void;
  onDelete: () => void | Promise<void>;
  onHide: () => void | Promise<void>;
}) {
  return (
    <div className={`rounded-xl border border-border p-2.5 ${c.is_hidden ? "opacity-60" : ""}`}>
      <p className="num flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="font-bold text-foreground">{c.author_name}</span>
        <span>{c.posted_on.slice(0, 16)}</span>
        {c.is_hidden && <Pill tone="danger">مخفي</Pill>}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
      <div className="mt-1.5 flex gap-2 text-[11px]">
        {onReply && (
          <button onClick={onReply} className="font-semibold text-primary hover:underline">
            رد
          </button>
        )}
        {c.can_hide && (
          <button onClick={() => void onHide()} className="text-muted-foreground hover:underline">
            {c.is_hidden ? "إظهار" : "إخفاء"}
          </button>
        )}
        {c.can_delete && (
          <button onClick={() => void onDelete()} className="text-destructive hover:underline">
            حذف
          </button>
        )}
      </div>
    </div>
  );
}

/** Writing a post. */
function PostComposer({ post, onClose }: { post: CommunityPost | null; onClose: () => void }) {
  // Opened from a class: the form starts on it instead of empty.
  const { group: preselectedGroup } = Route.useSearch();
  const { role } = useApp();
  const save = useSavePost();
  const classes = useClasses();
  const input = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: post?.title ?? "",
    post_type: post?.post_type ?? "Achievement",
    audience: post?.audience ?? "Class",
    student_group: post?.student_group ?? preselectedGroup ?? "",
    student: post?.student ?? "",
  });
  const [body, setBody] = useState(post?.body ?? "");
  const [published, setPublished] = useState(post?.is_published ?? true);
  const [comments, setComments] = useState(post?.allow_comments ?? true);
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [photos, setPhotos] = useState(post?.photos ?? []);
  const [uploading, setUploading] = useState(0);

  // Only fetched when a student has to be named, and scoped to the class so a
  // teacher is offered the children they actually teach.
  const students = useStudents(
    form.audience === "Student" && form.student_group
      ? { batch: form.student_group, page_size: 100 }
      : { page_size: 1 },
  );

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const chosen = Array.from(list);
    setUploading(chosen.length);
    const added: Array<{ file_url: string; caption: string | null }> = [];
    for (const file of chosen) {
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        toast.error(`${file.name}: أكبر من ${MAX_PHOTO_MB} ميجابايت`);
        continue;
      }
      try {
        const res = await apiUpload<{ file_url: string }>(
          "community.upload_photo",
          file,
          post ? { post: post.id } : {},
        );
        added.push({ file_url: res.file_url, caption: "" });
      } catch (err) {
        toast.error(errorMessage(err, `تعذّر رفع ${file.name}`));
      }
    }
    setUploading(0);
    if (added.length) setPhotos((p) => [...p, ...added]);
    if (input.current) input.current.value = "";
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("عنوان المنشور مطلوب");
      return;
    }
    if (form.audience === "Class" && !form.student_group) {
      toast.error("اختر الشعبة");
      return;
    }
    if (form.audience === "Student" && !form.student) {
      toast.error("اختر الطالب");
      return;
    }
    try {
      const res = await save.mutateAsync({
        ...(post ? { post: post.id } : {}),
        ...form,
        body,
        is_published: published ? 1 : 0,
        allow_comments: comments ? 1 : 0,
        pinned: pinned ? 1 : 0,
        photos: photos.map((p) => ({ file_url: p.file_url, caption: p.caption ?? "" })),
      });
      toast.success(res.message_ar || "تم النشر");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ المنشور"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{post ? "تعديل المنشور" : "منشور جديد"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>العنوان</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثال: المركز الأول في مسابقة العلوم"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select
                value={form.post_type}
                onValueChange={(v) => setForm((f) => ({ ...f, post_type: v }))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Achievement">إنجاز</SelectItem>
                  <SelectItem value="Activity">نشاط</SelectItem>
                  <SelectItem value="Announcement">إعلان</SelectItem>
                  <SelectItem value="General">عام</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>الجمهور</Label>
              <Select
                value={form.audience}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    audience: v,
                    student: "",
                    student_group: v === "School" ? "" : f.student_group,
                  }))
                }
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Only the administration addresses the whole school; the
                      server refuses it from a teacher either way. */}
                  {(role === "admin" || role === "secretary") && (
                    <SelectItem value="School">المدرسة كاملة</SelectItem>
                  )}
                  <SelectItem value="Class">شعبة محدّدة</SelectItem>
                  <SelectItem value="Student">طالب محدّد</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.audience !== "School" && (
              <div className="space-y-1.5">
                <Label>الشعبة</Label>
                <Select
                  value={form.student_group}
                  onValueChange={(v) => setForm((f) => ({ ...f, student_group: v, student: "" }))}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="اختر الشعبة" />
                  </SelectTrigger>
                  <SelectContent>
                    {(classes.data ?? []).map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.student_group_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.audience === "Student" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>الطالب</Label>
                <Select
                  value={form.student}
                  onValueChange={(v) => setForm((f) => ({ ...f, student: v }))}
                  disabled={!form.student_group}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue
                      placeholder={form.student_group ? "اختر الطالب" : "اختر الشعبة أولاً"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(students.data?.items ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  يظهر هذا المنشور للطالب وولي أمره فقط.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>نص المنشور</Label>
            <RichText value={body} onChange={setBody} placeholder="اكتب التفاصيل…" minHeight={90} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>الصور ({photos.length})</Label>
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
                    رفع صور
                  </>
                )}
              </button>
              <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void pick(e.target.files)}
                className="hidden"
              />
            </div>
            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p, i) => (
                  <li key={p.file_url} className="relative">
                    <img
                      src={fileUrl(p.file_url)}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <button
                      onClick={() => setPhotos((list) => list.filter((_, idx) => idx !== i))}
                      className="absolute left-1 top-1 grid size-6 place-items-center rounded-lg bg-destructive text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <ToggleRow
              icon={published ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              title="منشور"
              hint="أوقفه ريثما تجهّز المنشور، ثم شغّله لينشر."
              checked={published}
              onChange={setPublished}
            />
            <ToggleRow
              icon={<MessageCircle className="size-4" />}
              title="السماح بالتعليقات"
              hint="يمكن للطلاب وأولياء الأمور التعليق والرد."
              checked={comments}
              onChange={setComments}
            />
            <ToggleRow
              icon={<Pin className="size-4" />}
              title="تثبيت في الأعلى"
              hint="يظهر قبل بقية المنشورات."
              checked={pinned}
              onChange={setPinned}
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={save.isPending || uploading > 0}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {save.isPending ? "جارٍ الحفظ…" : post ? "حفظ" : "نشر"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  icon,
  title,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-3">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
        </p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

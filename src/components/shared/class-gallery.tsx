import { useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar, Eye, EyeOff, Images, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/shared/ui-kit";
import { EmptyBlock } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiUpload, fileUrl } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import {
  useDeleteAlbum,
  useGalleryAlbum,
  useGalleryAlbums,
  useSaveAlbum,
  type GalleryPhoto,
} from "@/lib/api/hooks";

const MAX_PHOTO_MB = 10;

/**
 * A class's photo albums, one per event.
 *
 * A school year reaches home as marks and attendance and little else. The
 * trip, the science fair, the day the class planted a garden — the family only
 * hears about those if a child remembers to say so. An album per event is the
 * cheapest way to close that gap.
 *
 * Teachers of the class and office staff manage albums; everyone else reads
 * the published ones. The server decides which, and this component renders
 * whatever it was handed rather than deciding for itself.
 */
export function ClassGallery({ studentGroup }: { studentGroup: string }) {
  const query = useGalleryAlbums(studentGroup);
  const remove = useDeleteAlbum();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const albums = query.data?.albums ?? [];
  const canManage = query.data?.can_manage ?? false;

  async function drop(id: string, title: string) {
    const ok = await confirm({
      title: `حذف ألبوم «${title}»؟`,
      description: "ستُحذف كل صوره نهائياً ولن يعود الطلاب وأولياء الأمور يرونه.",
    });
    if (!ok) return;
    try {
      const res = await remove.mutateAsync({ album: id });
      toast.success(res.message_ar || "تم حذف الألبوم");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  return (
    <>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setEditing("new")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5"
          >
            <Plus className="size-4" />
            ألبوم جديد
          </button>
        </div>
      )}

      {query.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
      ) : albums.length === 0 ? (
        <EmptyBlock
          title="لا توجد ألبومات بعد"
          description={
            canManage
              ? "أنشئ ألبوماً لكل رحلة أو نشاط، وارفع صوره ليراها الطلاب وأولياء الأمور."
              : "ستظهر هنا صور الرحلات والأنشطة عندما ينشرها المعلم."
          }
          icon={<Images className="size-6" />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((a) => (
            <li key={a.id} className="card-surface overflow-hidden">
              <button
                onClick={() => setViewing(a.id)}
                className="block w-full text-right"
                title="عرض صور الألبوم"
              >
                <span className="block aspect-[4/3] w-full overflow-hidden bg-secondary">
                  {a.cover_image ? (
                    <img
                      src={fileUrl(a.cover_image)}
                      alt={a.title}
                      loading="lazy"
                      className="size-full object-cover transition-transform hover:scale-105"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-muted-foreground">
                      <Images className="size-8" />
                    </span>
                  )}
                </span>
                <span className="block p-3">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-bold">{a.title}</span>
                    {!a.is_published && <Pill tone="muted">مسودة</Pill>}
                  </span>
                  <span className="num mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Calendar className="size-3" />
                    {a.event_date}
                    <span>· {a.photo_count} صورة</span>
                  </span>
                </span>
              </button>

              {canManage && (
                <div className="flex gap-1.5 border-t border-border p-2">
                  <button
                    onClick={() => setEditing(a.id)}
                    className="flex-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-secondary"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => void drop(a.id, a.title)}
                    className="rounded-lg border border-destructive/40 px-2 py-1 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive-soft"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AlbumEditor
          studentGroup={studentGroup}
          album={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {viewing && <AlbumViewer album={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

/** The album as a family sees it: the photos, full size, with their captions. */
function AlbumViewer({ album, onClose }: { album: string; onClose: () => void }) {
  const query = useGalleryAlbum(album);
  const data = query.data;
  const [zoom, setZoom] = useState<GalleryPhoto | null>(null);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="size-5 text-primary" />
            {data?.title ?? "الألبوم"}
          </DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">تعذّر عرض الألبوم.</p>
        ) : (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-1">
            <p className="num flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              {data.event_date}
              <span>· {data.class_name}</span>
              <span>· {data.photos.length} صورة</span>
            </p>
            {data.description && <p className="text-sm leading-relaxed">{data.description}</p>}

            {data.photos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                لا توجد صور في هذا الألبوم.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-3">
                {data.photos.map((p) => (
                  <li key={p.file_url}>
                    <button onClick={() => setZoom(p)} className="block w-full text-right">
                      <img
                        src={fileUrl(p.file_url)}
                        alt={p.caption ?? ""}
                        loading="lazy"
                        className="aspect-square w-full rounded-xl object-cover transition-transform hover:scale-[1.02]"
                      />
                      {p.caption && (
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                          {p.caption}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {zoom && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setZoom(null)}
            onKeyDown={(e) => e.key === "Escape" && setZoom(null)}
            className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6"
          >
            <div className="max-h-full max-w-3xl">
              <img
                src={fileUrl(zoom.file_url)}
                alt={zoom.caption ?? ""}
                className="max-h-[80vh] rounded-xl object-contain"
              />
              {zoom.caption && (
                <p className="mt-2 text-center text-sm text-white">{zoom.caption}</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Creating or editing an album, including the uploads. */
function AlbumEditor({
  studentGroup,
  album,
  onClose,
}: {
  studentGroup: string;
  album: string | null;
  onClose: () => void;
}) {
  const existing = useGalleryAlbum(album ?? undefined);
  const save = useSaveAlbum();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    event_date: new Date().toISOString().slice(0, 10),
    description: "",
  });
  const [published, setPublished] = useState(true);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [cover, setCover] = useState("");
  const [uploading, setUploading] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Fill from the record once, not on every render: typing into the form
  // while a refetch lands would otherwise overwrite what was just typed.
  if (existing.data && !loaded && album) {
    setForm({
      title: existing.data.title,
      event_date: existing.data.event_date,
      description: existing.data.description ?? "",
    });
    setPublished(existing.data.is_published);
    setPhotos(existing.data.photos);
    setCover(existing.data.cover_image ?? "");
    setLoaded(true);
  }

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    const chosen = Array.from(files);
    setUploading(chosen.length);
    const added: GalleryPhoto[] = [];
    for (const file of chosen) {
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        toast.error(`${file.name}: أكبر من ${MAX_PHOTO_MB} ميجابايت`);
        continue;
      }
      try {
        const res = await apiUpload<{ file_url: string; file_name: string }>(
          "gallery.upload_photo",
          file,
          { student_group: studentGroup, ...(album ? { album } : {}) },
        );
        added.push({
          file_url: res.file_url,
          file_name: res.file_name,
          caption: "",
          sort_order: 0,
        });
      } catch (err) {
        toast.error(errorMessage(err, `تعذّر رفع ${file.name}`));
      }
    }
    setUploading(0);
    if (added.length) {
      setPhotos((p) => [...p, ...added]);
      if (!cover && added[0]) setCover(added[0].file_url);
      toast.success(`تم رفع ${added.length} صورة`);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("عنوان الحدث مطلوب");
      return;
    }
    try {
      const res = await save.mutateAsync({
        ...(album ? { album } : { student_group: studentGroup }),
        ...form,
        is_published: published ? 1 : 0,
        cover_image: cover,
        photos: photos.map((p, i) => ({
          file_url: p.file_url,
          caption: p.caption ?? "",
          file_name: p.file_name ?? "",
          sort_order: i + 1,
        })),
      });
      toast.success(res.message_ar || "تم حفظ الألبوم");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ الألبوم"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{album ? "تعديل الألبوم" : "ألبوم جديد"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>عنوان الحدث</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثال: رحلة إلى المتحف"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الحدث</Label>
              <Input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                className="num rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>وصف مختصر</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="ماذا جرى في هذا اليوم؟"
              className="rounded-xl"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>الصور ({photos.length})</Label>
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading > 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-primary-soft hover:text-primary disabled:opacity-50"
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
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void pick(e.target.files)}
                className="hidden"
              />
            </div>

            {photos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                لا صور بعد — اضغط «رفع صور» لاختيار صور من جهازك.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <li key={p.file_url} className="rounded-xl border border-border p-1.5">
                    <span className="relative block">
                      <img
                        src={fileUrl(p.file_url)}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                      <button
                        onClick={() => {
                          setPhotos((list) => list.filter((_, idx) => idx !== i));
                          if (cover === p.file_url) setCover("");
                        }}
                        className="absolute left-1 top-1 grid size-6 place-items-center rounded-lg bg-destructive text-white"
                        title="حذف الصورة"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                    <Input
                      value={p.caption ?? ""}
                      onChange={(e) =>
                        setPhotos((list) =>
                          list.map((x, idx) => (idx === i ? { ...x, caption: e.target.value } : x)),
                        )
                      }
                      placeholder="عنوان الصورة"
                      className="mt-1.5 h-8 rounded-lg text-[11px]"
                    />
                    <button
                      onClick={() => setCover(p.file_url)}
                      className={`mt-1 w-full rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${
                        cover === p.file_url
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-secondary"
                      }`}
                    >
                      {cover === p.file_url ? "صورة الغلاف" : "اجعلها الغلاف"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {published ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                ظاهر للطلاب وأولياء الأمور
              </p>
              <p className="text-[11px] text-muted-foreground">
                أوقفه ريثما تجمع الصور، ثم شغّله عندما يصبح الألبوم جاهزاً.
              </p>
            </div>
            <Switch checked={published} onCheckedChange={setPublished} />
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
            {save.isPending ? "جارٍ الحفظ…" : "حفظ الألبوم"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

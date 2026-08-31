import { createFileRoute } from "@tanstack/react-router";
import { groupSearch } from "@/lib/preselect";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Download,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Pencil,
  Presentation,
  Share2,
  Trash2,
  Upload,
  Users2,
} from "lucide-react";
import { PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/shared/confirm";
import { apiUpload, fileUrl } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import {
  useClassFiles,
  useClasses,
  useCreateFolder,
  useDeleteDriveItem,
  useDrive,
  useDriveTree,
  useMoveDriveItem,
  useRenameDriveItem,
  useSetDriveSharing,
  useSharedFiles,
  type DriveFile,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/files")({
  validateSearch: groupSearch,
  component: FilesPage,
});

const ICONS: Record<string, typeof FileText> = {
  image: ImageIcon,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
  sheet: FileSpreadsheet,
  slides: Presentation,
  pdf: FileText,
  document: FileText,
};

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} ج.ب`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} م.ب`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${bytes} بايت`;
}

function FilesPage() {
  // Arrived from a class: show what is published to it, which is what
  // "نشر ملف للشعبة" means from the other side.
  const { group: groupFromUrl } = Route.useSearch();
  const [tab, setTab] = useState<"mine" | "shared" | "class">(groupFromUrl ? "class" : "mine");
  const [folder, setFolder] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  return (
    <>
      <PageHeader
        title="ملفاتي"
        subtitle="مساحتك الخاصة لحفظ أوراق العمل والامتحانات والعروض — ومشاركتها مع الزملاء أو نشرها لشعبة."
      />

      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-card p-1">
        {[
          { key: "mine" as const, label: "ملفاتي" },
          { key: "shared" as const, label: "مشتركة معي" },
          ...(groupFromUrl ? [{ key: "class" as const, label: "ملفات الشعبة" }] : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              tab === t.key
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "class" && groupFromUrl ? (
        <ClassFilesTab studentGroup={groupFromUrl} />
      ) : tab === "mine" ? (
        <MyDrive folder={folder} setFolder={setFolder} search={search} setSearch={setSearch} />
      ) : (
        <SharedTab />
      )}
    </>
  );
}

function MyDrive({
  folder,
  setFolder,
  search,
  setSearch,
}: {
  folder: string | undefined;
  setFolder: (f: string | undefined) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { data, isLoading, refetch } = useDrive(folder, search || undefined);
  const createFolder = useCreateFolder();
  const del = useDeleteDriveItem();
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState<{
    id: string;
    kind: "file" | "folder";
    title: string;
  } | null>(null);
  const [moving, setMoving] = useState<{
    id: string;
    kind: "file" | "folder";
    title: string;
  } | null>(null);
  const [sharing, setSharing] = useState<DriveFile | null>(null);
  const [newFolder, setNewFolder] = useState(false);

  const usage = data?.usage;

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let done = 0;
    for (const file of Array.from(files)) {
      try {
        await apiUpload<{ id: string }>("drive.upload", file, folder ? { folder } : {});
        done += 1;
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e, "تعذّر رفع الملف.")}`);
      }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    if (done) {
      toast.success(done === 1 ? "تم رفع الملف." : `تم رفع ${done} ملفات.`);
      void refetch();
    }
  }

  async function remove(id: string, kind: "file" | "folder", title: string) {
    const ok = await confirm({
      title: kind === "folder" ? `حذف المجلد «${title}»؟` : `حذف الملف «${title}»؟`,
      description:
        kind === "folder"
          ? "لا يمكن حذف مجلد يحتوي على ملفات أو مجلدات."
          : "سيُحذف الملف نهائياً ولا يمكن التراجع.",
      confirmLabel: "حذف",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await del.mutateAsync({ item: id, kind });
      toast.success("تم الحذف.");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحذف."));
    }
  }

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="card-surface flex items-center gap-3 p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <HardDrive className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">المساحة المستخدمة</span>
              <span className="num font-semibold">
                {humanSize(usage?.used ?? 0)} / {humanSize(usage?.quota ?? 0)}
              </span>
            </div>
            <ProgressBar
              value={usage?.percent ?? 0}
              tone={
                (usage?.percent ?? 0) > 90
                  ? "danger"
                  : (usage?.percent ?? 0) > 70
                    ? "warning"
                    : "success"
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="num">{usage?.files ?? 0}</span> ملفاً في{" "}
              <span className="num">{usage?.folders ?? 0}</span> مجلداً
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void onUpload(e.target.files)}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            رفع ملفات
          </button>
          <button
            onClick={() => setNewFolder(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            <FolderPlus className="size-4" />
            مجلد جديد
          </button>
        </div>
      </div>

      <SectionCard
        title="الملفات"
        actions={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في كل ملفاتك…"
            className="w-56"
          />
        }
      >
        {/* Where you are. A search ignores the folder, so the trail is hidden
            while searching rather than lying about the scope. */}
        {!data?.searching && (
          <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
            <button
              onClick={() => setFolder(undefined)}
              className={cn(
                "rounded-lg px-2 py-1 font-semibold",
                folder ? "text-primary hover:bg-secondary" : "text-muted-foreground",
              )}
            >
              ملفاتي
            </button>
            {(data?.breadcrumb ?? []).map((b, i, all) => (
              <span key={b.id} className="flex items-center gap-1">
                <ChevronLeft className="size-3 text-muted-foreground" />
                <button
                  onClick={() => setFolder(b.id)}
                  className={cn(
                    "rounded-lg px-2 py-1 font-semibold",
                    i === all.length - 1
                      ? "text-muted-foreground"
                      : "text-primary hover:bg-secondary",
                  )}
                >
                  {b.title}
                </button>
              </span>
            ))}
          </div>
        )}

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : (data?.folders.length ?? 0) === 0 && (data?.files.length ?? 0) === 0 ? (
          <EmptyBlock
            title={search ? "لا نتائج" : "المجلد فارغ"}
            description={
              search ? "لا يوجد ملف أو مجلد بهذا الاسم." : "ارفع ملفاً أو أنشئ مجلداً للبدء."
            }
            icon={<FolderOpen className="size-6" />}
          />
        ) : (
          <div className="space-y-4">
            {(data?.folders.length ?? 0) > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {data!.folders.map((f) => (
                  <div
                    key={f.id}
                    className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <button
                      onClick={() => {
                        setSearch("");
                        setFolder(f.id);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-start"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
                        <Folder className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{f.title}</span>
                        <span className="num block text-[11px] text-muted-foreground">
                          {f.folder_count > 0 ? `${f.folder_count} مجلد · ` : ""}
                          {f.file_count} ملف
                        </span>
                      </span>
                    </button>
                    <ItemMenu
                      onRename={() => setRenaming({ id: f.id, kind: "folder", title: f.title })}
                      onMove={() => setMoving({ id: f.id, kind: "folder", title: f.title })}
                      onDelete={() => void remove(f.id, "folder", f.title)}
                    />
                  </div>
                ))}
              </div>
            )}

            {(data?.files.length ?? 0) > 0 && (
              <ul className="divide-y divide-border">
                {data!.files.map((f) => {
                  const Icon = ICONS[f.kind] ?? FileText;
                  return (
                    <li key={f.id} className="flex items-center gap-3 py-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{f.title}</span>
                          {f.is_published && <Pill tone="success">منشور لشعبة</Pill>}
                          {f.shared_with_staff && <Pill tone="info">مشترك</Pill>}
                        </p>
                        <p className="num text-[11px] text-muted-foreground">
                          {humanSize(f.file_size)} · {f.modified.slice(0, 10)}
                          {f.download_count > 0 ? ` · ${f.download_count} تنزيل` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <a
                          href={fileUrl(f.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-border p-2 hover:bg-secondary"
                          aria-label="تنزيل"
                        >
                          <Download className="size-3.5" />
                        </a>
                        <ItemMenu
                          onShare={() => setSharing(f)}
                          onRename={() => setRenaming({ id: f.id, kind: "file", title: f.title })}
                          onMove={() => setMoving({ id: f.id, kind: "file", title: f.title })}
                          onDelete={() => void remove(f.id, "file", f.title)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </SectionCard>

      {newFolder && (
        <NameDialog
          title="مجلد جديد"
          label="اسم المجلد"
          initial=""
          onClose={() => setNewFolder(false)}
          onSubmit={async (title) => {
            await createFolder.mutateAsync({ title, ...(folder ? { parent_folder: folder } : {}) });
            toast.success("تم إنشاء المجلد.");
          }}
        />
      )}
      {renaming && <RenameDialog item={renaming} onClose={() => setRenaming(null)} />}
      {moving && <MoveDialog item={moving} onClose={() => setMoving(null)} />}
      {sharing && <ShareDialog file={sharing} onClose={() => setSharing(null)} />}
    </>
  );
}

function ItemMenu({
  onShare,
  onRename,
  onMove,
  onDelete,
}: {
  onShare?: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-lg border border-border p-2 hover:bg-secondary"
          aria-label="خيارات"
        >
          <MoreVertical className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onShare && (
          <DropdownMenuItem onClick={onShare}>
            <Share2 className="ms-2 size-3.5" />
            المشاركة والنشر
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="ms-2 size-3.5" />
          إعادة تسمية
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMove}>
          <FolderOpen className="ms-2 size-3.5" />
          نقل إلى…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="ms-2 size-3.5" />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NameDialog({
  title,
  label,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  initial: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!value.trim()) {
      toast.error("الاسم مطلوب.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحفظ."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div>
          <Label>{label}</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            تراجع
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            حفظ
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  item,
  onClose,
}: {
  item: { id: string; kind: "file" | "folder"; title: string };
  onClose: () => void;
}) {
  const rename = useRenameDriveItem();
  return (
    <NameDialog
      title="إعادة تسمية"
      label="الاسم الجديد"
      initial={item.title}
      onClose={onClose}
      onSubmit={async (title) => {
        await rename.mutateAsync({ item: item.id, kind: item.kind, title });
        toast.success("تم تغيير الاسم.");
      }}
    />
  );
}

function MoveDialog({
  item,
  onClose,
}: {
  item: { id: string; kind: "file" | "folder"; title: string };
  onClose: () => void;
}) {
  const { data } = useDriveTree();
  const move = useMoveDriveItem();
  const [target, setTarget] = useState<string>("__root__");

  async function submit() {
    try {
      await move.mutateAsync({
        item: item.id,
        kind: item.kind,
        ...(target === "__root__" ? {} : { folder: target }),
      });
      toast.success("تم النقل.");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر النقل."));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>نقل «{item.title}»</DialogTitle>
        </DialogHeader>
        <div>
          <Label>إلى المجلد</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">ملفاتي (الجذر)</SelectItem>
              {(data?.folders ?? [])
                .filter((f) => f.id !== item.id)
                .map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            تراجع
          </button>
          <button
            onClick={() => void submit()}
            disabled={move.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            نقل
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ file, onClose }: { file: DriveFile; onClose: () => void }) {
  const { data: classes } = useClasses();
  const setSharing = useSetDriveSharing();
  const [staff, setStaff] = useState(file.shared_with_staff);
  const [published, setPublished] = useState(file.is_published);
  const [group, setGroup] = useState(file.student_group ?? "");
  const [description, setDescription] = useState(file.description ?? "");

  async function submit() {
    try {
      await setSharing.mutateAsync({
        file: file.id,
        shared_with_staff: staff ? 1 : 0,
        is_published: published ? 1 : 0,
        ...(group ? { student_group: group } : {}),
        description,
      });
      toast.success("تم تحديث المشاركة.");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر تحديث المشاركة."));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>مشاركة «{file.title}»</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-border p-3">
            <Switch checked={staff} onCheckedChange={setStaff} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">مشاركة مع الزملاء</span>
              <span className="block text-xs text-muted-foreground">
                يظهر للمعلمين والإدارة في «مشتركة معي» للقراءة فقط — يبقى الملف ملكك.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-border p-3">
            <Switch checked={published} onCheckedChange={setPublished} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">نشر لشعبة</span>
              <span className="block text-xs text-muted-foreground">
                يراه طلاب الشعبة وأولياء أمورهم.
              </span>
            </span>
          </label>

          {published && (
            <div>
              <Label>الشعبة</Label>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الشعبة" />
                </SelectTrigger>
                <SelectContent>
                  {(classes ?? []).map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.student_group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>وصف (اختياري)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            تراجع
          </button>
          <button
            onClick={() => void submit()}
            disabled={setSharing.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            حفظ
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SharedTab() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useSharedFiles(search || undefined);
  const files = data?.files ?? [];

  return (
    <SectionCard
      title="ملفات شاركها الزملاء"
      description="للقراءة والتنزيل فقط — كل ملف يبقى ملك صاحبه."
      actions={
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث…"
          className="w-56"
        />
      }
    >
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : files.length === 0 ? (
        <EmptyBlock
          title="لا توجد ملفات مشتركة"
          description="لم يشارك أحد من الزملاء ملفاً بعد."
          icon={<Users2 className="size-6" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {files.map((f) => {
            const Icon = ICONS[f.kind] ?? FileText;
            return (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {f.owner_name} · <span className="num">{humanSize(f.file_size)}</span>
                  </p>
                </div>
                <a
                  href={fileUrl(f.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border p-2 hover:bg-secondary"
                  aria-label="تنزيل"
                >
                  <Download className="size-3.5" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/** What a teacher has published to one class — the other side of "نشر لشعبة". */
function ClassFilesTab({ studentGroup }: { studentGroup: string }) {
  const { data, isLoading } = useClassFiles(studentGroup);
  const files = data?.files ?? [];

  return (
    <SectionCard title="ملفات منشورة لهذه الشعبة" description="ما يراه طلاب الشعبة وأولياء أمورهم.">
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : files.length === 0 ? (
        <EmptyBlock
          title="لا ملفات منشورة لهذه الشعبة"
          description="انشر ملفاً من «ملفاتي» عبر خيار المشاركة لتظهر هنا."
          icon={<FolderOpen className="size-6" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {files.map((f) => {
            const Icon = ICONS[f.kind] ?? FileText;
            return (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {f.owner_name ?? ""} · <span className="num">{humanSize(f.file_size)}</span>
                    {f.download_count > 0 ? ` · ${f.download_count} تنزيل` : ""}
                  </p>
                </div>
                <a
                  href={fileUrl(f.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border p-2 hover:bg-secondary"
                  aria-label="تنزيل"
                >
                  <Download className="size-3.5" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

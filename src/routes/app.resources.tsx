import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Headphones,
  Link2,
  Plus,
  Presentation,
  Trash2,
  Video,
  type LucideIcon,
} from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { RichText, RichTextView } from "@/components/shared/rich-text";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { FileList, FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { byRole, isBackOffice } from "@/lib/roles";
import {
  useDeleteResource,
  useOpenResource,
  useResourceOptions,
  useResources,
  useSaveResource,
  type ResourceItem,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/resources")({
  head: () => ({
    meta: [
      { title: "مصادر المواد — Match Education" },
      {
        name: "description",
        content: "ملفات وفيديوهات وعروض تعليمية لكل مادة يرفعها المعلم للطلاب.",
      },
    ],
  }),
  component: ResourcesPage,
});

const ICONS: Record<string, LucideIcon> = {
  Document: FileText,
  Video: Video,
  Presentation: Presentation,
  Worksheet: FileText,
  Link: Link2,
  Audio: Headphones,
  Other: FileText,
};

const TONES: Record<string, string> = {
  Document: "bg-info-soft text-info",
  Video: "bg-destructive-soft text-destructive",
  Presentation: "bg-warm-soft text-warm-foreground",
  Worksheet: "bg-primary-soft text-primary",
  Link: "bg-secondary text-foreground",
  Audio: "bg-success-soft text-success",
  Other: "bg-secondary text-foreground",
};

function ResourcesPage() {
  const { role } = useApp();
  const canPublish = isBackOffice(role) || role === "teacher";

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [course, setCourse] = useState("");
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [creating, setCreating] = useState(false);

  const viewed = useViewedStudent();
  const query = useResources({
    ...(search ? { search } : {}),
    ...(type ? { resource_type: type } : {}),
    ...(course ? { course } : {}),
    ...(viewed ? { student: viewed } : {}),
  });
  const remove = useDeleteResource();
  const confirm = useConfirm();

  const subjects = query.data?.subjects ?? [];
  const allItems = subjects.flatMap((s) => s.items);
  const videos = allItems.filter((i) => i.type === "Video").length;

  async function removeResource(item: ResourceItem) {
    const ok = await confirm({
      title: `حذف «${item.title}»؟`,
      description: "لن يتمكن الطلاب من الوصول إليه بعد الحذف.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(item.id);
      toast.success("تم حذف المصدر");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  return (
    <>
      <PageHeader
        title={byRole(role, "مصادر المواد", {
          teacher: "مصادر موادي",
          student: "مصادر دراستي",
          parent: "مصادر مواد الأبناء",
        })}
        subtitle={byRole(role, "ملفات وفيديوهات وعروض تعليمية مرتبة حسب المادة", {
          teacher: "ارفع الملفات والفيديوهات لطلابك",
          student: "كل ما رفعه معلموك من ملفات وفيديوهات",
          parent: "المواد التعليمية المتاحة لأبنائك",
        })}
        actions={
          canPublish ? (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="size-4" />
              مصدر جديد
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="إجمالي المصادر" value={query.data?.total ?? 0} icon={BookOpen} tone="primary" />
        <KpiCard label="عدد المواد" value={subjects.length} icon={FileText} tone="info" />
        <KpiCard label="فيديوهات" value={videos} icon={Video} tone="accent" />
      </div>

      <div className="card-surface my-5 grid gap-3 p-4 md:grid-cols-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن مصدر…"
          className="h-10 rounded-xl"
        />
        <SearchableSelect
          options={(query.data?.types ?? []).map((t) => ({ value: t.code, label: t.label }))}
          value={type}
          onChange={setType}
          placeholder="كل الأنواع"
          clearable
          clearLabel="كل الأنواع"
        />
        <SearchableSelect
          options={subjects.map((s) => ({ value: s.course, label: s.course }))}
          value={course}
          onChange={setCourse}
          placeholder="كل المواد"
          clearable
          clearLabel="كل المواد"
        />
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={5} />
      ) : subjects.length === 0 ? (
        <EmptyBlock
          title="لا توجد مصادر"
          description={
            canPublish
              ? "ارفع ملفاً أو أضف رابط فيديو ليراه طلابك."
              : "سيظهر هنا كل ما يرفعه معلموك."
          }
          icon={<BookOpen className="size-6" />}
        />
      ) : (
        <div className="space-y-5">
          {subjects.map((s) => (
            <SectionCard
              key={s.course}
              title={s.course}
              description={`${s.count} مصدر`}
              actions={<BookOpen className="size-4 text-muted-foreground" />}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {s.items.map((item) => (
                  <ResourceCard
                    key={item.id}
                    item={item}
                    canManage={canPublish}
                    onEdit={() => setEditing(item)}
                    onDelete={() => removeResource(item)}
                  />
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ResourceDialog
          resource={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ResourceCard({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item: ResourceItem;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const open = useOpenResource();
  const Icon = ICONS[item.type] ?? FileText;

  // Count a view once the student actually opens the material.
  function track() {
    open.mutate(item.id);
  }

  return (
    <div className="flex flex-col rounded-xl border border-border p-4 transition-all hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONES[item.type] ?? ""}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone="muted">{item.type_label}</Pill>
            {item.topic && <span className="text-[11px] text-muted-foreground">{item.topic}</span>}
          </div>
        </div>
      </div>

      {item.description && (
        <div className="mt-3 line-clamp-2 text-xs text-muted-foreground">
          <RichTextView html={item.description} />
        </div>
      )}

      {item.files.length > 0 && (
        <div className="mt-3">
          <FileList files={item.files} />
        </div>
      )}

      <div className="num mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Eye className="size-3" />
          {item.views}
        </span>
        {item.published_on && <span>{item.published_on}</span>}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-3">
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            onClick={track}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <ExternalLink className="size-3.5" />
            {item.type === "Video" ? "مشاهدة" : "فتح الرابط"}
          </a>
        )}
        {!item.url && item.files.length > 0 && (
          <button
            onClick={track}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold"
          >
            <Download className="size-3.5" />
            {item.files.length} ملف
          </button>
        )}
        {canManage && (
          <>
            <button
              onClick={onEdit}
              className="rounded-lg bg-secondary px-2.5 py-2 text-xs font-semibold hover:bg-primary-soft hover:text-primary"
            >
              تعديل
            </button>
            <button
              onClick={onDelete}
              aria-label="حذف"
              className="rounded-lg bg-secondary px-2 py-2 text-destructive hover:bg-destructive-soft"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ResourceDialog({
  resource,
  onClose,
}: {
  resource: ResourceItem | null;
  onClose: () => void;
}) {
  const options = useResourceOptions();
  const save = useSaveResource();

  const [form, setForm] = useState({
    title: resource?.title ?? "",
    course: resource?.course ?? "",
    student_group: resource?.student_group ?? "",
    resource_type: resource?.type ?? "Document",
    status: resource?.status ?? "Published",
    external_url: resource?.url ?? "",
    topic: resource?.topic ?? "",
  });
  const [description, setDescription] = useState(resource?.description ?? "");
  const [files, setFiles] = useState<UploadedFile[]>(resource?.files ?? []);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.title.trim() || !form.course) {
      toast.error("العنوان والمادة مطلوبان");
      return;
    }
    if (form.status === "Published" && !form.external_url && files.length === 0) {
      toast.error("أضف ملفاً أو رابطاً قبل النشر");
      return;
    }
    try {
      await save.mutateAsync({
        ...(resource ? { id: resource.id } : {}),
        ...form,
        description,
        files,
      });
      toast.success(resource ? "تم تحديث المصدر" : "تم نشر المصدر للطلاب");
      onClose();
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحفظ");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {resource ? "تعديل المصدر" : "مصدر تعليمي جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>العنوان</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label>المادة</Label>
            <SearchableSelect
              options={(options.data?.courses ?? []).map((c) => ({ value: c, label: c }))}
              value={form.course}
              onChange={(v) => set("course", v)}
              placeholder="اختر المادة"
            />
          </div>
          <div className="space-y-1.5">
            <Label>النوع</Label>
            <SearchableSelect
              options={(options.data?.types ?? []).map((t) => ({ value: t.code, label: t.label }))}
              value={form.resource_type}
              onChange={(v) => set("resource_type", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>الشعبة (اختياري)</Label>
            <SearchableSelect
              options={(options.data?.groups ?? []).map((g) => ({ value: g.id, label: g.name }))}
              value={form.student_group}
              onChange={(v) => set("student_group", v)}
              placeholder="كل الشُعب"
              clearable
              clearLabel="كل الشُعب"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الوحدة / الموضوع</Label>
            <Input value={form.topic} onChange={(e) => set("topic", e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>رابط خارجي (يوتيوب مثلاً)</Label>
            <Input
              value={form.external_url}
              onChange={(e) => set("external_url", e.target.value)}
              placeholder="https://youtube.com/..."
              className="rounded-xl"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>الوصف</Label>
            <RichText value={description} onChange={setDescription} placeholder="شرح مختصر…" minHeight={80} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>الملفات</Label>
            <FileUpload files={files} onChange={setFiles} maxFiles={10} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-11 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "جارٍ الحفظ…" : "نشر للطلاب"}
          </button>
          <button onClick={onClose} className="h-11 rounded-xl border border-border px-5 text-sm font-semibold">
            إلغاء
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

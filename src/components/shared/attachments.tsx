import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { useConfirm } from "@/components/shared/confirm";
import { useAttachments, useDeleteAttachment, type Attachment } from "@/lib/api/hooks";
import { uploadAttachment } from "@/lib/api/export";

const DT = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });

function when(value: string): string {
  const d = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? "" : DT.format(d);
}

/** A recognisable icon per file family, so a list of scans is scannable. */
function iconFor(extension: string) {
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "tif", "tiff"].includes(extension))
    return FileImage;
  if (["xls", "xlsx", "csv"].includes(extension)) return FileSpreadsheet;
  if (extension === "zip") return FileArchive;
  return FileText;
}

/**
 * Documents attached to one record: birth certificates, ID copies, transfer
 * letters, medical notes.
 *
 * Files are private — they are served through Frappe's permission check, not
 * from a public folder — so a link opens only for someone allowed to see it.
 * The panel hides its upload and delete controls when the API says the viewer
 * may only read, rather than offering buttons that will be refused.
 */
export function Attachments({
  doctype,
  name,
  title = "المرفقات",
  description,
  compact = false,
}: {
  doctype: string;
  name: string;
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  const query = useAttachments(doctype, name);
  const remove = useDeleteAttachment();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const data = query.data;
  const canWrite = data?.canWrite ?? false;
  const maxBytes = data?.maxBytes ?? 15 * 1024 * 1024;
  const allowed = data?.allowed ?? [];

  async function send(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    let ok = 0;
    for (const file of list) {
      // Checked here as well as on the server: telling someone their 40 MB
      // scan is too large after the upload finishes is a poor experience.
      if (file.size > maxBytes) {
        toast.error(`${file.name}: الحجم يتجاوز ${Math.round(maxBytes / 1024 / 1024)} ميجابايت`);
        continue;
      }
      const extension = file.name.includes(".")
        ? file.name.split(".").pop()!.toLowerCase()
        : "";
      if (allowed.length > 0 && !allowed.includes(extension)) {
        toast.error(`${file.name}: نوع الملف غير مدعوم`);
        continue;
      }
      try {
        await uploadAttachment(doctype, name, file);
        ok += 1;
      } catch (err) {
        toast.error((err as { messageAr?: string }).messageAr || `تعذّر رفع ${file.name}`);
      }
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(ok === 1 ? "تم رفع الملف" : `تم رفع ${ok} ملفات`);
      void query.refetch();
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function drop(file: Attachment) {
    const ok = await confirm({
      title: "حذف هذا المرفق؟",
      description: `${file.fileName} — لا يمكن التراجع عن هذا الإجراء.`,
    });
    if (!ok) return;
    try {
      const res = await remove.mutateAsync(file.id);
      toast.success(res.message_ar || "تم الحذف");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر الحذف");
    }
  }

  const attachments = data?.attachments ?? [];

  return (
    <div className={compact ? "" : "card-surface p-5"}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold">
            <Paperclip className="size-4 text-muted-foreground" />
            {title}
            {attachments.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({attachments.length})
              </span>
            )}
          </p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {busy ? "جارٍ الرفع…" : "رفع ملف"}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && send(e.target.files)}
      />

      {canWrite && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) void send(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mb-3 cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
            dragging ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
          }`}
        >
          <Upload className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-1.5 text-xs font-medium">اسحب الملفات هنا أو اضغط للاختيار</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            حتى {Math.round(maxBytes / 1024 / 1024)} ميجابايت — PDF، صور، Word، Excel
          </p>
        </div>
      )}

      {query.isLoading ? (
        <p className="py-4 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
      ) : attachments.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          لا توجد مرفقات{canWrite ? " — ارفع أول ملف من الأعلى" : ""}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((f) => {
            const Icon = iconFor(f.extension);
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.fileName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {f.sizeLabel} · {when(f.uploadedOn)}
                  </p>
                </div>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="grid size-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary"
                  aria-label={`تنزيل ${f.fileName}`}
                >
                  <Download className="size-3.5" />
                </a>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => drop(f)}
                    disabled={remove.isPending}
                    className="grid size-7 shrink-0 place-items-center rounded-lg border border-destructive/30 text-destructive transition-colors hover:bg-destructive-soft disabled:opacity-50"
                    aria-label={`حذف ${f.fileName}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

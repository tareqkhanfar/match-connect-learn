import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { uploadAttachment } from "@/lib/api/export";

const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED = [
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt",
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "tif", "tiff", "zip",
];

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Files chosen before the record they belong to exists.
 *
 * A new application has no id until it is saved, and a file has to be attached
 * to something — so the choice is held in the browser and uploaded by
 * `uploadPending` once the save returns an id. Without this the registrar
 * would have to save the form, reopen it, and only then attach the birth
 * certificate they already had in their hand.
 */
export function PendingAttachments({
  files,
  onChange,
  title = "المرفقات",
  description,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  title?: string;
  description?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function add(incoming: FileList | File[]) {
    const accepted: File[] = [];
    for (const file of Array.from(incoming)) {
      const extension = file.name.includes(".")
        ? file.name.split(".").pop()!.toLowerCase()
        : "";
      if (!ALLOWED.includes(extension)) {
        toast.error(`${file.name}: نوع الملف غير مدعوم`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: الحجم يتجاوز ١٥ ميجابايت`);
        continue;
      }
      // Same name and size twice is a double-click, not two documents.
      if (files.some((f) => f.name === file.name && f.size === file.size)) continue;
      accepted.push(file);
    }
    if (accepted.length) onChange([...files, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="mb-3">
        <p className="flex items-center gap-2 font-bold">
          <Paperclip className="size-4 text-muted-foreground" />
          {title}
          {files.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({files.length})</span>
          )}
        </p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && add(e.target.files)}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) add(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
          dragging ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
        }`}
      >
        <Upload className="mx-auto size-5 text-muted-foreground" />
        <p className="mt-1.5 text-xs font-medium">اسحب الملفات هنا أو اضغط للاختيار</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          سيتم رفعها تلقائياً بعد حفظ الطلب
        </p>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border p-2.5"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {sizeLabel(f.size)} · بانتظار الحفظ
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="grid size-7 shrink-0 place-items-center rounded-lg border border-destructive/30 text-destructive transition-colors hover:bg-destructive-soft"
                aria-label={`إزالة ${f.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Upload files that were staged before the record existed.
 *
 * Returns how many succeeded. A failed upload is reported but does not undo
 * the save: the application itself is the important record, and a document
 * can be added again from the record afterwards.
 */
export async function uploadPending(
  doctype: string,
  name: string,
  files: File[],
): Promise<number> {
  let uploaded = 0;
  for (const file of files) {
    try {
      await uploadAttachment(doctype, name, file);
      uploaded += 1;
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || `تعذّر رفع ${file.name}`);
    }
  }
  return uploaded;
}

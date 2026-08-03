import { useRef, useState } from "react";
import {
  Upload,
  X,
  FileText,
  FileImage,
  FileArchive,
  FileVideo,
  FileAudio,
  File as FileIcon,
  Loader2,
  Download,
} from "lucide-react";
import { apiUpload, fileUrl } from "../../lib/api/client";

export interface UploadedFile {
  file_url: string;
  file_name: string;
  file_size?: number;
}

const MAX_BYTES = 15 * 1024 * 1024;

/** Must mirror ALLOWED_EXTENSIONS in the backend, so we fail fast client-side. */
const ALLOWED = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt",
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
  "zip", "rar", "7z",
  "mp3", "wav", "m4a", "mp4", "webm", "mov",
]);

function extensionOf(name: string) {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

function iconFor(name: string) {
  const ext = extensionOf(name);
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return FileImage;
  if (["zip", "rar", "7z"].includes(ext)) return FileArchive;
  if (["mp4", "webm", "mov"].includes(ext)) return FileVideo;
  if (["mp3", "wav", "m4a"].includes(ext)) return FileAudio;
  if (["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext)) return FileText;
  return FileIcon;
}

export function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

interface FileUploadProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  hint?: string;
}

export function FileUpload({
  files,
  onChange,
  disabled = false,
  maxFiles = 10,
  hint = "PDF، صور، مستندات، صوت أو فيديو — بحد أقصى ١٥ م.ب للملف",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  async function addFiles(incoming: FileList | null) {
    if (!incoming?.length) return;
    setError("");

    const room = maxFiles - files.length;
    if (room <= 0) {
      setError(`لا يمكن إرفاق أكثر من ${maxFiles} ملفات.`);
      return;
    }

    const batch = Array.from(incoming).slice(0, room);
    setBusy(true);
    const added: UploadedFile[] = [];

    for (const file of batch) {
      const ext = extensionOf(file.name);
      if (!ALLOWED.has(ext)) {
        setError(`نوع الملف .${ext} غير مسموح به.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`الملف "${file.name}" يتجاوز ١٥ م.ب.`);
        continue;
      }
      try {
        const result = await apiUpload<UploadedFile>("assignments.upload_file", file);
        added.push(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر رفع الملف.");
      }
    }

    setBusy(false);
    if (added.length) onChange([...files, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(url: string) {
    onChange(files.filter((f) => f.file_url !== url));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && !busy) void addFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-input hover:border-primary/50"
        } ${disabled || busy ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {busy ? "جارٍ الرفع…" : "اسحب الملفات هنا أو اضغط للاختيار"}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          disabled={disabled || busy}
          onChange={(e) => void addFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => {
            const Icon = iconFor(f.file_name);
            return (
              <li
                key={f.file_url}
                className="flex items-center gap-3 rounded-lg border border-input bg-muted/30 px-3 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.file_name}</p>
                  {f.file_size ? (
                    <p className="text-xs text-muted-foreground">{formatBytes(f.file_size)}</p>
                  ) : null}
                </div>
                {!disabled && (
                  <button
                    type="button"
                    title="إزالة"
                    aria-label={`إزالة ${f.file_name}`}
                    onClick={() => remove(f.file_url)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
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

/** Read-only list of attachments, with download links. */
export function FileList({ files, empty = "لا توجد مرفقات." }: { files: UploadedFile[]; empty?: string }) {
  if (!files.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {files.map((f) => {
        const Icon = iconFor(f.file_name);
        return (
          <li
            key={f.file_url}
            className="flex items-center gap-3 rounded-lg border border-input bg-muted/30 px-3 py-2"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{f.file_name}</p>
              {f.file_size ? (
                <p className="text-xs text-muted-foreground">{formatBytes(f.file_size)}</p>
              ) : null}
            </div>
            <a
              href={fileUrl(f.file_url)}
              target="_blank"
              rel="noreferrer"
              title="تنزيل"
              aria-label={`تنزيل ${f.file_name}`}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <Download className="h-4 w-4" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

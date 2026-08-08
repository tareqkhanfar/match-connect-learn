import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/shared/ui-kit";
import { useConfirm } from "@/components/shared/confirm";
import { apiPost } from "@/lib/api/client";
import { uploadStudentPhoto } from "@/lib/api/export";
import { errorMessage } from "@/lib/api/error-message";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * The student's photo, with upload and removal for staff.
 *
 * Falls back to initials when no photo has been set, so the card never has a
 * hole in it. The size check happens here as well as on the server: rejecting
 * a 12 MB phone photo before it is uploaded is faster and clearer than after.
 */
export function StudentPhoto({
  student,
  name,
  image,
  canEdit,
  onChange,
}: {
  student: string;
  name: string;
  image: string | null;
  canEdit: boolean;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("حجم الصورة يتجاوز ٥ ميجابايت");
      return;
    }
    setBusy(true);
    try {
      await uploadStudentPhoto(student, file);
      toast.success("تم تحديث الصورة");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر رفع الصورة"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "حذف الصورة؟",
      description: "سيعود عرض الأحرف الأولى من الاسم بدلاً من الصورة.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiPost("students.remove_student_photo", { student });
      toast.success("تم حذف الصورة");
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto w-fit">
      <Avatar name={name} src={image} className="size-20 rounded-3xl text-xl" />

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="تغيير الصورة"
            title="تغيير الصورة"
            className="absolute -bottom-1 -left-1 grid size-8 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-soft transition-colors hover:bg-primary-soft hover:text-primary disabled:opacity-60"
          >
            <Camera className="size-4" />
          </button>
          {image && (
            <button
              onClick={remove}
              disabled={busy}
              aria-label="حذف الصورة"
              title="حذف الصورة"
              className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-xl border border-border bg-card text-destructive shadow-soft transition-colors hover:bg-destructive-soft disabled:opacity-60"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

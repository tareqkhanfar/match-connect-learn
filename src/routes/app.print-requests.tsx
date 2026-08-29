import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Clock,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Printer,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { useConfirm } from "@/components/shared/confirm";
import { apiUpload, fileUrl } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import { useApp } from "@/lib/app-context";
import {
  useClasses,
  useDeletePrintRequest,
  usePrintRequests,
  useSavePrintRequest,
  useSetPrintStatus,
  useSubjects,
  type PrintAttachment,
  type PrintRequestRow,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/print-requests")({
  head: () => ({
    meta: [
      { title: "طلبات الطباعة — Match Education" },
      {
        name: "description",
        content: "إرسال الامتحانات وأوراق العمل للسكرتير للطباعة ومتابعة حالتها.",
      },
    ],
  }),
  component: PrintRequestsPage,
});

const MAX_FILE_MB = 25;

/**
 * The print queue.
 *
 * A teacher sends files and watches the status; the office works the queue and
 * moves each job along. What the screen shows either side is decided by the
 * server — a teacher sees only their own requests, because another teacher's
 * exam paper is attached to theirs.
 */
function PrintRequestsPage() {
  const { role } = useApp();
  const isOffice = role === "admin" || role === "secretary";

  const [status, setStatus] = useState("all");
  const query = usePrintRequests(status === "all" ? undefined : status);
  const [editing, setEditing] = useState<PrintRequestRow | "new" | null>(null);

  const requests = query.data?.requests ?? [];
  const counts = query.data?.counts ?? {};
  const statuses = query.data?.statuses ?? [];

  return (
    <>
      <PageHeader
        title={isOffice ? "طابور الطباعة" : "طلبات الطباعة"}
        subtitle={
          isOffice
            ? "طلبات المعلمين — حدّث الحالة عند الطباعة والاستلام"
            : "أرسل الامتحانات وأوراق العمل للسكرتير، وتابع حالتها"
        }
        actions={
          <button
            onClick={() => setEditing("new")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5"
          >
            <Plus className="size-4" />
            طلب جديد
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          onClick={() => setStatus("all")}
          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
            status === "all" ? "border-primary bg-primary-soft text-primary" : "border-border"
          }`}
        >
          الكل
        </button>
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              status === s.value ? "border-primary bg-primary-soft text-primary" : "border-border"
            }`}
          >
            {s.label}
            {counts[s.value] ? <span className="num mr-1">({counts[s.value]})</span> : null}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <TableSkeleton />
      ) : requests.length === 0 ? (
        <EmptyBlock
          title="لا توجد طلبات"
          description={
            isOffice
              ? "ستظهر هنا طلبات المعلمين فور إرسالها."
              : "أنشئ طلباً وأرفق الملفات ليطبعها السكرتير."
          }
          icon={<Printer className="size-6" />}
        />
      ) : (
        <ul className="space-y-2.5">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} onEdit={() => setEditing(r)} />
          ))}
        </ul>
      )}

      {editing && (
        <RequestDialog
          request={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/** One request, with the office's controls when the caller is the office. */
function RequestCard({ request: r, onEdit }: { request: PrintRequestRow; onEdit: () => void }) {
  const setStatus = useSetPrintStatus();
  const remove = useDeletePrintRequest();
  const confirm = useConfirm();

  // The moves the office may make from here. Mirrors the server, which is the
  // authority — offering a move it will refuse only wastes a click.
  const NEXT: Record<string, string[]> = {
    Submitted: ["In Progress", "Ready", "Rejected"],
    "In Progress": ["Ready", "Rejected"],
    Ready: ["Collected", "In Progress"],
    Collected: [],
    Rejected: [],
  };
  const LABEL: Record<string, string> = {
    "In Progress": "بدء الطباعة",
    Ready: "جاهز للاستلام",
    Collected: "تم الاستلام",
    Rejected: "رفض",
  };

  async function move(next: string) {
    try {
      const res = await setStatus.mutateAsync({ request: r.id, status: next });
      toast.success(res.message_ar || "تم التحديث");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تحديث الحالة"));
    }
  }

  async function drop() {
    const ok = await confirm({
      title: `سحب طلب «${r.title}»؟`,
      description: "سيُحذف الطلب وملفاته نهائياً.",
    });
    if (!ok) return;
    try {
      const res = await remove.mutateAsync({ request: r.id });
      toast.success(res.message_ar || "تم السحب");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر السحب"));
    }
  }

  return (
    <li className="card-surface p-3.5">
      <div className="flex flex-wrap items-start gap-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary">
          <FileText className="size-5 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold">{r.title}</span>
            <Pill tone={r.status_tone as "success" | "warning" | "danger" | "muted"}>
              {r.status_label}
            </Pill>
            {r.urgent && (
              <Pill tone="danger">
                <Zap className="ml-0.5 inline size-2.5" />
                عاجل
              </Pill>
            )}
          </p>
          <p className="num mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{r.type_label}</span>
            <span>· {r.copies} نسخة</span>
            {r.student_group && <span>· {r.student_group}</span>}
            {r.needed_by && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                مطلوب {r.needed_by}
              </span>
            )}
            <span>· {r.requested_by_name}</span>
          </p>
          {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
          {r.secretary_notes && (
            <p className="mt-1 rounded-lg bg-secondary px-2 py-1 text-xs">
              ملاحظة السكرتير: {r.secretary_notes}
            </p>
          )}

          <ul className="mt-2 flex flex-wrap gap-1.5">
            {r.attachments.map((a: PrintAttachment) => (
              <li key={a.file_url}>
                <a
                  href={fileUrl(a.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-[11px] font-semibold hover:bg-primary-soft hover:text-primary"
                >
                  <Paperclip className="size-3" />
                  {a.file_name ?? "ملف"}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
        {r.can_handle &&
          (NEXT[r.status] ?? []).map((next) => (
            <button
              key={next}
              onClick={() => void move(next)}
              disabled={setStatus.isPending}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                next === "Rejected"
                  ? "border border-destructive/40 text-destructive hover:bg-destructive-soft"
                  : "bg-secondary hover:bg-primary-soft hover:text-primary"
              }`}
            >
              {LABEL[next]}
            </button>
          ))}
        {r.can_edit && (
          <>
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
          </>
        )}
      </div>
    </li>
  );
}

/** Creating or editing a request, including the uploads. */
function RequestDialog({
  request,
  onClose,
}: {
  request: PrintRequestRow | null;
  onClose: () => void;
}) {
  const save = useSavePrintRequest();
  const classes = useClasses();
  const [form, setForm] = useState({
    title: request?.title ?? "",
    document_type: request?.document_type ?? "Worksheet",
    student_group: request?.student_group ?? "",
    course: request?.course ?? "",
    needed_by: request?.needed_by ?? "",
    notes: request?.notes ?? "",
  });
  const subjects = useSubjects(form.student_group ? { student_group: form.student_group } : {});
  const [copies, setCopies] = useState(String(request?.copies ?? 30));
  const [urgent, setUrgent] = useState(request?.urgent ?? false);
  const [files, setFiles] = useState<PrintAttachment[]>(request?.attachments ?? []);
  const [uploading, setUploading] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const chosen = Array.from(list);
    setUploading(chosen.length);
    const added: PrintAttachment[] = [];
    for (const file of chosen) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name}: أكبر من ${MAX_FILE_MB} ميجابايت`);
        continue;
      }
      try {
        const res = await apiUpload<{ file_url: string; file_name: string; file_size: number }>(
          "print_requests.upload_attachment",
          file,
          request ? { request: request.id } : {},
        );
        added.push({ ...res, pages: 0 });
      } catch (err) {
        toast.error(errorMessage(err, `تعذّر رفع ${file.name}`));
      }
    }
    setUploading(0);
    if (added.length) setFiles((f) => [...f, ...added]);
    if (input.current) input.current.value = "";
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("عنوان الطلب مطلوب");
      return;
    }
    if (!files.length) {
      toast.error("أرفق ملفاً واحداً على الأقل للطباعة");
      return;
    }
    try {
      const res = await save.mutateAsync({
        ...(request ? { request: request.id } : {}),
        ...form,
        copies: Number(copies) || 1,
        priority: urgent ? "Urgent" : "Normal",
        attachments: files.map((f) => ({
          file_url: f.file_url,
          file_name: f.file_name ?? "",
          file_size: f.file_size,
        })),
      });
      toast.success(res.message_ar || "تم إرسال الطلب");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ الطلب"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="size-5 text-primary" />
            {request ? "تعديل الطلب" : "طلب طباعة جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>عنوان الطلب</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثال: امتحان الرياضيات النصفي"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select
                value={form.document_type}
                onValueChange={(v) => setForm((f) => ({ ...f, document_type: v }))}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Exam">امتحان</SelectItem>
                  <SelectItem value="Worksheet">ورقة عمل</SelectItem>
                  <SelectItem value="Homework">واجب</SelectItem>
                  <SelectItem value="Handout">نشرة</SelectItem>
                  <SelectItem value="Other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>الشعبة</Label>
              <Select
                value={form.student_group}
                onValueChange={(v) =>
                  // The subject list is per class, so a subject chosen for
                  // another one may not exist here.
                  setForm((f) => ({ ...f, student_group: v, course: "" }))
                }
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="اختياري" />
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
            <div className="space-y-1.5">
              <Label>المادة</Label>
              <Select
                value={form.course}
                onValueChange={(v) => setForm((f) => ({ ...f, course: v }))}
                disabled={!form.student_group}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder={form.student_group ? "اختياري" : "اختر الشعبة أولاً"} />
                </SelectTrigger>
                <SelectContent>
                  {(subjects.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.course_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>عدد النسخ</Label>
              <Input
                type="number"
                min={1}
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
                className="num rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>مطلوب بحلول</Label>
              <Input
                type="date"
                value={form.needed_by}
                onChange={(e) => setForm((f) => ({ ...f, needed_by: e.target.value }))}
                className="num rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>تعليمات الطباعة</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="حجم الورق، ألوان، تدبيس، وجهين…"
              className="rounded-xl"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>الملفات ({files.length})</Label>
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
                    رفع ملفات
                  </>
                )}
              </button>
              <input
                ref={input}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.png,.jpg,.jpeg"
                onChange={(e) => void pick(e.target.files)}
                className="hidden"
              />
            </div>
            {files.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                لا ملفات بعد — الطلب بلا ملفات لا يمكن طباعته.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={f.file_url}
                    className="flex items-center gap-2 rounded-xl border border-border p-2"
                  >
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-xs">{f.file_name}</span>
                    <span className="num text-[10px] text-muted-foreground">
                      {Math.round((f.file_size || 0) / 1024)} ك.ب
                    </span>
                    <button
                      onClick={() => setFiles((list) => list.filter((_, idx) => idx !== i))}
                      className="rounded-lg p-1 text-destructive hover:bg-destructive-soft"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Zap className="size-4" />
                عاجل
              </p>
              <p className="text-[11px] text-muted-foreground">
                يظهر في أعلى طابور السكرتير قبل الطلبات العادية.
              </p>
            </div>
            <Switch checked={urgent} onCheckedChange={setUrgent} />
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
            {save.isPending ? "جارٍ الإرسال…" : request ? "حفظ" : "إرسال الطلب"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

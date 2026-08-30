import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Loader2,
  NotebookPen,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichText, sanitizeHtml } from "@/components/shared/rich-text";
import { useConfirm } from "@/components/shared/confirm";
import { apiUpload, fileUrl } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import { groupSearch } from "@/lib/preselect";
import { useApp } from "@/lib/app-context";
import {
  useClasses,
  useClassLogs,
  useDaySlots,
  useDeleteClassLog,
  useSaveClassLog,
  useSubjects,
  type ClassLog,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/class-log")({
  validateSearch: groupSearch,
  component: ClassLogPage,
});

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ClassLogPage() {
  const { role } = useApp();
  const isStaff = role === "admin" || role === "secretary" || role === "teacher";
  const { group: groupFromUrl } = Route.useSearch();

  const [group, setGroup] = useState(groupFromUrl ?? "");
  const [date, setDate] = useState(today());
  const [editing, setEditing] = useState<ClassLog | null>(null);
  const [creating, setCreating] = useState<{ slot?: string; course?: string } | null>(null);

  const classes = useClasses();
  const logs = useClassLogs(group ? { student_group: group } : {});
  const slots = useDaySlots(group || undefined, date);
  const remove = useDeleteClassLog();
  const confirm = useConfirm();

  async function drop(log: ClassLog) {
    const ok = await confirm({
      title: "حذف سجل الحصة؟",
      description: `${log.date} — ${log.topic ?? "بلا موضوع"}`,
      confirmLabel: "حذف",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ log: log.id });
      toast.success("تم حذف السجل.");
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحذف."));
    }
  }

  return (
    <>
      <PageHeader
        title="دفتر الحصص"
        subtitle={
          isStaff
            ? "وثّق ما جرى في كل حصة — ما شُرح، ما حُلّ، والواجب المطلوب — ليصل إلى الطالب وولي أمره."
            : "ما جرى في حصص أبنائك: ما شُرح في كل حصة والواجب المطلوب."
        }
        actions={
          isStaff ? (
            <button
              onClick={() => setCreating({})}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" />
              تسجيل حصة
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label className="text-xs">الشعبة</Label>
          <Select value={group || "all"} onValueChange={(v) => setGroup(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="كل الشُعب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الشُعب</SelectItem>
              {(classes.data ?? []).map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.student_group_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isStaff && (
          <div>
            <Label className="text-xs">يوم الحصص</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
      </div>

      {/* The teacher's own day: every lesson, and which already has a record.
          This is the point of entry — a teacher finishing period three should
          see period three, not an empty form asking which lesson they mean. */}
      {isStaff && (slots.data?.slots.length ?? 0) > 0 && (
        <SectionCard
          title={`حصص ${date}`}
          description={`${slots.data?.logged ?? 0} من ${slots.data?.slots.length ?? 0} موثّقة`}
          className="mb-4"
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {slots.data!.slots.map((s) => (
              <button
                key={s.slot}
                onClick={() =>
                  setCreating({ slot: s.slot, ...(s.course ? { course: s.course } : {}) })
                }
                className={`flex items-center gap-3 rounded-xl border p-3 text-start transition-colors ${
                  s.logged
                    ? "border-success/40 bg-success/5"
                    : "border-border hover:border-primary/40 hover:bg-secondary/40"
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                    s.logged ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {s.logged ? <Check className="size-4" /> : <NotebookPen className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.course ?? "حصة"}</span>
                  <span className="num block text-[11px] text-muted-foreground">
                    {s.group_name} · {s.from_time}–{s.to_time}
                  </span>
                </span>
                {s.logged && <Pill tone="success">موثّقة</Pill>}
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="السجلات">
        {logs.isLoading ? (
          <TableSkeleton rows={5} />
        ) : (logs.data?.logs.length ?? 0) === 0 ? (
          <EmptyBlock
            title="لا توجد سجلات"
            description={
              isStaff
                ? "سجّل ما جرى في الحصة ليصل إلى الطلاب وأولياء الأمور."
                : "لم يسجّل المعلمون شيئاً بعد."
            }
            icon={<BookOpen className="size-6" />}
          />
        ) : (
          <ul className="space-y-3">
            {logs.data!.logs.map((log) => (
              <li key={log.id} className="rounded-xl border border-border p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold">{log.topic ?? "حصة"}</span>
                      {log.course && <Pill tone="primary">{log.course}</Pill>}
                      {!log.is_published && <Pill tone="warning">غير منشور</Pill>}
                    </p>
                    <p className="num mt-0.5 text-[11px] text-muted-foreground">
                      {log.date}
                      {log.from_time ? ` · ${log.from_time}–${log.to_time}` : ""}
                      {log.group_name ? ` · ${log.group_name}` : ""}
                    </p>
                  </div>
                  {isStaff && (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => setEditing(log)}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => void drop(log)}
                        className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"
                        aria-label="حذف"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {log.what_was_done && (
                  <div
                    className="prose prose-sm mt-2 max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(log.what_was_done) }}
                  />
                )}
                {log.homework && (
                  <div className="mt-2 rounded-lg bg-secondary/50 p-2.5">
                    <p className="mb-1 text-[11px] font-bold text-muted-foreground">
                      الواجب المطلوب
                    </p>
                    <div
                      className="prose prose-sm max-w-none text-xs"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(log.homework) }}
                    />
                  </div>
                )}
                {log.attachments.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {log.attachments.map((a) => (
                      <li key={a.file_url}>
                        <a
                          href={fileUrl(a.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary"
                        >
                          <Paperclip className="size-3" />
                          <span className="max-w-40 truncate">{a.file_name}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {(creating || editing) && (
        <LogDialog
          log={editing}
          slot={creating?.slot}
          course={creating?.course}
          group={group}
          date={date}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function LogDialog({
  log,
  slot,
  course: courseFromSlot,
  group,
  date,
  onClose,
}: {
  log: ClassLog | null;
  slot?: string | undefined;
  course?: string | undefined;
  group: string;
  date: string;
  onClose: () => void;
}) {
  const classes = useClasses();
  const save = useSaveClassLog();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const [form, setForm] = useState({
    student_group: log?.student_group ?? group ?? "",
    course: log?.course ?? courseFromSlot ?? "",
    date: log?.date ?? date,
    topic: log?.topic ?? "",
    what_was_done: log?.what_was_done ?? "",
    homework: log?.homework ?? "",
    notes: log?.notes ?? "",
    is_published: log?.is_published ?? true,
  });
  const [files, setFiles] = useState(log?.attachments ?? []);

  const subjects = useSubjects(form.student_group ? { student_group: form.student_group } : {});

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    setUploading(list.length);
    const added: typeof files = [];
    for (const file of Array.from(list)) {
      try {
        const res = await apiUpload<{ file_url: string; file_name: string; file_size: number }>(
          "class_log.upload_attachment",
          file,
        );
        added.push(res);
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e, "تعذّر الرفع")}`);
      }
    }
    setUploading(0);
    if (added.length) setFiles((f) => [...f, ...added]);
    if (input.current) input.current.value = "";
  }

  async function submit() {
    if (!form.student_group || !form.date) {
      toast.error("الشعبة والتاريخ مطلوبان.");
      return;
    }
    try {
      await save.mutateAsync({
        ...(log ? { log: log.id } : {}),
        ...(slot ? { timetable_slot: slot } : {}),
        ...form,
        is_published: form.is_published ? 1 : 0,
        attachments: files,
      });
      toast.success("تم حفظ سجل الحصة.");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر الحفظ."));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="size-5 text-primary" />
            {log ? "تعديل سجل الحصة" : "تسجيل ما جرى في الحصة"}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[64vh] space-y-3 overflow-y-auto p-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>الشعبة</Label>
              <Select value={form.student_group} onValueChange={(v) => set("student_group", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
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
            <div>
              <Label>المادة</Label>
              <Select value={form.course} onValueChange={(v) => set("course", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  {(subjects.data ?? []).map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.course_name ?? s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                max={today()}
              />
            </div>
          </div>

          <div>
            <Label>موضوع الحصة</Label>
            <Input
              value={form.topic}
              onChange={(e) => set("topic", e.target.value)}
              placeholder="مثال: جمع الكسور المتشابهة"
            />
          </div>

          <div>
            <Label>ما تم إنجازه</Label>
            <RichText
              value={form.what_was_done}
              onChange={(v) => set("what_was_done", v)}
              placeholder="شرحنا… حللنا التمارين… ناقشنا…"
              minHeight={120}
            />
          </div>

          <div>
            <Label>الواجب المطلوب</Label>
            <RichText
              value={form.homework}
              onChange={(v) => set("homework", v)}
              placeholder="التمارين ٦-١٠ صفحة ٤٢"
              minHeight={80}
            />
          </div>

          <div>
            <Label>ملاحظات داخلية (لا تظهر للأهالي)</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>المرفقات ({files.length})</Label>
              <button
                onClick={() => input.current?.click()}
                disabled={uploading > 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold hover:bg-primary-soft hover:text-primary disabled:opacity-50"
              >
                {uploading > 0 ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                إرفاق
              </button>
              <input
                ref={input}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void pick(e.target.files)}
              />
            </div>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li
                    key={f.file_url}
                    className="flex items-center gap-2 rounded-lg border border-border p-1.5"
                  >
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-xs">{f.file_name}</span>
                    <button
                      onClick={() => setFiles((l) => l.filter((_, j) => j !== i))}
                      className="rounded p-0.5 text-destructive hover:bg-destructive-soft"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
            <Switch checked={form.is_published} onCheckedChange={(v) => set("is_published", v)} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                {form.is_published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                ظاهر للطلاب وأولياء الأمور
              </span>
              <span className="block text-[11px] text-muted-foreground">
                الطالب الغائب وولي الأمر يعرفان ما جرى دون الاعتماد على ذاكرة أحد.
              </span>
            </span>
          </label>
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
            disabled={save.isPending || uploading > 0}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            حفظ
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

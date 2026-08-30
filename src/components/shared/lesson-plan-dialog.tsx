import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Eye, EyeOff, Link2, NotebookPen, Save, Target, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pill } from "@/components/shared/ui-kit";
import { RichText, sanitizeHtml } from "@/components/shared/rich-text";
import { useConfirm } from "@/components/shared/confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import {
  useClassLogs,
  useDeleteLessonPlan,
  useLessonPlan,
  useSaveClassLog,
  useSaveLessonPlan,
} from "@/lib/api/hooks";

/**
 * What was prepared for one lesson.
 *
 * The same dialog serves both sides: a teacher who takes the lesson gets the
 * form, everyone else gets what the teacher published. Deciding that here
 * rather than in two components means a field added for the teacher cannot
 * quietly fail to reach the family — the server marks the difference with
 * `can_edit`, and the read-only side simply renders what it was given.
 */
export function LessonPlanDialog({
  courseSchedule,
  onClose,
}: {
  courseSchedule: string;
  onClose: () => void;
}) {
  const query = useLessonPlan(courseSchedule);
  const save = useSaveLessonPlan();
  const remove = useDeleteLessonPlan();
  const confirm = useConfirm();

  const data = query.data;
  const canEdit = data?.can_edit ?? false;

  const [form, setForm] = useState({
    title: "",
    objectives: "",
    content: "",
    homework: "",
    resources: "",
    notes: "",
  });
  const [published, setPublished] = useState(true);
  const [tab, setTab] = useState<"plan" | "log">("plan");

  // The dialog opens before the plan arrives, so the form is filled once it
  // does rather than starting empty and overwriting what is on record.
  useEffect(() => {
    const p = data?.plan;
    if (!p) return;
    setForm({
      title: p.title ?? "",
      objectives: p.objectives ?? "",
      content: p.content ?? "",
      homework: p.homework ?? "",
      resources: p.resources ?? "",
      notes: p.notes ?? "",
    });
    setPublished(p.is_published);
  }, [data?.plan]);

  async function submit() {
    try {
      const res = await save.mutateAsync({
        course_schedule: courseSchedule,
        ...form,
        is_published: published ? 1 : 0,
      });
      toast.success(res.message_ar || "تم حفظ التحضير");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ التحضير"));
    }
  }

  async function drop() {
    const ok = await confirm({
      title: "حذف تحضير هذه الحصة؟",
      description: "سيُحذف ما كُتب من أهداف ومحتوى وواجبات، ولن يعود الطلاب يرونه.",
    });
    if (!ok) return;
    try {
      const res = await remove.mutateAsync({ course_schedule: courseSchedule });
      toast.success(res.message_ar || "تم الحذف");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  const heading = [data?.course, data?.class_name].filter(Boolean).join(" — ");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotebookPen className="size-5 text-primary" />
            {tab === "plan" ? "تحضير الحصة" : "ما جرى في الحصة"}
          </DialogTitle>
          <DialogDescription>
            {heading}
            {data?.date ? ` · ${data.date}` : ""}
            {data?.teacher ? ` · ${data.teacher}` : ""}
          </DialogDescription>
        </DialogHeader>

        {/* The plan is what the teacher meant to do; the log is what the class
            actually did. Two records, one place — because the teacher is
            already here when the lesson ends. */}
        {canEdit && (
          <div className="mb-2 flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
            {[
              { key: "plan" as const, label: "التحضير" },
              { key: "log" as const, label: "توثيق ما جرى" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.key ? "bg-card shadow-soft" : "text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {canEdit && tab === "log" ? (
          <InlineClassLog
            studentGroup={data?.student_group ?? ""}
            course={data?.course ?? ""}
            date={data?.date ?? ""}
            onDone={onClose}
          />
        ) : query.isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : canEdit ? (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
            <div className="space-y-1.5">
              <Label>عنوان الدرس</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثال: الجملة الاسمية"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Target className="size-3.5" />
                أهداف الدرس
              </Label>
              <RichText
                value={form.objectives}
                onChange={(v) => setForm((f) => ({ ...f, objectives: v }))}
                placeholder="ما الذي سيتقنه الطالب بنهاية الحصة؟"
                minHeight={70}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" />
                محتوى الحصة
              </Label>
              <RichText
                value={form.content}
                onChange={(v) => setForm((f) => ({ ...f, content: v }))}
                placeholder="العناوين والأنشطة وخطوات الشرح…"
                minHeight={90}
              />
            </div>

            <div className="space-y-1.5">
              <Label>الواجب البيتي</Label>
              <RichText
                value={form.homework}
                onChange={(v) => setForm((f) => ({ ...f, homework: v }))}
                placeholder="ما هو مطلوب من الطالب قبل الحصة القادمة؟"
                minHeight={60}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Link2 className="size-3.5" />
                روابط ومصادر
              </Label>
              <Input
                value={form.resources}
                onChange={(e) => setForm((f) => ({ ...f, resources: e.target.value }))}
                placeholder="روابط الملفات أو الفيديوهات، مفصولة بفاصلة"
                className="rounded-xl"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <Label>ملاحظات خاصة بك</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="لا تظهر للطلاب ولا لأولياء الأمور إطلاقاً"
                className="rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {published ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  ظاهر للطلاب وأولياء الأمور
                </p>
                <p className="text-[11px] text-muted-foreground">
                  أوقفه ما دمت تحضّر، ثم شغّله عندما يصبح جاهزاً.
                </p>
              </div>
              <Switch checked={published} onCheckedChange={setPublished} />
            </div>
          </div>
        ) : data?.plan ? (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
            {data.plan.title && <p className="text-base font-black">{data.plan.title}</p>}
            <ReadBlock
              icon={<Target className="size-3.5" />}
              label="أهداف الدرس"
              html={data.plan.objectives}
            />
            <ReadBlock
              icon={<BookOpen className="size-3.5" />}
              label="محتوى الحصة"
              html={data.plan.content}
            />
            <ReadBlock label="الواجب البيتي" html={data.plan.homework} tone="warm" />
            {data.plan.resources && (
              <div className="rounded-xl border border-border p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold">
                  <Link2 className="size-3.5" />
                  روابط ومصادر
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.plan.resources
                    .split(",")
                    .map((r) => r.trim())
                    .filter(Boolean)
                    .map((r) => (
                      <a
                        key={r}
                        href={r}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="num truncate rounded-lg bg-secondary px-2 py-1 text-[11px] text-primary hover:underline"
                        dir="ltr"
                      >
                        {r}
                      </a>
                    ))}
                </div>
              </div>
            )}
            {data.plan.prepared_on && (
              <p className="num text-[11px] text-muted-foreground">
                حُضّرت في {data.plan.prepared_on.slice(0, 16)}
              </p>
            )}
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold">لا يوجد تحضير لهذه الحصة بعد</p>
            <p className="mt-1 text-xs text-muted-foreground">سيظهر هنا فور أن يضيفه المعلم.</p>
          </div>
        )}

        <DialogFooter>
          {canEdit && data?.plan && (
            <button
              onClick={drop}
              disabled={remove.isPending}
              className="mr-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive-soft disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              حذف
            </button>
          )}
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            إغلاق
          </button>
          {canEdit && (
            <button
              onClick={submit}
              disabled={save.isPending}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <Save className="size-4" />
              {save.isPending ? "جارٍ الحفظ…" : "حفظ التحضير"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One titled block of the read-only view, hidden when the teacher left it empty. */
function ReadBlock({
  icon,
  label,
  html,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  html: string | null;
  tone?: "warm";
}) {
  // A rich-text field that was opened and closed still holds "<p></p>", which
  // would otherwise render as an empty box under a heading.
  const empty = !html || !html.replace(/<[^>]*>/g, "").trim();
  if (empty) return null;
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "warm" ? "border-warm/40 bg-warm-soft" : "border-border"
      }`}
    >
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold">
        {icon}
        {label}
      </p>
      <div
        className="prose prose-sm max-w-none text-sm leading-relaxed"
        // Sanitised on the way out with the same allow-list the editor uses,
        // so a plan written before that editor existed cannot smuggle markup
        // into a family's browser.
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    </div>
  );
}

/** The dot on a timetable cell that says "there is preparation in here". */
export function PlanMarker({
  hasPlan,
  hasHomework,
  published,
}: {
  hasPlan?: boolean | undefined;
  hasHomework?: boolean | undefined;
  published?: boolean | undefined;
}) {
  if (!hasPlan) return null;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      <Pill tone={published ? "success" : "muted"}>
        <NotebookPen className="ml-0.5 inline size-2.5" />
        {published ? "محضّرة" : "مسودة"}
      </Pill>
      {hasHomework && <Pill tone="warning">واجب</Pill>}
    </span>
  );
}

/**
 * Writing the lesson record from inside the timetable.
 *
 * Deliberately short: what was covered, what was set, anything to attach. A
 * teacher writing this at the end of a period has about a minute, and a form
 * that asks for more gets filled in for a week and then abandoned.
 */
function InlineClassLog({
  studentGroup,
  course,
  date,
  onDone,
}: {
  studentGroup: string;
  course: string;
  date: string;
  onDone: () => void;
}) {
  const existing = useClassLogs({ student_group: studentGroup, from_date: date, to_date: date });
  const save = useSaveClassLog();
  const [topic, setTopic] = useState("");
  const [done, setDone] = useState("");
  const [homework, setHomework] = useState("");
  const [published, setPublished] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const mine = (existing.data?.logs ?? []).find((l) => l.course === course) ?? null;

  // Fill from the record already on file, once it arrives — otherwise saving
  // would write an empty log over what is there.
  useEffect(() => {
    if (loaded || !existing.data) return;
    if (mine) {
      setTopic(mine.topic ?? "");
      setDone(mine.what_was_done ?? "");
      setHomework(mine.homework ?? "");
      setPublished(mine.is_published);
    }
    setLoaded(true);
  }, [existing.data, mine, loaded]);

  async function submit() {
    if (!studentGroup || !date) {
      toast.error("تعذّر تحديد الشعبة أو التاريخ");
      return;
    }
    try {
      await save.mutateAsync({
        ...(mine ? { log: mine.id } : {}),
        student_group: studentGroup,
        course,
        date,
        topic,
        what_was_done: done,
        homework,
        is_published: published ? 1 : 0,
      });
      toast.success("تم حفظ سجل الحصة");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  return (
    <>
      <div className="max-h-[58vh] space-y-3 overflow-y-auto p-1">
        {mine && (
          <p className="rounded-xl bg-secondary/60 p-2.5 text-[11px] text-muted-foreground">
            يوجد سجل محفوظ لهذه الحصة — التعديل هنا يحدّثه.
          </p>
        )}
        <div className="space-y-1.5">
          <Label>موضوع الحصة</Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="مثال: جمع الكسور المتشابهة"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label>ما تم إنجازه</Label>
          <RichText
            value={done}
            onChange={setDone}
            placeholder="شرحنا… حللنا التمارين ١-٥…"
            minHeight={110}
          />
        </div>
        <div className="space-y-1.5">
          <Label>الواجب المطلوب</Label>
          <RichText
            value={homework}
            onChange={setHomework}
            placeholder="التمارين ٦-١٠ صفحة ٤٢"
            minHeight={70}
          />
        </div>
        <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
          <Switch checked={published} onCheckedChange={setPublished} />
          <span className="min-w-0">
            <span className="block text-xs font-semibold">ظاهر للطلاب وأولياء الأمور</span>
            <span className="block text-[11px] text-muted-foreground">
              الطالب الغائب وولي الأمر يعرفان ما جرى دون الاعتماد على ذاكرة أحد.
            </span>
          </span>
        </label>
      </div>

      <DialogFooter className="gap-2 sm:justify-start">
        <button
          onClick={() => void submit()}
          disabled={save.isPending}
          className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? "جارٍ الحفظ…" : "حفظ سجل الحصة"}
        </button>
        <button
          onClick={onDone}
          className="h-10 rounded-xl border border-border px-4 text-sm font-semibold"
        >
          إلغاء
        </button>
      </DialogFooter>
    </>
  );
}

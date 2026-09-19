import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import {
  downloadTimetableTemplate,
  useImportTimetable,
  type TimetableImportResult,
} from "@/lib/api/hooks";

/**
 * The whole school's week from one spreadsheet shaped like the paper one.
 *
 * Two steps on purpose: the file is checked first and every problem is listed
 * by cell; only a clean file can be committed. Nothing reaches the timetable
 * from a file that still has a single mistake in it.
 */
export function TimetableImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<TimetableImportResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const run = useImportTimetable();

  function reset() {
    setFile(null);
    setResult(null);
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadTimetableTemplate();
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر تنزيل القالب"));
    } finally {
      setDownloading(false);
    }
  }

  function check(f: File) {
    setFile(f);
    setResult(null);
    run.mutate(
      { file: f, commit: false },
      {
        onSuccess: setResult,
        onError: (e) => toast.error(errorMessage(e, "تعذّر قراءة الملف")),
      },
    );
  }

  function commit() {
    if (!file) return;
    run.mutate(
      { file, commit: true },
      {
        onSuccess: (res) => {
          setResult(res);
          if (res.committed) {
            toast.success(`تم استيراد ${res.lessons} حصة لـ${res.teachers.length} معلم`);
            onOpenChange(false);
            reset();
          } else {
            toast.error("لم يُحفظ شيء — راجع الأخطاء");
          }
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر الاستيراد")),
      },
    );
  }

  const clean = result && result.problems.length === 0 && result.lessons > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            استيراد الجدول من إكسل
          </DialogTitle>
        </DialogHeader>

        <ol className="space-y-1.5 text-xs text-muted-foreground">
          <li>1. نزّل القالب — فيه صف لكل معلم وعمود لكل حصة، ومعبّأ مسبقاً بالجدول الحالي.</li>
          <li>2. اكتب رمز الشعبة في كل حصة (مثل 5ب)، أو «5ب:الرياضيات» لمادة غير مادة المعلم.</li>
          <li>3. ارفع الملف: يُفحص كاملاً، ولا يُحفظ شيء إلا إذا خلا من الأخطاء.</li>
        </ol>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={download}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            تنزيل القالب
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft/40 px-3 py-2 text-xs font-medium text-primary hover:bg-primary-soft">
            <Upload className="size-3.5" />
            {file ? "رفع ملف آخر" : "رفع الملف للفحص"}
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) check(f);
                e.target.value = "";
              }}
            />
          </label>
          {file && <span className="truncate text-[11px] text-muted-foreground">{file.name}</span>}
        </div>

        {run.isPending && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            جارِ فحص الملف…
          </p>
        )}

        {result && !run.isPending && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-secondary/50 p-2">
                <p className="text-[11px] text-muted-foreground">معلمون</p>
                <p className="text-lg font-bold tabular-nums">{result.teachers.length}</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2">
                <p className="text-[11px] text-muted-foreground">حصص</p>
                <p className="text-lg font-bold tabular-nums">{result.lessons}</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2">
                <p className="text-[11px] text-muted-foreground">شعب</p>
                <p className="text-lg font-bold tabular-nums">{result.groups}</p>
              </div>
            </div>

            {result.problems.length > 0 ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5">
                <p className="flex items-center gap-2 border-b border-destructive/20 p-2.5 text-xs font-bold text-destructive">
                  <AlertTriangle className="size-4" />
                  {result.problems.length} خطأ — صحّحها في الملف ثم ارفعه مجدداً
                </p>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-2.5 py-1.5 font-medium">الخلية</th>
                        <th className="px-2.5 py-1.5 font-medium">المعلم</th>
                        <th className="px-2.5 py-1.5 font-medium">المشكلة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.problems.map((p, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="whitespace-nowrap px-2.5 py-1.5 font-mono" dir="ltr">
                            {p.cell ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-1.5">{p.teacher ?? "—"}</td>
                          <td className="px-2.5 py-1.5">{p.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : result.lessons === 0 ? (
              <p className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                الملف لا يحتوي على أي حصة معبّأة.
              </p>
            ) : (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                <p className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  الملف سليم — لا تعارضات ولا أخطاء
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  الاعتماد يستبدل جدول المعلمين المذكورين في الملف فقط، ويبقي المعلمين غير المعبّأة
                  صفوفهم كما هم.
                </p>
                <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {result.teachers.map((t) => (
                    <span
                      key={t.name}
                      className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px]"
                    >
                      {t.label} — {t.lessons} حصة
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pb-1 pt-1">
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
              >
                إغلاق
              </button>
              <button
                onClick={commit}
                disabled={!clean || run.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" />
                اعتماد الاستيراد
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

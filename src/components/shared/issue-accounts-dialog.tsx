import { useState } from "react";
import { toast } from "sonner";
import { Download, KeyRound, Search, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pill } from "@/components/shared/ui-kit";
import { errorMessage } from "@/lib/api/error-message";
import { useIssueTeacherAccounts, type IssuedAccount } from "@/lib/api/hooks";

/** Saves the base64 sheet the server returned. */
function saveSheet(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const STATUS: Record<
  IssuedAccount["status"],
  { label: string; tone: "success" | "info" | "muted" }
> = {
  created: { label: "حساب جديد", tone: "success" },
  reset: { label: "كلمة مرور جديدة", tone: "info" },
  skipped: { label: "لم يُغيَّر", tone: "muted" },
};

/**
 * Logins for the teachers ticked on the list, handed over as an Excel sheet.
 *
 * The passwords exist in readable form only in the server's answer, so the
 * sheet is downloaded at once and kept on screen until the dialog closes — a
 * second download is offered in case the first was lost, but nothing is kept
 * after that.
 */
export function IssueAccountsDialog({
  teachers,
  initial,
  onClose,
}: {
  /** Everyone who may be picked, in the list's order. */
  teachers: Array<{ id: string; name: string }>;
  /** Ticked on the table before the dialog opened. */
  initial: string[];
  onClose: (done: boolean) => void;
}) {
  const issue = useIssueTeacherAccounts();
  const [mode, setMode] = useState<"all" | "missing">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set(initial));
  const [q, setQ] = useState("");
  const result = issue.data;
  const names = teachers.filter((t) => picked.has(t.id)).map((t) => t.id);
  const shown = teachers.filter((t) => !q.trim() || t.name.includes(q.trim()));
  const allShown = shown.length > 0 && shown.every((t) => picked.has(t.id));

  function toggle(id: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleShown() {
    setPicked((p) => {
      const next = new Set(p);
      for (const t of shown) {
        if (allShown) next.delete(t.id);
        else next.add(t.id);
      }
      return next;
    });
  }

  async function run() {
    if (!names.length) {
      toast.error("اختر معلماً واحداً على الأقل");
      return;
    }
    try {
      const res = await issue.mutateAsync({ names, mode });
      saveSheet(res.file, res.filename);
      const issued = res.created + res.reset;
      if (issued) toast.success(`تم إصدار ${issued} حساباً وتنزيل الملف`);
      else toast.info("لم يُصدر أي حساب — كل المحددين لديهم حسابات");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر إصدار الحسابات"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose(!!result)}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            إصدار حسابات المعلمين
          </DialogTitle>
          <DialogDescription>
            {names.length} معلماً محدداً — يُنزَّل ملف Excel فيه اسم المعلم واسم المستخدم وكلمة
            المرور الجديدة.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border">
              <div className="flex items-center gap-2 border-b border-border p-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ابحث عن معلم…"
                    className="h-8 w-full rounded-lg bg-secondary/60 pr-8 text-xs outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={toggleShown}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-secondary"
                >
                  {allShown ? "إلغاء تحديد الكل" : "تحديد الكل"}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {shown.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(t.id)}
                      onChange={() => toggle(t.id)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    {t.name}
                  </label>
                ))}
                {shown.length === 0 && (
                  <p className="p-3 text-center text-xs text-muted-foreground">لا نتائج</p>
                )}
              </div>
            </div>
            {[
              {
                value: "all" as const,
                title: "إنشاء الحسابات الناقصة وتجديد كلمات المرور",
                hint: "من ليس له حساب يُنشأ له، ومن له حساب تُصدر له كلمة مرور جديدة وتتوقف القديمة.",
              },
              {
                value: "missing" as const,
                title: "إنشاء الحسابات الناقصة فقط",
                hint: "من له حساب يبقى كما هو ولا تتغير كلمة مروره.",
              },
            ].map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setMode(o.value)}
                className={`block w-full rounded-xl border p-3 text-right transition-colors ${
                  mode === o.value
                    ? "border-primary bg-primary-soft/40"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <p className="text-sm font-bold">{o.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{o.hint}</p>
              </button>
            ))}
            {mode === "all" && (
              <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                سيحتاج المعلمون المحددون إلى كلمة المرور الجديدة للدخول، وسيُطلب منهم تغييرها عند
                أول دخول. حسابات مدير النظام لا تُمَسّ.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Pill tone="success">جديد: {result.created}</Pill>
              <Pill tone="info">تجديد: {result.reset}</Pill>
              {result.skipped > 0 && <Pill tone="muted">لم يُغيَّر: {result.skipped}</Pill>}
            </div>
            <div className="max-h-[45vh] overflow-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary">
                  <tr className="text-right">
                    <th className="p-2">المعلم</th>
                    <th className="p-2">اسم المستخدم</th>
                    <th className="p-2">كلمة المرور</th>
                    <th className="p-2">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.teacher} className="border-t border-border/60">
                      <td className="p-2">
                        {r.name}
                        {r.note && <p className="text-[10px] text-muted-foreground">{r.note}</p>}
                      </td>
                      <td className="num p-2" dir="ltr">
                        {r.username || "—"}
                      </td>
                      <td className="num p-2 font-mono font-bold" dir="ltr">
                        {r.password || "—"}
                      </td>
                      <td className="p-2">
                        <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              كلمات المرور لا تُحفظ في النظام بصيغة مقروءة — احتفظ بالملف أو نزّله مرة أخرى قبل
              الإغلاق.
            </p>
          </div>
        )}

        <DialogFooter>
          <button
            onClick={() => onClose(!!result)}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
          >
            إغلاق
          </button>
          {result ? (
            <button
              onClick={() => saveSheet(result.file, result.filename)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground"
            >
              <Download className="size-4" />
              تنزيل الملف مرة أخرى
            </button>
          ) : (
            <button
              onClick={run}
              disabled={issue.isPending}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <KeyRound className="size-4" />
              {issue.isPending ? "جارٍ الإصدار…" : "إصدار وتنزيل Excel"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

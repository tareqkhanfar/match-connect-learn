import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Eye,
  LogOut,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Undo2,
  UserRoundCheck,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  getTransferPreview,
  printHtml,
  useCancelTransfer,
  useCompleteTransfer,
  useDeleteTransfer,
  useSaveTransfer,
  useStudents,
  useTransfer,
  useTransferOptions,
  useTransferPrefill,
  useTransfers,
  type TransferRow,
} from "@/lib/api/hooks";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app/transfers")({
  head: () => ({
    meta: [
      { title: "الطلاب المنقولون — Match Education" },
      { name: "description", content: "نقل الطلاب إلى مدارس أخرى وشهادات الانتقال." },
    ],
  }),
  component: TransfersPage,
});

const TABS = [
  { key: "", label: "الكل" },
  { key: "Draft", label: "مسودات" },
  { key: "Completed", label: "منفَّذة" },
  { key: "Cancelled", label: "ملغاة" },
];

function TransfersPage() {
  const { role } = useApp();
  const confirm = useConfirm();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading, error, refetch } = useTransfers(status, q);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [previewing, setPreviewing] = useState<TransferRow | null>(null);
  const complete = useCompleteTransfer();
  const cancel = useCancelTransfer();
  const remove = useDeleteTransfer();

  if (role !== "admin" && role !== "secretary")
    return <EmptyBlock title="غير متاح" description="الطلاب المنقولون للإدارة والسكرتاريا فقط." />;

  const rows = data?.transfers ?? [];
  const counts = data?.counts ?? {};

  async function doComplete(t: TransferRow) {
    const ok = await confirm({
      title: `تنفيذ نقل «${t.studentName}»؟`,
      description:
        "تُطبَّق التأثيرات المحددة على الطلب (إنهاء القيد، تعطيل الحسابات…). يمكن التراجع عنه بإلغاء الطلب.",
      confirmLabel: "تنفيذ النقل",
    });
    if (!ok) return;
    try {
      const res = await complete.mutateAsync(t.id);
      const kept = res.applied.guardiansKept ?? [];
      toast.success(
        `تم تنفيذ النقل${
          res.applied.users?.length ? ` — عُطِّل ${res.applied.users.length} حساب` : ""
        }${kept.length ? ` — لم يُعطَّل: ${kept.map((k) => k.name).join("، ")} (${kept[0]!.why})` : ""}`,
      );
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر تنفيذ النقل"));
    }
  }

  async function doCancel(t: TransferRow) {
    const done = t.status === "Completed";
    const ok = await confirm({
      title: done ? `التراجع عن نقل «${t.studentName}»؟` : `إلغاء طلب «${t.studentName}»؟`,
      description: done
        ? "يعود الطالب إلى المدرسة: قيده وشعبه وحسابه واشتراك النقل، كما كانت قبل التنفيذ."
        : "يُلغى الطلب دون أي أثر على الطالب.",
      ...(done ? { tone: "danger" as const } : {}),
      confirmLabel: done ? "تراجع" : "إلغاء الطلب",
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync(t.id);
      toast.success(done ? "تم التراجع وأُعيد الطالب" : "أُلغي الطلب");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الإلغاء"));
    }
  }

  async function doDelete(t: TransferRow) {
    const ok = await confirm({
      title: `حذف طلب «${t.studentName}»؟`,
      description: "يُحذف الطلب نهائيًا.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(t.id);
      toast.success("تم الحذف");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  async function doPrint(t: TransferRow) {
    try {
      const res = await getTransferPreview(t.id);
      printHtml(res.html, res.title);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّرت الطباعة"));
    }
  }

  return (
    <>
      <PageHeader
        title="الطلاب المنقولون"
        subtitle="نقل طالب إلى مدرسة أخرى، مع شهادة الانتقال وما يترتب عليه في النظام"
        actions={
          <button
            onClick={() => setEditing("new")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Plus className="size-4" />
            نقل طالب
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                status === t.key ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              {t.label}
              {t.key && counts[t.key] ? ` (${counts[t.key]})` : ""}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم الطالب أو المدرسة…"
            className="h-10 rounded-xl bg-card pr-9"
          />
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="لا توجد طلبات نقل"
          description="ابدأ بزر «نقل طالب»."
          icon={<LogOut className="size-6" />}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <div key={t.id} className="card-surface p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{t.studentName}</span>
                    <Pill tone={t.statusTone as "success" | "warning" | "muted"}>
                      {t.statusLabel}
                    </Pill>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    إلى: <b className="text-foreground/80">{t.toSchool}</b>
                    {t.transferDate && (
                      <>
                        {" · "}
                        <span className="num">{t.transferDate}</span>
                      </>
                    )}
                    {" · "}
                    <span className="num">{t.id}</span>
                  </p>
                  {t.reason && <p className="mt-1 text-xs text-muted-foreground">{t.reason}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPreviewing(t)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <Eye className="size-3.5" />
                    معاينة
                  </button>
                  <button
                    onClick={() => doPrint(t)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <Printer className="size-3.5" />
                    طباعة
                  </button>
                  {t.status === "Draft" && (
                    <>
                      <button
                        onClick={() => setEditing(t.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                      >
                        <Pencil className="size-3.5" />
                        تعديل
                      </button>
                      <button
                        onClick={() => doComplete(t)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground"
                      >
                        <UserRoundCheck className="size-3.5" />
                        تنفيذ النقل
                      </button>
                      <button
                        onClick={() => doDelete(t)}
                        aria-label="حذف"
                        className="rounded-lg border border-destructive/40 px-2 py-1.5 text-destructive hover:bg-destructive-soft"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                  {t.status !== "Cancelled" && (
                    <button
                      onClick={() => doCancel(t)}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive-soft"
                    >
                      <Undo2 className="size-3.5" />
                      {t.status === "Completed" ? "تراجع" : "إلغاء"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TransferDialog id={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      {previewing && (
        <PreviewDialog
          transfer={previewing}
          onComplete={() => {
            void doComplete(previewing);
            setPreviewing(null);
          }}
          onClose={() => setPreviewing(null)}
        />
      )}
    </>
  );
}

/** The certificate exactly as the printer gets it, in a frame. */
function PreviewDialog({
  transfer,
  onComplete,
  onClose,
}: {
  transfer: TransferRow;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  useEffect(() => {
    getTransferPreview(transfer.id)
      .then((r) => {
        setHtml(r.html);
        setTitle(r.title);
      })
      .catch((err) => toast.error(errorMessage(err, "تعذّرت المعاينة")));
  }, [transfer.id]);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>معاينة شهادة الانتقال — {transfer.studentName}</DialogTitle>
          <DialogDescription>هكذا تُطبع الشهادة.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {html ? (
            <iframe
              title="معاينة"
              className="h-[60rem] w-full"
              srcDoc={`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>body{padding:12px;background:#fff}</style></head><body>${html}</body></html>`}
            />
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">جارِ تجهيز المعاينة…</p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
          >
            إغلاق
          </button>
          <button
            disabled={!html}
            onClick={() => printHtml(html, title)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-5 text-sm font-bold hover:bg-secondary disabled:opacity-50"
          >
            <Printer className="size-4" />
            طباعة
          </button>
          {transfer.status === "Draft" && (
            <button
              onClick={onComplete}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground"
            >
              <UserRoundCheck className="size-4" />
              تنفيذ النقل
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A pupil, found by name — the school is too big for a plain list. */
function StudentSearch({ onPick }: { onPick: (id: string, name: string) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isFetching } = useStudents({
    search: debounced,
    page_size: 8,
    enrolment_status: "active",
  });
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم الطالب أو رقمه…"
          className="rounded-xl pr-9"
        />
      </div>
      {debounced && (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
          {(data?.items ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s.id, s.name)}
              className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-right text-sm last:border-0 hover:bg-secondary"
            >
              <span className="font-semibold">{s.name}</span>
              <span className="num text-[11px] text-muted-foreground">
                {[s.grade, s.section].filter(Boolean).join(" — ")}
              </span>
            </button>
          ))}
          {!isFetching && (data?.items ?? []).length === 0 && (
            <p className="p-3 text-center text-xs text-muted-foreground">لا نتائج</p>
          )}
        </div>
      )}
    </div>
  );
}

/** A request written or amended: who, to where, why, the certificate, the effects. */
function TransferDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const opts = useTransferOptions();
  const existing = useTransfer(id ?? undefined);
  const save = useSaveTransfer();
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const prefill = useTransferPrefill(id ? undefined : student?.id);
  const [toSchool, setToSchool] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [cert, setCert] = useState<Record<string, string>>({});
  const [effects, setEffects] = useState<Record<string, number>>({});

  // Editing: what is on file. New: the pupil's record, once chosen.
  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    setStudent({ id: d.student, name: d.studentName });
    setToSchool(d.toSchool);
    setDate(d.transferDate || date);
    setReason(d.reason);
    setCert(d.certificate);
    setEffects(d.effects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data]);
  useEffect(() => {
    if (prefill.data) setCert(prefill.data.certificate);
  }, [prefill.data]);
  useEffect(() => {
    if (opts.data && Object.keys(effects).length === 0 && !id)
      setEffects(Object.fromEntries(opts.data.effects.map((e) => [e.key, e.default ? 1 : 0])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.data]);

  const info = id ? existing.data : prefill.data;
  const guardians = info?.guardians ?? [];
  const warnings = info?.warnings ?? [];

  async function submit() {
    if (!student) {
      toast.error("اختر الطالب");
      return;
    }
    if (!toSchool.trim()) {
      toast.error("اكتب اسم المدرسة المنقول إليها");
      return;
    }
    try {
      await save.mutateAsync({
        ...(id ? { id } : { student: student.id }),
        toSchool: toSchool.trim(),
        transferDate: date,
        reason,
        certificate: cert,
        effects,
      });
      toast.success("تم حفظ الطلب");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ الطلب"));
    }
  }

  const certFields = (opts.data?.fields ?? []).filter((f) => f.fieldname !== "to_school");
  const setField = (name: string, v: string) => setCert((c) => ({ ...c, [name]: v }));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{id ? "تعديل طلب النقل" : "نقل طالب إلى مدرسة أخرى"}</DialogTitle>
          <DialogDescription>
            تُعبَّأ شهادة الانتقال من سجل الطالب — عدّل ما تحتاجه قبل الطباعة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <Label>الطالب</Label>
            {student ? (
              <div className="flex items-center justify-between rounded-xl border border-primary bg-primary-soft/40 p-3">
                <p className="font-bold">{student.name}</p>
                {!id && (
                  <button
                    onClick={() => {
                      setStudent(null);
                      setCert({});
                    }}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-xs hover:bg-secondary"
                  >
                    تغيير
                  </button>
                )}
              </div>
            ) : (
              <StudentSearch onPick={(sid, name) => setStudent({ id: sid, name })} />
            )}
            {prefill.error && (
              <p className="rounded-lg bg-destructive-soft p-2 text-xs text-destructive">
                {errorMessage(prefill.error, "تعذّر تجهيز الطلب")}
              </p>
            )}
          </section>

          {student && !prefill.error && (
            <>
              {warnings.length > 0 && (
                <div className="space-y-1 rounded-xl border border-warning/40 bg-warning/10 p-3">
                  {warnings.map((w) => (
                    <p key={w.code} className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="size-4 shrink-0 text-warning" />
                      {w.text}
                    </p>
                  ))}
                </div>
              )}

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>المدرسة / المحافظة المنقول إليها *</Label>
                  <Input
                    value={toSchool}
                    onChange={(e) => setToSchool(e.target.value)}
                    placeholder="اسم المدرسة داخل المحافظة، أو اسم المحافظة إن كان النقل خارجها"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ النقل</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>سبب النقل</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold">بيانات شهادة الانتقال</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {certFields.map((f) => (
                    <div
                      key={f.fieldname}
                      className={`space-y-1 ${f.width === "full" || f.fieldtype === "Long Text" ? "sm:col-span-2" : ""}`}
                    >
                      <Label className="text-xs">{f.label}</Label>
                      {f.fieldtype === "Select" ? (
                        <select
                          value={cert[f.fieldname] ?? ""}
                          onChange={(e) => setField(f.fieldname, e.target.value)}
                          className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                        >
                          <option value="">—</option>
                          {f.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : f.fieldtype === "Long Text" ? (
                        <textarea
                          value={cert[f.fieldname] ?? ""}
                          onChange={(e) => setField(f.fieldname, e.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-border bg-card p-3 text-sm"
                        />
                      ) : (
                        <Input
                          type={f.fieldtype === "Date" ? "date" : "text"}
                          value={cert[f.fieldname] ?? ""}
                          onChange={(e) => setField(f.fieldname, e.target.value)}
                          className="rounded-xl"
                        />
                      )}
                      {f.description && (
                        <p className="text-[10px] text-muted-foreground">{f.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold">ماذا يحدث عند تنفيذ النقل؟</h3>
                <div className="space-y-2">
                  {(opts.data?.effects ?? []).map((e) => (
                    <div
                      key={e.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{e.label}</p>
                        <p className="text-[11px] text-muted-foreground">{e.hint}</p>
                        {e.key === "disable_guardian_accounts" && guardians.length > 0 && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {guardians
                              .map(
                                (g) =>
                                  `${g.name}${g.hasOtherChildren ? " (له ابن آخر — لن يُعطَّل)" : g.user ? "" : " (بلا حساب)"}`,
                              )
                              .join("، ")}
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={!!effects[e.key]}
                        onCheckedChange={(v) => setEffects((x) => ({ ...x, [e.key]: v ? 1 : 0 }))}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  لا يحدث شيء من هذا إلا عند ضغط «تنفيذ النقل». وإن أُلغي لاحقًا يُعاد كل شيء كما
                  كان.
                </p>
              </section>
            </>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={save.isPending || !student || !!prefill.error}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ كمسودة"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

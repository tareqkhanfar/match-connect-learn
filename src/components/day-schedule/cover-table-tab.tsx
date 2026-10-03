import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  LayoutGrid,
  Printer,
  Save,
  Settings2,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { HtmlPreviewDialog } from "@/components/shared/html-preview-dialog";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/api/error-message";
import { downloadTable } from "@/lib/api/export";
import {
  generateCover,
  getCoverPrint,
  getSavedCover,
  useCoverOptions,
  useDeleteCoverTable,
  useSaveCoverRule,
  useSaveCoverTable,
  type CoverOptions,
  type CoverRule,
  type CoverTable,
} from "@/lib/api/duty";
import { cn } from "@/lib/utils";

/**
 * جدول الإشغال: the week's free teachers per period, in the order the
 * school's rule puts them. Read from the weekly timetable; nothing here
 * changes it.
 */
export function CoverTableTab() {
  const options = useCoverOptions();
  const [table, setTable] = useState<CoverTable | null>(null);
  const [busy, setBusy] = useState(false);
  // Generated under a rule the administration is still trying out: what is on
  // screen is not what «حفظ نسخة» (which uses the saved rule) would keep.
  const [draft, setDraft] = useState(false);
  const [printing, setPrinting] = useState<string | "live" | null>(null);
  const [showRule, setShowRule] = useState(false);
  const save = useSaveCoverTable();
  const remove = useDeleteCoverTable();
  const confirm = useConfirm();

  async function run(rule?: CoverRule) {
    setBusy(true);
    try {
      setTable(await generateCover(rule));
      setDraft(!!rule);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر توليد الجدول"));
    } finally {
      setBusy(false);
    }
  }

  async function open(saved: string) {
    setBusy(true);
    try {
      setTable(await getSavedCover(saved));
      setDraft(false);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر فتح الجدول"));
    } finally {
      setBusy(false);
    }
  }

  async function keep() {
    try {
      await save.mutateAsync({});
      toast.success("حُفظت نسخة من جدول الإشغال — تبقى كما هي حتى لو تغيّر الجدول الدراسي");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  async function drop(id: string, title: string) {
    const ok = await confirm({
      title: `حذف «${title}»؟`,
      description: "تُحذف النسخة المحفوظة فقط، ولا يتأثر الجدول الدراسي.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
      if (table?.id === id) setTable(null);
      toast.success("تم الحذف");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  async function exportExcel() {
    if (!table) return;
    const rows: string[][] = [];
    for (const d of table.days)
      for (const c of d.periods) {
        const label = table.periods.find((p) => p.period === c.period)?.label ?? String(c.period);
        c.teachers.forEach((t, i) =>
          rows.push([d.label, label, String(i + 1), t.fullName || t.name, String(t.dayLoad)]),
        );
      }
    try {
      await downloadTable(
        table.title || "جدول الإشغال",
        ["اليوم", "الحصة", "الترتيب", "المعلم", "حصصه في اليوم"],
        rows,
      );
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر التصدير"));
    }
  }

  if (options.error) return <ErrorState error={options.error} onRetry={() => options.refetch()} />;
  if (!options.data) return <TableSkeleton rows={4} />;
  const o = options.data;
  const labelOf = (k: string) => o.sortKeys.find((s) => s.key === k)?.label ?? k;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => run()}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-50"
        >
          <Wand2 className="size-4" />
          {busy ? "جارٍ التوليد…" : "توليد جدول الإشغال"}
        </button>
        <button
          onClick={() => setShowRule((v) => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:bg-secondary"
        >
          <Settings2 className="size-4" />
          قاعدة الإشغال
        </button>
        {o.saved.length > 0 && (
          <div className="min-w-[240px]">
            <SearchableSelect
              value={table?.id ?? ""}
              onChange={(v) => v && void open(v)}
              options={o.saved.map((s) => ({ value: s.id, label: `${s.title} · ${s.by}` }))}
              placeholder={`النسخ المحفوظة (${o.saved.length})`}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          الترتيب الحالي: {o.rule.order.slice(0, 2).map(labelOf).join("، ثم ")}
        </p>
      </div>

      {showRule && (
        <RuleCard options={o} onTry={(rule) => void run(rule)} onClose={() => setShowRule(false)} />
      )}

      {busy && !table ? (
        <TableSkeleton rows={6} />
      ) : !table ? (
        <EmptyBlock
          title="اضغط «توليد جدول الإشغال»"
          description="يُبنى من الجدول الدراسي الأسبوعي: لكل حصة من الأحد إلى الخميس المعلمون غير المشغولين فيها، مرتّبين حسب قاعدة الإشغال، مع عدد حصصهم في ذلك اليوم."
          icon={<LayoutGrid className="size-6" />}
        />
      ) : !table.days.length ? (
        <EmptyBlock
          title="لا يوجد جدول دراسي أسبوعي"
          description="جدول الإشغال يُقرأ من الجدول الدراسي — ابنِ الجدول أولاً."
          icon={<LayoutGrid className="size-6" />}
        />
      ) : (
        <SectionCard
          title={table.title || "جدول الإشغال"}
          description={`${table.id ? "نسخة محفوظة" : "مولّد الآن"} · ${table.generatedOn} · ${table.teachers} معلماً`}
          actions={
            <div className="flex flex-wrap gap-1.5">
              {draft && <Pill tone="warning">قاعدة تجريبية — احفظ القاعدة أولاً</Pill>}
              {!table.id && !draft && (
                <button
                  onClick={keep}
                  disabled={save.isPending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold hover:bg-secondary"
                >
                  <Save className="size-3.5" />
                  حفظ نسخة
                </button>
              )}
              <button
                onClick={exportExcel}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold hover:bg-secondary"
              >
                <FileSpreadsheet className="size-3.5" />
                Excel
              </button>
              <button
                onClick={() => setPrinting(table.id ?? "live")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-3 text-xs font-bold text-primary-foreground"
              >
                <Printer className="size-3.5" />
                طباعة
              </button>
              {table.id && (
                <button
                  onClick={() => drop(table.id!, table.title ?? "")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-destructive/40 px-3 text-xs font-bold text-destructive hover:bg-destructive-soft"
                  aria-label="حذف النسخة"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          }
        >
          <p className="mb-3 text-[11px] text-muted-foreground">
            الرقم بجانب الاسم: عدد حصص المعلم في ذلك اليوم. الحصص بأرقامها كما في الجدول الدراسي —
            وقد يختلف وقت الحصة نفسها بين المراحل.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" data-tools="own">
              <thead>
                <tr className="bg-secondary/60">
                  <th className="w-16 border border-border p-2">اليوم</th>
                  {table.periods.map((p) => (
                    <th key={p.period} colSpan={2} className="border border-border p-2 font-bold">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              {table.days.map((d) => (
                <tbody key={d.day} className="border-t-2 border-foreground/40">
                  {Array.from({ length: Math.max(d.rows, 1) }).map((_, i) => (
                    <tr key={i} className={i % 2 ? "bg-secondary/20" : ""}>
                      {i === 0 && (
                        <th
                          rowSpan={Math.max(d.rows, 1)}
                          className="border border-border bg-secondary/40 p-2 text-sm font-black"
                        >
                          {d.label}
                        </th>
                      )}
                      {d.periods.map((c) => {
                        const t = c.teachers[i];
                        return [
                          <td
                            key={`${c.period}-n`}
                            className="border border-border px-2 py-1.5 font-semibold"
                            title={
                              t
                                ? `${t.fullName} — ${t.weekLoad} حصة أسبوعياً، ${t.covers} إشغالاً هذا الفصل`
                                : ""
                            }
                          >
                            {t?.name ?? ""}
                          </td>,
                          <td
                            key={`${c.period}-c`}
                            className="num w-7 border border-border bg-secondary/50 px-1 text-center font-bold"
                          >
                            {t ? t.dayLoad : ""}
                          </td>,
                        ];
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </SectionCard>
      )}

      {printing && (
        <HtmlPreviewDialog
          heading="جدول الإشغال"
          load={() => getCoverPrint(printing === "live" ? undefined : printing)}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  );
}

/** The school's rule: how free teachers are ordered, and who is left out. */
function RuleCard({
  options,
  onTry,
  onClose,
}: {
  options: CoverOptions;
  onTry: (rule: CoverRule) => void;
  onClose: () => void;
}) {
  const saveRule = useSaveCoverRule();
  const [rule, setRule] = useState<CoverRule>(options.rule);
  const canEdit = options.canEditRule;
  const set = <K extends keyof CoverRule>(k: K, v: CoverRule[K]) =>
    setRule((r) => ({ ...r, [k]: v }));
  const nameOf = (id: string) => options.instructors.find((i) => i.id === id)?.name ?? id;

  function move(i: number, by: number) {
    const order = [...rule.order];
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j]!, order[i]!];
    set("order", order);
  }

  async function submit() {
    try {
      await saveRule.mutateAsync(rule);
      toast.success("تم حفظ قاعدة الإشغال — تُطبَّق في كل توليد من الآن");
      onTry(rule);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر حفظ القاعدة"));
    }
  }

  return (
    <SectionCard
      title="قاعدة الإشغال"
      description={canEdit ? "تحدّدها الإدارة وتُحفظ لكل توليد" : "تحدّدها الإدارة — للاطّلاع فقط"}
      actions={
        <button onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1 hover:bg-secondary">
          <X className="size-4" />
        </button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>ترتيب المعلمين المتاحين (الأهم أولاً)</Label>
          <ol className="space-y-1.5">
            {rule.order.map((k, i) => (
              <li
                key={k}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                  i === 0 ? "border-primary/40 bg-primary-soft/50 font-bold" : "border-border",
                )}
              >
                <span className="num w-5 text-muted-foreground">{i + 1}</span>
                <span className="flex-1">{options.sortKeys.find((s) => s.key === k)?.label}</span>
                {canEdit && (
                  <>
                    <button
                      onClick={() => move(i, -1)}
                      aria-label="أعلى"
                      className="rounded p-1 hover:bg-secondary"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      aria-label="أسفل"
                      className="rounded p-1 hover:bg-secondary"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground">
            الأول هو القاعدة، وما بعده يفصل بين المتساوين فيه.
          </p>
        </div>

        <div className="space-y-3">
          {(
            [
              ["skip_day_off", "استبعاد من ليس لديه حصص في ذلك اليوم", "غير موجود في المدرسة"],
              ["present_only", "المتواجدون فقط", "بين أول حصة وآخر حصة له في اليوم"],
            ] as const
          ).map(([k, label, hint]) => (
            <div
              key={k}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
              </div>
              <Switch
                checked={!!rule[k]}
                disabled={!canEdit}
                onCheckedChange={(v) => set(k, v ? 1 : 0)}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">أقصى حصص يومية للمُشغِل (0 = بلا حد)</Label>
              <Input
                type="number"
                min={0}
                value={rule.max_day_load}
                disabled={!canEdit}
                onChange={(e) => set("max_day_load", Number(e.target.value) || 0)}
                className="num rounded-xl"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">عدد الأسماء تحت كل حصة (0 = الجميع)</Label>
              <Input
                type="number"
                min={0}
                value={rule.max_rows}
                disabled={!canEdit}
                onChange={(e) => set("max_rows", Number(e.target.value) || 0)}
                className="num rounded-xl"
                dir="ltr"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">طريقة كتابة الأسماء</Label>
            <select
              value={rule.names}
              disabled={!canEdit}
              onChange={(e) => set("names", e.target.value as CoverRule["names"])}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="short">الاسم الأول (واسم ثانٍ عند التشابه)</option>
              <option value="full">الاسم كاملاً</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">لا يُدرَجون أبداً (المدير، المنسقون…)</Label>
            <div className="flex flex-wrap gap-1.5">
              {rule.exclude.map((id) => (
                <Pill key={id}>
                  {nameOf(id)}
                  {canEdit && (
                    <button
                      onClick={() =>
                        set(
                          "exclude",
                          rule.exclude.filter((x) => x !== id),
                        )
                      }
                      aria-label="إزالة"
                      className="ms-1"
                    >
                      <X className="inline size-3" />
                    </button>
                  )}
                </Pill>
              ))}
            </div>
            {canEdit && (
              <SearchableSelect
                value=""
                onChange={(v) =>
                  v && !rule.exclude.includes(v) && set("exclude", [...rule.exclude, v])
                }
                options={options.instructors
                  .filter((i) => !rule.exclude.includes(i.id))
                  .map((i) => ({ value: i.id, label: i.name }))}
                placeholder="إضافة معلم…"
              />
            )}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => setRule(options.defaultRule)}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
          >
            القاعدة الافتراضية
          </button>
          <button
            onClick={() => onTry(rule)}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
          >
            تجربة دون حفظ
          </button>
          <button
            onClick={submit}
            disabled={saveRule.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {saveRule.isPending ? "جارٍ الحفظ…" : "حفظ القاعدة"}
          </button>
        </div>
      )}
    </SectionCard>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  FileChartColumn,
  FilePen,
  Printer,
  RotateCcw,
  UserCheck,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { FormFieldInput } from "@/components/forms/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  printFormEntry,
  useFormCategories,
  useFormReport,
  useFormTemplates,
  type FormReport,
  type FormReportFilters,
} from "@/lib/api/hooks";
import { errorMessage } from "@/lib/api/error-message";
import { FORM_CATEGORIES } from "./app.forms.$category";

export const Route = createFileRoute("/app/forms-reports")({
  head: () => ({
    meta: [
      { title: "تقارير النماذج — Match Education" },
      {
        name: "description",
        content: "تقرير عن أي نموذج: عدد المعبّأ منه، وتوزيع الإجابات، وتصفّح النسخ المعبّأة.",
      },
    ],
  }),
  component: FormsReportsPage,
});

/** Answers that come from a closed list, so they can be counted and filtered. */
const COUNTABLE = new Set(["Select", "Multi Select", "Checkbox", "Rating"]);

const MONTHS = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const i = Number(m) - 1;
  return i >= 0 && i < 12 ? `${MONTHS[i]} ${y}` : ym;
}

type Filters = Omit<FormReportFilters, "template">;

function FormsReportsPage() {
  const meta = useFormCategories();
  const [category, setCategory] = useState("");
  const templates = useFormTemplates(category, true);
  const [template, setTemplate] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<FormReport["entries"][number] | null>(null);

  // A new form starts from a clean slate: its fields are not the last one's.
  useEffect(() => {
    setFilters({});
    setPage(1);
  }, [template]);
  useEffect(() => setTemplate(""), [category]);

  const query = useMemo(
    () => (template ? { template, ...filters, page, page_size: 25 } : null),
    [template, filters, page],
  );
  const report = useFormReport(query);
  const data = report.data;

  function set(patch: Filters) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  const categories = (meta.data?.categories ?? []).map((c) => ({
    value: c.key,
    label: FORM_CATEGORIES[c.key] ?? c.label,
    hint: `${c.forms} نموذج`,
  }));
  const countable = (data?.fields ?? []).filter((f) => COUNTABLE.has(f.fieldtype));
  const chosenField = countable.find((f) => f.fieldname === filters.field);
  const active = Object.values(filters).some((v) => v !== undefined && v !== "");
  // The table shows the first few closed answers beside who and when.
  const columns = countable.slice(0, 3);

  return (
    <>
      <PageHeader
        title="تقارير النماذج"
        subtitle="اختر نوع النموذج واسمه لعرض تقرير عنه: كم عُبّئ، وكيف توزّعت الإجابات، مع تصفّح كل نسخة."
      />

      <div className="card-surface mt-6 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>نوع النموذج</Label>
            <SearchableSelect
              options={categories}
              value={category}
              onChange={setCategory}
              placeholder={meta.isLoading ? "جارٍ التحميل…" : "اختر النوع"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>اسم النموذج</Label>
            <SearchableSelect
              options={(templates.data?.templates ?? []).map((t) => ({
                value: t.name,
                label: t.title,
                hint: `${t.entries} معبّأ${t.isActive ? "" : " · غير مفعّل"}`,
              }))}
              value={template}
              onChange={setTemplate}
              placeholder={
                !category
                  ? "اختر النوع أولاً"
                  : templates.isLoading
                    ? "جارٍ التحميل…"
                    : "اختر النموذج"
              }
              disabled={!category}
            />
          </div>
        </div>

        {template && data && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">من تاريخ</Label>
                <Input
                  type="date"
                  value={filters.date_from ?? ""}
                  onChange={(e) => set({ date_from: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">إلى تاريخ</Label>
                <Input
                  type="date"
                  value={filters.date_to ?? ""}
                  onChange={(e) => set({ date_to: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الحالة</Label>
                <SearchableSelect
                  options={data.filterOptions.statuses.map((s) => ({ value: s, label: s }))}
                  value={filters.status ?? ""}
                  onChange={(v) => set({ status: v })}
                  placeholder="كل الحالات"
                  clearable
                  clearLabel="كل الحالات"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">بحث باسم الطالب</Label>
                <Input
                  value={filters.search ?? ""}
                  onChange={(e) => set({ search: e.target.value })}
                  placeholder="اسم الطالب…"
                  className="h-9"
                />
              </div>
              {data.filterOptions.programs.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">الصف</Label>
                  <SearchableSelect
                    options={data.filterOptions.programs.map((p) => ({ value: p, label: p }))}
                    value={filters.program ?? ""}
                    onChange={(v) => set({ program: v })}
                    placeholder="كل الصفوف"
                    clearable
                    clearLabel="كل الصفوف"
                  />
                </div>
              )}
              {data.filterOptions.groups.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">الشعبة</Label>
                  <SearchableSelect
                    options={data.filterOptions.groups}
                    value={filters.student_group ?? ""}
                    onChange={(v) => set({ student_group: v })}
                    placeholder="كل الشعب"
                    clearable
                    clearLabel="كل الشعب"
                  />
                </div>
              )}
              {data.filterOptions.terms.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-xs">الفصل الدراسي</Label>
                  <SearchableSelect
                    options={data.filterOptions.terms.map((t) => ({ value: t, label: t }))}
                    value={filters.academic_term ?? ""}
                    onChange={(v) => set({ academic_term: v })}
                    placeholder="كل الفصول"
                    clearable
                    clearLabel="كل الفصول"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">عبّأه</Label>
                <SearchableSelect
                  options={data.filterOptions.fillers}
                  value={filters.filled_by ?? ""}
                  onChange={(v) => set({ filled_by: v })}
                  placeholder="الجميع"
                  clearable
                  clearLabel="الجميع"
                />
              </div>
              {countable.length > 0 && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">حسب إجابة سؤال</Label>
                    <SearchableSelect
                      options={countable.map((f) => ({ value: f.fieldname, label: f.label }))}
                      value={filters.field ?? ""}
                      onChange={(v) => set({ field: v, value: "" })}
                      placeholder="اختر السؤال"
                      clearable
                      clearLabel="بلا"
                    />
                  </div>
                  {chosenField && (
                    <div className="space-y-1">
                      <Label className="text-xs">الإجابة</Label>
                      <SearchableSelect
                        options={answerOptions(data, chosenField.fieldname).map((v) => ({
                          value: v,
                          label: v,
                        }))}
                        value={filters.value ?? ""}
                        onChange={(v) => set({ value: v })}
                        placeholder="اختر الإجابة"
                        clearable
                        clearLabel="أي إجابة"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
            {active && (
              <button
                onClick={() => {
                  setFilters({});
                  setPage(1);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <RotateCcw className="size-3.5" />
                مسح الفلاتر
              </button>
            )}
          </div>
        )}
      </div>

      {!template ? (
        <div className="mt-6">
          <EmptyBlock
            title="اختر نوع النموذج واسمه"
            description="يظهر هنا تقرير النموذج المختار وكل النسخ المعبّأة منه."
            icon={<FileChartColumn className="size-6" />}
          />
        </div>
      ) : report.error ? (
        <div className="mt-6">
          <ErrorState error={report.error} onRetry={() => report.refetch()} />
        </div>
      ) : !data ? (
        <div className="mt-6">
          <TableSkeleton rows={6} />
        </div>
      ) : (
        <ReportBody
          data={data}
          columns={columns.map((c) => ({ fieldname: c.fieldname, label: c.label }))}
          page={page}
          onPage={setPage}
          onView={setViewing}
          onPickAnswer={(field, value) => set({ field, value })}
          fetching={report.isFetching}
        />
      )}

      {viewing && data && (
        <EntryDialog entry={viewing} report={data} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

/** Every answer a closed question can take: its options, then anything else given. */
function answerOptions(data: FormReport, fieldname: string): string[] {
  const summary = data.fields.find((f) => f.fieldname === fieldname);
  const field = data.template.fields.find((f) => f.fieldname === fieldname);
  const fromDesign =
    field?.fieldtype === "Checkbox"
      ? ["نعم", "لا"]
      : field?.fieldtype === "Rating"
        ? ["1", "2", "3", "4", "5"]
        : (field?.options ?? "")
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean);
  const given = (summary?.distribution ?? []).map((d) => d.value);
  return Array.from(new Set([...fromDesign, ...given]));
}

function ReportBody({
  data,
  columns,
  page,
  onPage,
  onView,
  onPickAnswer,
  fetching,
}: {
  data: FormReport;
  columns: Array<{ fieldname: string; label: string }>;
  page: number;
  onPage: (p: number) => void;
  onView: (e: FormReport["entries"][number]) => void;
  onPickAnswer: (field: string, value: string) => void;
  fetching: boolean;
}) {
  const k = data.kpis;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const byStudent = data.template.entryFor === "Student";

  return (
    <div className={`mt-6 space-y-6 ${fetching ? "opacity-70 transition-opacity" : ""}`}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="النسخ المعبّأة" value={k.entries} icon={ClipboardList} tone="primary" />
        <KpiCard label="مكتملة" value={k.completed} icon={CheckCircle2} tone="accent" />
        <KpiCard label="مسودات" value={k.drafts} icon={FilePen} tone="warm" />
        {byStudent ? (
          <KpiCard label="طلاب" value={k.students} icon={Users} tone="info" />
        ) : (
          <KpiCard label="عبّأها" value={k.fillers} icon={UserCheck} tone="info" />
        )}
      </div>

      {k.entries === 0 ? (
        <EmptyBlock
          title="لا توجد نسخ معبّأة مطابقة"
          description="غيّر الفلاتر، أو عبّئ النموذج من صفحته."
          icon={<ClipboardList className="size-6" />}
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <SectionCard
              title="التعبئة حسب الشهر"
              {...(k.first
                ? { description: `من ${k.first.slice(0, 10)} إلى ${k.last.slice(0, 10)}` }
                : {})}
              className="lg:col-span-2"
            >
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byMonth.map((m) => ({ ...m, label: monthLabel(m.month) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      formatter={(v: number) => [v, "نسخة"]}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                        direction: "rtl",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--chart-1)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title={data.byGroup.length ? "حسب الشعبة" : "حسب من عبّأه"}>
              <Ranking
                rows={
                  data.byGroup.length
                    ? data.byGroup.map((g) => ({ label: g.label, count: g.count }))
                    : data.byFiller.map((f) => ({ label: f.name, count: f.count }))
                }
                total={k.entries}
              />
              {data.byGroup.length > 0 && data.byFiller.length > 1 && (
                <>
                  <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">
                    حسب من عبّأه
                  </p>
                  <Ranking
                    rows={data.byFiller.map((f) => ({ label: f.name, count: f.count }))}
                    total={k.entries}
                  />
                </>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="الإجابات"
            description="اضغط على أي إجابة لعرض النسخ التي اختارتها فقط."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.fields.map((f) => (
                <div key={f.fieldname} className="rounded-xl border border-border p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{f.label}</p>
                    <Pill tone="muted">
                      <span className="num">
                        {f.answered}/{f.total}
                      </span>
                    </Pill>
                  </div>
                  {f.distribution ? (
                    <div className="space-y-1.5">
                      {f.distribution.length === 0 && (
                        <p className="text-xs text-muted-foreground">لم يُجب أحد بعد.</p>
                      )}
                      {f.distribution.map((d) => {
                        const pct = f.total ? Math.round((d.count / f.total) * 100) : 0;
                        return (
                          <button
                            key={d.value}
                            onClick={() => onPickAnswer(f.fieldname, d.value)}
                            className="block w-full text-right"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="truncate">{d.value}</span>
                              <span className="num text-muted-foreground">
                                {d.count} · {pct}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                      {f.average != null && (
                        <p className="pt-1 text-xs text-muted-foreground">
                          المتوسط <span className="num font-semibold">{f.average}</span>
                        </p>
                      )}
                    </div>
                  ) : f.stats ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(
                        [
                          ["المتوسط", f.stats.average],
                          ["المجموع", f.stats.sum],
                          ["الأدنى", f.stats.min],
                          ["الأعلى", f.stats.max],
                        ] as const
                      ).map(([label, v]) => (
                        <div key={label} className="rounded-lg bg-secondary/50 p-2">
                          <p className="text-muted-foreground">{label}</p>
                          <p className="num text-sm font-bold">{v}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{
                            width: `${f.total ? Math.round((f.answered / f.total) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        أُجيب في {f.answered} من {f.total} نسخة
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={`النسخ المعبّأة (${data.total})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">
                      {byStudent ? "الطالب" : data.template.entryFor === "Section" ? "الشعبة" : "#"}
                    </th>
                    {byStudent && <th className="px-2 py-2 font-medium">الشعبة</th>}
                    {columns.map((c) => (
                      <th key={c.fieldname} className="px-2 py-2 font-medium">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-2 py-2 font-medium">الحالة</th>
                    <th className="px-2 py-2 font-medium">عبّأه</th>
                    <th className="px-2 py-2 font-medium">التاريخ</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr
                      key={e.name}
                      onClick={() => onView(e)}
                      className="cursor-pointer border-b border-border/60 hover:bg-secondary/40"
                    >
                      <td className="px-2 py-2.5 font-medium">
                        {byStudent ? e.studentName : e.groupLabel || e.name}
                      </td>
                      {byStudent && (
                        <td className="px-2 py-2.5 text-muted-foreground">{e.groupLabel || "—"}</td>
                      )}
                      {columns.map((c) => (
                        <td key={c.fieldname} className="px-2 py-2.5">
                          {shown(data, c.fieldname, e.values[c.fieldname])}
                        </td>
                      ))}
                      <td className="px-2 py-2.5">
                        <Pill tone={e.status === "مكتمل" ? "success" : "warning"}>{e.status}</Pill>
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{e.filledByName}</td>
                      <td className="num px-2 py-2.5 text-muted-foreground">
                        {e.filledOn.slice(0, 10)}
                      </td>
                      <td className="px-2 py-2.5">
                        <Eye className="size-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  disabled={page <= 1}
                  onClick={() => onPage(page - 1)}
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
                >
                  السابق
                </button>
                <span className="num text-muted-foreground">
                  {page} / {pages}
                </span>
                <button
                  disabled={page >= pages}
                  onClick={() => onPage(page + 1)}
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

/** A value as it reads: a tick box as «نعم/لا», an empty answer as a dash. */
function shown(data: FormReport, fieldname: string, value: string | undefined) {
  const field = data.template.fields.find((f) => f.fieldname === fieldname);
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (field?.fieldtype === "Checkbox") return value === "1" ? "نعم" : "لا";
  return <span className="line-clamp-1">{value}</span>;
}

function Ranking({
  rows,
  total,
}: {
  rows: Array<{ label: string; count: number }>;
  total: number;
}) {
  return (
    <div className="space-y-2">
      {rows.slice(0, 8).map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-xs">
            <span className="truncate">{r.label}</span>
            <span className="num text-muted-foreground">{r.count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${total ? Math.round((r.count / total) * 100) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** One filled copy, as it was filled, with printing. */
function EntryDialog({
  entry,
  report,
  onClose,
}: {
  entry: FormReport["entries"][number];
  report: FormReport;
  onClose: () => void;
}) {
  async function print() {
    try {
      await printFormEntry(entry.name);
    } catch (e) {
      toast.error(errorMessage(e, "تعذّرت الطباعة"));
    }
  }
  const subject = entry.studentName || entry.groupLabel || report.template.title;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {report.template.title} — {subject}
          </DialogTitle>
          <DialogDescription>
            {entry.status} · عبّأه {entry.filledByName} · {entry.filledOn.slice(0, 16)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-3">
          {report.template.fields.map((f) => (
            <div
              key={f.fieldname}
              className={
                f.width === "full" || f.fieldtype === "Student Table" || f.fieldtype === "Table"
                  ? "w-full"
                  : "w-full sm:w-[calc(50%-0.375rem)]"
              }
            >
              <Label className="mb-1 block text-xs text-muted-foreground">{f.label}</Label>
              <FormFieldInput
                field={f}
                value={entry.values[f.fieldname] ?? ""}
                onChange={() => {}}
                readOnly
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => void print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <Printer className="size-4" />
            طباعة النسخة
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

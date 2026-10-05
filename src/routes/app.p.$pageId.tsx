import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageEntryEditor } from "@/components/workspaces/page-entry-editor";
import { errorMessage } from "@/lib/api/error-message";
import {
  printBlankForm,
  printFormEntry,
  useDeleteFormEntry,
  useMyGroups,
  type FormField,
} from "@/lib/api/hooks";
import {
  invalidatePageEntries,
  useCustomPage,
  usePageEntries,
  type CustomPageDef,
  type PageEntryRow,
} from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { wsColor, wsIcon } from "@/lib/workspace-icons";

export const Route = createFileRoute("/app/p/$pageId")({
  head: () => ({
    meta: [
      { title: "صفحة — Match Education" },
      { name: "description", content: "صفحة نموذج: التعبئة والمتابعة والطباعة." },
    ],
  }),
  component: CustomPageRoute,
});

const BUILTIN: Record<string, string> = {
  subject: "الطالب / الشعبة",
  section: "الشعبة",
  status: "الحالة",
  filledBy: "عبّأه",
  filledOn: "تاريخ التعبئة",
};

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** The choices a filter on this field offers. */
function filterChoices(field: FormField): string[] {
  if (field.fieldtype === "Checkbox") return ["1", "0"];
  if (field.fieldtype === "Rating") return ["1", "2", "3", "4", "5"];
  return (field.options || "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
}

function choiceLabel(field: FormField, value: string) {
  if (field.fieldtype === "Checkbox") return value === "1" ? "نعم" : "لا";
  if (field.fieldtype === "Rating") return `${value} / 5`;
  return value;
}

/**
 * A page built from a form: what was filled, filtered on the server; a button
 * to fill a new copy; each copy opened, printed or (by the office) deleted.
 */
function CustomPageRoute() {
  const { pageId } = Route.useParams();
  const page = useCustomPage(pageId);

  if (page.isLoading) return <DashboardSkeleton />;
  if (page.error) return <ErrorState error={page.error} onRetry={() => page.refetch()} />;
  if (!page.data) return null;
  return <PageBody key={pageId} def={page.data} />;
}

function PageBody({ def }: { def: CustomPageDef }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const remove = useDeleteFormEntry();
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mine, setMine] = useState(false);
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ entry?: string } | null>(null);

  const groups = useMyGroups(def.entryFor !== "General");
  const entries = usePageEntries(def.id, {
    ...(status ? { status } : {}),
    ...(section ? { section } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    ...(search ? { search } : {}),
    ...(mine ? { mine: 1 } : {}),
    filters: answers,
  });

  const byName = useMemo(
    () => Object.fromEntries(def.form.fields.map((f) => [f.fieldname, f])),
    [def.form.fields],
  );
  const columns = def.config.columns.filter((c) => c in BUILTIN || byName[c]);
  const filterFields = def.config.filters.map((f) => byName[f]).filter((f): f is FormField => !!f);
  const label = (c: string) => BUILTIN[c] ?? (def.config.fields[c]?.label || byName[c]?.label || c);

  const Icon = wsIcon(def.icon, FileText);
  const counts = entries.data?.counts ?? {};
  const total = entries.data?.total ?? 0;
  const anyFilter =
    !!(status || section || dateFrom || dateTo || search || mine) ||
    Object.values(answers).some(Boolean);

  async function del(row: PageEntryRow) {
    const ok = await confirm({
      title: "حذف النسخة",
      description: `ستُحذف هذه النسخة${row.studentName ? ` (${row.studentName})` : ""} نهائياً.`,
      confirmLabel: "حذف",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(row.name, {
      onSuccess: () => {
        toast.success("حُذفت النسخة");
        void invalidatePageEntries(qc, def.id);
      },
      onError: (e) => toast.error(errorMessage(e, "تعذّر الحذف")),
    });
  }

  function cell(row: PageEntryRow, c: string) {
    switch (c) {
      case "subject":
        return row.studentName || row.sectionLabel || "—";
      case "section":
        return row.sectionLabel || "—";
      case "status":
        return <Pill tone={row.status === "مكتمل" ? "success" : "warning"}>{row.status}</Pill>;
      case "filledBy":
        return row.filledByName || "—";
      case "filledOn":
        return <span className="num">{row.filledOn || "—"}</span>;
      default:
        return row.values[c] || "—";
    }
  }

  return (
    <>
      <PageHeader
        title={def.title}
        subtitle={def.description || `صفحة نموذج «${def.templateTitle}»`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {def.canBuild && (
              <Link
                to="/app/custom-pages/$pageId"
                params={{ pageId: def.id }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
              >
                <Pencil className="size-3.5" />
                تعديل الصفحة
              </Link>
            )}
            <button
              onClick={() =>
                void printBlankForm(def.template).catch((e) =>
                  toast.error(errorMessage(e, "تعذّرت الطباعة")),
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
              title="النموذج بلا إجابات، للتعبئة باليد"
            >
              <Printer className="size-3.5" />
              نموذج فارغ
            </button>
            {def.mayFill && (
              <button
                onClick={() => setEditing({})}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                <Plus className="size-4" />
                {def.config.newLabel || "تعبئة جديدة"}
              </button>
            )}
          </div>
        }
      />

      {/* Filters -------------------------------------------------------------- */}
      <div className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "me-1 grid size-8 place-items-center rounded-lg",
              wsColor(def.color).tile,
            )}
          >
            <Icon className="size-4" />
          </span>
          {[
            { key: "", label: "الكل", n: (counts["مسودة"] ?? 0) + (counts["مكتمل"] ?? 0) },
            { key: "مسودة", label: "مسودة", n: counts["مسودة"] ?? 0 },
            { key: "مكتمل", label: "مكتمل", n: counts["مكتمل"] ?? 0 },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                status === s.key
                  ? "border-primary bg-primary-soft/50 text-primary"
                  : "border-border hover:bg-secondary",
              )}
            >
              {s.label} <span className="num text-muted-foreground">({s.n})</span>
            </button>
          ))}
          <label className="ms-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            ما عبّأته أنا
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
            <Input
              className="h-9 ps-7"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={def.entryFor === "Student" ? "اسم الطالب أو رقم النسخة…" : "رقم النسخة…"}
            />
          </div>
          {def.entryFor !== "General" && (
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">كل الشعب</option>
              {(groups.data ?? []).map((g) => (
                <option key={g.name} value={g.name}>
                  {g.student_group_name || g.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[11px] text-muted-foreground">من</span>
            <Input
              type="date"
              className="h-9"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[11px] text-muted-foreground">إلى</span>
            <Input
              type="date"
              className="h-9"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          {filterFields.map((f) => (
            <select
              key={f.fieldname}
              value={answers[f.fieldname] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [f.fieldname]: e.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">{def.config.fields[f.fieldname]?.label || f.label}: الكل</option>
              {filterChoices(f).map((o) => (
                <option key={o} value={o}>
                  {choiceLabel(f, o)}
                </option>
              ))}
            </select>
          ))}
        </div>
        {anyFilter && (
          <button
            onClick={() => {
              setStatus("");
              setSection("");
              setDateFrom("");
              setDateTo("");
              setSearchText("");
              setMine(false);
              setAnswers({});
            }}
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            مسح الفلاتر
          </button>
        )}
      </div>

      {/* Copies ---------------------------------------------------------------- */}
      <div className="mt-4">
        {entries.error ? (
          <ErrorState error={entries.error} onRetry={() => entries.refetch()} />
        ) : entries.isLoading ? (
          <DashboardSkeleton />
        ) : (entries.data?.rows.length ?? 0) === 0 ? (
          <EmptyBlock
            title={anyFilter ? "لا نتائج بهذه الفلاتر" : "لم يُعبّأ شيء بعد"}
            description={
              anyFilter
                ? "غيّر الفلاتر أو امسحها."
                : def.mayFill
                  ? `اضغط «${def.config.newLabel || "تعبئة جديدة"}» لتعبئة أول نسخة.`
                  : "لا نسخ معبّأة متاحة لك."
            }
            icon={<FileText className="size-6" />}
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-[11px] text-muted-foreground">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2.5 text-right font-bold">
                      {label(c)}
                    </th>
                  ))}
                  <th className="w-px px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {entries.data?.rows.map((row) => (
                  <tr
                    key={row.name}
                    onClick={() => setEditing({ entry: row.name })}
                    className="cursor-pointer border-t border-border/70 transition-colors hover:bg-secondary/40"
                  >
                    {columns.map((c) => (
                      <td key={c} className="max-w-[16rem] truncate px-3 py-2.5">
                        {cell(row, c)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() =>
                            void printFormEntry(row.name).catch((e) =>
                              toast.error(errorMessage(e, "تعذّرت الطباعة")),
                            )
                          }
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="طباعة"
                        >
                          <Printer className="size-3.5" />
                        </button>
                        {def.mayDelete && (
                          <button
                            onClick={() => void del(row)}
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="حذف"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              {entries.data?.rows.length} من {total}
              {status ? ` · ${status}` : ""}
            </p>
          </div>
        )}
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle className="text-right">
              {editing?.entry ? def.title : def.config.newLabel || `تعبئة: ${def.title}`}
            </SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="px-4 pb-4">
              <PageEntryEditor key={editing.entry ?? "new"} def={def} entryName={editing.entry} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

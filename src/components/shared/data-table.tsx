import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Columns3,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { TableFilters, type FilterDef, type FilterValues } from "@/components/shared/table-filters";
import { downloadExport, type ExportDataset } from "@/lib/api/export";
import { cn } from "@/lib/utils";

export interface Column<T> {
  /** Key into the row object; also the field sent to the export endpoint. */
  fieldname: string;
  label: string;
  /** Custom cell renderer. Falls back to the raw value. */
  render?: ((row: T) => ReactNode) | undefined;
  /** Right-align and use tabular numerals. */
  numeric?: boolean | undefined;
  sortable?: boolean | undefined;
  /** Hidden until the user turns it on in the column menu. */
  hiddenByDefault?: boolean | undefined;
  /** Never offered in the column menu (e.g. an actions column). */
  alwaysVisible?: boolean | undefined;
  width?: string | undefined;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable row key. */
  rowKey: (row: T) => string;
  isLoading?: boolean | undefined;
  isFetching?: boolean | undefined;
  error?: unknown;
  onRetry?: (() => void) | undefined;

  /** Persist column visibility per table. */
  storageKey?: string | undefined;

  // Search
  search?: string | undefined;
  onSearchChange?: ((value: string) => void) | undefined;
  searchPlaceholder?: string | undefined;

  // Sorting (server-side)
  sortField?: string | undefined;
  sortOrder?: "asc" | "desc" | undefined;
  onSortChange?: ((field: string, order: "asc" | "desc") => void) | undefined;

  // Paging (server-side)
  page?: number | undefined;
  pageSize?: number | undefined;
  total?: number | undefined;
  onPageChange?: ((page: number) => void) | undefined;
  onPageSizeChange?: ((size: number) => void) | undefined;

  /** Enables the export menu. */
  exportDataset?: ExportDataset | undefined;
  exportFilters?: Record<string, unknown> | undefined;
  exportTitle?: string | undefined;

  /**
   * Enables row selection. When set, a checkbox column appears and the
   * toolbar swaps for a bulk-action bar while anything is selected.
   */
  bulkDoctype?: string | undefined;
  /** Rendered in the bulk bar; receives the selection and a way to clear it. */
  bulkActions?: ((selected: string[], clear: () => void) => ReactNode) | undefined;

  /**
   * Filters this table offers. Declared by the screen because only it knows
   * which fields the server actually filters on.
   */
  filters?: FilterDef[] | undefined;
  filterValues?: FilterValues | undefined;
  onFiltersChange?: ((values: FilterValues) => void) | undefined;

  /** Extra controls rendered in the toolbar. */
  toolbar?: ReactNode | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
}

const PAGE_SIZES = [10, 20, 50, 100];

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  isFetching,
  error,
  onRetry,
  storageKey,
  search,
  onSearchChange,
  searchPlaceholder = "ابحث...",
  sortField,
  sortOrder,
  onSortChange,
  page = 1,
  pageSize = 20,
  total,
  onPageChange,
  onPageSizeChange,
  exportDataset,
  exportFilters,
  exportTitle,
  bulkDoctype,
  bulkActions,
  filters,
  filterValues,
  onFiltersChange,
  toolbar,
  emptyTitle = "لا توجد بيانات",
  emptyDescription,
}: Props<T>) {
  // --- row selection (only when the caller enables bulk actions) ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectable = Boolean(bulkDoctype && bulkActions);
  const pageKeys = useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const allOnPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));

  // A selection must not survive a page or filter change — the ids would no
  // longer correspond to anything the user can see.
  useEffect(() => {
    setSelected(new Set());
  }, [page, search, sortField, sortOrder, pageSize]);

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  const clearSelection = () => setSelected(new Set());

  // --- column visibility, remembered per table ---
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const initial = new Set(
      columns.filter((c) => c.hiddenByDefault && !c.alwaysVisible).map((c) => c.fieldname),
    );
    if (!storageKey || typeof window === "undefined") return initial;
    try {
      const saved = window.localStorage.getItem(`ms-cols-${storageKey}`);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {
      /* fall back to defaults */
    }
    return initial;
  });

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(`ms-cols-${storageKey}`, JSON.stringify([...hidden]));
  }, [hidden, storageKey]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.alwaysVisible || !hidden.has(c.fieldname)),
    [columns, hidden],
  );

  function toggleColumn(fieldname: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(fieldname)) next.delete(fieldname);
      else next.add(fieldname);
      return next;
    });
  }

  function handleSort(column: Column<T>) {
    if (!column.sortable || !onSortChange) return;
    const nextOrder = sortField === column.fieldname && sortOrder === "asc" ? "desc" : "asc";
    onSortChange(column.fieldname, nextOrder);
  }

  const [exporting, setExporting] = useState(false);

  async function runExport(format: "excel" | "pdf") {
    if (!exportDataset) return;
    setExporting(true);
    try {
      // Export exactly the columns currently on screen, in order.
      await downloadExport(format, {
        dataset: exportDataset,
        columns: visibleColumns
          .filter((c) => !c.alwaysVisible || c.fieldname !== "actions")
          .map((c) => ({ fieldname: c.fieldname, label: c.label })),
        filters: exportFilters ?? {},
        title: exportTitle,
      });
      toast.success(format === "excel" ? "تم تنزيل ملف Excel" : "تم تنزيل ملف PDF");
    } catch (err) {
      const message =
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر التصدير";
      toast.error(message);
    } finally {
      setExporting(false);
    }
  }

  const totalCount = total ?? rows.length;
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-4">
      {/* Filters sit above the toolbar: they change what the table contains,
          while the toolbar acts on what is already shown. */}
      {filters && filters.length > 0 && onFiltersChange && (
        <TableFilters filters={filters} values={filterValues ?? {}} onChange={onFiltersChange} />
      )}

      {/* While rows are selected the bulk bar replaces the toolbar, so the
          available actions are unambiguous. */}
      {selectable && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-3 py-2">
          <span className="num text-sm font-semibold text-primary">{selected.size} محدد</span>
          <button
            onClick={clearSelection}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            إلغاء التحديد
          </button>
          <span className="mx-1 h-4 w-px bg-primary/30" />
          {bulkActions!([...selected], clearSelection)}
        </div>
      )}

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 rounded-xl pr-9"
            />
          </div>
        )}

        {toolbar}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary">
              <Columns3 className="size-4" />
              <span className="hidden sm:inline">الأعمدة</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>إظهار الأعمدة</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns
              .filter((c) => !c.alwaysVisible)
              .map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.fieldname}
                  checked={!hidden.has(c.fieldname)}
                  onCheckedChange={() => toggleColumn(c.fieldname)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setHidden(new Set())}>إظهار الكل</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {exportDataset && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={exporting}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">{exporting ? "جارٍ التصدير…" : "تصدير"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => runExport("excel")}>
                <FileSpreadsheet className="ml-2 size-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runExport("pdf")}>
                <FileText className="ml-2 size-4" />
                PDF للطباعة
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* table */}
      <div className="card-surface overflow-hidden">
        {error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={onRetry} />
          </div>
        ) : isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={Math.min(pageSize, 8)} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyBlock title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  {selectable && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="تحديد كل الصفوف الظاهرة"
                        checked={allOnPageSelected}
                        onChange={togglePage}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </th>
                  )}
                  {visibleColumns.map((c) => {
                    const active = sortField === c.fieldname;
                    return (
                      <th
                        key={c.fieldname}
                        style={c.width ? { width: c.width } : undefined}
                        className={cn(
                          "px-4 py-3 font-semibold",
                          c.numeric && "text-left",
                          c.sortable &&
                            onSortChange &&
                            "cursor-pointer select-none hover:text-foreground",
                        )}
                        onClick={() => handleSort(c)}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {c.label}
                          {c.sortable &&
                            onSortChange &&
                            (active ? (
                              sortOrder === "asc" ? (
                                <ArrowUp className="size-3.5" />
                              ) : (
                                <ArrowDown className="size-3.5" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 opacity-40" />
                            ))}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const key = rowKey(row);
                  return (
                    <tr
                      key={key}
                      className={cn(
                        "transition-colors hover:bg-secondary/40",
                        selected.has(key) && "bg-primary-soft/40",
                      )}
                    >
                      {selectable && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label="تحديد الصف"
                            checked={selected.has(key)}
                            onChange={() => toggleRow(key)}
                            className="size-4 cursor-pointer accent-primary"
                          />
                        </td>
                      )}
                      {visibleColumns.map((c) => (
                        <td
                          key={c.fieldname}
                          className={cn("px-4 py-3", c.numeric && "num text-left")}
                        >
                          {c.render
                            ? c.render(row)
                            : (((row as Record<string, unknown>)[c.fieldname] as ReactNode) ?? "—")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* pagination */}
        {rows.length > 0 && onPageChange && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="num text-xs text-muted-foreground">
              {totalCount} سجل • صفحة {page} من {pages}
              {isFetching && " • جارٍ التحديث…"}
            </p>
            <div className="flex items-center gap-2">
              {onPageSizeChange && (
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} / صفحة
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                السابق
              </button>
              <button
                onClick={() => onPageChange(Math.min(pages, page + 1))}
                disabled={page >= pages}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

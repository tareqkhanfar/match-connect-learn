import { Check, FileSpreadsheet, Filter, Printer, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { downloadTable } from "@/lib/api/export";
import { fillTableFrame, getTableFrame } from "@/lib/api/print-designs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Filters, Excel and printing for every table in the portal.
 *
 * Most tables are built by their screen — mark grids, timetables, reports —
 * not by one shared component, so the tools cannot be added table by table
 * and stay true for the next table someone writes. They work on the table as
 * it is drawn instead: `TableToolsHost` finds each `<table>` on the page and
 * puts a toolbar above it. Excel and print carry exactly the rows left after
 * filtering, with what is typed into fields rather than the fields.
 *
 * A table opts out with `data-no-tools`, or says it already has its own with
 * `data-tools="own"` (the paged `DataTable`, whose export runs on the server).
 */

// -- reading a table --------------------------------------------------------

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/** What a cell shows: the typed value of a field in it, else its text. */
function cellText(cell: Element): string {
  const field = cell.querySelector("input, select, textarea") as
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (field) {
    if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio"))
      return field.checked ? "✓" : "";
    if (field instanceof HTMLSelectElement) return clean(field.selectedOptions[0]?.text ?? "");
    return clean(field.value);
  }
  return clean((cell as HTMLElement).innerText ?? cell.textContent ?? "");
}

interface Grid {
  headers: string[];
  rows: string[][];
  /** Body rows, in step with `rows`, so a filter can hide the right one. */
  elements: HTMLTableRowElement[];
}

/** Lay a row's cells out by column, repeating nothing for a spanned cell. */
function expand(row: HTMLTableRowElement, read: (c: Element) => string): string[] {
  const out: string[] = [];
  for (const cell of Array.from(row.cells)) {
    out.push(read(cell));
    for (let i = 1; i < (cell.colSpan || 1); i++) out.push("");
  }
  return out;
}

function readTable(table: HTMLTableElement, onlyVisible = true): Grid {
  const headRows = Array.from(table.tHead?.rows ?? []);
  const width = Math.max(0, ...Array.from(table.rows).map((r) => expand(r, () => "").length));
  // Headings stacked over each other (a group, then its columns) join up.
  const headers = Array.from({ length: width }, (_, i) => {
    const parts: string[] = [];
    for (const r of headRows) {
      const text = expand(r, (c) => clean(c.textContent ?? ""))[i] ?? "";
      if (text && !parts.includes(text)) parts.push(text);
    }
    return parts.join(" – ");
  });
  const elements: HTMLTableRowElement[] = [];
  const rows: string[][] = [];
  const bodyRows = [
    ...Array.from(table.tBodies).flatMap((b) => Array.from(b.rows)),
    ...Array.from(table.tFoot?.rows ?? []),
  ];
  for (const r of bodyRows) {
    if (r.hasAttribute("data-no-export")) continue;
    if (onlyVisible && r.hidden) continue;
    const cells = expand(r, cellText);
    while (cells.length < width) cells.push("");
    rows.push(cells);
    elements.push(r);
  }
  // A column with no heading and nothing in it is a checkbox or an action
  // button on screen — nothing to put in a sheet.
  const keep = headers.map((h, i) => h !== "" || rows.some((r) => (r[i] ?? "") !== ""));
  return {
    headers: headers.filter((_, i) => keep[i]),
    rows: rows.map((r) => r.filter((_, i) => keep[i])),
    elements,
  };
}

/** The page's own title for a table: its caption, its page heading, its tab. */
function titleOf(table: HTMLTableElement): string {
  return (
    table.getAttribute("data-title") ||
    table.caption?.textContent?.trim() ||
    document.querySelector("main h1")?.textContent?.trim() ||
    document.title.split("—")[0]?.trim() ||
    "جدول"
  );
}

// -- print ------------------------------------------------------------------

const PRINT_STYLE = `<style>
  body{font-family:system-ui,"Segoe UI",Tahoma,Arial,sans-serif;padding:14px;color:#111}
  h2{font-size:16px;margin:0 0 4px} .meta{font-size:11px;color:#555;margin:0 0 10px}
  table{border-collapse:collapse;width:100%;font-size:11.5px}
  th,td{border:1px solid #999;padding:4px 7px;text-align:right;vertical-align:top}
  th{background:#eef1f7;font-weight:700} tr{page-break-inside:avoid}
  thead{display:table-header-group}
  @page{size:A4 landscape;margin:10mm}
</style>`;

function esc(text: string) {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

/** Put a printable page in a window opened earlier, then print it — as `printHtml` does. */
function printInto(win: Window, html: string, title: string): void {
  win.document.open();
  win.document.write(
    `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`,
  );
  win.document.close();
  win.focus();
  const go = () => setTimeout(() => win.print(), 150);
  if (win.document.fonts?.ready) void win.document.fonts.ready.then(go);
  else setTimeout(go, 400);
}

/**
 * The table as a clean printable page: its rows as shown, no controls.
 *
 * It sits in the school's table print design (Settings › تصاميم الطباعة —
 * letterhead, title, date, footer). The window opens at the click, before the
 * design arrives, so no popup blocker takes the wait for a script's doing;
 * without the design the page is the plain one tables always printed as.
 */
function printTable(table: HTMLTableElement): void {
  const g = readTable(table);
  const title = titleOf(table);
  const head = g.headers.length
    ? `<thead><tr>${g.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`
    : "";
  const body = g.rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  const date = new Date().toLocaleDateString("ar-EG-u-nu-latn");
  const plain = `${PRINT_STYLE}<h2>${esc(title)}</h2><p class="meta">${date} · ${g.rows.length} صف</p><table>${head}<tbody>${body}</tbody></table>`;

  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) {
    toast.error("نافذة الطباعة محجوبة — اسمح بالنوافذ المنبثقة");
    return;
  }
  win.document.write(
    '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"></head><body style="font-family:system-ui,Tahoma,sans-serif;padding:24px;color:#555">جارٍ تجهيز الطباعة…</body></html>',
  );
  void getTableFrame().then((frame) => {
    if (win.closed) return;
    const html = frame
      ? fillTableFrame(frame, {
          title: esc(title),
          date: esc(date),
          count: String(g.rows.length),
          table: `<table class="tp-table">${head}<tbody>${body}</tbody></table>`,
        })
      : plain;
    printInto(win, html, esc(title));
  });
}

// -- the toolbar ------------------------------------------------------------

const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");

function TableToolbar({ table }: { table: HTMLTableElement }) {
  const [q, setQ] = useState("");
  // Column → the values kept. Several values of one column are «any of
  // these»; several columns must all match.
  const [filters, setFilters] = useState<Record<number, string[]>>({});
  const [openCol, setOpenCol] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const [total, setTotal] = useState(0);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const paged = table.hasAttribute("data-paged");

  // The table changes under us — rows load, a page turns, marks are typed —
  // so its rows are read again whenever it does.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setVersion((v) => v + 1), 120);
    };
    const observer = new MutationObserver(bump);
    observer.observe(table, { childList: true, subtree: true, characterData: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [table]);

  // A column filter needs a table with one heading row and no spanned body
  // cells; a grid of grouped headings can still be searched, not split by column.
  const simple = useMemo(() => {
    void version;
    return (
      (table.tHead?.rows.length ?? 0) === 1 &&
      Array.from(table.tBodies[0]?.rows ?? []).every((r) =>
        Array.from(r.cells).every((c) => (c.colSpan || 1) === 1),
      )
    );
  }, [table, version]);

  const all = useMemo(() => {
    void version;
    return readTable(table, false);
  }, [table, version]);

  const optionsOf = useCallback(
    (col: number) =>
      [...new Set(all.rows.map((r) => r[col] ?? "").filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "ar"))
        .slice(0, 300),
    [all],
  );
  const active = Object.entries(filters)
    .map(([c, vals]) => [Number(c), vals] as const)
    .filter(([c]) => c >= 0 && c < all.headers.length);

  // Apply: hide what does not match, show what does.
  useEffect(() => {
    const needle = fold(q.trim());
    let count = 0;
    all.elements.forEach((row, i) => {
      const cells = all.rows[i] ?? [];
      const text = fold(cells.join(" "));
      const ok =
        (!needle || text.includes(needle)) &&
        active.every(([c, vals]) => !vals.length || vals.includes(cells[c] ?? ""));
      if (row.hidden === ok) row.hidden = !ok;
      if (ok) count++;
    });
    setShown(count);
    setTotal(all.elements.length);
    // `active` is rebuilt every render; `filters` is what it is made from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters, all]);

  // A filter left on when the table is gone must not hide rows of the next one.
  useEffect(
    () => () => {
      Array.from(table.rows).forEach((r) => {
        if (r.hidden) r.hidden = false;
      });
    },
    [table],
  );

  const toExcel = useCallback(async () => {
    const g = readTable(table);
    if (g.rows.length === 0) {
      toast.error("لا توجد صفوف للتصدير");
      return;
    }
    setBusy(true);
    try {
      await downloadTable(titleOf(table), g.headers, g.rows);
      toast.success("تم تنزيل ملف Excel");
    } catch (err) {
      toast.error(
        (err as { messageAr?: string }).messageAr || (err as Error).message || "تعذّر التصدير",
      );
    } finally {
      setBusy(false);
    }
  }, [table]);

  const filtering = q !== "" || active.some(([, vals]) => vals.length > 0);
  return (
    <div
      data-table-tools
      className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-secondary/30 px-2.5 py-1.5 text-xs print:hidden"
    >
      <div className="relative min-w-[140px] flex-1 sm:max-w-[260px]">
        <Search className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={paged ? "فلترة الصفحة الحالية…" : "فلترة الجدول…"}
          className="h-8 w-full rounded-lg border border-border bg-card pr-8 text-xs outline-none focus:border-primary"
        />
      </div>

      {simple && all.headers.length > 1 && (
        <>
          {active.map(([c, vals]) => (
            <Popover key={c} open={openCol === c} onOpenChange={(o) => setOpenCol(o ? c : null)}>
              <PopoverTrigger asChild>
                <button
                  className={`inline-flex h-8 max-w-[220px] items-center gap-1 rounded-lg border px-2 font-semibold ${
                    vals.length
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card"
                  }`}
                >
                  <Filter className="size-3 shrink-0" />
                  <span className="truncate">
                    {all.headers[c] || "—"}:{" "}
                    {vals.length === 0
                      ? "الكل"
                      : vals.length === 1
                        ? vals[0]
                        : `${vals.length} قيم`}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="إزالة الفلتر"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilters(({ [c]: _drop, ...rest }) => rest);
                    }}
                    className="rounded p-0.5 hover:bg-primary/20"
                  >
                    <X className="size-3" />
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-0" dir="rtl">
                <ValuePicker
                  options={optionsOf(c)}
                  selected={vals}
                  onChange={(next) => setFilters((f) => ({ ...f, [c]: next }))}
                />
              </PopoverContent>
            </Popover>
          ))}
          <select
            value=""
            onChange={(e) => {
              const c = Number(e.target.value);
              if (c < 0 || Number.isNaN(c)) return;
              setFilters((f) => ({ ...f, [c]: f[c] ?? [] }));
              setOpenCol(c);
            }}
            className="h-8 max-w-[160px] rounded-lg border border-border bg-card px-2 text-xs"
            aria-label="فلترة حسب عمود"
          >
            <option value="">+ فلترة حسب عمود</option>
            {all.headers.map((h, i) =>
              h && !(i in filters) ? (
                <option key={i} value={i}>
                  {h}
                </option>
              ) : null,
            )}
          </select>
        </>
      )}

      {filtering && (
        <button
          onClick={() => {
            setQ("");
            setFilters({});
          }}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 font-semibold text-primary hover:bg-primary/10"
        >
          <X className="size-3.5" />
          مسح
        </button>
      )}

      <span className="num text-muted-foreground">
        {filtering ? `${shown} من ${total}` : `${total} صف`}
      </span>

      <span className="mr-auto flex gap-1.5">
        <button
          onClick={toExcel}
          disabled={busy}
          title={paged ? "تصدير الصفحة الحالية" : "تصدير الصفوف الظاهرة"}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 font-semibold hover:bg-secondary disabled:opacity-60"
        >
          <FileSpreadsheet className="size-3.5" />
          Excel
        </button>
        <button
          onClick={() => printTable(table)}
          // Fetched on the way to the click, so the print rarely waits for it.
          onPointerEnter={() => void getTableFrame()}
          onFocus={() => void getTableFrame()}
          title="طباعة الصفوف الظاهرة"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 font-semibold hover:bg-secondary"
        >
          <Printer className="size-3.5" />
          طباعة
        </button>
      </span>
    </div>
  );
}

/** The values of one column as tick boxes — any number of them kept. */
function ValuePicker({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [find, setFind] = useState("");
  const needle = fold(find.trim());
  const shown = needle ? options.filter((o) => fold(o).includes(needle)) : options;
  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  return (
    <div className="text-xs">
      <div className="border-b border-border p-2">
        <input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="ابحث في القيم…"
          autoFocus
          className="h-8 w-full rounded-lg border border-border bg-card px-2 outline-none focus:border-primary"
        />
        <div className="mt-1.5 flex gap-3">
          <button
            onClick={() => onChange([...new Set([...selected, ...shown])])}
            className="font-semibold text-primary hover:underline"
          >
            تحديد الكل
          </button>
          <button
            onClick={() => onChange([])}
            className="font-semibold text-muted-foreground hover:underline"
          >
            إلغاء التحديد
          </button>
        </div>
      </div>
      <ul className="max-h-64 overflow-y-auto p-1">
        {shown.map((o) => {
          const on = selected.includes(o);
          return (
            <li key={o}>
              <button
                onClick={() => toggle(o)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start hover:bg-secondary"
              >
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded border ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {on && <Check className="size-3" />}
                </span>
                <span className="truncate">{o}</span>
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="px-2 py-3 text-center text-muted-foreground">لا قيم</li>}
      </ul>
    </div>
  );
}

// -- putting a toolbar over every table -----------------------------------------

/** A table worth a toolbar: a real one, on the page, not in a print sheet. */
function wants(table: HTMLTableElement): boolean {
  if (table.hasAttribute("data-no-tools") || table.getAttribute("data-tools") === "own")
    return false;
  if (table.closest("[data-no-tools], [data-table-tools], .ms-page, [data-print]")) return false;
  // Inside another table it is a cell's layout, not a table of its own.
  if (table.parentElement?.closest("table")) return false;
  return table.tBodies.length > 0 && table.rows.length > 1;
}

/** Above the table — and above its scroll wrapper when it is the wrapper's only child. */
function anchorOf(table: HTMLTableElement): HTMLElement {
  let node: HTMLElement = table;
  while (
    node.parentElement &&
    node.parentElement.children.length === 1 &&
    /overflow-(x-)?(auto|scroll)/.test(node.parentElement.className) &&
    node.parentElement !== document.body
  ) {
    node = node.parentElement;
  }
  return node;
}

export function TableToolsHost() {
  const mounted = useRef(new Map<HTMLTableElement, { root: Root; box: HTMLElement }>());

  useEffect(() => {
    const live = mounted.current;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scan = () => {
      // Drop the toolbars of tables that left the page.
      for (const [table, entry] of live) {
        if (!table.isConnected || !wants(table)) {
          // Unmounting during a React commit is not allowed; do it after.
          queueMicrotask(() => entry.root.unmount());
          entry.box.remove();
          live.delete(table);
        }
      }
      for (const table of Array.from(document.querySelectorAll("table"))) {
        if (live.has(table) || !wants(table)) continue;
        const anchor = anchorOf(table);
        if (!anchor.parentElement) continue;
        const box = document.createElement("div");
        box.setAttribute("data-table-tools-box", "");
        anchor.parentElement.insertBefore(box, anchor);
        const root = createRoot(box);
        root.render(<TableToolbar table={table} />);
        live.set(table, { root, box });
      }
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(scan, 200);
    };
    const observer = new MutationObserver((records) => {
      // Our own toolbars changing must not trigger another scan.
      if (
        records.every((r) =>
          [...Array.from(r.addedNodes), ...Array.from(r.removedNodes), r.target].every(
            (n) =>
              n instanceof Element &&
              (n.closest("[data-table-tools-box]") || n.hasAttribute("data-table-tools-box")),
          ),
        )
      )
        return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      for (const [, entry] of live) {
        queueMicrotask(() => entry.root.unmount());
        entry.box.remove();
      }
      live.clear();
    };
  }, []);

  return null;
}

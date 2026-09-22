import { useEffect, useMemo } from "react";
import { Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FormField } from "@/lib/api/hooks";

export const WIDTH_CLASS: Record<string, string> = {
  full: "sm:col-span-6",
  half: "sm:col-span-3",
  third: "sm:col-span-2",
};

const lines = (options: string) =>
  options
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);

/** Rows of a table answer, which is stored as JSON text. */
function tableRows(value: string): Array<Record<string, string>> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Array<Record<string, string>>) : [];
  } catch {
    return [];
  }
}

/** A section's pupil, as a row of a «جدول طلاب». */
export interface SectionStudent {
  id: string;
  name: string;
}

/** `الوضع السلوكي: ممتاز|جيد` is a column of choices; a bare title is a
 * column to write in. */
export function studentColumns(options: string): Array<{ title: string; choices: string[] }> {
  return lines(options).map((line) => {
    const at = line.indexOf(":");
    if (at > 0) {
      const choices = line
        .slice(at + 1)
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (choices.length) return { title: line.slice(0, at).trim(), choices };
    }
    return { title: line.replace(/:$/, "").trim(), choices: [] };
  });
}

function StudentTableInput({
  field,
  value,
  onChange,
  students,
  readOnly,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  students: SectionStudent[] | undefined;
  readOnly?: boolean;
}) {
  const columns = useMemo(() => studentColumns(field.options), [field.options]);
  const rows = tableRows(value);
  const write = (next: Array<Record<string, string>>) => onChange(JSON.stringify(next));

  // A new copy starts with the section's pupils already listed.
  useEffect(() => {
    if (readOnly || !students?.length || tableRows(value).length) return;
    write(students.map((s) => ({ student: s.id, name: s.name })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, readOnly]);

  if (!rows.length) {
    return (
      <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
        {students === undefined
          ? "اختر الشعبة أولاً — يُملأ الجدول بطلابها تلقائياً."
          : "لا يوجد طلاب في هذه الشعبة."}
      </p>
    );
  }

  const missing = (students ?? []).filter((s) => !rows.some((r) => r["student"] === s.id));
  return (
    <div className="space-y-1.5">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-right text-xs">
          <thead className="bg-secondary/60">
            <tr>
              <th className="w-7 px-1 py-1.5 text-center font-medium">م</th>
              <th className="whitespace-nowrap px-2 py-1.5 font-medium">اسم الطالب/ة</th>
              {columns.map((c) => (
                <th key={c.title} className="whitespace-nowrap px-2 py-1.5 font-medium">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row["student"] || i} className="border-t border-border">
                <td className="px-1 text-center text-muted-foreground">{i + 1}</td>
                <td className="whitespace-nowrap px-2 py-1 font-medium">{row["name"]}</td>
                {columns.map((c) => (
                  <td key={c.title} className="p-1">
                    {readOnly ? (
                      <span className="px-1">{row[c.title] || "—"}</span>
                    ) : c.choices.length ? (
                      <select
                        value={row[c.title] ?? ""}
                        onChange={(e) =>
                          write(
                            rows.map((r, j) => (j === i ? { ...r, [c.title]: e.target.value } : r)),
                          )
                        }
                        className="h-8 w-full min-w-24 rounded-md border border-input bg-transparent px-1 text-xs"
                      >
                        <option value="">—</option>
                        {c.choices.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        className="h-8 min-w-28"
                        value={row[c.title] ?? ""}
                        onChange={(e) =>
                          write(
                            rows.map((r, j) => (j === i ? { ...r, [c.title]: e.target.value } : r)),
                          )
                        }
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && missing.length > 0 && (
        <button
          type="button"
          onClick={() => write([...rows, ...missing.map((s) => ({ student: s.id, name: s.name }))])}
          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          <RefreshCw className="size-3" />
          إضافة طلاب الشعبة الجدد ({missing.length})
        </button>
      )}
    </div>
  );
}

/**
 * One field of a specialist form, drawn from its design.
 *
 * Every answer is kept as text: the form is a record of what a nurse or a
 * counsellor wrote, and a school that changes a field's type later must not
 * lose what was already written under it.
 */
export function FormFieldInput({
  field,
  value,
  onChange,
  readOnly,
  students,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  /** The section's pupils, for a «جدول طلاب». */
  students?: SectionStudent[] | undefined;
}) {
  const options = useMemo(() => lines(field.options), [field.options]);

  if (field.fieldtype === "Text Block") {
    return (
      <p className="whitespace-pre-line rounded-lg bg-secondary/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
        {field.options}
      </p>
    );
  }
  if (field.fieldtype === "Student Table") {
    return (
      <StudentTableInput
        field={field}
        value={value}
        onChange={onChange}
        students={students}
        {...(readOnly ? { readOnly: true } : {})}
      />
    );
  }

  if (readOnly && field.fieldtype !== "Table") {
    const shown =
      field.fieldtype === "Checkbox"
        ? Number(value)
          ? "نعم"
          : "لا"
        : field.fieldtype === "Rating"
          ? `${value || 0} / 5`
          : value || "—";
    return <p className="mt-1 whitespace-pre-wrap text-sm font-medium">{shown}</p>;
  }

  switch (field.fieldtype) {
    case "Long Text":
      return (
        <Textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description || undefined}
        />
      );
    case "Number":
      return (
        <Input type="number" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} />
      );
    case "Date":
      return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "Time":
      return <Input type="time" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "Datetime":
      return (
        <Input
          type="datetime-local"
          value={value.replace(" ", "T").slice(0, 16)}
          onChange={(e) => onChange(e.target.value.replace("T", " "))}
        />
      );
    case "Select":
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "Multi Select": {
      const chosen = value ? value.split("، ").filter(Boolean) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = chosen.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() =>
                  onChange((on ? chosen.filter((c) => c !== o) : [...chosen, o]).join("، "))
                }
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-primary bg-primary-soft/60 font-medium text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case "Checkbox":
      return (
        <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={!!Number(value)}
            onChange={(e) => onChange(e.target.checked ? "1" : "0")}
          />
          {Number(value) ? "نعم" : "لا"}
        </label>
      );
    case "Rating":
      return (
        <div className="flex h-9 items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(Number(value) === n ? 0 : n))}
              aria-label={`${n}`}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "size-5",
                  n <= Number(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
          <span className="ms-1 text-xs text-muted-foreground">{Number(value) || 0}/5</span>
        </div>
      );
    case "Table": {
      const columns = options.length ? options : ["العمود الأول"];
      const rows = tableRows(value);
      const write = (next: Array<Record<string, string>>) => onChange(JSON.stringify(next));
      return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-right text-xs">
            <thead className="bg-secondary/60">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">
                    {c}
                  </th>
                ))}
                {!readOnly && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((c) => (
                    <td key={c} className="p-1">
                      {readOnly ? (
                        <span className="px-1">{row[c] || "—"}</span>
                      ) : (
                        <Input
                          className="h-8"
                          value={row[c] ?? ""}
                          onChange={(e) =>
                            write(rows.map((r, j) => (j === i ? { ...r, [c]: e.target.value } : r)))
                          }
                        />
                      )}
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="p-1">
                      <button
                        type="button"
                        onClick={() => write(rows.filter((_, j) => j !== i))}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="p-2 text-center text-muted-foreground"
                  >
                    لا توجد صفوف
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!readOnly && (
            <button
              type="button"
              onClick={() => write([...rows, Object.fromEntries(columns.map((c) => [c, ""]))])}
              className="flex w-full items-center justify-center gap-1 border-t border-border py-1.5 text-xs font-medium text-primary hover:bg-primary-soft/30"
            >
              <Plus className="size-3.5" />
              إضافة صف
            </button>
          )}
        </div>
      );
    }
    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description || undefined}
        />
      );
  }
}

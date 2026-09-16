import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/shared/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import {
  useLinkOptions,
  useRecordFields,
  useSaveRecordFields,
  type RecordField,
  type RecordFieldsDoctype,
} from "@/lib/api/hooks";

export const RECORD_FIELDS_ANCHOR = "record-fields";

const DATE = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });

function show(field: RecordField): string {
  const v = field.value;
  if (v === null || v === undefined || v === "") return "—";
  if (field.fieldtype === "Check") return Number(v) ? "نعم" : "لا";
  if (field.display) return field.display;
  if (field.fieldtype === "Select" && Array.isArray(field.options)) {
    return field.options.find((o) => o.value === v)?.label ?? String(v);
  }
  if (field.fieldtype === "Date") {
    const parsed = new Date(String(v));
    return Number.isNaN(parsed.getTime()) ? String(v) : DATE.format(parsed);
  }
  return String(v);
}

/** The pencil the profile pages put in their header. */
export function EditRecordButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={() => {
        onClick();
        requestAnimationFrame(() =>
          document
            .getElementById(RECORD_FIELDS_ANCHOR)
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }}
      className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft/40 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
    >
      <Pencil className="size-3.5" />
      تعديل البيانات
    </button>
  );
}

function LinkInput({
  doctype,
  field,
  value,
  onChange,
}: {
  doctype: RecordFieldsDoctype;
  field: RecordField;
  value: string;
  onChange: (v: string) => void;
}) {
  const [txt, setTxt] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTxt(value), 250);
    return () => clearTimeout(t);
  }, [value]);
  const { data } = useLinkOptions(doctype, field.fieldname, txt);
  const listId = `link-${field.fieldname}`;
  return (
    <>
      <Input list={listId} value={value} onChange={(e) => onChange(e.target.value)} dir="auto" />
      <datalist id={listId}>
        {(data ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label !== o.value ? o.label : undefined}
          </option>
        ))}
      </datalist>
    </>
  );
}

function Editor({
  doctype,
  field,
  value,
  onChange,
}: {
  doctype: RecordFieldsDoctype;
  field: RecordField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const text = value === null || value === undefined ? "" : String(value);
  switch (field.fieldtype) {
    case "Check":
      return (
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={!!Number(value)}
            onChange={(e) => onChange(e.target.checked ? 1 : 0)}
          />
          {Number(value) ? "نعم" : "لا"}
        </label>
      );
    case "Select":
      return (
        <select
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">—</option>
          {(Array.isArray(field.options) ? field.options : []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "Link":
      return <LinkInput doctype={doctype} field={field} value={text} onChange={onChange} />;
    case "Date":
      return <Input type="date" value={text.slice(0, 10)} onChange={(e) => onChange(e.target.value)} />;
    case "Datetime":
      return (
        <Input
          type="datetime-local"
          value={text.replace(" ", "T").slice(0, 16)}
          onChange={(e) => onChange(e.target.value.replace("T", " "))}
        />
      );
    case "Time":
      return <Input type="time" value={text.slice(0, 5)} onChange={(e) => onChange(e.target.value)} />;
    case "Int":
    case "Float":
    case "Currency":
    case "Percent":
      return (
        <Input type="number" dir="ltr" value={text} onChange={(e) => onChange(e.target.value)} />
      );
    case "Small Text":
    case "Text":
    case "Long Text":
    case "Text Editor":
      return <Textarea rows={2} value={text} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <Input dir="auto" value={text} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * Every field of the record, as its DocType lays it out. Back office only:
 * the server refuses anyone else, and the hand-picked summary above it is
 * what families and teachers see.
 */
export function RecordFields({
  doctype,
  name,
  editing,
  onEditingChange,
  onSaved,
}: {
  doctype: RecordFieldsDoctype;
  name: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSaved?: () => void;
}) {
  const { data, isLoading, error } = useRecordFields(doctype, name);
  const save = useSaveRecordFields(doctype, name);
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!editing) setDraft({});
  }, [editing]);

  // Consecutive unlabelled sections are one block on screen.
  const sections = useMemo(() => {
    const out: Array<{ label: string; fields: RecordField[] }> = [];
    for (const s of data?.sections ?? []) {
      const label = s.label || "البيانات الأساسية";
      const last = out[out.length - 1];
      if (last && last.label === label) last.fields.push(...s.fields);
      else out.push({ label, fields: [...s.fields] });
    }
    return out;
  }, [data]);

  const tables = data?.tables ?? [];
  const changed = Object.keys(draft).length > 0;

  const submit = () => {
    if (!changed) {
      onEditingChange(false);
      return;
    }
    save.mutate(draft, {
      onSuccess: () => {
        toast.success("تم حفظ التعديلات");
        onEditingChange(false);
        onSaved?.();
      },
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.messageAr || e.message : "تعذّر حفظ التعديلات"),
    });
  };

  const actions = editing ? (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onEditingChange(false)}
        disabled={save.isPending}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
      >
        <X className="size-3.5" />
        إلغاء
      </button>
      <button
        onClick={submit}
        disabled={save.isPending}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        حفظ
      </button>
    </div>
  ) : (
    <button
      onClick={() => onEditingChange(true)}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
    >
      <Pencil className="size-3.5" />
      تعديل
    </button>
  );

  return (
    <div id={RECORD_FIELDS_ANCHOR} className="mt-6 scroll-mt-24">
      <SectionCard
        title="البيانات الكاملة"
        description={editing ? "عدّل الحقول ثم اضغط حفظ" : "جميع الحقول المسجّلة في النظام"}
        actions={data ? actions : undefined}
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">جارِ التحميل…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.messageAr || error.message : "تعذّر تحميل البيانات"}
          </p>
        ) : (
          <Tabs defaultValue="s-0" dir="rtl">
            <TabsList className="mb-5 h-auto flex-wrap justify-start rounded-xl p-1">
              {sections.map((sec, i) => (
                <TabsTrigger key={`t-${i}`} value={`s-${i}`} className="rounded-lg">
                  {sec.label}
                  {editing && sec.fields.some((f) => f.fieldname in draft) && (
                    <span className="ms-1.5 size-1.5 rounded-full bg-primary" />
                  )}
                </TabsTrigger>
              ))}
              {tables.map((t) => (
                <TabsTrigger key={t.fieldname} value={`t-${t.fieldname}`} className="rounded-lg">
                  {t.label}
                  <span className="ms-1.5 text-[10px] text-muted-foreground">({t.rows.length})</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {sections.map((sec, i) => (
              <TabsContent key={`c-${i}`} value={`s-${i}`} className="mt-0">
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sec.fields.map((f) => {
                    const canEdit = editing && f.editable;
                    const value = f.fieldname in draft ? draft[f.fieldname] : f.value;
                    return (
                      <div key={f.fieldname} className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">
                          {f.label}
                          {canEdit && f.reqd ? <span className="text-destructive"> *</span> : null}
                        </p>
                        {canEdit ? (
                          <div className="mt-1">
                            <Editor
                              doctype={doctype}
                              field={f}
                              value={value}
                              onChange={(v) => setDraft((prev) => ({ ...prev, [f.fieldname]: v }))}
                            />
                          </div>
                        ) : (
                          <p
                            className={`mt-0.5 break-words text-sm font-medium ${
                              editing ? "text-muted-foreground" : ""
                            }`}
                          >
                            {show(f)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            ))}

            {tables.map((t) => (
              <TabsContent key={t.fieldname} value={`t-${t.fieldname}`} className="mt-0">
                {t.rows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">لا توجد سجلات</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          {t.columns.map((c) => (
                            <th key={c.fieldname} className="whitespace-nowrap py-2 pl-4 font-medium">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {t.rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-border/60 last:border-0">
                            {t.columns.map((c) => (
                              <td key={c.fieldname} className="py-2 pl-4">
                                {row[c.fieldname] === null || row[c.fieldname] === undefined || row[c.fieldname] === ""
                                  ? "—"
                                  : String(row[c.fieldname])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </SectionCard>
    </div>
  );
}

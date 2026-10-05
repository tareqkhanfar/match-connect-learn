import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Printer, Save, Search, UserRound, Users } from "lucide-react";
import { FormBody } from "@/components/forms/form-designer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/shared/ui-kit";
import { errorMessage } from "@/lib/api/error-message";
import {
  printFormEntry,
  useFormEntry,
  useFormStudents,
  useMyGroups,
  type FormField,
} from "@/lib/api/hooks";
import {
  fetchPageValues,
  usePageStudents,
  useSavePageEntry,
  type CustomPageDef,
  type PageConfig,
} from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";

const NO_VALUE = new Set(["Section", "Heading", "Text Block"]);

/** The form's fields as this page shows them: hidden ones out, labels,
    widths and requirements as the page set them. */
export function pageFields(fields: FormField[], config: PageConfig): FormField[] {
  return fields
    .filter((f) => !config.fields[f.fieldname]?.hidden)
    .map((f) => {
      const rule = config.fields[f.fieldname];
      if (!rule) return f;
      return {
        ...f,
        label: rule.label || f.label,
        width: rule.width || f.width,
        reqd: rule.reqd ? 1 : f.reqd,
      };
    });
}

/** Fields the person filling cannot change on this page. */
export function lockedOf(config: PageConfig): Set<string> {
  return new Set(
    Object.entries(config.fields)
      .filter(([, r]) => r.readOnly || r.fetch?.mode === "always")
      .map(([f]) => f),
  );
}

export function fetchHints(
  config: PageConfig,
  sourceLabels: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, rule] of Object.entries(config.fields)) {
    if (!rule.fetch) continue;
    const source = rule.fetch.source.startsWith("form:")
      ? "آخر إجابة في نموذج آخر"
      : (sourceLabels[rule.fetch.source] ?? rule.fetch.source);
    out[field] =
      rule.fetch.mode === "always"
        ? `يُجلب تلقائياً: ${source}`
        : `يُقترح من: ${source} — يمكن تعديله`;
  }
  return out;
}

/** What a new copy starts with: the form's defaults, then the page's. */
function startingValues(def: CustomPageDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of def.form.fields) {
    if (NO_VALUE.has(f.fieldtype)) continue;
    const pageDefault = def.config.fields[f.fieldname]?.default;
    if (pageDefault) out[f.fieldname] = pageDefault;
    else if (f.default) out[f.fieldname] = f.default;
  }
  return out;
}

interface Picked {
  id: string;
  name: string;
  group: string | null;
  groupLabel: string;
}

/**
 * Filling one copy of a built page's form.
 *
 * The page's rules are applied here for the person filling and again on the
 * server for the record: a value the page fetches «always» is shown locked and
 * overwritten on save whatever the browser sent.
 */
export function PageEntryEditor({
  def,
  entryName,
  onSaved,
}: {
  def: CustomPageDef;
  /** An existing copy to open; absent for a new one. */
  entryName?: string | undefined;
  onSaved?: (name: string) => void;
}) {
  const [name, setName] = useState(entryName ?? "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    entryName ? {} : startingValues(def),
  );
  const [notes, setNotes] = useState("");
  const [student, setStudent] = useState<Picked | null>(null);
  const [section, setSection] = useState<{ id: string; label: string } | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("مسودة");
  const [fetching, setFetching] = useState(false);
  // What the last fetch put in each field: a later fetch may replace a value
  // it put there itself, but never one the person typed.
  const fetched = useRef<Record<string, string>>({});

  const existing = useFormEntry(entryName || undefined);
  const save = useSavePageEntry(def.id);
  const entryFor = def.entryFor;
  const students = usePageStudents(
    def.id,
    search,
    entryFor === "Student" && !student && !entryName,
  );
  const groups = useMyGroups(entryFor === "Section" && !section);
  const pupils = useFormStudents("", undefined, section?.id, !!section);
  const sectionStudents = section
    ? (pupils.data?.students ?? []).map((s) => ({ id: s.id, name: s.name }))
    : undefined;

  const fields = useMemo(() => pageFields(def.form.fields, def.config), [def]);
  const locked = useMemo(() => lockedOf(def.config), [def]);
  const hints = useMemo(() => fetchHints(def.config, def.sourceLabels), [def]);
  const hasFetch = Object.values(def.config.fields).some((r) => r.fetch);

  useEffect(() => {
    const e = existing.data;
    if (!e) return;
    setValues(e.values);
    setNotes(e.notes);
    setStatus(e.status);
    setStudent(
      e.student
        ? {
            id: e.student,
            name: e.studentName,
            group: e.studentGroup,
            groupLabel: e.studentGroupLabel || e.studentGroup || "",
          }
        : null,
    );
    setSection(
      !e.student && e.studentGroup
        ? { id: e.studentGroup, label: e.studentGroupLabel || e.studentGroup }
        : null,
    );
  }, [existing.data]);

  async function runFetch(subject: { student?: string; section?: string }) {
    if (!hasFetch) return;
    setFetching(true);
    try {
      const res = await fetchPageValues(def.id, { ...subject, entry: name || undefined });
      setValues((prev) => {
        const next = { ...prev };
        for (const [field, value] of Object.entries(res.values)) {
          const rule = def.config.fields[field];
          const current = prev[field] ?? "";
          const ours = current === (fetched.current[field] ?? "");
          if (rule?.fetch?.mode === "always" || !current.trim() || ours) next[field] = value;
        }
        fetched.current = { ...fetched.current, ...res.values };
        return next;
      });
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر جلب البيانات"));
    } finally {
      setFetching(false);
    }
  }

  // A general form fetches what needs no student — today, the person filling —
  // as soon as it opens.
  useEffect(() => {
    if (!entryName && entryFor === "General") void runFetch({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickStudent(s: Picked) {
    setStudent(s);
    void runFetch({ student: s.id });
  }

  function pickSection(g: { id: string; label: string }) {
    setSection(g);
    void runFetch({ section: g.id });
  }

  function submit(next: "مسودة" | "مكتمل") {
    if (entryFor === "Student" && !student) {
      toast.error("اختر الطالب");
      return;
    }
    if (entryFor === "Section" && !section) {
      toast.error("اختر الشعبة");
      return;
    }
    save.mutate(
      {
        ...(name ? { name } : {}),
        ...(entryFor === "Student" && student ? { student: student.id } : {}),
        studentGroup:
          entryFor === "Student"
            ? (student?.group ?? null)
            : entryFor === "Section"
              ? (section?.id ?? null)
              : null,
        status: next,
        values,
        notes,
      },
      {
        onSuccess: (res) => {
          setName(res.name);
          setValues(res.values);
          setStatus(next);
          toast.success(next === "مكتمل" ? "حُفظ مكتملاً" : "حُفظ كمسودة");
          onSaved?.(res.name);
        },
        onError: (err) => toast.error(errorMessage(err, "تعذّر الحفظ")),
      },
    );
  }

  if (entryName && existing.isLoading) {
    return <p className="p-6 text-center text-sm text-muted-foreground">جارِ فتح النسخة…</p>;
  }

  const subjectChosen = entryFor === "General" || (entryFor === "Section" ? !!section : !!student);

  return (
    <div className="space-y-5">
      {/* Who it is about ------------------------------------------------- */}
      {entryFor !== "General" && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">
            {entryFor === "Section" ? "الشعبة" : "الطالب"}
          </p>
          {entryFor === "Student" && student ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary bg-primary-soft/40 p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <UserRound className="size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{student.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {student.groupLabel || "بدون شعبة"}
                  </p>
                </div>
              </div>
              {!name && (
                <button
                  onClick={() => setStudent(null)}
                  className="shrink-0 rounded-lg border border-border bg-card px-2 py-1 text-[11px] hover:bg-secondary"
                >
                  تغيير
                </button>
              )}
            </div>
          ) : entryFor === "Section" && section ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary bg-primary-soft/40 p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Users className="size-4 shrink-0 text-primary" />
                <p className="truncate text-sm font-bold">{section.label}</p>
              </div>
              {!name && (
                <button
                  onClick={() => setSection(null)}
                  className="shrink-0 rounded-lg border border-border bg-card px-2 py-1 text-[11px] hover:bg-secondary"
                >
                  تغيير
                </button>
              )}
            </div>
          ) : entryFor === "Student" ? (
            <>
              <div className="relative">
                <Search className="absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
                <Input
                  className="ps-7"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث باسم الطالب أو رقمه…"
                  autoFocus
                />
              </div>
              <div className="mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-border">
                {(students.data?.students ?? []).map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      pickStudent({
                        id: s.id,
                        name: s.name,
                        group: s.group,
                        groupLabel: s.groupLabel,
                      })
                    }
                    className="flex w-full items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-right last:border-0 hover:bg-secondary"
                  >
                    <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-xs">{s.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {s.groupLabel || s.id}
                    </span>
                  </button>
                ))}
                {students.isLoading && (
                  <p className="p-3 text-center text-xs text-muted-foreground">جارِ التحميل…</p>
                )}
                {students.data?.students.length === 0 && (
                  <p className="p-3 text-center text-xs text-muted-foreground">
                    {search
                      ? "لا توجد نتائج"
                      : students.data.subjectsCount === 0
                        ? "لم يُحدَّد طلاب خاضعون لهذا النموذج بعد."
                        : "لا يوجد طلاب"}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="max-h-60 overflow-y-auto rounded-xl border border-border">
              {(groups.data ?? []).map((g) => (
                <button
                  key={g.name}
                  onClick={() => pickSection({ id: g.name, label: g.student_group_name || g.name })}
                  className="flex w-full items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-right last:border-0 hover:bg-secondary"
                >
                  <Users className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {g.student_group_name || g.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {g.students} طالب
                  </span>
                </button>
              ))}
              {groups.isLoading && (
                <p className="p-3 text-center text-xs text-muted-foreground">جارِ التحميل…</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* The form -------------------------------------------------------- */}
      {subjectChosen && (
        <>
          {fetching && (
            <p className="text-[11px] text-muted-foreground">جارِ جلب البيانات من السجل…</p>
          )}
          <FormBody
            fields={fields}
            values={values}
            onChange={(field, v) => setValues((prev) => ({ ...prev, [field]: v }))}
            students={sectionStudents}
            lockedFields={locked}
            hints={hints}
          />
          {def.config.showNotes ? (
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">ملاحظات</p>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          ) : null}

          <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
            {name && (
              <Pill tone={status === "مكتمل" ? "success" : "warning"}>
                {status === "مكتمل" ? "مكتمل" : "مسودة"}
              </Pill>
            )}
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {name && (
                <button
                  onClick={() =>
                    void printFormEntry(name).catch((e) =>
                      toast.error(errorMessage(e, "تعذّرت الطباعة")),
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
                >
                  <Printer className="size-3.5" />
                  طباعة
                </button>
              )}
              <button
                onClick={() => submit("مسودة")}
                disabled={save.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50"
              >
                <Save className="size-3.5" />
                حفظ كمسودة
              </button>
              <button
                onClick={() => submit("مكتمل")}
                disabled={save.isPending}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50",
                )}
              >
                <CheckCircle2 className="size-3.5" />
                حفظ مكتمل
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

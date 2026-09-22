import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  FileText,
  Files,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Settings2,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { isBackOffice } from "@/lib/roles";
import { errorMessage } from "@/lib/api/error-message";
import { FormBody, FormDesigner } from "@/components/forms/form-designer";
import { FormSubjects } from "@/components/forms/form-subjects";
import {
  printFormEntry,
  useDeleteFormEntry,
  useDeleteFormTemplate,
  useDuplicateFormTemplate,
  useFormEntries,
  useFormEntry,
  useFormStudents,
  useFormTemplate,
  useFormTemplates,
  useSaveFormEntry,
  useSetFormCategorySettings,
  type FormTemplate,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

/** The five specialist files. The route is one screen, the category its subject. */
export const FORM_CATEGORIES: Record<string, string> = {
  nursing: "نماذج التمريض",
  counselling: "نماذج الإرشاد",
  special_needs: "نماذج الاحتياجات الخاصة",
  learning_difficulties: "نماذج صعوبات التعلم",
  speech_language: "نماذج النطق واللغة",
};

export const Route = createFileRoute("/app/forms/$category")({
  beforeLoad: ({ params }) => {
    if (!FORM_CATEGORIES[params.category]) throw notFound();
  },
  head: ({ params }) => ({
    meta: [
      { title: `${FORM_CATEGORIES[params.category] ?? "النماذج"} — Match Education` },
      {
        name: "description",
        content: "تعبئة النماذج المتخصصة للطلاب وإدارة تصميمها وطباعتها.",
      },
    ],
  }),
  component: FormsPage,
});

const DATE = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });
const when = (v: string) => {
  if (!v) return "—";
  const d = new Date(v.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? v : DATE.format(d);
};

function FormsPage() {
  const { category } = Route.useParams();
  const { role } = useApp();
  const backOffice = isBackOffice(role);
  const confirm = useConfirm();

  const [tab, setTab] = useState<"fill" | "records" | "subjects" | "manage">("fill");
  const templates = useFormTemplates(category, tab === "manage" || tab === "subjects");

  // Filling
  const [templateName, setTemplateName] = useState("");
  const [student, setStudent] = useState<{ id: string; name: string; group: string | null } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [entryName, setEntryName] = useState("");

  const template = useFormTemplate(templateName || undefined);
  // Only the students the chosen form applies to.
  const studentList = useFormStudents(search, templateName || undefined);
  const entries = useFormEntries({ category });
  const saveEntry = useSaveFormEntry();
  const deleteEntry = useDeleteFormEntry();
  const deleteTemplate = useDeleteFormTemplate();
  const duplicate = useDuplicateFormTemplate();
  const setSettings = useSetFormCategorySettings();
  // Filling is the administration's decision, per file.
  const teachersMayFill = templates.data?.teachersMayFill ?? true;
  const mayFill = backOffice || teachersMayFill;

  // Managing
  const [editing, setEditing] = useState<FormTemplate | null>(null);
  const [designing, setDesigning] = useState(false);
  const editTemplate = useFormTemplate(editing?.name || undefined);

  useEffect(() => {
    setTemplateName("");
    setStudent(null);
    setValues({});
    setNotes("");
    setEntryName("");
    setDesigning(false);
    setEditing(null);
    setTab("fill");
  }, [category]);

  // A teacher who may not fill lands on the records instead of an empty tab.
  useEffect(() => {
    if (!mayFill && tab === "fill") setTab("records");
  }, [mayFill, tab]);

  const rows = templates.data?.templates ?? [];
  const active = useMemo(() => rows.filter((r) => r.isActive), [rows]);

  const openEntry = useFormEntry(entryName || undefined);
  useEffect(() => {
    const e = openEntry.data;
    if (!e) return;
    setTemplateName(e.template);
    setStudent({ id: e.student, name: e.studentName, group: e.studentGroup });
    setValues(e.values);
    setNotes(e.notes);
    setTab("fill");
  }, [openEntry.data]);

  function reset() {
    setValues({});
    setNotes("");
    setEntryName("");
    setStudent(null);
  }

  function submit(status: "مسودة" | "مكتمل") {
    if (!templateName) {
      toast.error("اختر النموذج");
      return;
    }
    if (!student) {
      toast.error("اختر الطالب");
      return;
    }
    saveEntry.mutate(
      {
        ...(entryName ? { name: entryName } : {}),
        template: templateName,
        student: student.id,
        studentGroup: student.group,
        status,
        values,
        notes,
      },
      {
        onSuccess: (e) => {
          setEntryName(e.name);
          toast.success(status === "مكتمل" ? "تم حفظ النموذج مكتملاً" : "حُفظ كمسودة");
        },
        onError: (err) => toast.error(errorMessage(err, "تعذّر حفظ النموذج")),
      },
    );
  }

  async function print() {
    if (!entryName) {
      toast.error("احفظ النموذج أولاً ثم اطبعه");
      return;
    }
    try {
      await printFormEntry(entryName);
    } catch (e) {
      toast.error(errorMessage(e, "تعذّرت الطباعة"));
    }
  }

  if (templates.isLoading) return <DashboardSkeleton />;
  if (templates.error)
    return <ErrorState error={templates.error} onRetry={() => templates.refetch()} />;

  const tabs = [
    ...(mayFill ? [{ key: "fill" as const, label: "تعبئة نموذج", icon: ClipboardList }] : []),
    {
      key: "records" as const,
      label: `النماذج المعبّأة (${entries.data?.entries.length ?? 0})`,
      icon: Files,
    },
    ...(backOffice
      ? [
          { key: "subjects" as const, label: "الطلاب الخاضعون", icon: Users },
          { key: "manage" as const, label: "إدارة النماذج", icon: Settings2 },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={FORM_CATEGORIES[category] ?? "النماذج"}
        subtitle="عبّئ نموذجاً لطالب، أو راجع النماذج المعبّأة، أو صمّم النماذج وطباعتها"
        actions={
          tab === "fill" && entryName ? (
            <button
              onClick={reset}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              نموذج جديد
            </button>
          ) : undefined
        }
      />

      <div className="mt-5 flex flex-wrap gap-1.5 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fill" && !mayFill && (
        <div className="mt-5">
          <EmptyBlock
            title="تعبئة النماذج في هذا القسم مقصورة على الإدارة"
            description="يمكنك الاطلاع على النماذج المعبّأة. لتفعيل التعبئة للمعلمين، تُغيَّر من إعدادات القسم لدى الإدارة."
            icon={<ClipboardList className="size-6" />}
          />
        </div>
      )}

      {/* --- Fill ------------------------------------------------------- */}
      {tab === "fill" && mayFill && (
        <div className="mt-5 space-y-4">
          <SectionCard
            title="النموذج والطالب"
            description="اختر النموذج ثم الطالب، ثم عبّئ البيانات"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] text-muted-foreground">النموذج</p>
                {active.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                    لا توجد نماذج مفعّلة في هذا القسم
                    {backOffice ? " — أنشئ نموذجاً من «إدارة النماذج»." : " — راجع الإدارة."}
                  </p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {active.map((t) => (
                      <button
                        key={t.name}
                        onClick={() => {
                          setTemplateName(t.name);
                          setEntryName("");
                          setValues({});
                          setStudent(null);
                        }}
                        className={cn(
                          "rounded-xl border p-2.5 text-right transition-colors",
                          templateName === t.name
                            ? "border-primary bg-primary-soft/40"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <p className="truncate text-sm font-bold">{t.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {t.subjects ?? 0} طالب خاضع · {t.entries} معبّأ
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] text-muted-foreground">الطالب</p>
                {!templateName ? (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                    اختر النموذج أولاً — تظهر هنا الطلاب الخاضعون له فقط.
                  </p>
                ) : !student && studentList.data?.subjectsCount === 0 ? (
                  <p className="rounded-lg border border-dashed border-warning/50 bg-warning/5 p-3 text-xs text-muted-foreground">
                    لم يُحدَّد طلاب خاضعون لهذا النموذج بعد
                    {backOffice ? (
                      <>
                        {" — "}
                        <button
                          onClick={() => setTab("subjects")}
                          className="font-bold text-primary underline-offset-2 hover:underline"
                        >
                          حدّدهم من تبويب «الطلاب الخاضعون»
                        </button>
                        .
                      </>
                    ) : (
                      " — راجع الإدارة لتحديدهم."
                    )}
                  </p>
                ) : student ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-primary bg-primary-soft/40 p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{student.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {student.group ?? "بدون شعبة"}
                      </p>
                    </div>
                    <button
                      onClick={() => setStudent(null)}
                      className="shrink-0 rounded-lg border border-border bg-card px-2 py-1 text-[11px] hover:bg-secondary"
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
                      <Input
                        className="ps-7"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ابحث باسم الطالب أو رقمه…"
                      />
                    </div>
                    <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-border">
                      {(studentList.data?.students ?? []).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setStudent({ id: s.id, name: s.name, group: s.group })}
                          className="flex w-full items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-right last:border-0 hover:bg-secondary"
                        >
                          <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-xs">{s.name}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {s.groupLabel || s.id}
                          </span>
                        </button>
                      ))}
                      {studentList.isLoading && (
                        <p className="p-3 text-center text-xs text-muted-foreground">
                          جارِ التحميل…
                        </p>
                      )}
                      {studentList.data?.students.length === 0 && (
                        <p className="p-3 text-center text-xs text-muted-foreground">
                          {search ? "لا توجد نتائج" : "لا يوجد من طلابك من يخضع لهذا النموذج"}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </SectionCard>

          {templateName && student && (
            <SectionCard
              title={template.data?.title ?? "النموذج"}
              description={template.data?.description || "عبّئ الحقول ثم احفظ"}
              actions={
                <div className="flex items-center gap-2">
                  {entryName && (
                    <button
                      onClick={() => void print()}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                    >
                      <Printer className="size-3.5" />
                      طباعة
                    </button>
                  )}
                  <button
                    onClick={() => submit("مسودة")}
                    disabled={saveEntry.isPending}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    حفظ كمسودة
                  </button>
                  <button
                    onClick={() => submit("مكتمل")}
                    disabled={saveEntry.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="size-3.5" />
                    حفظ مكتملاً
                  </button>
                </div>
              }
            >
              {template.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">جارِ التحميل…</p>
              ) : (
                <>
                  <FormBody
                    fields={template.data?.fields ?? []}
                    values={values}
                    onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
                  />
                  <div className="mt-4">
                    <p className="mb-1 text-[11px] text-muted-foreground">ملاحظات عامة</p>
                    <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {/* --- Filled records --------------------------------------------- */}
      {tab === "records" && (
        <div className="mt-5">
          <SectionCard
            title="النماذج المعبّأة"
            description="افتح نموذجاً لعرضه أو تعديله أو طباعته"
          >
            {entries.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">جارِ التحميل…</p>
            ) : (entries.data?.entries.length ?? 0) === 0 ? (
              <EmptyBlock
                title="لا توجد نماذج معبّأة بعد"
                description="عبّئ نموذجاً من التبويب الأول."
                icon={<FileText className="size-6" />}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-2 pl-4 font-medium">النموذج</th>
                      <th className="py-2 pl-4 font-medium">الطالب</th>
                      <th className="py-2 pl-4 font-medium">الحالة</th>
                      <th className="py-2 pl-4 font-medium">التاريخ</th>
                      <th className="py-2 pl-4 font-medium">عبّأه</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(entries.data?.entries ?? []).map((e) => (
                      <tr key={e.name} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pl-4">{e.templateTitle}</td>
                        <td className="py-2 pl-4">{e.studentName}</td>
                        <td className="py-2 pl-4">
                          <Pill tone={e.status === "مكتمل" ? "success" : "warning"}>
                            {e.status}
                          </Pill>
                        </td>
                        <td className="whitespace-nowrap py-2 pl-4 text-xs text-muted-foreground">
                          {when(e.filledOn)}
                        </td>
                        <td className="py-2 pl-4 text-xs text-muted-foreground">{e.filledBy}</td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEntryName(e.name)}
                              className="rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-secondary"
                            >
                              فتح
                            </button>
                            <button
                              onClick={() =>
                                void printFormEntry(e.name).catch(() =>
                                  toast.error("تعذّرت الطباعة"),
                                )
                              }
                              className="rounded p-1 text-muted-foreground hover:bg-secondary"
                              title="طباعة"
                            >
                              <Printer className="size-3.5" />
                            </button>
                            {backOffice && (
                              <button
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: "حذف النموذج المعبّأ",
                                    description: `سيُحذف نموذج «${e.templateTitle}» للطالب ${e.studentName}.`,
                                    confirmLabel: "حذف",
                                  });
                                  if (!ok) return;
                                  deleteEntry.mutate(e.name, {
                                    onSuccess: () => toast.success("تم الحذف"),
                                    onError: (err) => toast.error(errorMessage(err, "تعذّر الحذف")),
                                  });
                                }}
                                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* --- Subject students ------------------------------------------ */}
      {tab === "subjects" && backOffice && (
        <div className="mt-5">
          <FormSubjects templates={rows} />
        </div>
      )}

      {/* --- Manage ------------------------------------------------------ */}
      {tab === "manage" && backOffice && (
        <div className="mt-5">
          {!designing && (
            <div className="mb-4">
              <SectionCard title="إعدادات القسم" description="من يُسمح له بتعبئة نماذج هذا القسم">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={teachersMayFill}
                    onChange={(e) =>
                      setSettings.mutate(
                        { category, teachers_may_fill: e.target.checked },
                        {
                          onSuccess: (res) =>
                            toast.success(
                              res.teachersMayFill
                                ? "أصبح بإمكان المعلمين تعبئة نماذج هذا القسم"
                                : "تعبئة نماذج هذا القسم صارت مقصورة على الإدارة",
                            ),
                          onError: (err) => toast.error(errorMessage(err, "تعذّر حفظ الإعداد")),
                        },
                      )
                    }
                  />
                  السماح للمعلمين بتعبئة نماذج{" "}
                  {FORM_CATEGORIES[category]?.replace("نماذج ", "") ?? ""}
                </label>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  تصميم النماذج يبقى للإدارة في كل الأحوال. المعلم يرى النماذج المعبّأة لطلابه فقط.
                </p>
              </SectionCard>
            </div>
          )}
          {designing ? (
            <FormDesigner
              category={category}
              template={editing ? (editTemplate.data ?? null) : null}
              onSaved={() => {
                void templates.refetch();
                setDesigning(false);
                setEditing(null);
              }}
              onCancel={() => {
                setDesigning(false);
                setEditing(null);
              }}
            />
          ) : (
            <SectionCard
              title="النماذج"
              description="صمّم الحقول وترتيبها وتصميم الطباعة لكل نموذج"
              actions={
                <button
                  onClick={() => {
                    setEditing(null);
                    setDesigning(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                >
                  <Plus className="size-3.5" />
                  نموذج جديد
                </button>
              }
            >
              {rows.length === 0 ? (
                <EmptyBlock
                  title="لا توجد نماذج في هذا القسم"
                  description="أنشئ النموذج الأول وحدّد حقوله."
                  icon={<ClipboardList className="size-6" />}
                />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((t) => (
                    <div key={t.name} className="rounded-xl border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{t.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {t.description || "بدون وصف"}
                          </p>
                        </div>
                        {!t.isActive && <Pill tone="muted">معطّل</Pill>}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {t.fields} حقل · {t.subjects ?? 0} طالب خاضع · {t.entries} نموذج معبّأ
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditing({ name: t.name } as FormTemplate);
                            setDesigning(true);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-secondary"
                        >
                          <Pencil className="size-3" />
                          تعديل
                        </button>
                        <button
                          onClick={() =>
                            duplicate.mutate(t.name, {
                              onSuccess: () => toast.success("تم النسخ"),
                              onError: (e) => toast.error(errorMessage(e, "تعذّر النسخ")),
                            })
                          }
                          className="rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-secondary"
                        >
                          نسخة
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: "حذف النموذج",
                              description: `سيُحذف «${t.title}» نهائياً.`,
                              confirmLabel: "حذف",
                            });
                            if (!ok) return;
                            deleteTemplate.mutate(t.name, {
                              onSuccess: () => toast.success("تم الحذف"),
                              onError: (e) => toast.error(errorMessage(e, "تعذّر الحذف")),
                            });
                          }}
                          className="ms-auto rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="حذف"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}

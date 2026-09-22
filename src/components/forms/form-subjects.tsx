import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, UserPlus, Users } from "lucide-react";
import { Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/error-message";
import {
  useFormStudents,
  useFormSubjects,
  useMyGroups,
  useSetFormSubjects,
  type FormTemplateRow,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

/**
 * «الطلاب الخاضعون» — which students each form applies to. Filling a form
 * offers only these students; removing one keeps what was already filed.
 */
export function FormSubjects({ templates }: { templates: FormTemplateRow[] }) {
  const confirm = useConfirm();
  const [template, setTemplate] = useState("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const subjects = useFormSubjects(template || undefined);
  const candidates = useFormStudents(search);
  const groups = useMyGroups(Boolean(template));
  const save = useSetFormSubjects();

  const current = useMemo(() => subjects.data?.students ?? [], [subjects.data]);
  const inForm = useMemo(() => new Set(current.map((s) => s.id)), [current]);
  const shown = useMemo(() => {
    const q = filter.trim();
    if (!q) return current;
    return current.filter(
      (s) => s.name.includes(q) || s.id.includes(q) || s.groupLabel.includes(q),
    );
  }, [current, filter]);
  const chosen = templates.find((t) => t.name === template);

  function run(vars: { add?: string[]; remove?: string[]; add_group?: string }, done?: () => void) {
    save.mutate(
      { template, ...vars },
      {
        onSuccess: (res) => {
          const parts = [];
          if (res.added) parts.push(`أُضيف ${res.added}`);
          if (res.removed) parts.push(`أُزيل ${res.removed}`);
          toast.success(`${parts.join(" و") || "لا تغيير"} — المجموع ${res.total} طالب`);
          done?.();
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر الحفظ")),
      },
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="النموذج"
        description="اختر النموذج، ثم حدّد الطلاب الخاضعين له. عند التعبئة لا يظهر إلا هؤلاء الطلاب."
      >
        {templates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            لا توجد نماذج في هذا القسم — أنشئ نموذجاً من «إدارة النماذج».
          </p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  setTemplate(t.name);
                  setPicked(new Set());
                  setFilter("");
                }}
                className={cn(
                  "rounded-xl border p-2.5 text-right transition-colors",
                  template === t.name
                    ? "border-primary bg-primary-soft/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">{t.title}</p>
                  {!t.isActive && <Pill tone="muted">معطّل</Pill>}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t.subjects ?? 0} طالب خاضع · {t.entries} معبّأ
                </p>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {template && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* --- Current subjects ------------------------------------------ */}
          <SectionCard
            title={`الخاضعون لـ«${chosen?.title ?? ""}» (${current.length})`}
            description="إزالة الطالب لا تحذف النماذج المعبّأة له سابقاً"
          >
            <div className="relative mb-2">
              <Search className="absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
              <Input
                className="ps-7"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="تصفية بالاسم أو الرقم أو الشعبة…"
              />
            </div>
            {subjects.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">جارِ التحميل…</p>
            ) : current.length === 0 ? (
              <EmptyBlock
                title="لا يوجد طلاب خاضعون بعد"
                description="أضف طلاباً أو شعبة كاملة من القائمة المجاورة."
                icon={<Users className="size-6" />}
              />
            ) : (
              <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-border">
                {shown.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{s.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {s.groupLabel || "بدون شعبة"} · {s.id}
                      </p>
                    </div>
                    {s.entries > 0 && <Pill tone="success">{s.entries} معبّأ</Pill>}
                    <button
                      disabled={save.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "إزالة الطالب من النموذج",
                          description: `لن يظهر ${s.name} عند تعبئة هذا النموذج.${
                            s.entries ? " النماذج المعبّأة له تبقى محفوظة." : ""
                          }`,
                          confirmLabel: "إزالة",
                        });
                        if (ok) run({ remove: [s.id] });
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      title="إزالة"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
                {shown.length === 0 && (
                  <p className="p-3 text-center text-xs text-muted-foreground">لا توجد نتائج</p>
                )}
              </div>
            )}
          </SectionCard>

          {/* --- Adding ---------------------------------------------------- */}
          <SectionCard title="إضافة طلاب" description="شعبة كاملة دفعة واحدة، أو طلاب بعينهم">
            <p className="mb-1.5 text-[11px] text-muted-foreground">إضافة شعبة كاملة</p>
            <div className="flex gap-2">
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">اختر الشعبة…</option>
                {(groups.data ?? []).map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.student_group_name || g.name} ({g.students})
                  </option>
                ))}
              </select>
              <button
                disabled={!group || save.isPending}
                onClick={() => run({ add_group: group }, () => setGroup(""))}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Users className="size-3.5" />
                إضافة الشعبة
              </button>
            </div>

            <p className="mb-1.5 mt-4 text-[11px] text-muted-foreground">إضافة طلاب بعينهم</p>
            <div className="relative">
              <Search className="absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
              <Input
                className="ps-7"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم الطالب أو رقمه…"
              />
            </div>
            <div className="mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border">
              {(candidates.data?.students ?? []).map((s) => {
                const already = inForm.has(s.id);
                return (
                  <label
                    key={s.id}
                    className={cn(
                      "flex w-full items-center gap-2 border-b border-border/60 px-2.5 py-1.5 last:border-0",
                      already ? "opacity-50" : "cursor-pointer hover:bg-secondary",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[var(--primary)]"
                      disabled={already}
                      checked={already || picked.has(s.id)}
                      onChange={(e) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-xs">{s.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {already ? "مضاف" : s.groupLabel || s.id}
                    </span>
                  </label>
                );
              })}
              {candidates.data?.students.length === 0 && (
                <p className="p-3 text-center text-xs text-muted-foreground">لا توجد نتائج</p>
              )}
            </div>
            <button
              disabled={picked.size === 0 || save.isPending}
              onClick={() => run({ add: [...picked] }, () => setPicked(new Set()))}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <UserPlus className="size-3.5" />
              إضافة المحدّدين ({picked.size})
            </button>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, Save, Search, UserRound } from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";
import { errorMessage } from "@/lib/api/error-message";
import {
  useSaveWorkspaceLayout,
  useWorkspaceLayoutFor,
  useWorkspaceLayoutUsers,
  type WorkspaceLayout,
} from "@/lib/api/hooks";
import { groupFor, groupsForRole, labelFor, navForRole } from "@/lib/nav";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/workspace-setup")({
  head: () => ({
    meta: [
      { title: "تخصيص مساحة العمل — Match Education" },
      {
        name: "description",
        content: "تحديد ما يظهر في مساحة عمل كل مستخدم: الأقسام والشاشات وبطاقات الأرقام.",
      },
    ],
  }),
  component: WorkspaceSetupPage,
});

/**
 * Arrange one person's workspace.
 *
 * The default is the whole role's screen, which is right until it isn't: one
 * secretary runs admissions and another runs fees, and each reads past half
 * the page. Nothing is stored until something is actually changed — a user
 * with no arrangement keeps following the default as it grows.
 */
function WorkspaceSetupPage() {
  const { role } = useApp();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [user, setUser] = useState("");
  const users = useWorkspaceLayoutUsers(search);
  const target = useWorkspaceLayoutFor(user || undefined);
  const save = useSaveWorkspaceLayout();

  const [draft, setDraft] = useState<WorkspaceLayout>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(target.data?.layout ?? {});
    setDirty(false);
  }, [target.data]);

  const targetRole = (target.data?.persona ?? "admin") as Role;
  const items = useMemo(() => navForRole(targetRole), [targetRole]);
  const groups = useMemo(() => {
    const all = groupsForRole(targetRole);
    const order = draft.groupOrder ?? [];
    if (!order.length) return all;
    return [...all].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? order.length + all.indexOf(a) : ai) -
        (bi === -1 ? order.length + all.indexOf(b) : bi);
    });
  }, [targetRole, draft.groupOrder]);

  const hiddenGroups = new Set(draft.hiddenGroups ?? []);
  const hiddenItems = new Set(draft.hiddenItems ?? []);
  const hiddenCards = new Set(draft.hiddenCards ?? []);

  function change(next: WorkspaceLayout) {
    setDraft(next);
    setDirty(true);
  }

  const toggle = (key: keyof WorkspaceLayout, value: string) => {
    const list = new Set(draft[key] as string[] | undefined);
    if (list.has(value)) list.delete(value);
    else list.add(value);
    change({ ...draft, [key]: [...list] });
  };

  function moveGroup(group: string, by: number) {
    const order = draft.groupOrder?.length ? [...draft.groupOrder] : [...groups];
    const at = order.indexOf(group);
    const to = at + by;
    if (at === -1 || to < 0 || to >= order.length) return;
    order.splice(to, 0, ...order.splice(at, 1));
    change({ ...draft, groupOrder: order });
  }

  function persist() {
    if (!user) return;
    save.mutate(
      { user, layout: draft },
      {
        onSuccess: (res) => {
          setDirty(false);
          toast.success(
            res.reset ? "أُعيد المستخدم إلى الوضع التلقائي" : "تم حفظ مساحة عمل المستخدم",
          );
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر الحفظ")),
      },
    );
  }

  async function reset() {
    const ok = await confirm({
      title: "إعادة الوضع التلقائي",
      description: "سيعود هذا المستخدم إلى مساحة العمل الافتراضية لدوره.",
      confirmLabel: "إعادة",
    });
    if (!ok) return;
    setDraft({});
    save.mutate(
      { user, layout: {} },
      {
        onSuccess: () => {
          setDirty(false);
          toast.success("أُعيد إلى الوضع التلقائي");
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر الإرجاع")),
      },
    );
  }

  if (role !== "admin") {
    return (
      <EmptyBlock
        title="هذه الشاشة للمدير فقط"
        description="تخصيص مساحات العمل من صلاحيات مدير المدرسة."
        icon={<EyeOff className="size-6" />}
      />
    );
  }
  if (users.isLoading) return <DashboardSkeleton />;
  if (users.error) return <ErrorState error={users.error} onRetry={() => users.refetch()} />;

  const hiddenCount =
    (draft.hiddenGroups?.length ?? 0) +
    (draft.hiddenItems?.length ?? 0) +
    (draft.hiddenCards?.length ?? 0);

  return (
    <>
      <PageHeader
        title="تخصيص مساحة العمل"
        subtitle="اختر مستخدماً، ثم حدّد الأقسام والشاشات وبطاقات الأرقام التي تظهر له"
        actions={
          user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => void reset()}
                disabled={save.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" />
                الوضع التلقائي
              </button>
              <button
                onClick={persist}
                disabled={save.isPending || !dirty}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save className="size-3.5" />
                حفظ
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Who ----------------------------------------------------------- */}
        <SectionCard title="المستخدمون" description="المستخدمون الذين لهم دور في النظام">
          <div className="relative mb-2">
            <Search className="absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
            <Input
              className="ps-7"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم…"
            />
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {(users.data?.users ?? []).map((u) => (
              <button
                key={u.user}
                onClick={async () => {
                  if (
                    dirty &&
                    !(await confirm({
                      title: "تغييرات غير محفوظة",
                      description: "الانتقال لمستخدم آخر سيُلغي التعديلات الحالية.",
                      confirmLabel: "تجاهل",
                    }))
                  ) {
                    return;
                  }
                  setUser(u.user);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right transition-colors",
                  user === u.user ? "bg-primary-soft/60" : "hover:bg-secondary",
                )}
              >
                <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{u.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {u.personaLabel}
                  </span>
                </span>
                {u.customised && <Pill tone="info">مخصّص</Pill>}
              </button>
            ))}
            {(users.data?.users.length ?? 0) === 0 && (
              <p className="p-3 text-center text-xs text-muted-foreground">لا توجد نتائج</p>
            )}
          </div>
        </SectionCard>

        {/* What they see -------------------------------------------------- */}
        <div className="space-y-4">
          {!user ? (
            <EmptyBlock
              title="اختر مستخدماً"
              description="اختر مستخدماً من القائمة لتحديد ما يظهر في مساحة عمله."
              icon={<UserRound className="size-6" />}
            />
          ) : target.isLoading ? (
            <DashboardSkeleton />
          ) : target.error ? (
            <ErrorState error={target.error} onRetry={() => target.refetch()} />
          ) : (
            <>
              <SectionCard
                title="بطاقات الأرقام"
                description="البطاقات التي تظهر أعلى مساحة العمل"
                actions={
                  hiddenCount > 0 ? <Pill tone="warning">{hiddenCount} عنصر مخفي</Pill> : undefined
                }
              >
                <div className="flex flex-wrap gap-1.5">
                  {(target.data?.cards ?? []).map((c) => {
                    const hidden = hiddenCards.has(c.key);
                    return (
                      <button
                        key={c.key}
                        onClick={() => toggle("hiddenCards", c.key)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                          hidden
                            ? "border-dashed border-border text-muted-foreground line-through"
                            : "border-primary/40 bg-primary-soft/40 font-medium text-primary",
                        )}
                      >
                        {hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        {c.label}
                      </button>
                    );
                  })}
                  {(target.data?.cards.length ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground">لا توجد بطاقات لهذا الدور.</p>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="الأقسام والشاشات"
                description="أخفِ قسماً كاملاً، أو شاشات بعينها داخله، ورتّب الأقسام"
              >
                <div className="space-y-2">
                  {groups.map((group, index) => {
                    const groupItems = items.filter((i) => groupFor(i, targetRole) === group);
                    if (!groupItems.length) return null;
                    const groupHidden = hiddenGroups.has(group);
                    return (
                      <div
                        key={group}
                        className={cn(
                          "rounded-xl border p-2.5",
                          groupHidden ? "border-dashed border-border bg-secondary/30" : "border-border",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggle("hiddenGroups", group)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold transition-colors",
                              groupHidden
                                ? "text-muted-foreground line-through hover:bg-secondary"
                                : "text-primary hover:bg-primary-soft/40",
                            )}
                          >
                            {groupHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            {group}
                          </button>
                          <span className="text-[11px] text-muted-foreground">
                            {groupItems.length} شاشة
                          </span>
                          <div className="ms-auto flex items-center gap-1">
                            <button
                              onClick={() => moveGroup(group, -1)}
                              disabled={index === 0}
                              className="rounded p-1 hover:bg-secondary disabled:opacity-30"
                              title="أعلى"
                            >
                              <ArrowUp className="size-3.5" />
                            </button>
                            <button
                              onClick={() => moveGroup(group, 1)}
                              disabled={index === groups.length - 1}
                              className="rounded p-1 hover:bg-secondary disabled:opacity-30"
                              title="أسفل"
                            >
                              <ArrowDown className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        {!groupHidden && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {groupItems.map((item) => {
                              const hidden = hiddenItems.has(item.to);
                              return (
                                <button
                                  key={item.to}
                                  onClick={() => toggle("hiddenItems", item.to)}
                                  className={cn(
                                    "rounded-lg border px-2 py-1 text-[11px] transition-colors",
                                    hidden
                                      ? "border-dashed border-border text-muted-foreground line-through"
                                      : "border-border hover:border-primary/40 hover:bg-primary-soft/30",
                                  )}
                                >
                                  {labelFor(item, targetRole)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 rounded-lg bg-secondary/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  ما تخفيه هنا يخصّ مساحة عمل هذا المستخدم فقط، ولا يغيّر صلاحياته: الشاشة المخفية
                  تختفي من مساحة عمله، ويبقى وصوله إليها من القائمة الجانبية كما هو. المستخدم بلا
                  تخصيص يتبع الوضع التلقائي لدوره، ويستفيد تلقائياً من أي شاشة تُضاف للنظام لاحقاً.
                </p>
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </>
  );
}

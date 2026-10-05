import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  FileText,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import {
  useMyWorkspaces,
  usePageBuilderOptions,
  usePageList,
  useSaveAssignment,
  useWorkspaceAssignments,
  useWorkspaceFromCategory,
  useWorkspaceList,
  type UserAssignment,
  type WorkspaceRow,
} from "@/lib/api/workspaces";
import { roleLabels } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { wsColor, wsIcon } from "@/lib/workspace-icons";

export const Route = createFileRoute("/app/workspaces/")({
  head: () => ({
    meta: [
      { title: "مساحات العمل والصفحات — Match Education" },
      {
        name: "description",
        content: "بناء مساحات العمل وأزرارها، والصفحات المبنية من النماذج، وإسنادها للمستخدمين.",
      },
    ],
  }),
  component: WorkspacesAdmin,
});

type Tab = "workspaces" | "pages" | "users";

/**
 * Where the Administrator builds workspaces and pages and hands them out.
 * Everyone else is told so plainly: these decide what a whole school works
 * from, so the account that builds them is one.
 */
function WorkspacesAdmin() {
  const mine = useMyWorkspaces();
  const [tab, setTab] = useState<Tab>("workspaces");

  if (mine.isLoading) return <DashboardSkeleton />;
  if (!mine.data?.canBuild) {
    return (
      <EmptyBlock
        title="هذه الشاشة لحساب Administrator فقط"
        description="بناء مساحات العمل والصفحات وإسنادها للمستخدمين من صلاحيات حساب Administrator."
        icon={<ShieldCheck className="size-6" />}
      />
    );
  }

  const tabs: Array<{ key: Tab; label: string; icon: typeof LayoutGrid }> = [
    { key: "workspaces", label: "مساحات العمل", icon: LayoutGrid },
    { key: "pages", label: "الصفحات", icon: FileText },
    { key: "users", label: "المستخدمون", icon: Users },
  ];

  return (
    <>
      <PageHeader
        title="مساحات العمل والصفحات"
        subtitle="ابنِ مساحة عمل لكل قسم، وصفحة لكل نموذج، ثم أسندها لمن يعمل بها"
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
      <div className="mt-5">
        {tab === "workspaces" ? <WorkspacesTab /> : tab === "pages" ? <PagesTab /> : <UsersTab />}
      </div>
    </>
  );
}

// --- مساحات العمل ------------------------------------------------------------------

function WorkspacesTab() {
  const list = useWorkspaceList();
  const [fromFile, setFromFile] = useState(false);

  if (list.isLoading) return <DashboardSkeleton />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const rows = list.data?.workspaces ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/app/workspaces/$workspaceId"
          params={{ workspaceId: "new" }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" />
          مساحة عمل جديدة
        </Link>
        <button
          onClick={() => setFromFile(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-medium hover:bg-secondary"
          title="صفحة لكل نموذج في القسم، ومساحة عمل بزر لكل صفحة"
        >
          <Sparkles className="size-4 text-primary" />
          مساحة عمل من قسم نماذج
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyBlock
          title="لا مساحات عمل بعد"
          description="كل مستخدم يعمل الآن من القائمة الأساسية لدوره. أنشئ مساحة عمل لقسم — الإرشاد مثلاً — وأسندها لمن يعمل فيه."
          icon={<LayoutGrid className="size-6" />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((w) => (
            <WorkspaceCard key={w.id} w={w} />
          ))}
        </div>
      )}
      <FromCategoryDialog open={fromFile} onClose={() => setFromFile(false)} />
    </div>
  );
}

function WorkspaceCard({ w }: { w: WorkspaceRow }) {
  const Icon = wsIcon(w.icon);
  return (
    <Link
      to="/app/workspaces/$workspaceId"
      params={{ workspaceId: w.id }}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40",
        w.isActive ? "border-border" : "border-dashed border-border opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            wsColor(w.color).tile,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{w.title}</p>
          <p className="line-clamp-2 text-[11px] text-muted-foreground">
            {w.description || "بلا وصف"}
          </p>
        </div>
        <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <Pill tone="muted">{w.buttons} زر</Pill>
        <Pill tone={w.users ? "info" : "muted"}>{w.users ?? 0} مستخدم</Pill>
        {w.personas.map((p) => (
          <Pill key={p} tone="primary">
            كل {roleLabels[p]}
          </Pill>
        ))}
        {!w.isActive && <Pill tone="warning">موقوفة</Pill>}
      </div>
    </Link>
  );
}

function FromCategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const options = usePageBuilderOptions();
  const create = useWorkspaceFromCategory();
  const navigate = useNavigate();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const templates = (options.data?.templates ?? []).filter(
    (t) => t.category === category && t.isActive,
  );

  function go() {
    if (!category) {
      toast.error("اختر قسم النماذج");
      return;
    }
    create.mutate(
      { category, ...(title.trim() ? { title: title.trim() } : {}) },
      {
        onSuccess: (res) => {
          toast.success(
            `أُنشئت مساحة العمل — ${res.pagesCreated} صفحة جديدة من ${res.pages} نموذج`,
          );
          onClose();
          void navigate({ to: "/app/workspaces/$workspaceId", params: { workspaceId: res.id } });
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر الإنشاء")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>مساحة عمل من قسم نماذج</DialogTitle>
        </DialogHeader>
        <p className="text-xs leading-relaxed text-muted-foreground">
          تُنشأ صفحة مستقلة لكل نموذج مفعّل في القسم (تعبئة، قائمة بالمعبّأ، فلاتر، طباعة)، ثم مساحة
          عمل فيها زر لكل صفحة. الحقول التي يُعرف مصدرها — اسم الطالب، الصف، تاريخ الميلاد، ولي
          الأمر، التاريخ — تُضبط لتُجلب تلقائياً، ويمكن تعديل كل ذلك بعدها.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(options.data?.categories ?? []).map((c) => {
            const n = (options.data?.templates ?? []).filter(
              (t) => t.category === c.key && t.isActive,
            ).length;
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={cn(
                  "rounded-xl border p-2.5 text-right transition-colors",
                  category === c.key
                    ? "border-primary bg-primary-soft/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                <p className="text-sm font-bold">{c.label}</p>
                <p className="text-[11px] text-muted-foreground">{n} نموذج مفعّل</p>
              </button>
            );
          })}
        </div>
        {category && (
          <>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`اسم مساحة العمل (افتراضياً: قسم ${options.data?.categories.find((c) => c.key === category)?.label ?? ""})`}
            />
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-secondary/40 p-2.5 text-xs">
              {templates.map((t) => (
                <li key={t.name} className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.pages.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">له صفحة</span>
                  )}
                </li>
              ))}
              {templates.length === 0 && (
                <li className="text-muted-foreground">لا نماذج مفعّلة.</li>
              )}
            </ul>
          </>
        )}
        <DialogFooter>
          <button
            onClick={go}
            disabled={create.isPending || !category || templates.length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {create.isPending ? "جارِ الإنشاء…" : "إنشاء"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- الصفحات ---------------------------------------------------------------------

function PagesTab() {
  const pages = usePageList();
  if (pages.isLoading) return <DashboardSkeleton />;
  if (pages.error) return <ErrorState error={pages.error} onRetry={() => pages.refetch()} />;
  const rows = pages.data?.pages ?? [];
  return (
    <div className="space-y-4">
      <Link
        to="/app/custom-pages/$pageId"
        params={{ pageId: "new" }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
      >
        <Plus className="size-4" />
        صفحة جديدة من نموذج
      </Link>
      {rows.length === 0 ? (
        <EmptyBlock
          title="لا صفحات بعد"
          description="الصفحة تُبنى من نموذج: قائمة بما عُبّئ، وزر تعبئة، وفلاتر، وطباعة — بلا برمجة."
          icon={<FileText className="size-6" />}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-[11px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-right font-bold">الصفحة</th>
                <th className="px-3 py-2.5 text-right font-bold">النموذج</th>
                <th className="px-3 py-2.5 text-right font-bold">القسم</th>
                <th className="px-3 py-2.5 text-right font-bold">من يفتحها</th>
                <th className="px-3 py-2.5 text-right font-bold">المعبّأ</th>
                <th className="px-3 py-2.5 text-right font-bold">الحالة</th>
                <th className="w-px px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const Icon = wsIcon(p.icon, FileText);
                return (
                  <tr key={p.id} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <Link
                        to="/app/custom-pages/$pageId"
                        params={{ pageId: p.id }}
                        className="flex items-center gap-2 font-semibold hover:text-primary"
                      >
                        <span
                          className={cn(
                            "grid size-7 place-items-center rounded-lg",
                            wsColor(p.color).tile,
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">{p.templateTitle || "—"}</td>
                    <td className="px-3 py-2 text-xs">{p.categoryLabel || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {p.personas.map((r) => roleLabels[r]).join("، ")}
                    </td>
                    <td className="num px-3 py-2 text-xs">{p.entries}</td>
                    <td className="px-3 py-2">
                      <Pill tone={p.isActive ? "success" : "warning"}>
                        {p.isActive ? "فعّالة" : "موقوفة"}
                      </Pill>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Link
                          to="/app/custom-pages/$pageId"
                          params={{ pageId: p.id }}
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                          title="تعديل"
                        >
                          <Pencil className="size-3.5" />
                        </Link>
                        <Link
                          to="/app/p/$pageId"
                          params={{ pageId: p.id }}
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                          title="فتح الصفحة"
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- المستخدمون --------------------------------------------------------------------

function UsersTab() {
  const [search, setSearch] = useState("");
  const users = useWorkspaceAssignments(search.trim());
  const list = useWorkspaceList();
  const [editing, setEditing] = useState<UserAssignment | null>(null);
  const titles = Object.fromEntries((list.data?.workspaces ?? []).map((w) => [w.id, w.title]));

  return (
    <SectionCard
      title="مساحات عمل المستخدمين"
      description="لكل مستخدم: مساحات العمل التي يتنقّل بينها، والتي يبدأ بها عند الدخول"
    >
      <div className="relative mb-3 max-w-sm">
        <Search className="absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
        <Input
          className="ps-7"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو البريد…"
        />
      </div>
      {users.isLoading ? (
        <DashboardSkeleton />
      ) : users.error ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-[11px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-right font-bold">المستخدم</th>
                <th className="px-3 py-2 text-right font-bold">الدور</th>
                <th className="px-3 py-2 text-right font-bold">مساحات العمل</th>
                <th className="px-3 py-2 text-right font-bold">يبدأ في</th>
                <th className="w-px px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(users.data?.users ?? []).map((u) => (
                <tr key={u.user} className="border-t border-border/70">
                  <td className="px-3 py-2">
                    <p className="text-xs font-semibold">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">
                      {u.user}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs">{u.personaLabel}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.workspaces.map((w) => (
                        <Pill key={w} tone="info">
                          {titles[w] ?? w}
                        </Pill>
                      ))}
                      {u.roleWorkspaces
                        .filter((w) => !u.workspaces.includes(w))
                        .map((w) => (
                          <Pill key={w} tone="muted">
                            {titles[w] ?? w} (بالدور)
                          </Pill>
                        ))}
                      {!u.workspaces.length && !u.roleWorkspaces.length && (
                        <span className="text-[11px] text-muted-foreground">
                          القائمة الأساسية فقط
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {u.default ? (titles[u.default] ?? u.default) : "القائمة الأساسية"}
                    {u.hideSystem ? (
                      <span className="block text-[10px] text-muted-foreground">
                        القائمة الأساسية مخفية
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setEditing(u)}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary"
                    >
                      <Pencil className="size-3" />
                      تعديل
                    </button>
                  </td>
                </tr>
              ))}
              {(users.data?.users.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">
                    لا نتائج
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <AssignmentDialog
          user={editing}
          workspaces={list.data?.workspaces ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </SectionCard>
  );
}

function AssignmentDialog({
  user,
  workspaces,
  onClose,
}: {
  user: UserAssignment;
  workspaces: WorkspaceRow[];
  onClose: () => void;
}) {
  const save = useSaveAssignment();
  const [chosen, setChosen] = useState<string[]>(user.workspaces);
  const [def, setDef] = useState(user.default);
  const [hide, setHide] = useState(!!user.hideSystem);
  const reachable = new Set([...chosen, ...user.roleWorkspaces]);
  const ordered = workspaces.filter((w) => reachable.has(w.id));

  function toggle(id: string) {
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (def === id && chosen.includes(id) && !user.roleWorkspaces.includes(id)) setDef("");
  }

  function persist() {
    save.mutate(
      { user: user.user, workspaces: chosen, default: def, hideSystem: hide },
      {
        onSuccess: () => {
          toast.success("تم حفظ مساحات عمل المستخدم");
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر الحفظ")),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-4" />
            {user.name}
            <span className="text-xs font-normal text-muted-foreground">· {user.personaLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <div>
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">مساحات العمل المسندة</p>
          {workspaces.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا مساحات عمل بعد — أنشئ واحدة أولاً.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {workspaces.map((w) => {
                const byRole = user.roleWorkspaces.includes(w.id);
                const on = chosen.includes(w.id) || byRole;
                const Icon = wsIcon(w.icon);
                return (
                  <button
                    key={w.id}
                    disabled={byRole}
                    onClick={() => toggle(w.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-2 text-right text-xs transition-colors disabled:cursor-default",
                      on
                        ? "border-primary bg-primary-soft/40"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg",
                        wsColor(w.color).tile,
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{w.title}</span>
                    {byRole && <span className="text-[10px] text-muted-foreground">بالدور</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">يبدأ عند الدخول في</p>
          <div className="flex flex-wrap gap-1.5">
            {!hide && (
              <button
                onClick={() => setDef("")}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs",
                  def === ""
                    ? "border-primary bg-primary-soft/50 font-bold text-primary"
                    : "border-border",
                )}
              >
                القائمة الأساسية
              </button>
            )}
            {ordered.map((w) => (
              <button
                key={w.id}
                onClick={() => setDef(w.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs",
                  def === w.id
                    ? "border-primary bg-primary-soft/50 font-bold text-primary"
                    : "border-border",
                )}
              >
                {w.title}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border p-3">
          <Switch
            checked={hide}
            disabled={reachable.size === 0}
            onCheckedChange={(v) => {
              setHide(v);
              if (v && def === "" && ordered[0]) setDef(ordered[0].id);
            }}
          />
          <span className="text-xs leading-relaxed">
            <span className="block font-bold">إخفاء القائمة الأساسية</span>
            <span className="text-muted-foreground">
              يعمل المستخدم من مساحات العمل المسندة فقط. صلاحياته لا تتغيّر — هذا ترتيب لما يراه، لا
              منعٌ لما يحق له.
            </span>
          </span>
        </label>

        <DialogFooter>
          <button
            onClick={persist}
            disabled={save.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            حفظ
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Eye,
  FileText,
  Hash,
  LayoutGrid,
  Link2,
  List,
  Monitor,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColorPicker, IconPicker } from "@/components/workspaces/pickers";
import { resolveItem, WorkspaceView } from "@/components/workspaces/workspace-view";
import { errorMessage } from "@/lib/api/error-message";
import {
  useDeleteWorkspace,
  useMyWorkspaces,
  useSaveWorkspace,
  useWorkspaceAssignments,
  useWorkspaceCatalog,
  useWorkspaceDetail,
  type AssignedUser,
  type WorkspacePayload,
  type WsBlock,
  type WsBlockType,
  type WsItem,
  type WsItemKind,
} from "@/lib/api/workspaces";
import { groupFor, labelFor, navItems } from "@/lib/nav";
import { roleLabels, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { wsColor, wsIcon } from "@/lib/workspace-icons";

export const Route = createFileRoute("/app/workspaces/$workspaceId")({
  head: () => ({
    meta: [
      { title: "بناء مساحة عمل — Match Education" },
      { name: "description", content: "أقسام مساحة العمل وأزرارها ومن يعمل بها." },
    ],
  }),
  component: WorkspaceBuilder,
});

const EMPTY: WorkspacePayload = {
  title: "",
  icon: "layout-grid",
  color: "primary",
  description: "",
  isActive: 1,
  sortOrder: 0,
  personas: [],
  layout: { blocks: [] },
};

const BLOCK_META: Record<WsBlockType, { label: string; hint: string; icon: typeof LayoutGrid }> = {
  shortcuts: { label: "أزرار كبيرة", hint: "لما يُفتح كل يوم", icon: LayoutGrid },
  links: { label: "قائمة روابط", hint: "بطاقة بعنوان وروابط تحته", icon: List },
  numbers: { label: "أرقام", hint: "عدّادات حيّة: غياب اليوم، فواتير…", icon: Hash },
  text: { label: "ملاحظة", hint: "نص ثابت: تعليمات، تنبيه", icon: StickyNote },
};

const KIND_LABEL: Record<WsItemKind, string> = {
  screen: "شاشة",
  page: "صفحة",
  url: "رابط خارجي",
};

const ALL_ROLES: Role[] = ["admin", "secretary", "teacher", "student", "parent"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function WorkspaceBuilder() {
  const { workspaceId } = Route.useParams();
  const isNew = workspaceId === "new";
  const mine = useMyWorkspaces();
  const detail = useWorkspaceDetail(isNew ? undefined : workspaceId);

  if (mine.isLoading || (!isNew && detail.isLoading)) return <DashboardSkeleton />;
  if (!mine.data?.canBuild) {
    return (
      <EmptyBlock
        title="هذه الشاشة لحساب Administrator فقط"
        description="بناء مساحات العمل وإسنادها من صلاحيات حساب Administrator."
        icon={<ShieldCheck className="size-6" />}
      />
    );
  }
  if (!isNew && detail.error)
    return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  return (
    <Builder
      key={workspaceId}
      id={isNew ? undefined : workspaceId}
      initial={
        detail.data
          ? {
              id: detail.data.id,
              title: detail.data.title,
              icon: detail.data.icon,
              color: detail.data.color,
              description: detail.data.description,
              isActive: detail.data.isActive,
              sortOrder: detail.data.sortOrder,
              personas: detail.data.personas,
              layout: detail.data.layout,
            }
          : EMPTY
      }
      initialAssigned={detail.data?.assigned ?? []}
    />
  );
}

function Builder({
  id,
  initial,
  initialAssigned,
}: {
  id: string | undefined;
  initial: WorkspacePayload;
  initialAssigned: AssignedUser[];
}) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const catalog = useWorkspaceCatalog();
  const save = useSaveWorkspace();
  const remove = useDeleteWorkspace();
  const [draft, setDraft] = useState<WorkspacePayload>(initial);
  const [assigned, setAssigned] = useState<AssignedUser[]>(initialAssigned);
  const [dirty, setDirty] = useState(!id);
  const [tab, setTab] = useState<"design" | "users" | "preview">("design");
  const [itemDialog, setItemDialog] = useState<{ block: string; item?: WsItem } | null>(null);
  const [previewRole, setPreviewRole] = useState<Role>("admin");

  const pageLabels = useMemo(
    () =>
      Object.fromEntries(
        (catalog.data?.pages ?? []).map((p) => [p.id, { title: p.title, icon: p.icon }]),
      ),
    [catalog.data],
  );

  function change(next: Partial<WorkspacePayload>) {
    setDraft((d) => ({ ...d, ...next }));
    setDirty(true);
  }

  function setBlocks(fn: (blocks: WsBlock[]) => WsBlock[]) {
    setDraft((d) => ({ ...d, layout: { blocks: fn(d.layout.blocks) } }));
    setDirty(true);
  }

  const updateBlock = (bid: string, patch: Partial<WsBlock>) =>
    setBlocks((bs) => bs.map((b) => (b.id === bid ? { ...b, ...patch } : b)));

  function moveIn<T>(list: T[], index: number, by: number): T[] {
    const to = index + by;
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    next.splice(to, 0, ...next.splice(index, 1));
    return next;
  }

  function addBlock(type: WsBlockType) {
    const block: WsBlock = {
      id: uid(),
      type,
      title: "",
      ...(type === "numbers" ? { cards: [] } : type === "text" ? { text: "" } : { items: [] }),
    };
    setBlocks((bs) => [...bs, block]);
  }

  function upsertItem(blockId: string, item: WsItem) {
    setBlocks((bs) =>
      bs.map((b) => {
        if (b.id !== blockId) return b;
        const items = b.items ?? [];
        const at = items.findIndex((i) => i.id === item.id);
        return {
          ...b,
          items: at === -1 ? [...items, item] : items.map((i) => (i.id === item.id ? item : i)),
        };
      }),
    );
  }

  function persist() {
    if (!draft.title.trim()) {
      toast.error("اكتب اسم مساحة العمل");
      return;
    }
    save.mutate(
      {
        ...draft,
        ...(id ? { id } : {}),
        assigned: assigned.map((a) => ({ user: a.user, isDefault: a.isDefault })),
      },
      {
        onSuccess: (res) => {
          setDirty(false);
          setAssigned(res.assigned);
          toast.success("تم حفظ مساحة العمل");
          if (!id) {
            void navigate({
              to: "/app/workspaces/$workspaceId",
              params: { workspaceId: res.id },
              replace: true,
            });
          }
        },
        onError: (e) => toast.error(errorMessage(e, "تعذّر الحفظ")),
      },
    );
  }

  async function del() {
    if (!id) return;
    const ok = await confirm({
      title: "حذف مساحة العمل",
      description:
        "ستُحذف مساحة العمل ويُلغى إسنادها لكل مستخدميها، ويعودون إلى قوائمهم. الصفحات تبقى كما هي.",
      confirmLabel: "حذف",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        toast.success("حُذفت مساحة العمل");
        void navigate({ to: "/app/workspaces" });
      },
      onError: (e) => toast.error(errorMessage(e, "تعذّر الحذف")),
    });
  }

  const tabs = [
    { key: "design" as const, label: "التصميم", icon: LayoutGrid },
    { key: "users" as const, label: `من يعمل بها (${assigned.length})`, icon: Users },
    { key: "preview" as const, label: "معاينة", icon: Eye },
  ];

  return (
    <>
      <PageHeader
        title={id ? draft.title || "مساحة عمل" : "مساحة عمل جديدة"}
        subtitle="الأقسام والأزرار، ومن يعمل بها"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/app/workspaces"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
            >
              <ArrowRight className="size-3.5" />
              كل مساحات العمل
            </Link>
            {id && (
              <>
                <Link
                  to="/app/w/$workspaceId"
                  params={{ workspaceId: id }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
                >
                  <Monitor className="size-3.5" />
                  فتح
                </Link>
                <button
                  onClick={() => void del()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                  حذف
                </button>
              </>
            )}
            <button
              onClick={persist}
              disabled={save.isPending || !dirty}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              {save.isPending ? "جارِ الحفظ…" : "حفظ"}
            </button>
          </div>
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
        {dirty && (
          <span className="ms-auto self-center text-[11px] font-medium text-warning">
            تغييرات غير محفوظة
          </span>
        )}
      </div>

      {tab === "design" && (
        <div className="mt-5 space-y-4">
          <SectionCard
            title="مساحة العمل"
            description="الاسم والأيقونة واللون كما تظهر في التبديل والقائمة"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">الاسم</p>
                  <Input
                    value={draft.title}
                    onChange={(e) => change({ title: e.target.value })}
                    placeholder="مثلاً: قسم الإرشاد"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">الوصف</p>
                  <Textarea
                    rows={2}
                    value={draft.description}
                    onChange={(e) => change({ description: e.target.value })}
                    placeholder="سطر يظهر أعلى مساحة العمل"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <IconPicker
                    value={draft.icon}
                    color={draft.color}
                    onChange={(icon) => change({ icon })}
                  />
                  <ColorPicker value={draft.color} onChange={(color) => change({ color })} />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={!!draft.isActive}
                      onCheckedChange={(v) => change({ isActive: v ? 1 : 0 })}
                    />
                    فعّالة
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    الترتيب
                    <Input
                      type="number"
                      dir="ltr"
                      className="h-8 w-20"
                      value={draft.sortOrder}
                      onChange={(e) => change({ sortOrder: Number(e.target.value) || 0 })}
                    />
                  </label>
                </div>
              </div>
            </div>
          </SectionCard>

          {draft.layout.blocks.map((block, index) => (
            <BlockEditor
              key={block.id}
              block={block}
              index={index}
              count={draft.layout.blocks.length}
              cards={catalog.data?.cards ?? []}
              pageLabels={pageLabels}
              onChange={(patch) => updateBlock(block.id, patch)}
              onMove={(by) => setBlocks((bs) => moveIn(bs, index, by))}
              onRemove={() => setBlocks((bs) => bs.filter((b) => b.id !== block.id))}
              onAddItem={() => setItemDialog({ block: block.id })}
              onEditItem={(item) => setItemDialog({ block: block.id, item })}
              onMoveItem={(i, by) =>
                updateBlock(block.id, { items: moveIn(block.items ?? [], i, by) })
              }
              onRemoveItem={(itemId) =>
                updateBlock(block.id, { items: (block.items ?? []).filter((x) => x.id !== itemId) })
              }
            />
          ))}

          <div className="rounded-2xl border border-dashed border-border p-4">
            <p className="mb-2.5 text-xs font-bold text-muted-foreground">أضف قسماً</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(BLOCK_META) as WsBlockType[]).map((type) => {
                const meta = BLOCK_META[type];
                return (
                  <button
                    key={type}
                    onClick={() => addBlock(type)}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-right transition-colors hover:border-primary/40"
                  >
                    <meta.icon className="size-5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{meta.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {meta.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <UsersPanel
          personas={draft.personas}
          onPersonas={(personas) => change({ personas })}
          assigned={assigned}
          onAssigned={(next) => {
            setAssigned(next);
            setDirty(true);
          }}
        />
      )}

      {tab === "preview" && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">كما يراها:</span>
            {ALL_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setPreviewRole(r)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs",
                  previewRole === r
                    ? "border-primary bg-primary-soft/50 font-bold text-primary"
                    : "border-border",
                )}
              >
                {roleLabels[r]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            الشاشات التي لا يفتحها دورٌ ما تختفي من مساحة عمله تلقائياً.
          </p>
          <div className="rounded-2xl border border-border bg-background p-5">
            <WorkspaceView
              title={draft.title}
              icon={draft.icon}
              color={draft.color}
              description={draft.description}
              layout={draft.layout}
              role={previewRole}
              pageLabels={pageLabels}
              preview
            />
          </div>
        </div>
      )}

      {itemDialog && (
        <ItemDialog
          item={itemDialog.item}
          pages={catalog.data?.pages ?? []}
          pageLabels={pageLabels}
          onClose={() => setItemDialog(null)}
          onSave={(item) => {
            upsertItem(itemDialog.block, item);
            setItemDialog(null);
          }}
        />
      )}
    </>
  );
}

// --- a block ---------------------------------------------------------------------

function BlockEditor({
  block,
  index,
  count,
  cards,
  pageLabels,
  onChange,
  onMove,
  onRemove,
  onAddItem,
  onEditItem,
  onMoveItem,
  onRemoveItem,
}: {
  block: WsBlock;
  index: number;
  count: number;
  cards: Array<{ key: string; label: string; personas: Role[] }>;
  pageLabels: Record<string, { title: string; icon: string }>;
  onChange: (patch: Partial<WsBlock>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
  onAddItem: () => void;
  onEditItem: (item: WsItem) => void;
  onMoveItem: (index: number, by: number) => void;
  onRemoveItem: (id: string) => void;
}) {
  const meta = BLOCK_META[block.type];
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Pill tone="primary">
          <meta.icon className="me-1 size-3" />
          {meta.label}
        </Pill>
        <Input
          value={block.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={block.type === "links" ? "عنوان القائمة" : "عنوان القسم (اختياري)"}
          className="h-8 max-w-xs flex-1"
        />
        <div className="ms-auto flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded p-1.5 hover:bg-secondary disabled:opacity-30"
            title="أعلى"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            className="rounded p-1.5 hover:bg-secondary disabled:opacity-30"
            title="أسفل"
          >
            <ArrowDown className="size-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="حذف القسم"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {block.type === "text" ? (
          <Textarea
            rows={3}
            value={block.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="النص الذي يظهر في مساحة العمل"
          />
        ) : block.type === "numbers" ? (
          <div className="flex flex-wrap gap-1.5">
            {cards.map((c) => {
              const on = (block.cards ?? []).includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() =>
                    onChange({
                      cards: on
                        ? (block.cards ?? []).filter((k) => k !== c.key)
                        : [...(block.cards ?? []), c.key],
                    })
                  }
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    on
                      ? "border-primary/40 bg-primary-soft/40 font-medium text-primary"
                      : "border-dashed border-border text-muted-foreground",
                  )}
                  title={c.personas.map((p) => roleLabels[p]).join("، ")}
                >
                  {c.label}
                </button>
              );
            })}
            {cards.length === 0 && <p className="text-xs text-muted-foreground">جارِ التحميل…</p>}
          </div>
        ) : (
          <div className="space-y-1.5">
            {(block.items ?? []).map((item, i) => {
              const r = resolveItem(item, "admin", pageLabels);
              const Icon = r?.icon ?? wsIcon(item.icon);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl border border-border px-2.5 py-1.5"
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg",
                      wsColor(item.color).tile,
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {r?.label ?? item.label ?? item.target}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground" dir="auto">
                      {KIND_LABEL[item.kind]} ·{" "}
                      {item.kind === "page"
                        ? (pageLabels[item.target]?.title ?? item.target)
                        : item.target}
                    </span>
                  </span>
                  <button
                    onClick={() => onMoveItem(i, -1)}
                    disabled={i === 0}
                    className="rounded p-1 hover:bg-secondary disabled:opacity-30"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    onClick={() => onMoveItem(i, 1)}
                    disabled={i === (block.items?.length ?? 0) - 1}
                    className="rounded p-1 hover:bg-secondary disabled:opacity-30"
                  >
                    <ArrowDown className="size-3" />
                  </button>
                  <button
                    onClick={() => onEditItem(item)}
                    className="rounded p-1 hover:bg-secondary"
                    title="تعديل"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="حذف"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
            <button
              onClick={onAddItem}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              <Plus className="size-3.5" />
              إضافة زر
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// --- a button ----------------------------------------------------------------------

function ItemDialog({
  item,
  pages,
  pageLabels,
  onClose,
  onSave,
}: {
  item: WsItem | undefined;
  pages: Array<{
    id: string;
    title: string;
    icon: string;
    templateTitle: string;
    categoryLabel: string;
    isActive: number;
  }>;
  pageLabels: Record<string, { title: string; icon: string }>;
  onClose: () => void;
  onSave: (item: WsItem) => void;
}) {
  const [kind, setKind] = useState<WsItemKind>(item?.kind ?? "screen");
  const [target, setTarget] = useState(item?.target ?? "");
  const [label, setLabel] = useState(item?.label ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "");
  const [color, setColor] = useState(item?.color ?? "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (item && kind === item.kind) return;
    setTarget("");
  }, [kind, item]);

  const screens = useMemo(() => {
    const q = search.trim();
    return navItems.filter(
      (n) => !q || labelFor(n, "admin").includes(q) || n.label.includes(q) || n.to.includes(q),
    );
  }, [search]);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof screens>();
    for (const s of screens) {
      const g = groupFor(s, s.roles.includes("admin") ? "admin" : s.roles[0]!);
      map.set(g, [...(map.get(g) ?? []), s]);
    }
    return [...map.entries()];
  }, [screens]);

  const draft: WsItem = {
    id: item?.id ?? uid(),
    kind,
    target: target.trim(),
    label: label.trim(),
    icon,
    color,
  };
  const resolved = target ? resolveItem(draft, "admin", pageLabels) : null;
  const valid =
    kind === "url"
      ? /^https?:\/\//.test(target.trim())
      : kind === "screen"
        ? target.startsWith("/app")
        : !!target;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{item ? "تعديل الزر" : "زر جديد"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["screen", "شاشة من النظام", Monitor],
              ["page", "صفحة مبنية", FileText],
              ["url", "رابط خارجي", Link2],
            ] as const
          ).map(([k, l, I]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
                kind === k
                  ? "border-primary bg-primary-soft/50 text-primary"
                  : "border-border hover:bg-secondary",
              )}
            >
              <I className="size-3.5" />
              {l}
            </button>
          ))}
        </div>

        {kind === "screen" && (
          <div>
            <div className="relative mb-2">
              <Search className="absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
              <Input
                className="ps-7"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن شاشة…"
              />
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-border p-2">
              {grouped.map(([group, list]) => (
                <div key={group}>
                  <p className="mb-1 px-1 text-[10px] font-bold text-muted-foreground">{group}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {list.map((n) => (
                      <button
                        key={n.to}
                        onClick={() => setTarget(n.to)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-right text-xs transition-colors",
                          target === n.to
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary",
                        )}
                      >
                        <n.icon className="size-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {labelFor(n, n.roles.includes("admin") ? "admin" : n.roles[0]!)}
                        </span>
                        {n.roles.length < 5 && (
                          <span className="shrink-0 text-[9px] opacity-70">
                            {n.roles.map((r) => roleLabels[r].split(" ")[0]).join("·")}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {kind === "page" && (
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {pages.map((p) => {
              const I = wsIcon(p.icon, FileText);
              return (
                <button
                  key={p.id}
                  onClick={() => setTarget(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right text-xs transition-colors",
                    target === p.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                  )}
                >
                  <I className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                  <span className="shrink-0 text-[10px] opacity-70">
                    {p.categoryLabel} · {p.templateTitle}
                  </span>
                  {!p.isActive && <span className="text-[10px]">(موقوفة)</span>}
                </button>
              );
            })}
            {pages.length === 0 && (
              <p className="p-3 text-center text-xs text-muted-foreground">
                لا صفحات بعد — أنشئها من تبويب «الصفحات» في شاشة مساحات العمل.
              </p>
            )}
          </div>
        )}

        {kind === "url" && (
          <Input
            dir="ltr"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://…"
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">النص على الزر</p>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={resolved?.label ?? "اسم الشاشة أو الصفحة"}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">الأيقونة واللون</p>
            <div className="flex flex-wrap items-center gap-2">
              <IconPicker value={icon} onChange={setIcon} color={color} allowEmpty />
            </div>
          </div>
        </div>
        <ColorPicker value={color} onChange={setColor} allowEmpty />

        <DialogFooter>
          <button
            onClick={() => valid && onSave(draft)}
            disabled={!valid}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {item ? "تحديث" : "إضافة"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- who works in it ------------------------------------------------------------

function UsersPanel({
  personas,
  onPersonas,
  assigned,
  onAssigned,
}: {
  personas: Role[];
  onPersonas: (p: Role[]) => void;
  assigned: AssignedUser[];
  onAssigned: (next: AssignedUser[]) => void;
}) {
  const [search, setSearch] = useState("");
  const candidates = useWorkspaceAssignments(search.trim());
  const taken = new Set(assigned.map((a) => a.user));

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_22rem]">
      <SectionCard
        title="مستخدمون بأسمائهم"
        description="تظهر لهم مساحة العمل في التبديل؛ و«الافتراضية» هي ما يبدؤون به عند الدخول"
      >
        {assigned.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            لم تُسند لأحد بعد — ابحث عن مستخدم وأضفه.
          </p>
        ) : (
          <div className="space-y-1.5">
            {assigned.map((a) => (
              <div
                key={a.user}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
              >
                <UserRound className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{a.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {a.personaLabel}
                  </span>
                </span>
                <label className="flex items-center gap-1.5 text-[11px]">
                  <Switch
                    checked={a.isDefault}
                    onCheckedChange={(v) =>
                      onAssigned(
                        assigned.map((x) => (x.user === a.user ? { ...x, isDefault: v } : x)),
                      )
                    }
                  />
                  الافتراضية له
                </label>
                <button
                  onClick={() => onAssigned(assigned.filter((x) => x.user !== a.user))}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="إلغاء الإسناد"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          تُحفظ التغييرات هنا مع زر «حفظ» أعلى الشاشة.
        </p>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="لأدوار كاملة" description="متاحة لكل من له هذا الدور — الحالي والقادم">
          <div className="space-y-2">
            {ALL_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-xs">
                <Switch
                  checked={personas.includes(r)}
                  onCheckedChange={(v) =>
                    onPersonas(v ? [...personas, r] : personas.filter((p) => p !== r))
                  }
                />
                كل {roleLabels[r]}
              </label>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="إضافة مستخدم">
          <div className="relative mb-2">
            <Search className="absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
            <Input
              className="ps-7"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم…"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {(candidates.data?.users ?? [])
              .filter((u) => !taken.has(u.user))
              .slice(0, 40)
              .map((u) => (
                <button
                  key={u.user}
                  onClick={() =>
                    onAssigned([
                      ...assigned,
                      {
                        user: u.user,
                        name: u.name,
                        persona: u.persona,
                        personaLabel: u.personaLabel,
                        isDefault: false,
                      },
                    ])
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right hover:bg-secondary"
                >
                  <Plus className="size-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-xs">{u.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {u.personaLabel}
                  </span>
                </button>
              ))}
            {candidates.isLoading && (
              <p className="p-2 text-center text-xs text-muted-foreground">جارِ التحميل…</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

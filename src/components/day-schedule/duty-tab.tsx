import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Pencil,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { HtmlPreviewDialog } from "@/components/shared/html-preview-dialog";
import { useConfirm } from "@/components/shared/confirm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/error-message";
import {
  getDutyPrint,
  useDeleteDutyProgram,
  useDutyPrograms,
  useMoveDutyProgram,
  useSaveDutyProgram,
  type DutyEntry,
  type DutyList,
  type DutyProgram,
} from "@/lib/api/duty";

/**
 * جدول المناوبة: the duty rotas for the breaks and the end of the day,
 * written by hand. Nothing in the timetable reads or changes them.
 */
export function DutyTab() {
  const query = useDutyPrograms();
  const remove = useDeleteDutyProgram();
  const move = useMoveDutyProgram();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<DutyProgram | "new" | null>(null);
  const [printing, setPrinting] = useState<{ ids?: string[] } | null>(null);
  const [onePerPage, setOnePerPage] = useState(false);

  async function drop(p: DutyProgram) {
    const ok = await confirm({
      title: `حذف «${p.title}»؟`,
      description: "يُحذف البرنامج ومناوبوه فقط.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(p.id);
      toast.success("تم الحذف");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحذف"));
    }
  }

  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <TableSkeleton rows={4} />;
  const data = query.data;
  const active = data.programs.filter((p) => p.isActive);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setEditing("new")}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
        >
          <Plus className="size-4" />
          برنامج مناوبة جديد
        </button>
        {active.length > 0 && (
          <>
            <button
              onClick={() => setPrinting({})}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:bg-secondary"
            >
              <Printer className="size-4" />
              طباعة الكل ({active.length})
            </button>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={onePerPage} onCheckedChange={setOnePerPage} />
              كل برنامج في صفحة
            </label>
          </>
        )}
      </div>

      {data.programs.length === 0 ? (
        <EmptyBlock
          title="لا توجد برامج مناوبة بعد"
          description="أضف برنامجاً لكل استراحة أو لآخر الدوام (مثال: برنامج المناوبة للعصرونة الأولى للصفوف 1–4)، وحدّد لكل يوم المناوبين وأماكنهم."
          icon={<ShieldCheck className="size-6" />}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
          <div className="space-y-4">
            {data.programs.map((p, i) => (
              <SectionCard
                key={p.id}
                title={p.title}
                description={[
                  p.periodLabel,
                  p.fromTime && `${p.fromTime}${p.toTime ? ` – ${p.toTime}` : ""}`,
                  `${p.entries.length} مناوبة`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                actions={
                  <div className="flex flex-wrap items-center gap-1">
                    {!p.isActive && <Pill>موقوف</Pill>}
                    <button
                      onClick={() => move.mutate({ program: p.id, direction: -1 })}
                      disabled={i === 0}
                      aria-label="أعلى"
                      className="rounded-lg p-1.5 hover:bg-secondary disabled:opacity-30"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      onClick={() => move.mutate({ program: p.id, direction: 1 })}
                      disabled={i === data.programs.length - 1}
                      aria-label="أسفل"
                      className="rounded-lg p-1.5 hover:bg-secondary disabled:opacity-30"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      onClick={() => setPrinting({ ids: [p.id] })}
                      aria-label="طباعة"
                      className="rounded-lg p-1.5 hover:bg-secondary"
                    >
                      <Printer className="size-4" />
                    </button>
                    <button
                      onClick={() => setEditing(p)}
                      aria-label="تعديل"
                      className="rounded-lg p-1.5 hover:bg-secondary"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => drop(p)}
                      aria-label="حذف"
                      className="rounded-lg p-1.5 text-destructive hover:bg-destructive-soft"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                }
              >
                <table className="w-full border-collapse text-sm" data-no-tools>
                  <tbody>
                    {data.days.map((d) => {
                      const people = p.entries.filter((e) => e.day === d.key);
                      return (
                        <tr key={d.key} className="border-b border-border/60 last:border-0">
                          <th className="w-24 py-2 text-start font-bold">{d.label}</th>
                          <td className="py-2">
                            {people.length ? (
                              <span className="flex flex-wrap gap-1.5">
                                {people.map((e, j) => (
                                  <span
                                    key={j}
                                    className="rounded-lg bg-secondary px-2 py-0.5 text-xs"
                                  >
                                    <b>{e.name}</b>
                                    {e.place && (
                                      <span className="text-muted-foreground"> — {e.place}</span>
                                    )}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </SectionCard>
            ))}
          </div>

          <SectionCard title="المناوبات لكل معلم" description="في الأسبوع، في البرامج الفعّالة">
            {data.load.length ? (
              <ul className="divide-y divide-border">
                {data.load.map((r) => (
                  <li key={r.name} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate">{r.name}</span>
                    <span className="num rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                      {r.count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">لا مناوبات بعد.</p>
            )}
          </SectionCard>
        </div>
      )}

      {editing && (
        <ProgramDialog
          program={editing === "new" ? null : editing}
          data={data}
          onClose={() => setEditing(null)}
        />
      )}
      {printing && (
        <HtmlPreviewDialog
          heading="جدول المناوبة"
          load={() => getDutyPrint(printing.ids, onePerPage)}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  );
}

type Row = { name: string; place: string };

function ProgramDialog({
  program,
  data,
  onClose,
}: {
  program: DutyProgram | null;
  data: DutyList;
  onClose: () => void;
}) {
  const save = useSaveDutyProgram();
  const [title, setTitle] = useState(program?.title ?? "برنامج المناوبة ");
  const [periodLabel, setPeriodLabel] = useState(program?.periodLabel ?? "");
  const [fromTime, setFromTime] = useState(program?.fromTime ?? "");
  const [toTime, setToTime] = useState(program?.toTime ?? "");
  const [isActive, setIsActive] = useState(program?.isActive ?? true);
  const [rows, setRows] = useState<Record<string, Row[]>>(() => {
    const out: Record<string, Row[]> = {};
    for (const d of data.days)
      out[d.key] = (program?.entries ?? [])
        .filter((e) => e.day === d.key)
        .map((e) => ({ name: e.name, place: e.place }));
    return out;
  });
  const byName = new Map(data.instructors.map((i) => [i.name, i.id]));

  const update = (day: string, i: number, patch: Partial<Row>) =>
    setRows((r) => ({
      ...r,
      [day]: (r[day] ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));
  const add = (day: string) =>
    setRows((r) => ({ ...r, [day]: [...(r[day] ?? []), { name: "", place: "" }] }));
  const removeRow = (day: string, i: number) =>
    setRows((r) => ({ ...r, [day]: (r[day] ?? []).filter((_, j) => j !== i) }));

  function copyFromPrevious(index: number) {
    const prev = data.days[index - 1];
    const day = data.days[index];
    if (!prev || !day) return;
    // The places, not the people: the posts stay the same day to day.
    setRows((r) => ({
      ...r,
      [day.key]: (r[prev.key] ?? []).map((x) => ({ name: "", place: x.place })),
    }));
  }

  async function submit() {
    const entries: DutyEntry[] = [];
    for (const d of data.days)
      for (const r of rows[d.key] ?? []) {
        const name = r.name.trim();
        if (!name) continue;
        entries.push({ day: d.key, teacher: byName.get(name) ?? "", name, place: r.place.trim() });
      }
    try {
      await save.mutateAsync({
        ...(program ? { id: program.id } : {}),
        title: title.trim(),
        periodLabel,
        fromTime,
        toTime,
        isActive,
        entries,
      });
      toast.success("تم حفظ البرنامج");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{program ? "تعديل برنامج المناوبة" : "برنامج مناوبة جديد"}</DialogTitle>
          <DialogDescription>
            يُكتب يدوياً ولا يغيّر شيئاً في الجدول الدراسي. اكتب اسم المعلم (أو اختره من القائمة)
            ومكان المناوبة.
          </DialogDescription>
        </DialogHeader>

        <datalist id="duty-teachers">
          {data.instructors.map((i) => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>
        <datalist id="duty-places">
          {[...new Set(["بين الطلاب", "الباب الأمامي", "المقصف", ...data.places])].map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>عنوان البرنامج (يُطبع كما هو)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="برنامج المناوبة للعصرونة الأولى للصفوف من (1-4)"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الفترة</Label>
            <Input
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="الاستراحة الأولى / آخر الدوام"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>من</Label>
              <Input
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>إلى</Label>
              <Input
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {data.days.map((d, index) => (
            <div key={d.key} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold">{d.label}</p>
                <div className="flex gap-1">
                  {index > 0 && (
                    <button
                      onClick={() => copyFromPrevious(index)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary"
                      title="نسخ أماكن المناوبة من اليوم السابق"
                    >
                      <Copy className="size-3" />
                      أماكن اليوم السابق
                    </button>
                  )}
                  <button
                    onClick={() => add(d.key)}
                    className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-[11px] font-semibold hover:bg-primary-soft hover:text-primary"
                  >
                    <Plus className="size-3" />
                    مناوب
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {(rows[d.key] ?? []).map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      list="duty-teachers"
                      value={r.name}
                      onChange={(e) => update(d.key, i, { name: e.target.value })}
                      placeholder="اسم المعلم/ة"
                      className="h-9 flex-1 rounded-lg"
                    />
                    <Input
                      list="duty-places"
                      value={r.place}
                      onChange={(e) => update(d.key, i, { place: e.target.value })}
                      placeholder="مكان المناوبة (اختياري)"
                      className="h-9 flex-1 rounded-lg"
                    />
                    <button
                      onClick={() => removeRow(d.key, i)}
                      aria-label="حذف"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                {!(rows[d.key] ?? []).length && (
                  <p className="text-[11px] text-muted-foreground">لا مناوبين في هذا اليوم.</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-medium">البرنامج فعّال</p>
            <p className="text-[11px] text-muted-foreground">الموقوف لا يُطبع مع «طباعة الكل».</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

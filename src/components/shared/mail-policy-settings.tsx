import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ShieldCheck } from "lucide-react";
import { useConfirm } from "@/components/shared/confirm";
import { errorMessage } from "@/lib/api/error-message";
import { useMailPolicy, useSaveMailPolicy } from "@/lib/api/hooks";

/**
 * Who each role may write to.
 *
 * A grid rather than a list of switches: the question is always "this role,
 * that audience", and a grid is the only shape where a head can see the whole
 * answer at once and spot the cell they did not mean to tick.
 */
export function MailPolicySettings({ canEdit }: { canEdit: boolean }) {
  const query = useMailPolicy();
  const save = useSaveMailPolicy();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!query.data) return;
    setDraft(Object.fromEntries(query.data.roles.map((r) => [r.key, [...r.allowed]])));
  }, [query.data]);

  const audiences = query.data?.audiences ?? [];
  const roles = query.data?.roles ?? [];

  function toggle(role: string, audience: string) {
    setDraft((d) => {
      const current = d[role] ?? [];
      return {
        ...d,
        [role]: current.includes(audience)
          ? current.filter((a) => a !== audience)
          : [...current, audience],
      };
    });
  }

  async function submit() {
    const ok = await confirm({
      title: "حفظ صلاحيات المراسلة؟",
      description: "ستُطبَّق فوراً على من يمكن لكل دور مراسلته.",
    });
    if (!ok) return;
    try {
      const res = await save.mutateAsync(draft);
      toast.success(res.message_ar || "تم الحفظ");
    } catch (err) {
      toast.error(errorMessage(err, "تعذّر الحفظ"));
    }
  }

  if (query.isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>;
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-xl bg-secondary/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>
          حدّد لكل دور الجماهير التي يمكنه مراسلتها. «صفوفي» تعني الشُعب المرتبطة بالمستخدم نفسه —
          فالمعلّم يصل أولياء أمور صفوفه هو، لا صفوف غيره. الخانة غير المحدّدة تعني المنع.
        </span>
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-right text-xs">
          <thead className="bg-secondary">
            <tr>
              <th className="p-2 font-bold">الدور</th>
              {audiences.map((a) => (
                <th key={a.key} className="p-2 text-center font-semibold">
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roles.map((r) => (
              <tr key={r.key}>
                <td className="whitespace-nowrap p-2 font-bold">{r.label}</td>
                {audiences.map((a) => {
                  const on = (draft[r.key] ?? []).includes(a.key);
                  return (
                    <td key={a.key} className="p-2 text-center">
                      <button
                        onClick={() => canEdit && toggle(r.key, a.key)}
                        disabled={!canEdit}
                        aria-label={`${r.label} → ${a.label}`}
                        className={`grid size-6 place-items-center rounded-lg border transition-colors ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-secondary"
                        } ${canEdit ? "" : "opacity-60"}`}
                      >
                        {on && <Check className="size-3.5" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={save.isPending}
            className="h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {save.isPending ? "جارٍ الحفظ…" : "حفظ الصلاحيات"}
          </button>
        </div>
      )}
    </div>
  );
}

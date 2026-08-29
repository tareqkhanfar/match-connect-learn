import { useState } from "react";
import { Check, Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRecipientGroups, useRecipientSearch } from "@/lib/api/hooks";

/**
 * Choosing who a message goes to.
 *
 * A school addresses mail three ways: by name, by the id printed on every
 * list, and by "all the guardians of 4-B". Offering only a name search sends
 * staff back to a paper roster, so the search matches the name, the system id
 * and the national id at once, and the groups are one click.
 *
 * The groups come from the caller's own contact list, so this cannot be used
 * to reach someone they may not write to — the server enforces the same rule
 * again on send.
 */
export function RecipientPicker({
  label,
  value,
  onChange,
  allowGroups = true,
}: {
  label: string;
  value: string[];
  onChange: (users: string[]) => void;
  allowGroups?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const search = useRecipientSearch(q);
  const groups = useRecipientGroups();

  const results = search.data?.results ?? [];
  const chosen = new Set(value);
  const nameOf = (u: string) => results.find((r) => r.user === u)?.name ?? u;

  function toggle(user: string) {
    onChange(chosen.has(user) ? value.filter((v) => v !== user) : [...value, user]);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border p-2">
        <span className="shrink-0 text-xs font-bold text-muted-foreground">{label}</span>
        {value.map((u) => (
          <span
            key={u}
            className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary"
          >
            {nameOf(u)}
            <button onClick={() => toggle(u)} aria-label="إزالة">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-dashed border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary"
        >
          + إضافة
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-border p-2">
          <div className="relative mb-2">
            <Search className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهوية أو رقم النظام…"
              className="h-9 rounded-lg pr-8 text-xs"
            />
          </div>

          {allowGroups && (groups.data?.groups.length ?? 0) > 0 && !q && (
            <div className="mb-2">
              <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <Users className="size-3" />
                مجموعات جاهزة
              </p>
              <div className="flex flex-wrap gap-1">
                {(groups.data?.groups ?? []).slice(0, 12).map((g) => (
                  <button
                    key={g.key}
                    onClick={() => onChange([...new Set([...value, ...g.users])])}
                    className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-primary-soft hover:text-primary"
                  >
                    {g.label} <span className="num">({g.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ul className="max-h-52 space-y-0.5 overflow-y-auto">
            {results.length === 0 ? (
              <li className="py-4 text-center text-[11px] text-muted-foreground">
                {search.isLoading ? "جارٍ البحث…" : "لا نتائج"}
              </li>
            ) : (
              results.map((r) => (
                <li key={r.user}>
                  <button
                    onClick={() => toggle(r.user)}
                    className={`flex w-full items-center gap-2 rounded-lg p-1.5 text-right transition-colors ${
                      chosen.has(r.user) ? "bg-primary-soft" : "hover:bg-secondary"
                    }`}
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded border ${
                        chosen.has(r.user)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {chosen.has(r.user) && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{r.name}</span>
                      <span className="num block truncate text-[10px] text-muted-foreground">
                        {[r.record, r.national_id, r.email].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

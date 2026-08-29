import { useState } from "react";
import { Check, ChevronLeft, Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMyAudiences, useRecipientSearch } from "@/lib/api/hooks";

export interface AudienceChoice {
  /** Set when writing to a whole audience. */
  audience?: string | undefined;
  audienceLabel?: string | undefined;
  groups: string[];
  /** Set when naming individuals instead. */
  users: string[];
}

/**
 * Choosing who a message goes to, audience first.
 *
 * The question a school actually asks is "who is this for" — the guardians of
 * a class, the teachers, one parent. Asking for names first forces someone to
 * type thirty of them; asking for the audience first makes the common case one
 * click and leaves the individual case available underneath.
 *
 * When an audience is chosen, the message is addressed to the audience, not to
 * the names behind it: the To field stays readable, and the server resolves
 * the members at send time from what this caller may actually reach.
 */
export function AudiencePicker({
  value,
  onChange,
}: {
  value: AudienceChoice;
  onChange: (v: AudienceChoice) => void;
}) {
  const meta = useMyAudiences();
  const [mode, setMode] = useState<"audience" | "people">(
    value.users.length > 0 && !value.audience ? "people" : "audience",
  );
  const [q, setQ] = useState("");
  const search = useRecipientSearch(q);

  const audiences = meta.data?.audiences ?? [];
  const groups = meta.data?.groups ?? [];
  const chosen = audiences.find((a) => a.key === value.audience);
  const results = search.data?.results ?? [];
  const picked = new Set(value.users);

  function toggleUser(user: string) {
    onChange({
      ...value,
      audience: undefined,
      audienceLabel: undefined,
      groups: [],
      users: picked.has(user) ? value.users.filter((u) => u !== user) : [...value.users, user],
    });
  }

  function toggleGroup(id: string) {
    const next = value.groups.includes(id)
      ? value.groups.filter((g) => g !== id)
      : [...value.groups, id];
    onChange({ ...value, groups: next });
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="flex gap-1 border-b border-border p-1.5">
        <button
          onClick={() => setMode("audience")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            mode === "audience" ? "bg-primary-soft text-primary" : "hover:bg-secondary"
          }`}
        >
          <Users className="ml-1 inline size-3.5" />
          إرسال لجمهور
        </button>
        <button
          onClick={() => setMode("people")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            mode === "people" ? "bg-primary-soft text-primary" : "hover:bg-secondary"
          }`}
        >
          <Search className="ml-1 inline size-3.5" />
          تحديد أشخاص
        </button>
      </div>

      {mode === "audience" ? (
        <div className="p-2">
          {audiences.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-muted-foreground">
              لا تملك صلاحية المراسلة الجماعية.
            </p>
          ) : (
            <ul className="space-y-1">
              {audiences.map((a) => {
                const on = value.audience === a.key;
                return (
                  <li key={a.key}>
                    <button
                      onClick={() =>
                        onChange({
                          audience: on ? undefined : a.key,
                          audienceLabel: on ? undefined : a.label,
                          groups: [],
                          users: [],
                        })
                      }
                      className={`flex w-full items-center gap-2 rounded-lg border p-2 text-right transition-colors ${
                        on ? "border-primary bg-primary-soft" : "border-border hover:bg-secondary"
                      }`}
                    >
                      <span
                        className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                      >
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="flex-1 text-xs font-semibold">{a.label}</span>
                      {a.scope === "mine" && (
                        <span className="text-[10px] text-muted-foreground">صفوفي</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Narrowing a broad audience to particular classes. Leaving it
              empty means every class the audience covers. */}
          {chosen && groups.length > 0 && (
            <div className="mt-2 rounded-lg border border-border p-2">
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <ChevronLeft className="size-3" />
                تحديد صفوف بعينها (اختياري)
              </p>
              <div className="flex flex-wrap gap-1">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                      value.groups.includes(g.id)
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {value.groups.length === 0
                  ? "لم تحدّد صفاً — سيصل الجميع ضمن هذا الجمهور."
                  : `${value.groups.length} صفاً محدّداً.`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-2">
          <div className="relative mb-2">
            <Search className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهوية أو رقم النظام…"
              className="h-9 rounded-lg pr-8 text-xs"
            />
          </div>

          {value.users.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {value.users.map((u) => {
                const found = results.find((r) => r.user === u);
                return (
                  <span
                    key={u}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary"
                  >
                    {found?.name ?? u}
                    <button onClick={() => toggleUser(u)} aria-label="إزالة">
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <ul className="max-h-48 space-y-0.5 overflow-y-auto">
            {results.length === 0 ? (
              <li className="py-4 text-center text-[11px] text-muted-foreground">
                {search.isLoading ? "جارٍ البحث…" : "لا نتائج"}
              </li>
            ) : (
              results.map((r) => (
                <li key={r.user}>
                  <button
                    onClick={() => toggleUser(r.user)}
                    className={`flex w-full items-center gap-2 rounded-lg p-1.5 text-right transition-colors ${
                      picked.has(r.user) ? "bg-primary-soft" : "hover:bg-secondary"
                    }`}
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded border ${
                        picked.has(r.user)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {picked.has(r.user) && <Check className="size-3" />}
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

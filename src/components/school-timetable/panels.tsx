import { useMemo, useState } from "react";
import { AlertTriangle, CircleCheck, OctagonX, UserRound, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pill, ProgressBar } from "@/components/shared/ui-kit";
import { Segmented } from "@/components/reports/report-kit";
import type { SchoolSheet, SheetProblem, SheetSlot } from "@/lib/api/school-timetable";
import { cellId, clockOf, type SheetIndex, type WeekCheck } from "@/lib/school-timetable";
import { cn } from "@/lib/utils";
import type { SheetView } from "./cell-picker";

const KIND_LABEL: Record<SheetProblem["kind"], string> = {
  teacher: "معلم في مكانين",
  group: "شعبة في حصتين",
  room: "قاعة محجوزة مرتين",
  time: "حصة خارج يوم الشعبة",
  course: "المادة",
  quota: "النصاب",
  daily: "تكرار المادة في اليوم",
};

export function ProblemsPanel({
  check,
  onFocus,
}: {
  check: WeekCheck;
  onFocus: (p: SheetProblem) => void;
}) {
  const [level, setLevel] = useState<"error" | "legacy" | "warning">("error");
  const list = check.problems.filter((p) =>
    level === "warning"
      ? p.level === "warning"
      : level === "legacy"
        ? p.legacy
        : p.level === "error" && !p.legacy,
  );
  const groups = new Map<string, SheetProblem[]>();
  for (const p of list) groups.set(p.kind, [...(groups.get(p.kind) ?? []), p]);
  return (
    <section className="card-surface flex min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold">التحقق من الجدول</h2>
        <div className="ms-auto">
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { key: "error", label: `أخطاء ${check.errors}` },
              { key: "legacy", label: `قائمة سابقاً ${check.legacy}` },
              { key: "warning", label: `تنبيهات ${check.warnings}` },
            ]}
          />
        </div>
      </div>
      <div className="max-h-80 min-h-0 flex-1 overflow-y-auto p-3">
        {list.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-success">
            <CircleCheck className="size-4" />
            {level === "error" ? "لا أخطاء في تعديلاتك — جاهز للحفظ." : "لا شيء هنا."}
          </p>
        ) : (
          [...groups.entries()].map(([kind, items]) => (
            <div key={kind} className="mb-3">
              <p className="mb-1 text-[11px] font-bold text-muted-foreground">
                {KIND_LABEL[kind as SheetProblem["kind"]]} ({items.length})
              </p>
              <ul className="space-y-1">
                {items.slice(0, 60).map((p, i) => (
                  <li key={`${kind}${i}`}>
                    <button
                      onClick={() => onFocus(p)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-right text-xs hover:bg-secondary",
                        p.level === "error" ? "text-destructive" : "text-warm-foreground",
                      )}
                    >
                      {p.level === "error" ? (
                        <OctagonX className="mt-0.5 size-3.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 text-foreground">{p.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
      {level === "legacy" && check.legacy > 0 && (
        <p className="border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          أخطاء كانت في الجدول قبل تعديلك وبين خانات لم تلمسها — تظهر بإطار متقطّع ولا تمنع الحفظ،
          لكن يُستحسن معالجتها.
        </p>
      )}
    </section>
  );
}

/** The selected teacher's or section's week, in numbers. */
export function SelectionPanel({
  view,
  row,
  sheet,
  index,
  onQuota,
  limits,
  onLimit,
}: {
  view: SheetView;
  row: string | null;
  sheet: SchoolSheet;
  index: SheetIndex;
  onQuota: (teacher: string, quota: number) => void;
  limits: Record<string, number>;
  onLimit: (group: string, course: string, value: number) => void;
}) {
  if (!row) {
    return (
      <section className="card-surface grid place-items-center p-8 text-center text-sm text-muted-foreground">
        <div>
          <UserRound className="mx-auto mb-2 size-7" />
          اختر خانة في الجدول لعرض ملخص {view === "teachers" ? "المعلم" : "الشعبة"} هنا.
        </div>
      </section>
    );
  }
  return view === "teachers" ? (
    <TeacherSummary id={row} sheet={sheet} index={index} onQuota={onQuota} />
  ) : (
    <SectionSummary id={row} sheet={sheet} index={index} limits={limits} onLimit={onLimit} />
  );
}

function dayGaps(slots: SheetSlot[], periods: number[]) {
  // Empty periods between the first and last lesson of the day.
  const taken = new Set(slots.map((s) => s.period));
  if (!taken.size) return 0;
  const first = Math.min(...taken);
  const last = Math.max(...taken);
  return periods.filter((p) => p > first && p < last && !taken.has(p)).length;
}

function TeacherSummary({
  id,
  sheet,
  index,
  onQuota,
}: {
  id: string;
  sheet: SchoolSheet;
  index: SheetIndex;
  onQuota: (teacher: string, quota: number) => void;
}) {
  const t = index.teachers.get(id);
  const slots = index.teacherSlots.get(id) ?? [];
  const [quota, setQuota] = useState(String(t?.quota ?? 0));
  const periodNos = sheet.periods.map((p) => p.order);
  const perDay = sheet.days.map((d) => {
    const day = slots.filter((s) => s.day === d.value);
    return { day: d, n: day.length, gaps: dayGaps(day, periodNos) };
  });
  const sections = new Map<string, number>();
  for (const s of slots) {
    const key = `${index.groups.get(s.group)?.short ?? s.group} · ${sheet.courses[s.course]?.short ?? s.course}`;
    sections.set(key, (sections.get(key) ?? 0) + 1);
  }
  const q = t?.quota ?? 0;
  return (
    <section className="card-surface p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <UserRound className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{t?.name ?? id}</p>
          <p className="text-[11px] text-muted-foreground">
            {t?.homeroomOf.length
              ? `مربي ${t.homeroomOf.map((g) => index.groups.get(g)?.short ?? g).join("، ")}`
              : "ليس مربي صف"}
          </p>
        </div>
      </div>
      <div className="mb-3 rounded-xl bg-muted/40 p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold">النصاب الأسبوعي</span>
          <span className="num font-black">
            {slots.length}
            {q ? ` / ${q}` : ""}
          </span>
        </div>
        {q > 0 && (
          <ProgressBar
            value={(slots.length / q) * 100}
            tone={slots.length > q ? "danger" : slots.length === q ? "success" : "warning"}
          />
        )}
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">تعديل النصاب</span>
          <Input
            type="number"
            min={0}
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            className="num h-7 w-16 text-xs"
          />
          <button
            onClick={() => onQuota(id, Number(quota) || 0)}
            disabled={Number(quota) === q}
            className="h-7 rounded-md border border-border px-2 font-semibold hover:bg-secondary disabled:opacity-40"
          >
            حفظ
          </button>
        </div>
      </div>
      <p className="mb-1 text-[11px] font-bold text-muted-foreground">الحصص في كل يوم</p>
      <div className="mb-3 grid grid-cols-5 gap-1 text-center">
        {perDay.map(({ day, n, gaps }) => (
          <div key={day.value} className="rounded-lg border border-border p-1.5">
            <p className="text-[10px] text-muted-foreground">{day.label}</p>
            <p className="num text-sm font-black">{n}</p>
            <p
              className={cn(
                "num text-[9px]",
                gaps ? "text-warm-foreground" : "text-muted-foreground",
              )}
            >
              {gaps ? `${gaps} فراغ` : "متصل"}
            </p>
          </div>
        ))}
      </div>
      <p className="mb-1 text-[11px] font-bold text-muted-foreground">
        ما يدرّسه ({sections.size})
      </p>
      <div className="flex flex-wrap gap-1">
        {[...sections.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([label, n]) => (
            <Pill key={label}>
              {label} <span className="num ms-1 opacity-70">×{n}</span>
            </Pill>
          ))}
        {sections.size === 0 && <p className="text-xs text-muted-foreground">لا حصص بعد.</p>}
      </div>
    </section>
  );
}

function SectionSummary({
  id,
  sheet,
  index,
  limits,
  onLimit,
}: {
  id: string;
  sheet: SchoolSheet;
  index: SheetIndex;
  limits: Record<string, number>;
  onLimit: (group: string, course: string, value: number) => void;
}) {
  const g = index.groups.get(id);
  const slots = index.groupSlots.get(id) ?? [];
  const capacity = sheet.days.length * (g?.clock.length ?? 0);
  const empty: string[] = [];
  for (const d of sheet.days)
    for (const p of g?.clock ?? [])
      if (!index.byGroupCell.get(cellId(id, d.value, p.order))?.length)
        empty.push(`${d.label} ح${p.order}`);
  const perCourse = new Map<string, { n: number; teachers: Set<string> }>();
  for (const s of slots) {
    const row = perCourse.get(s.course) ?? { n: 0, teachers: new Set<string>() };
    row.n += 1;
    if (s.instructor) row.teachers.add(index.teachers.get(s.instructor)?.name ?? s.instructor);
    perCourse.set(s.course, row);
  }
  const homeroom = g?.homeroom ? (index.teachers.get(g.homeroom)?.name ?? g.homeroom) : "";
  return (
    <section className="card-surface p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <Users className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{g?.label ?? id}</p>
          <p className="text-[11px] text-muted-foreground">
            {homeroom ? `مربي الصف: ${homeroom}` : "بلا مربي صف"} ·{" "}
            <span className="num">{g?.students ?? 0}</span> طالب
          </p>
        </div>
      </div>
      <div className="mb-3 rounded-xl bg-muted/40 p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold">خانات الأسبوع المملوءة</span>
          <span className="num font-black">
            {slots.length} / {capacity}
          </span>
        </div>
        <ProgressBar
          value={capacity ? (slots.length / capacity) * 100 : 0}
          tone={slots.length >= capacity ? "success" : "warning"}
        />
        {empty.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            فارغة: {empty.slice(0, 8).join("، ")}
            {empty.length > 8 ? ` و${empty.length - 8} غيرها` : ""}
          </p>
        )}
      </div>
      <p className="mb-1 text-[11px] font-bold text-muted-foreground">
        المواد في الأسبوع والحد اليومي
      </p>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
        <table data-no-tools className="w-full text-xs">
          <tbody>
            {[...perCourse.entries()]
              .sort((a, b) => b[1].n - a[1].n)
              .map(([course, row]) => {
                const key = `${id}#${course}`;
                const limit = limits[key] || sheet.limits[key] || sheet.defaultLimit;
                return (
                  <tr key={course} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5 font-semibold">
                      {sheet.courses[course]?.subject ?? course}
                    </td>
                    <td className="num px-1 text-center font-black">{row.n}</td>
                    <td className="max-w-28 truncate px-1 text-[10px] text-muted-foreground">
                      {[...row.teachers].join("، ")}
                    </td>
                    <td className="px-1 py-1">
                      <select
                        value={limit}
                        onChange={(e) => onLimit(id, course, Number(e.target.value))}
                        title="أقصى عدد حصص لهذه المادة في اليوم"
                        className="num h-6 rounded border border-border bg-background px-1 text-[11px]"
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n}/يوم
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {perCourse.size === 0 && <p className="mt-2 text-xs text-muted-foreground">لا حصص بعد.</p>}
    </section>
  );
}

/** School-wide figures: teachers' loads and sections' completeness. */
export function LoadTables({
  sheet,
  index,
  onPick,
  onQuota,
}: {
  sheet: SchoolSheet;
  index: SheetIndex;
  onPick: (view: SheetView, row: string) => void;
  onQuota: (teacher: string, quota: number) => void;
}) {
  const [tab, setTab] = useState<"teachers" | "sections">("teachers");
  const teacherRows = useMemo(
    () =>
      sheet.teachers
        .filter((t) => !t.inactive)
        .map((t) => {
          const slots = index.teacherSlots.get(t.id) ?? [];
          const days = new Set(slots.map((s) => s.day)).size;
          const gaps = sheet.days.reduce(
            (n, d) =>
              n +
              dayGaps(
                slots.filter((s) => s.day === d.value),
                sheet.periods.map((p) => p.order),
              ),
            0,
          );
          return {
            t,
            n: slots.length,
            days,
            gaps,
            sections: new Set(slots.map((s) => s.group)).size,
          };
        })
        .sort((a, b) => b.n - a.n),
    [sheet, index],
  );
  const sectionRows = useMemo(
    () =>
      sheet.groups.map((g) => {
        const slots = index.groupSlots.get(g.id) ?? [];
        const capacity = sheet.days.length * g.clock.length;
        return {
          g,
          n: slots.length,
          capacity,
          teachers: new Set(slots.map((s) => s.instructor).filter(Boolean)).size,
          subjects: new Set(slots.map((s) => s.course)).size,
          noTeacher: slots.filter((s) => !s.instructor).length,
        };
      }),
    [sheet, index],
  );
  const timeOf = (g: SchoolSheet["groups"][number]) => {
    const first = clockOf(g, g.clock[0]?.order ?? 1);
    const last = g.clock[g.clock.length - 1];
    return first && last ? `${first.from}–${last.to}` : "—";
  };
  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold">ملخص المدرسة</h2>
        <div className="ms-auto">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { key: "teachers", label: "أنصبة المعلمين" },
              { key: "sections", label: "اكتمال الشعب" },
            ]}
          />
        </div>
      </div>
      <div className="max-h-[420px] overflow-auto">
        {tab === "teachers" ? (
          <table className="w-full text-xs" data-title="أنصبة المعلمين">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-[11px] text-muted-foreground">
                <th className="px-3 py-2 text-right">المعلم</th>
                <th className="px-2 py-2">الحصص</th>
                <th className="px-2 py-2">النصاب</th>
                <th className="px-2 py-2">الفرق</th>
                <th className="px-2 py-2">أيام الدوام</th>
                <th className="px-2 py-2">فراغات</th>
                <th className="px-2 py-2">الشعب</th>
              </tr>
            </thead>
            <tbody>
              {teacherRows.map(({ t, n, days, gaps, sections }) => {
                const diff = t.quota ? n - t.quota : null;
                return (
                  <tr
                    key={t.id}
                    onClick={() => onPick("teachers", t.id)}
                    className="cursor-pointer border-b border-border hover:bg-secondary"
                  >
                    <td className="px-3 py-1.5 font-semibold">{t.name}</td>
                    <td className="num px-2 text-center font-black">{n}</td>
                    <td className="px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <QuotaInput teacher={t.id} quota={t.quota} onSave={onQuota} />
                    </td>
                    <td
                      className={cn(
                        "num px-2 text-center font-bold",
                        diff === null
                          ? "text-muted-foreground"
                          : diff > 0
                            ? "text-destructive"
                            : diff < 0
                              ? "text-warm-foreground"
                              : "text-success",
                      )}
                    >
                      {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                    </td>
                    <td className="num px-2 text-center">{days}</td>
                    <td className={cn("num px-2 text-center", gaps > 3 && "text-warm-foreground")}>
                      {gaps}
                    </td>
                    <td className="num px-2 text-center">{sections}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs" data-title="اكتمال الشعب">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-[11px] text-muted-foreground">
                <th className="px-3 py-2 text-right">الشعبة</th>
                <th className="px-2 py-2">الحصص</th>
                <th className="px-2 py-2">الخانات</th>
                <th className="px-2 py-2">الاكتمال</th>
                <th className="px-2 py-2">المواد</th>
                <th className="px-2 py-2">المعلمون</th>
                <th className="px-2 py-2">بلا معلم</th>
                <th className="px-2 py-2">الدوام</th>
                <th className="px-2 py-2">مربي الصف</th>
              </tr>
            </thead>
            <tbody>
              {sectionRows.map(({ g, n, capacity, teachers, subjects, noTeacher }) => (
                <tr
                  key={g.id}
                  onClick={() => onPick("sections", g.id)}
                  className="cursor-pointer border-b border-border hover:bg-secondary"
                >
                  <td className="px-3 py-1.5 font-semibold">{g.label}</td>
                  <td className="num px-2 text-center font-black">{n}</td>
                  <td className="num px-2 text-center">{capacity}</td>
                  <td
                    className={cn(
                      "num px-2 text-center font-bold",
                      n >= capacity
                        ? "text-success"
                        : n === 0
                          ? "text-destructive"
                          : "text-warm-foreground",
                    )}
                  >
                    {capacity ? Math.round((n / capacity) * 100) : 0}%
                  </td>
                  <td className="num px-2 text-center">{subjects}</td>
                  <td className="num px-2 text-center">{teachers}</td>
                  <td className={cn("num px-2 text-center", noTeacher && "text-destructive")}>
                    {noTeacher}
                  </td>
                  <td className="num px-2 text-center text-[10px]">{timeOf(g)}</td>
                  <td className="px-2 text-[11px]">
                    {g.homeroom ? (index.teachers.get(g.homeroom)?.name ?? g.homeroom) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/** A quota typed straight into the teachers' table; saved on Enter or leaving the field. */
function QuotaInput({
  teacher,
  quota,
  onSave,
}: {
  teacher: string;
  quota: number;
  onSave: (teacher: string, quota: number) => void;
}) {
  const [value, setValue] = useState(String(quota || ""));
  const commit = () => {
    const next = Math.max(0, Math.round(Number(value) || 0));
    if (next !== quota) onSave(teacher, next);
  };
  return (
    <input
      type="number"
      min={0}
      max={60}
      value={value}
      placeholder="—"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="num h-7 w-14 rounded-md border border-border bg-background px-1 text-center text-xs focus:border-primary"
      aria-label="النصاب الأسبوعي"
    />
  );
}

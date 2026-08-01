import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useState } from "react";
import { PageHeader, Pill } from "@/components/shared/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { classes, periods, subjects, timetable, weekDays } from "@/lib/mock-data";

export const Route = createFileRoute("/app/timetable")({
  head: () => ({
    meta: [
      { title: "الجدول الدراسي — Match Education" },
      { name: "description", content: "جدول أسبوعي مرئي لكل صف ومعلم بأيام وحصص وألوان مميزة لكل مادة." },
      { property: "og:title", content: "الجدول الدراسي — Match Education" },
      { property: "og:description", content: "شبكة أيام × حصص بألوان لكل مادة دراسية." },
    ],
  }),
  component: TimetablePage,
});

const slotColor: Record<string, string> = {
  primary: "bg-primary-soft text-primary border-primary/25",
  accent: "bg-success-soft text-accent border-accent/25",
  warm: "bg-warm-soft text-warm-foreground border-warning/30",
  info: "bg-info-soft text-info border-info/25",
  success: "bg-success-soft text-success border-success/25",
  destructive: "bg-destructive-soft text-destructive border-destructive/25",
};

function TimetablePage() {
  const [classId, setClassId] = useState(classes[0]!.id);
  const selected = classes.find((c) => c.id === classId)!;

  return (
    <>
      <PageHeader
        title="الجدول الدراسي"
        subtitle={`${selected.grade} - شعبة ${selected.section} • الأسبوع الحالي`}
        actions={
          <>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="h-10 w-[180px] rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.grade} - {c.section}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              <Printer className="size-4" />
              <span className="hidden sm:inline">طباعة</span>
            </button>
          </>
        }
      />

      <div className="card-surface overflow-x-auto p-4">
        <table className="w-full min-w-[860px] border-separate border-spacing-1.5 text-center text-sm">
          <thead>
            <tr>
              <th className="w-24 rounded-xl bg-secondary px-2 py-3 text-xs font-bold text-muted-foreground">الحصة / اليوم</th>
              {weekDays.map((d) => (
                <th key={d} className="rounded-xl bg-secondary px-2 py-3 text-xs font-bold">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, pi) => (
              <tr key={p}>
                <td className="rounded-xl bg-secondary/60 px-2 py-3 text-xs font-semibold text-muted-foreground">{p}</td>
                {weekDays.map((d) => {
                  const slot = timetable[d]?.[(pi + weekDays.indexOf(d)) % periods.length];
                  if (!slot) return <td key={d} />;
                  if (pi === 3) {
                    return (
                      <td key={d} className="rounded-xl border border-dashed border-border bg-muted/40 px-2 py-4 text-xs font-semibold text-muted-foreground">
                        فسحة
                      </td>
                    );
                  }
                  return (
                    <td key={d} className={`rounded-xl border px-2 py-3 transition-transform hover:scale-[1.02] ${slotColor[slot.color]}`}>
                      <p className="text-xs font-bold">{slot.subject}</p>
                      <p className="mt-1 truncate text-[11px] opacity-75">{slot.teacher}</p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {subjects.map((s) => (
          <Pill key={s.id} tone={s.color === "warm" ? "warning" : s.color === "destructive" ? "danger" : s.color === "accent" ? "success" : s.color === "info" ? "info" : "primary"}>
            {s.name}
          </Pill>
        ))}
      </div>
    </>
  );
}

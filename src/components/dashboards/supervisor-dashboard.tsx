import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardCheck, GraduationCap, UserCheck, Users } from "lucide-react";
import { PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { apiGet } from "@/lib/api/client";
import { useApp } from "@/lib/app-context";

interface MyScope {
  role: string;
  roleLabel: string;
  sections: Array<{
    id: string;
    label: string;
    program: string;
    students: number;
    homeroom: string;
  }>;
  programs: string[];
}

const LINKS = [
  { to: "/app/attendance", label: "الحضور", icon: UserCheck },
  { to: "/app/record", label: "العلامات", icon: ClipboardCheck },
  { to: "/app/timetable", label: "الجدول", icon: CalendarDays },
  { to: "/app/students", label: "الطلاب", icon: Users },
];

/**
 * A supervisor's front page: the sections they watch, grouped by grade, each
 * one click from its register, marks and timetable. Everything behind it is
 * read-only, and the server narrows every screen to these sections.
 */
export function SupervisorDashboard() {
  const { session, roleLabel } = useApp();
  const scope = useQuery<MyScope>({
    queryKey: ["roles", "my-scope"],
    queryFn: () => apiGet("roles.my_scope"),
  });

  if (scope.isLoading) return <DashboardSkeleton />;
  if (scope.error) return <ErrorState error={scope.error} onRetry={() => scope.refetch()} />;
  const sections = scope.data?.sections ?? [];
  const grades = [...new Set(sections.map((s) => s.program || "بلا صف"))];
  const pupils = sections.reduce((n, s) => n + s.students, 0);

  return (
    <>
      <PageHeader
        title={session?.name ? `أهلاً ${session.name}` : roleLabel}
        subtitle={`${roleLabel} · ${sections.length} شعبة · ${pupils} طالب`}
      />
      {sections.length === 0 ? (
        <div className="mt-5">
          <EmptyBlock
            title="لم تُحدَّد لك شعب بعد"
            description="يحدّد المدير الصفوف والشعب التي تشرف عليها من ملفك في «الطاقم الإداري»."
            icon={<GraduationCap className="size-6" />}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {grades.map((grade) => (
            <SectionCard key={grade} title={grade} description="الشعب التي تشرف عليها في هذا الصف">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sections
                  .filter((s) => (s.program || "بلا صف") === grade)
                  .map((s) => (
                    <div key={s.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold">{s.label}</p>
                        <Pill tone="muted">{s.students} طالب</Pill>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {s.homeroom ? `مربي الصف: ${s.homeroom}` : "بلا مربي صف"}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {LINKS.map((l) => (
                          <a
                            key={l.to}
                            href={`${l.to}?group=${encodeURIComponent(s.id)}`}
                            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:border-primary/40 hover:text-primary"
                          >
                            <l.icon className="size-3" />
                            {l.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </>
  );
}

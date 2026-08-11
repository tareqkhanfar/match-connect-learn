import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, CalendarRange, Download, FileText, Printer, Users } from "lucide-react";
import { KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GradeBadge } from "@/components/shared/grade-badge";
import { downloadQuarterCard } from "@/lib/api/export";
import {
  useMyGroups,
  useQuarterResults,
  useQuarters,
  useSubjects,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/app/quarter-results")({
  head: () => ({
    meta: [
      { title: "شهادات الأرباع — Match Education" },
      {
        name: "description",
        content: "نتائج كل ربع دراسي وطباعة شهادة الشهرين للطلاب.",
      },
    ],
  }),
  component: QuarterResultsPage,
});

function QuarterResultsPage() {
  const groups = useMyGroups();
  const subjects = useSubjects();
  const quartersQuery = useQuarters();

  const [group, setGroup] = useState("");
  const [quarter, setQuarter] = useState("");
  const [course, setCourse] = useState("");
  const [search, setSearch] = useState("");
  const [printing, setPrinting] = useState<string | null>(null);

  const quarters = quartersQuery.data?.quarters ?? [];
  const results = useQuarterResults(group || undefined, quarter || undefined, course || undefined);

  const students = useMemo(() => {
    const rows = results.data?.students ?? [];
    const needle = search.trim();
    if (!needle) return rows;
    return rows.filter((s) => s.studentName.includes(needle) || s.student.includes(needle));
  }, [results.data, search]);

  async function print(student: string) {
    if (!quarter) return;
    setPrinting(student);
    try {
      await downloadQuarterCard(student, quarter, { studentGroup: group });
      toast.success("تم تنزيل الشهادة");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إنشاء الشهادة");
    } finally {
      setPrinting(null);
    }
  }

  const courses = results.data?.courses ?? [];

  return (
    <>
      <PageHeader
        title="شهادات الأرباع"
        subtitle="نتائج كل ربع على حدة — لطباعة شهادة الشهرين قبل نهاية الفصل."
      />

      {/* Filters ------------------------------------------------------- */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>الشعبة</Label>
          <SearchableSelect
            options={(groups.data ?? []).map((g) => ({
              value: g.name,
              label: g.student_group_name ?? g.name,
              ...(g.program ? { hint: g.program } : {}),
            }))}
            value={group}
            onChange={setGroup}
            placeholder="اختر الشعبة"
            searchPlaceholder="ابحث عن شعبة…"
          />
        </div>

        <div className="space-y-1.5">
          <Label>الربع</Label>
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">اختر الربع</option>
            {quarters.map((q) => (
              <option key={q.name} value={q.name}>
                {q.name} — {q.totalMarks} علامة
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label>المادة (اختياري)</Label>
          <SearchableSelect
            options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={course}
            onChange={setCourse}
            placeholder="كل المواد"
            searchPlaceholder="ابحث عن مادة…"
            clearable
            clearLabel="كل المواد"
          />
        </div>

        <div className="space-y-1.5">
          <Label>بحث</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="اسم الطالب أو رقمه…"
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      {quarters.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock
            title="لم يتم تقسيم الفصل إلى أرباع"
            description="عرّف الأرباع من شاشة خطة التقييم أولاً."
            icon={<CalendarRange className="size-6" />}
          />
        </div>
      ) : !group || !quarter ? (
        <div className="mt-6">
          <EmptyBlock
            title="اختر الشعبة والربع"
            description="ستظهر نتائج كل طالب مع إمكانية طباعة شهادته."
            icon={<FileText className="size-6" />}
          />
        </div>
      ) : results.error ? (
        <div className="mt-6">
          <ErrorState error={results.error} onRetry={() => results.refetch()} />
        </div>
      ) : results.isLoading ? (
        <div className="mt-6">
          <TableSkeleton rows={6} />
        </div>
      ) : students.length === 0 ? (
        <div className="mt-6">
          <EmptyBlock
            title="لا توجد نتائج"
            description="لم تُرصد علامات في هذا الربع بعد، أو لا توجد خطة تقييم للمواد."
            icon={<Award className="size-6" />}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <KpiCard label="عدد الطلاب" value={students.length} icon={Users} tone="primary" />
            <KpiCard
              label="معدل الشعبة"
              value={`${results.data?.classAverage ?? 0}%`}
              icon={Award}
              tone="accent"
            />
            <KpiCard
              label="علامة الربع"
              value={results.data?.quarterTotal ?? 0}
              icon={CalendarRange}
              tone="info"
            />
          </div>

          <div className="mt-6">
            <SectionCard
              title={`نتائج ${quarter}`}
              description={
                course
                  ? `${course} فقط`
                  : `${courses.length} مواد — المجموع من ${results.data?.students[0]?.outOf ?? 0} علامة`
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-2 pl-4 font-medium">الطالب</th>
                      {courses.map((c) => (
                        <th key={c} className="whitespace-nowrap py-2 pl-4 font-medium">
                          {c}
                        </th>
                      ))}
                      <th className="py-2 pl-4 font-medium">المجموع</th>
                      <th className="py-2 pl-4 font-medium">المعدل</th>
                      <th className="py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.student} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pl-4">
                          <span className="font-medium">{s.studentName}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {s.student}
                          </span>
                        </td>
                        {courses.map((c) => {
                          const sub = s.subjects[c];
                          return (
                            <td key={c} className="py-2.5 pl-4 tabular-nums">
                              {sub ? `${sub.marks} / ${sub.totalMarks}` : "—"}
                            </td>
                          );
                        })}
                        <td className="py-2.5 pl-4 font-bold tabular-nums">
                          {s.total} / {s.outOf}
                        </td>
                        <td className="py-2.5 pl-4">
                          <GradeBadge percentage={s.average} size="sm" showPercentage />
                        </td>
                        <td className="py-2.5">
                          <button
                            onClick={() => print(s.student)}
                            disabled={printing === s.student}
                            className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                          >
                            {printing === s.student ? (
                              "جارٍ…"
                            ) : (
                              <>
                                <Printer className="size-3" />
                                شهادة
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground">
                الشهادة تعرض نتائج {quarter} فقط من {results.data?.quarterTotal ?? 0} علامة، ولا
                تمثّل النتيجة النهائية للفصل.
              </p>
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}

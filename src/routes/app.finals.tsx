import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowUp, Award, Layers, Minus, Printer, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, KpiCard, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { GradeBadge } from "@/components/shared/grade-badge";
import { StudentPicker } from "@/components/shared/student-picker";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { useAcademicRecord, type SubjectGrade } from "@/lib/api/hooks";
import { downloadReportCard } from "@/lib/api/export";
import { isBackOffice } from "@/lib/roles";

export const Route = createFileRoute("/app/finals")({
  head: () => ({
    meta: [
      { title: "العلامات النهائية — Match Education" },
      {
        name: "description",
        content: "العلامة النهائية لكل مادة من 100، مع معدل الشعبة ومعدل الصف.",
      },
    ],
  }),
  component: FinalsPage,
});

/**
 * The term's final marks, on their own page.
 *
 * `/app/record` shows the working — every component, its weight, how the mark
 * was reached. This page shows only the answer: each subject out of 100 after
 * the teacher's counting rule, and the two comparisons a family asks about.
 * They are separate screens because they answer different questions, and the
 * result should not be something you have to scroll past the arithmetic to see.
 */
function FinalsPage() {
  const { role } = useApp();
  // Students and parents are scoped to one person; staff pick from the list.
  const viewed = useViewedStudent();
  const [picked, setPicked] = useState("");
  const backOffice = isBackOffice(role);
  const staff = backOffice || role === "teacher";
  const student = staff ? picked : viewed;

  const [printing, setPrinting] = useState(false);
  const record = useAcademicRecord(student || undefined);
  const data = record.data;

  async function print(term: string | null) {
    if (!student) return;
    setPrinting(true);
    try {
      await downloadReportCard(student, term ?? undefined);
      toast.success("تم تجهيز كشف العلامات");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إصدار الكشف");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="العلامات النهائية"
        subtitle="العلامة النهائية لكل مادة من 100، مقارنةً بالشعبة وبالصف"
      />

      {staff && (
        <div className="mt-5">
          <StudentPicker
            value={picked}
            onChange={setPicked}
            placeholder="ابحث عن طالب لعرض علاماته النهائية"
          />
        </div>
      )}

      {!student ? (
        <div className="mt-6">
          <EmptyBlock
            title="اختر طالباً لعرض علاماته النهائية"
            icon={<Users className="size-6" />}
          />
        </div>
      ) : record.isLoading ? (
        <div className="mt-6">
          <DashboardSkeleton />
        </div>
      ) : record.error ? (
        <div className="mt-6">
          <ErrorState error={record.error} onRetry={() => record.refetch()} />
        </div>
      ) : !data?.periods.length ? (
        <div className="mt-6">
          <EmptyBlock
            title="لا توجد علامات مسجّلة لهذا الطالب"
            icon={<Award className="size-6" />}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card-surface flex items-center gap-3 p-4">
              <Avatar name={data.student_name ?? ""} className="size-12 rounded-2xl text-sm" />
              <div className="min-w-0">
                <p className="truncate font-bold">{data.student_name}</p>
                <p className="num truncate text-xs text-muted-foreground">{data.student}</p>
              </div>
            </div>
            <KpiCard label="عدد الفصول" value={data.periods.length} icon={Layers} tone="info" />
            <KpiCard
              label="عدد المواد"
              value={data.periods.reduce((a, p) => a + p.subjects.length, 0)}
              icon={Award}
              tone="accent"
            />
          </div>

          <div className="mt-6 space-y-5">
            {data.periods.map((period, i) => (
              <SectionCard
                key={`${period.academic_year}-${period.academic_term}-${i}`}
                title={period.academic_year ?? "—"}
                description={period.academic_term ?? "كل الفصول"}
                actions={
                  <div className="flex items-center gap-2">
                    {period.shows_overall && period.overall_grade ? (
                      <GradeBadge
                        percentage={period.overall ?? 0}
                        grade={period.overall_grade.grade}
                        emoji={period.overall_grade.emoji}
                        label={period.overall_grade.label}
                        size="lg"
                      />
                    ) : (
                      <Pill tone="muted">
                        {period.published ? "المعدل لدى الإدارة" : "لم تُنشر النتائج"}
                      </Pill>
                    )}
                    <button
                      onClick={() => print(period.academic_term)}
                      disabled={printing}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                      <Printer className="size-3.5" />
                      {printing ? "جارٍ…" : "كشف العلامات"}
                    </button>
                  </div>
                }
              >
                {period.subjects.length === 0 ? (
                  <EmptyBlock title="لا توجد مواد في هذا الفصل" />
                ) : (
                  <FinalMarksTable subjects={period.subjects} />
                )}
              </SectionCard>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** How a mark compares to an average: an arrow, or nothing when they match. */
function Delta({ mine, average }: { mine: number; average: number | null | undefined }) {
  if (average == null) return <span className="text-muted-foreground">—</span>;
  const diff = Math.round((mine - average) * 10) / 10;
  return (
    <span className="flex items-center gap-1">
      <span className="num">{average}%</span>
      {diff > 0.05 ? (
        <ArrowUp className="size-3.5 text-emerald-600" />
      ) : diff < -0.05 ? (
        <ArrowDown className="size-3.5 text-red-600" />
      ) : (
        <Minus className="size-3.5 text-muted-foreground" />
      )}
    </span>
  );
}

export function FinalMarksTable({ subjects }: { subjects: SubjectGrade[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-right text-sm">
        <thead className="bg-secondary/50 text-xs text-muted-foreground">
          <tr>
            <th className="p-3 font-semibold">المادة</th>
            <th className="p-3 font-semibold">العلامة النهائية</th>
            <th className="p-3 font-semibold">التقدير</th>
            <th className="p-3 font-semibold">معدل الشعبة</th>
            <th className="p-3 font-semibold">معدل الصف</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {subjects.map((s) => (
            <tr key={s.course}>
              <td className="p-3 font-semibold">{s.course}</td>
              <td className="num p-3 font-bold">
                {s.final}
                <span className="text-xs font-normal text-muted-foreground"> / 100</span>
              </td>
              <td className="p-3">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>{s.emoji}</span>
                  <span className="text-xs">{s.label}</span>
                </span>
              </td>
              <td className="p-3">
                <Delta mine={s.final} average={s.section_average} />
              </td>
              <td className="p-3">
                <Delta mine={s.final} average={s.grade_average} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

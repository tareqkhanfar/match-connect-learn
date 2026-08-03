import { createFileRoute } from "@tanstack/react-router";
import { Award, FileText, GraduationCap, Layers, Printer, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  KpiCard,
  PageHeader,
  Pill,
  ProgressBar,
  SectionCard,
} from "@/components/shared/ui-kit";
import { GradeBadge, GradeHero, progressTone } from "@/components/shared/grade-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useAcademicRecord, useStudents, type SubjectGrade } from "@/lib/api/hooks";
import { downloadReportCard } from "@/lib/api/export";
import { isBackOffice } from "@/lib/roles";

export const Route = createFileRoute("/app/record")({
  head: () => ({
    meta: [
      { title: "سجل العلامات — Match Education" },
      {
        name: "description",
        content: "السجل الأكاديمي الكامل لكل سنة دراسية وفصل مع المعدل التراكمي.",
      },
    ],
  }),
  component: RecordPage,
});

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function RecordPage() {
  const { role, session } = useApp();
  const canPick = isBackOffice(role) || role === "teacher";

  // A student opens their own record; a parent picks between their children.
  const own = session?.scope.student ?? session?.scope.students?.[0] ?? "";
  const [student, setStudent] = useState(own);

  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const studentsQuery = useStudents(
    canPick ? { ...(debounced ? { search: debounced } : {}), page_size: 20 } : { page_size: 1 },
  );

  const query = useAcademicRecord(student || undefined);
  const [printing, setPrinting] = useState(false);

  async function printReportCard() {
    if (!student) return;
    setPrinting(true);
    try {
      await downloadReportCard(student);
      toast.success("تم تنزيل بطاقة الدرجات");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إنشاء البطاقة");
    } finally {
      setPrinting(false);
    }
  }

  const parentChildren = session?.scope.students ?? [];

  return (
    <>
      <PageHeader
        title="سجل العلامات"
        subtitle="السجل الأكاديمي لكل سنة وفصل دراسي"
        actions={
          student ? (
            <button
              onClick={printReportCard}
              disabled={printing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
            >
              <Printer className="size-4" />
              {printing ? "جارٍ التجهيز…" : "بطاقة الدرجات PDF"}
            </button>
          ) : null
        }
      />

      {/* Staff search for a student; a parent switches between children. */}
      {canPick ? (
        <div className="card-surface mb-5 grid gap-3 p-4 md:grid-cols-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن طالب..."
            className="h-10 rounded-xl"
          />
          <Select value={student} onValueChange={setStudent}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="اختر الطالب" />
            </SelectTrigger>
            <SelectContent>
              {(studentsQuery.data?.items ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : parentChildren.length > 1 ? (
        <div className="card-surface mb-5 p-4">
          <Select value={student} onValueChange={setStudent}>
            <SelectTrigger className="h-10 rounded-xl md:w-[300px]">
              <SelectValue placeholder="اختر الابن" />
            </SelectTrigger>
            <SelectContent>
              {parentChildren.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {!student ? (
        <EmptyBlock title="اختر طالباً لعرض سجله" icon={<GraduationCap className="size-6" />} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={8} />
      ) : !query.data?.periods.length ? (
        <EmptyBlock
          title="لا توجد علامات مسجّلة"
          description="لم يتم إدخال أي علامات لهذا الطالب بعد."
          icon={<Award className="size-6" />}
        />
      ) : (
        <RecordBody data={query.data} />
      )}
    </>
  );
}

function RecordBody({ data }: { data: NonNullable<ReturnType<typeof useAcademicRecord>["data"]> }) {
  const totalSubjects = data.periods.reduce((a, p) => a + p.subjects.length, 0);
  const best = data.periods
    .flatMap((p) => p.subjects)
    .reduce<SubjectGrade | null>((top, s) => (!top || s.final > top.final ? s : top), null);

  return (
    <>
      <div className="mb-5 grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <GradeHero
          percentage={data.cumulative}
          grade={data.cumulative_grade.grade}
          emoji={data.cumulative_grade.emoji}
          label={data.cumulative_grade.label}
          caption="المعدل التراكمي"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card-surface flex items-center gap-3 p-4">
            <Avatar name={data.student_name ?? ""} className="size-12 rounded-2xl text-sm" />
            <div className="min-w-0">
              <p className="truncate font-bold">{data.student_name}</p>
              <p className="num truncate text-xs text-muted-foreground">{data.student}</p>
            </div>
          </div>
          <KpiCard label="عدد الفصول" value={data.periods.length} icon={Layers} tone="info" />
          <KpiCard
            label="عدد المواد المقيّمة"
            value={totalSubjects}
            icon={FileText}
            tone="accent"
          />
          {best && (
            <div className="card-surface p-4">
              <p className="text-xs text-muted-foreground">أفضل مادة</p>
              <p className="mt-1 truncate text-sm font-bold">{best.course}</p>
              <div className="mt-2">
                <GradeBadge
                  percentage={best.final}
                  grade={best.grade}
                  emoji={best.emoji}
                  label={best.label}
                  size="sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {data.periods.map((period, i) => (
          <SectionCard
            key={`${period.academic_year}-${period.academic_term}-${i}`}
            title={period.academic_year ?? "—"}
            description={period.academic_term ?? "كل الفصول"}
            actions={
              <GradeBadge
                percentage={period.overall}
                grade={period.overall_grade.grade}
                emoji={period.overall_grade.emoji}
                label={period.overall_grade.label}
                size="lg"
              />
            }
          >
            {period.subjects.length === 0 ? (
              <EmptyBlock title="لا توجد مواد في هذا الفصل" />
            ) : (
              <div className="space-y-4">
                {period.subjects.map((s) => (
                  <SubjectRow key={`${period.academic_term}-${s.course}`} subject={s} />
                ))}
              </div>
            )}
          </SectionCard>
        ))}
      </div>
    </>
  );
}

function SubjectRow({ subject }: { subject: SubjectGrade }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3.5 text-right transition-colors hover:bg-secondary/40"
      >
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-bold">{subject.course}</p>
            <span className="num shrink-0 text-xs text-muted-foreground">
              {subject.components.length} مكوّن
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar value={subject.final} tone={progressTone(subject.final)} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>الموزون {subject.percentage}%</span>
            {subject.bonus > 0 && <span className="text-success">+{subject.bonus} إضافي</span>}
            {subject.covered < 100 && <span>مُدخل {subject.covered}% من الخطة</span>}
          </div>
        </div>
        <GradeBadge
          percentage={subject.final}
          grade={subject.grade}
          emoji={subject.emoji}
          label={subject.label}
          size="lg"
        />
      </button>

      {open && (
        <div className="border-t border-border p-3.5">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 font-semibold">المكوّن</th>
                  <th className="pb-2 font-semibold">النوع</th>
                  <th className="pb-2 font-semibold">الدرجة</th>
                  <th className="pb-2 font-semibold">الوزن</th>
                  <th className="pb-2 font-semibold">التقدير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subject.components.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 font-medium">
                      {c.component_name}
                      {c.is_bonus && (
                        <span className="mr-2 inline-block">
                          <Pill tone="success">إضافي</Pill>
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">{c.type_label}</td>
                    <td className="num py-2">
                      {c.score}/{c.max_score}
                    </td>
                    <td className="num py-2 text-muted-foreground">{c.weight}%</td>
                    <td className="py-2">
                      <GradeBadge
                        percentage={c.percentage}
                        grade={c.grade}
                        emoji={c.emoji}
                        label={c.label}
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

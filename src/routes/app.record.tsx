import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  Printer,
  TrendingUp,
  Users,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { StudentPicker } from "@/components/shared/student-picker";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import {
  useAcademicRecord,
  useClasses,
  useClassTermGrades,
  type SubjectGrade,
} from "@/lib/api/hooks";
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
  const { role } = useApp();
  // The same data means different things per role: staff scan a whole class
  // and drill in; a student reads their own record; a parent picks a child.
  if (isBackOffice(role) || role === "teacher") return <StaffRecordView />;
  return <PersonalRecordView />;
}

/** Class-wide marks for admin, secretary and teachers. */
function StaffRecordView() {
  const { role } = useApp();
  const classesQuery = useClasses({});
  const [group, setGroup] = useState("");
  const [student, setStudent] = useState("");
  const [printing, setPrinting] = useState(false);

  // Default to the first class the viewer is responsible for.
  useEffect(() => {
    if (!group && classesQuery.data?.length) setGroup(classesQuery.data[0]!.name);
  }, [classesQuery.data, group]);

  const classGrades = useClassTermGrades(group ? { student_group: group } : {});
  const detail = useAcademicRecord(student || undefined);

  async function printReportCard(target: string) {
    setPrinting(true);
    try {
      await downloadReportCard(target);
      toast.success("تم تنزيل بطاقة الدرجات");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إنشاء البطاقة");
    } finally {
      setPrinting(false);
    }
  }

  const rows = classGrades.data?.rows ?? [];
  // Students with no marks yet must not drag the class average down.
  const graded = rows.filter((r) => r.entries > 0);
  const classAverage = Math.round(classGrades.data?.class_average ?? 0);
  const passing = graded.filter((r) => r.final >= 50).length;
  const atRisk = graded.filter((r) => r.final < 50).length;

  return (
    <>
      <PageHeader
        title={role === "teacher" ? "علامات طلابي" : "علامات الطلبة"}
        subtitle={
          role === "teacher"
            ? "متابعة مستوى طلاب شُعبك ورصد المتعثرين"
            : "نظرة شاملة على مستوى الطلبة لكل شعبة مع إمكانية التعمق في سجل أي طالب"
        }
      />

      <div className="card-surface mb-5 grid gap-3 p-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">الشعبة</Label>
          <SearchableSelect
            options={(classesQuery.data ?? []).map((c) => ({
              value: c.name,
              label: c.student_group_name,
              code: c.name,
              hint: `${c.students} طالباً`,
            }))}
            value={group}
            onChange={(g) => {
              setGroup(g);
              setStudent("");
            }}
            placeholder="اختر الشعبة"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">طالب بعينه (اختياري)</Label>
          <StudentPicker
            value={student}
            onChange={setStudent}
            placeholder="ابحث عن طالب للتعمق في سجله"
            clearable
            clearLabel="عرض الشعبة كاملة"
          />
        </div>
      </div>

      {student ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStudent("")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              <ArrowRight className="size-3.5" />
              رجوع لكامل الشعبة
            </button>
            <button
              onClick={() => printReportCard(student)}
              disabled={printing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <Printer className="size-3.5" />
              {printing ? "جارٍ التجهيز…" : "بطاقة الدرجات PDF"}
            </button>
          </div>
          {detail.error ? (
            <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
          ) : detail.isLoading ? (
            <TableSkeleton rows={8} />
          ) : !detail.data?.periods.length ? (
            <EmptyBlock title="لا توجد علامات مسجّلة لهذا الطالب" icon={<Award className="size-6" />} />
          ) : (
            <RecordBody data={detail.data} />
          )}
        </>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="عدد الطلاب" value={rows.length} icon={Users} tone="primary" />
            <KpiCard label="معدل الشعبة" value={`${classAverage}%`} icon={TrendingUp} tone="info" />
            <KpiCard label="ناجحون" value={passing} icon={Award} tone="accent" />
            <KpiCard label="متعثرون" value={atRisk} icon={AlertTriangle} tone="warm" />
          </div>

          <SectionCard
            title="مستوى الطلبة"
            description={`${rows.length} طالباً — اضغط على أي طالب لعرض سجله الكامل`}
            actions={<Layers className="size-4 text-muted-foreground" />}
          >
            {classGrades.error ? (
              <ErrorState error={classGrades.error} onRetry={() => classGrades.refetch()} />
            ) : classGrades.isLoading ? (
              <TableSkeleton rows={8} />
            ) : rows.length === 0 ? (
              <EmptyBlock title="لا يوجد طلاب في هذه الشعبة" icon={<Users className="size-6" />} />
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.student}>
                    <button
                      onClick={() => setStudent(r.student)}
                      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-right transition-colors hover:bg-secondary/40"
                    >
                      <Avatar name={r.student_name} className="size-9 rounded-xl text-xs" />
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold">{r.student_name}</p>
                          <span className="num shrink-0 text-xs text-muted-foreground">
                            {r.entries} مكوّن
                          </span>
                        </div>
                        <div className="mt-2">
                          <ProgressBar value={r.final} tone={progressTone(r.final)} />
                        </div>
                      </div>
                      <GradeBadge
                        percentage={r.final}
                        grade={r.grade}
                        emoji={r.emoji}
                        label={r.label}
                        size="sm"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </>
  );
}

/** A student reading their own record, or a parent reading a child's. */
function PersonalRecordView() {
  const { role, session } = useApp();
  const children = session?.scope.children ?? [];
  const own = session?.scope.student ?? children[0]?.id ?? "";
  const [student, setStudent] = useState(own);
  const [printing, setPrinting] = useState(false);

  const query = useAcademicRecord(student || undefined);

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

  return (
    <>
      <PageHeader
        title={role === "parent" ? "علامات الأبناء" : "علاماتي"}
        subtitle={
          role === "parent"
            ? "السجل الأكاديمي لكل ابن عبر السنوات والفصول"
            : "سجلك الأكاديمي الكامل لكل سنة وفصل دراسي"
        }
        actions={
          student ? (
            <button
              onClick={printReportCard}
              disabled={printing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <Printer className="size-4" />
              {printing ? "جارٍ التجهيز…" : "بطاقة الدرجات PDF"}
            </button>
          ) : null
        }
      />

      {/* A parent with more than one child chooses between them. */}
      {role === "parent" && children.length > 1 && (
        <div className="card-surface mb-5 p-4">
          <Label className="mb-1.5 block text-xs">الابن</Label>
          <SearchableSelect
            options={children.map((c) => ({ value: c.id, label: c.name, code: c.id }))}
            value={student}
            onChange={setStudent}
            placeholder="اختر الابن"
            className="md:w-[320px]"
          />
        </div>
      )}

      {!student ? (
        <EmptyBlock title="لا يوجد سجل لعرضه" icon={<GraduationCap className="size-6" />} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton rows={8} />
      ) : !query.data?.periods.length ? (
        <EmptyBlock
          title="لا توجد علامات مسجّلة"
          description="لم يتم إدخال أي علامات بعد."
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
        {data.shows_cumulative && data.cumulative_grade ? (
          <GradeHero
            percentage={data.cumulative ?? 0}
            grade={data.cumulative_grade.grade}
            emoji={data.cumulative_grade.emoji}
            label={data.cumulative_grade.label}
            caption="المعدل التراكمي"
          />
        ) : (
          /* The total belongs to the administration, or the term is not
             published yet — say so rather than showing a misleading zero. */
          <div className="card-surface flex flex-col items-center justify-center gap-2 p-6 text-center">
            <Lock className="size-6 text-muted-foreground" />
            <p className="text-sm font-semibold">المعدل غير متاح</p>
            <p className="text-xs text-muted-foreground">
              يظهر المعدل التراكمي بعد اعتماد الإدارة ونشر نتائج الفصل.
            </p>
          </div>
        )}

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
              period.shows_overall && period.overall_grade ? (
                <GradeBadge
                  percentage={period.overall ?? 0}
                  grade={period.overall_grade.grade}
                  emoji={period.overall_grade.emoji}
                  label={period.overall_grade.label}
                  size="lg"
                />
              ) : (
                <Pill tone="muted">
                  <Lock className="ml-1 inline size-3" />
                  {period.published ? "المعدل لدى الإدارة" : "لم تُنشر النتائج"}
                </Pill>
              )
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

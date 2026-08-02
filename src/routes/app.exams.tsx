import { createFileRoute } from "@tanstack/react-router";
import { Award, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useApp } from "@/lib/app-context";
import { useExams, useGrades } from "@/lib/api/hooks";

export const Route = createFileRoute("/app/exams")({
  head: () => ({
    meta: [
      { title: "الامتحانات والدرجات — Match Education" },
      {
        name: "description",
        content: "جدول الامتحانات وإدخال الدرجات وبطاقات الدرجات القابلة للطباعة.",
      },
      { property: "og:title", content: "الامتحانات والدرجات — Match Education" },
      { property: "og:description", content: "أدر الامتحانات والدرجات والمعدلات بسهولة." },
    ],
  }),
  component: ExamsPage,
});

/** "13:00:00" -> "13:00" */
function shortTime(t: string) {
  return (t || "").slice(0, 5);
}

function ExamsPage() {
  const { role } = useApp();
  const canSeeAll = role === "admin" || role === "teacher";

  const examsQuery = useExams();
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  const gradesQuery = useGrades(selectedGroup === "all" ? {} : { student_group: selectedGroup });

  const exams = examsQuery.data ?? [];
  const grades = gradesQuery.data ?? [];

  // Group options come from the exams themselves, so they always match data.
  const groups = Array.from(new Set(exams.map((e) => e.student_group).filter(Boolean))) as string[];

  return (
    <>
      <PageHeader title="الامتحانات والدرجات" subtitle="جدول الامتحانات والنتائج المسجّلة" />

      <Tabs defaultValue="schedule" dir="rtl">
        <TabsList className="mb-4 h-auto flex-wrap rounded-xl p-1">
          <TabsTrigger value="schedule" className="rounded-lg">
            جدول الامتحانات
          </TabsTrigger>
          <TabsTrigger value="results" className="rounded-lg">
            النتائج
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <SectionCard title="جدول الامتحانات" description={`${exams.length} امتحاناً مجدولاً`}>
            {examsQuery.error ? (
              <ErrorState error={examsQuery.error} onRetry={() => examsQuery.refetch()} />
            ) : examsQuery.isLoading ? (
              <TableSkeleton rows={6} />
            ) : exams.length === 0 ? (
              <EmptyBlock
                title="لا توجد امتحانات مجدولة"
                icon={<FileSpreadsheet className="size-6" />}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-3 font-semibold">المادة</th>
                      <th className="pb-3 font-semibold">الصف</th>
                      <th className="pb-3 font-semibold">الشعبة</th>
                      <th className="pb-3 font-semibold">التاريخ</th>
                      <th className="pb-3 font-semibold">الوقت</th>
                      <th className="pb-3 font-semibold">القاعة</th>
                      <th className="pb-3 font-semibold">الدرجة العظمى</th>
                      <th className="pb-3 font-semibold">النوع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {exams.map((e) => (
                      <tr key={e.id} className="transition-colors hover:bg-secondary/40">
                        <td className="py-3 font-semibold">{e.subject}</td>
                        <td className="py-3 text-muted-foreground">{e.grade ?? "—"}</td>
                        <td className="py-3 text-muted-foreground">{e.student_group ?? "—"}</td>
                        <td className="num py-3">{e.date}</td>
                        <td className="num py-3 text-muted-foreground">
                          {shortTime(e.time)}
                          {e.to_time ? ` - ${shortTime(e.to_time)}` : ""}
                        </td>
                        <td className="py-3 text-muted-foreground">{e.room ?? "—"}</td>
                        <td className="num py-3 text-muted-foreground">{e.max}</td>
                        <td className="py-3">
                          <Pill tone={e.submitted ? "success" : "info"}>{e.type ?? "—"}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="results">
          <SectionCard
            title="النتائج المسجّلة"
            description={`${grades.length} نتيجة`}
            actions={
              canSeeAll && groups.length > 0 ? (
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="h-9 w-[190px] rounded-xl">
                    <SelectValue placeholder="الشعبة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الشُعب</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null
            }
          >
            {gradesQuery.error ? (
              <ErrorState error={gradesQuery.error} onRetry={() => gradesQuery.refetch()} />
            ) : gradesQuery.isLoading ? (
              <TableSkeleton rows={8} />
            ) : grades.length === 0 ? (
              <EmptyBlock title="لا توجد نتائج مسجّلة" icon={<Award className="size-6" />} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      {canSeeAll && <th className="pb-3 font-semibold">الطالب</th>}
                      <th className="pb-3 font-semibold">المادة</th>
                      <th className="pb-3 font-semibold">الدرجة</th>
                      <th className="pb-3 font-semibold">النسبة</th>
                      <th className="pb-3 font-semibold">التقدير</th>
                      <th className="pb-3 font-semibold">الفصل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {grades.map((g) => (
                      <tr key={g.id} className="transition-colors hover:bg-secondary/40">
                        {canSeeAll && (
                          <td className="py-3">
                            <p className="truncate font-semibold">{g.student_name}</p>
                            <p className="num text-xs text-muted-foreground">{g.student}</p>
                          </td>
                        )}
                        <td className="py-3 font-medium">{g.subject}</td>
                        <td className="num py-3">
                          {g.score}/{g.max}
                        </td>
                        <td className="py-3">
                          <div className="w-28">
                            <ProgressBar
                              value={g.percentage}
                              tone={
                                g.percentage >= 75
                                  ? "success"
                                  : g.percentage >= 50
                                    ? "warning"
                                    : "danger"
                              }
                            />
                            <span className="num mt-1 block text-xs text-muted-foreground">
                              {g.percentage}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          {g.grade ? <Pill tone="muted">{g.grade}</Pill> : "—"}
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">{g.term ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Award, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { PageHeader, Pill, ProgressBar } from "@/components/shared/ui-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import type { ExamRow, GradeRow } from "@/lib/api/types";
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
import { byRole } from "@/lib/roles";
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

  const examColumns: Column<ExamRow>[] = [
    { fieldname: "subject", label: "المادة" },
    { fieldname: "grade", label: "الصف" },
    { fieldname: "student_group", label: "الشعبة" },
    { fieldname: "date", label: "التاريخ", numeric: true },
    {
      fieldname: "time",
      label: "الوقت",
      numeric: true,
      render: (e) => `${shortTime(e.time)}${e.to_time ? ` - ${shortTime(e.to_time)}` : ""}`,
    },
    { fieldname: "room", label: "القاعة", hiddenByDefault: true },
    { fieldname: "max", label: "الدرجة العظمى", numeric: true },
    { fieldname: "term", label: "الفصل", hiddenByDefault: true },
    {
      fieldname: "type",
      label: "النوع",
      render: (e) => <Pill tone={e.submitted ? "success" : "info"}>{e.type ?? "—"}</Pill>,
    },
  ];

  const gradeColumns: Column<GradeRow>[] = [
    ...(canSeeAll
      ? [
          {
            fieldname: "student_name",
            label: "الطالب",
            render: (g: GradeRow) => (
              <div className="min-w-0">
                <p className="truncate font-semibold">{g.student_name}</p>
                <p className="num text-xs text-muted-foreground">{g.student}</p>
              </div>
            ),
          } as Column<GradeRow>,
        ]
      : []),
    { fieldname: "subject", label: "المادة" },
    { fieldname: "score", label: "الدرجة", numeric: true, render: (g) => `${g.score}/${g.max}` },
    {
      fieldname: "percentage",
      label: "النسبة",
      render: (g) => (
        <div className="w-28">
          <ProgressBar
            value={g.percentage}
            tone={g.percentage >= 75 ? "success" : g.percentage >= 50 ? "warning" : "danger"}
          />
          <span className="num mt-1 block text-xs text-muted-foreground">{g.percentage}%</span>
        </div>
      ),
    },
    {
      fieldname: "grade",
      label: "التقدير",
      render: (g) => (g.grade ? <Pill tone="muted">{g.grade}</Pill> : "—"),
    },
    { fieldname: "term", label: "الفصل", hiddenByDefault: true },
  ];

  return (
    <>
      <PageHeader title={byRole(role, "الامتحانات والدرجات", { student: "امتحاناتي", parent: "امتحانات الأبناء" })} subtitle="جدول الامتحانات والنتائج المسجّلة" />

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
          <DataTable
            columns={examColumns}
            rows={exams}
            rowKey={(e) => e.id}
            storageKey="exams"
            isLoading={examsQuery.isLoading}
            error={examsQuery.error}
            onRetry={() => examsQuery.refetch()}
            exportDataset="exams"
            exportTitle="جدول الامتحانات"
            emptyTitle="لا توجد امتحانات مجدولة"
          />
        </TabsContent>

        <TabsContent value="results">
          <DataTable
            columns={gradeColumns}
            rows={grades}
            rowKey={(g) => g.id}
            storageKey="grades"
            isLoading={gradesQuery.isLoading}
            error={gradesQuery.error}
            onRetry={() => gradesQuery.refetch()}
            exportDataset="grades"
            exportFilters={selectedGroup === "all" ? {} : { student_group: selectedGroup }}
            exportTitle="الدرجات"
            emptyTitle="لا توجد نتائج مسجّلة"
            toolbar={
              canSeeAll && groups.length > 0 ? (
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="h-10 w-[190px] rounded-xl">
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
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

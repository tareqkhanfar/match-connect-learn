import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/app-context";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";
import { TeacherDashboard } from "@/components/dashboards/teacher-dashboard";
import { StudentDashboard } from "@/components/dashboards/student-dashboard";
import { ParentDashboard } from "@/components/dashboards/parent-dashboard";
import { SurveyBanner } from "@/components/shared/survey-banner";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — Match Education" },
      {
        name: "description",
        content: "لوحة تحكم مدرسية بمؤشرات الحضور والأداء الأكاديمي والإعلانات.",
      },
      { property: "og:title", content: "لوحة التحكم — Match Education" },
      {
        property: "og:description",
        content: "مؤشرات الأداء، الحضور، وتوزيع الطلاب في نظرة واحدة.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { role } = useApp();
  // Mounted once above whichever dashboard is shown, so the notice cannot
  // drift between the four of them.
  return (
    <>
      <SurveyBanner />
      {role === "teacher" ? (
        <TeacherDashboard />
      ) : role === "student" ? (
        <StudentDashboard />
      ) : role === "parent" ? (
        <ParentDashboard />
      ) : (
        <AdminDashboard />
      )}
    </>
  );
}

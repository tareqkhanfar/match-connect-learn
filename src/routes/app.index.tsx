import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/app-context";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";
import { TeacherDashboard } from "@/components/dashboards/teacher-dashboard";
import { StudentDashboard } from "@/components/dashboards/student-dashboard";
import { ParentDashboard } from "@/components/dashboards/parent-dashboard";

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
  if (role === "teacher") return <TeacherDashboard />;
  if (role === "student") return <StudentDashboard />;
  if (role === "parent") return <ParentDashboard />;
  return <AdminDashboard />;
}

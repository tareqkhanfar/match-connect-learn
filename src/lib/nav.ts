import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  BookOpen,
  ClipboardCheck,
  CalendarDays,
  FileSpreadsheet,
  NotebookPen,
  Wallet,
  MessagesSquare,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./roles";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  group: string;
}

export const navItems: NavItem[] = [
  { label: "لوحة التحكم", to: "/app", icon: LayoutDashboard, roles: ["admin", "teacher", "student", "parent"], group: "عام" },
  { label: "الطلاب", to: "/app/students", icon: Users, roles: ["admin", "teacher"], group: "الإدارة الأكاديمية" },
  { label: "المعلمون", to: "/app/teachers", icon: GraduationCap, roles: ["admin"], group: "الإدارة الأكاديمية" },
  { label: "الصفوف والشُعب", to: "/app/classes", icon: School, roles: ["admin"], group: "الإدارة الأكاديمية" },
  { label: "المواد الدراسية", to: "/app/subjects", icon: BookOpen, roles: ["admin", "teacher"], group: "الإدارة الأكاديمية" },
  { label: "الحضور والغياب", to: "/app/attendance", icon: ClipboardCheck, roles: ["admin", "teacher", "student", "parent"], group: "المتابعة اليومية" },
  { label: "الجدول الدراسي", to: "/app/timetable", icon: CalendarDays, roles: ["admin", "teacher", "student", "parent"], group: "المتابعة اليومية" },
  { label: "الامتحانات والدرجات", to: "/app/exams", icon: FileSpreadsheet, roles: ["admin", "teacher", "student", "parent"], group: "المتابعة اليومية" },
  { label: "الواجبات", to: "/app/assignments", icon: NotebookPen, roles: ["admin", "teacher", "student", "parent"], group: "المتابعة اليومية" },
  { label: "الرسوم المالية", to: "/app/fees", icon: Wallet, roles: ["admin", "student", "parent"], group: "المالية والتواصل" },
  { label: "التواصل والإعلانات", to: "/app/communication", icon: MessagesSquare, roles: ["admin", "teacher", "student", "parent"], group: "المالية والتواصل" },
  { label: "التقارير", to: "/app/reports", icon: BarChart3, roles: ["admin", "teacher"], group: "المالية والتواصل" },
  { label: "الإعدادات", to: "/app/settings", icon: Settings, roles: ["admin"], group: "المالية والتواصل" },
];

export const navGroups = ["عام", "الإدارة الأكاديمية", "المتابعة اليومية", "المالية والتواصل"];

export function navForRole(role: Role) {
  return navItems.filter((i) => i.roles.includes(role));
}

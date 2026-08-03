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
  HeartPulse,
  ShieldAlert,
  Library,
  Bus,
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
  {
    label: "لوحة التحكم",
    to: "/app",
    icon: LayoutDashboard,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "عام",
  },

  // Academic administration
  {
    label: "الطلاب",
    to: "/app/students",
    icon: Users,
    roles: ["admin", "secretary", "teacher"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "المعلمون",
    to: "/app/teachers",
    icon: GraduationCap,
    roles: ["admin", "secretary"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "الصفوف والشُعب",
    to: "/app/classes",
    icon: School,
    roles: ["admin", "secretary"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "المواد الدراسية",
    to: "/app/subjects",
    icon: BookOpen,
    roles: ["admin", "secretary", "teacher"],
    group: "الإدارة الأكاديمية",
  },

  // Day-to-day
  {
    label: "الحضور والغياب",
    to: "/app/attendance",
    icon: ClipboardCheck,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
  },
  {
    label: "الجدول الدراسي",
    to: "/app/timetable",
    icon: CalendarDays,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
  },
  {
    label: "الامتحانات والدرجات",
    to: "/app/exams",
    icon: FileSpreadsheet,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
  },
  {
    label: "الواجبات",
    to: "/app/assignments",
    icon: NotebookPen,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
  },
  {
    label: "السلوك والانضباط",
    to: "/app/behaviour",
    icon: ShieldAlert,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
  },

  // Student services
  {
    label: "الصحة المدرسية",
    to: "/app/health",
    icon: HeartPulse,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "خدمات الطلاب",
  },
  {
    label: "المكتبة",
    to: "/app/library",
    icon: Library,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "خدمات الطلاب",
  },
  {
    label: "النقل المدرسي",
    to: "/app/transport",
    icon: Bus,
    roles: ["admin", "secretary", "student", "parent"],
    group: "خدمات الطلاب",
  },

  // Finance and communication
  {
    label: "الرسوم المالية",
    to: "/app/fees",
    icon: Wallet,
    roles: ["admin", "secretary", "student", "parent"],
    group: "المالية والتواصل",
  },
  {
    label: "التواصل والإعلانات",
    to: "/app/communication",
    icon: MessagesSquare,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المالية والتواصل",
  },
  {
    label: "التقارير",
    to: "/app/reports",
    icon: BarChart3,
    roles: ["admin", "secretary", "teacher"],
    group: "المالية والتواصل",
  },
  {
    label: "الإعدادات",
    to: "/app/settings",
    icon: Settings,
    roles: ["admin"],
    group: "المالية والتواصل",
  },
];

export const navGroups = [
  "عام",
  "الإدارة الأكاديمية",
  "المتابعة اليومية",
  "خدمات الطلاب",
  "المالية والتواصل",
];

export function navForRole(role: Role) {
  return navItems.filter((i) => i.roles.includes(role));
}

import {
  ShieldCheck,
  FileText,
  Layers,
  LayoutGrid,
  LayoutDashboard,
  Users,
  GraduationCap,
  Mail,
  Users2,
  Printer,
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
  BookOpenCheck,
  Award,
  ArrowUpFromLine,
  ScrollText,
  Ticket,
  FileQuestion,
  CalendarCog,
  CalendarClock,
  UserCheck,
  BookMarked,
  ClipboardList,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./roles";

/**
 * A label that may read differently per role.
 *
 * The same screen means different things to different people: "علاماتي" is
 * right for a student but wrong for a principal, who is looking at *other*
 * people's marks. `label` is the fallback; `labelByRole` overrides it.
 */
export interface NavItem {
  label: string;
  labelByRole?: Partial<Record<Role, string>>;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  group: string;
  groupByRole?: Partial<Record<Role, string>>;
}

export const navItems: NavItem[] = [
  {
    label: "لوحة التحكم",
    labelByRole: {
      teacher: "لوحة المعلم",
      student: "صفحتي الرئيسية",
      parent: "متابعة الأبناء",
    },
    to: "/app",
    icon: LayoutDashboard,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "عام",
  },

  // Academic administration
  {
    label: "طلبات الالتحاق",
    to: "/app/admissions",
    icon: UserPlus,
    roles: ["admin", "secretary"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "التسجيل الدراسي",
    to: "/app/enrollment",
    icon: BookOpenCheck,
    roles: ["admin", "secretary"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "الطلاب",
    labelByRole: { teacher: "طلابي" },
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
    label: "أولياء الأمور",
    to: "/app/guardians",
    icon: Users,
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
    label: "البريد",
    to: "/app/mail",
    icon: Mail,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
  },
  {
    label: "مجتمع المدرسة",
    to: "/app/community",
    icon: Users2,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
  },
  {
    label: "طلبات الطباعة",
    labelByRole: { admin: "طابور الطباعة", secretary: "طابور الطباعة" },
    to: "/app/print-requests",
    icon: Printer,
    roles: ["admin", "secretary", "teacher"],
    group: "المتابعة اليومية",
  },
  {
    label: "ترفيع الطلاب",
    to: "/app/promotion",
    icon: GraduationCap,
    roles: ["admin", "secretary"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "المواد الدراسية",
    labelByRole: { teacher: "موادي" },
    to: "/app/subjects",
    icon: BookOpen,
    roles: ["admin", "secretary", "teacher"],
    group: "الإدارة الأكاديمية",
  },

  // Day-to-day
  {
    label: "الحضور والغياب",
    labelByRole: { student: "حضوري", parent: "حضور الأبناء" },
    to: "/app/attendance",
    icon: ClipboardCheck,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
    groupByRole: { student: "دراستي", parent: "متابعة الأبناء" },
  },
  {
    label: "الجدول الدراسي",
    labelByRole: { teacher: "جدولي", student: "جدولي الدراسي" },
    to: "/app/timetable",
    icon: CalendarDays,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
    groupByRole: { student: "دراستي", parent: "متابعة الأبناء" },
  },
  {
    label: "جدول الامتحانات",
    labelByRole: {
      teacher: "جدول امتحاناتي",
      student: "جدول امتحاناتي",
      parent: "جدول امتحانات الأبناء",
    },
    to: "/app/exams",
    icon: FileSpreadsheet,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
    groupByRole: { student: "دراستي", parent: "متابعة الأبناء" },
  },
  {
    label: "رصد العلامات",
    labelByRole: { admin: "رصد العلامات", secretary: "رصد العلامات" },
    to: "/app/gradebook",
    icon: BookOpenCheck,
    roles: ["admin", "secretary", "teacher"],
    group: "المتابعة اليومية",
  },
  {
    label: "ترحيل علامات الفصل",
    labelByRole: {
      admin: "اعتماد ونشر النتائج",
      secretary: "اعتماد ونشر النتائج",
      teacher: "ترحيل علاماتي",
    },
    to: "/app/term",
    icon: ArrowUpFromLine,
    roles: ["admin", "secretary", "teacher"],
    group: "المتابعة اليومية",
  },
  {
    // The same screen, named for whose marks the viewer is actually reading.
    label: "علامات الطلبة",
    labelByRole: {
      admin: "علامات الطلبة",
      secretary: "علامات الطلبة",
      teacher: "علامات طلابي",
      student: "علاماتي",
      parent: "علامات الأبناء",
    },
    to: "/app/record",
    icon: Award,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
    groupByRole: { student: "دراستي", parent: "متابعة الأبناء" },
  },
  {
    // The result on its own, separate from the screen that shows the working.
    label: "العلامات النهائية",
    to: "/app/finals",
    icon: Award,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
    groupByRole: { student: "دراستي", parent: "متابعة الأبناء" },
  },
  {
    label: "الواجبات",
    labelByRole: { student: "واجباتي", parent: "واجبات الأبناء" },
    to: "/app/assignments",
    icon: NotebookPen,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
    groupByRole: { student: "دراستي", parent: "متابعة الأبناء" },
  },
  {
    label: "مصادر المواد",
    labelByRole: { teacher: "مصادر موادي", student: "مصادر دراستي", parent: "مصادر الأبناء" },
    to: "/app/resources",
    icon: BookMarked,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
    groupByRole: { student: "دراستي", parent: "متابعة الأبناء" },
  },
  {
    label: "الاختبارات الإلكترونية",
    labelByRole: { student: "اختباراتي", parent: "اختبارات الأبناء" },
    to: "/app/quizzes",
    icon: FileQuestion,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
    groupByRole: { student: "دراستي", parent: "متابعة الأبناء" },
  },
  {
    label: "السلوك والانضباط",
    labelByRole: { student: "سلوكي", parent: "سلوك الأبناء" },
    to: "/app/behaviour",
    icon: ShieldAlert,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المتابعة اليومية",
    groupByRole: { student: "دراستي", parent: "متابعة الأبناء" },
  },

  // Student services
  {
    label: "الصحة المدرسية",
    labelByRole: { student: "ملفي الصحي", parent: "صحة الأبناء" },
    to: "/app/health",
    icon: HeartPulse,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "خدمات الطلاب",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
  {
    label: "الشهادات والوثائق",
    labelByRole: { student: "شهاداتي", parent: "شهادات الأبناء" },
    to: "/app/certificates",
    icon: ScrollText,
    roles: ["admin", "secretary", "student", "parent"],
    group: "خدمات الطلاب",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
  {
    label: "الأنشطة والرحلات",
    labelByRole: { student: "أنشطتي", parent: "أنشطة الأبناء" },
    to: "/app/activities",
    icon: Ticket,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "خدمات الطلاب",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
  {
    label: "المكتبة",
    labelByRole: { student: "مكتبتي", parent: "استعارات الأبناء" },
    to: "/app/library",
    icon: Library,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "خدمات الطلاب",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
  {
    label: "النقل المدرسي",
    labelByRole: { student: "نقلي المدرسي", parent: "نقل الأبناء" },
    to: "/app/transport",
    icon: Bus,
    roles: ["admin", "secretary", "student", "parent"],
    group: "خدمات الطلاب",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },

  // Finance and communication
  {
    label: "الرسوم المالية",
    labelByRole: { student: "رسومي", parent: "رسوم الأبناء" },
    to: "/app/fees",
    icon: Wallet,
    roles: ["admin", "secretary", "student", "parent"],
    group: "المالية والتواصل",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
  {
    label: "المحادثات",
    to: "/app/chat",
    icon: MessagesSquare,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المالية والتواصل",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
  {
    label: "التواصل والإعلانات",
    labelByRole: { student: "الإعلانات والرسائل", parent: "الإعلانات والرسائل" },
    to: "/app/communication",
    icon: MessagesSquare,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المالية والتواصل",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
  {
    label: "التقارير",
    labelByRole: { teacher: "تقارير صفوفي" },
    to: "/app/reports",
    icon: BarChart3,
    roles: ["admin", "secretary", "teacher"],
    group: "المالية والتواصل",
  },
  {
    label: "جدول اليوم والمناوبات",
    to: "/app/day-schedule",
    icon: CalendarClock,
    roles: ["admin", "secretary"],
    group: "المتابعة اليومية",
  },
  {
    // The plan and the grid are one screen: /app/timetable-builder redirects.
    label: "بناء الجدول الدراسي",
    to: "/app/timetable-grid",
    icon: CalendarCog,
    roles: ["admin", "secretary"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "تقييم المعلمين",
    labelByRole: { teacher: "ملف أدائي" },
    to: "/app/appraisal",
    icon: UserCheck,
    roles: ["admin", "secretary", "teacher"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "التنبيهات والإنذارات",
    labelByRole: { student: "تنبيهاتي", parent: "تنبيهات الأبناء" },
    to: "/app/alerts",
    icon: ShieldAlert,
    roles: ["admin", "secretary", "student", "parent"],
    group: "المالية والتواصل",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
  {
    label: "الاستبيانات",
    to: "/app/surveys",
    icon: ClipboardList,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المالية والتواصل",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
  {
    label: "شهادات الأرباع",
    to: "/app/quarter-results",
    icon: FileText,
    roles: ["admin", "secretary", "teacher"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "خطة التقييم",
    to: "/app/assessment-plan",
    icon: Layers,
    roles: ["admin", "secretary", "teacher"],
    group: "الإدارة الأكاديمية",
  },
  {
    label: "إعدادات المدرسة",
    to: "/app/settings",
    icon: Settings,
    roles: ["admin"],
    group: "المالية والتواصل",
  },
  {
    label: "التقويم الدراسي",
    to: "/app/calendar",
    icon: CalendarDays,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "عام",
  },
  {
    label: "توزيع الشعب",
    to: "/app/sections",
    icon: LayoutGrid,
    roles: ["admin", "secretary"],
    group: "الإدارة الأكاديمية",
  },
  {
    // Every persona manages their own account security, so this is the one
    // entry that is not restricted by role.
    label: "أمان الحساب",
    to: "/app/security",
    icon: ShieldCheck,
    roles: ["admin", "secretary", "teacher", "student", "parent"],
    group: "المالية والتواصل",
    groupByRole: { student: "خدماتي", parent: "خدمات الأبناء" },
  },
];

/** Sidebar section order, per role. */
const GROUPS_BY_ROLE: Record<Role, string[]> = {
  admin: ["عام", "الإدارة الأكاديمية", "المتابعة اليومية", "خدمات الطلاب", "المالية والتواصل"],
  secretary: ["عام", "الإدارة الأكاديمية", "المتابعة اليومية", "خدمات الطلاب", "المالية والتواصل"],
  teacher: ["عام", "الإدارة الأكاديمية", "المتابعة اليومية", "المالية والتواصل"],
  student: ["عام", "دراستي", "خدماتي"],
  parent: ["عام", "متابعة الأبناء", "خدمات الأبناء"],
};

export const navGroups = GROUPS_BY_ROLE.admin;

export function groupsForRole(role: Role): string[] {
  return GROUPS_BY_ROLE[role] ?? GROUPS_BY_ROLE.admin;
}

/** The label this role should see for an item. */
export function labelFor(item: NavItem, role: Role): string {
  return item.labelByRole?.[role] ?? item.label;
}

/** The sidebar section this role should find the item under. */
export function groupFor(item: NavItem, role: Role): string {
  return item.groupByRole?.[role] ?? item.group;
}

export function navForRole(role: Role) {
  return navItems.filter((i) => i.roles.includes(role));
}

/** Page title for a route, resolved for the current role. */
export function pageTitleFor(pathname: string, role: Role): string | null {
  // Longest match wins, so /app/students/x resolves to the students item.
  const match = navItems
    .filter((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match ? labelFor(match, role) : null;
}

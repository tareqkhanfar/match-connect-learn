import type { Role, StaffRole } from "./api/types";

export type { Role, StaffRole };

export const roleLabels: Record<Role, string> = {
  admin: "مدير المدرسة",
  secretary: "سكرتارية",
  teacher: "معلم",
  student: "طالب",
  parent: "ولي أمر",
};

export const staffRoleLabels: Record<StaffRole, string> = {
  vice_principal: "نائب المدير",
  supervisor: "مشرف",
  nurse: "ممرض",
};

/** Every role a workspace or a label can name: the personas and the staff roles. */
export type SchoolRole = Role | StaffRole;
export const schoolRoleLabels: Record<SchoolRole, string> = { ...roleLabels, ...staffRoleLabels };

/**
 * The screens a staff role reaches — the same lists the server enforces in
 * `utils.role_policy`, here so a menu does not offer what the server refuses.
 * A path matches itself and everything under it.
 */
const ALWAYS = [
  "/app",
  "/app/workspace",
  "/app/w",
  "/app/p",
  "/app/security",
  "/app/profile",
  "/app/help",
  "/app/mail",
  "/app/community",
];
const STAFF_PATHS: Partial<Record<StaffRole, string[]>> = {
  supervisor: [
    ...ALWAYS,
    "/app/students",
    "/app/attendance",
    "/app/absence-report",
    "/app/timetable",
    "/app/exams",
    "/app/gradebook",
    "/app/record",
    "/app/finals",
    "/app/quarter-results",
    "/app/assignments",
    "/app/quizzes",
    "/app/resources",
    "/app/behaviour",
    "/app/class-log",
    "/app/periodic-evaluations",
    "/app/evaluations",
    "/app/assessment-plan",
    "/app/calendar",
    "/app/subjects",
  ],
  nurse: [
    ...ALWAYS,
    "/app/health",
    "/app/health-reports",
    "/app/forms/nursing",
    "/app/attendance",
    "/app/absence-report",
    "/app/calendar",
  ],
};
const FINANCE_PATHS = ["/app/fees"];

export interface Access {
  staffRole: StaffRole | null;
  hidesFinance: boolean;
  readOnly: boolean;
}

function under(path: string, prefix: string) {
  return prefix === "/app" ? path === "/app" : path === prefix || path.startsWith(`${prefix}/`);
}

/** Whether this person's role reaches the screen at `path`. */
export function allowsPath(access: Access | null | undefined, path: string): boolean {
  if (!access) return true;
  const clean = path.split("?")[0] ?? path;
  if (access.hidesFinance && FINANCE_PATHS.some((p) => under(clean, p))) return false;
  const list = access.staffRole ? STAFF_PATHS[access.staffRole] : undefined;
  return list ? list.some((p) => under(clean, p)) : true;
}

/** Personas that manage school-wide records. */
export const BACK_OFFICE: Role[] = ["admin", "secretary"];

export function isBackOffice(role: Role) {
  return BACK_OFFICE.includes(role);
}

/** Payment status labels/styles, shared by the fee views. */
export type PaymentStatus = "paid" | "partial" | "late" | "draft";

export const statusMeta: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: "مدفوع", cls: "bg-success-soft text-success border-success/30" },
  partial: { label: "جزئي", cls: "bg-warning-soft text-warm-foreground border-warning/40" },
  late: { label: "متأخر", cls: "bg-destructive-soft text-destructive border-destructive/30" },
  draft: { label: "مسودة", cls: "bg-secondary text-muted-foreground border-border" },
};

/** Currency formatting used across the finance screens. */
export function money(n: number) {
  return `${Number(n || 0).toLocaleString("en-US")} ₪`;
}

/**
 * Pick the variant that suits the viewer's role.
 *
 * Screens are shared across roles but mean different things: "الحضور والغياب"
 * is a register for staff and a personal record for a student. Pass only the
 * roles that differ; the rest fall back to `base`.
 */
export function byRole(
  role: Role,
  base: string,
  overrides: Partial<Record<Role, string>> = {},
): string {
  return overrides[role] ?? base;
}

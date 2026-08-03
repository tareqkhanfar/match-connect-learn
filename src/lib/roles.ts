import type { Role } from "./api/types";

export type { Role };

export const roleLabels: Record<Role, string> = {
  admin: "مدير المدرسة",
  secretary: "سكرتارية",
  teacher: "معلم",
  student: "طالب",
  parent: "ولي أمر",
};

/** Personas that manage school-wide records. */
export const BACK_OFFICE: Role[] = ["admin", "secretary"];

export function isBackOffice(role: Role) {
  return BACK_OFFICE.includes(role);
}

/** Payment status labels/styles, shared by the fee views. */
export type PaymentStatus = "paid" | "partial" | "late";

export const statusMeta: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: "مدفوع", cls: "bg-success-soft text-success border-success/30" },
  partial: { label: "جزئي", cls: "bg-warning-soft text-warm-foreground border-warning/40" },
  late: { label: "متأخر", cls: "bg-destructive-soft text-destructive border-destructive/30" },
};

/** Currency formatting used across the finance screens. */
export function money(n: number) {
  return `${Number(n || 0).toLocaleString("en-US")} ₪`;
}

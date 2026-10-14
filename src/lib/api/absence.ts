import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

export interface AbsenceFilters {
  date_from?: string;
  date_to?: string;
  program?: string;
  student_group?: string;
  student?: string;
}

function clean(f: AbsenceFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (v) out[k] = v;
  return out;
}

export interface AbsenceOptions {
  defaultRange: { dateFrom: string; dateTo: string };
  programs: Array<{ id: string; label: string }>;
  sections: Array<{ id: string; label: string; program: string }>;
  students: Array<{ id: string; label: string }>;
  reasons: string[];
  /** A parent or a pupil: their own children, no one's contacts. */
  family: boolean;
  showsContacts: boolean;
  scope: "school" | "sections" | "family";
}

export interface Guardian {
  id: string;
  name: string;
  relation: string;
  mobile: string;
  altMobile: string;
  email: string;
}

export interface AbsenceStudent {
  student: string;
  name: string;
  section: string;
  sectionLabel: string;
  program: string;
  days: number;
  present: number;
  absent: number;
  excused: number;
  rate: number | null;
  lastAbsent: string;
  longestStreak: number;
  currentStreak: number;
  currentStreakFrom: string;
}

export interface AbsenceGroupRow {
  id: string;
  label: string;
  present: number;
  absent: number;
  excused: number;
  students: number;
  absentStudents: number;
  rate: number | null;
}

export interface AbsenteeRow {
  id: string;
  date: string;
  weekday: string;
  student: string;
  name: string;
  section: string;
  sectionLabel: string;
  status: "Absent" | "Excused" | "Leave";
  statusLabel: string;
  reason: string;
  guardians: Guardian[];
}

export interface AbsenceReport {
  period: { dateFrom: string; dateTo: string; singleDay: boolean };
  empty?: boolean;
  summary?: {
    records: number;
    present: number;
    absent: number;
    excused: number;
    rate: number | null;
    students: number;
    absentStudents: number;
    perfect: number;
    schoolDays: number;
    avgDailyAbsent: number;
    worstDay: { date: string; weekday: string; absent: number } | null;
    streaks: number;
    currentStreaks: number;
    chronic: number;
    chronicPct: number;
    streakDays: number;
  };
  daily?: Array<{
    date: string;
    weekday: string;
    present: number;
    absent: number;
    excused: number;
    rate: number | null;
  }>;
  weekday?: Array<{
    day: string;
    absent: number;
    present: number;
    excused: number;
    days: number;
    rate: number | null;
    avgAbsent: number;
  }>;
  students?: AbsenceStudent[];
  sections?: AbsenceGroupRow[];
  grades?: AbsenceGroupRow[];
  reasons?: Array<{ label: string; count: number }>;
  absentees?: AbsenteeRow[];
  truncated?: boolean;
  showsContacts?: boolean;
}

export interface StudentAbsenceFile {
  student: string;
  name: string;
  image: string | null;
  sectionLabel: string;
  period: { dateFrom: string; dateTo: string };
  summary: {
    days: number;
    present: number;
    absent: number;
    excused: number;
    rate: number | null;
    longestStreak: number;
    currentStreak: number;
    currentStreakFrom: string;
  };
  months: Array<{
    month: string;
    present: number;
    absent: number;
    excused: number;
    rate: number | null;
  }>;
  days: Array<{
    date: string;
    weekday: string;
    status: string;
    statusLabel: string;
    reason: string;
  }>;
  guardians: Guardian[];
}

export function useAbsenceOptions() {
  return useQuery<AbsenceOptions>({
    queryKey: ["absence", "options"],
    queryFn: () => apiGet("absence_report.options"),
    staleTime: 5 * 60_000,
  });
}

export function useAbsenceReport(filters: AbsenceFilters, enabled = true) {
  return useQuery<AbsenceReport>({
    queryKey: ["absence", "report", clean(filters)],
    queryFn: () => apiGet("absence_report.report", clean(filters)),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useStudentAbsenceFile(student: string | undefined, filters: AbsenceFilters) {
  return useQuery<StudentAbsenceFile>({
    queryKey: ["absence", "student", student ?? "", clean(filters)],
    queryFn: () =>
      apiGet("absence_report.student_file", {
        student,
        ...(filters.date_from ? { date_from: filters.date_from } : {}),
        ...(filters.date_to ? { date_to: filters.date_to } : {}),
      }),
    enabled: !!student,
  });
}

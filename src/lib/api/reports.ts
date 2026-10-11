import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

/**
 * تقارير القيادة والتمريض — read-only reports for the vice principal, the
 * administration and the school nurse.
 *
 * Every report takes the same filter object; a report ignores what does not
 * apply to it (marks follow the term, so their range only decides which
 * quarters are due).
 */

export interface ReportFilters {
  date_from?: string;
  date_to?: string;
  program?: string;
  student_group?: string;
  teacher?: string;
}

/** Only the filters that are set, so the query key and the URL stay clean. */
function clean(filters: ReportFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) if (v) out[k] = v;
  return out;
}

export interface ReportPeriod {
  dateFrom: string;
  dateTo: string;
  academicYear?: string | null;
  academicTerm?: string | null;
}

interface Choice {
  id: string;
  label: string;
}

// --- Leadership -----------------------------------------------------------------

export interface LeadershipOptions extends ReportPeriod {
  teachers: Array<{ id: string; name: string }>;
  sections: Array<Choice & { program: string }>;
  programs: Choice[];
}

export type MarksStatus = "none" | "partial" | "complete" | "noPlan";

export interface MarksPairRow {
  teacher: string;
  teacherName: string;
  section: string;
  sectionLabel: string;
  program: string;
  course: string;
  students: number;
  plan: string | null;
  components: number;
  columnsDone: number;
  columnsEmpty: number;
  missingColumns: string[];
  expected: number;
  entered: number;
  missing: number;
  marksTotal: number;
  pct: number | null;
  lastEntry: string | null;
  status: MarksStatus;
}

export interface MarksTeacherRow {
  teacher: string;
  teacherName: string;
  pairs: number;
  pairsNone: number;
  pairsPartial: number;
  pairsComplete: number;
  pairsNoPlan: number;
  expected: number;
  entered: number;
  missing: number;
  marksTotal: number;
  lastEntry: string | null;
  notEntered: string[];
  pct: number;
  state: "none" | "partial" | "complete";
}

export interface MarksSummary {
  teachers: number;
  teachersNoMarks: number;
  teachersWithMissing: number;
  teachersComplete: number;
  pairs: number;
  pairsNone: number;
  pairsNoPlan: number;
  expected: number;
  entered: number;
  missing: number;
  pct: number | null;
}

export interface MarksReport extends ReportPeriod {
  asOf: string;
  summary: MarksSummary;
  teachers: MarksTeacherRow[];
  rows: MarksPairRow[];
}

export interface ActivityRow {
  teacher: string;
  teacherName: string;
  user: string | null;
  attendanceSessions: number;
  attendanceRecords: number;
  classLogs: number;
  lessonPlans: number;
  marks: number;
  assignments: number;
  behaviour: number;
  messages: number;
  evaluations: number;
  total: number;
  activeDays: number;
  lastLogin: string | null;
  lastActive: string | null;
  accountEnabled: boolean;
  state: "active" | "inactive" | "noAccount";
}

export interface ActivityReport extends ReportPeriod {
  summary: {
    teachers: number;
    active: number;
    inactive: number;
    noAccount: number;
    neverLoggedIn: number;
    schoolDays: number;
    attendanceSessions: number;
    classLogs: number;
    lessonPlans: number;
    marks: number;
    assignments: number;
    behaviour: number;
    messages: number;
    evaluations: number;
  };
  rows: ActivityRow[];
  daily: Array<{ date: string; label: string; actions: number }>;
}

export interface DutyCoverRow {
  teacher: string;
  teacherName: string;
  weeklyLessons: number;
  sections: number;
  subjects: number;
  weeklyDuties: number;
  dutyPlaces: string[];
  covers: number;
  coveredFor: number;
  swaps: number;
  scheduledLessons: number;
  weeklyTotal: number;
}

export interface DutyCoverReport extends ReportPeriod {
  summary: {
    teachers: number;
    covers: number;
    swaps: number;
    weeklyDuties: number;
    weeklyLessons: number;
    avgWeeklyLessons: number;
    teachersWithoutDuty: number;
    teachersWithoutCover: number;
  };
  rows: DutyCoverRow[];
  byReason: Array<{ label: string; count: number }>;
  daily: Array<{ date: string; label: string; covers: number }>;
  unmatchedDuties: Array<{ name: string; count: number }>;
}

export interface AttendanceSectionRow {
  section: string;
  sectionLabel: string;
  program: string;
  homeroom: string;
  students: number;
  schoolDays: number;
  taken: number;
  missing: number;
  pct: number | null;
  missingDates: string[];
  lastTaken: string | null;
}

export interface AttendanceSummary {
  sections: number;
  schoolDays: number;
  expected: number;
  taken: number;
  missing: number;
  pct: number | null;
  sectionsComplete: number;
  sectionsNever: number;
  daysWithGaps: number;
}

export interface AttendanceComplianceReport extends ReportPeriod {
  summary: AttendanceSummary;
  rows: AttendanceSectionRow[];
  daily: Array<{
    date: string;
    label: string;
    weekday: string;
    taken: number;
    missing: number;
    pct: number | null;
  }>;
}

export interface ClassLogRow {
  teacher: string;
  teacherName: string;
  lessons: number;
  logged: number;
  planned: number;
  lastLog: string | null;
  missingLogs: number;
  missingPlans: number;
  logPct: number | null;
  planPct: number | null;
}

export interface ClassLogReport extends ReportPeriod {
  source: "lessons" | "timetable";
  summary: {
    teachers: number;
    lessons: number;
    logged: number;
    planned: number;
    missingLogs: number;
    missingPlans: number;
    logPct: number | null;
    planPct: number | null;
    teachersNoLogs: number;
  };
  rows: ClassLogRow[];
  daily: Array<{
    date: string;
    label: string;
    lessons: number;
    logged: number;
    planned: number;
    logPct: number | null;
  }>;
}

export interface SectionRow {
  section: string;
  sectionLabel: string;
  program: string;
  homeroom: string;
  students: number;
  attendanceDays: number;
  present: number;
  absent: number;
  excused: number;
  absenceRate: number;
  negative: number;
  positive: number;
  negativePerStudent: number;
  marksAverage: number | null;
  marks: number;
  exams: number;
  visits: number;
}

export interface SectionOverviewReport extends ReportPeriod {
  summary: {
    sections: number;
    students?: number;
    absenceRate?: number;
    negative?: number;
    positive?: number;
    marksAverage?: number | null;
    exams?: number;
    visits?: number;
  };
  rows: SectionRow[];
  byProgram: Array<{
    program: string;
    sections: number;
    students: number;
    present: number;
    absent: number;
    negative: number;
    positive: number;
    visits: number;
    exams: number;
    absenceRate: number;
    marksAverage: number | null;
  }>;
}

export interface LeadershipSummaryData extends ReportPeriod {
  marks: MarksSummary;
  attendance: AttendanceSummary;
  topMissingMarks: Array<{
    id: string;
    name: string;
    pct: number;
    missing: number;
    state: MarksTeacherRow["state"];
  }>;
  topMissingAttendance: Array<{ id: string; name: string; pct: number | null; missing: number }>;
}

const LEAD = "leadership_reports";

function useLeadership<T>(method: string, filters: ReportFilters, enabled = true) {
  const params = clean(filters);
  return useQuery<T>({
    queryKey: ["leadership-report", method, params],
    queryFn: () => apiGet<T>(`${LEAD}.${method}`, params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useLeadershipOptions() {
  return useQuery<LeadershipOptions>({
    queryKey: ["leadership-report", "options"],
    queryFn: () => apiGet(`${LEAD}.options`),
    staleTime: 5 * 60_000,
  });
}

export const useMarksCompletion = (f: ReportFilters, enabled = true) =>
  useLeadership<MarksReport>("marks_completion", f, enabled);
export const useTeacherActivity = (f: ReportFilters, enabled = true) =>
  useLeadership<ActivityReport>("teacher_activity", f, enabled);
export const useDutyCover = (f: ReportFilters, enabled = true) =>
  useLeadership<DutyCoverReport>("duty_cover", f, enabled);
export const useAttendanceCompliance = (f: ReportFilters, enabled = true) =>
  useLeadership<AttendanceComplianceReport>("attendance_compliance", f, enabled);
export const useClassLogCompliance = (f: ReportFilters, enabled = true) =>
  useLeadership<ClassLogReport>("class_log_compliance", f, enabled);
export const useSectionOverview = (f: ReportFilters, enabled = true) =>
  useLeadership<SectionOverviewReport>("section_overview", f, enabled);

export function useLeadershipSummary(filters: Pick<ReportFilters, "date_from" | "date_to"> = {}) {
  return useLeadership<LeadershipSummaryData>("summary", filters);
}

// --- Nursing ----------------------------------------------------------------------

export type VisitBucket = "day" | "week" | "month";

export interface HealthOptions {
  dateFrom: string;
  dateTo: string;
  programs: Choice[];
  sections: Array<Choice & { program: string }>;
  visitTypes: Choice[];
  outcomes: Choice[];
}

export interface VisitRow {
  id: string;
  student: string;
  studentName: string;
  section: string;
  program: string;
  date: string;
  time: string;
  type: string;
  complaint: string;
  treatment: string;
  outcome: string;
  outcomeKey: string;
  parentNotified: boolean;
}

export interface CountRow {
  label: string;
  count: number;
}

export interface FrequentVisitor {
  student: string;
  studentName: string;
  section: string;
  program: string;
  visits: number;
  sentHome: number;
  lastVisit: string;
  chronic: boolean;
  topComplaint: string;
}

export interface VisitsReport {
  dateFrom: string;
  dateTo: string;
  bucket: VisitBucket;
  summary: {
    visits: number;
    students: number;
    repeatVisitors: number;
    sentHome: number;
    referred: number;
    returned: number;
    rested: number;
    injuries: number;
    parentNotified: number;
    parentNotifiedPct: number | null;
    avgPerDay: number;
    today: number;
    thisWeek: number;
  };
  series: Array<{ key: string; label: string; visits: number; sentHome: number }>;
  byType: CountRow[];
  byOutcome: CountRow[];
  byComplaint: CountRow[];
  byProgram: CountRow[];
  bySection: CountRow[];
  byWeekday: CountRow[];
  byHour: CountRow[];
  byAttendant: CountRow[];
  frequent: FrequentVisitor[];
  recent: VisitRow[];
}

export interface HealthCase {
  student: string;
  studentName: string;
  section: string;
  program: string;
  bloodGroup: string;
  conditions: string;
  allergies: string;
  medications: string;
  specialNeeds: string;
  lastCheckup: string | null;
}

export interface RecordsReport {
  summary: {
    students: number;
    withRecord: number;
    withoutRecord: number;
    coveragePct: number | null;
    chronic: number;
    allergies: number;
    medications: number;
    specialNeeds: number;
    overdue: number;
    noEmergency: number;
    noBlood: number;
  };
  conditions: CountRow[];
  allergies: CountRow[];
  medications: CountRow[];
  bloodGroups: CountRow[];
  byProgram: Array<{ label: string; chronic: number; allergies: number; medications: number }>;
  cases: HealthCase[];
}

export interface NurseDashboardData {
  today: number;
  todaySentHome: number;
  thisWeek: number;
  last30: number;
  chronic: number;
  allergies: number;
  medications: number;
  series: Array<{ date: string; label: string; weekday: string; visits: number }>;
  recent: VisitRow[];
}

const HEALTH = "health_reports";

export function useHealthOptions() {
  return useQuery<HealthOptions>({
    queryKey: ["health-report", "options"],
    queryFn: () => apiGet(`${HEALTH}.options`),
    staleTime: 5 * 60_000,
  });
}

export function useVisitsReport(filters: ReportFilters & { bucket?: VisitBucket }, enabled = true) {
  const params = clean(filters);
  return useQuery<VisitsReport>({
    queryKey: ["health-report", "visits", params],
    queryFn: () => apiGet(`${HEALTH}.visits_report`, params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRecordsReport(
  filters: Pick<ReportFilters, "program" | "student_group">,
  enabled = true,
) {
  const params = clean(filters);
  return useQuery<RecordsReport>({
    queryKey: ["health-report", "records", params],
    queryFn: () => apiGet(`${HEALTH}.records_report`, params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useNurseDashboard() {
  return useQuery<NurseDashboardData>({
    queryKey: ["health-report", "dashboard"],
    queryFn: () => apiGet(`${HEALTH}.dashboard`),
  });
}

export function useStudentVisits(student: string | null) {
  return useQuery<{ student: string; visits: VisitRow[] }>({
    queryKey: ["health-report", "student", student],
    queryFn: () => apiGet(`${HEALTH}.student_visits`, { student }),
    enabled: !!student,
  });
}

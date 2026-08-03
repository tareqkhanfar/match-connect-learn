/** React Query hooks wrapping the Match K12 API. */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { apiGet, apiPost } from "./client";
import type {
  AdminDashboard,
  AnnouncementRow,
  AssignmentRow,
  AttendanceReport,
  AttendanceSheet,
  ClassRow,
  ChildOverview,
  ExamRow,
  FeeList,
  GradeRow,
  MessageRow,
  MessageThread,
  Paginated,
  ParentDashboard,
  Session,
  StudentDashboard,
  StudentProfile,
  StudentRow,
  SubjectRow,
  TeacherDashboard,
  TeacherRow,
  Timetable,
} from "./types";

/**
 * Query params are built inline from optional UI state, so every field has to
 * accept `undefined` explicitly (the project uses exactOptionalPropertyTypes).
 */
type Opt<T> = { [K in keyof T]?: T[K] | undefined };

/** Central key registry so invalidation stays consistent. */
export const qk = {
  session: ["session"] as const,
  dashboard: ["dashboard"] as const,
  students: (params: unknown) => ["students", params] as const,
  student: (id: string) => ["student", id] as const,
  studentFilters: ["student-filters"] as const,
  classes: (params: unknown) => ["classes", params] as const,
  classStudents: (group: string) => ["class-students", group] as const,
  subjects: ["subjects"] as const,
  teachers: (search?: string) => ["teachers", search ?? ""] as const,
  timetable: (params: unknown) => ["timetable", params] as const,
  exams: (params: unknown) => ["exams", params] as const,
  grades: (params: unknown) => ["grades", params] as const,
  assignments: (params: unknown) => ["assignments", params] as const,
  submissions: (assignment: string) => ["submissions", assignment] as const,
  attendanceSheet: (group: string, date: string) => ["attendance-sheet", group, date] as const,
  attendanceReport: (params: unknown) => ["attendance-report", params] as const,
  myGroups: ["my-groups"] as const,
  fees: (params: unknown) => ["fees", params] as const,
  feeDetail: (id: string) => ["fee", id] as const,
  collection: ["fee-collection"] as const,
  announcements: ["announcements"] as const,
  inbox: ["inbox"] as const,
  thread: (id: string) => ["thread", id] as const,
  contacts: ["contacts"] as const,
};

// --- Session ---------------------------------------------------------------

export function useSession(options?: Partial<UseQueryOptions<Session>>) {
  return useQuery<Session>({
    queryKey: qk.session,
    queryFn: () => apiGet<Session>("auth.me"),
    // A 401 simply means "not signed in" — don't hammer the server.
    retry: false,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { email: string; password: string }) => apiPost<Session>("auth.login", vars),
    onSuccess: (session) => {
      qc.setQueryData(qk.session, session);
      qc.invalidateQueries();
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<null>("auth.logout"),
    onSuccess: () => {
      qc.clear();
    },
  });
}

// --- Dashboard -------------------------------------------------------------

export type AnyDashboard = AdminDashboard | TeacherDashboard | StudentDashboard | ParentDashboard;

export function useDashboard() {
  return useQuery<AnyDashboard>({
    queryKey: qk.dashboard,
    queryFn: () => apiGet<AnyDashboard>("dashboard.summary"),
  });
}

// --- Notifications ---------------------------------------------------------

export interface NotificationItem {
  id: string;
  category: string;
  category_label: string;
  title: string;
  body: string;
  time: string;
  tone: "danger" | "warning" | "info" | "success";
  link: string;
  ref: string;
  read: boolean;
  count?: number;
}

export interface NotificationFeed {
  items: NotificationItem[];
  unread: number;
  total: number;
}

/** The notification list. Refetched on an interval so the bell stays current. */
export function useNotifications(limit = 30, unreadOnly = false) {
  return useQuery<NotificationFeed>({
    queryKey: ["notifications", limit, unreadOnly],
    queryFn: () =>
      apiGet<NotificationFeed>("notifications.feed", {
        limit,
        ...(unreadOnly ? { unread_only: 1 } : {}),
      }),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { notification?: string; all?: boolean }) =>
      apiPost<{ read: number }>("notifications.mark_read", {
        ...(vars.notification ? { notification: vars.notification } : {}),
        ...(vars.all ? { all: 1 } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: qk.inbox });
    },
  });
}

/** Full picture of a single child, for the parent's focused view. */
export function useChildOverview(student: Opt<string>) {
  return useQuery<ChildOverview>({
    queryKey: ["child-overview", student],
    queryFn: () => apiGet<ChildOverview>("dashboard.child_overview", { student: student! }),
    enabled: Boolean(student),
  });
}

// --- Students --------------------------------------------------------------

export interface StudentListParams {
  search?: string | undefined;
  program?: string | undefined;
  batch?: string | undefined;
  payment_status?: string | undefined;
  page?: number | undefined;
  page_size?: number | undefined;
  [key: string]: unknown;
}

export function useStudents(params: StudentListParams = {}) {
  return useQuery<Paginated<StudentRow>>({
    queryKey: qk.students(params),
    queryFn: () => apiGet<Paginated<StudentRow>>("students.list_students", params),
    placeholderData: (prev) => prev,
  });
}

export function useStudent(id: string | undefined) {
  return useQuery<StudentProfile>({
    queryKey: qk.student(id ?? ""),
    queryFn: () => apiGet<StudentProfile>("students.get_student", { student: id }),
    enabled: Boolean(id),
  });
}

export function useStudentFilters() {
  return useQuery<{
    grades: string[];
    sections: string[];
    statuses: Array<{ value: string; label: string }>;
  }>({
    queryKey: qk.studentFilters,
    queryFn: () => apiGet("students.filter_options"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSaveStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; name: string }>("students.save_student", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

// --- Academics -------------------------------------------------------------

export function useClasses(params: Opt<{ program: string; academic_year: string }> = {}) {
  return useQuery<ClassRow[]>({
    queryKey: qk.classes(params),
    queryFn: () => apiGet<ClassRow[]>("academics.list_classes", params),
  });
}

export function useClassStudents(group: string | undefined) {
  return useQuery<Array<{ id: string; name: string; roll_number: number | null }>>({
    queryKey: qk.classStudents(group ?? ""),
    queryFn: () => apiGet("academics.class_students", { student_group: group }),
    enabled: Boolean(group),
  });
}

export function useSubjects() {
  return useQuery<SubjectRow[]>({
    queryKey: qk.subjects,
    queryFn: () => apiGet<SubjectRow[]>("academics.list_subjects"),
  });
}

export function useTeachers(search?: string) {
  return useQuery<TeacherRow[]>({
    queryKey: qk.teachers(search),
    queryFn: () => apiGet<TeacherRow[]>("academics.list_teachers", { search }),
  });
}

export function useTimetable(
  params: Opt<{
    student_group: string;
    instructor: string;
    student: string;
    week_start: string;
  }> = {},
) {
  return useQuery<Timetable>({
    queryKey: qk.timetable(params),
    queryFn: () => apiGet<Timetable>("academics.timetable", params),
  });
}

export function useExams(params: Opt<{ academic_term: string; program: string }> = {}) {
  return useQuery<ExamRow[]>({
    queryKey: qk.exams(params),
    queryFn: () => apiGet<ExamRow[]>("academics.list_exams", params),
  });
}

export function useGrades(
  params: Opt<{ student: string; student_group: string; course: string }> = {},
) {
  return useQuery<GradeRow[]>({
    queryKey: qk.grades(params),
    queryFn: () => apiGet<GradeRow[]>("academics.list_grades", params),
  });
}

// --- Attendance ------------------------------------------------------------

/** Staff-only: students and parents get a 403, so pass enabled:false. */
export function useMyGroups(enabled = true) {
  return useQuery<ClassRow[]>({
    queryKey: qk.myGroups,
    queryFn: () => apiGet<ClassRow[]>("attendance.my_groups"),
    enabled,
  });
}

export function useAttendanceSheet(group: string | undefined, date: string, enabled = true) {
  return useQuery<AttendanceSheet>({
    queryKey: qk.attendanceSheet(group ?? "", date),
    queryFn: () =>
      apiGet<AttendanceSheet>("attendance.get_group_sheet", {
        student_group: group,
        date,
      }),
    enabled: enabled && Boolean(group),
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      date: string;
      entries: Array<{ student: string; status: string }>;
    }) => apiPost<{ created: number; updated: number }>("attendance.mark_attendance", vars),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.attendanceSheet(vars.student_group, vars.date) });
      qc.invalidateQueries({ queryKey: ["attendance-report"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useAttendanceReport(
  params: Opt<{ student: string; student_group: string; from_date: string; to_date: string }> = {},
) {
  return useQuery<AttendanceReport>({
    queryKey: qk.attendanceReport(params),
    queryFn: () => apiGet<AttendanceReport>("attendance.attendance_report", params),
  });
}

// --- Assignments -----------------------------------------------------------

export function useAssignments(
  params: Opt<{ student_group: string; course: string; status: string }> = {},
) {
  return useQuery<AssignmentRow[]>({
    queryKey: qk.assignments(params),
    queryFn: () => apiGet<AssignmentRow[]>("assignments.list_assignments", params),
  });
}

export function useSaveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string }>("assignments.save_assignment", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useSubmissions(assignment: string | undefined) {
  return useQuery<{
    assignment: {
      id: string;
      title: string;
      subject: string;
      due: string;
      max: number;
      student_group: string;
    };
    rows: Array<{
      student: string;
      student_name: string;
      submission_id: string | null;
      status: string;
      status_raw: string | null;
      score: number | null;
      submitted_on: string | null;
      feedback: string | null;
      content: string | null;
      files: SubmissionFile[];
    }>;
    submitted: number;
    total: number;
  }>({
    queryKey: qk.submissions(assignment ?? ""),
    queryFn: () => apiGet("assignments.submissions", { assignment }),
    enabled: Boolean(assignment),
  });
}

export interface SubmissionFile {
  file_url: string;
  file_name: string;
  file_size?: number;
}

export interface SubmissionDetail {
  assignment: {
    id: string;
    title: string;
    description: string | null;
    due: string;
    max: number;
    status: string;
    course: string;
    files: SubmissionFile[];
  };
  submission: {
    id: string;
    status: string;
    status_label: string;
    content: string | null;
    submitted_on: string;
    score: number | null;
    feedback: string | null;
    files: SubmissionFile[];
  } | null;
}

/** One assignment plus the viewer's own submission — powers the submit dialog. */
export function useSubmission(assignment: Opt<string>, student?: Opt<string>) {
  return useQuery({
    queryKey: ["submission", assignment, student ?? null],
    queryFn: () =>
      apiGet<SubmissionDetail>("assignments.get_submission", {
        assignment: assignment!,
        ...(student ? { student } : {}),
      }),
    enabled: Boolean(assignment),
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      assignment: string;
      content?: string;
      attachment?: string;
      files?: SubmissionFile[];
    }) =>
      apiPost<{ id: string; status: string; status_label: string; files: number }>(
        "assignments.submit_assignment",
        vars,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["submission", vars.assignment] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useGradeSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      submission?: string;
      assignment?: string;
      student?: string;
      score: number;
      feedback?: string;
    }) => apiPost<{ id: string; score: number }>("assignments.grade_submission", vars),
    onSuccess: (_d, vars) => {
      if (vars.assignment) {
        qc.invalidateQueries({ queryKey: qk.submissions(vars.assignment) });
      }
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
  });
}

// --- Fees ------------------------------------------------------------------

export function useFees(
  params: Opt<{
    student: string;
    program: string;
    status: string;
    page: number;
    page_size: number;
  }> = {},
) {
  return useQuery<FeeList>({
    queryKey: qk.fees(params),
    queryFn: () => apiGet<FeeList>("fees.list_fees", params),
    placeholderData: (prev) => prev,
  });
}

/** Admin-only: other personas get a 403, so pass enabled:false for them. */
export function useFeeCollection(months = 6, enabled = true) {
  return useQuery<{
    months: Array<{ month: string; expected: number; collected: number }>;
    by_status: Array<{ status: string; label: string; count: number }>;
  }>({
    queryKey: [...qk.collection, months],
    queryFn: () => apiGet("fees.collection_report", { months }),
    enabled,
  });
}

// --- Communication ---------------------------------------------------------

export function useAnnouncements(limit = 25) {
  return useQuery<AnnouncementRow[]>({
    queryKey: [...qk.announcements, limit],
    queryFn: () => apiGet<AnnouncementRow[]>("communication.list_announcements", { limit }),
  });
}

export function useSaveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string }>("communication.save_announcement", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.announcements });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (announcement: string) =>
      apiPost<{ id: string }>("communication.delete_announcement", { announcement }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.announcements });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useInbox(limit = 50) {
  return useQuery<MessageRow[]>({
    queryKey: [...qk.inbox, limit],
    queryFn: () => apiGet<MessageRow[]>("communication.inbox", { limit }),
  });
}

export function useThread(thread: string | undefined) {
  return useQuery<MessageThread>({
    queryKey: qk.thread(thread ?? ""),
    queryFn: () => apiGet<MessageThread>("communication.thread", { thread }),
    enabled: Boolean(thread),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      recipient: string;
      body: string;
      subject?: string;
      thread?: string;
      about_student?: string;
    }) => apiPost<{ id: string; thread: string }>("communication.send_message", vars),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.inbox });
      if (data?.thread) qc.invalidateQueries({ queryKey: qk.thread(data.thread) });
    },
  });
}

export function useContacts() {
  return useQuery<Array<{ user: string; name: string; role: string }>>({
    queryKey: qk.contacts,
    queryFn: () => apiGet("communication.contacts"),
  });
}

// --- Reports ---------------------------------------------------------------

export interface ReportsOverview {
  academic: {
    by_subject: Array<{ subject: string; average: number; results: number }>;
    by_grade: Array<{ grade: string; average: number; students: number }>;
    top_students: Array<{ student: string; student_name: string; average: number }>;
  };
  attendance: {
    monthly: Array<{ month: string; rate: number; present: number; absent: number }>;
    by_group: Array<{ student_group: string; rate: number; total: number }>;
    overall: number;
  };
  financial: {
    monthly: Array<{ month: string; expected: number; collected: number }>;
    by_program: Array<{
      program: string;
      total: number;
      collected: number;
      outstanding: number;
      invoices: number;
    }>;
    totals: { total: number; collected: number; outstanding: number; collection_rate: number };
  } | null;
  academic_year: string | null;
}

export function useReports() {
  return useQuery<ReportsOverview>({
    queryKey: ["reports"],
    queryFn: () => apiGet<ReportsOverview>("reports.overview"),
  });
}

// --- Settings --------------------------------------------------------------

export interface SchoolSettings {
  school: {
    company: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    currency: string | null;
  };
  academic: {
    current_year: string | null;
    current_term: string | null;
    years: Array<{ name: string; year_start_date: string; year_end_date: string }>;
    terms: Array<{
      name: string;
      academic_year: string;
      term_start_date: string;
      term_end_date: string;
    }>;
  };
  roles: Array<{ persona: string; role: string; label: string; users: number }>;
  counts: Record<string, number>;
}

export function useSettings() {
  return useQuery<SchoolSettings>({
    queryKey: ["settings"],
    queryFn: () => apiGet<SchoolSettings>("settings.get_settings"),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ updated: string[] }>("settings.save_settings", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: qk.session });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

// --- Wellbeing: health and behaviour ---------------------------------------

export interface HealthVisit {
  id: string;
  date: string;
  type: string;
  type_raw: string;
  complaint: string | null;
  treatment: string | null;
  outcome: string;
  parent_notified: boolean;
}

export interface HealthProfile {
  student: string;
  student_name: string | null;
  record: {
    name: string;
    blood_group: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    chronic_conditions: string | null;
    allergies: string | null;
    medications: string | null;
    special_needs: string | null;
    immunisations: string | null;
    last_checkup: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    physician_name: string | null;
    physician_phone: string | null;
    notes: string | null;
  } | null;
  visits: HealthVisit[];
}

export function useHealthRecord(student: string | undefined) {
  return useQuery<HealthProfile>({
    queryKey: ["health", student ?? ""],
    queryFn: () => apiGet<HealthProfile>("wellbeing.get_health_record", { student }),
    enabled: Boolean(student),
  });
}

export function useSaveHealthRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("wellbeing.save_health_record", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health"] }),
  });
}

export function useSaveHealthVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("wellbeing.save_health_visit", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health"] }),
  });
}

export function useDeleteHealthVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visit: string) =>
      apiPost<{ id: string }>("wellbeing.delete_health_visit", { visit }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health"] }),
  });
}

export interface BehaviourRow {
  id: string;
  student: string;
  student_name: string;
  date: string;
  type: string;
  type_raw: string;
  points: number;
  category: string | null;
  student_group: string | null;
  description: string | null;
  action_taken: string | null;
  parent_notified: boolean;
}

export interface BehaviourList extends Paginated<BehaviourRow> {
  summary: { positive: number; negative: number; net_points: number };
}

export function useBehaviour(
  params: Opt<{
    filters: Record<string, unknown>;
    page: number;
    page_size: number;
    sort_field: string;
    sort_order: string;
  }> = {},
) {
  return useQuery<BehaviourList>({
    queryKey: ["behaviour", params],
    queryFn: () => apiGet<BehaviourList>("wellbeing.list_behaviour", params),
    placeholderData: (prev) => prev,
  });
}

export function useSaveBehaviour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; points: number }>("wellbeing.save_behaviour", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["behaviour"] }),
  });
}

export function useDeleteBehaviour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: string) =>
      apiPost<{ id: string }>("wellbeing.delete_behaviour", { record }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["behaviour"] }),
  });
}

export function useBehaviourSummary(student: string | undefined) {
  return useQuery<{
    student: string;
    positive: number;
    negative: number;
    net_points: number;
    by_category: Array<{ category: string; count: number; points: number }>;
  }>({
    queryKey: ["behaviour-summary", student ?? ""],
    queryFn: () => apiGet("wellbeing.behaviour_summary", { student }),
    enabled: Boolean(student),
  });
}

// --- Resources: library and transport --------------------------------------

export interface BookRow {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  language: string | null;
  publisher: string | null;
  published_year: number | null;
  shelf: string | null;
  total_copies: number;
  available_copies: number;
  cover_image: string | null;
}

export function useBooks(
  params: Opt<{
    filters: Record<string, unknown>;
    page: number;
    page_size: number;
    sort_field: string;
    sort_order: string;
  }> = {},
) {
  return useQuery<Paginated<BookRow>>({
    queryKey: ["books", params],
    queryFn: () => apiGet<Paginated<BookRow>>("resources.list_books", params),
    placeholderData: (prev) => prev,
  });
}

export function useSaveBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("resources.save_book", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["books"] }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (book: string) => apiPost<{ id: string }>("resources.delete_book", { book }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["books"] }),
  });
}

export interface LoanRow {
  id: string;
  book: string;
  book_title: string;
  student: string;
  student_name: string;
  status: string;
  status_raw: string;
  issue_date: string;
  due_date: string;
  return_date: string;
  notes: string | null;
}

export function useLoans(
  params: Opt<{
    filters: Record<string, unknown>;
    page: number;
    page_size: number;
    sort_field: string;
    sort_order: string;
  }> = {},
) {
  return useQuery<Paginated<LoanRow> & { summary: Record<string, number> }>({
    queryKey: ["loans", params],
    queryFn: () => apiGet("resources.list_loans", params),
    placeholderData: (prev) => prev,
  });
}

export function useIssueBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("resources.issue_book", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useReturnBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { loan: string; status?: string }) =>
      apiPost<{ id: string; status: string }>("resources.return_book", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export interface RouteRow {
  id: string;
  route_name: string;
  vehicle_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  capacity: number;
  assigned: number;
  seats_left: number;
  departure_time: string;
  return_time: string;
  active: boolean;
  monthly_fee: number;
  stops: string[];
}

export function useRoutes(filters?: Record<string, unknown>) {
  return useQuery<RouteRow[]>({
    queryKey: ["routes", filters ?? {}],
    queryFn: () => apiGet<RouteRow[]>("resources.list_routes", { filters }),
  });
}

export function useSaveRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("resources.save_route", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (route: string) => apiPost<{ id: string }>("resources.delete_route", { route }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export interface TransportAssignmentRow {
  id: string;
  student: string;
  student_name: string;
  route: string;
  route_name: string | null;
  stop: string | null;
  active: boolean;
  start_date: string;
  end_date: string;
  notes: string | null;
}

export function useTransportAssignments(
  params: Opt<{ filters: Record<string, unknown>; page: number; page_size: number }> = {},
) {
  return useQuery<Paginated<TransportAssignmentRow>>({
    queryKey: ["transport", params],
    queryFn: () => apiGet("resources.list_transport_assignments", params),
    placeholderData: (prev) => prev,
  });
}

export function useSaveTransportAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("resources.save_transport_assignment", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport"] });
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

export function useDeleteTransportAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignment: string) =>
      apiPost<{ id: string }>("resources.delete_transport_assignment", { assignment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport"] });
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

// --- CRUD for academics ----------------------------------------------------

export function useSaveClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("academics.save_class", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (student_group: string) =>
      apiPost<{ id: string }>("academics.delete_class", { student_group }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });
}

export function useSetClassStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student_group: string; students: string[] }) =>
      apiPost<{ id: string; count: number }>("academics.set_class_students", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["class-students"] });
    },
  });
}

export function useSaveSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("academics.save_subject", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.subjects }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (course: string) => apiPost<{ id: string }>("academics.delete_subject", { course }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.subjects }),
  });
}

export function useSaveTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("academics.save_teacher", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instructor: string) =>
      apiPost<{ id: string }>("academics.delete_teacher", { instructor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });
}

export function useSaveExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("academics.save_exam", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams"] }),
  });
}

export function useExamRoster(assessment_plan: string | undefined) {
  return useQuery<{
    exam: { id: string; title: string; subject: string; student_group: string; max: number };
    rows: Array<{
      student: string;
      student_name: string;
      result_id: string | null;
      score: number | null;
      grade: string | null;
      comment: string | null;
    }>;
    entered: number;
    total: number;
  }>({
    queryKey: ["exam-roster", assessment_plan ?? ""],
    queryFn: () => apiGet("academics.exam_roster", { assessment_plan }),
    enabled: Boolean(assessment_plan),
  });
}

export function useSaveGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; score: number; grade: string }>("academics.save_grade", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-roster"] });
      qc.invalidateQueries({ queryKey: ["grades"] });
    },
  });
}

export function useDepartments() {
  return useQuery<Array<{ name: string }>>({
    queryKey: ["departments"],
    queryFn: () => apiGet("academics.list_departments"),
    staleTime: 10 * 60 * 1000,
  });
}

// --- Gradebook -------------------------------------------------------------

export interface GradeBand {
  grade: string;
  label: string;
  emoji: string;
}

export interface SchemeComponent {
  component_name: string;
  component_type: string;
  type_label?: string;
  weight: number;
  max_score: number;
}

export interface GradeScheme {
  id: string;
  name: string;
  scheme_name: string;
  course: string | null;
  program: string | null;
  academic_year: string | null;
  academic_term: string | null;
  is_default: number;
  total_weight: number;
  components: SchemeComponent[];
}

export function useSchemes(params: Opt<{ course: string; program: string }> = {}) {
  return useQuery<GradeScheme[]>({
    queryKey: ["schemes", params],
    queryFn: () => apiGet<GradeScheme[]>("gradebook.list_schemes", params),
  });
}

export function useSaveScheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; total_weight: number }>("gradebook.save_scheme", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schemes"] }),
  });
}

export function useDeleteScheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scheme: string) => apiPost<{ id: string }>("gradebook.delete_scheme", { scheme }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schemes"] }),
  });
}

export interface EntrySheetRow {
  student: string;
  student_name: string;
  roll_number: number | null;
  entry_id: string | null;
  score: number | null;
  max_score: number | null;
  remarks: string | null;
  entries: Array<{
    id: string;
    component_name: string;
    component_type: string;
    type_label: string;
    score: number;
    max_score: number;
    is_bonus: boolean;
  }>;
}

export interface EntrySheet {
  student_group: string;
  course: string;
  program: string | null;
  academic_year: string | null;
  academic_term: string | null;
  component_name: string | null;
  scheme: { id: string; scheme_name: string; components: SchemeComponent[] } | null;
  components: SchemeComponent[];
  rows: EntrySheetRow[];
  entered: number;
  total: number;
}

export function useEntrySheet(
  params: Opt<{
    student_group: string;
    course: string;
    component_name: string;
    academic_term: string;
  }> = {},
  enabled = true,
) {
  return useQuery<EntrySheet>({
    queryKey: ["entry-sheet", params],
    queryFn: () => apiGet<EntrySheet>("gradebook.get_entry_sheet", params),
    enabled: enabled && Boolean(params.student_group && params.course),
  });
}

export function useSaveMarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ created: number; updated: number; skipped: string[] }>("gradebook.save_marks", {
        payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
      qc.invalidateQueries({ queryKey: ["class-term-grades"] });
      qc.invalidateQueries({ queryKey: ["academic-record"] });
    },
  });
}

export interface SubjectGrade extends GradeBand {
  course: string;
  percentage: number;
  bonus: number;
  final: number;
  covered: number;
  components: Array<
    GradeBand & {
      id: string;
      component_name: string;
      component_type: string;
      type_label: string;
      score: number;
      max_score: number;
      weight: number;
      percentage: number;
      is_bonus: boolean;
      remarks: string | null;
    }
  >;
}

export interface TermGrades {
  student: string;
  student_name: string | null;
  image: string | null;
  academic_year: string | null;
  academic_term: string | null;
  subjects: SubjectGrade[];
  overall: number;
  overall_grade: GradeBand & { percentage: number };
  subject_count: number;
}

export function useTermGrades(
  student: string | undefined,
  params: Opt<{ academic_year: string; academic_term: string }> = {},
) {
  return useQuery<TermGrades>({
    queryKey: ["term-grades", student ?? "", params],
    queryFn: () => apiGet<TermGrades>("gradebook.term_grades", { student, ...params }),
    enabled: Boolean(student),
  });
}

export interface AcademicRecord {
  student: string;
  student_name: string | null;
  image: string | null;
  periods: Array<{
    academic_year: string | null;
    academic_term: string | null;
    subjects: SubjectGrade[];
    overall: number;
    overall_grade: GradeBand & { percentage: number };
  }>;
  cumulative: number;
  cumulative_grade: GradeBand & { percentage: number };
}

export function useAcademicRecord(student: string | undefined) {
  return useQuery<AcademicRecord>({
    queryKey: ["academic-record", student ?? ""],
    queryFn: () => apiGet<AcademicRecord>("gradebook.academic_record", { student }),
    enabled: Boolean(student),
  });
}

export interface ClassTermGrades {
  student_group: string;
  course: string | null;
  academic_year: string | null;
  academic_term: string | null;
  rows: Array<
    GradeBand & {
      student: string;
      student_name: string;
      entries: number;
      percentage: number;
      bonus: number;
      final: number;
      covered: number;
    }
  >;
  class_average: number;
}

export function useClassTermGrades(
  params: Opt<{ student_group: string; course: string; academic_term: string }> = {},
) {
  return useQuery<ClassTermGrades>({
    queryKey: ["class-term-grades", params],
    queryFn: () => apiGet<ClassTermGrades>("gradebook.class_term_grades", params),
    enabled: Boolean(params.student_group),
  });
}

export function useImportExamResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { assessment_plan: string; weight?: number }) =>
      apiPost<{ created: number; updated: number }>("gradebook.import_exam_results", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
      qc.invalidateQueries({ queryKey: ["class-term-grades"] });
    },
  });
}

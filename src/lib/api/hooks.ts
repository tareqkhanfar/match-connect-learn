/** React Query hooks wrapping the Match Schools API. */

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

// --- Profile and personal preferences --------------------------------------

export interface MyProfile {
  profile: {
    user: string;
    email: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    image: string | null;
    persona: string;
    persona_label: string;
    last_login: string;
    linked: Record<string, unknown> | null;
  };
  preferences: Record<string, string>;
}

export function useMyProfile() {
  return useQuery<MyProfile>({
    queryKey: ["my-profile"],
    queryFn: () => apiGet<MyProfile>("settings.my_profile"),
  });
}

export function useSaveMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ user: string; preferences: Record<string, string> }>(
        "settings.save_my_profile",
        { payload },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: qk.session });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (vars: { current_password: string; new_password: string }) =>
      apiPost<{ user: string }>("settings.change_password", vars),
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
  policies: { student_open_messaging: boolean };
  counts: Record<string, number>;
}

/** School-wide messaging policy: may students write outside their teachers? */
export function useSetOpenMessaging() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      apiPost<{ student_open_messaging: boolean }>("messaging.set_open_messaging", {
        enabled: enabled ? 1 : 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["audience"] });
    },
  });
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
    /** Null when the viewer may not see a total for this period. */
    overall: number | null;
    overall_grade: (GradeBand & { percentage: number }) | null;
    published: boolean;
    shows_overall: boolean;
  }>;
  cumulative: number | null;
  cumulative_grade: (GradeBand & { percentage: number }) | null;
  shows_cumulative: boolean;
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

// --- Chat ------------------------------------------------------------------

export interface AudiencePerson {
  user: string;
  name: string;
  role: string;
}

export interface AudienceGroup {
  id: string;
  name: string;
  program: string | null;
  batch: string | null;
  members: number;
}

export interface AudienceCourse {
  id: string;
  name: string;
}

export interface Audience {
  people: AudiencePerson[];
  groups: AudienceGroup[];
  courses: AudienceCourse[];
  policy: { student_open_messaging: boolean; restricted: boolean };
}

/** Everyone (and every section/course) the caller may address. */
export function useAudience() {
  return useQuery<Audience>({
    queryKey: ["audience"],
    queryFn: () => apiGet<Audience>("messaging.audience"),
  });
}

export interface ConversationMessage {
  id: string;
  sender: string;
  sender_name: string;
  recipient: string;
  body: string;
  sent_on: string;
  outgoing: boolean;
  read: boolean;
  files: SubmissionFile[];
}

export interface Conversation {
  thread: string;
  subject: string | null;
  participants: Array<{ user: string; name: string }>;
  /** True when a back-office user is reading someone else's conversation. */
  observing: boolean;
  messages: ConversationMessage[];
}

export function useConversation(thread: Opt<string>) {
  return useQuery<Conversation>({
    queryKey: ["conversation", thread],
    queryFn: () => apiGet<Conversation>("messaging.conversation", { thread: thread! }),
    enabled: Boolean(thread),
    refetchInterval: 30_000,
  });
}

export function useSendChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      body: string;
      recipients?: string[];
      groups?: string[];
      courses?: string[];
      subject?: string;
      thread?: string;
      files?: SubmissionFile[];
    }) =>
      apiPost<{ sent: number; messages: string[]; recipients: string[] }>(
        "messaging.send",
        vars,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.inbox });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      if (vars.thread) qc.invalidateQueries({ queryKey: ["conversation", vars.thread] });
    },
  });
}

/** Back-office oversight of every conversation a student is part of. */
export function useStudentConversations(student?: Opt<string>, limit = 50) {
  return useQuery<{
    student: string | null;
    rows: Array<{
      id: string;
      thread: string;
      subject: string | null;
      preview: string;
      from: string;
      from_user: string;
      to: string;
      to_user: string;
      time: string;
    }>;
  }>({
    queryKey: ["student-conversations", student ?? null, limit],
    queryFn: () =>
      apiGet("messaging.student_conversations", {
        ...(student ? { student } : {}),
        limit,
      }),
  });
}

// --- Fees: write operations -------------------------------------------------

export interface FeeFormOptions {
  structures: Array<{
    id: string;
    name: string;
    program: string | null;
    academic_year: string | null;
    academic_term: string | null;
    total: number;
  }>;
  categories: string[];
  modes: string[];
  companies: string[];
}

export function useFeeFormOptions(enabled = true) {
  return useQuery<FeeFormOptions>({
    queryKey: ["fee-form-options"],
    queryFn: () => apiGet<FeeFormOptions>("fees.fee_form_options"),
    enabled,
  });
}

export function useSaveFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; grand_total: number; outstanding: number }>("fees.save_fee", {
        payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: qk.collection });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      fees: string;
      amount: number;
      mode_of_payment?: string;
      reference_no?: string;
      posting_date?: string;
      remarks?: string;
    }) =>
      apiPost<{
        journal_entry: string;
        fees: string;
        paid: number;
        outstanding: number;
        status: string;
      }>("fees.record_payment", vars),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: qk.feeDetail(vars.fees) });
      qc.invalidateQueries({ queryKey: ["fee-payments", vars.fees] });
      qc.invalidateQueries({ queryKey: qk.collection });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useCancelFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fees: string) => apiPost<{ id: string }>("fees.cancel_fee", { fees }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: qk.collection });
    },
  });
}

export function useFeePayments(fees: Opt<string>) {
  return useQuery<
    Array<{
      id: string;
      amount: number;
      date: string;
      mode: string | null;
      reference: string | null;
      remarks: string | null;
    }>
  >({
    queryKey: ["fee-payments", fees],
    queryFn: () => apiGet("fees.list_payments", { fees: fees! }),
    enabled: Boolean(fees),
  });
}

// --- Guardians --------------------------------------------------------------

export interface GuardianRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  alternate_phone: string | null;
  occupation: string | null;
  designation: string | null;
  user: string | null;
  image: string | null;
  children: Array<{ id: string; name: string; relation: string | null }>;
  children_count: number;
}

export function useGuardians(params: Opt<{ search: string; page: number; page_size: number }> = {}) {
  return useQuery<Paginated<GuardianRow>>({
    queryKey: ["guardians", params],
    queryFn: () => apiGet<Paginated<GuardianRow>>("students.list_guardians", params),
    placeholderData: (prev) => prev,
  });
}

export function useSaveGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; name: string }>("students.save_guardian", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guardians"] }),
  });
}

export function useDeleteGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (guardian: string) =>
      apiPost<{ id: string }>("students.delete_guardian", { guardian }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guardians"] }),
  });
}

export function useLinkGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student: string; guardian: string; relation?: string }) =>
      apiPost<{ student: string }>("students.link_guardian", vars),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["guardians"] });
      qc.invalidateQueries({ queryKey: qk.student(vars.student) });
    },
  });
}

export function useUnlinkGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student: string; guardian: string }) =>
      apiPost<{ student: string }>("students.unlink_guardian", vars),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["guardians"] });
      qc.invalidateQueries({ queryKey: qk.student(vars.student) });
    },
  });
}

// --- Health register --------------------------------------------------------

export interface HealthRow {
  id: string;
  student: string;
  student_name: string;
  blood_group: string | null;
  chronic_conditions: string | null;
  allergies: string | null;
  medications: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  visits: number;
  updated: string;
}

export function useHealthRegister(
  params: Opt<{
    filters: Record<string, unknown>;
    search: string;
    page: number;
    page_size: number;
    sort_by: string;
    sort_order: string;
  }> = {},
  enabled = true,
) {
  return useQuery<Paginated<HealthRow>>({
    queryKey: ["health-register", params],
    queryFn: () => apiGet<Paginated<HealthRow>>("wellbeing.list_health_records", params),
    placeholderData: (prev) => prev,
    enabled,
  });
}

// --- Bulk actions -----------------------------------------------------------

export function useBulkOptions(doctype: Opt<string>, enabled = true) {
  return useQuery<{ can_delete: boolean; fields: string[] }>({
    queryKey: ["bulk-options", doctype],
    queryFn: () => apiGet("bulk.bulk_options", { doctype: doctype! }),
    enabled: Boolean(doctype) && enabled,
  });
}

export function useBulkDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { doctype: string; records: string[] }) =>
      apiPost<{ deleted: number; failed: Array<{ name: string; reason: string }> }>(
        "bulk.bulk_delete",
        vars,
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useBulkUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      doctype: string;
      records: string[];
      field: string;
      value: string | number;
    }) =>
      apiPost<{ updated: number; failed: Array<{ name: string; reason: string }> }>(
        "bulk.bulk_update",
        vars,
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- End-of-term grade workflow --------------------------------------------

export interface TermSubmissionRow {
  id: string | null;
  student_group: string;
  course: string;
  status: "Draft" | "Submitted" | "Returned" | "Approved" | "Published";
  status_label: string;
  students: number;
  entered: number;
  complete: boolean;
  submitted_on: string;
  review_notes: string | null;
  instructor: string | null;
}

/** What each of my classes/subjects owes, and where it stands. */
export function useMySubmissions(academicTerm?: Opt<string>) {
  return useQuery<{ rows: TermSubmissionRow[]; academic_term: string | null }>({
    queryKey: ["term-submissions", academicTerm ?? null],
    queryFn: () =>
      apiGet("gradeflow.my_submissions", academicTerm ? { academic_term: academicTerm } : {}),
  });
}

export function useSubmitTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      academic_term?: string;
      notes?: string;
    }) => apiPost<{ id: string; status: string; students: number }>("gradeflow.submit_term", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term-submissions"] });
      qc.invalidateQueries({ queryKey: ["term-overview"] });
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
    },
  });
}

export function useReviewTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { submission: string; action: "approve" | "return"; notes?: string }) =>
      apiPost<{ id: string; status: string }>("gradeflow.review_term", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term-overview"] });
      qc.invalidateQueries({ queryKey: ["term-submissions"] });
    },
  });
}

export interface TermOverviewRow {
  student_group: string;
  name: string;
  expected: number;
  submitted: number;
  approved: number;
  published: number;
  returned: number;
  ready: boolean;
  is_published: boolean;
  subjects: Array<{
    id: string;
    course: string;
    status: string;
    status_label: string;
    instructor: string | null;
    submitted_on: string;
  }>;
}

/** The administration's publishing console. */
export function useTermOverview(academicTerm?: Opt<string>, enabled = true) {
  return useQuery<{ rows: TermOverviewRow[]; academic_term: string | null }>({
    queryKey: ["term-overview", academicTerm ?? null],
    queryFn: () =>
      apiGet("gradeflow.term_overview", academicTerm ? { academic_term: academicTerm } : {}),
    enabled,
  });
}

export function usePublishTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student_group: string; academic_term?: string; force?: boolean }) =>
      apiPost<{ published: number }>("gradeflow.publish_term", {
        student_group: vars.student_group,
        ...(vars.academic_term ? { academic_term: vars.academic_term } : {}),
        ...(vars.force ? { force: 1 } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term-overview"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
      qc.invalidateQueries({ queryKey: ["academic-record"] });
    },
  });
}

export function useUnpublishTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student_group: string; academic_term?: string; reason?: string }) =>
      apiPost<{ reopened: number }>("gradeflow.unpublish_term", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term-overview"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
    },
  });
}

// --- Carrying assignment marks into the term gradebook ----------------------

export interface ImportableAssignment {
  id: string;
  title: string;
  course: string;
  max: number;
  due: string;
  status: string;
  graded: number;
  total: number;
  ready: boolean;
  imported: boolean;
}

export function useImportableAssignments(
  params: Opt<{ student_group: string; course: string }> = {},
  enabled = true,
) {
  return useQuery<ImportableAssignment[]>({
    queryKey: ["importable-assignments", params],
    queryFn: () => apiGet<ImportableAssignment[]>("gradebook.importable_assignments", params),
    enabled: Boolean(params.student_group) && enabled,
  });
}

export function useImportAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { assignment: string; weight?: number; component_name?: string }) =>
      apiPost<{ created: number; updated: number }>("gradebook.import_assignment", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["importable-assignments"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
    },
  });
}

export function useImportAssignmentsCombined() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      assignments: string[];
      component_name?: string;
      weight?: number;
    }) => apiPost<{ created: number; updated: number }>("gradebook.import_assignments_combined", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["importable-assignments"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
    },
  });
}

// --- Exam timetable ---------------------------------------------------------

export interface ExamSitting {
  id: string;
  title: string;
  course: string;
  program: string | null;
  student_group: string;
  date: string;
  from_time: string;
  to_time: string;
  duration: number;
  room: string | null;
  room_name: string | null;
  examiner: string | null;
  examiner_name: string | null;
  supervisor: string | null;
  supervisor_name: string | null;
  max: number;
  exam_type: string;
  exam_type_label: string;
  colour: string;
  academic_term: string | null;
  academic_year: string | null;
  upcoming: boolean;
  days_away: number | null;
}

export interface ExamSchedule {
  exams: ExamSitting[];
  upcoming: number;
  past: number;
  types: Array<{ code: string; label: string; colour: string }>;
}

export function useExamSchedule(
  params: Opt<{
    academic_term: string;
    student_group: string;
    course: string;
    exam_type: string;
    from_date: string;
    to_date: string;
  }> = {},
) {
  return useQuery<ExamSchedule>({
    queryKey: ["exam-schedule", params],
    queryFn: () => apiGet<ExamSchedule>("exams.schedule", params),
    placeholderData: (prev) => prev,
  });
}

export interface ExamFormOptions {
  groups: Array<{ id: string; name: string; program: string | null; students: number }>;
  courses: string[];
  rooms: Array<{ id: string; name: string; capacity: number }>;
  types: Array<{ code: string; label: string; colour: string }>;
}

export function useExamFormOptions(enabled = true) {
  return useQuery<ExamFormOptions>({
    queryKey: ["exam-form-options"],
    queryFn: () => apiGet<ExamFormOptions>("exams.form_options"),
    enabled,
  });
}

export function useSaveExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string; date: string }>("exams.save_exam", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-schedule"] }),
  });
}

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exam: string) => apiPost<{ id: string }>("exams.delete_exam", { exam }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-schedule"] }),
  });
}

// --- Timetable generation ---------------------------------------------------

export interface TimetablePlan {
  id: string;
  name: string;
  student_group: string;
  academic_year: string | null;
  academic_term: string | null;
  status: "Draft" | "Generated" | "Applied";
  lessons: number;
  generated_on?: string;
}

export interface PlanDetail extends TimetablePlan {
  working_days: string[];
  notes: string | null;
  periods: Array<{
    name: string;
    order: number;
    from_time: string;
    to_time: string;
    is_break: boolean;
  }>;
  subjects: Array<{
    course: string;
    periods_per_week: number;
    instructor: string | null;
    preferred_room: string | null;
    max_per_day: number;
  }>;
}

export function useTimetablePlans(enabled = true) {
  return useQuery<TimetablePlan[]>({
    queryKey: ["timetable-plans"],
    queryFn: () => apiGet<TimetablePlan[]>("timetable.list_plans"),
    enabled,
  });
}

export function usePlan(plan: Opt<string>) {
  return useQuery<PlanDetail>({
    queryKey: ["timetable-plan", plan],
    queryFn: () => apiGet<PlanDetail>("timetable.get_plan", { plan: plan! }),
    enabled: Boolean(plan),
  });
}

export function usePlanDefaults(studentGroup: Opt<string>) {
  return useQuery<{
    periods: PlanDetail["periods"];
    working_days: string[];
    subjects: PlanDetail["subjects"];
    days: Array<{ code: string; label: string }>;
  }>({
    queryKey: ["plan-defaults", studentGroup],
    queryFn: () =>
      apiGet("timetable.plan_defaults", studentGroup ? { student_group: studentGroup } : {}),
    enabled: Boolean(studentGroup),
  });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<PlanDetail>("timetable.save_plan", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable-plans"] });
      qc.invalidateQueries({ queryKey: ["timetable-plan"] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: string) => apiPost<{ id: string }>("timetable.delete_plan", { plan }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timetable-plans"] }),
  });
}

export interface GeneratedTimetable {
  plan: string;
  teacherless: string[];
  days: Array<{ code: string; label: string }>;
  periods: Array<{ name: string; order: number; from_time: string; to_time: string }>;
  lessons: Array<{
    day: string;
    day_label: string;
    period: string;
    period_order: number;
    from_time: string;
    to_time: string;
    course: string;
    instructor: string | null;
    room: string | null;
  }>;
  placed: number;
  demand: number;
  capacity: number;
  unplaced: Array<{ course: string; periods: number }>;
  complete: boolean;
}

export function useGenerateTimetable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: string) => apiPost<GeneratedTimetable>("timetable.generate", { plan }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timetable-plans"] }),
  });
}

export function useApplyTimetable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { plan: string; from_date?: string; weeks?: number }) =>
      apiPost<{ created: number; skipped: Array<{ date: string; course: string; reason: string }> }>(
        "timetable.apply_plan",
        vars,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable-plans"] });
      qc.invalidateQueries({ queryKey: qk.timetable({}) });
    },
  });
}

// --- Certificates -----------------------------------------------------------

export interface AvailableDocuments {
  student: string | null;
  student_name?: string;
  documents: Array<{
    kind: string;
    label: string;
    description: string;
    available: boolean;
    reason: string | null;
  }>;
}

export function useAvailableDocuments(student: string | null | undefined) {
  return useQuery<AvailableDocuments>({
    queryKey: ["available-documents", student ?? null],
    queryFn: () =>
      apiGet<AvailableDocuments>("certificates.available_documents", student ? { student } : {}),
  });
}

// --- Activities -------------------------------------------------------------

export interface ActivityRow {
  id: string;
  title: string;
  type: string;
  type_label: string;
  status: string;
  status_label: string;
  start_date: string;
  end_date: string;
  from_time: string;
  to_time: string;
  location: string | null;
  capacity: number;
  fee: number;
  supervisor: string | null;
  audience: string;
  program: string | null;
  student_group: string | null;
  requires_consent: boolean;
  registration_deadline: string;
  description: string | null;
  registered: number;
  waitlisted: number;
  seats_left: number | null;
  full: boolean;
  open: boolean;
  upcoming: boolean;
  my_enrolments: Array<{
    id: string;
    student: string;
    student_name: string;
    status: string;
    status_label: string;
    consent_status: string;
    consent_label: string;
  }>;
}

export function useActivities(
  params: Opt<{ activity_type: string; status: string; search: string; page: number; page_size: number }> = {},
) {
  return useQuery<Paginated<ActivityRow>>({
    queryKey: ["activities", params],
    queryFn: () => apiGet<Paginated<ActivityRow>>("activities.list_activities", params),
    placeholderData: (prev) => prev,
  });
}

export function useActivityOptions(enabled = true) {
  return useQuery<{
    types: Array<{ code: string; label: string }>;
    statuses: Array<{ code: string; label: string }>;
    programs: string[];
    groups: Array<{ id: string; name: string }>;
    supervisors: Array<{ id: string; name: string }>;
  }>({
    queryKey: ["activity-options"],
    queryFn: () => apiGet("activities.form_options"),
    enabled,
  });
}

export function useSaveActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string }>("activities.save_activity", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (activity: string) =>
      apiPost<{ id: string }>("activities.delete_activity", { activity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useRegisterActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { activity: string; student?: string }) =>
      apiPost<{ id: string; status: string; waitlisted: boolean }>("activities.register", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["activity-participants"] });
    },
  });
}

export function useWithdrawActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrolment: string) =>
      apiPost<{ id: string; promoted: string | null }>("activities.withdraw", { enrolment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["activity-participants"] });
    },
  });
}

export function useGiveConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { enrolment: string; granted: number; notes?: string }) =>
      apiPost<{ id: string; consent_status: string; status: string }>(
        "activities.give_consent",
        vars,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["activity-participants"] });
    },
  });
}

export function useActivityParticipants(activity: Opt<string>) {
  return useQuery<{
    activity: { id: string; title: string; capacity: number; requires_consent: boolean; start_date: string };
    rows: Array<{
      id: string;
      student: string;
      student_name: string;
      status: string;
      status_label: string;
      consent_status: string;
      consent_label: string;
      attended: boolean;
      enrolled_on: string;
      notes: string | null;
    }>;
    confirmed: number;
    waitlisted: number;
    awaiting_consent: number;
  }>({
    queryKey: ["activity-participants", activity],
    queryFn: () => apiGet("activities.participants", { activity: activity! }),
    enabled: Boolean(activity),
  });
}

export function useMarkActivityAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: Array<{ id: string; attended: number }>) =>
      apiPost<{ updated: number }>("activities.mark_attendance", { entries }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-participants"] }),
  });
}

// --- Teacher appraisal ------------------------------------------------------

export interface ObservationRow {
  id: string;
  instructor: string;
  instructor_name: string;
  date: string;
  type: string;
  type_label: string;
  status: string;
  status_label: string;
  course: string | null;
  student_group: string | null;
  percent: number;
  rating: string | null;
  observer: string | null;
  has_response: boolean;
}

export function useObservations(
  params: Opt<{ instructor: string; status: string; page: number; page_size: number }> = {},
) {
  return useQuery<Paginated<ObservationRow>>({
    queryKey: ["observations", params],
    queryFn: () => apiGet<Paginated<ObservationRow>>("appraisal.list_observations", params),
    placeholderData: (prev) => prev,
  });
}

export interface ObservationDetail {
  id: string;
  instructor: string;
  instructor_name: string;
  date: string;
  type: string;
  type_label: string;
  status: string;
  status_label: string;
  course: string | null;
  student_group: string | null;
  observer: string | null;
  percent: number;
  score: number;
  rating: string | null;
  strengths: string | null;
  improvements: string | null;
  action_plan: string | null;
  teacher_response: string | null;
  criteria: Array<{
    criterion: string;
    weight: number;
    score: number;
    max_score: number;
    comment: string | null;
  }>;
}

export function useObservation(observation: Opt<string>) {
  return useQuery<ObservationDetail>({
    queryKey: ["observation", observation],
    queryFn: () => apiGet<ObservationDetail>("appraisal.get_observation", { observation: observation! }),
    enabled: Boolean(observation),
  });
}

export function useSaveObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; percent: number; rating: string; status: string }>(
        "appraisal.save_observation",
        { payload },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observations"] });
      qc.invalidateQueries({ queryKey: ["observation"] });
      qc.invalidateQueries({ queryKey: ["appraisal-overview"] });
    },
  });
}

export function useShareObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (observation: string) =>
      apiPost<{ id: string; status: string }>("appraisal.share_observation", { observation }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observations"] });
      qc.invalidateQueries({ queryKey: ["appraisal-overview"] });
    },
  });
}

export function useAcknowledgeObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { observation: string; response?: string }) =>
      apiPost<{ id: string; status: string }>("appraisal.acknowledge", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observations"] });
      qc.invalidateQueries({ queryKey: ["observation"] });
      qc.invalidateQueries({ queryKey: ["performance-file"] });
    },
  });
}

export function useDeleteObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (observation: string) =>
      apiPost<{ id: string }>("appraisal.delete_observation", { observation }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["observations"] }),
  });
}

export interface PerformanceFile {
  instructor: string;
  name: string;
  department: string | null;
  summary: {
    observations: number;
    average_percent: number | null;
    latest_rating: string | null;
    trend: "up" | "down" | "flat" | null;
    awaiting_response: number;
  };
  teaching: {
    classes: number;
    subjects: number;
    students: number;
    assignments: number;
    marks_entered: number;
    terms_submitted: number;
  };
  observations: Array<{
    id: string;
    date: string;
    type_label: string;
    status: string;
    status_label: string;
    percent: number;
    rating: string | null;
    course: string | null;
    student_group: string | null;
    strengths: string | null;
    improvements: string | null;
  }>;
}

export function usePerformanceFile(instructor?: Opt<string>) {
  return useQuery<PerformanceFile>({
    queryKey: ["performance-file", instructor ?? null],
    queryFn: () =>
      apiGet<PerformanceFile>("appraisal.performance_file", instructor ? { instructor } : {}),
  });
}

export function useAppraisalOverview(enabled = true) {
  return useQuery<{
    rows: Array<{
      instructor: string;
      name: string;
      department: string | null;
      observations: number;
      average: number | null;
      latest: string | null;
      latest_rating: string | null;
      drafts: number;
      awaiting_response: number;
    }>;
    summary: {
      teachers: number;
      observed: number;
      never_observed: number;
      school_average: number | null;
    };
    criteria_template: Array<{ criterion: string; weight: number; max_score: number }>;
  }>({
    queryKey: ["appraisal-overview"],
    queryFn: () => apiGet("appraisal.appraisal_overview"),
    enabled,
  });
}

// --- Quizzes ----------------------------------------------------------------

export interface QuizRow {
  id: string;
  title: string;
  course: string;
  student_group: string;
  status: string;
  status_label: string;
  opens_on: string;
  closes_on: string;
  time_limit: number;
  attempts_allowed: number;
  total_marks: number;
  pass_mark: number;
  questions: number;
  instructor: string | null;
  open: boolean;
  submissions: number;
  my_attempts: Array<{
    id: string;
    status: string;
    status_label: string;
    score: number;
    percentage: number;
    passed: boolean;
    attempt: number;
  }>;
  attempts_left: number;
  best: number | null;
}

export function useQuizzes(
  params: Opt<{ student_group: string; course: string; status: string; page: number; page_size: number }> = {},
) {
  return useQuery<Paginated<QuizRow>>({
    queryKey: ["quizzes", params],
    queryFn: () => apiGet<Paginated<QuizRow>>("quizzes.list_quizzes", params),
    placeholderData: (prev) => prev,
  });
}

export interface QuizDetail {
  id: string;
  title: string;
  course: string;
  student_group: string;
  status: string;
  status_label: string;
  opens_on: string;
  closes_on: string;
  time_limit: number;
  attempts_allowed: number;
  shuffle: boolean;
  total_marks: number;
  pass_mark: number;
  show_answers_after: string;
  instructions: string | null;
  questions: Array<{
    idx: number;
    question_text: string;
    question_type: string;
    type_label: string;
    marks: number;
    option_a: string | null;
    option_b: string | null;
    option_c: string | null;
    option_d: string | null;
    correct_answer: string;
    explanation: string | null;
  }>;
}

export function useQuiz(quiz: Opt<string>) {
  return useQuery<QuizDetail>({
    queryKey: ["quiz", quiz],
    queryFn: () => apiGet<QuizDetail>("quizzes.get_quiz", { quiz: quiz! }),
    enabled: Boolean(quiz),
  });
}

export function useSaveQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string; questions: number; total_marks: number }>(
        "quizzes.save_quiz",
        { payload },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      qc.invalidateQueries({ queryKey: ["quiz"] });
    },
  });
}

export function useDeleteQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quiz: string) => apiPost<{ id: string }>("quizzes.delete_quiz", { quiz }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quizzes"] }),
  });
}

/** The paper a student sits — never carries the correct answers. */
export interface QuizPaper {
  attempt: string;
  quiz: string;
  title: string;
  instructions: string | null;
  time_limit: number;
  total_marks: number;
  started_on: string;
  attempt_number: number;
  questions: Array<{
    idx: number;
    question_text: string;
    question_type: string;
    type_label: string;
    marks: number;
    options: Array<{ key: string; text: string }>;
  }>;
}

export function useStartAttempt() {
  return useMutation({
    mutationFn: (quiz: string) => apiPost<QuizPaper>("quizzes.start_attempt", { quiz }),
  });
}

export interface AttemptResult {
  attempt: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  needs_review: boolean;
  correct: number;
  questions: number;
  answers_revealed: boolean;
  answers: Array<{
    idx: number;
    question: string;
    given: string;
    correct_answer: string;
    is_correct: boolean;
    marks: number;
    possible: number;
  }>;
}

export function useSubmitAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { attempt: string; answers: Array<{ idx: number; answer: string }> }) =>
      apiPost<AttemptResult>("quizzes.submit_attempt", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quizzes"] }),
  });
}

export function useQuizResults(quiz: Opt<string>) {
  return useQuery<{
    quiz: {
      id: string;
      title: string;
      course: string;
      student_group: string;
      total_marks: number;
      pass_mark: number;
      status: string;
    };
    summary: {
      roster: number;
      sat: number;
      not_sat: number;
      average: number | null;
      passed: number;
      needs_review: number;
    };
    attempts: Array<{
      id: string;
      student: string;
      student_name: string;
      attempt: number;
      status: string;
      status_label: string;
      score: number;
      total: number;
      percentage: number;
      passed: boolean;
      needs_review: boolean;
      submitted_on: string;
      minutes: number;
    }>;
    not_sat: Array<{ student: string; student_name: string }>;
    questions: Array<{ idx: number; text: string; correct: number; total: number; percent: number }>;
  }>({
    queryKey: ["quiz-results", quiz],
    queryFn: () => apiGet("quizzes.quiz_results", { quiz: quiz! }),
    enabled: Boolean(quiz),
  });
}

export function useReviewAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { attempt: string; marks: Array<{ idx: number; marks_awarded: number }> }) =>
      apiPost<{ attempt: string; score: number; percentage: number; passed: boolean }>(
        "quizzes.review_attempt",
        vars,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz-results"] }),
  });
}

// --- Alert rules and student alerts -----------------------------------------

export interface AlertRuleRow {
  id: string;
  name: string;
  trigger: string;
  trigger_label: string;
  group: string;
  unit: string;
  enabled: boolean;
  severity: string;
  severity_label: string;
  operator: string;
  threshold: number;
  within_days: number;
  applies_to: string;
  program: string | null;
  student_group: string | null;
  title: string;
  message: string;
  emoji: string;
  last_run: string;
  last_matched: number;
  open_alerts: number;
}

export function useAlertRules(enabled = true) {
  return useQuery<AlertRuleRow[]>({
    queryKey: ["alert-rules"],
    queryFn: () => apiGet<AlertRuleRow[]>("alerts.list_rules"),
    enabled,
  });
}

export interface AlertRuleDetail extends Omit<AlertRuleRow, "open_alerts" | "last_run" | "last_matched" | "trigger_label" | "group" | "unit" | "severity_label"> {
  notes: string | null;
  actions: Array<{
    action_type: string;
    action_label: string;
    notify_roles: string;
    escalate_after_days: number;
    block_pages: string | null;
  }>;
}

export function useAlertRule(rule: string | null | undefined) {
  return useQuery<AlertRuleDetail>({
    queryKey: ["alert-rule", rule],
    queryFn: () => apiGet<AlertRuleDetail>("alerts.get_rule", { rule: rule! }),
    enabled: Boolean(rule),
  });
}

export function useRuleOptions(enabled = true) {
  return useQuery<{
    triggers: Array<{ code: string; label: string; unit: string; group: string }>;
    severities: Array<{ code: string; label: string; emoji: string }>;
    levels: Array<{ code: string; label: string }>;
    pages: Array<{ path: string; label: string }>;
    operators: Array<{ code: string; label: string }>;
    programs: string[];
    groups: Array<{ id: string; name: string }>;
  }>({
    queryKey: ["rule-options"],
    queryFn: () => apiGet("alerts.rule_options"),
    enabled,
  });
}

export function useSaveAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; name: string }>("alerts.save_rule", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-rules"] });
      qc.invalidateQueries({ queryKey: ["alert-rule"] });
    },
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rule: string) => apiPost<{ id: string }>("alerts.delete_rule", { rule }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-rules"] }),
  });
}

/** How many students a rule would match, before it is saved. */
export function usePreviewRule() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{
        scope: number;
        measured: number;
        matched: number;
        unit: string;
        sample: Array<{ student: string; name: string; value: number }>;
      }>("alerts.preview_rule", { payload }),
  });
}

export function useRunRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rule?: string) =>
      apiPost<{ matched: number; raised: number; resolved: number; escalated: number }>(
        "alerts.run_rules",
        rule ? { rule } : {},
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export interface StudentAlert {
  id: string;
  student: string;
  student_name: string;
  rule: string | null;
  rule_name: string | null;
  trigger: string;
  trigger_label: string;
  status: string;
  status_label: string;
  severity: string;
  severity_label: string;
  severity_rank: number;
  level: string;
  level_label: string;
  measured: number;
  threshold: number;
  unit: string;
  title: string;
  message: string;
  emoji: string;
  raised_on: string;
  escalated_on: string;
  resolved_on: string;
  acknowledged: boolean;
  blocks_access: boolean;
}

export function useAlerts(
  params: Opt<{ student: string; status: string; severity: string; page: number; page_size: number }> = {},
) {
  return useQuery<Paginated<StudentAlert>>({
    queryKey: ["student-alerts", params],
    queryFn: () => apiGet<Paginated<StudentAlert>>("alerts.list_alerts", params),
    placeholderData: (prev) => prev,
  });
}

export function useAlertsOverview(enabled = true) {
  return useQuery<{
    summary: {
      open: number;
      blocked: number;
      unacknowledged: number;
      critical: number;
      students: number;
    };
    by_severity: Array<{ severity: string; label: string; count: number; emoji: string }>;
    by_trigger: Array<{ trigger: string; count: number }>;
    alerts: StudentAlert[];
  }>({
    queryKey: ["alerts-overview"],
    queryFn: () => apiGet("alerts.alerts_overview"),
    enabled,
  });
}

export function useStudentAlertFile(student: Opt<string>) {
  return useQuery<{
    student: string;
    student_name: string;
    summary: {
      total: number;
      open: number;
      warnings: number;
      blocked: boolean;
      worst: number;
      unacknowledged: number;
    };
    alerts: StudentAlert[];
    blocked_pages: string[];
  }>({
    queryKey: ["student-alert-file", student ?? null],
    queryFn: () => apiGet("alerts.student_file", student ? { student } : {}),
  });
}

/** Which pages the viewer is blocked from, and why. */
export function useMyBlocks() {
  return useQuery<{
    blocked: string[];
    reasons: Array<{
      alert: string;
      student_name: string;
      title: string;
      message: string;
      emoji: string;
      severity: string;
      pages: string[];
    }>;
  }>({
    queryKey: ["my-blocks"],
    queryFn: () => apiGet("alerts.my_blocks"),
    staleTime: 60_000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alert: string) =>
      apiPost<{ id: string; status: string }>("alerts.acknowledge_alert", { alert }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-alerts"] });
      qc.invalidateQueries({ queryKey: ["student-alert-file"] });
      qc.invalidateQueries({ queryKey: ["my-blocks"] });
    },
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { alert: string; notes?: string; dismiss?: boolean }) =>
      apiPost<{ id: string; status: string }>("alerts.resolve_alert", {
        alert: vars.alert,
        ...(vars.notes ? { notes: vars.notes } : {}),
        ...(vars.dismiss ? { dismiss: 1 } : {}),
      }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- Subject resources ------------------------------------------------------

export interface ResourceItem {
  id: string;
  title: string;
  course: string;
  student_group: string | null;
  type: string;
  type_label: string;
  icon: string;
  status: string;
  description: string | null;
  url: string | null;
  instructor: string | null;
  topic: string | null;
  published_on: string;
  views: number;
  files: SubmissionFile[];
}

export function useResources(
  params: Opt<{ course: string; resource_type: string; search: string }> = {},
) {
  return useQuery<{
    subjects: Array<{ course: string; count: number; items: ResourceItem[] }>;
    total: number;
    types: Array<{ code: string; label: string; icon: string }>;
  }>({
    queryKey: ["resources", params],
    queryFn: () => apiGet("resources_hub.list_resources", params),
    placeholderData: (prev) => prev,
  });
}

export function useResourceOptions(enabled = true) {
  return useQuery<{
    courses: string[];
    types: Array<{ code: string; label: string; icon: string }>;
    groups: Array<{ id: string; name: string }>;
  }>({
    queryKey: ["resource-options"],
    queryFn: () => apiGet("resources_hub.resource_options"),
    enabled,
  });
}

export function useSaveResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string }>("resources_hub.save_resource", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources"] }),
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resource: string) =>
      apiPost<{ id: string }>("resources_hub.delete_resource", { resource }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources"] }),
  });
}

export function useOpenResource() {
  return useMutation({
    mutationFn: (resource: string) =>
      apiPost<{ id: string }>("resources_hub.open_resource", { resource }),
  });
}

// --- Surveys ----------------------------------------------------------------

export interface SurveyRow {
  id: string;
  title: string;
  audience: string;
  audience_label: string;
  status: string;
  status_label: string;
  anonymous: boolean;
  opens_on: string;
  closes_on: string;
  intro: string | null;
  responses: number;
  answered: boolean;
  open: boolean;
}

export function useSurveys(status?: Opt<string>) {
  return useQuery<SurveyRow[]>({
    queryKey: ["surveys", status ?? null],
    queryFn: () => apiGet<SurveyRow[]>("surveys.list_surveys", status ? { status } : {}),
  });
}

export interface SurveyDetail {
  id: string;
  title: string;
  audience_label: string;
  anonymous: boolean;
  intro: string | null;
  closes_on: string;
  questions: Array<{
    idx: number;
    question_text: string;
    question_type: string;
    type_label: string;
    required: boolean;
    options: string[];
    scale_max: number;
  }>;
}

export function useSurvey(survey: Opt<string>) {
  return useQuery<SurveyDetail>({
    queryKey: ["survey", survey],
    queryFn: () => apiGet<SurveyDetail>("surveys.get_survey", { survey: survey! }),
    enabled: Boolean(survey),
  });
}

export function useSaveSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string; questions: number }>("surveys.save_survey", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surveys"] }),
  });
}

export function useDeleteSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (survey: string) => apiPost<{ id: string }>("surveys.delete_survey", { survey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surveys"] }),
  });
}

export function useSubmitSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { survey: string; answers: Array<{ idx: number; answer: string }> }) =>
      apiPost<{ id: string }>("surveys.submit_response", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surveys"] }),
  });
}

export function useSurveyResults(survey: Opt<string>) {
  return useQuery<{
    survey: { id: string; title: string; audience_label?: string; anonymous: boolean; status?: string };
    summary: { responses: number; by_role: Array<{ role: string; count: number }> };
    questions: Array<{
      idx: number;
      question: string;
      type: string;
      type_label: string;
      answered: number;
      average?: number | null;
      scale_max?: number;
      distribution?: Array<{ value: number; count: number }>;
      options?: Array<{ option: string; count: number; percent: number }>;
      responses?: string[];
    }>;
  }>({
    queryKey: ["survey-results", survey],
    queryFn: () => apiGet("surveys.survey_results", { survey: survey! }),
    enabled: Boolean(survey),
  });
}

/* ------------------------------------------------------------ admissions */

export interface ApplicantRow {
  id: string;
  name: string;
  idNumber: string | null;
  status: "Applied" | "Approved" | "Rejected" | "Admitted";
  statusLabel: string;
  statusTone: string;
  appliedOn: string;
  program: string | null;
  academicYear: string | null;
  academicTerm: string | null;
  email: string | null;
  mobile: string | null;
  birthDate: string;
  gender: string | null;
  nationality: string | null;
  image: string | null;
}

export interface Credentials {
  user: string;
  username: string;
  /** Readable only in the response that created the account. */
  password: string | null;
  name: string | null;
  guardian?: string;
  isNew?: boolean;
}

export interface Sibling {
  name: string | null;
  birthDate: string;
  gender: string | null;
  sameSchool: boolean;
}

export interface ApplicantDetail extends ApplicantRow {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  bloodGroup: string | null;
  studentCategory: string | null;
  studentAdmission: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  city: string | null;
  guardians: Array<{
    guardian: string;
    name: string | null;
    relation: string | null;
    relationLabel: string | null;
  }>;
  siblings: Sibling[];
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  student: string | null;
  credentials: Credentials | null;
  allowedMoves: string[];
}

export interface ApplicantList {
  items: ApplicantRow[];
  total: number;
  page: number;
  page_size: number;
  counts: Record<string, number>;
}

export function useApplicants(params: {
  search?: string;
  status?: string;
  program?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery<ApplicantList>({
    queryKey: ["applicants", params],
    queryFn: () =>
      apiGet<ApplicantList>("admissions.list_applicants", {
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.program ? { program: params.program } : {}),
        page: String(params.page ?? 1),
        page_size: String(params.page_size ?? 20),
      }),
    placeholderData: (prev) => prev,
  });
}

export function useApplicant(applicant: string | null | undefined) {
  return useQuery<ApplicantDetail>({
    queryKey: ["applicant", applicant],
    queryFn: () => apiGet<ApplicantDetail>("admissions.get_applicant", { applicant: applicant! }),
    enabled: Boolean(applicant),
  });
}

export interface AdmissionOptions {
  programs: string[];
  academicYears: string[];
  academicTerms: Array<{ name: string; academic_year: string }>;
  genders: string[];
  studentCategories: string[];
  studentAdmissions: string[];
  countries: string[];
  bloodGroups: string[];
  relations: Array<{ value: string; label: string }>;
  guardians: Array<{ name: string; guardian_name: string }>;
  defaultAcademicYear: string | null;
  statuses: Array<{ value: string; label: string; tone: string }>;
}

export function useAdmissionOptions() {
  return useQuery<AdmissionOptions>({
    queryKey: ["admission-options"],
    queryFn: () => apiGet<AdmissionOptions>("admissions.form_options"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; status: string }>("admissions.save_applicant", { payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applicants"] });
      void qc.invalidateQueries({ queryKey: ["applicant"] });
    },
  });
}

export function useTransitionApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { applicant: string; to_status: string; reason?: string }) =>
      apiPost<{ id: string; status: string; statusLabel: string }>(
        "admissions.transition",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applicants"] });
      void qc.invalidateQueries({ queryKey: ["applicant"] });
    },
  });
}

export interface AdmitResult {
  student: string;
  studentName: string;
  status: string;
  credentials: Credentials;
  guardians: Credentials[];
}

export function useAdmitApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (applicant: string) => apiPost<AdmitResult>("admissions.admit", { applicant }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applicants"] });
      void qc.invalidateQueries({ queryKey: ["applicant"] });
      void qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useDeleteApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (applicant: string) =>
      apiPost<{ id: string }>("admissions.delete_applicant", { applicant }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applicants"] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (user: string) => apiPost<Credentials>("credentials.reset_password", { user }),
  });
}

/** Print formats the ERPNext desk offers for a doctype. */
export function usePrintFormats(doctype: string) {
  return useQuery<{ formats: string[]; default: string; letterheads: string[] }>({
    queryKey: ["print-formats", doctype],
    queryFn: () =>
      apiGet<{ formats: string[]; default: string; letterheads: string[] }>(
        "registration_print.print_formats",
        { doctype },
      ),
    staleTime: 5 * 60 * 1000,
  });
}

/* --------------------------------------------------------------- billing */

export interface FeeStructureOption {
  id: string;
  program: string | null;
  academicYear: string | null;
  academicTerm: string | null;
  total: number;
  /** Matches the student's own programme and year. */
  suggested: boolean;
}

export function useStructureOptions(student: string | null | undefined) {
  return useQuery<{
    structures: FeeStructureOption[];
    studentProgram: string | null;
    studentAcademicYear: string | null;
    companies: string[];
    defaultCompany: string | null;
  }>({
    queryKey: ["structure-options", student],
    queryFn: () =>
      apiGet("billing.structure_options", student ? { student } : {}),
    enabled: Boolean(student),
  });
}

export interface StructurePreview {
  id: string;
  program: string | null;
  academicYear: string | null;
  total: number;
  components: Array<{
    category: string;
    item: string | null;
    description: string | null;
    amount: number;
  }>;
}

export function useStructurePreview(feeStructure: string | null | undefined) {
  return useQuery<StructurePreview>({
    queryKey: ["structure-preview", feeStructure],
    queryFn: () =>
      apiGet<StructurePreview>("billing.structure_preview", {
        fee_structure: feeStructure!,
      }),
    enabled: Boolean(feeStructure),
  });
}

export function useInvoiceStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student: string;
      fee_structure?: string;
      posting_date?: string;
      due_date?: string;
      submit?: number;
    }) =>
      apiPost<{
        id: string;
        student: string;
        customer: string;
        total: number;
        outstanding: number;
        status: string;
      }>("billing.invoice_student", vars as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fees"] });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

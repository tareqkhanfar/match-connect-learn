/** Types mirroring the Match K12 backend payloads. */

export type Role = "admin" | "secretary" | "teacher" | "student" | "parent";
export type PaymentStatus = "paid" | "partial" | "late";

export interface SessionScope {
  student: string | null;
  instructor: string | null;
  guardian: string | null;
  students: string[];
}

export interface Session {
  user: string;
  email: string;
  role: Role;
  name: string;
  image: string | null;
  language: string;
  scope: SessionScope;
  context: {
    academic_year: string | null;
    academic_term: string | null;
  };
}

export interface StudentRow {
  id: string;
  name: string;
  gender: string;
  image: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string;
  address: string;
  enrolled: string;
  grade: string | null;
  section: string | null;
  guardian: string | null;
  guardianPhone: string | null;
  attendanceRate: number;
  average: number;
  feeTotal: number;
  feePaid: number;
  status: PaymentStatus;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface StudentProfile {
  profile: {
    id: string;
    name: string;
    gender: string;
    image: string | null;
    birthDate: string;
    email: string | null;
    phone: string | null;
    enrolled: string;
    address: string;
    city: string | null;
    nationality: string | null;
    blood_group: string | null;
    active: boolean;
    grade: string | null;
    section: string | null;
    academic_year: string | null;
  };
  guardians: Array<{
    id: string;
    name: string;
    relation: string | null;
    phone: string | null;
    email: string | null;
    occupation: string | null;
  }>;
  academics: GradeRow[];
  attendance: {
    present: number;
    absent: number;
    leave: number;
    total: number;
    rate: number;
    recent: Array<{ id: string; date: string; status: string; group: string }>;
  };
  fees: {
    total: number;
    paid: number;
    outstanding: number;
    status: PaymentStatus;
    invoices: FeeRow[];
  };
  groups: Array<{
    name: string;
    student_group_name: string;
    program: string | null;
    batch: string | null;
    course: string | null;
    academic_year: string | null;
  }>;
}

export interface GradeRow {
  id: string;
  subject: string;
  score: number;
  max: number;
  percentage: number;
  grade: string | null;
  term: string | null;
  year?: string | null;
  student?: string;
  student_name?: string;
  exam?: string;
  student_group?: string;
}

export interface DashboardKpi {
  students: number;
  teachers: number;
  classes: number;
  attendance_today: number;
}

export interface AdminDashboard {
  kpi: DashboardKpi;
  attendance_trend: Array<{ month: string; present: number; absent: number }>;
  grade_distribution: Array<{ grade: string; students: number }>;
  performance: Array<{ subject: string; average: number }>;
  gender_split: Array<{ name: string; value: number }>;
  fee_collection: Array<{ month: string; collected: number; expected: number }>;
  announcements: AnnouncementRow[];
  academic_year: string | null;
}

export interface TeacherDashboard {
  instructor: string | null;
  kpi: {
    classes: number;
    students: number;
    attendance_today: number;
    pending_grading: number;
  };
  groups: ClassRow[];
  today_schedule: ScheduleSlot[];
  assignments: AssignmentRow[];
  announcements: AnnouncementRow[];
}

export interface StudentDashboard {
  student: StudentBrief | null;
  kpi?: {
    attendance_rate: number;
    average: number;
    pending_assignments: number;
    outstanding_fees: number;
  };
  today_schedule?: ScheduleSlot[];
  assignments?: AssignmentRow[];
  grades?: GradeRow[];
  announcements?: AnnouncementRow[];
}

export interface ParentDashboard {
  guardian: string | null;
  children: Array<{
    student: StudentBrief;
    attendance_rate: number;
    average: number;
    pending_assignments: number;
    outstanding_fees: number;
    grades: GradeRow[];
  }>;
  announcements: AnnouncementRow[];
}

export interface StudentBrief {
  id: string;
  name: string;
  image: string | null;
  email: string | null;
  program: string | null;
  batch: string | null;
  academic_year: string | null;
}

/** Everything about one child — the parent's focused view. */
export interface ChildOverview {
  student: StudentBrief;
  kpi: {
    attendance_rate: number;
    average: number;
    pending_assignments: number;
    outstanding_fees: number;
  };
  grade: { grade: string; label: string; emoji: string; percentage: number } | null;
  subjects: Array<{
    course: string;
    percentage: number;
    bonus: number;
    final: number;
    covered: number;
    grade: string;
    label: string;
    emoji: string;
    components: Array<{
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
      grade: string;
      label: string;
      emoji: string;
    }>;
  }>;
  today_schedule: Array<{
    id: string;
    course: string;
    teacher: string | null;
    room: string | null;
    from_time: string;
    to_time: string;
    title: string;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    subject: string;
    due: string;
    max: number;
    submitted: boolean;
    submission_status: string;
    score: number | null;
  }>;
  attendance: { present: number; absent: number; leave: number; total: number; rate: number };
  behaviour: { positive: number; negative: number; net_points: number };
  fees: { total: number; paid: number; outstanding: number; status: string };
  announcements: AnnouncementRow[];
}

export interface ClassRow {
  name: string;
  student_group_name: string;
  program: string | null;
  batch: string | null;
  course: string | null;
  academic_year: string | null;
  academic_term?: string | null;
  students: number;
  capacity?: number;
  homeroom?: string | null;
  instructors?: Array<{ id: string; name: string }>;
  subjects?: string[];
}

export interface SubjectRow {
  id: string;
  name: string;
  name_ar: string;
  course_name: string;
  code: string;
  department: string | null;
  grades: string[];
  teacher: string | null;
}

export interface TeacherRow {
  id: string;
  name: string;
  name_ar: string;
  instructor_name: string;
  gender: string | null;
  image: string | null;
  status: string | null;
  department: string | null;
  classes: string[];
  classes_count: number;
  phone: string | null;
  email: string | null;
  joined?: string;
}

export interface ScheduleSlot {
  id: string;
  date?: string;
  from_time: string;
  to_time: string;
  subject: string;
  teacher?: string | null;
  course?: string;
  student_group?: string;
  room: string | null;
  title: string | null;
  color?: string | null;
}

export interface Timetable {
  week_start: string;
  week_end?: string;
  days: Record<string, ScheduleSlot[]>;
}

export interface ExamRow {
  id: string;
  title: string;
  subject: string;
  grade: string | null;
  student_group: string | null;
  date: string;
  time: string;
  to_time: string;
  room: string | null;
  max: number;
  type: string | null;
  term: string | null;
  year: string | null;
  submitted: boolean;
}

export interface AssignmentRow {
  id: string;
  title: string;
  subject: string;
  grade: string | null;
  student_group?: string;
  due: string;
  assigned_on?: string;
  max?: number;
  submitted: number | boolean;
  total?: number;
  status: string;
  status_raw?: string;
  instructor?: string | null;
  description?: string | null;
  submission_status?: string;
  score?: number | null;
  my_submission?: {
    id: string;
    status: string;
    status_raw: string;
    score: number | null;
    submitted_on: string;
    feedback: string | null;
  } | null;
}

export interface AttendanceSheet {
  student_group: string;
  date: string;
  students: Array<{
    student: string;
    student_name: string;
    roll_number: number | null;
    status: string | null;
    status_label: string | null;
    attendance_id: string | null;
    submitted: boolean;
  }>;
  marked: number;
  total: number;
}

export interface AttendanceReport {
  summary: {
    present: number;
    absent: number;
    leave: number;
    total: number;
    rate: number;
  };
  rows: Array<{
    date: string;
    total: number;
    present: number;
    absent: number;
    rate: number;
  }>;
  chronic_absentees: Array<{
    student: string;
    student_name: string;
    rate: number;
    absent: number;
    total: number;
  }>;
}

export interface FeeRow {
  id: string;
  student?: string;
  student_name?: string;
  grade?: string | null;
  date: string;
  due_date: string;
  total: number;
  paid: number;
  outstanding: number;
  status: PaymentStatus;
  status_label?: string;
  term: string | null;
  year?: string | null;
  currency?: string | null;
  program?: string | null;
}

export interface FeeList extends Paginated<FeeRow> {
  summary: {
    total: number;
    collected: number;
    outstanding: number;
    collection_rate: number;
  };
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  date: string;
  expires_on?: string;
  type: string;
  type_raw?: string;
  audience: string;
}

export interface MessageRow {
  id: string;
  thread: string;
  subject: string | null;
  preview: string;
  from: string;
  from_user: string;
  role: string;
  time: string;
  unread: boolean;
  unread_count: number;
  outgoing: boolean;
  about_student: string | null;
}

export interface MessageThread {
  thread: string;
  messages: Array<{
    id: string;
    subject: string | null;
    body: string;
    sender: string;
    sender_name: string;
    recipient: string;
    sent_on: string;
    outgoing: boolean;
    attachment: string | null;
    about_student: string | null;
  }>;
}

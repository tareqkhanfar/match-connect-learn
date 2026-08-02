export type Role = "admin" | "teacher" | "student" | "parent";

const at = <T>(a: readonly T[], i: number): T => a[((i % a.length) + a.length) % a.length]!;

export const roleLabels: Record<Role, string> = {
  admin: "مدير المدرسة",
  teacher: "معلم",
  student: "طالب",
  parent: "ولي أمر",
};

export type PaymentStatus = "paid" | "partial" | "late";

export interface Student {
  id: string;
  name: string;
  gender: "ذكر" | "أنثى";
  grade: string;
  section: string;
  guardian: string;
  guardianPhone: string;
  birthDate: string;
  address: string;
  attendanceRate: number;
  average: number;
  feeTotal: number;
  feePaid: number;
  status: PaymentStatus;
  enrolled: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  classes: string[];
  phone: string;
  email: string;
  experience: number;
  qualification: string;
  status: "دوام كامل" | "دوام جزئي";
}

export interface SchoolClass {
  id: string;
  grade: string;
  section: string;
  students: number;
  capacity: number;
  homeroom: string;
  room: string;
  subjects: string[];
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  grades: string[];
  teacher: string;
  weeklyHours: number;
  color: string;
}

const firstNamesM = [
  "أحمد",
  "محمد",
  "يوسف",
  "عمر",
  "خالد",
  "زيد",
  "كريم",
  "مالك",
  "بشار",
  "سامي",
  "أنس",
  "حمزة",
];
const firstNamesF = [
  "مريم",
  "فاطمة",
  "ليان",
  "سلمى",
  "نور",
  "رزان",
  "هبة",
  "دانا",
  "جنى",
  "لينا",
  "آية",
  "سارة",
];
const families = [
  "العبد الله",
  "أبو راس",
  "الخطيب",
  "حمدان",
  "المصري",
  "درويش",
  "الحلبي",
  "السعدي",
  "قاسم",
  "النجار",
  "شاهين",
  "زيدان",
];

export const grades = [
  "الصف الأول",
  "الصف الثاني",
  "الصف الثالث",
  "الصف الرابع",
  "الصف الخامس",
  "الصف السادس",
  "الصف السابع",
  "الصف الثامن",
  "الصف التاسع",
  "الصف العاشر",
  "الصف الحادي عشر",
  "الصف الثاني عشر",
];
export const sections = ["أ", "ب", "ج"];

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export const students: Student[] = Array.from({ length: 72 }, (_, i) => {
  const male = rand(i + 1) > 0.5;
  const first = male ? at(firstNamesM, i) : at(firstNamesF, i);
  const family = at(families, i * 5);
  const grade = at(grades, i);
  const section = at(sections, i);
  const total = 1200 + Math.round(rand(i + 9) * 4) * 250;
  const r = rand(i + 21);
  const paid = r > 0.62 ? total : r > 0.3 ? Math.round(total * 0.5) : Math.round(total * 0.15);
  return {
    id: `STD-${1000 + i}`,
    name: `${first} ${family}`,
    gender: male ? "ذكر" : "أنثى",
    grade,
    section,
    guardian: `${at(firstNamesM, i * 3)} ${family}`,
    guardianPhone: `059${(1000000 + Math.round(rand(i + 3) * 8999999)).toString().slice(0, 7)}`,
    birthDate: `${2007 + (i % 11)}-0${(i % 9) + 1}-1${i % 9}`,
    address: at(["رام الله", "نابلس", "الخليل", "غزة", "بيت لحم", "جنين"], i),
    attendanceRate: 72 + Math.round(rand(i + 5) * 27),
    average: 58 + Math.round(rand(i + 7) * 41),
    feeTotal: total,
    feePaid: paid,
    status: paid >= total ? "paid" : paid > total * 0.3 ? "partial" : "late",
    enrolled: `${2019 + (i % 6)}-09-01`,
  };
});

export const subjectNames = [
  "الرياضيات",
  "اللغة العربية",
  "اللغة الإنجليزية",
  "العلوم",
  "الفيزياء",
  "الكيمياء",
  "الأحياء",
  "التربية الإسلامية",
  "الاجتماعيات",
  "الحاسوب",
  "الرياضة",
  "الفنون",
];

const subjectColors = ["primary", "accent", "warm", "info", "success", "destructive"] as const;

export const subjects: Subject[] = subjectNames.map((name, i) => ({
  id: `SUB-${100 + i}`,
  name,
  code: `${at(["MTH", "ARB", "ENG", "SCI", "PHY", "CHM", "BIO", "ISL", "SOC", "CMP", "SPT", "ART"], i)}-${100 + i}`,
  grades: grades.slice(i % 4, (i % 4) + 4),
  teacher: "",
  weeklyHours: 2 + (i % 4),
  color: at(subjectColors, i),
}));

export const teachers: Teacher[] = Array.from({ length: 24 }, (_, i) => {
  const male = i % 2 === 0;
  const first = male ? at(firstNamesM, i * 2) : at(firstNamesF, i * 2);
  const family = at(families, i * 7);
  return {
    id: `TCH-${200 + i}`,
    name: `${male ? "أ." : "أ."} ${first} ${family}`,
    subject: at(subjectNames, i),
    classes: [
      `${at(grades, i)} - ${at(sections, i)}`,
      `${at(grades, i + 3)} - ${at(sections, i + 1)}`,
    ],
    phone: `056${(1000000 + Math.round(rand(i + 31) * 8999999)).toString().slice(0, 7)}`,
    email: `teacher${i + 1}@match-edu.ps`,
    experience: 2 + (i % 18),
    qualification: at(
      ["بكالوريوس تربية", "ماجستير مناهج", "بكالوريوس علوم", "ماجستير إدارة تربوية"],
      i,
    ),
    status: i % 7 === 0 ? "دوام جزئي" : "دوام كامل",
  };
});

subjects.forEach((s, i) => {
  s.teacher = at(teachers, i).name;
});

export const classes: SchoolClass[] = grades.flatMap((grade, gi) =>
  sections.slice(0, gi % 3 === 0 ? 3 : 2).map((section, si) => ({
    id: `CLS-${gi}${si}`,
    grade,
    section,
    students: 18 + Math.round(rand(gi * 3 + si) * 14),
    capacity: 35,
    homeroom: at(teachers, gi * 3 + si).name,
    room: `${101 + gi * 3 + si}`,
    subjects: subjectNames.slice(0, 7),
  })),
);

export const attendanceTrend = [
  { month: "أيلول", present: 95, absent: 5 },
  { month: "تشرين ١", present: 93, absent: 7 },
  { month: "تشرين ٢", present: 90, absent: 10 },
  { month: "كانون ١", present: 88, absent: 12 },
  { month: "كانون ٢", present: 92, absent: 8 },
  { month: "شباط", present: 94, absent: 6 },
  { month: "آذار", present: 91, absent: 9 },
  { month: "نيسان", present: 96, absent: 4 },
];

export const gradeDistribution = grades.slice(0, 8).map((g, i) => ({
  grade: g.replace("الصف ", ""),
  students: 38 + Math.round(rand(i + 41) * 34),
}));

export const performanceData = subjectNames.slice(0, 6).map((s, i) => ({
  subject: s,
  average: 68 + Math.round(rand(i + 51) * 26),
}));

export interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  audience: string;
  type: "حدث" | "إعلان" | "تنبيه";
}

export const announcements: Announcement[] = [
  {
    id: "AN-1",
    title: "الاجتماع الفصلي لأولياء الأمور",
    body: "يُعقد اجتماع أولياء الأمور لمناقشة نتائج الفصل الأول في قاعة المدرسة الكبرى.",
    date: "2026-08-06",
    audience: "أولياء الأمور",
    type: "حدث",
  },
  {
    id: "AN-2",
    title: "بدء امتحانات الفصل الثاني",
    body: "تبدأ امتحانات الفصل الثاني للصفوف من السابع حتى الثاني عشر وفق الجدول المعلن.",
    date: "2026-08-10",
    audience: "الطلاب والمعلمون",
    type: "إعلان",
  },
  {
    id: "AN-3",
    title: "رحلة علمية إلى متحف العلوم",
    body: "رحلة لطلاب الصفوف الخامس والسادس، الرجاء تسليم موافقة ولي الأمر.",
    date: "2026-08-14",
    audience: "الصف الخامس والسادس",
    type: "حدث",
  },
  {
    id: "AN-4",
    title: "تذكير بسداد الرسوم المتأخرة",
    body: "نرجو من أولياء الأمور المتأخرين سداد الأقساط قبل نهاية الشهر.",
    date: "2026-08-03",
    audience: "أولياء الأمور",
    type: "تنبيه",
  },
  {
    id: "AN-5",
    title: "يوم رياضي مفتوح",
    body: "منافسات رياضية بين الشُعب في ملعب المدرسة مع جوائز للفرق الفائزة.",
    date: "2026-08-20",
    audience: "جميع الطلاب",
    type: "حدث",
  },
];

export const periods = [
  "الحصة ١",
  "الحصة ٢",
  "الحصة ٣",
  "الحصة ٤",
  "الحصة ٥",
  "الحصة ٦",
  "الحصة ٧",
];
export const weekDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

export interface Slot {
  subject: string;
  teacher: string;
  color: string;
}

export const timetable: Record<string, Slot[]> = weekDays.reduce(
  (acc, day, di) => {
    acc[day] = periods.map((_, pi) => {
      const idx = (di * 3 + pi * 2) % subjects.length;
      const s = at(subjects, idx);
      return { subject: s.name, teacher: s.teacher, color: s.color };
    });
    return acc;
  },
  {} as Record<string, Slot[]>,
);

export interface Exam {
  id: string;
  subject: string;
  grade: string;
  date: string;
  time: string;
  duration: string;
  room: string;
  max: number;
  type: "نصفي" | "نهائي" | "قصير";
}

export const exams: Exam[] = subjectNames.slice(0, 9).map((s, i) => ({
  id: `EXM-${300 + i}`,
  subject: s,
  grade: at(grades, i + 6),
  date: `2026-08-${10 + i}`,
  time: `0${8 + (i % 4)}:30`,
  duration: `${60 + (i % 3) * 30} دقيقة`,
  room: `${201 + i}`,
  max: 100,
  type: at(["نصفي", "نهائي", "قصير"] as const, i),
}));

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  grade: string;
  due: string;
  submitted: number;
  total: number;
  status: "مفتوح" | "مغلق" | "قيد التصحيح";
}

export const assignments: Assignment[] = [
  {
    id: "ASG-1",
    title: "حل تمارين الوحدة الرابعة",
    subject: "الرياضيات",
    grade: "الصف التاسع",
    due: "2026-08-05",
    submitted: 22,
    total: 28,
    status: "مفتوح",
  },
  {
    id: "ASG-2",
    title: "تحليل قصيدة المتنبي",
    subject: "اللغة العربية",
    grade: "الصف العاشر",
    due: "2026-08-04",
    submitted: 25,
    total: 25,
    status: "قيد التصحيح",
  },
  {
    id: "ASG-3",
    title: "تقرير تجربة الكثافة",
    subject: "الفيزياء",
    grade: "الصف الحادي عشر",
    due: "2026-08-08",
    submitted: 12,
    total: 24,
    status: "مفتوح",
  },
  {
    id: "ASG-4",
    title: "Essay: My Future Career",
    subject: "اللغة الإنجليزية",
    grade: "الصف الثامن",
    due: "2026-07-29",
    submitted: 27,
    total: 27,
    status: "مغلق",
  },
  {
    id: "ASG-5",
    title: "بحث عن دورة الماء",
    subject: "العلوم",
    grade: "الصف السادس",
    due: "2026-08-11",
    submitted: 9,
    total: 26,
    status: "مفتوح",
  },
  {
    id: "ASG-6",
    title: "خريطة ذهنية للدولة الأموية",
    subject: "الاجتماعيات",
    grade: "الصف السابع",
    due: "2026-08-07",
    submitted: 18,
    total: 30,
    status: "مفتوح",
  },
];

export interface Message {
  id: string;
  from: string;
  role: string;
  preview: string;
  time: string;
  unread: boolean;
}

export const messages: Message[] = [
  {
    id: "M-1",
    from: "أ. سلمى الخطيب",
    role: "معلمة الرياضيات",
    preview: "أحمد يُبدي تحسناً واضحاً في حل المسائل هذا الأسبوع.",
    time: "قبل ١٠ د",
    unread: true,
  },
  {
    id: "M-2",
    from: "خالد حمدان",
    role: "ولي أمر",
    preview: "هل يمكن تحديد موعد لمناقشة نتائج الفصل الأول؟",
    time: "قبل ساعة",
    unread: true,
  },
  {
    id: "M-3",
    from: "إدارة المدرسة",
    role: "إدارة",
    preview: "تم تحديث جدول الحصص للصف التاسع بدءاً من الأحد.",
    time: "أمس",
    unread: false,
  },
  {
    id: "M-4",
    from: "أ. عمر المصري",
    role: "معلم العلوم",
    preview: "الرجاء متابعة تسليم تقرير التجربة قبل الخميس.",
    time: "قبل يومين",
    unread: false,
  },
];

export const feeCollection = [
  { month: "أيلول", collected: 182000, expected: 210000 },
  { month: "تشرين ١", collected: 168000, expected: 210000 },
  { month: "تشرين ٢", collected: 195000, expected: 210000 },
  { month: "كانون ١", collected: 143000, expected: 210000 },
  { month: "كانون ٢", collected: 201000, expected: 210000 },
  { month: "شباط", collected: 176000, expected: 210000 },
];

export const currentStudent = students[3]!;
export const childrenOfParent = [students[3]!, students[14]!];

export const kpi = {
  students: students.length * 9,
  teachers: teachers.length,
  classes: classes.length,
  attendanceToday: 94,
};

export function money(n: number) {
  return `${n.toLocaleString("en-US")} ₪`;
}

export const statusMeta: Record<PaymentStatus, { label: string; cls: string }> = {
  paid: { label: "مدفوع", cls: "bg-success-soft text-success border-success/30" },
  partial: { label: "جزئي", cls: "bg-warning-soft text-warm-foreground border-warning/40" },
  late: { label: "متأخر", cls: "bg-destructive-soft text-destructive border-destructive/30" },
};

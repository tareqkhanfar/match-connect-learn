import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarClock,
  ChevronLeft,
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  NotebookPen,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  KpiCard,
  PageHeader,
  Pill,
  ProgressBar,
  SectionCard,
} from "@/components/shared/ui-kit";
import { DashboardSkeleton, EmptyBlock, ErrorState } from "@/components/shared/states";
import { RichTextView } from "@/components/shared/rich-text";
import { useChildOverview, useDashboard } from "@/lib/api/hooks";
import type { ParentDashboard as ParentDashboardData } from "@/lib/api/types";
import { money } from "@/lib/roles";

/** Remembers which child the parent was last looking at. */
const SELECTED_KEY = "ms.parent.selectedChild";

export function ParentDashboard() {
  const { data, isLoading, error, refetch } = useDashboard();
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(SELECTED_KEY),
  );

  useEffect(() => {
    if (selected) localStorage.setItem(SELECTED_KEY, selected);
    else localStorage.removeItem(SELECTED_KEY);
  }, [selected]);

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const d = data as ParentDashboardData;
  const kids = d.children ?? [];
  const announcements = d.announcements ?? [];

  if (kids.length === 0) {
    return (
      <>
        <PageHeader
          title="متابعة الأبناء"
          subtitle="نظرة سريعة على مستوى أبنائك الأكاديمي وحضورهم ورسومهم"
        />
        <EmptyBlock
          title="لا يوجد أبناء مرتبطون بحسابك"
          description="يرجى التواصل مع إدارة المدرسة لربط حسابك بملفات أبنائك."
          icon={<Users className="size-6" />}
        />
      </>
    );
  }

  // A stale id (a child who left the school) must not strand the parent.
  const active = kids.find((k) => k.student.id === selected);
  if (selected && active) {
    return (
      <ChildFocus
        studentId={selected}
        kids={kids.map((k) => k.student)}
        onSelect={setSelected}
        onBack={() => setSelected(null)}
      />
    );
  }

  const due = kids.reduce((a, k) => a + (k.outstanding_fees ?? 0), 0);
  const avgAttendance = Math.round(
    kids.reduce((a, k) => a + (k.attendance_rate ?? 0), 0) / kids.length,
  );
  const avgScore = Math.round(kids.reduce((a, k) => a + (k.average ?? 0), 0) / kids.length);

  return (
    <>
      <PageHeader
        title="متابعة الأبناء"
        subtitle="اختر أحد أبنائك لعرض كل تفاصيله، أو تابع الإحصائيات العامة هنا"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="عدد الأبناء" value={kids.length} icon={Users} tone="primary" />
        <KpiCard
          label="متوسط الحضور"
          value={`${avgAttendance}%`}
          icon={ClipboardCheck}
          tone="accent"
        />
        <KpiCard label="متوسط المعدل" value={`${avgScore}%`} icon={Award} tone="info" />
        <KpiCard label="رسوم مستحقة" value={money(due)} icon={Wallet} tone="warm" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {kids.map((k) => (
          <SectionCard
            key={k.student.id}
            title={k.student.name}
            description={[k.student.program, k.student.batch ? `شعبة ${k.student.batch}` : null]
              .filter(Boolean)
              .join(" • ")}
            actions={
              <button
                onClick={() => setSelected(k.student.id)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                عرض كل التفاصيل
                <ChevronLeft className="size-3.5" />
              </button>
            }
          >
            <button
              onClick={() => setSelected(k.student.id)}
              className="w-full text-right"
              aria-label={`عرض تفاصيل ${k.student.name}`}
            >
              <div className="flex items-center gap-3">
                <Avatar name={k.student.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{k.student.name}</p>
                  <p className="num truncate text-xs text-muted-foreground">{k.student.id}</p>
                </div>
                <Pill tone={k.outstanding_fees > 0 ? "warning" : "success"}>
                  {k.outstanding_fees > 0 ? "رسوم متبقية" : "مدفوع"}
                </Pill>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">المعدل</p>
                  <p className="num mt-1 text-lg font-bold">{k.average}%</p>
                  <div className="mt-2">
                    <ProgressBar value={k.average} tone={k.average >= 75 ? "success" : "primary"} />
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">الحضور</p>
                  <p className="num mt-1 text-lg font-bold">{k.attendance_rate}%</p>
                  <div className="mt-2">
                    <ProgressBar
                      value={k.attendance_rate}
                      tone={
                        k.attendance_rate >= 85
                          ? "success"
                          : k.attendance_rate >= 70
                            ? "primary"
                            : "danger"
                      }
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">واجبات مستحقة</p>
                  <p className="num mt-1 flex items-center gap-2 text-lg font-bold">
                    <NotebookPen className="size-4 text-muted-foreground" />
                    {k.pending_assignments}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">رسوم متبقية</p>
                  <p className="num mt-1 text-lg font-bold">{money(k.outstanding_fees)}</p>
                </div>
              </div>
            </button>
          </SectionCard>
        ))}
      </div>

      {announcements.length > 0 && (
        <div className="mt-5">
          <SectionCard
            title="إعلانات المدرسة"
            description="آخر التحديثات"
            actions={<Megaphone className="size-4 text-muted-foreground" />}
          >
            <ul className="divide-y divide-border">
              {announcements.map((a) => (
                <li
                  key={a.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="num mt-1 text-[11px] text-muted-foreground">
                      {a.date} • {a.audience}
                    </p>
                  </div>
                  <Pill
                    tone={a.type === "تنبيه" ? "danger" : a.type === "حدث" ? "info" : "primary"}
                  >
                    {a.type}
                  </Pill>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </>
  );
}

/** Everything about one child, with a switcher across siblings. */
function ChildFocus({
  studentId,
  kids,
  onSelect,
  onBack,
}: {
  studentId: string;
  kids: Array<{ id: string; name: string }>;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const { data, isLoading, error, refetch } = useChildOverview(studentId);

  const switcher = (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
      >
        <LayoutDashboard className="size-3.5" />
        كل الأبناء
        <ArrowRight className="size-3.5" />
      </button>
      <span className="mx-1 h-5 w-px bg-border" />
      {kids.map((k) => (
        <button
          key={k.id}
          onClick={() => onSelect(k.id)}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
            k.id === studentId
              ? "bg-brand-gradient text-primary-foreground"
              : "border border-border hover:bg-secondary"
          }`}
        >
          {k.name}
        </button>
      ))}
    </div>
  );

  if (isLoading)
    return (
      <>
        {switcher}
        <DashboardSkeleton />
      </>
    );
  if (error)
    return (
      <>
        {switcher}
        <ErrorState error={error} onRetry={() => refetch()} />
      </>
    );

  const d = data!;
  const s = d.student;

  return (
    <>
      {switcher}

      <PageHeader
        title={s.name}
        subtitle={[s.program, s.batch ? `شعبة ${s.batch}` : null, s.academic_year]
          .filter(Boolean)
          .join(" • ")}
        actions={
          <Link
            to="/app/students/$studentId"
            params={{ studentId: s.id }}
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
          >
            الملف الكامل
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="نسبة الحضور"
          value={`${d.kpi.attendance_rate}%`}
          icon={ClipboardCheck}
          tone="accent"
        />
        <KpiCard
          label="المعدل العام"
          value={d.grade ? `${d.grade.percentage}% ${d.grade.emoji}` : `${d.kpi.average}%`}
          icon={Award}
          tone="primary"
        />
        <KpiCard
          label="واجبات مستحقة"
          value={d.kpi.pending_assignments}
          icon={NotebookPen}
          tone="info"
        />
        <KpiCard
          label="رسوم متبقية"
          value={money(d.kpi.outstanding_fees)}
          icon={Wallet}
          tone="warm"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Term grades, per subject, with the component breakdown. */}
        <SectionCard
          title="علامات الفصل"
          description={
            d.grade ? `${d.grade.label} ${d.grade.emoji} — ${d.grade.percentage}%` : "لا توجد علامات"
          }
          actions={<BookOpenCheck className="size-4 text-muted-foreground" />}
        >
          {d.subjects.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              لم تُرصد علامات لهذا الفصل بعد.
            </p>
          ) : (
            <ul className="space-y-4">
              {d.subjects.map((sub) => (
                <li key={sub.course} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{sub.course}</p>
                    <span className="shrink-0 text-sm font-bold">
                      {sub.final}% {sub.emoji}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={sub.final}
                      tone={sub.final >= 75 ? "success" : sub.final >= 50 ? "primary" : "danger"}
                    />
                  </div>
                  {sub.bonus > 0 && (
                    <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                      يشمل {sub.bonus} نقطة إضافية (بونص)
                    </p>
                  )}
                  <ul className="mt-3 space-y-1.5 border-t border-border pt-2.5">
                    {sub.components.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="truncate text-muted-foreground">
                          {c.component_name}
                          <span className="mr-1.5 opacity-60">({c.type_label})</span>
                        </span>
                        <span className="num shrink-0 font-medium">
                          {c.score}/{c.max_score} {c.emoji}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-5">
          {/* Today's timetable. */}
          <SectionCard
            title="جدول اليوم"
            description={`${d.today_schedule.length} حصة`}
            actions={<CalendarClock className="size-4 text-muted-foreground" />}
          >
            {d.today_schedule.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">لا توجد حصص اليوم.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.today_schedule.map((sl) => (
                  <li key={sl.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{sl.course}</p>
                      {sl.teacher && (
                        <p className="truncate text-xs text-muted-foreground">{sl.teacher}</p>
                      )}
                    </div>
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {sl.from_time.slice(0, 5)} – {sl.to_time.slice(0, 5)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Attendance and behaviour side by side. */}
          <SectionCard title="الحضور والسلوك" description="ملخص الفصل الحالي">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">حضور</p>
                <p className="num mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {d.attendance.present}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">غياب</p>
                <p className="num mt-1 text-lg font-bold text-destructive">{d.attendance.absent}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">إجازة</p>
                <p className="num mt-1 text-lg font-bold">{d.attendance.leave}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <span className="flex items-center gap-2 text-sm">
                <ShieldAlert className="size-4 text-muted-foreground" />
                نقاط السلوك
              </span>
              <span
                className={`num text-sm font-bold ${
                  d.behaviour.net_points > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : d.behaviour.net_points < 0
                      ? "text-destructive"
                      : ""
                }`}
              >
                {d.behaviour.net_points > 0 ? "+" : ""}
                {d.behaviour.net_points}
              </span>
            </div>
          </SectionCard>

          {/* Fees. */}
          <SectionCard title="الرسوم" description="الفصل الحالي">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">الإجمالي</p>
                <p className="num mt-1 text-sm font-bold">{money(d.fees.total)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">المدفوع</p>
                <p className="num mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {money(d.fees.paid)}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">المتبقي</p>
                <p className="num mt-1 text-sm font-bold text-destructive">
                  {money(d.fees.outstanding)}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Assignments. */}
        <SectionCard
          title="الواجبات"
          description={`${d.assignments.length} واجب`}
          actions={<NotebookPen className="size-4 text-muted-foreground" />}
        >
          {d.assignments.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">لا توجد واجبات حالية.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.assignments.map((a) => (
                <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="num mt-0.5 text-xs text-muted-foreground">
                      {a.subject} • التسليم {a.due}
                    </p>
                  </div>
                  <div className="text-left">
                    <Pill tone={a.submitted ? "success" : "warning"}>{a.submission_status}</Pill>
                    {a.score != null && (
                      <p className="num mt-1 text-xs text-muted-foreground">
                        {a.score}/{a.max}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Announcements. */}
        <SectionCard
          title="إعلانات المدرسة"
          description="آخر التحديثات"
          actions={<Megaphone className="size-4 text-muted-foreground" />}
        >
          {d.announcements.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">لا توجد إعلانات.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.announcements.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold">{a.title}</p>
                    <Pill
                      tone={a.type === "تنبيه" ? "danger" : a.type === "حدث" ? "info" : "primary"}
                    >
                      {a.type}
                    </Pill>
                  </div>
                  {a.body && (
                    <div className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                      <RichTextView html={a.body} />
                    </div>
                  )}
                  <p className="num mt-1 text-[11px] text-muted-foreground">
                    {a.date} • {a.audience}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}

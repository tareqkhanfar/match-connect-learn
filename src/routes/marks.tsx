import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Table2 } from "lucide-react";
import { MarkGrid } from "@/components/shared/mark-grid";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useApp } from "@/lib/app-context";
import { useClasses, useSubjects } from "@/lib/api/hooks";

export const Route = createFileRoute("/marks")({
  // Opened from the gradebook with a class and subject already chosen.
  validateSearch: (search: Record<string, unknown>): { group?: string; course?: string } => ({
    ...(typeof search["group"] === "string" && search["group"] ? { group: search["group"] } : {}),
    ...(typeof search["course"] === "string" && search["course"]
      ? { course: search["course"] }
      : {}),
  }),
  head: () => ({
    meta: [{ title: "ورقة العلامات — Match Education" }],
  }),
  component: MarksWorkspace,
});

/**
 * The mark sheet on its own screen.
 *
 * Deliberately outside `/app`: the sidebar and page chrome cost about a third
 * of the width, and a sheet with a dozen assessments needs every pixel. It
 * opens in its own tab so a teacher can keep the gradebook open beside it,
 * which is how the work actually goes — check the calculation, switch back,
 * keep marking.
 */
function MarksWorkspace() {
  const { ready, signedIn, role } = useApp();
  const navigate = useNavigate();
  const { group: groupFromUrl, course: courseFromUrl } = Route.useSearch();

  const [group, setGroup] = useState(groupFromUrl ?? "");
  const [course, setCourse] = useState(courseFromUrl ?? "");

  const classes = useClasses();
  const subjects = useSubjects();

  const canEdit = role === "admin" || role === "secretary" || role === "teacher";

  // This route carries its own guard: it does not sit under /app.
  useEffect(() => {
    if (ready && !signedIn) navigate({ to: "/" });
  }, [ready, signedIn, navigate]);

  // Default to the first class the user can see, as the gradebook does.
  useEffect(() => {
    if (!group && classes.data?.length) setGroup(classes.data[0]!.name);
  }, [classes.data, group]);

  if (!ready || !signedIn) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-sm">جارٍ التحقق من الجلسة…</p>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <p className="text-lg font-bold">هذه الشاشة للمعلمين والإدارة</p>
          <button
            onClick={() => void navigate({ to: "/app" })}
            className="mt-4 h-10 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-primary-foreground"
          >
            العودة للنظام
          </button>
        </div>
      </div>
    );
  }

  const selectedClass = classes.data?.find((c) => c.name === group);
  const selectedSubject = subjects.data?.find((s) => s.id === course);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <span className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
              <Table2 className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-black leading-tight">ورقة العلامات</span>
              <span className="block text-[11px] text-muted-foreground">
                {selectedClass?.student_group_name ?? "—"}
                {selectedSubject ? ` · ${selectedSubject.course_name}` : ""}
              </span>
            </span>
          </span>

          <span className="w-52">
            <SearchableSelect
              value={group}
              onChange={setGroup}
              options={(classes.data ?? []).map((c) => ({
                value: c.name,
                label: `${c.student_group_name} (${c.students})`,
              }))}
              placeholder="الشعبة"
            />
          </span>
          <span className="w-52">
            <SearchableSelect
              value={course}
              onChange={setCourse}
              options={(subjects.data ?? []).map((s) => ({
                value: s.id,
                label: s.course_name,
              }))}
              placeholder="المادة"
            />
          </span>

          <button
            onClick={() => void navigate({ to: "/app/gradebook" })}
            className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary"
          >
            <ArrowRight className="size-3.5" />
            سجل العلامات
          </button>
        </div>
      </header>

      <main className="p-4">
        {!group || !course ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            اختر الشعبة والمادة من الأعلى لعرض ورقة العلامات.
          </p>
        ) : (
          <MarkGrid group={group} course={course} canEdit={canEdit} />
        )}
      </main>
    </div>
  );
}

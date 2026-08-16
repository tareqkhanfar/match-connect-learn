import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, Loader2, Settings2, Table2 } from "lucide-react";
import { MarkGrid } from "@/components/shared/mark-grid";
import { GradeCalculation } from "@/components/shared/grade-calculation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useApp } from "@/lib/app-context";
import { useClasses, useSubjects } from "@/lib/api/hooks";

export const Route = createFileRoute("/marks")({
  // Opened from the gradebook with a class and subject already chosen.
  validateSearch: (
    search: Record<string, unknown>,
  ): { group?: string; course?: string; view?: boolean } => ({
    ...(typeof search["group"] === "string" && search["group"] ? { group: search["group"] } : {}),
    ...(typeof search["course"] === "string" && search["course"]
      ? { course: search["course"] }
      : {}),
    // Opened from the term workflow by an administrator reviewing what a
    // teacher submitted. The sheet is the same; nothing on it can be changed.
    ...(search["view"] === "1" || search["view"] === true ? { view: true } : {}),
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
  const { group: groupFromUrl, course: courseFromUrl, view } = Route.useSearch();

  const [group, setGroup] = useState(groupFromUrl ?? "");
  const [course, setCourse] = useState(courseFromUrl ?? "");
  const [showCalc, setShowCalc] = useState(false);

  const classes = useClasses();
  const subjects = useSubjects(group ? { student_group: group } : {});

  const staff = role === "admin" || role === "secretary" || role === "teacher";
  // Reviewing is not marking. An administrator opening a submitted sheet is
  // checking what was done, and a stray keystroke on someone else's marks is
  // exactly what the review step exists to prevent.
  const canEdit = staff && !view;

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

  if (!staff) {
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
              <span className="flex items-center gap-1.5 text-sm font-black leading-tight">
                ورقة العلامات
                {view && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                    <Eye className="size-3" />
                    اطّلاع فقط
                  </span>
                )}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {selectedClass?.student_group_name ?? "—"}
                {selectedSubject ? ` · ${selectedSubject.course_name}` : ""}
              </span>
            </span>
          </span>

          <span className="w-52">
            <SearchableSelect
              value={group}
              onChange={(v) => {
                setGroup(v);
                // The subject list is per class, so a subject chosen for the
                // previous one may not exist here — and the sheet would sit
                // on a pairing the teacher does not teach.
                setCourse("");
              }}
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

          <span className="mr-auto flex items-center gap-2">
            {group && course && (
              <button
                onClick={() => setShowCalc(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary"
              >
                <Settings2 className="size-3.5" />
                طريقة الاحتساب
              </button>
            )}
            <button
              onClick={() => void navigate({ to: view ? "/app/term" : "/app/gradebook" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              <ArrowRight className="size-3.5" />
              {view ? "سير الفصل" : "سجل العلامات"}
            </button>
          </span>
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

      {showCalc && group && course && (
        <Dialog open onOpenChange={(v) => !v && setShowCalc(false)}>
          <DialogContent className="max-w-4xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="size-5 text-primary" />
                طريقة احتساب العلامات
              </DialogTitle>
            </DialogHeader>
            {/* The full arithmetic behind every student's subject mark: which
                assessments counted, which the plan's rule dropped, and what
                each category came to. This is what an administrator reviewing
                a submission is actually here to read. */}
            <div className="max-h-[70vh] overflow-y-auto">
              <GradeCalculation studentGroup={group} course={course} canEdit={false} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

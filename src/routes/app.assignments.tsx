import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, NotebookPen, Plus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, PageHeader, Pill, ProgressBar, SectionCard } from "@/components/shared/ui-kit";
import { assignments, students } from "@/lib/mock-data";

export const Route = createFileRoute("/app/assignments")({
  head: () => ({
    meta: [
      { title: "الواجبات — Match Education" },
      {
        name: "description",
        content: "إنشاء الواجبات، متابعة تسليم الطلاب، وتصحيح المعلم في مكان واحد.",
      },
      { property: "og:title", content: "الواجبات — Match Education" },
      { property: "og:description", content: "أنشئ الواجبات وتابع التسليم والتصحيح." },
    ],
  }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  return (
    <>
      <PageHeader
        title="الواجبات المنزلية"
        subtitle="إنشاء الواجبات ومتابعة التسليم والتصحيح"
        actions={
          <button
            onClick={() => toast.success("تم فتح نموذج واجب جديد")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Plus className="size-4" />
            واجب جديد
          </button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="card-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <NotebookPen className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.subject} • {a.grade}
                  </p>
                </div>
                <Pill
                  tone={a.status === "مفتوح" ? "info" : a.status === "مغلق" ? "muted" : "warning"}
                >
                  {a.status}
                </Pill>
              </div>
              <p className="num mt-3 text-xs text-muted-foreground">آخر موعد للتسليم: {a.due}</p>
              <div className="mt-3 flex items-center gap-3">
                <ProgressBar
                  value={(a.submitted / a.total) * 100}
                  tone={a.submitted === a.total ? "success" : "primary"}
                />
                <span className="num shrink-0 text-xs font-semibold">
                  {a.submitted}/{a.total}
                </span>
              </div>
              <button
                onClick={() => toast.success("تم فتح شاشة التصحيح")}
                className="mt-4 w-full rounded-xl border border-border py-2 text-xs font-semibold transition-colors hover:bg-secondary"
              >
                عرض التسليمات والتصحيح
              </button>
            </div>
          ))}
        </div>

        <SectionCard title="أحدث التسليمات" description="بحاجة إلى تصحيح">
          <ul className="space-y-2.5">
            {students.slice(0, 8).map((s, i) => (
              <li
                key={s.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3"
              >
                <Avatar name={s.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {assignments[i % assignments.length]!.title}
                  </p>
                </div>
                {i % 3 === 0 ? (
                  <Pill tone="success">
                    <CheckCircle2 className="mr-1 size-3" /> مُصحّح
                  </Pill>
                ) : (
                  <button
                    onClick={() => toast.success("تم حفظ التصحيح")}
                    className="rounded-lg bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    تصحيح
                  </button>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}

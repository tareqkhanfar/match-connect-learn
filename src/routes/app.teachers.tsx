import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Mail, Phone, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { Input } from "@/components/ui/input";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { useTeachers } from "@/lib/api/hooks";

export const Route = createFileRoute("/app/teachers")({
  head: () => ({
    meta: [
      { title: "إدارة المعلمين — Match Education" },
      { name: "description", content: "قائمة المعلمين والمواد والصفوف المسندة وبيانات التواصل." },
      { property: "og:title", content: "إدارة المعلمين — Match Education" },
      { property: "og:description", content: "أدر الكادر التعليمي ومهامه بسهولة." },
    ],
  }),
  component: TeachersPage,
});

function TeachersPage() {
  const [q, setQ] = useState("");
  const { data, isLoading, error, refetch } = useTeachers();

  const teachers = data ?? [];
  // Filter on the client: the list is small and this keeps typing instant.
  const list = teachers.filter(
    (t) => !q || (t.instructor_name ?? "").includes(q) || (t.department ?? "").includes(q),
  );

  return (
    <>
      <PageHeader
        title="إدارة المعلمين"
        subtitle={`${teachers.length} معلماً ومعلمة في الكادر التعليمي`}
        actions={
          <button
            onClick={() => toast.info("إضافة معلم غير مفعّلة بعد")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Plus className="size-4" />
            إضافة معلم
          </button>
        }
      />

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم أو القسم..."
          className="h-11 rounded-xl bg-card pr-9"
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={6} />
      ) : list.length === 0 ? (
        <EmptyBlock
          title="لا يوجد معلمون"
          description="لم نجد أي معلم يطابق البحث."
          icon={<GraduationCap className="size-6" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <div
              key={t.id}
              className="card-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                <Avatar name={t.instructor_name} className="size-12 rounded-2xl text-sm" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{t.instructor_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.department ?? "—"}</p>
                </div>
                {t.status && (
                  <Pill tone={t.status === "Active" ? "success" : "muted"}>
                    {t.status === "Active" ? "نشِط" : t.status}
                  </Pill>
                )}
              </div>

              {(t.phone || t.email) && (
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {t.phone && (
                    <p className="num flex items-center gap-2">
                      <Phone className="size-3.5" />
                      {t.phone}
                    </p>
                  )}
                  {t.email && (
                    <p className="flex items-center gap-2 truncate" dir="ltr">
                      <Mail className="size-3.5" />
                      {t.email}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">الصفوف المسندة</p>
                {t.classes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لم يتم إسناد أي شعبة</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {t.classes.map((c) => (
                      <Pill key={c} tone="primary">
                        {c}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-border pt-3 text-center">
                <p className="text-[11px] text-muted-foreground">عدد الشُعب</p>
                <p className="num text-sm font-bold">{t.classes_count}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && teachers.length > 0 && (
        <div className="mt-6">
          <SectionCard title="توزيع الكادر حسب القسم" description="عدد المعلمين لكل قسم">
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(teachers.map((t) => t.department ?? "غير محدد"))).map((s) => (
                <div
                  key={s}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>{s}</span>
                  <span className="num rounded-md bg-primary-soft px-1.5 text-xs font-bold text-primary">
                    {teachers.filter((t) => (t.department ?? "غير محدد") === s).length}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </>
  );
}

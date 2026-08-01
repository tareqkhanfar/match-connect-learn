import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, PageHeader, Pill, SectionCard } from "@/components/shared/ui-kit";
import { Input } from "@/components/ui/input";
import { teachers } from "@/lib/mock-data";

export const Route = createFileRoute("/app/teachers")({
  head: () => ({
    meta: [
      { title: "إدارة المعلمين — Match Education" },
      { name: "description", content: "قائمة المعلمين، المواد والصفوف المسندة، وبيانات التواصل والجدول." },
      { property: "og:title", content: "إدارة المعلمين — Match Education" },
      { property: "og:description", content: "أدر الكادر التعليمي والمواد المسندة لكل معلم." },
    ],
  }),
  component: TeachersPage,
});

function TeachersPage() {
  const [q, setQ] = useState("");
  const list = teachers.filter((t) => t.name.includes(q) || t.subject.includes(q));

  return (
    <>
      <PageHeader
        title="إدارة المعلمين"
        subtitle={`${teachers.length} معلماً ومعلمة في الكادر التعليمي`}
        actions={
          <button
            onClick={() => toast.success("تم فتح نموذج إضافة معلم")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground shadow-soft"
          >
            <Plus className="size-4" />
            إضافة معلم
          </button>
        }
      />

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو المادة..." className="h-11 rounded-xl bg-card pr-9" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => (
          <div key={t.id} className="card-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
              <Avatar name={t.name} className="size-12 rounded-2xl text-sm" />
              <div className="min-w-0">
                <p className="truncate font-bold">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">{t.subject} • {t.qualification}</p>
              </div>
              <Pill tone={t.status === "دوام كامل" ? "success" : "warning"}>{t.status}</Pill>
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <p className="num flex items-center gap-2"><Phone className="size-3.5" />{t.phone}</p>
              <p className="flex items-center gap-2 truncate" dir="ltr"><Mail className="size-3.5" />{t.email}</p>
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">الصفوف المسندة</p>
              <div className="flex flex-wrap gap-1.5">
                {t.classes.map((c) => (
                  <Pill key={c} tone="primary">{c}</Pill>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-center">
              <div><p className="text-[11px] text-muted-foreground">سنوات الخبرة</p><p className="num text-sm font-bold">{t.experience}</p></div>
              <div><p className="text-[11px] text-muted-foreground">حصص أسبوعية</p><p className="num text-sm font-bold">{18 + (t.experience % 6)}</p></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <SectionCard title="توزيع الكادر حسب المادة" description="عدد المعلمين لكل مادة دراسية">
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(teachers.map((t) => t.subject))).map((s) => (
              <div key={s} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <span>{s}</span>
                <span className="num rounded-md bg-primary-soft px-1.5 text-xs font-bold text-primary">
                  {teachers.filter((t) => t.subject === s).length}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Printer,
  Award,
  Download,
  FileText,
  GraduationCap,
  Lock,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { PageHeader, SectionCard } from "@/components/shared/ui-kit";
import { DashboardSkeleton, ErrorState } from "@/components/shared/states";
import { Label } from "@/components/ui/label";
import { StudentPicker } from "@/components/shared/student-picker";
import { useApp } from "@/lib/app-context";
import { useViewedStudent } from "@/lib/use-viewed-student";
import { byRole, isBackOffice } from "@/lib/roles";
import { useAvailableDocuments, useQuarters } from "@/lib/api/hooks";
import { downloadCertificate, downloadQuarterCard } from "@/lib/api/export";

export const Route = createFileRoute("/app/certificates")({
  head: () => ({
    meta: [
      { title: "الشهادات والوثائق — Match Education" },
      {
        name: "description",
        content: "إصدار شهادة القيد، كشف العلامات، شهادة التخرج وشهادة حسن السيرة والسلوك.",
      },
    ],
  }),
  component: CertificatesPage,
});

/** Icon and colour per document kind. */
const KIND = {
  enrolment: { icon: FileText, tone: "bg-info-soft text-info" },
  transcript: { icon: ScrollText, tone: "bg-primary-soft text-primary" },
  graduation: { icon: GraduationCap, tone: "bg-success-soft text-success" },
  conduct: { icon: ShieldCheck, tone: "bg-warm-soft text-warm-foreground" },
} as const;

function CertificatesPage() {
  const { role, session } = useApp();
  const staff = isBackOffice(role);

  const children = session?.scope.children ?? [];
  const viewed = useViewedStudent();
  const [student, setStudent] = useState(staff ? "" : viewed);

  // Follow the header switcher when the parent changes child.
  useEffect(() => {
    if (!staff && viewed) setStudent(viewed);
  }, [staff, viewed]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [quarter, setQuarter] = useState("");
  const quarters = useQuarters().data?.quarters ?? [];

  async function downloadQuarter() {
    if (!student || !quarter) return;
    setDownloading("quarter");
    try {
      await downloadQuarterCard(student, quarter);
      toast.success("تم تنزيل شهادة الشهرين");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر إصدار الشهادة");
    } finally {
      setDownloading(null);
    }
  }

  const query = useAvailableDocuments(student || null);

  async function download(kind: string, label: string) {
    if (!student) return;
    setDownloading(kind);
    try {
      await downloadCertificate(kind, student);
      toast.success(`تم تنزيل ${label}`);
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || `تعذّر إصدار ${label}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <>
      <PageHeader
        title={byRole(role, "الشهادات والوثائق", {
          student: "شهاداتي",
          parent: "شهادات الأبناء",
        })}
        subtitle={byRole(role, "إصدار الوثائق الرسمية للطلاب موقّعة ومختومة", {
          student: "نزّل وثائقك الرسمية",
          parent: "نزّل الوثائق الرسمية لأبنائك",
        })}
      />

      {/* Staff search the school; a parent picks between their children. */}
      {(staff || children.length > 1) && (
        <div className="card-surface mb-5 p-4 md:max-w-md">
          <StudentPicker
            value={student}
            onChange={setStudent}
            placeholder={staff ? "ابحث عن طالب" : "اختر الابن"}
          />
        </div>
      )}

      {!student ? (
        <div className="card-surface flex flex-col items-center gap-2 p-10 text-center">
          <Award className="size-7 text-muted-foreground" />
          <p className="text-sm font-semibold">اختر طالباً لعرض وثائقه</p>
          <p className="text-xs text-muted-foreground">
            تُصدر الوثائق بصيغة PDF جاهزة للطباعة مع رمز تحقق.
          </p>
        </div>
      ) : query.isLoading ? (
        <DashboardSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          {/* The two-month certificate needs a quarter chosen, so it sits in its
            own card rather than among the one-click documents. */}
          {quarters.length > 0 && (
            <SectionCard
              title="شهادة الشهرين"
              description="نتائج ربع دراسي واحد — تُصدر قبل نهاية الفصل."
              className="mb-5"
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[12rem] space-y-1.5">
                  <Label>الربع الدراسي</Label>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">اختر الربع</option>
                    {quarters.map((q) => (
                      <option key={q.name} value={q.name}>
                        {q.name} — {q.totalMarks} علامة
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={downloadQuarter}
                  disabled={!quarter || downloading === "quarter"}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  <Printer className="size-4" />
                  {downloading === "quarter" ? "جارٍ الإصدار…" : "تنزيل شهادة الشهرين"}
                </button>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title={query.data?.student_name ?? "الوثائق المتاحة"}
            description="اضغط على أي وثيقة لتنزيلها بصيغة PDF"
          >
            <ul className="grid gap-3 md:grid-cols-2">
              {(query.data?.documents ?? []).map((doc) => {
                const meta = KIND[doc.kind as keyof typeof KIND] ?? KIND.enrolment;
                const Icon = meta.icon;
                const busy = downloading === doc.kind;
                return (
                  <li
                    key={doc.kind}
                    className={`rounded-xl border border-border p-4 transition-all ${
                      doc.available ? "hover:-translate-y-0.5 hover:shadow-card" : "opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid size-11 shrink-0 place-items-center rounded-2xl ${meta.tone}`}
                      >
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{doc.label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {doc.description}
                        </p>

                        {doc.available ? (
                          <button
                            onClick={() => download(doc.kind, doc.label)}
                            disabled={busy}
                            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-3 text-xs font-bold text-primary-foreground transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
                          >
                            <Download className="size-3.5" />
                            {busy ? "جارٍ التجهيز…" : "تنزيل PDF"}
                          </button>
                        ) : (
                          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                            <Lock className="size-3.5" />
                            {doc.reason ?? "غير متاحة"}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              تحمل كل وثيقة رمز تحقق فريد أسفل الصفحة، يمكن للجهات الرسمية مراجعته لدى إدارة المدرسة
              للتأكد من صحة الوثيقة.
            </p>
          </SectionCard>
        </>
      )}
    </>
  );
}

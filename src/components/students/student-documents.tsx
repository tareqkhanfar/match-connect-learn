import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Eye, FileText, Printer } from "lucide-react";
import { Pill, SectionCard } from "@/components/shared/ui-kit";
import { EmptyBlock, ErrorState, TableSkeleton } from "@/components/shared/states";
import { HtmlPreviewDialog } from "@/components/shared/html-preview-dialog";
import { apiGet } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import { printHtml } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

type Kind = "form" | "periodic" | "evaluation" | "request";

interface StudentDocument {
  kind: Kind;
  id: string;
  title: string;
  subtitle: string;
  date: string;
  by: string;
  status: string;
  /** The endpoint that prints it — the same one its own screen uses. */
  print: { method: string; params: Record<string, string> };
}

interface StudentDocuments {
  items: StudentDocument[];
  counts: Record<Kind, number>;
  kinds: Record<Kind, string>;
}

const TONE: Record<Kind, "primary" | "success" | "info" | "warning"> = {
  form: "primary",
  periodic: "success",
  evaluation: "info",
  request: "warning",
};

const FILTERS: Array<{ key: Kind | ""; label: string }> = [
  { key: "", label: "الكل" },
  { key: "form", label: "النماذج" },
  { key: "periodic", label: "التقييمات الدورية" },
  { key: "evaluation", label: "تقييمات المهارات والسلوك" },
  { key: "request", label: "الطلبات" },
];

function load(doc: StudentDocument) {
  return apiGet<{ html: string; title: string }>(doc.print.method, doc.print.params);
}

/**
 * «النماذج» in a student's file: every form filled for the pupil, every
 * evaluation and every request on record — each shown and printed exactly as
 * its own screen prints it.
 */
export function StudentDocumentsTab({ student }: { student: string }) {
  const query = useQuery<StudentDocuments>({
    queryKey: ["student-documents", student],
    queryFn: () => apiGet("student_forms.student_documents", { student }),
  });
  const [filter, setFilter] = useState<Kind | "">("");
  const [viewing, setViewing] = useState<StudentDocument | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);

  async function print(doc: StudentDocument) {
    setPrinting(doc.id);
    try {
      const page = await load(doc);
      printHtml(page.html, page.title);
    } catch (err) {
      toast.error(errorMessage(err, "تعذّرت الطباعة"));
    } finally {
      setPrinting(null);
    }
  }

  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <TableSkeleton rows={4} />;

  const { items, counts, kinds } = query.data;
  const shown = filter ? items.filter((i) => i.kind === filter) : items;

  return (
    <SectionCard
      title="النماذج"
      description="كل نموذج أو تقييم أو طلب مرتبط بالطالب — يُعرض ويُطبع من هنا"
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n = f.key ? (counts[f.key] ?? 0) : items.length;
          if (f.key && !n) return null;
          return (
            <button
              key={f.key || "all"}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-secondary",
              )}
            >
              {f.label} <span className="num">({n})</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyBlock
          title="لا توجد نماذج لهذا الطالب بعد"
          description="تظهر هنا تلقائياً النماذج التي تُعبّأ له، وتقييماته، وطلبات المتسع والنقل."
          icon={<ClipboardList className="size-6" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((doc) => (
            <li key={`${doc.kind}-${doc.id}`} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold">{doc.title}</p>
                  <Pill tone={TONE[doc.kind]}>{kinds[doc.kind]}</Pill>
                  {doc.status && <Pill>{doc.status}</Pill>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[doc.subtitle, doc.by].filter(Boolean).join(" · ")}
                  {doc.date && (
                    <>
                      {doc.subtitle || doc.by ? " · " : ""}
                      <span className="num" dir="ltr">
                        {doc.date}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setViewing(doc)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-secondary"
                >
                  <Eye className="size-3.5" />
                  عرض
                </button>
                <button
                  onClick={() => print(doc)}
                  disabled={printing === doc.id}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                >
                  <Printer className="size-3.5" />
                  {printing === doc.id ? "…" : "طباعة"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <HtmlPreviewDialog
          heading={viewing.title}
          load={() => load(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
    </SectionCard>
  );
}

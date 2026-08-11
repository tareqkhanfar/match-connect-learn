import { useState } from "react";
import { toast } from "sonner";
import { CalendarRange, Check, ChevronDown, Lock } from "lucide-react";
import { useAcademicContext, useSetPeriod } from "@/lib/api/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The academic year and term the whole system is read through.
 *
 * The choice is stored server-side against the user, not in this component,
 * so it survives a reload and applies to every screen — including ones that
 * never hear about this widget. Changing it invalidates every query, because
 * a page still showing last term's marks next to this term's label would be
 * worse than a brief reload.
 */
export function PeriodSwitcher() {
  const { data } = useAcademicContext();
  const setPeriod = useSetPeriod();
  const [open, setOpen] = useState(false);

  if (!data) return null;

  const { years, terms, academicYear, academicTerm, closed } = data;
  const termsForYear = terms.filter((t) => !academicYear || t.academicYear === academicYear);
  const currentTerm = terms.find((t) => t.name === academicTerm);

  async function choose(vars: { academic_year?: string; academic_term?: string }) {
    try {
      await setPeriod.mutateAsync(vars);
      setOpen(false);
      toast.success("تم تغيير الفترة الدراسية");
    } catch (err) {
      toast.error((err as { messageAr?: string }).messageAr || "تعذّر تغيير الفترة");
    }
  }

  const label = currentTerm?.label ?? academicTerm ?? academicYear ?? "الفترة الدراسية";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
            closed
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
              : "border-border text-muted-foreground hover:bg-secondary"
          }`}
          title={closed ? "هذه الفترة مغلقة — للاطلاع فقط" : "اختر العام والفصل الدراسي"}
        >
          {closed ? <Lock className="size-3.5" /> : <CalendarRange className="size-3.5" />}
          <span className="hidden max-w-[11rem] truncate sm:inline">{label}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          العام الدراسي
        </DropdownMenuLabel>
        {years.map((y) => (
          <DropdownMenuItem
            key={y.name}
            onSelect={(e) => {
              e.preventDefault();
              // Changing the year clears the term: a term from another year is
              // not a valid combination, and the server rejects it.
              void choose({ academic_year: y.name });
            }}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              {y.name === academicYear && <Check className="size-3.5 text-primary" />}
              <span className={y.name === academicYear ? "font-bold" : ""}>{y.name}</span>
            </span>
            {y.closed && <span className="text-[10px] text-amber-600">منتهٍ</span>}
          </DropdownMenuItem>
        ))}

        {termsForYear.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              الفصل الدراسي
            </DropdownMenuLabel>
            {termsForYear.map((t) => (
              <DropdownMenuItem
                key={t.name}
                onSelect={(e) => {
                  e.preventDefault();
                  void choose({ academic_year: t.academicYear, academic_term: t.name });
                }}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {t.name === academicTerm && <Check className="size-3.5 shrink-0 text-primary" />}
                  <span className={`truncate ${t.name === academicTerm ? "font-bold" : ""}`}>
                    {t.label}
                  </span>
                </span>
                {t.closed && <span className="shrink-0 text-[10px] text-amber-600">مغلق</span>}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {closed && (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-[11px] leading-relaxed text-amber-700">
              هذه الفترة مغلقة. البيانات للاطلاع فقط ولا يمكن التعديل عليها.
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

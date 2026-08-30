import { Link } from "@tanstack/react-router";
import {
  Award,
  BarChart3,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Images,
  Layers,
  Link2,
  Mail,
  NotebookPen,
  Printer,
  ShieldAlert,
  Ticket,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { EmptyBlock, TableSkeleton } from "@/components/shared/states";
import { Pill } from "@/components/shared/ui-kit";
import { useClassConnections } from "@/lib/api/hooks";

/** Named by the server, drawn here — the API must not ship components. */
const ICONS: Record<string, LucideIcon> = {
  Users,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  BookOpenCheck,
  Award,
  Layers,
  FileText,
  FileSpreadsheet,
  NotebookPen,
  FileQuestion,
  BookMarked,
  FolderOpen,
  Printer,
  Mail,
  Users2,
  Images,
  ClipboardList,
  ShieldAlert,
  Ticket,
  BarChart3,
};

/**
 * Everything you can do from inside one class.
 *
 * Each row opens its screen with this class already chosen, which is the whole
 * point: the alternative is leaving the class, opening another screen, and
 * finding the same class again in a dropdown.
 */
export function ClassConnections({
  studentGroup,
  onNavigate,
}: {
  studentGroup: string;
  onNavigate?: () => void;
}) {
  const { data, isLoading } = useClassConnections(studentGroup);

  if (isLoading) return <TableSkeleton rows={5} />;
  if (!data) {
    return (
      <EmptyBlock
        title="تعذّر عرض الروابط"
        description="لم نتمكن من قراءة بيانات هذه الشعبة."
        icon={<Link2 className="size-6" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3">
        <span className="text-sm font-bold">{data.name}</span>
        {data.program && <Pill>{data.program}</Pill>}
        <Pill tone="primary">
          <span className="num">{data.students}</span> طالباً
        </Pill>
        {data.courses.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {data.courses.map((c) => c.name).join("، ")}
          </span>
        )}
      </div>

      {data.groups.map((group) => {
        const rows = data.connections.filter((c) => c.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => {
                const Icon = ICONS[row.icon] ?? Link2;
                return (
                  <Link
                    key={row.key}
                    to={row.route}
                    search={{ group: studentGroup }}
                    onClick={onNavigate}
                    className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{row.label}</span>
                      {/* A count is only shown where one was counted: "0" is
                          information, an empty space is not. */}
                      {row.count !== null && (
                        <span className="num block text-[11px] text-muted-foreground">
                          {row.count} حالياً
                        </span>
                      )}
                    </span>
                    {row.action && (
                      <span className="shrink-0 text-[10px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        إضافة +
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

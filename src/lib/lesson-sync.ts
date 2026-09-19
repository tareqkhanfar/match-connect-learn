import { toast } from "sonner";
import type { LessonSync } from "@/lib/api/hooks";

/**
 * Tell the user what a saved week did to the lessons already generated.
 *
 * Silence would be the worst answer: a timetabler who moves a lesson needs to
 * know the dated lessons moved with it — or, when some could not, which and
 * why.
 */
export function announceLessonSync(sync: LessonSync | null | undefined): void {
  if (!sync) return;
  if (sync.error) {
    toast.error(sync.error, { duration: 10000 });
    return;
  }
  const parts: string[] = [];
  if (sync.created || sync.removed) {
    parts.push(`حُدّثت الحصص المولّدة: أُضيفت ${sync.created} وأُزيلت ${sync.removed}`);
  }
  if (sync.keptAttended) {
    parts.push(`بقيت ${sync.keptAttended} حصة عليها حضور أو تبديل كما هي`);
  }
  if (parts.length) toast.success(parts.join(" — "), { duration: 6000 });
  if (sync.skipped.length) {
    const first = sync.skipped[0]!;
    toast.warning(
      `تعذّر توليد ${sync.skipped.length} حصة — ${first.date}${first.course ? ` (${first.course})` : ""}: ${first.reason}`,
      { duration: 10000 },
    );
  }
}

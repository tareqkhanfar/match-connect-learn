import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Retired in favour of /app/assessment-plan.
 *
 * Both screens edited the same MS Grade Scheme records, but this one predates
 * quarters and the category tree: its save replaced every component with a
 * flat list carrying only name/type/weight/max_score. Opening a modern plan
 * here and saving would have dropped `ms_quarter` and `ms_parent_component` —
 * flattening the tree, unassigning the quarters, and silently changing every
 * mark computed from it.
 *
 * The route is kept rather than deleted so an existing link or bookmark still
 * lands somewhere sensible; the old editor is gone so that code path cannot be
 * reached at all.
 */
export const Route = createFileRoute("/app/schemes")({
  beforeLoad: () => {
    throw redirect({ to: "/app/assessment-plan" });
  },
});

import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Retired in favour of /app/timetable-grid.
 *
 * Building a week was split across two screens: the plan (what the class
 * studies, how often, and who teaches it) lived here, and arranging it lived
 * on the grid. That split forced a timetabler to hold the plan in their head
 * while dragging lessons on another page, and made the automatic build feel
 * like a separate act from the timetable it produced.
 *
 * Both steps are now sections of one screen, and the automatic arrangement
 * fills the grid on screen rather than writing lessons — so it can be run
 * again and again until the week looks right, and only then saved.
 *
 * The route is kept rather than deleted so an existing link or bookmark still
 * lands somewhere sensible.
 */
export const Route = createFileRoute("/app/timetable-builder")({
  beforeLoad: () => {
    throw redirect({ to: "/app/timetable-grid" });
  },
  component: () => null,
});

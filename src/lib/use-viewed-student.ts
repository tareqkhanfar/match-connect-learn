import { useApp } from "./app-context";

/**
 * The student whose data the current screen should show.
 *
 * A student sees themselves. A guardian sees whichever child they picked in
 * the header — so every screen agrees, instead of each one independently
 * defaulting to the first child in the list.
 *
 * Staff get an empty string: their screens are not scoped to one student and
 * should fall back to their own pickers.
 */
export function useViewedStudent(): string {
  const { role, session, activeChild, children_ } = useApp();

  if (role === "student") {
    return session?.scope.student ?? "";
  }

  if (role === "parent") {
    // `activeChild` settles a moment after the session loads; fall back to the
    // first child so the screen has something to show in the meantime.
    return activeChild ?? children_[0]?.id ?? "";
  }

  return "";
}

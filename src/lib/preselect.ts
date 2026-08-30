/**
 * The class (and subject) a screen was opened with.
 *
 * The connections panel links into these screens with `?group=` already set,
 * so the reader lands with the class chosen rather than picking it again from
 * a dropdown they just came from. A route that does not declare this validator
 * silently drops the parameter, which is why it is shared rather than written
 * out per screen.
 */
export interface GroupSearch {
  group?: string;
  course?: string;
}

export function groupSearch(search: Record<string, unknown>): GroupSearch {
  return {
    ...(typeof search["group"] === "string" && search["group"] ? { group: search["group"] } : {}),
    ...(typeof search["course"] === "string" && search["course"]
      ? { course: search["course"] }
      : {}),
  };
}

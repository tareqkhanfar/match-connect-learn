import { useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "./searchable-select";
import { useStudents } from "@/lib/api/hooks";
import { useApp } from "@/lib/app-context";
import { isBackOffice } from "@/lib/roles";

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

interface StudentPickerProps {
  value: string;
  onChange: (student: string) => void;
  placeholder?: string;
  className?: string;
  /** Show an "all students" entry — useful when the picker acts as a filter. */
  clearable?: boolean;
  clearLabel?: string;
  /** Narrow the list to one class, for screens opened from a class. */
  studentGroup?: string | undefined;
}

/**
 * Pick a student, scoped to who the viewer is.
 *
 * A parent chooses between their own children, so the list is small and comes
 * straight from the session. Staff search the whole school, which is why the
 * query is server-side: a plain dropdown capped at one page showed 20 of 338
 * students and looked broken.
 */
export function StudentPicker({
  value,
  onChange,
  placeholder = "اختر الطالب",
  className,
  clearable = false,
  clearLabel = "كل الطلاب",
  studentGroup,
}: StudentPickerProps) {
  const { role, session } = useApp();
  const staff = isBackOffice(role) || role === "teacher";

  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);

  // 100 is the server's ceiling; searching narrows it well before that bites.
  // Narrowed to one class when the screen was opened from it: a teacher who
  // arrived from 4-B is looking for a pupil in 4-B, and searching the whole
  // school for them is a step backwards.
  const query = useStudents(
    staff
      ? {
          ...(debounced ? { search: debounced } : {}),
          ...(studentGroup ? { student_group: studentGroup } : {}),
          page_size: 100,
        }
      : { page_size: 1 },
  );

  const options = useMemo(() => {
    if (staff) {
      return (query.data?.items ?? []).map((s) => ({
        value: s.id,
        label: s.name,
        code: s.id,
        ...(s.grade ? { hint: [s.grade, s.section].filter(Boolean).join(" — ") } : {}),
      }));
    }

    // A parent's own children, named rather than shown as bare record ids.
    const children = session?.scope.children ?? [];
    if (children.length) {
      return children.map((c) => ({ value: c.id, label: c.name, code: c.id }));
    }
    return (session?.scope.students ?? []).map((id) => ({ value: id, label: id, code: id }));
  }, [staff, query.data, session]);

  const total = query.data?.total ?? 0;
  const showingSubset = staff && total > options.length;

  return (
    <div className="space-y-1">
      <SearchableSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder="ابحث بالاسم أو الرقم…"
        emptyText={query.isLoading ? "جارٍ البحث…" : "لا توجد نتائج."}
        onSearchChange={staff ? setSearch : undefined}
        {...(className ? { className } : {})}
        clearable={clearable}
        clearLabel={clearLabel}
      />
      {showingSubset && (
        <p className="text-[11px] text-muted-foreground">
          يعرض {options.length} من {total} طالباً — اكتب للبحث في الباقي.
        </p>
      )}
    </div>
  );
}

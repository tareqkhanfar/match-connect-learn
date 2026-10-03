import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/client";

// --- جدول الإشغال ---------------------------------------------------------------

export type CoverSortKey = "day_load" | "week_load" | "covers" | "name";

export interface CoverRule {
  order: CoverSortKey[];
  skip_day_off: number;
  present_only: number;
  max_day_load: number;
  max_rows: number;
  exclude: string[];
  names: "short" | "full";
}

export interface CoverTeacher {
  id: string;
  name: string;
  fullName: string;
  dayLoad: number;
  weekLoad: number;
  covers: number;
}

export interface CoverTable {
  id?: string;
  title?: string;
  academicYear: string | null;
  periods: Array<{ period: number; label: string }>;
  days: Array<{
    day: string;
    label: string;
    rows: number;
    periods: Array<{ period: number; teachers: CoverTeacher[] }>;
  }>;
  teachers: number;
  rule: CoverRule;
  generatedOn: string;
}

export interface CoverOptions {
  rule: CoverRule;
  defaultRule: CoverRule;
  sortKeys: Array<{ key: CoverSortKey; label: string }>;
  canEditRule: boolean;
  instructors: Array<{ id: string; name: string }>;
  saved: Array<{ id: string; title: string; on: string; by: string }>;
}

export function useCoverOptions() {
  return useQuery<CoverOptions>({
    queryKey: ["cover-options"],
    queryFn: () => apiGet("cover_schedule.options"),
  });
}

/** The table under the saved rule (or a draft one, for the administration). */
export function generateCover(rule?: CoverRule) {
  return apiGet<CoverTable>("cover_schedule.generate", rule ? { rule: JSON.stringify(rule) } : {});
}

export function getSavedCover(saved: string) {
  return apiGet<CoverTable>("cover_schedule.get_table", { saved });
}

export function getCoverPrint(saved?: string) {
  return apiGet<{ html: string; title: string }>(
    "cover_schedule.print_table",
    saved ? { saved } : {},
  );
}

function useCoverMutation<V>(method: string, body: (v: V) => Record<string, unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => apiPost<Record<string, unknown>>(`cover_schedule.${method}`, body(v)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cover-options"] }),
  });
}

export const useSaveCoverRule = () =>
  useCoverMutation<CoverRule>("save_rule", (rule) => ({ rule: JSON.stringify(rule) }));
export const useSaveCoverTable = () =>
  useCoverMutation<{ title?: string }>("save_table", (v) => ({
    ...(v.title ? { title: v.title } : {}),
  }));
export const useDeleteCoverTable = () =>
  useCoverMutation<string>("delete_table", (saved) => ({ saved }));

// --- جدول المناوبة ----------------------------------------------------------------

export interface DutyEntry {
  day: string;
  teacher: string;
  name: string;
  place: string;
}

export interface DutyProgram {
  id: string;
  title: string;
  periodLabel: string;
  fromTime: string;
  toTime: string;
  academicYear: string | null;
  sortOrder: number;
  isActive: boolean;
  notes: string;
  entries: DutyEntry[];
}

export interface DutyList {
  programs: DutyProgram[];
  days: Array<{ key: string; label: string }>;
  instructors: Array<{ id: string; name: string }>;
  places: string[];
  load: Array<{ name: string; count: number }>;
}

export function useDutyPrograms() {
  return useQuery<DutyList>({
    queryKey: ["duty-programs"],
    queryFn: () => apiGet("duty_schedule.list_programs"),
  });
}

function useDutyMutation<V>(method: string, body: (v: V) => Record<string, unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => apiPost<Record<string, unknown>>(`duty_schedule.${method}`, body(v)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["duty-programs"] }),
  });
}

export const useSaveDutyProgram = () =>
  useDutyMutation<Partial<DutyProgram> & { title: string }>("save_program", (p) => ({
    payload: JSON.stringify(p),
  }));
export const useDeleteDutyProgram = () =>
  useDutyMutation<string>("delete_program", (program) => ({ program }));
export const useMoveDutyProgram = () =>
  useDutyMutation<{ program: string; direction: number }>("move_program", (v) => v);

export function getDutyPrint(programs?: string[], onePerPage = false) {
  return apiGet<{ html: string; title: string }>("duty_schedule.print_programs", {
    ...(programs?.length ? { programs: JSON.stringify(programs) } : {}),
    ...(onePerPage ? { one_per_page: 1 } : {}),
  });
}

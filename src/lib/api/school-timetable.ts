import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/client";

/** One lesson of the weekly pattern, as the sheet edits it. */
export interface SheetSlot {
  /** Stable key on the page: the stored id, or a fresh one for a new cell. */
  k: string;
  /** The stored `MS Timetable Slot`, empty for a cell not saved yet. */
  id: string;
  day: string;
  period: number;
  group: string;
  course: string;
  instructor: string;
  room: string;
}

export interface SheetGroup {
  id: string;
  label: string;
  short: string;
  program: string;
  gradeOrder: number;
  letter: string;
  homeroom: string;
  students: number;
  courses: string[];
  clock: Array<{ order: number; from: string; to: string }>;
}

export interface SheetTeacher {
  id: string;
  name: string;
  quota: number;
  homeroomOf: string[];
  courses: string[];
  inactive?: boolean;
}

export interface SheetCourse {
  label: string;
  subject: string;
  short: string;
}

export interface GenerationSummary {
  lessons: number;
  generatedTo: string;
  audience: string;
  defaultFrom: string;
  defaultTo: string;
  audiences: Array<{ value: string; label: string }>;
}

export interface SheetJob {
  state?: "running" | "done" | "stalled";
  mode?: "generate" | "sync";
  total?: number;
  done?: number;
  current?: string;
  created?: number;
  removed?: number;
  kept?: number;
  skipped?: number;
  reasons?: Record<string, number>;
  errors?: string[];
  from?: string;
  to?: string;
  audience?: string;
  startedAt?: string;
  finishedAt?: string;
  generation?: GenerationSummary;
}

export interface SchoolSheet {
  days: Array<{ value: string; label: string }>;
  periods: Array<{ order: number; from: string; to: string }>;
  groups: SheetGroup[];
  teachers: SheetTeacher[];
  courses: Record<string, SheetCourse>;
  rooms: Array<{ id: string; label: string }>;
  slots: Array<Omit<SheetSlot, "k">>;
  limits: Record<string, number>;
  defaultLimit: number;
  generation: GenerationSummary;
  job: SheetJob;
}

export interface SheetProblem {
  kind: "group" | "teacher" | "room" | "time" | "course" | "quota" | "daily";
  level: "error" | "warning";
  keys: string[];
  message: string;
  /** An error the week already had, between cells this edit did not touch. */
  legacy?: boolean;
}

const KEY = ["school-timetable"] as const;

export function useSchoolSheet() {
  return useQuery<SchoolSheet>({
    queryKey: [...KEY, "sheet"],
    queryFn: () => apiGet<SchoolSheet>("school_timetable.load"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export interface SaveResult {
  created: number;
  updated: number;
  removed: number;
  unchanged: number;
  groups: number;
  warnings: number;
  job: SheetJob | null;
  slots: Array<Omit<SheetSlot, "k">>;
}

export function useSaveSheet() {
  return useMutation({
    // Only what changed: laid over the week as it stands on the server, so a
    // second tab that loaded earlier cannot undo what another saved since.
    mutationFn: (vars: {
      changes: SheetSlot[];
      deletes: string[];
      limits?: Record<string, number>;
    }) =>
      apiPost<SaveResult>("school_timetable.save", {
        changes: JSON.stringify(vars.changes),
        deletes: JSON.stringify(vars.deletes),
        limits: JSON.stringify(vars.limits ?? {}),
      }),
  });
}

export function useSetQuota() {
  return useMutation({
    mutationFn: (vars: { instructor: string; quota: number }) =>
      apiPost<{ instructor: string; quota: number }>("school_timetable.set_quota", vars),
  });
}

export function useGenerateSheet() {
  return useMutation({
    mutationFn: (vars: {
      from_date?: string;
      to_date?: string;
      audience: string;
      groups?: string[];
    }) =>
      apiPost<{ job: SheetJob }>("school_timetable.generate", {
        ...vars,
        groups: vars.groups?.length ? JSON.stringify(vars.groups) : undefined,
      }),
  });
}

/** Polls while a generation runs; stops by itself when it is over. */
export function useSheetJob(enabled: boolean) {
  const qc = useQueryClient();
  return useQuery<SheetJob>({
    queryKey: [...KEY, "job"],
    queryFn: async () => {
      const job = await apiGet<SheetJob>("school_timetable.job_status");
      if (job.state === "done") {
        // The lessons changed under every screen that reads them.
        void qc.invalidateQueries({ queryKey: ["timetable"] });
      }
      return job;
    },
    enabled,
    refetchInterval: (q) => (q.state.data?.state === "running" ? 2000 : false),
  });
}

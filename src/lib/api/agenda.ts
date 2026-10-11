import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/client";

/** What a kind of event does to the school day (MS Agenda Type). */
export interface AgendaType {
  key: string;
  label: string;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: number;
  isSystem: number;
  /** A holiday: no attendance, lessons or exams (synced to the Holiday List). */
  closes_school: number;
  /** The audience's lessons are suspended. */
  no_lessons: number;
  exam_period: number;
  staff_only: number;
  notify: number;
}

export type AgendaAudience = "school" | "programs" | "groups" | "staff";

export interface AgendaEvent {
  id: string;
  /** event: on the agenda; weekly: the list's weekly day off; holiday: entered outside the agenda. */
  source: "event" | "weekly" | "holiday";
  title: string;
  type: string;
  typeLabel: string;
  color: string;
  icon: string;
  status: string;
  from: string;
  to: string;
  allDay: number;
  fromTime: string;
  toTime: string;
  audience: AgendaAudience;
  audienceLabel: string;
  groups: string[];
  programs: string[];
  location: string;
  description: string;
  noLessons: number;
  closesSchool: number;
  examPeriod: number;
  staffOnly: number;
}

export interface AgendaOptions {
  types: AgendaType[];
  audiences: Array<{ key: AgendaAudience; label: string }>;
  canEdit: boolean;
  programs: Array<{ id: string; label: string }>;
  groups: Array<{ id: string; label: string; program: string }>;
}

const KEY = ["agenda"] as const;

export function useAgendaOptions() {
  return useQuery<AgendaOptions>({
    queryKey: [...KEY, "options"],
    queryFn: () => apiGet("agenda.options"),
    staleTime: 60_000,
  });
}

export function useAgendaEvents(from: string, to: string) {
  return useQuery<{ events: AgendaEvent[]; canEdit: boolean }>({
    queryKey: [...KEY, "events", from, to],
    queryFn: () => apiGet("agenda.events", { date_from: from, date_to: to }),
    placeholderData: (prev) => prev,
  });
}

export function useAgendaUpcoming(days = 14) {
  return useQuery<{ events: Array<AgendaEvent & { inDays: number }> }>({
    queryKey: [...KEY, "upcoming", days],
    queryFn: () => apiGet("agenda.upcoming", { days }),
    staleTime: 5 * 60_000,
  });
}

export function useAgendaDay(date: string | undefined, studentGroup?: string) {
  return useQuery<{
    date: string;
    closed: string;
    noLessons: string;
    examPeriod: string;
    events: AgendaEvent[];
  }>({
    queryKey: [...KEY, "day", date ?? "", studentGroup ?? ""],
    queryFn: () =>
      apiGet("agenda.day", { date, ...(studentGroup ? { student_group: studentGroup } : {}) }),
    enabled: !!date,
    staleTime: 60_000,
  });
}

export interface AgendaEventPayload {
  id?: string;
  title: string;
  type: string;
  status: string;
  from: string;
  to: string;
  allDay: number;
  fromTime?: string;
  toTime?: string;
  audience: AgendaAudience;
  groups: string[];
  programs: string[];
  location: string;
  description: string;
  noLessons: number;
  notify: number;
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: KEY });
  // Holidays feed attendance, the header banner and exam scheduling.
  void qc.invalidateQueries({ queryKey: ["holidays"] });
  void qc.invalidateQueries({ queryKey: ["upcoming-holidays"] });
}

export function useSaveAgendaEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgendaEventPayload) =>
      apiPost<AgendaEvent>("agenda.save_event", { payload }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteAgendaEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (event: string) => apiPost("agenda.delete_event", { event }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSaveAgendaType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<AgendaType> & { label: string }) =>
      apiPost<AgendaType>("agenda.save_type", { payload }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteAgendaType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => apiPost("agenda.delete_type", { key }),
    onSuccess: () => invalidateAll(qc),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api/client";
import type { FormEntryFor, FormTemplate } from "@/lib/api/hooks";
import type { Role, SchoolRole } from "@/lib/roles";

// --- مساحات العمل ----------------------------------------------------------------

export type WsItemKind = "screen" | "page" | "url";

/** One button: a screen of the system, a built page, or an outside address. */
export interface WsItem {
  id: string;
  kind: WsItemKind;
  target: string;
  /** Empty: the screen's or the page's own name. */
  label: string;
  icon: string;
  color: string;
}

export type WsBlockType = "shortcuts" | "links" | "numbers" | "text";

export interface WsBlock {
  id: string;
  type: WsBlockType;
  title: string;
  items?: WsItem[];
  /** «أرقام»: keys of the counted cards (workspace.shortcuts). */
  cards?: string[];
  /** «ملاحظة»: plain text. */
  text?: string;
}

export interface WsLayout {
  blocks: WsBlock[];
}

export interface MyWorkspace {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  layout: WsLayout;
}

export interface MyWorkspaces {
  workspaces: MyWorkspace[];
  /** Empty: the role's own menu. */
  default: string;
  /** The role's menu is not among the choices. */
  hideSystem: boolean;
  /** The Administrator account: may build workspaces and pages. */
  canBuild: boolean;
}

export interface WorkspaceRow {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  isActive: number;
  sortOrder: number;
  /** Roles whose every member has this workspace. */
  personas: SchoolRole[];
  /** Roles that land on it when nobody chose for them by name. */
  defaultRoles: SchoolRole[];
  buttons: number;
  users?: number;
}

export interface AssignedUser {
  user: string;
  name: string;
  persona: string;
  personaLabel: string;
  isDefault: boolean;
}

export interface WorkspaceDetail extends WorkspaceRow {
  layout: WsLayout;
  assigned: AssignedUser[];
}

export interface WorkspaceCatalog {
  pages: CustomPageRow[];
  cards: Array<{ key: string; label: string; personas: Role[] }>;
  personas: Array<{ key: SchoolRole; label: string }>;
}

export interface UserAssignment {
  user: string;
  name: string;
  persona: SchoolRole;
  personaLabel: string;
  workspaces: string[];
  /** Workspaces this person has through their role. */
  roleWorkspaces: string[];
  /** The workspace their role lands on, when none was chosen by name. */
  roleDefault: string;
  default: string;
  hideSystem: number;
}

const WS = ["workspaces"] as const;

export function useMyWorkspaces(enabled = true) {
  return useQuery<MyWorkspaces>({
    queryKey: [...WS, "mine"],
    queryFn: () => apiGet("workspaces.mine"),
    staleTime: 60_000,
    enabled,
  });
}

export function useWorkspaceList() {
  return useQuery<{ workspaces: WorkspaceRow[] }>({
    queryKey: [...WS, "list"],
    queryFn: () => apiGet("workspaces.list_workspaces"),
  });
}

export function useWorkspaceDetail(id: string | undefined) {
  return useQuery<WorkspaceDetail>({
    queryKey: [...WS, "detail", id ?? ""],
    queryFn: () => apiGet("workspaces.get_workspace", { workspace: id }),
    enabled: !!id,
  });
}

export function useWorkspaceCatalog() {
  return useQuery<WorkspaceCatalog>({
    queryKey: [...WS, "catalog"],
    queryFn: () => apiGet("workspaces.catalog"),
    staleTime: 60_000,
  });
}

export interface WorkspacePayload {
  id?: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  isActive: number;
  sortOrder: number;
  personas: SchoolRole[];
  defaultRoles: SchoolRole[];
  layout: WsLayout;
  assigned?: Array<{ user: string; isDefault: boolean }>;
}

export function useSaveWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkspacePayload) =>
      apiPost<WorkspaceDetail>("workspaces.save_workspace", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: WS }),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workspace: string) => apiPost("workspaces.delete_workspace", { workspace }),
    onSuccess: () => qc.invalidateQueries({ queryKey: WS }),
  });
}

export function useWorkspaceAssignments(search: string) {
  return useQuery<{ users: UserAssignment[] }>({
    queryKey: [...WS, "assignments", search],
    queryFn: () => apiGet("workspaces.assignments", { search }),
  });
}

export function useSaveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { user: string; workspaces: string[]; default: string; hideSystem: boolean }) =>
      apiPost("workspaces.save_assignment", {
        user: v.user,
        workspaces: v.workspaces,
        default: v.default,
        hide_system: v.hideSystem ? 1 : 0,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: WS }),
  });
}

export function useWorkspaceFromCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { category: string; title?: string }) =>
      apiPost<{ id: string; pagesCreated: number; pages: number }>("workspaces.from_category", v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: WS });
      void qc.invalidateQueries({ queryKey: PAGES });
    },
  });
}

export interface WorkspaceTemplate {
  key: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  roles: SchoolRole[];
  rolesLabel: string;
  buttons: number;
  /** A workspace by this name already exists. */
  exists: boolean;
}

export function useWorkspaceTemplates() {
  return useQuery<{ templates: WorkspaceTemplate[] }>({
    queryKey: [...WS, "templates"],
    queryFn: () => apiGet("workspaces.templates"),
  });
}

export function useWorkspaceFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => apiPost<{ id: string }>("workspaces.from_template", { key }),
    onSuccess: () => qc.invalidateQueries({ queryKey: WS }),
  });
}

// --- الصفحات --------------------------------------------------------------------

export interface CustomPageRow {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  isActive: number;
  template: string;
  templateTitle: string;
  category: string;
  categoryLabel: string;
  personas: Role[];
  entries: number;
}

export type FetchMode = "always" | "if_empty";

/** What one form field does on this page. */
export interface PageFieldRule {
  label?: string;
  hidden?: number;
  readOnly?: number;
  reqd?: number;
  width?: "half" | "full" | "third";
  default?: string;
  fetch?: { source: string; mode: FetchMode };
}

export interface PageConfig {
  fields: Record<string, PageFieldRule>;
  columns: string[];
  filters: string[];
  students: "any" | "subjects";
  showNotes: number;
  newLabel: string;
}

export interface CustomPageDef extends CustomPageRow {
  config: PageConfig;
  form: FormTemplate;
  entryFor: FormEntryFor;
  mayFill: boolean;
  mayDelete: boolean;
  canBuild: boolean;
  sourceLabels: Record<string, string>;
}

export interface FetchSource {
  key: string;
  label: string;
  group: string;
  needs: "student" | "section" | "context";
}

export interface PageBuilderOptions {
  templates: Array<{
    name: string;
    title: string;
    category: string;
    categoryLabel: string;
    entryFor: FormEntryFor;
    isActive: number;
    pages: string[];
  }>;
  categories: Array<{ key: string; label: string }>;
  sources: FetchSource[];
  builtinColumns: Array<{ key: string; label: string }>;
  fieldTypes: Record<string, string>;
}

export interface PageEntryRow {
  name: string;
  student: string | null;
  studentName: string;
  studentGroup: string;
  sectionLabel: string;
  status: string;
  filledBy: string;
  filledByName: string;
  filledOn: string;
  values: Record<string, string>;
}

export interface PageEntryFilters {
  status?: string;
  section?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  mine?: number;
  filters?: Record<string, string>;
}

const PAGES = ["custom-pages"] as const;

export function usePageList() {
  return useQuery<{ pages: CustomPageRow[] }>({
    queryKey: [...PAGES, "list"],
    queryFn: () => apiGet("custom_pages.list_pages"),
  });
}

export function usePageBuilderOptions() {
  return useQuery<PageBuilderOptions>({
    queryKey: [...PAGES, "builder-options"],
    queryFn: () => apiGet("custom_pages.builder_options"),
    staleTime: 60_000,
  });
}

export function useTemplateFields(template: string | undefined) {
  return useQuery<{
    template: string;
    title: string;
    fields: Array<{ fieldname: string; label: string; fieldtype: string }>;
  }>({
    queryKey: [...PAGES, "template-fields", template ?? ""],
    queryFn: () => apiGet("custom_pages.template_fields", { template }),
    enabled: !!template,
    staleTime: 60_000,
  });
}

export function suggestPageConfig(template: string) {
  return apiGet<{ config: PageConfig }>("custom_pages.suggest_config", { template });
}

export function useCustomPage(id: string | undefined) {
  return useQuery<CustomPageDef>({
    queryKey: [...PAGES, "def", id ?? ""],
    queryFn: () => apiGet("custom_pages.get_page", { page: id }),
    enabled: !!id,
  });
}

export interface PagePayload {
  id?: string;
  title: string;
  template: string;
  icon: string;
  color: string;
  description: string;
  isActive: number;
  personas: Role[];
  config: PageConfig;
}

export function useSavePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PagePayload) =>
      apiPost<CustomPageDef>("custom_pages.save_page", { payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PAGES });
      void qc.invalidateQueries({ queryKey: WS });
    },
  });
}

export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (page: string) => apiPost("custom_pages.delete_page", { page }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PAGES });
      void qc.invalidateQueries({ queryKey: WS });
    },
  });
}

export function usePageStudents(page: string, search: string, enabled = true) {
  return useQuery<{
    students: Array<{
      id: string;
      name: string;
      image: string | null;
      group: string | null;
      groupLabel: string;
    }>;
    subjectsCount?: number;
  }>({
    queryKey: [...PAGES, "students", page, search],
    queryFn: () => apiGet("custom_pages.students", { page, search, limit: 40 }),
    enabled: enabled && !!page,
    staleTime: 30_000,
  });
}

/** Values for the fields that fetch, for this student or section. */
export function fetchPageValues(
  page: string,
  subject: {
    student?: string | undefined;
    section?: string | undefined;
    entry?: string | undefined;
  },
) {
  return apiGet<{ values: Record<string, string>; section: string | null }>("custom_pages.fetch", {
    page,
    ...subject,
  });
}

export function usePageEntries(page: string | undefined, filters: PageEntryFilters) {
  return useQuery<{
    rows: PageEntryRow[];
    counts: Record<string, number>;
    total: number;
  }>({
    queryKey: [...PAGES, "entries", page ?? "", filters],
    queryFn: () =>
      apiGet("custom_pages.entries", {
        page,
        ...filters,
        ...(filters.filters && Object.keys(filters.filters).length
          ? { filters: filters.filters }
          : { filters: undefined }),
      }),
    enabled: !!page,
    placeholderData: (prev) => prev,
  });
}

export interface PageEntryPayload {
  name?: string;
  student?: string;
  studentGroup?: string | null;
  status: "مسودة" | "مكتمل";
  values: Record<string, string>;
  notes: string;
}

export function useSavePageEntry(page: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PageEntryPayload) =>
      apiPost<{ name: string; values: Record<string, string> }>("custom_pages.save_entry", {
        page,
        payload,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...PAGES, "entries", page] });
      void qc.invalidateQueries({ queryKey: ["form-entries"] });
    },
  });
}

export function invalidatePageEntries(qc: ReturnType<typeof useQueryClient>, page: string) {
  return qc.invalidateQueries({ queryKey: [...PAGES, "entries", page] });
}

/** React Query hooks wrapping the Match Schools API. */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { apiGet, apiPost, apiUpload } from "./client";
import type {
  AdminDashboard,
  AnnouncementRow,
  AssignmentRow,
  AttendanceReport,
  AttendanceSheet,
  ClassRow,
  ChildOverview,
  ExamRow,
  FeeList,
  GradeRow,
  MessageRow,
  MessageThread,
  Paginated,
  ParentDashboard,
  Session,
  StudentDashboard,
  StudentProfile,
  StudentRow,
  SubjectRow,
  TeacherDashboard,
  TeacherRow,
  Timetable,
} from "./types";

/**
 * Query params are built inline from optional UI state, so every field has to
 * accept `undefined` explicitly (the project uses exactOptionalPropertyTypes).
 */
type Opt<T> = { [K in keyof T]?: T[K] | undefined };

/** Central key registry so invalidation stays consistent. */
export const qk = {
  session: ["session"] as const,
  dashboard: ["dashboard"] as const,
  students: (params: unknown) => ["students", params] as const,
  student: (id: string) => ["student", id] as const,
  studentFilters: ["student-filters"] as const,
  classes: (params: unknown) => ["classes", params] as const,
  classStudents: (group: string) => ["class-students", group] as const,
  subjects: ["subjects"] as const,
  teachers: (search?: string) => ["teachers", search ?? ""] as const,
  timetable: (params: unknown) => ["timetable", params] as const,
  exams: (params: unknown) => ["exams", params] as const,
  grades: (params: unknown) => ["grades", params] as const,
  assignments: (params: unknown) => ["assignments", params] as const,
  submissions: (assignment: string) => ["submissions", assignment] as const,
  attendanceSheet: (group: string, date: string) => ["attendance-sheet", group, date] as const,
  attendanceReport: (params: unknown) => ["attendance-report", params] as const,
  myGroups: ["my-groups"] as const,
  fees: (params: unknown) => ["fees", params] as const,
  feeDetail: (id: string) => ["fee", id] as const,
  collection: ["fee-collection"] as const,
  announcements: ["announcements"] as const,
  inbox: ["inbox"] as const,
  thread: (id: string) => ["thread", id] as const,
  contacts: ["contacts"] as const,
};

// --- Session ---------------------------------------------------------------

export function useSession(options?: Partial<UseQueryOptions<Session>>) {
  return useQuery<Session>({
    queryKey: qk.session,
    queryFn: () => apiGet<Session>("auth.me"),
    // A 401 simply means "not signed in" — don't hammer the server.
    retry: false,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { email: string; password: string }) => apiPost<Session>("auth.login", vars),
    onSuccess: (session) => {
      qc.setQueryData(qk.session, session);
      qc.invalidateQueries();
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<null>("auth.logout"),
    onSuccess: () => {
      qc.clear();
    },
  });
}

// --- Dashboard -------------------------------------------------------------

export type AnyDashboard = AdminDashboard | TeacherDashboard | StudentDashboard | ParentDashboard;

export function useDashboard() {
  return useQuery<AnyDashboard>({
    queryKey: qk.dashboard,
    queryFn: () => apiGet<AnyDashboard>("dashboard.summary"),
  });
}

// --- Profile and personal preferences --------------------------------------

export interface MyProfile {
  profile: {
    user: string;
    email: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    image: string | null;
    persona: string;
    persona_label: string;
    last_login: string;
    linked: Record<string, unknown> | null;
  };
  preferences: Record<string, string>;
}

export function useMyProfile() {
  return useQuery<MyProfile>({
    queryKey: ["my-profile"],
    queryFn: () => apiGet<MyProfile>("settings.my_profile"),
  });
}

export function useSaveMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ user: string; preferences: Record<string, string> }>("settings.save_my_profile", {
        payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: qk.session });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (vars: { current_password: string; new_password: string }) =>
      apiPost<{ user: string }>("settings.change_password", vars),
  });
}

// --- Notifications ---------------------------------------------------------

export interface NotificationItem {
  id: string;
  category: string;
  category_label: string;
  title: string;
  body: string;
  time: string;
  tone: "danger" | "warning" | "info" | "success";
  link: string;
  ref: string;
  read: boolean;
  count?: number;
}

export interface NotificationFeed {
  items: NotificationItem[];
  unread: number;
  total: number;
}

/** The notification list. Refetched on an interval so the bell stays current. */
export function useNotifications(limit = 30, unreadOnly = false) {
  return useQuery<NotificationFeed>({
    queryKey: ["notifications", limit, unreadOnly],
    queryFn: () =>
      apiGet<NotificationFeed>("notifications.feed", {
        limit,
        ...(unreadOnly ? { unread_only: 1 } : {}),
      }),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { notification?: string; all?: boolean }) =>
      apiPost<{ read: number }>("notifications.mark_read", {
        ...(vars.notification ? { notification: vars.notification } : {}),
        ...(vars.all ? { all: 1 } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: qk.inbox });
    },
  });
}

/** Full picture of a single child, for the parent's focused view. */
export function useChildOverview(student: Opt<string>) {
  return useQuery<ChildOverview>({
    queryKey: ["child-overview", student],
    queryFn: () => apiGet<ChildOverview>("dashboard.child_overview", { student: student! }),
    enabled: Boolean(student),
  });
}

// --- Mail -----------------------------------------------------------------

export interface MailRecipient {
  user: string;
  name: string;
  kind: "to" | "cc" | "bcc";
}

export interface MailMessage {
  id: string;
  subject: string;
  thread: string | null;
  sender: string;
  sender_name: string;
  sent_on: string;
  is_draft: boolean;
  reply_to: string | null;
  about_student: string | null;
  recipients: MailRecipient[];
  attachments: Array<{ file_url: string; file_name: string | null; file_size: number }>;
  outgoing: boolean;
  preview?: string;
  body?: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  my_kind: string | null;
  /** Set when the message went to an audience rather than named people. */
  audience_key: string | null;
  audience_label: string | null;
  audience_count: number;
  /** Set when the sender closed the message to replies. */
  no_reply: boolean;
  copy_guardians: boolean;
  /** Non-empty while the message is waiting for its send time. */
  scheduled_for: string;
  is_scheduled: boolean;
  send_failed_reason: string | null;
  thread_messages?: MailMessage[];
}

export function useMailFolders() {
  return useQuery<{
    unread: number;
    counts: Record<string, number>;
    folders: Array<{ key: string; label: string; count: number }>;
  }>({
    queryKey: ["mail-folders"],
    queryFn: () => apiGet("mail.folders"),
    // The envelope badge has to notice new mail without a reload.
    refetchInterval: 60_000,
  });
}

export function useMailList(folder: string, search?: string, unreadOnly?: boolean) {
  return useQuery<{
    messages: MailMessage[];
    folder: string;
    folder_label: string;
    total: number;
  }>({
    queryKey: ["mail-list", folder, search ?? "", unreadOnly ?? false],
    queryFn: () =>
      apiGet("mail.list_messages", {
        folder,
        ...(search ? { search } : {}),
        ...(unreadOnly ? { unread_only: 1 } : {}),
      }),
  });
}

export function useMailMessage(message: string | undefined) {
  return useQuery<MailMessage>({
    queryKey: ["mail-message", message ?? null],
    queryFn: () => apiGet<MailMessage>("mail.get_message", { message: message! }),
    enabled: Boolean(message),
  });
}

export function useSendMail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      message?: string;
      subject?: string;
      body?: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      audience?: string;
      audience_groups?: string[];
      reply_to?: string;
      is_draft?: number;
      no_reply?: number;
      copy_guardians?: number;
      /** "YYYY-MM-DD HH:mm:ss"; empty or absent means send now. */
      scheduled_for?: string;
      attachments?: Array<{ file_url: string; file_name?: string; file_size?: number }>;
    }) =>
      apiPost<{ id: string; is_draft: boolean; recipients: number; message_ar?: string }>(
        "mail.save_message",
        { payload: vars } as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mail-list"] });
      void qc.invalidateQueries({ queryKey: ["mail-folders"] });
    },
  });
}

export function useMailFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      message: string;
      is_read?: number;
      is_starred?: number;
      is_archived?: number;
      is_deleted?: number;
    }) => apiPost<{ id: string }>("mail.set_flags", vars as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mail-list"] });
      void qc.invalidateQueries({ queryKey: ["mail-folders"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ marked: number; message_ar?: string }>("mail.mark_all_read", {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mail-list"] });
      void qc.invalidateQueries({ queryKey: ["mail-folders"] });
    },
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { message: string }) =>
      apiPost<{ deleted: string; message_ar?: string }>(
        "mail.delete_draft",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mail-list"] });
      void qc.invalidateQueries({ queryKey: ["mail-folders"] });
    },
  });
}

export interface RecipientResult {
  user: string;
  name: string;
  email: string;
  record: string | null;
  national_id: string | null;
  kind: string | null;
  image: string | null;
}

export interface MailAudience {
  key: string;
  label: string;
  scope: "mine" | "all";
  kind: string;
}

export function useMyAudiences() {
  return useQuery<{
    audiences: MailAudience[];
    groups: Array<{ id: string; label: string }>;
  }>({
    queryKey: ["mail-audiences"],
    queryFn: () => apiGet("mail_policy.my_audiences"),
  });
}

export function useMailPolicy() {
  return useQuery<{
    roles: Array<{ key: string; label: string; allowed: string[] }>;
    audiences: Array<{ key: string; label: string; scope: string; kind: string }>;
  }>({
    queryKey: ["mail-policy"],
    queryFn: () => apiGet("mail_policy.get_settings"),
  });
}

export function useSaveMailPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (policy: Record<string, string[]>) =>
      apiPost<{ saved: boolean; message_ar?: string }>("mail_policy.save_settings", {
        payload: { policy },
      } as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mail-policy"] });
      void qc.invalidateQueries({ queryKey: ["mail-audiences"] });
    },
  });
}

export function useRecipientSearch(q: string) {
  return useQuery<{ results: RecipientResult[] }>({
    queryKey: ["mail-recipients", q],
    queryFn: () => apiGet("mail.search_recipients", q ? { q } : {}),
  });
}

export function useRecipientGroups() {
  return useQuery<{
    groups: Array<{ key: string; label: string; count: number; users: string[] }>;
  }>({
    queryKey: ["mail-groups"],
    queryFn: () => apiGet("mail.recipient_groups"),
  });
}

// --- Print requests --------------------------------------------------------

export interface PrintAttachment {
  file_url: string;
  file_name: string | null;
  file_size: number;
  pages: number;
}

export interface PrintRequestRow {
  id: string;
  title: string;
  document_type: string;
  type_label: string;
  status: string;
  status_label: string;
  status_tone: string;
  priority: string;
  urgent: boolean;
  needed_by: string;
  student_group: string | null;
  course: string | null;
  copies: number;
  notes: string | null;
  secretary_notes: string | null;
  requested_by: string;
  requested_by_name: string | null;
  requested_on: string;
  handled_by_name: string | null;
  completed_on: string;
  can_edit: boolean;
  can_handle: boolean;
  attachments: PrintAttachment[];
}

export function usePrintRequests(status?: string) {
  return useQuery<{
    requests: PrintRequestRow[];
    counts: Record<string, number>;
    statuses: Array<{ value: string; label: string; tone: string }>;
    types: Array<{ value: string; label: string }>;
  }>({
    queryKey: ["print-requests", status ?? "all"],
    queryFn: () => apiGet("print_requests.list_requests", status ? { status } : {}),
  });
}

export function useSavePrintRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      request?: string;
      title?: string;
      document_type?: string;
      priority?: string;
      needed_by?: string;
      student_group?: string;
      course?: string;
      copies?: number;
      notes?: string;
      attachments?: Array<{ file_url: string; file_name?: string; file_size?: number }>;
    }) =>
      apiPost<{ id: string; status: string; message_ar?: string }>("print_requests.save_request", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["print-requests"] }),
  });
}

export function useSetPrintStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { request: string; status: string; notes?: string }) =>
      apiPost<{ id: string; status: string; label: string; message_ar?: string }>(
        "print_requests.set_status",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["print-requests"] }),
  });
}

export function useDeletePrintRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { request: string }) =>
      apiPost<{ deleted: string; message_ar?: string }>(
        "print_requests.delete_request",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["print-requests"] }),
  });
}

// --- Community -------------------------------------------------------------

export interface CommunityPost {
  id: string;
  title: string;
  body: string | null;
  post_type: string;
  type_label: string;
  audience: string;
  audience_label: string;
  student_group: string | null;
  class_name: string | null;
  /** The subject this post belongs to, if it belongs to one. */
  course: string | null;
  course_name: string | null;
  student: string | null;
  student_name: string | null;
  /** The grade a «صف كامل» post is addressed to. */
  program?: string | null;
  /** The students a «طلاب محدّدون» post is addressed to. */
  audience_students?: Array<{ student: string; student_name: string | null }>;
  author_name: string | null;
  posted_on: string;
  is_published: boolean;
  allow_comments: boolean;
  pinned: boolean;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  can_edit: boolean;
  photos: Array<{ file_url: string; caption: string | null }>;
}

export interface PostComment {
  id: string;
  body: string;
  author: string;
  author_name: string | null;
  posted_on: string;
  parent_comment: string | null;
  is_hidden: boolean;
  can_delete: boolean;
  can_hide: boolean;
}

export function useCommunityFeed(studentGroup?: string, course?: string) {
  return useQuery<{ posts: CommunityPost[]; can_post: boolean }>({
    queryKey: ["community-feed", studentGroup ?? null, course ?? null],
    queryFn: () =>
      apiGet("community.feed", {
        ...(studentGroup ? { student_group: studentGroup } : {}),
        ...(course ? { course } : {}),
      }),
  });
}

export interface FeedChannel {
  key: string;
  label: string;
  count: number;
  /** "all" | "general" | "course" */
  kind: string;
}

/**
 * What this reader's feed divides into.
 *
 * A pupil takes eight subjects and each has its own stream. One wall means the
 * maths post scrolls past while they are looking for it.
 */
export function useCommunityChannels() {
  return useQuery<{ channels: FeedChannel[] }>({
    queryKey: ["community-channels"],
    queryFn: () => apiGet("community.channels"),
    staleTime: 60_000,
  });
}

export function useCommunityPost(post: string | undefined) {
  return useQuery<CommunityPost & { comments: PostComment[] }>({
    queryKey: ["community-post", post ?? null],
    queryFn: () => apiGet("community.get_post", { post: post! }),
    enabled: Boolean(post),
  });
}

export function useSavePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      post?: string;
      title?: string;
      body?: string;
      post_type?: string;
      audience?: string;
      student_group?: string;
      student?: string;
      program?: string;
      /** «طلاب محدّدون»: the students addressed by name. */
      students?: string[];
      is_published?: number;
      allow_comments?: number;
      pinned?: number;
      photos?: Array<{ file_url: string; caption?: string }>;
    }) =>
      apiPost<{ id: string; message_ar?: string }>("community.save_post", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { post: string }) =>
      apiPost<{ deleted: string; message_ar?: string }>(
        "community.delete_post",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-feed"] }),
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { post: string }) =>
      apiPost<{ liked: boolean; like_count: number }>(
        "community.toggle_like",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-feed"] });
      void qc.invalidateQueries({ queryKey: ["community-post"] });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { post: string; body: string; parent_comment?: string }) =>
      apiPost<{ id: string; comment_count: number; message_ar?: string }>(
        "community.add_comment",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-feed"] });
      void qc.invalidateQueries({ queryKey: ["community-post"] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { comment: string }) =>
      apiPost<{ deleted: string; comment_count: number; message_ar?: string }>(
        "community.delete_comment",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["community-feed"] });
      void qc.invalidateQueries({ queryKey: ["community-post"] });
    },
  });
}

export function useHideComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { comment: string; hidden: number; reason?: string }) =>
      apiPost<{ id: string; hidden: boolean; message_ar?: string }>(
        "community.hide_comment",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["community-post"] }),
  });
}

// --- Gallery ---------------------------------------------------------------

export interface GalleryAlbumRow {
  id: string;
  title: string;
  student_group: string;
  class_name: string;
  event_date: string;
  description: string | null;
  cover_image: string | null;
  photo_count: number;
  is_published: boolean;
  academic_year: string | null;
  academic_term: string | null;
}

export interface GalleryPhoto {
  file_url: string;
  caption: string | null;
  file_name: string | null;
  sort_order: number;
}

export interface GalleryAlbum extends GalleryAlbumRow {
  can_manage: boolean;
  photos: GalleryPhoto[];
}

export function useGalleryAlbums(studentGroup: string | undefined) {
  return useQuery<{ albums: GalleryAlbumRow[]; can_manage: boolean }>({
    queryKey: ["gallery-albums", studentGroup ?? null],
    queryFn: () =>
      apiGet("gallery.list_albums", studentGroup ? { student_group: studentGroup } : {}),
  });
}

export function useGalleryAlbum(album: string | undefined) {
  return useQuery<GalleryAlbum>({
    queryKey: ["gallery-album", album ?? null],
    queryFn: () => apiGet<GalleryAlbum>("gallery.get_album", { album: album! }),
    enabled: Boolean(album),
  });
}

export function useSaveAlbum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      album?: string;
      student_group?: string;
      title?: string;
      event_date?: string;
      description?: string;
      is_published?: number;
      cover_image?: string;
      photos?: Array<{
        file_url: string;
        caption?: string;
        file_name?: string;
        sort_order?: number;
      }>;
    }) =>
      apiPost<{ id: string; photo_count: number; message_ar?: string }>("gallery.save_album", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery-albums"] }),
  });
}

export function useDeleteAlbum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { album: string }) =>
      apiPost<{ deleted: string; message_ar?: string }>(
        "gallery.delete_album",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery-albums"] }),
  });
}

// --- Promotion -------------------------------------------------------------

export interface PromotionBlocker {
  check: string;
  label: string;
  detail?: string;
  value?: number;
}

export interface PromotionPreview {
  program: string;
  classes: Array<{ name: string; class_name: string }>;
  next_program: string | null;
  next_program_missing: boolean;
  academic_year: string;
  academic_term: string | null;
  marks_ready: boolean;
  pending_courses: string[];
  students: Array<{
    student: string;
    student_name: string;
    student_group: string;
    class_name: string;
    eligible: boolean;
    blockers: PromotionBlocker[];
  }>;
  total: number;
  eligible_count: number;
  blocked_count: number;
}

export interface PromotionRule {
  key: string;
  label: string;
  help: string;
  enabled: number;
  max_outstanding?: number;
  min_average?: number;
  min_attendance?: number;
  max_failed?: number;
}

export function usePromotionRules() {
  return useQuery<{ rules: PromotionRule[] }>({
    queryKey: ["promotion-rules"],
    queryFn: () => apiGet("promotion.get_rules"),
  });
}

export function useSavePromotionRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rules: Record<string, Partial<PromotionRule>>) =>
      apiPost<{ saved: boolean; message_ar?: string }>("promotion.save_rules", {
        payload: { rules },
      } as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotion-rules"] }),
  });
}

export interface PromotionOptions {
  programs: Array<{ id: string; name: string; level: number; next_program: string | null }>;
  years: string[];
  terms: Array<{ id: string; name: string; academic_year: string }>;
  default_year: string | null;
  default_term: string | null;
}

export function usePromotionOptions() {
  return useQuery<PromotionOptions>({
    queryKey: ["promotion-options"],
    queryFn: () => apiGet("promotion.options"),
  });
}

export function usePromotionPreview(params: {
  program?: string;
  academic_year?: string;
  academic_term?: string;
}) {
  return useQuery<PromotionPreview>({
    queryKey: ["promotion-preview", params],
    // A promotion is always read within one year and term; without both the
    // preview would mix cohorts.
    queryFn: () => apiGet<PromotionPreview>("promotion.preview", params as Record<string, string>),
    enabled: Boolean(params.program && params.academic_year && params.academic_term),
  });
}

export function usePromote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      program: string;
      students: string[];
      academic_year: string;
      academic_term: string;
      new_academic_year: string;
      /** Required: a record without a term cannot be told from the other term's. */
      new_academic_term: string;
      new_program?: string;
      new_batch?: string;
      override?: number;
      override_reason?: string;
    }) =>
      apiPost<{
        promoted: Array<{ student_name: string; enrollment: string }>;
        skipped: Array<{ student_name: string; reason: string }>;
        promoted_count: number;
        skipped_count: number;
        message_ar?: string;
      }>("promotion.promote", { payload: vars } as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useMarkRepeated() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student: string; student_group: string; notes?: string }) =>
      apiPost<{ enrollment: string; message_ar?: string }>(
        "promotion.mark_repeated",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- Lesson plans ----------------------------------------------------------

export interface LessonPlanView {
  course_schedule: string;
  student_group: string;
  class_name: string;
  program: string | null;
  batch: string | null;
  course: string;
  teacher: string | null;
  date: string;
  can_edit: boolean;
  plan: {
    id: string;
    title: string | null;
    objectives: string | null;
    content: string | null;
    homework: string | null;
    resources: string | null;
    notes?: string | null;
    is_published: boolean;
    prepared_on: string;
  } | null;
}

export function useLessonPlan(courseSchedule: string | undefined) {
  return useQuery<LessonPlanView>({
    queryKey: ["lesson-plan", courseSchedule ?? null],
    queryFn: () =>
      apiGet<LessonPlanView>("lesson_plans.get_lesson_plan", {
        course_schedule: courseSchedule!,
      }),
    enabled: Boolean(courseSchedule),
  });
}

export function useSaveLessonPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      course_schedule: string;
      title?: string;
      objectives?: string;
      content?: string;
      homework?: string;
      resources?: string;
      notes?: string;
      is_published?: number;
    }) =>
      apiPost<{ id: string; course_schedule: string; message_ar?: string }>(
        "lesson_plans.save_lesson_plan",
        { payload: vars } as unknown as Record<string, unknown>,
      ),
    // The timetable's markers come from the same data, so both refresh.
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteLessonPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { course_schedule: string }) =>
      apiPost<{ deleted: boolean; message_ar?: string }>(
        "lesson_plans.delete_lesson_plan",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- Students --------------------------------------------------------------

export interface StudentListParams {
  search?: string | undefined;
  program?: string | undefined;
  batch?: string | undefined;
  /** Narrow to one section — used by screens opened from a class. */
  student_group?: string | undefined;
  payment_status?: string | undefined;
  /** "active" (default), "left", or "all". */
  enrolment_status?: string | undefined;
  page?: number | undefined;
  page_size?: number | undefined;
  [key: string]: unknown;
}

export function useStudents(params: StudentListParams = {}) {
  return useQuery<Paginated<StudentRow>>({
    queryKey: qk.students(params),
    queryFn: () => apiGet<Paginated<StudentRow>>("students.list_students", params),
    placeholderData: (prev) => prev,
  });
}

export function useStudent(id: string | undefined) {
  return useQuery<StudentProfile>({
    queryKey: qk.student(id ?? ""),
    queryFn: () => apiGet<StudentProfile>("students.get_student", { student: id }),
    enabled: Boolean(id),
  });
}

export function useStudentFilters() {
  return useQuery<{
    grades: string[];
    sections: string[];
    statuses: Array<{ value: string; label: string }>;
  }>({
    queryKey: qk.studentFilters,
    queryFn: () => apiGet("students.filter_options"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSaveStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; name: string }>("students.save_student", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

// --- Academics -------------------------------------------------------------

export function useClasses(
  params: Opt<{
    program: string;
    academic_year: string;
    academic_term: string;
    batch: string;
    search: string;
  }> = {},
) {
  return useQuery<ClassRow[]>({
    queryKey: qk.classes(params),
    queryFn: () => apiGet<ClassRow[]>("academics.list_classes", params),
  });
}

export function useClassStudents(group: string | undefined) {
  return useQuery<Array<{ id: string; name: string; roll_number: number | null }>>({
    queryKey: qk.classStudents(group ?? ""),
    queryFn: () => apiGet("academics.class_students", { student_group: group }),
    enabled: Boolean(group),
  });
}

export function useSubjects(
  params: {
    search?: string;
    department?: string;
    program?: string;
    /** Narrows to the subjects taught in this class — and, for a teacher, to
     *  the ones they teach in it. */
    student_group?: string;
  } = {},
) {
  return useQuery<SubjectRow[]>({
    queryKey: ["subjects", params],
    queryFn: () =>
      apiGet<SubjectRow[]>(
        "academics.list_subjects",
        Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useClassFilterOptions() {
  return useQuery<{
    programs: string[];
    academicYears: string[];
    academicTerms: string[];
    batches: string[];
  }>({
    queryKey: ["class-filter-options"],
    queryFn: () => apiGet("academics.class_filter_options"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubjectFilterOptions() {
  return useQuery<{ departments: string[]; programs: string[] }>({
    queryKey: ["subject-filter-options"],
    queryFn: () => apiGet("academics.subject_filter_options"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGuardianFilterOptions() {
  return useQuery<{
    occupations: string[];
    loginStates: Array<{ value: string; label: string }>;
  }>({
    queryKey: ["guardian-filter-options"],
    queryFn: () => apiGet("students.guardian_filter_options"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeachers(
  params: {
    search?: string;
    department?: string;
    status?: string;
    gender?: string;
    student_group?: string;
  } = {},
) {
  return useQuery<TeacherRow[]>({
    queryKey: ["teachers", params],
    queryFn: () =>
      apiGet<TeacherRow[]>(
        "academics.list_teachers",
        Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useTeacherFilterOptions() {
  return useQuery<{
    departments: string[];
    statuses: string[];
    genders: string[];
    groups: Array<{ name: string; student_group_name: string }>;
  }>({
    queryKey: ["teacher-filter-options"],
    queryFn: () => apiGet("academics.teacher_filter_options"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTimetable(
  params: Opt<{
    student_group: string;
    instructor: string;
    student: string;
    week_start: string;
  }> = {},
) {
  return useQuery<Timetable>({
    queryKey: qk.timetable(params),
    queryFn: () => apiGet<Timetable>("academics.timetable", params),
  });
}

export function useExams(params: Opt<{ academic_term: string; program: string }> = {}) {
  return useQuery<ExamRow[]>({
    queryKey: qk.exams(params),
    queryFn: () => apiGet<ExamRow[]>("academics.list_exams", params),
  });
}

export function useGrades(
  params: Opt<{ student: string; student_group: string; course: string }> = {},
) {
  return useQuery<GradeRow[]>({
    queryKey: qk.grades(params),
    queryFn: () => apiGet<GradeRow[]>("academics.list_grades", params),
  });
}

// --- Attendance ------------------------------------------------------------

/** Staff-only: students and parents get a 403, so pass enabled:false. */
export function useMyGroups(enabled = true) {
  return useQuery<ClassRow[]>({
    queryKey: qk.myGroups,
    queryFn: () => apiGet<ClassRow[]>("attendance.my_groups"),
    enabled,
  });
}

export function useAttendanceSheet(group: string | undefined, date: string, enabled = true) {
  return useQuery<AttendanceSheet>({
    queryKey: qk.attendanceSheet(group ?? "", date),
    queryFn: () =>
      apiGet<AttendanceSheet>("attendance.get_group_sheet", {
        student_group: group,
        date,
      }),
    enabled: enabled && Boolean(group),
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      date: string;
      entries: Array<{ student: string; status: string; reason?: string }>;
    }) =>
      apiPost<{ created: number; updated: number; unchanged: number }>(
        "attendance.mark_attendance",
        vars,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.attendanceSheet(vars.student_group, vars.date) });
      qc.invalidateQueries({ queryKey: ["attendance-report"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/**
 * Correct one pupil without rewriting the register for the whole class.
 *
 * Marking a class is a batch; fixing a mistake is not. Sending the whole sheet
 * to change one child cancelled and re-created every other record in it.
 */
export function useMarkOneAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student: string; student_group: string; date: string; status: string }) =>
      apiPost<{ student: string; status: string; result: string }>(
        "attendance.mark_one",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.attendanceSheet(vars.student_group, vars.date) });
      qc.invalidateQueries({ queryKey: ["attendance-report"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useAttendanceReport(
  params: Opt<{ student: string; student_group: string; from_date: string; to_date: string }> = {},
) {
  return useQuery<AttendanceReport>({
    queryKey: qk.attendanceReport(params),
    queryFn: () => apiGet<AttendanceReport>("attendance.attendance_report", params),
  });
}

// --- Assignments -----------------------------------------------------------

export function useAssignments(
  params: Opt<{ student_group: string; course: string; status: string; student: string }> = {},
) {
  return useQuery<AssignmentRow[]>({
    queryKey: qk.assignments(params),
    queryFn: () => apiGet<AssignmentRow[]>("assignments.list_assignments", params),
  });
}

export function useSaveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string }>("assignments.save_assignment", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useSubmissions(assignment: string | undefined) {
  return useQuery<{
    assignment: {
      id: string;
      title: string;
      subject: string;
      due: string;
      max: number;
      student_group: string;
    };
    rows: Array<{
      student: string;
      student_name: string;
      submission_id: string | null;
      status: string;
      status_raw: string | null;
      score: number | null;
      submitted_on: string | null;
      feedback: string | null;
      content: string | null;
      files: SubmissionFile[];
    }>;
    submitted: number;
    total: number;
  }>({
    queryKey: qk.submissions(assignment ?? ""),
    queryFn: () => apiGet("assignments.submissions", { assignment }),
    enabled: Boolean(assignment),
  });
}

export interface SubmissionFile {
  file_url: string;
  file_name: string;
  file_size?: number;
}

export interface SubmissionDetail {
  assignment: {
    id: string;
    title: string;
    description: string | null;
    due: string;
    max: number;
    status: string;
    course: string;
    files: SubmissionFile[];
  };
  submission: {
    id: string;
    status: string;
    status_label: string;
    content: string | null;
    submitted_on: string;
    score: number | null;
    feedback: string | null;
    files: SubmissionFile[];
  } | null;
}

/** One assignment plus the viewer's own submission — powers the submit dialog. */
export function useSubmission(assignment: Opt<string>, student?: Opt<string>) {
  return useQuery({
    queryKey: ["submission", assignment, student ?? null],
    queryFn: () =>
      apiGet<SubmissionDetail>("assignments.get_submission", {
        assignment: assignment!,
        ...(student ? { student } : {}),
      }),
    enabled: Boolean(assignment),
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      assignment: string;
      content?: string;
      attachment?: string;
      files?: SubmissionFile[];
    }) =>
      apiPost<{ id: string; status: string; status_label: string; files: number }>(
        "assignments.submit_assignment",
        vars,
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["submission", vars.assignment] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useGradeSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      submission?: string;
      assignment?: string;
      student?: string;
      score: number;
      feedback?: string;
    }) => apiPost<{ id: string; score: number }>("assignments.grade_submission", vars),
    onSuccess: (_d, vars) => {
      if (vars.assignment) {
        qc.invalidateQueries({ queryKey: qk.submissions(vars.assignment) });
      }
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
  });
}

// --- Fees ------------------------------------------------------------------

export interface FeeFilterOptions {
  programs: string[];
  academicYears: string[];
  academicTerms: string[];
  statuses: Array<{ value: string; label: string }>;
}

export function useFees(
  params: Opt<{
    student: string;
    program: string;
    status: string;
    academic_year: string;
    academic_term: string;
    date_from: string;
    date_to: string;
    due_from: string;
    due_to: string;
    page: number;
    page_size: number;
  }> = {},
) {
  return useQuery<FeeList>({
    queryKey: qk.fees(params),
    queryFn: () => apiGet<FeeList>("fees.list_fees", params),
    placeholderData: (prev) => prev,
  });
}

/** Admin-only: other personas get a 403, so pass enabled:false for them. */
export function useFeeCollection(months = 6, enabled = true) {
  return useQuery<{
    months: Array<{ month: string; expected: number; collected: number }>;
    by_status: Array<{ status: string; label: string; count: number }>;
  }>({
    queryKey: [...qk.collection, months],
    queryFn: () => apiGet("fees.collection_report", { months }),
    enabled,
  });
}

// --- Communication ---------------------------------------------------------

export function useAnnouncements(limit = 25) {
  return useQuery<AnnouncementRow[]>({
    queryKey: [...qk.announcements, limit],
    queryFn: () => apiGet<AnnouncementRow[]>("communication.list_announcements", { limit }),
  });
}

export function useSaveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string }>("communication.save_announcement", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.announcements });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (announcement: string) =>
      apiPost<{ id: string }>("communication.delete_announcement", { announcement }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.announcements });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useInbox(limit = 50, student?: string) {
  return useQuery<MessageRow[]>({
    queryKey: [...qk.inbox, limit, student ?? "all"],
    queryFn: () =>
      apiGet<MessageRow[]>("communication.inbox", {
        limit,
        ...(student ? { student } : {}),
      }),
  });
}

export function useThread(thread: string | undefined) {
  return useQuery<MessageThread>({
    queryKey: qk.thread(thread ?? ""),
    queryFn: () => apiGet<MessageThread>("communication.thread", { thread }),
    enabled: Boolean(thread),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      recipient: string;
      body: string;
      subject?: string;
      thread?: string;
      about_student?: string;
    }) => apiPost<{ id: string; thread: string }>("communication.send_message", vars),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.inbox });
      if (data?.thread) qc.invalidateQueries({ queryKey: qk.thread(data.thread) });
    },
  });
}

export function useContacts() {
  return useQuery<Array<{ user: string; name: string; role: string }>>({
    queryKey: qk.contacts,
    queryFn: () => apiGet("communication.contacts"),
  });
}

// --- Reports ---------------------------------------------------------------

export interface ReportsOverview {
  academic: {
    by_subject: Array<{ subject: string; average: number; results: number }>;
    by_grade: Array<{ grade: string; average: number; students: number }>;
    top_students: Array<{ student: string; student_name: string; average: number }>;
  };
  attendance: {
    monthly: Array<{ month: string; rate: number; present: number; absent: number }>;
    by_group: Array<{ student_group: string; rate: number; total: number }>;
    overall: number;
  };
  financial: {
    monthly: Array<{ month: string; expected: number; collected: number }>;
    by_program: Array<{
      program: string;
      total: number;
      collected: number;
      outstanding: number;
      invoices: number;
    }>;
    totals: { total: number; collected: number; outstanding: number; collection_rate: number };
  } | null;
  academic_year: string | null;
}

export function useReports() {
  return useQuery<ReportsOverview>({
    queryKey: ["reports"],
    queryFn: () => apiGet<ReportsOverview>("reports.overview"),
  });
}

// --- Settings --------------------------------------------------------------

export interface SchoolSettings {
  school: {
    company: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    currency: string | null;
  };
  academic: {
    current_year: string | null;
    current_term: string | null;
    years: Array<{ name: string; year_start_date: string; year_end_date: string }>;
    terms: Array<{
      name: string;
      academic_year: string;
      term_start_date: string;
      term_end_date: string;
    }>;
  };
  roles: Array<{ persona: string; role: string; label: string; users: number }>;
  policies: { student_open_messaging: boolean };
  counts: Record<string, number>;
}

/** School-wide messaging policy: may students write outside their teachers? */
export function useSetOpenMessaging() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      apiPost<{ student_open_messaging: boolean }>("messaging.set_open_messaging", {
        enabled: enabled ? 1 : 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["audience"] });
    },
  });
}

export function useSettings() {
  return useQuery<SchoolSettings>({
    queryKey: ["settings"],
    queryFn: () => apiGet<SchoolSettings>("settings.get_settings"),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ updated: string[] }>("settings.save_settings", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: qk.session });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

// --- Wellbeing: health and behaviour ---------------------------------------

export interface HealthVisit {
  id: string;
  date: string;
  type: string;
  type_raw: string;
  complaint: string | null;
  treatment: string | null;
  outcome: string;
  parent_notified: boolean;
}

export interface HealthProfile {
  student: string;
  student_name: string | null;
  record: {
    name: string;
    blood_group: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    chronic_conditions: string | null;
    allergies: string | null;
    medications: string | null;
    special_needs: string | null;
    immunisations: string | null;
    last_checkup: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    physician_name: string | null;
    physician_phone: string | null;
    notes: string | null;
  } | null;
  visits: HealthVisit[];
}

export function useHealthRecord(student: string | undefined) {
  return useQuery<HealthProfile>({
    queryKey: ["health", student ?? ""],
    queryFn: () => apiGet<HealthProfile>("wellbeing.get_health_record", { student }),
    enabled: Boolean(student),
  });
}

export function useSaveHealthRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("wellbeing.save_health_record", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health"] }),
  });
}

export function useSaveHealthVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("wellbeing.save_health_visit", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health"] }),
  });
}

export function useDeleteHealthVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visit: string) =>
      apiPost<{ id: string }>("wellbeing.delete_health_visit", { visit }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health"] }),
  });
}

export interface BehaviourRow {
  id: string;
  student: string;
  student_name: string;
  date: string;
  type: string;
  type_raw: string;
  points: number;
  category: string | null;
  student_group: string | null;
  description: string | null;
  action_taken: string | null;
  parent_notified: boolean;
}

export interface BehaviourList extends Paginated<BehaviourRow> {
  summary: { positive: number; negative: number; net_points: number };
}

export function useBehaviour(
  params: Opt<{
    filters: Record<string, unknown>;
    page: number;
    page_size: number;
    sort_field: string;
    sort_order: string;
  }> = {},
) {
  return useQuery<BehaviourList>({
    queryKey: ["behaviour", params],
    queryFn: () => apiGet<BehaviourList>("wellbeing.list_behaviour", params),
    placeholderData: (prev) => prev,
  });
}

export function useSaveBehaviour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; points: number }>("wellbeing.save_behaviour", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["behaviour"] }),
  });
}

export function useDeleteBehaviour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: string) =>
      apiPost<{ id: string }>("wellbeing.delete_behaviour", { record }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["behaviour"] }),
  });
}

export function useBehaviourSummary(student: string | undefined) {
  return useQuery<{
    student: string;
    positive: number;
    negative: number;
    net_points: number;
    by_category: Array<{ category: string; count: number; points: number }>;
  }>({
    queryKey: ["behaviour-summary", student ?? ""],
    queryFn: () => apiGet("wellbeing.behaviour_summary", { student }),
    enabled: Boolean(student),
  });
}

// --- Resources: library and transport --------------------------------------

export interface BookRow {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  language: string | null;
  publisher: string | null;
  published_year: number | null;
  shelf: string | null;
  total_copies: number;
  available_copies: number;
  cover_image: string | null;
}

export function useBooks(
  params: Opt<{
    filters: Record<string, unknown>;
    page: number;
    page_size: number;
    sort_field: string;
    sort_order: string;
  }> = {},
) {
  return useQuery<Paginated<BookRow>>({
    queryKey: ["books", params],
    queryFn: () => apiGet<Paginated<BookRow>>("resources.list_books", params),
    placeholderData: (prev) => prev,
  });
}

export function useSaveBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("resources.save_book", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["books"] }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (book: string) => apiPost<{ id: string }>("resources.delete_book", { book }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["books"] }),
  });
}

export interface LoanRow {
  id: string;
  book: string;
  book_title: string;
  student: string;
  student_name: string;
  status: string;
  status_raw: string;
  issue_date: string;
  due_date: string;
  return_date: string;
  notes: string | null;
}

export function useLoans(
  params: Opt<{
    filters: Record<string, unknown>;
    page: number;
    page_size: number;
    sort_field: string;
    sort_order: string;
  }> = {},
) {
  return useQuery<Paginated<LoanRow> & { summary: Record<string, number> }>({
    queryKey: ["loans", params],
    queryFn: () => apiGet("resources.list_loans", params),
    placeholderData: (prev) => prev,
  });
}

export function useIssueBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("resources.issue_book", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useReturnBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { loan: string; status?: string }) =>
      apiPost<{ id: string; status: string }>("resources.return_book", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export interface RouteRow {
  id: string;
  route_name: string;
  vehicle_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  capacity: number;
  assigned: number;
  seats_left: number;
  departure_time: string;
  return_time: string;
  active: boolean;
  monthly_fee: number;
  stops: string[];
}

export function useRoutes(filters?: Record<string, unknown>) {
  return useQuery<RouteRow[]>({
    queryKey: ["routes", filters ?? {}],
    queryFn: () => apiGet<RouteRow[]>("resources.list_routes", { filters }),
  });
}

export function useSaveRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("resources.save_route", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (route: string) => apiPost<{ id: string }>("resources.delete_route", { route }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export interface TransportAssignmentRow {
  id: string;
  student: string;
  student_name: string;
  route: string;
  route_name: string | null;
  stop: string | null;
  active: boolean;
  start_date: string;
  end_date: string;
  notes: string | null;
}

export function useTransportAssignments(
  params: Opt<{ filters: Record<string, unknown>; page: number; page_size: number }> = {},
) {
  return useQuery<Paginated<TransportAssignmentRow>>({
    queryKey: ["transport", params],
    queryFn: () => apiGet("resources.list_transport_assignments", params),
    placeholderData: (prev) => prev,
  });
}

export function useSaveTransportAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("resources.save_transport_assignment", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport"] });
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

export function useDeleteTransportAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignment: string) =>
      apiPost<{ id: string }>("resources.delete_transport_assignment", { assignment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport"] });
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

// --- CRUD for academics ----------------------------------------------------

export function useSaveClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("academics.save_class", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (student_group: string) =>
      apiPost<{ id: string }>("academics.delete_class", { student_group }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });
}

export function useSetClassStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student_group: string; students: string[] }) =>
      apiPost<{ id: string; count: number }>("academics.set_class_students", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["class-students"] });
    },
  });
}

export function useSaveSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("academics.save_subject", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.subjects }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (course: string) => apiPost<{ id: string }>("academics.delete_subject", { course }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.subjects }),
  });
}

export function useSaveTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string }>("academics.save_teacher", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instructor: string) =>
      apiPost<{ id: string }>("academics.delete_teacher", { instructor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });
}

export function useExamRoster(assessment_plan: string | undefined) {
  return useQuery<{
    exam: { id: string; title: string; subject: string; student_group: string; max: number };
    rows: Array<{
      student: string;
      student_name: string;
      result_id: string | null;
      score: number | null;
      grade: string | null;
      comment: string | null;
    }>;
    entered: number;
    total: number;
  }>({
    queryKey: ["exam-roster", assessment_plan ?? ""],
    queryFn: () => apiGet("academics.exam_roster", { assessment_plan }),
    enabled: Boolean(assessment_plan),
  });
}

export function useSaveGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; score: number; grade: string }>("academics.save_grade", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-roster"] });
      qc.invalidateQueries({ queryKey: ["grades"] });
    },
  });
}

export function useDepartments() {
  return useQuery<Array<{ name: string }>>({
    queryKey: ["departments"],
    queryFn: () => apiGet("academics.list_departments"),
    staleTime: 10 * 60 * 1000,
  });
}

// --- Gradebook -------------------------------------------------------------

export interface GradeBand {
  grade: string;
  label: string;
  emoji: string;
}

export interface SchemeComponent {
  component_name: string;
  component_type: string;
  type_label?: string;
  weight: number;
  max_score: number;
  /** The category this assessment sits under, from the assessment plan. */
  category?: string | null;
  quarter?: string | null;
}

export interface GradeScheme {
  id: string;
  name: string;
  scheme_name: string;
  course: string | null;
  program: string | null;
  academic_year: string | null;
  academic_term: string | null;
  is_default: number;
  total_weight: number;
  components: SchemeComponent[];
}

export function useSchemes(params: Opt<{ course: string; program: string }> = {}) {
  return useQuery<GradeScheme[]>({
    queryKey: ["schemes", params],
    queryFn: () => apiGet<GradeScheme[]>("gradebook.list_schemes", params),
  });
}

export function useSaveScheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; total_weight: number }>("gradebook.save_scheme", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schemes"] }),
  });
}

export function useDeleteScheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scheme: string) => apiPost<{ id: string }>("gradebook.delete_scheme", { scheme }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schemes"] }),
  });
}

export interface EntrySheetRow {
  student: string;
  student_name: string;
  roll_number: number | null;
  entry_id: string | null;
  score: number | null;
  max_score: number | null;
  remarks: string | null;
  entries: Array<{
    id: string;
    component_name: string;
    component_type: string;
    type_label: string;
    score: number;
    max_score: number;
    is_bonus: boolean;
    /** Kept on the record but left out of the subject total. */
    excluded?: boolean;
  }>;
}

export interface EntrySheet {
  student_group: string;
  course: string;
  program: string | null;
  academic_year: string | null;
  academic_term: string | null;
  component_name: string | null;
  scheme: { id: string; scheme_name: string; components: SchemeComponent[] } | null;
  components: SchemeComponent[];
  rows: EntrySheetRow[];
  entered: number;
  total: number;
  /** Marks students can already see. */
  publishedCount: number;
  /** Marks saved but not yet released to students. */
  draftCount: number;
  /** One summary per assessment: how it was marked and where it stands. */
  /** The plan's headings: what each is worth and which assessments feed it. */
  parents: Array<{
    component_name: string;
    component_type: string;
    weight: number;
    max_score: number;
    quarter: string | null;
    children_total: number;
    children: string[];
    aggregation: "sum" | "average" | "best_n" | "worst_drop";
    aggregation_n: number;
  }>;
  /** What each quarter counts for, summed over its headings. */
  quarter_totals: Array<{ quarter: string; weight: number; max_score: number }>;
  columns: Array<{
    component_name: string;
    marked: number;
    missing: number;
    published: number;
    publish_state: "published" | "partial" | "draft";
    excluded: boolean;
    release_on: string | null;
    average: number | null;
    highest: number | null;
    lowest: number | null;
    average_pct: number | null;
  }>;
}

/** Change how a category combines the assessments inside it. */
export function useSetAggregation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      course: string;
      component_name: string;
      mode: "sum" | "average" | "best_n" | "worst_drop";
      n?: number;
      program?: string;
    }) =>
      apiPost<{ component: string; mode: string; n: number; message_ar?: string }>(
        "gradebook.set_aggregation",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/** Save every column of the mark sheet in one request. */
export function useSaveGrid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ saved: number; updated: number; columns: number }>("gradebook.save_grid", {
        payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["class-term-grades"] });
    },
  });
}

/** Move a whole column up or down — a decision about the paper, not a student. */
export function useCurveColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      component_name: string;
      points?: number;
      percent?: number;
      academic_term?: string;
    }) =>
      apiPost<{ changed: number; total: number }>(
        "gradebook.curve_column",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entry-sheet"] }),
  });
}

/** Drop an assessment from the total while keeping its marks on the record. */
export function useExcludeColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      component_name: string;
      excluded: number;
      academic_term?: string;
    }) =>
      apiPost<{ component: string; excluded: boolean; rows: number }>(
        "gradebook.exclude_column",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["class-term-grades"] });
    },
  });
}

export function useEntrySheet(
  params: Opt<{
    student_group: string;
    course: string;
    component_name: string;
    academic_term: string;
  }> = {},
  enabled = true,
) {
  return useQuery<EntrySheet>({
    queryKey: ["entry-sheet", params],
    queryFn: () => apiGet<EntrySheet>("gradebook.get_entry_sheet", params),
    enabled: enabled && Boolean(params.student_group && params.course),
  });
}

export function useSaveMarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ created: number; updated: number; skipped: string[] }>("gradebook.save_marks", {
        payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
      qc.invalidateQueries({ queryKey: ["class-term-grades"] });
      qc.invalidateQueries({ queryKey: ["academic-record"] });
    },
  });
}

export interface SubjectGrade extends GradeBand {
  course: string;
  percentage: number;
  bonus: number;
  final: number;
  covered: number;
  components: Array<
    GradeBand & {
      id: string;
      component_name: string;
      component_type: string;
      type_label: string;
      score: number;
      max_score: number;
      weight: number;
      percentage: number;
      is_bonus: boolean;
      remarks: string | null;
      /** Average for this assessment across the student's own sections.
       *  null when fewer than two students were marked — one mark is not an
       *  average, and showing it would read as "exactly average". */
      class_average: number | null;
    }
  >;
  /** This subject's average across the student's own section, and across every
   *  section of the grade. null when too few students were marked to average. */
  section_average?: number | null;
  grade_average?: number | null;
  section_name?: string | null;
}

export interface TermGrades {
  student: string;
  student_name: string | null;
  image: string | null;
  academic_year: string | null;
  academic_term: string | null;
  subjects: SubjectGrade[];
  overall: number;
  overall_grade: GradeBand & { percentage: number };
  subject_count: number;
}

export function useTermGrades(
  student: string | undefined,
  params: Opt<{ academic_year: string; academic_term: string }> = {},
) {
  return useQuery<TermGrades>({
    queryKey: ["term-grades", student ?? "", params],
    queryFn: () => apiGet<TermGrades>("gradebook.term_grades", { student, ...params }),
    enabled: Boolean(student),
  });
}

export interface AcademicRecord {
  student: string;
  student_name: string | null;
  image: string | null;
  periods: Array<{
    academic_year: string | null;
    academic_term: string | null;
    subjects: SubjectGrade[];
    /** Null when the viewer may not see a total for this period. */
    overall: number | null;
    overall_grade: (GradeBand & { percentage: number }) | null;
    published: boolean;
    shows_overall: boolean;
  }>;
  cumulative: number | null;
  cumulative_grade: (GradeBand & { percentage: number }) | null;
  shows_cumulative: boolean;
}

export function useAcademicRecord(student: string | undefined) {
  return useQuery<AcademicRecord>({
    queryKey: ["academic-record", student ?? ""],
    queryFn: () => apiGet<AcademicRecord>("gradebook.academic_record", { student }),
    enabled: Boolean(student),
  });
}

export interface ClassTermGrades {
  student_group: string;
  course: string | null;
  academic_year: string | null;
  academic_term: string | null;
  rows: Array<
    GradeBand & {
      student: string;
      student_name: string;
      entries: number;
      percentage: number;
      bonus: number;
      final: number;
      covered: number;
    }
  >;
  class_average: number;
}

export function useClassTermGrades(
  params: Opt<{ student_group: string; course: string; academic_term: string }> = {},
) {
  return useQuery<ClassTermGrades>({
    queryKey: ["class-term-grades", params],
    queryFn: () => apiGet<ClassTermGrades>("gradebook.class_term_grades", params),
    enabled: Boolean(params.student_group),
  });
}

/** One subject in one section: every student's marks, component by component. */
export interface SubjectOverview {
  student_group: string;
  course: string;
  academic_year: string | null;
  academic_term: string | null;
  components: Array<{ name: string; max: number; weight: number }>;
  rows: Array<{
    student: string;
    student_name: string;
    entries: number;
    marks: Record<string, { score: number; max: number; published: boolean }>;
    final: number;
    grade: string;
    label: string;
    emoji: string;
    percentage: number;
  }>;
  stats: {
    students: number;
    graded: number;
    unmarked: number;
    average: number;
    highest: number;
    lowest: number;
    passing: number;
    at_risk: number;
  };
}

export function useSubjectOverview(params: { student_group?: string; course?: string }) {
  return useQuery<SubjectOverview>({
    queryKey: ["subject-overview", params],
    queryFn: () => apiGet<SubjectOverview>("gradebook.subject_overview", params),
    enabled: Boolean(params.student_group && params.course),
  });
}

export function useImportExamResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { assessment_plan: string; weight?: number }) =>
      apiPost<{ created: number; updated: number }>("gradebook.import_exam_results", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
      qc.invalidateQueries({ queryKey: ["class-term-grades"] });
    },
  });
}

// --- Chat ------------------------------------------------------------------

export interface AudiencePerson {
  user: string;
  name: string;
  role: string;
}

export interface AudienceGroup {
  id: string;
  name: string;
  program: string | null;
  batch: string | null;
  members: number;
}

export interface AudienceCourse {
  id: string;
  name: string;
}

export interface Audience {
  people: AudiencePerson[];
  groups: AudienceGroup[];
  courses: AudienceCourse[];
  policy: { student_open_messaging: boolean; restricted: boolean };
}

/** Everyone (and every section/course) the caller may address. */
export function useAudience() {
  return useQuery<Audience>({
    queryKey: ["audience"],
    queryFn: () => apiGet<Audience>("messaging.audience"),
  });
}

export interface ConversationMessage {
  id: string;
  sender: string;
  sender_name: string;
  recipient: string;
  body: string;
  sent_on: string;
  outgoing: boolean;
  read: boolean;
  files: SubmissionFile[];
}

export interface Conversation {
  thread: string;
  subject: string | null;
  participants: Array<{ user: string; name: string }>;
  /** True when a back-office user is reading someone else's conversation. */
  observing: boolean;
  messages: ConversationMessage[];
}

export function useConversation(thread: Opt<string>) {
  return useQuery<Conversation>({
    queryKey: ["conversation", thread],
    queryFn: () => apiGet<Conversation>("messaging.conversation", { thread: thread! }),
    enabled: Boolean(thread),
    refetchInterval: 30_000,
  });
}

export function useSendChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      body: string;
      recipients?: string[];
      groups?: string[];
      courses?: string[];
      subject?: string;
      thread?: string;
      files?: SubmissionFile[];
    }) =>
      apiPost<{ sent: number; messages: string[]; recipients: string[] }>("messaging.send", vars),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.inbox });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      if (vars.thread) qc.invalidateQueries({ queryKey: ["conversation", vars.thread] });
    },
  });
}

/** Back-office oversight of every conversation a student is part of. */
export function useStudentConversations(student?: Opt<string>, limit = 50) {
  return useQuery<{
    student: string | null;
    rows: Array<{
      id: string;
      thread: string;
      subject: string | null;
      preview: string;
      from: string;
      from_user: string;
      to: string;
      to_user: string;
      time: string;
    }>;
  }>({
    queryKey: ["student-conversations", student ?? null, limit],
    queryFn: () =>
      apiGet("messaging.student_conversations", {
        ...(student ? { student } : {}),
        limit,
      }),
  });
}

// --- Fees: write operations -------------------------------------------------

export interface FeeFormOptions {
  structures: Array<{
    id: string;
    name: string;
    program: string | null;
    academic_year: string | null;
    academic_term: string | null;
    total: number;
  }>;
  categories: string[];
  modes: string[];
  companies: string[];
}

export function useFeeFormOptions(enabled = true) {
  return useQuery<FeeFormOptions>({
    queryKey: ["fee-form-options"],
    queryFn: () => apiGet<FeeFormOptions>("fees.fee_form_options"),
    enabled,
  });
}

export function useSaveFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; grand_total: number; outstanding: number }>("fees.save_fee", {
        payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: qk.collection });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      fees: string;
      amount: number;
      mode_of_payment?: string;
      reference_no?: string;
      posting_date?: string;
      remarks?: string;
    }) =>
      apiPost<{
        journal_entry: string;
        fees: string;
        paid: number;
        outstanding: number;
        status: string;
      }>("fees.record_payment", vars),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: qk.feeDetail(vars.fees) });
      qc.invalidateQueries({ queryKey: ["fee-payments", vars.fees] });
      qc.invalidateQueries({ queryKey: qk.collection });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useCancelFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fees: string) => apiPost<{ id: string }>("fees.cancel_fee", { fees }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: qk.collection });
    },
  });
}

export function useFeePayments(fees: Opt<string>) {
  return useQuery<
    Array<{
      id: string;
      amount: number;
      date: string;
      mode: string | null;
      reference: string | null;
      remarks: string | null;
    }>
  >({
    queryKey: ["fee-payments", fees],
    queryFn: () => apiGet("fees.list_payments", { fees: fees! }),
    enabled: Boolean(fees),
  });
}

// --- Guardians --------------------------------------------------------------

export interface GuardianRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  alternate_phone: string | null;
  occupation: string | null;
  designation: string | null;
  user: string | null;
  image: string | null;
  children: Array<{ id: string; name: string; relation: string | null }>;
  children_count: number;
}

export function useGuardians(
  params: Opt<{
    search: string;
    occupation: string;
    has_login: string;
    page: number;
    page_size: number;
  }> = {},
) {
  return useQuery<Paginated<GuardianRow>>({
    queryKey: ["guardians", params],
    queryFn: () => apiGet<Paginated<GuardianRow>>("students.list_guardians", params),
    placeholderData: (prev) => prev,
  });
}

export function useSaveGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; name: string }>("students.save_guardian", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guardians"] });
      // The admission form's guardian picker is fed by a different query, so
      // a parent created from inside that form would not appear in its own
      // dropdown until the page was reloaded.
      qc.invalidateQueries({ queryKey: ["admission-options"] });
    },
  });
}

export function useDeleteGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (guardian: string) =>
      apiPost<{ id: string }>("students.delete_guardian", { guardian }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guardians"] }),
  });
}

export function useLinkGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student: string; guardian: string; relation?: string }) =>
      apiPost<{ student: string }>("students.link_guardian", vars),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["guardians"] });
      qc.invalidateQueries({ queryKey: qk.student(vars.student) });
    },
  });
}

export function useUnlinkGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student: string; guardian: string }) =>
      apiPost<{ student: string }>("students.unlink_guardian", vars),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["guardians"] });
      qc.invalidateQueries({ queryKey: qk.student(vars.student) });
    },
  });
}

// --- Health register --------------------------------------------------------

export interface HealthRow {
  id: string;
  student: string;
  student_name: string;
  blood_group: string | null;
  chronic_conditions: string | null;
  allergies: string | null;
  medications: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  visits: number;
  updated: string;
}

export function useHealthRegister(
  params: Opt<{
    filters: Record<string, unknown>;
    search: string;
    page: number;
    page_size: number;
    sort_by: string;
    sort_order: string;
  }> = {},
  enabled = true,
) {
  return useQuery<Paginated<HealthRow>>({
    queryKey: ["health-register", params],
    queryFn: () => apiGet<Paginated<HealthRow>>("wellbeing.list_health_records", params),
    placeholderData: (prev) => prev,
    enabled,
  });
}

// --- Bulk actions -----------------------------------------------------------

export function useBulkOptions(doctype: Opt<string>, enabled = true) {
  return useQuery<{ can_delete: boolean; fields: string[] }>({
    queryKey: ["bulk-options", doctype],
    queryFn: () => apiGet("bulk.bulk_options", { doctype: doctype! }),
    enabled: Boolean(doctype) && enabled,
  });
}

export function useBulkDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { doctype: string; records: string[] }) =>
      apiPost<{ deleted: number; failed: Array<{ name: string; reason: string }> }>(
        "bulk.bulk_delete",
        vars,
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useBulkUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      doctype: string;
      records: string[];
      field: string;
      value: string | number;
    }) =>
      apiPost<{ updated: number; failed: Array<{ name: string; reason: string }> }>(
        "bulk.bulk_update",
        vars,
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- End-of-term grade workflow --------------------------------------------

export interface TermSubmissionRow {
  id: string | null;
  student_group: string;
  course: string;
  status: "Draft" | "Submitted" | "Returned" | "Approved" | "Published";
  status_label: string;
  students: number;
  entered: number;
  complete: boolean;
  submitted_on: string;
  review_notes: string | null;
  instructor: string | null;
}

/** What each of my classes/subjects owes, and where it stands. */
export function useMySubmissions(academicTerm?: Opt<string>) {
  return useQuery<{ rows: TermSubmissionRow[]; academic_term: string | null }>({
    queryKey: ["term-submissions", academicTerm ?? null],
    queryFn: () =>
      apiGet("gradeflow.my_submissions", academicTerm ? { academic_term: academicTerm } : {}),
  });
}

export function useSubmitTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      academic_term?: string;
      notes?: string;
    }) => apiPost<{ id: string; status: string; students: number }>("gradeflow.submit_term", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term-submissions"] });
      qc.invalidateQueries({ queryKey: ["term-overview"] });
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
    },
  });
}

export function useReviewTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { submission: string; action: "approve" | "return"; notes?: string }) =>
      apiPost<{ id: string; status: string }>("gradeflow.review_term", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term-overview"] });
      qc.invalidateQueries({ queryKey: ["term-submissions"] });
    },
  });
}

export interface TermOverviewRow {
  student_group: string;
  name: string;
  expected: number;
  submitted: number;
  approved: number;
  published: number;
  returned: number;
  ready: boolean;
  is_published: boolean;
  subjects: Array<{
    id: string;
    course: string;
    status: string;
    status_label: string;
    instructor: string | null;
    submitted_on: string;
    /** Set when the administration reopened this subject for an appeal. */
    reopened_on: string;
    reopened_by: string | null;
    reopen_reason: string | null;
    /** Marks edited since that reopening. */
    changed_count: number;
  }>;
}

/** The administration's publishing console. */
export function useTermOverview(academicTerm?: Opt<string>, enabled = true) {
  return useQuery<{ rows: TermOverviewRow[]; academic_term: string | null }>({
    queryKey: ["term-overview", academicTerm ?? null],
    queryFn: () =>
      apiGet("gradeflow.term_overview", academicTerm ? { academic_term: academicTerm } : {}),
    enabled,
  });
}

export function usePublishTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student_group: string; academic_term?: string; force?: boolean }) =>
      apiPost<{ published: number }>("gradeflow.publish_term", {
        student_group: vars.student_group,
        ...(vars.academic_term ? { academic_term: vars.academic_term } : {}),
        ...(vars.force ? { force: 1 } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term-overview"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
      qc.invalidateQueries({ queryKey: ["academic-record"] });
    },
  });
}

export function useUnpublishTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student_group: string; academic_term?: string; reason?: string }) =>
      apiPost<{ reopened: number }>("gradeflow.unpublish_term", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term-overview"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
    },
  });
}

// --- Carrying assignment marks into the term gradebook ----------------------

export interface ImportableAssignment {
  id: string;
  title: string;
  course: string;
  max: number;
  due: string;
  status: string;
  graded: number;
  total: number;
  ready: boolean;
  imported: boolean;
}

export function useImportableAssignments(
  params: Opt<{ student_group: string; course: string }> = {},
  enabled = true,
) {
  return useQuery<ImportableAssignment[]>({
    queryKey: ["importable-assignments", params],
    queryFn: () => apiGet<ImportableAssignment[]>("gradebook.importable_assignments", params),
    enabled: Boolean(params.student_group) && enabled,
  });
}

export function useImportAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { assignment: string; weight?: number; component_name?: string }) =>
      apiPost<{ created: number; updated: number }>("gradebook.import_assignment", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["importable-assignments"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
    },
  });
}

export function useImportAssignmentsCombined() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      assignments: string[];
      component_name?: string;
      weight?: number;
    }) =>
      apiPost<{ created: number; updated: number }>("gradebook.import_assignments_combined", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      qc.invalidateQueries({ queryKey: ["importable-assignments"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
    },
  });
}

// --- Exam timetable ---------------------------------------------------------

export interface ExamSitting {
  id: string;
  title: string;
  course: string;
  program: string | null;
  student_group: string;
  date: string;
  from_time: string;
  to_time: string;
  duration: number;
  room: string | null;
  room_name: string | null;
  examiner: string | null;
  examiner_name: string | null;
  supervisor: string | null;
  supervisor_name: string | null;
  max: number;
  exam_type: string;
  exam_type_label: string;
  colour: string;
  academic_term: string | null;
  academic_year: string | null;
  upcoming: boolean;
  days_away: number | null;
}

export interface ExamSchedule {
  exams: ExamSitting[];
  upcoming: number;
  past: number;
  types: Array<{ code: string; label: string; colour: string }>;
}

export function useExamSchedule(
  params: Opt<{
    academic_term: string;
    student_group: string;
    course: string;
    exam_type: string;
    from_date: string;
    to_date: string;
    student: string;
  }> = {},
) {
  return useQuery<ExamSchedule>({
    queryKey: ["exam-schedule", params],
    queryFn: () => apiGet<ExamSchedule>("exams.schedule", params),
    placeholderData: (prev) => prev,
  });
}

export interface ExamFormOptions {
  groups: Array<{ id: string; name: string; program: string | null; students: number }>;
  courses: string[];
  rooms: Array<{ id: string; name: string; capacity: number }>;
  types: Array<{ code: string; label: string; colour: string }>;
}

export function useExamFormOptions(enabled = true) {
  return useQuery<ExamFormOptions>({
    queryKey: ["exam-form-options"],
    queryFn: () => apiGet<ExamFormOptions>("exams.form_options"),
    enabled,
  });
}

export function useSaveExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string; date: string }>("exams.save_exam", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-schedule"] }),
  });
}

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exam: string) => apiPost<{ id: string }>("exams.delete_exam", { exam }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-schedule"] }),
  });
}

// --- Timetable generation ---------------------------------------------------

export interface TimetablePlan {
  id: string;
  name: string;
  student_group: string;
  academic_year: string | null;
  academic_term: string | null;
  status: "Draft" | "Generated" | "Applied";
  lessons: number;
  generated_on?: string;
}

export interface PlanDetail extends TimetablePlan {
  working_days: string[];
  notes: string | null;
  periods: Array<{
    name: string;
    order: number;
    from_time: string;
    to_time: string;
    is_break: boolean;
  }>;
  subjects: Array<{
    course: string;
    periods_per_week: number;
    instructor: string | null;
    preferred_room: string | null;
    max_per_day: number;
  }>;
}

export function useTimetablePlans(enabled = true) {
  return useQuery<TimetablePlan[]>({
    queryKey: ["timetable-plans"],
    queryFn: () => apiGet<TimetablePlan[]>("timetable.list_plans"),
    enabled,
  });
}

export function usePlan(plan: Opt<string>) {
  return useQuery<PlanDetail>({
    queryKey: ["timetable-plan", plan],
    queryFn: () => apiGet<PlanDetail>("timetable.get_plan", { plan: plan! }),
    enabled: Boolean(plan),
  });
}

export interface DayShape {
  count: number;
  minutes: number;
  start: string;
  gap: number;
  break_after: number;
  break_minutes: number;
}

export interface PeriodPreview {
  periods: Array<{
    name: string;
    order: number;
    from_time: string;
    to_time: string;
    is_break: boolean;
  }>;
  teaching: number;
  ends_at: string;
}

/**
 * The school day these settings produce, worked out on the server.
 *
 * The times are derived rather than typed: a school says "seven periods of
 * forty-five minutes, break after the second", and the period rows follow from
 * that. Deriving them in one place keeps the preview and the saved plan
 * identical.
 */
export interface SchoolDayShape extends DayShape {
  working_days: string[];
  days: Array<{ code: string; label: string }>;
  periods: PeriodPreview["periods"];
}

/** The school's default working days and period pattern. */
export function useSchoolDayShape() {
  return useQuery<SchoolDayShape>({
    queryKey: ["school-day-shape"],
    queryFn: () => apiGet<SchoolDayShape>("timetable.get_day_shape"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveSchoolDayShape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Partial<DayShape> & { working_days?: string[] }) =>
      apiPost<SchoolDayShape>("timetable.save_day_shape", {
        ...vars,
        ...(vars.working_days ? { working_days: JSON.stringify(vars.working_days) } : {}),
      } as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-day-shape"] }),
  });
}

/** One school day: how many lessons, how long each is, when the break falls.
 *  A break carries no number — the lesson after it is the next one. */
export interface BellPeriod {
  name: string;
  order: number;
  from: string;
  to: string;
  isBreak: boolean;
}

export interface BellSchedule {
  name: string;
  title: string;
  isDefault: boolean;
  workingDays: string[];
  notes: string | null;
  periods: BellPeriod[];
  lessons: number;
  programs: string[];
  studentGroups: string[];
}

export interface BellSchedules {
  schedules: BellSchedule[];
  programs: Array<{ name: string; program_name: string | null; schedule: string | null }>;
  studentGroups: Array<{
    name: string;
    student_group_name: string | null;
    program: string | null;
    schedule: string | null;
  }>;
  days: Array<{ value: string; label: string }>;
  default: string | null;
}

/** Every school day the school has defined, and who follows each. */
export function useBellSchedules() {
  return useQuery<BellSchedules>({
    queryKey: ["bell-schedules"],
    queryFn: () => apiGet<BellSchedules>("bell_schedules.list_schedules"),
    staleTime: 60 * 1000,
  });
}

/** Everything that draws a timetable reads the school day, so a change to one
 *  has to reach all of them. */
function invalidateTimetables(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [
    "bell-schedules",
    "timetable",
    "timetable-pattern",
    "teacher-grid-options",
    "grid-options",
    "taken-periods",
    "school-day-shape",
    "student-dossier",
    "teacher-dossier",
  ]) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

export function useSaveBellSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name?: string;
      title: string;
      periods: BellPeriod[];
      is_default?: number;
      working_days?: string[];
      notes?: string;
    }) =>
      apiPost<{ name: string; periods: BellPeriod[] }>("bell_schedules.save_schedule", {
        ...vars,
        periods: JSON.stringify(vars.periods),
        ...(vars.working_days ? { working_days: JSON.stringify(vars.working_days) } : {}),
      } as unknown as Record<string, unknown>),
    onSuccess: () => invalidateTimetables(qc),
  });
}

export function useDeleteBellSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiPost("bell_schedules.delete_schedule", { name }),
    onSuccess: () => invalidateTimetables(qc),
  });
}

export function useAssignBellSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string | null; programs?: string[]; student_groups?: string[] }) =>
      apiPost<{ programs: number; studentGroups: number }>("bell_schedules.assign_schedule", {
        ...(vars.name ? { name: vars.name } : {}),
        programs: JSON.stringify(vars.programs ?? []),
        student_groups: JSON.stringify(vars.student_groups ?? []),
      } as unknown as Record<string, unknown>),
    onSuccess: () => invalidateTimetables(qc),
  });
}

export interface ApplyTimesResult {
  groups: number;
  slots: number;
  lessons: number;
  protected: number;
  missing: string[];
  /** The sections whose saved week would change, by name. */
  sections?: string[];
  sample?: Array<{ group: string; day: string; order: number; was: string; now: string }>;
  message_ar?: string;
}

/** Make the weeks already built follow this schedule. */
export function useApplyBellTimes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; dry_run: number }) =>
      apiPost<ApplyTimesResult>("bell_schedules.apply_times", {
        name: vars.name,
        dry_run: vars.dry_run,
      } as unknown as Record<string, unknown>),
    onSuccess: (_d, vars) => {
      if (!vars.dry_run) invalidateTimetables(qc);
    },
  });
}

export type TimetableAudience = "draft" | "teachers" | "all";

/** How much of a class's timetable each audience can currently see. */
export function usePublicationStatus(studentGroup: Opt<string>) {
  return useQuery<{
    studentGroup: string;
    counts: Partial<Record<TimetableAudience, number>>;
    total: number;
    audiences: Array<{ value: TimetableAudience; label: string }>;
  }>({
    queryKey: ["timetable-publication", studentGroup],
    queryFn: () =>
      apiGet("timetable_grid.publication_status", {
        student_group: studentGroup as string,
      }),
    enabled: Boolean(studentGroup),
  });
}

export function usePublishTimetable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student_group: string; audience: TimetableAudience }) =>
      apiPost<{ lessons: number; audience: string; audienceLabel: string }>(
        "timetable_grid.publish_timetable",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable-publication"] });
      qc.invalidateQueries({ queryKey: ["timetable"] });
    },
  });
}

/** The dates generation would use for a class if none are given. */
export function useDefaultRange(studentGroup: Opt<string>) {
  return useQuery<{ from: string; to: string; label: string }>({
    queryKey: ["default-range", studentGroup],
    queryFn: () =>
      apiGet("timetable_grid.default_range", { student_group: studentGroup as string }),
    enabled: Boolean(studentGroup),
  });
}

export function usePeriodPreview(shape: DayShape) {
  return useQuery<PeriodPreview>({
    queryKey: ["period-preview", shape],
    queryFn: () =>
      apiGet<PeriodPreview>("timetable.preview_periods", {
        count: String(shape.count),
        minutes: String(shape.minutes),
        start: shape.start,
        gap: String(shape.gap),
        break_after: String(shape.break_after),
        break_minutes: String(shape.break_minutes),
      }),
    staleTime: 60 * 1000,
  });
}

export function usePlanDefaults(studentGroup: Opt<string>) {
  return useQuery<{
    periods: PlanDetail["periods"];
    working_days: string[];
    subjects: PlanDetail["subjects"];
    days: Array<{ code: string; label: string }>;
  }>({
    queryKey: ["plan-defaults", studentGroup],
    queryFn: () =>
      apiGet("timetable.plan_defaults", studentGroup ? { student_group: studentGroup } : {}),
    enabled: Boolean(studentGroup),
  });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<PlanDetail>("timetable.save_plan", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable-plans"] });
      qc.invalidateQueries({ queryKey: ["timetable-plan"] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: string) => apiPost<{ id: string }>("timetable.delete_plan", { plan }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timetable-plans"] }),
  });
}

export interface GeneratedTimetable {
  plan: string;
  teacherless: string[];
  days: Array<{ code: string; label: string }>;
  periods: Array<{ name: string; order: number; from_time: string; to_time: string }>;
  lessons: Array<{
    day: string;
    day_label: string;
    period: string;
    period_order: number;
    from_time: string;
    to_time: string;
    course: string;
    instructor: string | null;
    room: string | null;
  }>;
  placed: number;
  demand: number;
  capacity: number;
  unplaced: Array<{ course: string; periods: number }>;
  complete: boolean;
}

export function useGenerateTimetable() {
  const qc = useQueryClient();
  return useMutation({
    // `variant` seeds the solver's tie-breaking so pressing build again gives
    // a different valid week instead of repeating the first one.
    mutationFn: (vars: string | { plan: string; variant?: number }) =>
      apiPost<GeneratedTimetable>(
        "timetable.generate",
        typeof vars === "string" ? { plan: vars } : vars,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timetable-plans"] }),
  });
}

export function useApplyTimetable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { plan: string; from_date?: string; weeks?: number }) =>
      apiPost<{
        created: number;
        skipped: Array<{ date: string; course: string; reason: string }>;
      }>("timetable.apply_plan", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable-plans"] });
      qc.invalidateQueries({ queryKey: qk.timetable({}) });
    },
  });
}

// --- Certificates -----------------------------------------------------------

export interface AvailableDocuments {
  student: string | null;
  student_name?: string;
  documents: Array<{
    kind: string;
    label: string;
    description: string;
    available: boolean;
    reason: string | null;
  }>;
}

export function useAvailableDocuments(student: string | null | undefined) {
  return useQuery<AvailableDocuments>({
    queryKey: ["available-documents", student ?? null],
    queryFn: () =>
      apiGet<AvailableDocuments>("certificates.available_documents", student ? { student } : {}),
  });
}

// --- Activities -------------------------------------------------------------

export interface ActivityRow {
  id: string;
  title: string;
  type: string;
  type_label: string;
  status: string;
  status_label: string;
  start_date: string;
  end_date: string;
  from_time: string;
  to_time: string;
  location: string | null;
  capacity: number;
  fee: number;
  supervisor: string | null;
  audience: string;
  program: string | null;
  student_group: string | null;
  requires_consent: boolean;
  registration_deadline: string;
  description: string | null;
  registered: number;
  waitlisted: number;
  seats_left: number | null;
  full: boolean;
  open: boolean;
  upcoming: boolean;
  my_enrolments: Array<{
    id: string;
    student: string;
    student_name: string;
    status: string;
    status_label: string;
    consent_status: string;
    consent_label: string;
  }>;
}

export function useActivities(
  params: Opt<{
    activity_type: string;
    status: string;
    search: string;
    student_group: string;
    page: number;
    page_size: number;
  }> = {},
) {
  return useQuery<Paginated<ActivityRow>>({
    queryKey: ["activities", params],
    queryFn: () => apiGet<Paginated<ActivityRow>>("activities.list_activities", params),
    placeholderData: (prev) => prev,
  });
}

export function useActivityOptions(enabled = true) {
  return useQuery<{
    types: Array<{ code: string; label: string }>;
    statuses: Array<{ code: string; label: string }>;
    programs: string[];
    groups: Array<{ id: string; name: string }>;
    supervisors: Array<{ id: string; name: string }>;
    /** Who this user may open an activity to — a teacher, only their own
     *  sections and grades. Absent on an older server: all three. */
    audiences?: string[];
  }>({
    queryKey: ["activity-options"],
    queryFn: () => apiGet("activities.form_options"),
    enabled,
  });
}

export function useSaveActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string }>("activities.save_activity", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (activity: string) =>
      apiPost<{ id: string }>("activities.delete_activity", { activity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useRegisterActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { activity: string; student?: string }) =>
      apiPost<{ id: string; status: string; waitlisted: boolean }>("activities.register", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["activity-participants"] });
    },
  });
}

export function useWithdrawActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrolment: string) =>
      apiPost<{ id: string; promoted: string | null }>("activities.withdraw", { enrolment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["activity-participants"] });
    },
  });
}

export function useGiveConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { enrolment: string; granted: number; notes?: string }) =>
      apiPost<{ id: string; consent_status: string; status: string }>(
        "activities.give_consent",
        vars,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["activity-participants"] });
    },
  });
}

export function useActivityParticipants(activity: Opt<string>) {
  return useQuery<{
    activity: {
      id: string;
      title: string;
      capacity: number;
      requires_consent: boolean;
      start_date: string;
    };
    rows: Array<{
      id: string;
      student: string;
      student_name: string;
      status: string;
      status_label: string;
      consent_status: string;
      consent_label: string;
      attended: boolean;
      enrolled_on: string;
      notes: string | null;
    }>;
    confirmed: number;
    waitlisted: number;
    awaiting_consent: number;
  }>({
    queryKey: ["activity-participants", activity],
    queryFn: () => apiGet("activities.participants", { activity: activity! }),
    enabled: Boolean(activity),
  });
}

export function useMarkActivityAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: Array<{ id: string; attended: number }>) =>
      apiPost<{ updated: number }>("activities.mark_attendance", { entries }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-participants"] }),
  });
}

// --- Teacher appraisal ------------------------------------------------------

export interface ObservationRow {
  id: string;
  instructor: string;
  instructor_name: string;
  date: string;
  type: string;
  type_label: string;
  status: string;
  status_label: string;
  course: string | null;
  student_group: string | null;
  percent: number;
  rating: string | null;
  observer: string | null;
  has_response: boolean;
}

export function useObservations(
  params: Opt<{ instructor: string; status: string; page: number; page_size: number }> = {},
) {
  return useQuery<Paginated<ObservationRow>>({
    queryKey: ["observations", params],
    queryFn: () => apiGet<Paginated<ObservationRow>>("appraisal.list_observations", params),
    placeholderData: (prev) => prev,
  });
}

export interface ObservationDetail {
  id: string;
  instructor: string;
  instructor_name: string;
  date: string;
  type: string;
  type_label: string;
  status: string;
  status_label: string;
  course: string | null;
  student_group: string | null;
  observer: string | null;
  percent: number;
  score: number;
  rating: string | null;
  strengths: string | null;
  improvements: string | null;
  action_plan: string | null;
  teacher_response: string | null;
  criteria: Array<{
    criterion: string;
    weight: number;
    score: number;
    max_score: number;
    comment: string | null;
  }>;
}

export function useObservation(observation: Opt<string>) {
  return useQuery<ObservationDetail>({
    queryKey: ["observation", observation],
    queryFn: () =>
      apiGet<ObservationDetail>("appraisal.get_observation", { observation: observation! }),
    enabled: Boolean(observation),
  });
}

export function useSaveObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; percent: number; rating: string; status: string }>(
        "appraisal.save_observation",
        { payload },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observations"] });
      qc.invalidateQueries({ queryKey: ["observation"] });
      qc.invalidateQueries({ queryKey: ["appraisal-overview"] });
    },
  });
}

export function useShareObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (observation: string) =>
      apiPost<{ id: string; status: string }>("appraisal.share_observation", { observation }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observations"] });
      qc.invalidateQueries({ queryKey: ["appraisal-overview"] });
    },
  });
}

export function useAcknowledgeObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { observation: string; response?: string }) =>
      apiPost<{ id: string; status: string }>("appraisal.acknowledge", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["observations"] });
      qc.invalidateQueries({ queryKey: ["observation"] });
      qc.invalidateQueries({ queryKey: ["performance-file"] });
    },
  });
}

export function useDeleteObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (observation: string) =>
      apiPost<{ id: string }>("appraisal.delete_observation", { observation }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["observations"] }),
  });
}

export interface PerformanceFile {
  instructor: string;
  name: string;
  department: string | null;
  summary: {
    observations: number;
    average_percent: number | null;
    latest_rating: string | null;
    trend: "up" | "down" | "flat" | null;
    awaiting_response: number;
  };
  teaching: {
    classes: number;
    subjects: number;
    students: number;
    assignments: number;
    marks_entered: number;
    terms_submitted: number;
  };
  observations: Array<{
    id: string;
    date: string;
    type_label: string;
    status: string;
    status_label: string;
    percent: number;
    rating: string | null;
    course: string | null;
    student_group: string | null;
    strengths: string | null;
    improvements: string | null;
  }>;
}

export function usePerformanceFile(instructor?: Opt<string>) {
  return useQuery<PerformanceFile>({
    queryKey: ["performance-file", instructor ?? null],
    queryFn: () =>
      apiGet<PerformanceFile>("appraisal.performance_file", instructor ? { instructor } : {}),
  });
}

export function useAppraisalOverview(enabled = true) {
  return useQuery<{
    rows: Array<{
      instructor: string;
      name: string;
      department: string | null;
      observations: number;
      average: number | null;
      latest: string | null;
      latest_rating: string | null;
      drafts: number;
      awaiting_response: number;
    }>;
    summary: {
      teachers: number;
      observed: number;
      never_observed: number;
      school_average: number | null;
    };
    criteria_template: Array<{ criterion: string; weight: number; max_score: number }>;
  }>({
    queryKey: ["appraisal-overview"],
    queryFn: () => apiGet("appraisal.appraisal_overview"),
    enabled,
  });
}

// --- Quizzes ----------------------------------------------------------------

export interface QuizRow {
  id: string;
  title: string;
  course: string;
  student_group: string;
  status: string;
  status_label: string;
  opens_on: string;
  closes_on: string;
  time_limit: number;
  attempts_allowed: number;
  total_marks: number;
  pass_mark: number;
  questions: number;
  instructor: string | null;
  open: boolean;
  submissions: number;
  my_attempts: Array<{
    id: string;
    status: string;
    status_label: string;
    score: number;
    percentage: number;
    passed: boolean;
    attempt: number;
  }>;
  attempts_left: number;
  best: number | null;
}

export function useQuizzes(
  params: Opt<{
    student_group: string;
    course: string;
    status: string;
    student: string;
    page: number;
    page_size: number;
  }> = {},
) {
  return useQuery<Paginated<QuizRow>>({
    queryKey: ["quizzes", params],
    queryFn: () => apiGet<Paginated<QuizRow>>("quizzes.list_quizzes", params),
    placeholderData: (prev) => prev,
  });
}

export interface QuizDetail {
  id: string;
  title: string;
  course: string;
  student_group: string;
  status: string;
  status_label: string;
  opens_on: string;
  closes_on: string;
  time_limit: number;
  attempts_allowed: number;
  shuffle: boolean;
  total_marks: number;
  pass_mark: number;
  show_answers_after: string;
  instructions: string | null;
  questions: Array<{
    idx: number;
    question_text: string;
    question_type: string;
    type_label: string;
    marks: number;
    option_a: string | null;
    option_b: string | null;
    option_c: string | null;
    option_d: string | null;
    correct_answer: string;
    explanation: string | null;
  }>;
}

export function useQuiz(quiz: Opt<string>) {
  return useQuery<QuizDetail>({
    queryKey: ["quiz", quiz],
    queryFn: () => apiGet<QuizDetail>("quizzes.get_quiz", { quiz: quiz! }),
    enabled: Boolean(quiz),
  });
}

export function useSaveQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string; questions: number; total_marks: number }>(
        "quizzes.save_quiz",
        { payload },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes"] });
      qc.invalidateQueries({ queryKey: ["quiz"] });
    },
  });
}

export function useDeleteQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quiz: string) => apiPost<{ id: string }>("quizzes.delete_quiz", { quiz }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quizzes"] }),
  });
}

/** The paper a student sits — never carries the correct answers. */
export interface QuizPaper {
  attempt: string;
  quiz: string;
  title: string;
  instructions: string | null;
  time_limit: number;
  total_marks: number;
  started_on: string;
  attempt_number: number;
  questions: Array<{
    idx: number;
    question_text: string;
    question_type: string;
    type_label: string;
    marks: number;
    options: Array<{ key: string; text: string }>;
  }>;
}

export function useStartAttempt() {
  return useMutation({
    mutationFn: (quiz: string) => apiPost<QuizPaper>("quizzes.start_attempt", { quiz }),
  });
}

export interface AttemptResult {
  attempt: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  needs_review: boolean;
  correct: number;
  questions: number;
  answers_revealed: boolean;
  answers: Array<{
    idx: number;
    question: string;
    given: string;
    correct_answer: string;
    is_correct: boolean;
    marks: number;
    possible: number;
  }>;
}

export function useSubmitAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { attempt: string; answers: Array<{ idx: number; answer: string }> }) =>
      apiPost<AttemptResult>("quizzes.submit_attempt", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quizzes"] }),
  });
}

export function useQuizResults(quiz: Opt<string>) {
  return useQuery<{
    quiz: {
      id: string;
      title: string;
      course: string;
      student_group: string;
      total_marks: number;
      pass_mark: number;
      status: string;
    };
    summary: {
      roster: number;
      sat: number;
      not_sat: number;
      average: number | null;
      passed: number;
      needs_review: number;
    };
    attempts: Array<{
      id: string;
      student: string;
      student_name: string;
      attempt: number;
      status: string;
      status_label: string;
      score: number;
      total: number;
      percentage: number;
      passed: boolean;
      needs_review: boolean;
      submitted_on: string;
      minutes: number;
    }>;
    not_sat: Array<{ student: string; student_name: string }>;
    questions: Array<{
      idx: number;
      text: string;
      correct: number;
      total: number;
      percent: number;
    }>;
  }>({
    queryKey: ["quiz-results", quiz],
    queryFn: () => apiGet("quizzes.quiz_results", { quiz: quiz! }),
    enabled: Boolean(quiz),
  });
}

export function useReviewAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { attempt: string; marks: Array<{ idx: number; marks_awarded: number }> }) =>
      apiPost<{ attempt: string; score: number; percentage: number; passed: boolean }>(
        "quizzes.review_attempt",
        vars,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quiz-results"] }),
  });
}

// --- Alert rules and student alerts -----------------------------------------

export interface AlertRuleRow {
  id: string;
  name: string;
  trigger: string;
  trigger_label: string;
  group: string;
  unit: string;
  enabled: boolean;
  severity: string;
  severity_label: string;
  operator: string;
  threshold: number;
  within_days: number;
  applies_to: string;
  program: string | null;
  student_group: string | null;
  title: string;
  message: string;
  emoji: string;
  last_run: string;
  last_matched: number;
  open_alerts: number;
}

export function useAlertRules(enabled = true) {
  return useQuery<AlertRuleRow[]>({
    queryKey: ["alert-rules"],
    queryFn: () => apiGet<AlertRuleRow[]>("alerts.list_rules"),
    enabled,
  });
}

export interface AlertRuleDetail extends Omit<
  AlertRuleRow,
  | "open_alerts"
  | "last_run"
  | "last_matched"
  | "trigger_label"
  | "group"
  | "unit"
  | "severity_label"
> {
  notes: string | null;
  actions: Array<{
    action_type: string;
    action_label: string;
    notify_roles: string;
    escalate_after_days: number;
    block_pages: string | null;
  }>;
}

export function useAlertRule(rule: string | null | undefined) {
  return useQuery<AlertRuleDetail>({
    queryKey: ["alert-rule", rule],
    queryFn: () => apiGet<AlertRuleDetail>("alerts.get_rule", { rule: rule! }),
    enabled: Boolean(rule),
  });
}

export function useRuleOptions(enabled = true) {
  return useQuery<{
    triggers: Array<{ code: string; label: string; unit: string; group: string }>;
    severities: Array<{ code: string; label: string; emoji: string }>;
    levels: Array<{ code: string; label: string }>;
    pages: Array<{ path: string; label: string }>;
    operators: Array<{ code: string; label: string }>;
    programs: string[];
    groups: Array<{ id: string; name: string }>;
  }>({
    queryKey: ["rule-options"],
    queryFn: () => apiGet("alerts.rule_options"),
    enabled,
  });
}

export function useSaveAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; name: string }>("alerts.save_rule", { payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-rules"] });
      qc.invalidateQueries({ queryKey: ["alert-rule"] });
    },
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rule: string) => apiPost<{ id: string }>("alerts.delete_rule", { rule }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-rules"] }),
  });
}

/** How many students a rule would match, before it is saved. */
export function usePreviewRule() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{
        scope: number;
        measured: number;
        matched: number;
        unit: string;
        sample: Array<{ student: string; name: string; value: number }>;
      }>("alerts.preview_rule", { payload }),
  });
}

export function useRunRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rule?: string) =>
      apiPost<{ matched: number; raised: number; resolved: number; escalated: number }>(
        "alerts.run_rules",
        rule ? { rule } : {},
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export interface StudentAlert {
  id: string;
  student: string;
  student_name: string;
  rule: string | null;
  rule_name: string | null;
  trigger: string;
  trigger_label: string;
  status: string;
  status_label: string;
  severity: string;
  severity_label: string;
  severity_rank: number;
  level: string;
  level_label: string;
  measured: number;
  threshold: number;
  unit: string;
  title: string;
  message: string;
  emoji: string;
  raised_on: string;
  escalated_on: string;
  resolved_on: string;
  acknowledged: boolean;
  blocks_access: boolean;
}

export function useAlerts(
  params: Opt<{
    student: string;
    status: string;
    severity: string;
    page: number;
    page_size: number;
  }> = {},
) {
  return useQuery<Paginated<StudentAlert>>({
    queryKey: ["student-alerts", params],
    queryFn: () => apiGet<Paginated<StudentAlert>>("alerts.list_alerts", params),
    placeholderData: (prev) => prev,
  });
}

export function useAlertsOverview(enabled = true) {
  return useQuery<{
    summary: {
      open: number;
      blocked: number;
      unacknowledged: number;
      critical: number;
      students: number;
    };
    by_severity: Array<{ severity: string; label: string; count: number; emoji: string }>;
    by_trigger: Array<{ trigger: string; count: number }>;
    alerts: StudentAlert[];
  }>({
    queryKey: ["alerts-overview"],
    queryFn: () => apiGet("alerts.alerts_overview"),
    enabled,
  });
}

export function useStudentAlertFile(student: Opt<string>) {
  return useQuery<{
    student: string;
    student_name: string;
    summary: {
      total: number;
      open: number;
      warnings: number;
      blocked: boolean;
      worst: number;
      unacknowledged: number;
    };
    alerts: StudentAlert[];
    blocked_pages: string[];
  }>({
    queryKey: ["student-alert-file", student ?? null],
    queryFn: () => apiGet("alerts.student_file", student ? { student } : {}),
  });
}

/** Which pages the viewer is blocked from, and why. */
/** Compulsory surveys the caller still owes an answer to. */
export function usePendingSurveys() {
  return useQuery<{
    surveys: Array<{ id: string; title: string; intro?: string; closes_on: string }>;
    count: number;
  }>({
    queryKey: ["surveys", "pending-required"],
    queryFn: () => apiGet("surveys.pending_required"),
    // Answering one has to release the portal on the next screen, not on the
    // next full reload.
    staleTime: 30_000,
  });
}

export function useMyBlocks() {
  return useQuery<{
    blocked: string[];
    /** The whole portal is closed, not a list of pages. */
    everything?: boolean;
    /** Routes that stay open even then — the student must be able to read why. */
    allowed?: string[];
    reasons: Array<{
      alert: string;
      student_name: string;
      title: string;
      message: string;
      emoji: string;
      severity: string;
      pages: string[];
    }>;
  }>({
    queryKey: ["my-blocks"],
    queryFn: () => apiGet("alerts.my_blocks"),
    staleTime: 60_000,
  });
}

export interface MyAlert {
  name: string;
  student: string;
  student_name: string | null;
  title_ar: string;
  message_ar: string;
  emoji: string;
  severity: string;
  severity_label: string;
  level: string;
  level_label: string;
  measured_value: number;
  threshold: number;
  raised_on: string;
  blocks_access: number;
  pages: string[];
}

/**
 * Alerts the viewer has not yet acknowledged.
 *
 * Separate from `useMyBlocks`, which only reports pages already locked. A
 * first warning blocks nothing, and a warning nobody sees until access is cut
 * has failed at the one job it had.
 */
export function useMyAlerts() {
  return useQuery<{ alerts: MyAlert[]; count: number }>({
    queryKey: ["my-alerts"],
    queryFn: () => apiGet("alerts.my_alerts"),
    staleTime: 60_000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alert: string) =>
      apiPost<{ id: string; status: string }>("alerts.acknowledge_alert", { alert }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-alerts"] });
      qc.invalidateQueries({ queryKey: ["student-alert-file"] });
      qc.invalidateQueries({ queryKey: ["my-blocks"] });
      qc.invalidateQueries({ queryKey: ["my-alerts"] });
    },
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { alert: string; notes?: string; dismiss?: boolean }) =>
      apiPost<{ id: string; status: string }>("alerts.resolve_alert", {
        alert: vars.alert,
        ...(vars.notes ? { notes: vars.notes } : {}),
        ...(vars.dismiss ? { dismiss: 1 } : {}),
      }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- Subject resources ------------------------------------------------------

export interface ResourceItem {
  id: string;
  title: string;
  course: string;
  student_group: string | null;
  type: string;
  type_label: string;
  icon: string;
  status: string;
  description: string | null;
  url: string | null;
  instructor: string | null;
  topic: string | null;
  published_on: string;
  views: number;
  files: SubmissionFile[];
}

export function useResources(
  params: Opt<{
    course: string;
    resource_type: string;
    search: string;
    student: string;
  }> = {},
) {
  return useQuery<{
    subjects: Array<{ course: string; count: number; items: ResourceItem[] }>;
    total: number;
    types: Array<{ code: string; label: string; icon: string }>;
  }>({
    queryKey: ["resources", params],
    queryFn: () => apiGet("resources_hub.list_resources", params),
    placeholderData: (prev) => prev,
  });
}

export function useResourceOptions(enabled = true) {
  return useQuery<{
    courses: string[];
    types: Array<{ code: string; label: string; icon: string }>;
    groups: Array<{ id: string; name: string }>;
  }>({
    queryKey: ["resource-options"],
    queryFn: () => apiGet("resources_hub.resource_options"),
    enabled,
  });
}

export function useSaveResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string }>("resources_hub.save_resource", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources"] }),
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resource: string) =>
      apiPost<{ id: string }>("resources_hub.delete_resource", { resource }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources"] }),
  });
}

export function useOpenResource() {
  return useMutation({
    mutationFn: (resource: string) =>
      apiPost<{ id: string }>("resources_hub.open_resource", { resource }),
  });
}

// --- Surveys ----------------------------------------------------------------

export interface SurveyRow {
  id: string;
  title: string;
  audience: string;
  audience_label: string;
  status: string;
  status_label: string;
  anonymous: boolean;
  opens_on: string;
  closes_on: string;
  intro: string | null;
  responses: number;
  answered: boolean;
  open: boolean;
}

export function useSurveys(status?: Opt<string>) {
  return useQuery<SurveyRow[]>({
    queryKey: ["surveys", status ?? null],
    queryFn: () => apiGet<SurveyRow[]>("surveys.list_surveys", status ? { status } : {}),
  });
}

export interface SurveyDetail {
  id: string;
  title: string;
  audience_label: string;
  anonymous: boolean;
  intro: string | null;
  closes_on: string;
  questions: Array<{
    idx: number;
    question_text: string;
    question_type: string;
    type_label: string;
    required: boolean;
    options: string[];
    scale_max: number;
  }>;
}

export function useSurvey(survey: Opt<string>) {
  return useQuery<SurveyDetail>({
    queryKey: ["survey", survey],
    queryFn: () => apiGet<SurveyDetail>("surveys.get_survey", { survey: survey! }),
    enabled: Boolean(survey),
  });
}

export function useSaveSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; title: string; questions: number }>("surveys.save_survey", { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surveys"] }),
  });
}

export function useDeleteSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (survey: string) => apiPost<{ id: string }>("surveys.delete_survey", { survey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surveys"] }),
  });
}

export function useSubmitSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { survey: string; answers: Array<{ idx: number; answer: string }> }) =>
      apiPost<{ id: string }>("surveys.submit_response", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surveys"] }),
  });
}

export function useSurveyResults(survey: Opt<string>) {
  return useQuery<{
    survey: {
      id: string;
      title: string;
      audience_label?: string;
      anonymous: boolean;
      status?: string;
    };
    summary: { responses: number; by_role: Array<{ role: string; count: number }> };
    questions: Array<{
      idx: number;
      question: string;
      type: string;
      type_label: string;
      answered: number;
      average?: number | null;
      scale_max?: number;
      distribution?: Array<{ value: number; count: number }>;
      options?: Array<{ option: string; count: number; percent: number }>;
      responses?: string[];
    }>;
  }>({
    queryKey: ["survey-results", survey],
    queryFn: () => apiGet("surveys.survey_results", { survey: survey! }),
    enabled: Boolean(survey),
  });
}

/* ------------------------------------------------------------ admissions */

export interface ApplicantRow {
  id: string;
  name: string;
  idNumber: string | null;
  status: "Applied" | "Approved" | "Rejected" | "Admitted";
  statusLabel: string;
  statusTone: string;
  appliedOn: string;
  program: string | null;
  academicYear: string | null;
  academicTerm: string | null;
  email: string | null;
  mobile: string | null;
  birthDate: string;
  gender: string | null;
  nationality: string | null;
  image: string | null;
}

export interface Credentials {
  user: string;
  username: string;
  /** Readable only in the response that created the account. */
  password: string | null;
  name: string | null;
  guardian?: string;
  isNew?: boolean;
}

export interface Sibling {
  name: string | null;
  birthDate: string;
  gender: string | null;
  sameSchool: boolean;
}

export interface ApplicantDetail extends ApplicantRow {
  firstName: string | null;
  middleName: string | null;
  /** The third of four names — see the add_grandfather_name patch. */
  grandfatherName?: string | null;
  lastName: string | null;
  bloodGroup: string | null;
  studentCategory: string | null;
  studentAdmission: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  city: string | null;
  guardians: Array<{
    guardian: string;
    name: string | null;
    relation: string | null;
    relationLabel: string | null;
  }>;
  siblings: Sibling[];
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  student: string | null;
  credentials: Credentials | null;
  allowedMoves: string[];
}

export interface ApplicantList {
  items: ApplicantRow[];
  total: number;
  page: number;
  page_size: number;
  counts: Record<string, number>;
}

export function useApplicants(params: {
  search?: string;
  status?: string;
  program?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery<ApplicantList>({
    queryKey: ["applicants", params],
    queryFn: () =>
      apiGet<ApplicantList>("admissions.list_applicants", {
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.program ? { program: params.program } : {}),
        page: String(params.page ?? 1),
        page_size: String(params.page_size ?? 20),
      }),
    placeholderData: (prev) => prev,
  });
}

export function useApplicant(applicant: string | null | undefined) {
  return useQuery<ApplicantDetail>({
    queryKey: ["applicant", applicant],
    queryFn: () => apiGet<ApplicantDetail>("admissions.get_applicant", { applicant: applicant! }),
    enabled: Boolean(applicant),
  });
}

export interface AdmissionOptions {
  programs: string[];
  academicYears: string[];
  academicTerms: Array<{ name: string; academic_year: string }>;
  genders: string[];
  studentCategories: string[];
  studentAdmissions: string[];
  countries: string[];
  bloodGroups: string[];
  relations: Array<{ value: string; label: string }>;
  guardians: Array<{ name: string; guardian_name: string }>;
  defaultAcademicYear: string | null;
  statuses: Array<{ value: string; label: string; tone: string }>;
}

export function useAdmissionOptions() {
  return useQuery<AdmissionOptions>({
    queryKey: ["admission-options"],
    queryFn: () => apiGet<AdmissionOptions>("admissions.form_options"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<{ id: string; status: string }>("admissions.save_applicant", { payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applicants"] });
      void qc.invalidateQueries({ queryKey: ["applicant"] });
    },
  });
}

export function useTransitionApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { applicant: string; to_status: string; reason?: string }) =>
      apiPost<{ id: string; status: string; statusLabel: string }>(
        "admissions.transition",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applicants"] });
      void qc.invalidateQueries({ queryKey: ["applicant"] });
    },
  });
}

export interface AdmitResult {
  student: string;
  studentName: string;
  status: string;
  credentials: Credentials;
  guardians: Credentials[];
}

export function useAdmitApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (applicant: string) => apiPost<AdmitResult>("admissions.admit", { applicant }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applicants"] });
      void qc.invalidateQueries({ queryKey: ["applicant"] });
      void qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useDeleteApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (applicant: string) =>
      apiPost<{ id: string }>("admissions.delete_applicant", { applicant }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applicants"] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (user: string) => apiPost<Credentials>("credentials.reset_password", { user }),
  });
}

/** Print formats the ERPNext desk offers for a doctype. */
export function usePrintFormats(doctype: string) {
  return useQuery<{ formats: string[]; default: string; letterheads: string[] }>({
    queryKey: ["print-formats", doctype],
    queryFn: () =>
      apiGet<{ formats: string[]; default: string; letterheads: string[] }>(
        "registration_print.print_formats",
        { doctype },
      ),
    staleTime: 5 * 60 * 1000,
  });
}

/* --------------------------------------------------------------- billing */

export interface FeeStructureOption {
  id: string;
  program: string | null;
  academicYear: string | null;
  academicTerm: string | null;
  total: number;
  /** Matches the student's own programme and year. */
  suggested: boolean;
}

export function useStructureOptions(student: string | null | undefined) {
  return useQuery<{
    structures: FeeStructureOption[];
    studentProgram: string | null;
    studentAcademicYear: string | null;
    companies: string[];
    defaultCompany: string | null;
  }>({
    queryKey: ["structure-options", student],
    queryFn: () => apiGet("billing.structure_options", student ? { student } : {}),
    enabled: Boolean(student),
  });
}

export interface StructurePreview {
  id: string;
  program: string | null;
  academicYear: string | null;
  total: number;
  components: Array<{
    category: string;
    item: string | null;
    description: string | null;
    amount: number;
  }>;
}

export function useStructurePreview(feeStructure: string | null | undefined) {
  return useQuery<StructurePreview>({
    queryKey: ["structure-preview", feeStructure],
    queryFn: () =>
      apiGet<StructurePreview>("billing.structure_preview", {
        fee_structure: feeStructure!,
      }),
    enabled: Boolean(feeStructure),
  });
}

export interface InvoiceLine {
  idx?: number;
  item: string;
  description: string | null;
  qty: number;
  rate?: number;
  amount: number;
}

export interface StudentInvoice {
  id: string;
  student: string;
  customer: string;
  programEnrollment: string | null;
  program: string | null;
  academicYear: string | null;
  academicTerm: string | null;
  postingDate: string;
  dueDate: string;
  total: number;
  outstanding: number;
  docstatus: number;
  isDraft: boolean;
  status: string;
  items: InvoiceLine[];
}

function invalidateBilling(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["fees"] });
  void qc.invalidateQueries({ queryKey: ["invoices"] });
  void qc.invalidateQueries({ queryKey: ["invoice"] });
}

export function useInvoiceStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student: string;
      fee_structure?: string;
      invoice?: string;
      program_enrollment?: string;
      components?: Array<{ item: string; amount: number; description?: string; qty?: number }>;
      posting_date?: string;
      due_date?: string;
      remarks?: string;
      submit?: number;
    }) =>
      apiPost<StudentInvoice>(
        "billing.invoice_student",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => invalidateBilling(qc),
  });
}

export function useSubmitInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoice: string) => apiPost<StudentInvoice>("billing.submit_invoice", { invoice }),
    onSuccess: () => invalidateBilling(qc),
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoice: string) =>
      apiPost<StudentInvoice | { id: string; deleted: boolean }>("billing.cancel_invoice", {
        invoice,
      }),
    onSuccess: () => invalidateBilling(qc),
  });
}

export function useStudentEnrollments(student: string | null | undefined) {
  return useQuery<
    Array<{
      id: string;
      program: string | null;
      academicYear: string | null;
      academicTerm: string | null;
      enrolledOn: string;
    }>
  >({
    queryKey: ["student-enrollments", student],
    queryFn: () => apiGet("billing.student_enrollments", { student: student! }),
    enabled: Boolean(student),
  });
}

/* ------------------------------------------------------------ enrollment */

export interface EnrollmentRow {
  id: string;
  student: string;
  studentName: string | null;
  program: string | null;
  academicYear: string | null;
  academicTerm: string | null;
  batch: string | null;
  category: string | null;
  enrolledOn: string;
  docstatus: number;
  status: string;
}

export function useEnrollments(params: {
  student?: string;
  program?: string;
  academic_year?: string;
  batch?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery<Paginated<EnrollmentRow>>({
    queryKey: ["enrollments", params],
    queryFn: () =>
      apiGet<Paginated<EnrollmentRow>>("enrollment.list_enrollments", {
        ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)),
        page: String(params.page ?? 1),
        page_size: String(params.page_size ?? 25),
      }),
    placeholderData: (prev) => prev,
  });
}

export interface EnrollmentOptions {
  programs: string[];
  academicYears: string[];
  academicTerms: Array<{ name: string; academic_year: string }>;
  batches: string[];
  categories: string[];
  defaultAcademicYear: string | null;
  courses: Array<{ course: string; required: number }>;
}

export function useEnrollmentOptions(program?: string) {
  return useQuery<EnrollmentOptions>({
    queryKey: ["enrollment-options", program ?? null],
    queryFn: () => apiGet<EnrollmentOptions>("enrollment.form_options", program ? { program } : {}),
  });
}

export interface EnrollmentDetail extends EnrollmentRow {
  courses: string[];
  courseEnrollments: Array<{ name: string; course: string; enrollment_date: string }>;
  invoices: Array<{ name: string; grand_total: number; outstanding_amount: number }>;
}

export function useEnrollmentDetail(enrollment: string | null | undefined) {
  return useQuery<EnrollmentDetail>({
    queryKey: ["enrollment", enrollment],
    queryFn: () =>
      apiGet<EnrollmentDetail>("enrollment.enrollment_detail", { enrollment: enrollment! }),
    enabled: Boolean(enrollment),
  });
}

function invalidateEnrollments(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["enrollments"] });
  void qc.invalidateQueries({ queryKey: ["enrollment"] });
  void qc.invalidateQueries({ queryKey: ["students"] });
}

export function useSaveEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<EnrollmentRow>("enrollment.save_enrollment", { payload }),
    onSuccess: () => invalidateEnrollments(qc),
  });
}

export function useSubmitEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollment: string) =>
      apiPost<EnrollmentRow>("enrollment.submit_enrollment", { enrollment }),
    onSuccess: () => invalidateEnrollments(qc),
  });
}

export function useCancelEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollment: string) =>
      apiPost<EnrollmentRow | { id: string; deleted: boolean }>("enrollment.cancel_enrollment", {
        enrollment,
      }),
    onSuccess: () => invalidateEnrollments(qc),
  });
}

/* -------------------------------------------------------- timetable grid */

export interface GridPeriod {
  order: number;
  name: string;
  from: string;
  to: string;
  isBreak: boolean;
}

export interface GridSlot {
  id?: string;
  day: string;
  period: number;
  from?: string;
  to?: string;
  course: string | null;
  instructor: string | null;
  instructorName?: string | null;
  room: string | null;
  studentGroup?: string | null;
}

export interface GridOptions {
  days: Array<{ value: string; label: string }>;
  periods: GridPeriod[];
  groups: Array<{
    name: string;
    student_group_name: string;
    program: string | null;
    academic_year: string | null;
  }>;
  instructors: Array<{ name: string; instructor_name: string }>;
  rooms: Array<{ name: string; room_name: string | null }>;
  courses: string[];
  defaultAcademicYear: string | null;
  defaultAcademicTerm: string | null;
}

/**
 * Options for the timetable grid, narrowed to one class when given.
 *
 * The class matters: without it the server returns every course in the school,
 * so a timetabler building a Grade 1 week is offered the secondary syllabus.
 * Passing the group makes the backend return that programme's courses only.
 */
export function useGridOptions(studentGroup?: string) {
  return useQuery<GridOptions>({
    queryKey: ["grid-options", studentGroup ?? null],
    queryFn: () =>
      apiGet<GridOptions>(
        "timetable_grid.grid_options",
        studentGroup ? { student_group: studentGroup } : {},
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export interface PatternResult {
  slots: GridSlot[];
  periods: GridPeriod[];
  days: Array<{ value: string; label: string }>;
  studentGroup: string | null;
  instructor: string | null;
}

export function usePattern(params: { student_group?: string; instructor?: string }) {
  const enabled = Boolean(params.student_group || params.instructor);
  return useQuery<PatternResult>({
    queryKey: ["timetable-pattern", params],
    queryFn: () =>
      apiGet<PatternResult>("timetable_grid.get_pattern", {
        ...(params.student_group ? { student_group: params.student_group } : {}),
        ...(params.instructor ? { instructor: params.instructor } : {}),
      }),
    enabled,
  });
}

export interface ConflictItem {
  kind: string;
  label: string;
  detail: string;
  with?: string | null;
}

export interface ConflictReport {
  conflicts: Record<string, ConflictItem[]>;
  summary: {
    total: number;
    lessons: number;
    byKind: Array<{ kind: string; label: string; count: number }>;
  };
}

export function useCheckSlots() {
  return useMutation({
    mutationFn: (vars: { student_group: string; slots: GridSlot[] }) =>
      apiPost<ConflictReport>(
        "timetable_grid.check_slots",
        vars as unknown as Record<string, unknown>,
      ),
  });
}

export function useSavePattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { student_group: string; slots: GridSlot[] }) =>
      apiPost<{ studentGroup: string; slots: number; lessons: LessonSync | null }>(
        "timetable_grid.save_pattern",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timetable-pattern"] });
      void qc.invalidateQueries({ queryKey: ["timetable"] });
    },
  });
}

export function useGenerateLessons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      from_date?: string;
      to_date?: string;
      // Who may read the generated week; defaults to draft on the server.
      audience?: TimetableAudience;
    }) =>
      apiPost<{
        created: number;
        removed: number;
        from: string;
        to: string;
        skipped: Array<{ date: string; course: string; reason: string }>;
      }>("timetable_grid.generate_lessons", vars as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timetable"] }),
  });
}

/* --------------------------------------------------------- day exceptions */

export interface DayLesson {
  id: string;
  date: string;
  studentGroup: string | null;
  course: string | null;
  instructor: string | null;
  instructorName: string | null;
  room: string | null;
  from: string;
  to: string;
  cancelled: boolean;
  change: {
    id: string;
    type: string;
    typeLabel: string;
    originalInstructor: string | null;
    originalInstructorName: string | null;
    originalRoom: string | null;
    reason: string | null;
    reasonLabel: string | null;
    notes: string | null;
  } | null;
}

export function useDayLessons(params: {
  date: string;
  student_group?: string;
  instructor?: string;
}) {
  return useQuery<{
    date: string;
    lessons: DayLesson[];
    changeTypes: Array<{ value: string; label: string }>;
    reasons: Array<{ value: string; label: string }>;
  }>({
    queryKey: ["day-lessons", params],
    queryFn: () =>
      apiGet("lesson_changes.day_lessons", {
        date: params.date,
        ...(params.student_group ? { student_group: params.student_group } : {}),
        ...(params.instructor ? { instructor: params.instructor } : {}),
      }),
    enabled: Boolean(params.date),
  });
}

export interface SwapCandidate extends DayLesson {
  /** Whether this swap can actually be made. */
  available: boolean;
  /** Why not, when it cannot. */
  reason?: string;
}

/** The lessons this one could trade teachers with, and which are possible. */
export function useSwapCandidates(courseSchedule: string | null) {
  return useQuery<{
    lesson: DayLesson;
    candidates: SwapCandidate[];
    availableCount: number;
  }>({
    queryKey: ["swap-candidates", courseSchedule],
    queryFn: () => apiGet("lesson_changes.swap_candidates", { course_schedule: courseSchedule! }),
    enabled: Boolean(courseSchedule),
  });
}

export function useAvailableInstructors(courseSchedule: string | null) {
  return useQuery<{
    available: Array<{ id: string; name: string }>;
    busy: Array<{ id: string; name: string; reason?: string }>;
  }>({
    queryKey: ["available-instructors", courseSchedule],
    queryFn: () =>
      apiGet("lesson_changes.available_instructors", {
        course_schedule: courseSchedule!,
      }),
    enabled: Boolean(courseSchedule),
  });
}

function invalidateDay(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["day-lessons"] });
  void qc.invalidateQueries({ queryKey: ["cover-report"] });
  void qc.invalidateQueries({ queryKey: ["timetable"] });
}

export function useRecordChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      course_schedule: string;
      change_type: string;
      instructor?: string;
      room?: string;
      reason?: string;
      notes?: string;
    }) => apiPost("lesson_changes.record_change", vars as unknown as Record<string, unknown>),
    onSuccess: () => invalidateDay(qc),
  });
}

export function useUndoChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change: string) => apiPost("lesson_changes.undo_change", { change }),
    onSuccess: () => invalidateDay(qc),
  });
}

export function useSwapLessons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { first: string; second: string; reason?: string }) =>
      apiPost("lesson_changes.swap_lessons", vars as unknown as Record<string, unknown>),
    onSuccess: () => invalidateDay(qc),
  });
}

export interface CoverReport {
  entries: Array<{
    id: string;
    date: string;
    type: string;
    typeLabel: string;
    covered: string | null;
    coveredFor: string | null;
    studentGroup: string | null;
    course: string | null;
    reason: string | null;
  }>;
  byCovering: Array<{ instructor: string; periods: number }>;
  byAbsent: Array<{ instructor: string; periods: number }>;
  total: number;
}

export function useCoverReport(params: { from_date?: string; to_date?: string } = {}) {
  return useQuery<CoverReport>({
    queryKey: ["cover-report", params],
    queryFn: () =>
      apiGet<CoverReport>(
        "lesson_changes.cover_report",
        Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>,
      ),
  });
}

// --- Account security -------------------------------------------------------

export type SignInEntry = {
  id: string;
  operation: string;
  success: boolean;
  status: string;
  ip: string;
  at: string;
};

export type DeviceInfo = {
  browser: string;
  os: string;
  isMobile: boolean;
  label: string;
  labelAr: string;
};

export type ActiveSession = {
  ref: string;
  isCurrent: boolean;
  ip: string;
  lastActive: string | null;
  device: DeviceInfo;
};

export function useSessionStatus() {
  return useQuery<{
    serverTime: string;
    expirySeconds: number;
    remainingSeconds: number;
    lastActivity: string | null;
  }>({
    queryKey: ["session-status"],
    queryFn: () => apiGet("security.session_status"),
    // Re-anchor to the server clock periodically; the countdown ticks locally.
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}

export function useSignInHistory() {
  return useQuery<{
    history: SignInEntry[];
    lastSignIn: SignInEntry | null;
    currentSignIn: SignInEntry | null;
    failedAttempts: number;
  }>({
    queryKey: ["sign-in-history"],
    queryFn: () => apiGet("security.sign_in_history"),
  });
}

export function useActiveSessions() {
  return useQuery<{
    sessions: ActiveSession[];
    total: number;
    expirySeconds: number;
  }>({
    queryKey: ["active-sessions"],
    queryFn: () => apiGet("security.active_sessions"),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ revoked: number }>("security.revoke_other_sessions", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-sessions"] });
      qc.invalidateQueries({ queryKey: ["sign-in-history"] });
    },
  });
}

export function useFailedLoginReport(days = 7) {
  return useQuery<{
    entries: Array<{ user: string; ip: string; attempts: number; lastAttempt: string }>;
    totalAttempts: number;
    distinctAccounts: number;
    distinctIps: number;
    days: number;
  }>({
    queryKey: ["failed-login-report", days],
    queryFn: () => apiGet("security.failed_login_report", { days: String(days) }),
  });
}

// --- Dossiers ---------------------------------------------------------------
// One request that carries everything the school knows about a person, so the
// profile screens do not fan out into a dozen calls.

export type StudentDossier = {
  profile: {
    id: string;
    name: string;
    gender: string;
    image: string | null;
    birthDate: string;
    age: number | null;
    email: string | null;
    phone: string | null;
    joined: string;
    address: string;
    city: string | null;
    nationality: string | null;
    bloodGroup: string | null;
    active: boolean;
    hasLogin: boolean;
    grade: string | null;
    section: string | null;
    academicYear: string | null;
  };
  enrollments: Array<{
    id: string;
    program: string;
    academicYear: string;
    academicTerm: string | null;
    batch: string | null;
    date: string;
    submitted: boolean;
  }>;
  guardians: Array<{
    id: string;
    name: string;
    relation: string | null;
    phone: string | null;
    email: string | null;
    occupation: string | null;
    hasLogin: boolean;
  }>;
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    rate: number;
    recent: Array<{
      id: string;
      date: string;
      status: string;
      /** The status in Arabic ("غائب بعذر"), from the server. */
      status_label?: string;
      /** Why an excused absence was excused, when a reason was recorded. */
      reason?: string | null;
      group: string | null;
      lesson: string | null;
    }>;
  };
  grades: {
    average: number | null;
    results: Array<{
      id: string;
      course: string;
      plan: string | null;
      academicYear: string | null;
      academicTerm: string | null;
      score: number;
      maxScore: number;
      percentage: number | null;
      grade: string | null;
      group: string | null;
    }>;
    gradebook: Array<{
      id: string;
      course: string;
      component: string;
      type: string | null;
      score: number;
      maxScore: number;
      percentage: number;
      academicTerm: string | null;
    }>;
  };
  courses: Array<{
    id: string;
    course: string;
    program: string | null;
    enrollment: string | null;
    date: string;
  }>;
  behaviour: {
    positivePoints: number;
    negativePoints: number;
    net: number;
    records: Array<{
      id: string;
      date: string;
      type: string | null;
      points: number;
      category: string | null;
      description: string | null;
      action: string | null;
      parentNotified: boolean;
      reportedBy: string | null;
    }>;
  };
  health: {
    record: {
      id: string;
      bloodGroup: string | null;
      heightCm: number | null;
      weightKg: number | null;
      conditions: string | null;
      allergies: string | null;
      medications: string | null;
      specialNeeds: string | null;
      immunisations: string | null;
      lastCheckup: string;
      emergencyContact: string | null;
      emergencyPhone: string | null;
      physician: string | null;
      physicianPhone: string | null;
      notes: string | null;
    } | null;
    visits: Array<{
      id: string;
      date: string;
      type: string | null;
      complaint: string | null;
      treatment: string | null;
      outcome: string | null;
      parentNotified: boolean;
    }>;
  };
  assignments: {
    submitted: number;
    graded: number;
    averagePercent: number | null;
    items: Array<{
      id: string;
      assignment: string;
      title: string | null;
      status: string | null;
      submittedOn: string;
      score: number;
      maxScore: number;
      feedback: string | null;
    }>;
  };
  quizzes: Array<{
    id: string;
    quiz: string;
    title: string | null;
    attempt: number;
    status: string | null;
    submittedOn: string;
    score: number;
    total: number;
    percentage: number;
    passed: boolean;
  }>;
  /** Null for a teacher: fees are between the office and the family. */
  billing: {
    billed: number;
    paid: number;
    outstanding: number;
    invoices: Array<{
      id: string;
      date: string;
      dueDate: string;
      total: number;
      outstanding: number;
      status: string | null;
      draft: boolean;
      overdueDays: number;
      enrollment: string | null;
    }>;
  } | null;
  services: {
    library: Array<{
      id: string;
      book: string;
      status: string | null;
      issued: string;
      due: string;
      returned: string;
      overdue: boolean;
    }>;
    transport: Array<{
      id: string;
      route: string | null;
      stop: string | null;
      active: boolean;
      from: string;
      to: string;
    }>;
    activities: Array<{
      id: string;
      activity: string;
      status: string | null;
      consent: string | null;
      enrolledOn: string;
      attended: boolean;
    }>;
  };
  alerts: Array<{
    id: string;
    rule: string | null;
    title: string | null;
    status: string | null;
    severity: string | null;
    raisedOn: string;
    resolvedOn: string;
  }>;
  /** Dated lessons. Kept as an array so an older bundle keeps working. */
  timetable: Array<{
    id: string;
    course: string;
    date: string;
    from: string;
    to: string;
    instructor: string | null;
    room: string | null;
    group: string | null;
  }>;
  /** The same lessons collapsed onto a weekly grid. */
  timetableGrid: {
    days: Array<{ value: string; label: string }>;
    periods: string[];
    /** The rows of the grid: every period of the school day with the times
     *  this class runs them at, whether or not a lesson falls in them. */
    periodRows?: Array<{ order: number; from: string; to: string }>;
    cells: Array<{
      day: string;
      from: string;
      to: string;
      course: string;
      instructor: string | null;
      room: string | null;
      group: string | null;
    }>;
    lessons: Array<{
      id: string;
      course: string;
      date: string;
      from: string;
      to: string;
      instructor: string | null;
      room: string | null;
      group: string | null;
    }>;
  };
};

export type TeacherDossier = {
  profile: {
    id: string;
    name: string;
    employee: string | null;
    department: string | null;
    status: string | null;
    image: string | null;
    gender: string;
    designation: string | null;
    email: string | null;
    phone: string | null;
    joined: string;
    birthDate: string;
    hasLogin: boolean;
  };
  summary: { groups: number; students: number; lessons: number; periodsPerWeek: number };
  groups: Array<{
    id: string;
    name: string;
    program: string | null;
    batch: string | null;
    academicYear: string | null;
    students: number;
    active: boolean;
  }>;
  lessons: Array<{
    id: string;
    course: string;
    date: string;
    from: string;
    to: string;
    room: string | null;
    group: string | null;
  }>;
  loads: Array<{
    id: string;
    course: string;
    periodsPerWeek: number;
    maxPerDay: number;
    room: string | null;
    section: string | null;
    planName: string | null;
    plan: string;
  }>;
  observations: Array<{
    id: string;
    date: string;
    observer: string | null;
    rating: string | null;
    summary: string | null;
    status: string | null;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    course: string | null;
    dueDate: string;
    status: string | null;
  }>;
};

export function useStudentDossier(student: string | undefined) {
  return useQuery<StudentDossier>({
    queryKey: ["student-dossier", student],
    queryFn: () => apiGet<StudentDossier>("dossier.student_dossier", { student: student! }),
    enabled: !!student,
  });
}

export function useTeacherDossier(instructor: string | undefined) {
  return useQuery<TeacherDossier>({
    queryKey: ["teacher-dossier", instructor],
    queryFn: () => apiGet<TeacherDossier>("dossier.teacher_dossier", { instructor: instructor! }),
    enabled: !!instructor,
  });
}

// --- Section assignment -----------------------------------------------------

export type SectionStudent = {
  row: string;
  id: string;
  name: string;
  rollNumber: number | null;
  active: boolean;
};

export type SectionInfo = {
  id: string;
  name: string;
  batch: string | null;
  academicYear: string | null;
  academicTerm: string | null;
  capacity: number | null;
  count: number;
  spaceLeft: number | null;
  students: SectionStudent[];
};

export type ProgramSections = {
  program: string;
  academicYear: string | null;
  sections: SectionInfo[];
  unassigned: Array<{ id: string; name: string; batch: string | null }>;
  totals: { sections: number; placed: number; unassigned: number };
};

export function useProgramSections(program?: string, academicYear?: string) {
  return useQuery<ProgramSections>({
    queryKey: ["program-sections", program, academicYear],
    queryFn: () =>
      apiGet<ProgramSections>("sections.program_sections", {
        program: program!,
        ...(academicYear ? { academic_year: academicYear } : {}),
      }),
    enabled: !!program,
  });
}

export function useSectionOptions() {
  return useQuery<{
    programs: string[];
    academicYears: string[];
    academicTerms: string[];
    batches: string[];
  }>({
    queryKey: ["section-options"],
    queryFn: () => apiGet("sections.section_options"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Every mutation invalidates the same view, so the board always redraws. */
function useSectionMutation<V>(method: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) =>
      apiPost<{ message_ar?: string }>(method, vars as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["program-sections"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export const useAssignStudents = () =>
  useSectionMutation<{ students: string[]; section: string }>("sections.assign_students");

export const useMoveStudents = () =>
  useSectionMutation<{ students: string[]; from_section: string; to_section: string }>(
    "sections.move_students",
  );

export const useSwapStudents = () =>
  useSectionMutation<{ student_a: string; student_b: string }>("sections.swap_students");

export const useWithdrawStudents = () =>
  useSectionMutation<{ students: string[]; section: string }>("sections.withdraw_students");

export const useDistributeStudents = () =>
  useSectionMutation<{
    program: string;
    academic_year?: string;
    sections: string[];
    strategy: string;
  }>("sections.distribute_students");

export const useSaveSection = () =>
  useSectionMutation<{
    name?: string;
    student_group_name?: string;
    program?: string;
    batch?: string;
    academic_year?: string;
    max_strength?: number;
    disabled?: number;
  }>("sections.save_section");

// --- Academic context: school identity, period, holidays --------------------

export type AcademicContext = {
  school: { name: string; logo: string | null; email: string | null; phone: string | null };
  academicYear: string | null;
  academicTerm: string | null;
  years: Array<{ name: string; from: string; to: string; closed: boolean }>;
  terms: Array<{
    name: string;
    label: string;
    academicYear: string;
    from: string;
    to: string;
    closed: boolean;
  }>;
  closed: boolean;
  canWrite: boolean;
  readOnlyReason: string | null;
  today: string;
  todayIsHoliday: boolean;
  todayHolidayReason: string | null;
};

export function useAcademicContext() {
  return useQuery<AcademicContext>({
    queryKey: ["academic-context"],
    queryFn: () => apiGet<AcademicContext>("academic_context.get_context"),
    staleTime: 60 * 1000,
  });
}

export function useSetPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { academic_year?: string; academic_term?: string }) =>
      apiPost<{ academicYear: string; academicTerm: string; closed: boolean }>(
        "academic_context.set_period",
        vars as Record<string, unknown>,
      ),
    // The period scopes every screen, so everything is refetched rather than
    // leaving a page showing last term's data.
    onSuccess: () => qc.invalidateQueries(),
  });
}

export type HolidayRow = {
  id: string;
  date: string;
  description: string | null;
  weeklyOff: boolean;
  past: boolean;
};

export function useHolidays() {
  return useQuery<{
    list: string | null;
    listName?: string;
    range: { from: string; to: string } | null;
    weeklyOff?: string;
    canEdit: boolean;
    holidays: HolidayRow[];
  }>({
    queryKey: ["holidays"],
    queryFn: () => apiGet("academic_context.holidays"),
  });
}

export function useUpcomingHolidays(days = 30) {
  return useQuery<{
    holidays: Array<{ date: string; reason: string; inDays: number; isToday: boolean }>;
    today: string;
    todayIsHoliday: boolean;
    todayReason: string | null;
  }>({
    queryKey: ["upcoming-holidays", days],
    queryFn: () => apiGet("academic_context.upcoming_holidays", { days: String(days) }),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSaveHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { date: string; description?: string; holiday?: string }) =>
      apiPost<{ message_ar?: string }>(
        "academic_context.save_holiday",
        vars as Record<string, unknown>,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
      qc.invalidateQueries({ queryKey: ["upcoming-holidays"] });
    },
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (holiday: string) =>
      apiPost<{ message_ar?: string }>("academic_context.delete_holiday", { holiday }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
      qc.invalidateQueries({ queryKey: ["upcoming-holidays"] });
    },
  });
}

// --- Attachments ------------------------------------------------------------

export type Attachment = {
  id: string;
  fileName: string;
  url: string;
  size: number;
  sizeLabel: string;
  isPrivate: boolean;
  extension: string;
  uploadedBy: string;
  uploadedOn: string;
};

export function useAttachments(doctype: string | undefined, name: string | undefined) {
  return useQuery<{
    doctype: string;
    name: string;
    label: string;
    canWrite: boolean;
    attachments: Attachment[];
    total: number;
    maxBytes: number;
    allowed: string[];
  }>({
    queryKey: ["attachments", doctype, name],
    queryFn: () => apiGet("attachments.list_attachments", { doctype: doctype!, name: name! }),
    enabled: !!doctype && !!name,
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachment: string) =>
      apiPost<{ message_ar?: string }>("attachments.delete_attachment", { attachment }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments"] }),
  });
}

/** Release a component's marks to students, or take them back. */
export function usePublishComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      component_name: string;
      academic_term?: string;
      published: number;
    }) =>
      apiPost<{ published: boolean; count: number; message_ar?: string }>(
        "gradebook.publish_component",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gradebook-sheet"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
    },
  });
}

// --- Grade appeals and scheduled release ------------------------------------

export type MarkChange = {
  id: string;
  student: string;
  studentName: string;
  component: string;
  from: number | null;
  to: number | null;
  maxScore: number;
  by: string;
  at: string;
};

export function useMarkChangeLog(
  student_group: string | undefined,
  course: string | undefined,
  // Without the term the log reads every term's entries for this class and
  // course at once, so a second term would show last term's corrections too.
  academic_term?: string | undefined,
) {
  return useQuery<{
    changes: MarkChange[];
    changedStudents: string[];
    total: number;
    reopen: { on: string; by: string; reason: string; status: string } | null;
  }>({
    queryKey: ["mark-changes", student_group, course, academic_term ?? null],
    queryFn: () =>
      apiGet("grade_appeals.change_log", {
        student_group: student_group!,
        course: course!,
        ...(academic_term ? { academic_term } : {}),
      }),
    enabled: !!student_group && !!course,
  });
}

export function useReopenForAppeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      academic_term?: string;
      reason: string;
    }) =>
      apiPost<{ status: string; hidden: number; message_ar?: string }>(
        "grade_appeals.reopen_for_appeal",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useScheduleRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      component_name: string;
      release_on?: string;
    }) =>
      apiPost<{ releaseOn: string | null; count: number; message_ar?: string }>(
        "grade_appeals.schedule_release",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gradebook-sheet"] });
      qc.invalidateQueries({ queryKey: ["term-grades"] });
    },
  });
}

/** Where a student stands in their class — no other student is named. */
export function useClassStanding(student: string | undefined) {
  return useQuery<{
    available: boolean;
    reason?: string;
    studentAverage?: number;
    classAverage?: number;
    difference?: number;
    rank?: number;
    classSize?: number;
    highest?: number;
    lowest?: number;
    topPercent?: number;
  }>({
    queryKey: ["class-standing", student],
    queryFn: () => apiGet("gradebook.class_standing", { student: student! }),
    enabled: !!student,
  });
}

/** Unread message counts per child, for the family inbox switcher. */
export function useUnreadByChild() {
  return useQuery<{
    children: Array<{ id: string; name: string; unread: number }>;
    general: number;
    total: number;
  }>({
    queryKey: ["unread-by-child"],
    queryFn: () => apiGet("communication.unread_by_child"),
    refetchInterval: 60 * 1000,
  });
}

// --- Assessment plan: quarters, the tree, and how marks are counted ---------

export type Quarter = {
  name: string;
  totalMarks: number;
  from: string;
  to: string;
  idx: number;
};

export type PlanAssessment = {
  name: string;
  type: string | null;
  maxScore: number;
  parent?: string;
};

export type PlanCategory = {
  name: string;
  type: string | null;
  quarter: string | null;
  weight: number;
  maxScore: number;
  children: PlanAssessment[];
};

export type PlanQuarter = Quarter & {
  categories: PlanCategory[];
  weightUsed: number;
  balanced: boolean;
};

export function useQuarters(academicTerm?: string) {
  return useQuery<{
    academicTerm: string | null;
    termName?: string;
    quarters: Quarter[];
    total: number;
    canEdit: boolean;
  }>({
    queryKey: ["quarters", academicTerm ?? "current"],
    queryFn: () =>
      apiGet("assessment_plan.get_quarters", academicTerm ? { academic_term: academicTerm } : {}),
  });
}

export function useSaveQuarters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      academic_term?: string;
      quarters: Array<{ name: string; totalMarks: number }>;
    }) =>
      apiPost<{ quarters: number; total: number; message_ar?: string }>(
        "assessment_plan.save_quarters",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quarters"] });
      qc.invalidateQueries({ queryKey: ["assessment-plan"] });
    },
  });
}

export function useAssessmentPlan(course?: string, academicTerm?: string) {
  return useQuery<{
    course: string;
    academicTerm: string | null;
    scheme: string | null;
    schemeName: string | null;
    quarters: PlanQuarter[];
    unassigned: PlanCategory[];
    orphans: PlanAssessment[];
    canEdit: boolean;
  }>({
    queryKey: ["assessment-plan", course, academicTerm ?? "current"],
    queryFn: () =>
      apiGet("assessment_plan.get_plan", {
        course: course!,
        ...(academicTerm ? { academic_term: academicTerm } : {}),
      }),
    enabled: !!course,
  });
}

export function useSaveAssessmentPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      course: string;
      academic_term?: string;
      scheme_name?: string;
      categories: Array<{
        quarter: string;
        name: string;
        type?: string;
        weight: number;
        children: Array<{ name: string; maxScore: number }>;
      }>;
    }) =>
      apiPost<{ scheme: string; categories: number; assessments: number; message_ar?: string }>(
        "assessment_plan.save_plan",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-plan"] }),
  });
}

// --- Assessment plan templates ------------------------------------------

/** A category in a template; `q` is the quarter's position (0 = first). */
export type TemplateCategory = {
  q: number;
  name: string;
  type: string;
  weight: number;
  children: Array<{ name: string; maxScore: number }>;
};

export type PlanTemplateSummary = {
  id: string;
  name: string;
  description: string;
  quarterTotals: number[];
  categories: number;
  assessments: number;
  modified: string;
  owner: string;
};

export function usePlanTemplates() {
  return useQuery<{ templates: PlanTemplateSummary[]; canEdit: boolean }>({
    queryKey: ["plan-templates"],
    queryFn: () => apiGet("assessment_plan.list_plan_templates"),
  });
}

/** A template as written (`rows`) and as it lands on this term (`applied`). */
export function usePlanTemplate(template?: string | null) {
  return useQuery<
    PlanTemplateSummary & {
      rows: TemplateCategory[];
      applied: {
        categories: Array<{
          quarter: string;
          name: string;
          type: string;
          weight: number;
          children: Array<{ name: string; maxScore: number }>;
        }>;
        problems: string[];
        notes: string[];
      };
    }
  >({
    queryKey: ["plan-template", template],
    queryFn: () => apiGet("assessment_plan.get_plan_template", { template: template! }),
    enabled: !!template,
  });
}

export function useSavePlanTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      template?: string;
      name: string;
      description?: string;
      quarter_totals: number[];
      categories: TemplateCategory[];
    }) =>
      apiPost<PlanTemplateSummary>(
        "assessment_plan.save_plan_template",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-templates"] });
      qc.invalidateQueries({ queryKey: ["plan-template"] });
    },
  });
}

export function useDeletePlanTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (template: string) =>
      apiPost<{ id: string }>("assessment_plan.delete_plan_template", { template }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan-templates"] }),
  });
}

export function useApplyPlanTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { template: string; courses: string[]; overwrite?: boolean }) =>
      apiPost<{
        results: Array<{
          course: string;
          status: "applied" | "skipped" | "failed";
          message: string;
        }>;
        applied: number;
        notes: string[];
      }>("assessment_plan.apply_plan_template", {
        template: vars.template,
        courses: vars.courses,
        overwrite: vars.overwrite ? 1 : 0,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-plan"] }),
  });
}

export type GradeRule = {
  id: string;
  quarter: string | null;
  category: string;
  mode: string;
  modeLabel: string;
  n: number;
  setBy: string | null;
  setOn: string;
  notes: string | null;
};

export function useGradeRules(studentGroup?: string, course?: string) {
  return useQuery<{ rules: GradeRule[]; modes: Array<{ value: string; label: string }> }>({
    queryKey: ["grade-rules", studentGroup, course],
    queryFn: () =>
      apiGet("assessment_plan.get_rules", { student_group: studentGroup!, course: course! }),
    enabled: !!studentGroup && !!course,
  });
}

export function useSaveGradeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      course: string;
      category: string;
      quarter?: string;
      count_mode: string;
      count_n?: number;
    }) =>
      apiPost<{ id: string; message_ar?: string }>(
        "assessment_plan.save_rule",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grade-rules"] });
      qc.invalidateQueries({ queryKey: ["computed-marks"] });
    },
  });
}

export type ComputedAssessment = {
  name: string;
  score: number;
  maxScore: number;
  percent: number;
  missing: boolean;
};

export type ComputedCategory = {
  category: string;
  weight: number;
  percent: number;
  earned: number;
  rule: string;
  ruleLabel: string;
  ruleN: number;
  counted: ComputedAssessment[];
  dropped: ComputedAssessment[];
};

export type ComputedStudent = {
  student: string;
  studentName: string;
  quarters: Array<{
    quarter: string;
    totalMarks: number;
    percent: number;
    marks: number;
    categories: ComputedCategory[];
  }>;
  marks: number;
  totalMarks: number;
  percent: number;
};

export function useComputedMarks(studentGroup?: string, course?: string, student?: string) {
  return useQuery<{
    students: ComputedStudent[];
    quarters: Array<{ name: string; totalMarks: number }>;
    rules: GradeRule[];
  }>({
    queryKey: ["computed-marks", studentGroup, course, student ?? "all"],
    queryFn: () =>
      apiGet("assessment_plan.compute_marks", {
        student_group: studentGroup!,
        course: course!,
        ...(student ? { student } : {}),
      }),
    enabled: !!studentGroup && !!course,
  });
}

// --- Quarter results and the two-month report card --------------------------

export function useQuarterResults(studentGroup?: string, quarter?: string, course?: string) {
  return useQuery<{
    quarter: string;
    quarterTotal: number;
    courses: string[];
    students: Array<{
      student: string;
      studentName: string;
      subjects: Record<string, { marks: number; totalMarks: number; percent: number }>;
      total: number;
      outOf: number;
      average: number;
    }>;
    classAverage: number;
  }>({
    queryKey: ["quarter-results", studentGroup, quarter, course ?? "all"],
    queryFn: () =>
      apiGet("export.quarter_results", {
        student_group: studentGroup!,
        quarter: quarter!,
        ...(course ? { course } : {}),
      }),
    enabled: !!studentGroup && !!quarter,
  });
}

// --- Logins: issuing and resetting ------------------------------------------

export type PersonAccount = {
  user: string;
  username: string;
  name: string;
  enabled: boolean;
  lastLogin: string;
  mustChange: boolean;
};

export type IssuedCredentials = {
  user: string;
  username: string;
  password: string;
  name: string;
};

export function usePersonAccount(doctype?: string, name?: string) {
  return useQuery<{
    doctype: string;
    name: string;
    label: string;
    hasAccount: boolean;
    account: PersonAccount | null;
  }>({
    queryKey: ["person-account", doctype, name],
    queryFn: () => apiGet("credentials.account_for", { doctype: doctype!, name: name! }),
    enabled: !!doctype && !!name,
  });
}

export function useIssueAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { doctype: string; name: string }) =>
      apiPost<{ credentials: IssuedCredentials; message_ar?: string }>(
        "credentials.issue_account",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["person-account"] }),
  });
}

export function useResetAccountPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { doctype: string; name: string }) =>
      apiPost<{ credentials: IssuedCredentials; message_ar?: string }>(
        "credentials.reset_account_password",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["person-account"] }),
  });
}

export type GuardianDossier = {
  profile: {
    id: string;
    name: string;
    idNumber: string | null;
    email: string | null;
    phone: string | null;
    altPhone: string | null;
    birthDate: string;
    nationality: string | null;
    gender: string;
    bloodGroup: string | null;
    education: string | null;
    occupation: string | null;
    designation: string | null;
    workAddress: string | null;
    image: string | null;
    hasLogin: boolean;
  };
  children: Array<{
    id: string;
    name: string;
    image: string | null;
    active: boolean;
    relation: string | null;
    program: string | null;
    batch: string | null;
    academicYear: string | null;
    attendanceRate: number;
    absences: number;
    outstanding: number;
  }>;
  summary: { children: number; outstanding: number; needsAttention: number };
};

export function useGuardianDossier(guardian: string | undefined) {
  return useQuery<GuardianDossier>({
    queryKey: ["guardian-dossier", guardian],
    queryFn: () => apiGet<GuardianDossier>("dossier.guardian_dossier", { guardian: guardian! }),
    enabled: !!guardian,
  });
}

/* -------------------------------------------------------------------------
 * Mail: templates, preview, scheduling
 * ---------------------------------------------------------------------- */

export interface MailTemplate {
  name: string;
  title: string;
  category: string;
  subject: string;
  body: string;
  is_shared: number;
  use_count: number;
  mine: boolean;
  owner_name: string | null;
}

export function useMailTemplates() {
  return useQuery<{
    templates: MailTemplate[];
    placeholders: Array<{ token: string; field: string }>;
  }>({
    queryKey: ["mail-templates"],
    queryFn: () => apiGet("mail.list_templates"),
  });
}

export function useSaveMailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      template?: string;
      title: string;
      category?: string;
      subject?: string;
      body?: string;
      is_shared?: number;
    }) =>
      apiPost<{ id: string }>("mail.save_template", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mail-templates"] }),
  });
}

export function useDeleteMailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { template: string }) =>
      apiPost<Record<string, never>>(
        "mail.delete_template",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mail-templates"] }),
  });
}

/** Fill a template's placeholders on the server, where they have one meaning. */
export function useApplyMailTemplate() {
  return useMutation({
    mutationFn: (vars: {
      template: string;
      student?: string;
      student_group?: string;
      course?: string;
    }) =>
      apiPost<{ subject: string; body: string; title: string }>(
        "mail.apply_template",
        vars as unknown as Record<string, unknown>,
      ),
  });
}

export interface RecipientPreview {
  user: string;
  name: string;
  kind: "student" | "guardian" | "staff";
  copy: "to" | "cc" | "bcc";
  enabled: boolean;
}

/** Who this message would actually reach, resolved by the code that sends it. */
export function usePreviewRecipients() {
  return useMutation({
    mutationFn: (vars: {
      to?: string[];
      cc?: string[];
      bcc?: string[];
      audience?: string;
      audience_groups?: string[];
      copy_guardians?: number;
    }) =>
      apiPost<{
        recipients: RecipientPreview[];
        total: number;
        groups: Array<{ kind: string; label: string; count: number }>;
        disabled: number;
      }>("mail.preview_recipients", { payload: vars } as unknown as Record<string, unknown>),
  });
}

export function useCancelSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { message: string }) =>
      apiPost<{ id: string }>("mail.cancel_schedule", vars as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mail-list"] });
      void qc.invalidateQueries({ queryKey: ["mail-folders"] });
    },
  });
}

/* -------------------------------------------------------------------------
 * Office hours and appointments
 * ---------------------------------------------------------------------- */

export interface OfficeHour {
  id?: string;
  day: string;
  day_label?: string;
  from_time: string;
  to_time: string;
  slot_minutes: number;
  location: string | null;
  is_active: boolean;
  allow_students: boolean;
  allow_guardians: boolean;
  notes: string | null;
}

export function useMyOfficeHours(staff?: string) {
  return useQuery<{
    staff_user: string;
    hours: OfficeHour[];
    days: Array<{ key: string; label: string }>;
    teaching: Array<{
      day: string;
      from_time: string;
      to_time: string;
      course: string;
      student_group: string;
    }>;
  }>({
    queryKey: ["office-hours", staff ?? "me"],
    queryFn: () => apiGet("appointments.my_office_hours", staff ? { staff } : {}),
  });
}

export function useSaveOfficeHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { hours: OfficeHour[]; staff_user?: string }) =>
      apiPost<{ count: number }>("appointments.save_office_hours", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["office-hours"] });
      void qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useBookableStaff(search?: string) {
  return useQuery<{
    staff: Array<{ user: string; name: string; has_hours: boolean; subjects: string[] }>;
  }>({
    queryKey: ["bookable-staff", search ?? ""],
    queryFn: () => apiGet("appointments.staff_directory", search ? { search } : {}),
  });
}

export interface AvailabilityDay {
  date: string;
  day: string;
  day_label: string;
  slots: Array<{
    from_time: string;
    to_time: string;
    office_hour: string;
    location: string | null;
  }>;
}

export function useAvailability(staff: string | undefined, days = 14) {
  return useQuery<{
    staff: string;
    staff_name: string;
    days: AvailabilityDay[];
    has_hours: boolean;
  }>({
    queryKey: ["availability", staff ?? null, days],
    queryFn: () => apiGet("appointments.availability", { staff: staff!, days }),
    enabled: Boolean(staff),
  });
}

export interface Appointment {
  id: string;
  staff_user: string;
  staff_name: string;
  status: string;
  status_label: string;
  status_tone: string;
  date: string;
  day_label: string;
  from_time: string;
  to_time: string;
  requested_by: string;
  requester_name: string;
  requester_role: string;
  student: string | null;
  student_name: string | null;
  student_group: string | null;
  subject: string;
  notes: string | null;
  location: string | null;
  decline_reason: string | null;
  decided_on: string;
  mine: boolean;
  is_staff: boolean;
  can_decide: boolean;
  can_cancel: boolean;
}

export function useAppointments(scope: "all" | "incoming" | "mine" = "all", status?: string) {
  return useQuery<{
    appointments: Appointment[];
    counts: { awaiting_me: number; upcoming: number; mine_open: number };
  }>({
    queryKey: ["appointments", scope, status ?? ""],
    queryFn: () =>
      apiGet("appointments.list_appointments", { scope, ...(status ? { status } : {}) }),
  });
}

export function useBookAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      staff_user: string;
      date: string;
      from_time: string;
      subject: string;
      notes?: string;
      student?: string;
      student_group?: string;
    }) =>
      apiPost<{ id: string }>("appointments.book", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      void qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useSetAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      appointment: string;
      status: string;
      reason?: string;
      location?: string;
    }) =>
      apiPost<{ id: string; status: string }>(
        "appointments.set_status",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      void qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useMyChildren() {
  return useQuery<{
    students: Array<{ id: string; name: string; student_group: string | null }>;
  }>({
    queryKey: ["appointment-students"],
    queryFn: () => apiGet("appointments.my_students"),
  });
}

/* -------------------------------------------------------------------------
 * ملفاتي — the teacher's drive
 * ---------------------------------------------------------------------- */

export interface DriveFile {
  id: string;
  title: string;
  file_url: string;
  file_name: string | null;
  file_size: number;
  kind: string;
  extension: string;
  folder: string | null;
  description: string | null;
  shared_with_staff: boolean;
  is_published: boolean;
  student_group: string | null;
  course: string | null;
  download_count: number;
  modified: string;
  owner_user: string;
  owner_name?: string;
  mine: boolean;
}

export interface DriveFolder {
  id: string;
  title: string;
  parent_folder: string | null;
  colour: string | null;
  file_count: number;
  folder_count: number;
  modified: string;
}

export function useDrive(folder?: string, search?: string) {
  return useQuery<{
    folder: string | null;
    breadcrumb: Array<{ id: string; title: string }>;
    folders: DriveFolder[];
    files: DriveFile[];
    usage: { used: number; quota: number; percent: number; files: number; folders: number };
    searching: boolean;
  }>({
    queryKey: ["drive", folder ?? "root", search ?? ""],
    queryFn: () =>
      apiGet("drive.list_items", {
        ...(folder ? { folder } : {}),
        ...(search ? { search } : {}),
      }),
  });
}

export function useDriveTree() {
  return useQuery<{ folders: Array<{ id: string; title: string; parent_folder: string | null }> }>({
    queryKey: ["drive-tree"],
    queryFn: () => apiGet("drive.folder_tree"),
  });
}

export function useSharedFiles(search?: string) {
  return useQuery<{ files: DriveFile[] }>({
    queryKey: ["drive-shared", search ?? ""],
    queryFn: () => apiGet("drive.shared_with_me", search ? { search } : {}),
  });
}

export function useClassFiles(studentGroup: string | undefined) {
  return useQuery<{ files: DriveFile[] }>({
    queryKey: ["drive-class", studentGroup ?? null],
    queryFn: () => apiGet("drive.class_files", { student_group: studentGroup! }),
    enabled: Boolean(studentGroup),
  });
}

function invalidateDrive(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["drive"] });
  void qc.invalidateQueries({ queryKey: ["drive-tree"] });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { title: string; parent_folder?: string }) =>
      apiPost<{ id: string }>("drive.create_folder", vars as unknown as Record<string, unknown>),
    onSuccess: () => invalidateDrive(qc),
  });
}

export function useRenameDriveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { item: string; kind: "file" | "folder"; title: string }) =>
      apiPost<{ id: string }>("drive.rename_item", vars as unknown as Record<string, unknown>),
    onSuccess: () => invalidateDrive(qc),
  });
}

export function useMoveDriveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { item: string; kind: "file" | "folder"; folder?: string }) =>
      apiPost<{ id: string }>("drive.move_item", vars as unknown as Record<string, unknown>),
    onSuccess: () => invalidateDrive(qc),
  });
}

export function useDeleteDriveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { item: string; kind: "file" | "folder" }) =>
      apiPost<{ id: string }>("drive.delete_item", vars as unknown as Record<string, unknown>),
    onSuccess: () => invalidateDrive(qc),
  });
}

export function useSetDriveSharing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      file: string;
      shared_with_staff?: number;
      is_published?: number;
      student_group?: string;
      course?: string;
      description?: string;
    }) =>
      apiPost<{ id: string }>("drive.set_sharing", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => {
      invalidateDrive(qc);
      void qc.invalidateQueries({ queryKey: ["drive-shared"] });
      void qc.invalidateQueries({ queryKey: ["drive-class"] });
    },
  });
}

/* -------------------------------------------------------------------------
 * Connections from a class
 * ---------------------------------------------------------------------- */

export interface ClassConnection {
  key: string;
  label: string;
  icon: string;
  group: string;
  route: string;
  count: number | null;
  action: boolean;
}

export function useClassConnections(studentGroup: string | undefined) {
  return useQuery<{
    student_group: string;
    name: string;
    program: string | null;
    batch: string | null;
    students: number;
    courses: Array<{ id: string; name: string }>;
    connections: ClassConnection[];
    groups: string[];
  }>({
    queryKey: ["class-connections", studentGroup ?? null],
    queryFn: () => apiGet("connections.for_class", { student_group: studentGroup! }),
    enabled: Boolean(studentGroup),
  });
}

/* -------------------------------------------------------------------------
 * نماذج التقييم — forms a school defines for itself
 * ---------------------------------------------------------------------- */

export interface EvaluationCriterion {
  key: string;
  category: string;
  item: string;
  max_score: number;
  weight: number;
  sort_order: number;
  help_text: string | null;
}

export interface EvaluationScaleOption {
  label: string;
  score: number;
  tone: string;
  sort_order: number;
}

export interface EvaluationForm {
  id: string;
  title: string;
  form_type: string;
  scale_type: string;
  description: string | null;
  is_active: boolean;
  allow_notes: boolean;
  program: string | null;
  student_group: string | null;
  course: string | null;
  criteria: EvaluationCriterion[];
  scale: EvaluationScaleOption[];
  categories: string[];
  max_total: number;
}

export function useEvaluationForms(formType?: string, studentGroup?: string) {
  return useQuery<{
    forms: Array<{
      id: string;
      title: string;
      form_type: string;
      scale_type: string;
      description: string | null;
      is_active: boolean;
      student_group: string | null;
      course: string | null;
      criteria_count: number;
      entry_count: number;
      modified: string;
    }>;
    form_types: string[];
    scale_types: string[];
    presets: Record<string, Array<{ label: string; score: number; tone: string }>>;
  }>({
    queryKey: ["evaluation-forms", formType ?? "", studentGroup ?? ""],
    queryFn: () =>
      apiGet("evaluations.list_forms", {
        ...(formType ? { form_type: formType } : {}),
        ...(studentGroup ? { student_group: studentGroup } : {}),
      }),
  });
}

export function useEvaluationForm(form: string | undefined) {
  return useQuery<EvaluationForm>({
    queryKey: ["evaluation-form", form ?? null],
    queryFn: () => apiGet("evaluations.get_form", { form: form! }),
    enabled: Boolean(form),
  });
}

export function useSaveEvaluationForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Record<string, unknown>) =>
      apiPost<{ id: string; used_by: number }>("evaluations.save_form", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["evaluation-forms"] });
      void qc.invalidateQueries({ queryKey: ["evaluation-form"] });
    },
  });
}

export function useDeleteEvaluationForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { form: string }) =>
      apiPost<{ id: string; deactivated?: boolean }>(
        "evaluations.delete_form",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["evaluation-forms"] }),
  });
}

export interface EvaluationGridStudent {
  id: string;
  name: string;
  roll: number;
  entry: string | null;
  total: number;
  max?: number;
  percent: number;
  notes?: string | null;
  is_published: boolean;
  evaluated_on?: string;
}

export function useEvaluationGrid(form: string | undefined, studentGroup: string | undefined) {
  return useQuery<{
    form: EvaluationForm;
    student_group: string;
    students: EvaluationGridStudent[];
    answers: Record<string, Record<string, { value: string; score: number; note: string | null }>>;
  }>({
    queryKey: ["evaluation-grid", form ?? null, studentGroup ?? null],
    queryFn: () => apiGet("evaluations.grid", { form: form!, student_group: studentGroup! }),
    enabled: Boolean(form && studentGroup),
  });
}

export function useSaveEvaluationGrid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      form: string;
      student_group: string;
      course?: string;
      rows: Record<
        string,
        {
          values: Record<string, { value?: string; score?: number; note?: string }>;
          notes?: string;
        }
      >;
    }) =>
      apiPost<{ saved: number }>("evaluations.save_grid", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["evaluation-grid"] }),
  });
}

export function usePublishEvaluations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { entries: string[]; is_published: number }) =>
      apiPost<{ count: number }>("evaluations.publish_entries", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["evaluation-grid"] });
      void qc.invalidateQueries({ queryKey: ["student-evaluations"] });
    },
  });
}

export function useStudentEvaluations(student: string | undefined, formType?: string) {
  return useQuery<{
    entries: Array<{
      id: string;
      form: string;
      form_title: string;
      form_type: string;
      course: string | null;
      student_group: string | null;
      total: number;
      max: number;
      percent: number;
      notes: string | null;
      is_published: boolean;
      evaluated_on: string;
      answers: Array<{
        category: string;
        item: string;
        value: string;
        score: number;
        note: string | null;
      }>;
    }>;
  }>({
    queryKey: ["student-evaluations", student ?? null, formType ?? ""],
    queryFn: () =>
      apiGet("evaluations.student_evaluations", {
        student: student!,
        ...(formType ? { form_type: formType } : {}),
      }),
    enabled: Boolean(student),
  });
}

/* -------------------------------------------------------------------------
 * Exam conflicts, and a pupil against their class
 * ---------------------------------------------------------------------- */

export interface ExamConflicts {
  students: Array<{
    student: string;
    name: string;
    overlapping: boolean;
    conflicts: Array<{
      exam: string;
      title: string;
      course: string;
      student_group: string;
      from_time: string;
      to_time: string;
      room: string | null;
      overlapping: boolean;
    }>;
  }>;
  total: number;
  exams: number;
  overlapping: number;
  holiday?: string | null;
}

export function useExamConflicts() {
  return useMutation({
    mutationFn: (vars: {
      student_group: string;
      schedule_date: string;
      from_time?: string;
      to_time?: string;
      exam?: string;
    }) => apiGet<ExamConflicts>("exams.check_conflicts", vars),
  });
}

export function useColumnExams(studentGroup: string | undefined, course: string | undefined) {
  return useQuery<{
    exams: Record<
      string,
      {
        id: string;
        title: string;
        date: string;
        from_time: string;
        to_time: string;
        room: string | null;
        max_score: number;
      }
    >;
  }>({
    queryKey: ["column-exams", studentGroup ?? null, course ?? null],
    queryFn: () =>
      apiGet("gradebook.column_exams", { student_group: studentGroup!, course: course! }),
    enabled: Boolean(studentGroup && course),
  });
}

export interface SubjectStanding {
  course: string;
  course_name: string;
  student_percent: number;
  class_average: number | null;
  class_high: number | null;
  gap: number | null;
  band: string;
  band_label: string;
  tone: string;
  sample: number;
  assessments: number;
  rank: number | null;
  of: number;
  percentile: number | null;
}

export function useOverallComparison(student: string | undefined) {
  return useQuery<{
    student: string;
    student_name: string;
    subjects: SubjectStanding[];
    overall: {
      student_percent: number;
      class_average: number | null;
      subjects: number;
      above: number;
      below: number;
      strongest: string | null;
      weakest: string | null;
    } | null;
    min_sample: number;
  }>({
    queryKey: ["comparison-overall", student ?? null],
    queryFn: () => apiGet("comparison.overall_comparison", { student: student! }),
    enabled: Boolean(student),
  });
}

export function useSubjectComparison(student: string | undefined, course: string | undefined) {
  return useQuery<{
    course_name: string;
    assessments: Array<{
      component: string;
      student_percent: number;
      class_average: number | null;
      class_high: number | null;
      class_low: number | null;
      gap: number | null;
      band_label: string;
      tone: string;
      sample: number;
      rank: number | null;
      of: number;
    }>;
    summary: {
      student_percent: number;
      class_average: number | null;
      band_label: string;
      tone: string;
      rank: number | null;
      of: number;
    } | null;
    min_sample: number;
  }>({
    queryKey: ["comparison-subject", student ?? null, course ?? null],
    queryFn: () => apiGet("comparison.subject_comparison", { student: student!, course: course! }),
    enabled: Boolean(student && course),
  });
}

/* -------------------------------------------------------------------------
 * Assignments: marking sheet, questions, solutions
 * ---------------------------------------------------------------------- */

export interface GradingRow {
  student: string;
  name: string;
  roll: number;
  student_group: string;
  group_name: string;
  submission: string | null;
  status: string;
  submitted_on: string;
  viewed_on: string;
  guardian_viewed_on: string;
  is_late: boolean;
  score: number | null;
  max_score: number;
  feedback: string | null;
  teacher_note: string | null;
  content: string | null;
  graded_on: string;
  files: Array<{ file_url: string; file_name: string; file_size: number }>;
}

export function useGradingSheet(assignment: string | undefined, studentGroup?: string) {
  return useQuery<{
    assignment: Record<string, unknown> & { title: string; maximum_score: number };
    groups: Array<{ id: string; name: string }>;
    students: GradingRow[];
    summary: {
      total: number;
      submitted: number;
      missing: number;
      graded: number;
      late: number;
      seen: number;
    };
  }>({
    queryKey: ["grading-sheet", assignment ?? null, studentGroup ?? ""],
    queryFn: () =>
      apiGet("assignments.grading_sheet", {
        assignment: assignment!,
        ...(studentGroup ? { student_group: studentGroup } : {}),
      }),
    enabled: Boolean(assignment),
  });
}

export function useSaveGrades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      assignment: string;
      rows: Record<
        string,
        { score?: number | null; teacher_note?: string; feedback?: string; status?: string }
      >;
    }) =>
      apiPost<{ saved: number }>("assignments.save_grades", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["grading-sheet"] });
      void qc.invalidateQueries({ queryKey: ["assignments"] });
    },
  });
}

export function useAssignmentQuestions(assignment: string | undefined) {
  return useQuery<{
    questions: Array<{
      id: string;
      student: string | null;
      student_name: string | null;
      body: string;
      asked_on: string;
      answer: string | null;
      answered_on: string;
      is_public: boolean;
      mine: boolean;
      answered: boolean;
    }>;
    unanswered: number;
  }>({
    queryKey: ["assignment-questions", assignment ?? null],
    queryFn: () => apiGet("assignments.questions", { assignment: assignment! }),
    enabled: Boolean(assignment),
  });
}

export function useAskAssignmentQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { assignment: string; body: string; student?: string }) =>
      apiPost<{ id: string }>(
        "assignments.ask_question",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["assignment-questions"] }),
  });
}

export function useAnswerAssignmentQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { question: string; answer: string; is_public?: number }) =>
      apiPost<{ id: string }>(
        "assignments.answer_question",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["assignment-questions"] }),
  });
}

export function useAssignmentSolution(assignment: string | undefined) {
  return useQuery<{
    published: boolean;
    published_on?: string;
    body: string | null;
    files: Array<{ file_url: string; file_name: string; file_size: number }>;
  }>({
    queryKey: ["assignment-solution", assignment ?? null],
    queryFn: () => apiGet("assignments.solution", { assignment: assignment! }),
    enabled: Boolean(assignment),
  });
}

export function usePublishSolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { assignment: string; published: number }) =>
      apiPost<{ id: string; published: boolean }>(
        "assignments.publish_solution",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assignment-solution"] });
      void qc.invalidateQueries({ queryKey: ["assignments"] });
    },
  });
}

export function useRecordAssignmentView() {
  return useMutation({
    mutationFn: (vars: { assignment: string; student?: string }) =>
      apiPost<Record<string, never>>(
        "assignments.record_view",
        vars as unknown as Record<string, unknown>,
      ),
  });
}

/* -------------------------------------------------------------------------
 * دفتر الحصص
 * ---------------------------------------------------------------------- */

export interface ClassLog {
  id: string;
  date: string;
  student_group: string;
  group_name?: string;
  course: string | null;
  instructor: string | null;
  topic: string | null;
  what_was_done: string | null;
  homework: string | null;
  notes: string | null;
  from_time: string;
  to_time: string;
  period_order: number;
  is_published: boolean;
  created_by: string | null;
  created_on: string;
  attachments: Array<{ file_url: string; file_name: string; file_size: number }>;
}

export function useClassLogs(params: {
  student_group?: string;
  course?: string;
  from_date?: string;
  to_date?: string;
}) {
  return useQuery<{ logs: ClassLog[]; total: number }>({
    queryKey: ["class-logs", params],
    queryFn: () => apiGet("class_log.list_logs", params as Record<string, unknown>),
  });
}

export function useDaySlots(studentGroup: string | undefined, date: string) {
  return useQuery<{
    date: string;
    day: string;
    logged?: number;
    slots: Array<{
      slot: string;
      student_group: string;
      group_name: string;
      course: string | null;
      from_time: string;
      to_time: string;
      period_order: number;
      room: string | null;
      log: string | null;
      logged: boolean;
    }>;
  }>({
    queryKey: ["day-slots", studentGroup ?? "", date],
    queryFn: () =>
      apiGet("class_log.day_slots", {
        ...(studentGroup ? { student_group: studentGroup } : {}),
        date,
      }),
  });
}

export function useSaveClassLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Record<string, unknown>) =>
      apiPost<{ id: string }>("class_log.save_log", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["class-logs"] });
      void qc.invalidateQueries({ queryKey: ["day-slots"] });
    },
  });
}

export function useDeleteClassLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { log: string }) =>
      apiPost<{ id: string }>("class_log.delete_log", vars as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["class-logs"] });
      void qc.invalidateQueries({ queryKey: ["day-slots"] });
    },
  });
}

/** Assess one pupil against one form, from their own page. */
export function useSaveEvaluationEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      form: string;
      student: string;
      student_group?: string;
      course?: string;
      values: Record<string, { value?: string; score?: number; note?: string }>;
      notes?: string;
      is_published?: number;
    }) =>
      apiPost<{ id: string; total: number; percent: number }>("evaluations.save_entry", {
        payload: vars,
      } as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-evaluations"] });
      void qc.invalidateQueries({ queryKey: ["evaluation-grid"] });
    },
  });
}

/** The assessment plan's own line items, for carrying homework marks onto. */
export function usePlanComponents(studentGroup: string | undefined, course: string | undefined) {
  return useQuery<{
    scheme: string | null;
    components: Array<{
      component_name: string;
      component_type: string;
      category: string | null;
      max_score: number;
      weight: number;
      quarter: string | null;
      marked: number;
    }>;
  }>({
    queryKey: ["plan-components", studentGroup ?? null, course ?? null],
    queryFn: () =>
      apiGet("gradebook.plan_components", {
        student_group: studentGroup!,
        course: course!,
      }),
    enabled: Boolean(studentGroup && course),
  });
}

/** Carry a piece of homework's marks onto one line of the plan. */
export function useTransferAssignmentMarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { assignment: string; component_name: string; rescale?: number }) =>
      apiPost<{
        count: number;
        component: string;
        source_max: number;
        target_max: number;
        rescaled: boolean;
      }>("gradebook.transfer_assignment_marks", vars as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["entry-sheet"] });
      void qc.invalidateQueries({ queryKey: ["plan-components"] });
    },
  });
}

export interface WorkspaceShortcut {
  key: string;
  label: string;
  count: number;
  hint: string;
  route: string;
  tone: string;
}

/** The live numbers behind the workspace shortcuts. */
export function useWorkspaceShortcuts() {
  return useQuery<{ shortcuts: WorkspaceShortcut[]; academic_year: string | null }>({
    queryKey: ["workspace-shortcuts"],
    queryFn: () => apiGet("workspace.shortcuts"),
    staleTime: 60_000,
  });
}

/* -------------------------------------------------------------------------
 * Full record fields (Student / Guardian / Instructor), back office
 * ---------------------------------------------------------------------- */

export type RecordFieldsDoctype = "Student" | "Guardian" | "Instructor";

export interface RecordField {
  fieldname: string;
  label: string;
  fieldtype: string;
  options: string | Array<{ value: string; label: string }> | null;
  reqd: number;
  editable: boolean;
  value: unknown;
  display?: string | null;
}

export interface RecordFieldsLayout {
  doctype: RecordFieldsDoctype;
  name: string;
  sections: Array<{ label: string; fields: RecordField[] }>;
  tables: Array<{
    fieldname: string;
    label: string;
    columns: Array<{ fieldname: string; label: string }>;
    rows: Array<Record<string, unknown>>;
  }>;
}

export function useRecordFields(doctype: RecordFieldsDoctype, name: string | undefined) {
  return useQuery<RecordFieldsLayout>({
    queryKey: ["record-fields", doctype, name],
    queryFn: () => apiGet<RecordFieldsLayout>("records.record_fields", { doctype, name: name! }),
    enabled: !!name,
  });
}

export function useSaveRecordFields(doctype: RecordFieldsDoctype, name: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      apiPost<RecordFieldsLayout>("records.save_record_fields", { doctype, name, values }),
    onSuccess: (layout) => {
      qc.setQueryData(["record-fields", doctype, name], layout);
      const dossier = {
        Student: "student-dossier",
        Guardian: "guardian-dossier",
        Instructor: "teacher-dossier",
      }[doctype];
      qc.invalidateQueries({ queryKey: [dossier, name] });
      qc.invalidateQueries({
        queryKey: [{ Student: "students", Guardian: "guardians", Instructor: "teachers" }[doctype]],
      });
    },
  });
}

export function useLinkOptions(doctype: RecordFieldsDoctype, fieldname: string, txt: string) {
  return useQuery<Array<{ value: string; label: string }>>({
    queryKey: ["link-options", doctype, fieldname, txt],
    queryFn: () => apiGet("records.link_options", { doctype, fieldname, txt }),
    staleTime: 60_000,
  });
}

/* -------------------------------------------------------------------------
 * Timetable built one teacher at a time
 * ---------------------------------------------------------------------- */

export interface TeacherGridOptions {
  days: Array<{ value: string; label: string }>;
  periods: GridPeriod[];
  groups: Array<{
    name: string;
    student_group_name: string | null;
    program: string | null;
    academic_year: string | null;
    batch: string | null;
    courses: string[];
    /** This class's own bell: what time each period runs at for it. Two
     *  stages break at different points in the morning, so the same period
     *  number is a different hour for each. */
    clock?: Array<{ order: number; from: string; to: string }>;
  }>;
  instructors: Array<{
    name: string;
    instructor_name: string | null;
    quota: number;
    assigned: number;
  }>;
  rooms: Array<{ name: string; room_name: string | null }>;
  /** The school's working days — the columns of the grid. */
  workingDays: string[];
  defaultAcademicYear: string | null;
  defaultAcademicTerm: string | null;
}

export interface TeacherAssignment {
  studentGroup: string;
  studentGroupName: string;
  course: string;
  required: number;
  maxPerDay: number;
  room: string | null;
  placed: number;
  fromGrid?: boolean;
}

/** What the class plans say this teacher owes each section every week. */
export function useTeacherAssignments(instructor?: string) {
  return useQuery<{ assignments: TeacherAssignment[]; quota: number; placed: number }>({
    queryKey: ["teacher-assignments", instructor ?? null],
    queryFn: () =>
      apiGet("timetable_grid.teacher_assignments", { instructor: instructor as string }),
    enabled: !!instructor,
  });
}

export function useTeacherGridOptions() {
  return useQuery<TeacherGridOptions>({
    queryKey: ["teacher-grid-options"],
    queryFn: () => apiGet<TeacherGridOptions>("timetable_grid.teacher_grid_options"),
    staleTime: 5 * 60 * 1000,
  });
}

export interface TakenPeriod {
  day: string;
  period: number;
  studentGroup: string;
  studentGroupName: string;
  instructor: string | null;
  instructorName: string | null;
  course: string | null;
  room: string | null;
}

/** What every other teacher has already booked — used to grey out a cell. */
export function useTakenPeriods(instructor?: string) {
  return useQuery<{ taken: TakenPeriod[] }>({
    queryKey: ["taken-periods", instructor ?? null],
    queryFn: () =>
      apiGet<{ taken: TakenPeriod[] }>(
        "timetable_grid.taken_periods",
        instructor ? { instructor } : {},
      ),
    enabled: !!instructor,
  });
}

export interface TeacherProblem {
  day: string;
  period: number;
  studentGroup: string;
  message: string;
}

/** The same checks the save runs, without saving — so a clash is shown on the
 * grid instead of being refused afterwards. */
export function useCheckTeacherSlots() {
  return useMutation({
    mutationFn: (vars: { instructor: string; slots: GridSlot[] }) =>
      apiPost<{
        problems: TeacherProblem[];
        quota: number;
        placed: number;
        overQuota: boolean;
      }>("timetable_grid.check_teacher_slots", vars as unknown as Record<string, unknown>),
  });
}

export function useSaveTeacherPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      instructor: string;
      slots: GridSlot[];
      /** Per section and subject: how many lessons of it fit in one day. */
      limits: Record<string, number>;
    }) =>
      apiPost<{
        instructor: string;
        slots: number;
        groups: string[];
        lessons: LessonSync | null;
      }>("timetable_grid.save_teacher_pattern", vars as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timetable-pattern"] });
      void qc.invalidateQueries({ queryKey: ["taken-periods"] });
      void qc.invalidateQueries({ queryKey: ["timetable"] });
    },
  });
}

/* -------------------------------------------------------------------------
 * The whole timetable from one spreadsheet, laid out like the paper one
 * ---------------------------------------------------------------------- */

export interface TimetableImportResult {
  teachers: Array<{
    name: string;
    label: string;
    lessons: number;
    groups: number;
    quota: number | null;
  }>;
  lessons: number;
  groups: number;
  problems: Array<{
    row: number | null;
    cell: string | null;
    teacher: string | null;
    message: string;
  }>;
  committed: boolean;
  /** What the import did to lessons already generated, if any were. */
  lessonSync?: LessonSync | null;
}

/** Fetches the pre-filled template and hands it to the browser as a file. */
export async function downloadTimetableTemplate(): Promise<void> {
  const res = await apiGet<{ filename: string; content: string }>(
    "timetable_import.import_template",
  );
  const bytes = Uint8Array.from(atob(res.content), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: res.filename.endsWith(".csv")
      ? "text/csv;charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = res.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useImportTimetable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { file: File; commit: boolean }) =>
      apiUpload<TimetableImportResult>("timetable_import.import_timetable", vars.file, {
        commit: vars.commit ? "1" : "0",
      }),
    onSuccess: (res) => {
      if (!res.committed) return;
      void qc.invalidateQueries({ queryKey: ["timetable-pattern"] });
      void qc.invalidateQueries({ queryKey: ["taken-periods"] });
      void qc.invalidateQueries({ queryKey: ["teacher-assignments"] });
      void qc.invalidateQueries({ queryKey: ["teacher-grid-options"] });
      void qc.invalidateQueries({ queryKey: ["timetable"] });
    },
  });
}

/* -------------------------------------------------------------------------
 * Dated lessons (Course Schedule) generated from the weekly pattern
 * ---------------------------------------------------------------------- */

/** What happened to the dated lessons when the week was saved or generated. */
export interface LessonSync {
  created: number;
  removed: number;
  keptAttended: number;
  keptOver?: number;
  skipped: Array<{ date: string; course: string | null; reason: string }>;
  error?: string;
  from?: string;
  to?: string;
}

export function useTeacherLessonsStatus(instructor?: string) {
  return useQuery<{
    from: string;
    to: string;
    generated: number;
    generatedTo: string;
    audience: TimetableAudience;
    slots: number;
  }>({
    queryKey: ["teacher-lessons-status", instructor ?? null],
    queryFn: () =>
      apiGet("timetable_grid.teacher_lessons_status", { instructor: instructor as string }),
    enabled: !!instructor,
  });
}

export function useGenerateTeacherLessons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      instructor: string;
      from_date?: string;
      to_date?: string;
      audience: TimetableAudience;
    }) =>
      apiPost<LessonSync & { instructor: string }>(
        "timetable_grid.generate_teacher_lessons",
        vars as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher-lessons-status"] });
      void qc.invalidateQueries({ queryKey: ["timetable"] });
      void qc.invalidateQueries({ queryKey: ["taken-periods"] });
    },
  });
}

/* -------------------------------------------------------------------------
 * Specialist files: nursing, counselling, special needs, learning
 * difficulties, speech and language
 * ---------------------------------------------------------------------- */

export type FormFieldType =
  | "Section"
  | "Heading"
  | "Data"
  | "Long Text"
  | "Number"
  | "Date"
  | "Time"
  | "Datetime"
  | "Select"
  | "Multi Select"
  | "Checkbox"
  | "Rating"
  | "Table"
  | "Attach"
  /** Rows are a section's students; columns come from the options. */
  | "Student Table"
  /** Fixed text, printed as written — a key, an instruction. */
  | "Text Block";

/** Who one filled copy of a form is about. */
export type FormEntryFor = "Student" | "Section" | "General";

export interface FormField {
  fieldname: string;
  label: string;
  fieldtype: FormFieldType;
  options: string;
  default: string;
  reqd: number;
  width: "half" | "full" | "third";
  description: string;
  /** Print: the card's icon and colour, and lines left to write on. */
  icon?: string;
  tone?: string;
  print_rows?: number;
  idx?: number;
}

export interface FormTemplate {
  name: string;
  title: string;
  category: string;
  categoryLabel: string;
  description: string;
  isActive: number;
  printTemplate: string;
  /** The form's own print CSS, applied after the base style. */
  printCss?: string;
  /** How many students the form applies to. */
  subjectsCount?: number;
  entryFor?: FormEntryFor;
  printTheme?: "soft" | "classic";
  printOrientation?: "Portrait" | "Landscape";
  printLogo?: string;
  printSchool?: string;
  printDepartment?: string;
  printMotto?: string;
  printSignatures?: string;
  printFooter?: string;
  fields: FormField[];
}

export interface FormTemplateRow {
  name: string;
  title: string;
  description: string;
  isActive: number;
  fields: number;
  entries: number;
  /** Students the form applies to. */
  subjects?: number;
  entryFor?: FormEntryFor;
  modified: string;
}

export interface FormEntryRow {
  name: string;
  template: string;
  templateTitle: string;
  category: string;
  student: string;
  studentName: string;
  studentGroup: string | null;
  studentGroupLabel?: string;
  status: string;
  filledBy: string;
  filledOn: string;
  modified: string;
}

export interface FormEntry extends Omit<FormEntryRow, "modified"> {
  notes: string;
  values: Record<string, string>;
}

export function useFormCategories() {
  return useQuery<{
    categories: Array<{
      key: string;
      label: string;
      forms: number;
      teachersMayFill: boolean;
      teachersMayDesign?: boolean;
    }>;
    fieldTypes: Array<{ value: FormFieldType; label: string }>;
    icons?: Array<{ value: string; label: string }>;
    tones?: Array<{ value: string; label: string; color: string; background: string }>;
    entryFor?: Array<{ value: FormEntryFor; label: string }>;
  }>({
    queryKey: ["form-categories"],
    queryFn: () => apiGet("forms.categories"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFormTemplates(category: string, includeInactive = false) {
  return useQuery<{
    category: string;
    label: string;
    teachersMayFill: boolean;
    /** Teachers may add forms to this file and edit them. */
    teachersMayDesign?: boolean;
    templates: FormTemplateRow[];
  }>({
    queryKey: ["form-templates", category, includeInactive],
    queryFn: () =>
      apiGet("forms.list_templates", { category, include_inactive: includeInactive ? 1 : 0 }),
    enabled: !!category,
  });
}

export function useFormTemplate(template?: string) {
  return useQuery<FormTemplate>({
    queryKey: ["form-template", template ?? null],
    queryFn: () => apiGet("forms.get_template", { template: template as string }),
    enabled: !!template,
  });
}

export function useSaveFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<FormTemplate>("forms.save_template", { payload }),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: ["form-templates"] });
      void qc.invalidateQueries({ queryKey: ["form-template", t.name] });
      void qc.invalidateQueries({ queryKey: ["form-categories"] });
    },
  });
}

export function useDeleteFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (template: string) =>
      apiPost<{ deleted: string }>("forms.delete_template", { template }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["form-templates"] }),
  });
}

export function useDuplicateFormTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (template: string) =>
      apiPost<FormTemplate>("forms.duplicate_template", { template }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["form-templates"] }),
  });
}

export function useFormStudents(search: string, template?: string, group?: string, enabled = true) {
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
    // With a form: only the students it applies to. With a section: its pupils.
    queryKey: ["form-students", search, template ?? "", group ?? ""],
    queryFn: () =>
      apiGet("forms.students", {
        search,
        limit: 200,
        ...(template ? { template } : {}),
        ...(group ? { group } : {}),
      }),
    staleTime: 60_000,
    enabled,
  });
}

export function useFormEntries(params: { category?: string; template?: string; student?: string }) {
  return useQuery<{ entries: FormEntryRow[] }>({
    queryKey: ["form-entries", params],
    queryFn: () => apiGet("forms.list_entries", { ...params, limit: 100 }),
    enabled: !!(params.category || params.template || params.student),
  });
}

export function useFormEntry(entry?: string) {
  return useQuery<FormEntry>({
    queryKey: ["form-entry", entry ?? null],
    queryFn: () => apiGet("forms.get_entry", { entry: entry as string }),
    enabled: !!entry,
  });
}

export function useSaveFormEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<FormEntry>("forms.save_entry", { payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["form-entries"] });
      void qc.invalidateQueries({ queryKey: ["form-templates"] });
    },
  });
}

export function useDeleteFormEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: string) => apiPost<{ deleted: string }>("forms.delete_entry", { entry }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["form-entries"] }),
  });
}

/** The filled form as printable HTML, opened in a print window. */
export interface FormReportFilters {
  template: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  student_group?: string;
  program?: string;
  academic_term?: string;
  filled_by?: string;
  search?: string;
  field?: string;
  value?: string;
  page?: number;
  page_size?: number;
}

export interface FormFieldSummary {
  fieldname: string;
  label: string;
  fieldtype: FormFieldType;
  answered: number;
  total: number;
  distribution?: Array<{ value: string; count: number }>;
  average?: number | null;
  stats?: { average: number; min: number; max: number; sum: number };
}

export interface FormReport {
  template: {
    name: string;
    title: string;
    category: string;
    categoryLabel: string;
    entryFor: FormEntryFor;
    fields: FormField[];
  };
  kpis: {
    entries: number;
    completed: number;
    drafts: number;
    students: number;
    groups: number;
    fillers: number;
    first: string;
    last: string;
  };
  byMonth: Array<{ month: string; count: number }>;
  byGroup: Array<{ group: string; label: string; count: number }>;
  byFiller: Array<{ user: string; name: string; count: number }>;
  fields: FormFieldSummary[];
  entries: Array<{
    name: string;
    student: string | null;
    studentName: string;
    group: string;
    groupLabel: string;
    status: string;
    filledBy: string;
    filledByName: string;
    filledOn: string;
    academicTerm: string;
    values: Record<string, string>;
  }>;
  total: number;
  page: number;
  pageSize: number;
  filterOptions: {
    groups: Array<{ value: string; label: string }>;
    programs: string[];
    fillers: Array<{ value: string; label: string }>;
    terms: string[];
    statuses: string[];
  };
}

/** One form's filled copies: counts, answers, and the copies themselves. */
export function useFormReport(filters: FormReportFilters | null) {
  return useQuery<FormReport>({
    queryKey: ["form-report", filters],
    queryFn: () =>
      apiGet(
        "forms.template_report",
        Object.fromEntries(
          Object.entries(filters ?? {}).filter(([, v]) => v !== undefined && v !== ""),
        ) as Record<string, string>,
      ),
    enabled: !!filters?.template,
    placeholderData: (prev) => prev,
  });
}

export async function printFormEntry(entry: string): Promise<void> {
  const res = await apiGet<{ html: string; title: string }>("forms.print_entry", { entry });
  printHtml(res.html, res.title);
}

/** The students a form applies to. */
export function useFormSubjects(template?: string) {
  return useQuery<{
    template: string;
    students: Array<{
      id: string;
      name: string;
      group: string | null;
      groupLabel: string;
      addedOn: string;
      entries: number;
    }>;
  }>({
    queryKey: ["form-subjects", template],
    queryFn: () => apiGet("forms.template_subjects", { template }),
    enabled: Boolean(template),
  });
}

export function useSetFormSubjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      template: string;
      add?: string[];
      remove?: string[];
      add_group?: string;
    }) =>
      apiPost<{ added: number; removed: number; total: number; message_ar?: string }>(
        "forms.set_template_subjects",
        {
          template: vars.template,
          ...(vars.add ? { add: JSON.stringify(vars.add) } : {}),
          ...(vars.remove ? { remove: JSON.stringify(vars.remove) } : {}),
          ...(vars.add_group ? { add_group: vars.add_group } : {}),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["form-subjects"] });
      void qc.invalidateQueries({ queryKey: ["form-students"] });
      void qc.invalidateQueries({ queryKey: ["form-templates"] });
    },
  });
}

/** «تحويل الحقول إلى تصميم طباعة». */
export function useDesignFromFields() {
  return useMutation({
    mutationFn: (vars: { fields: FormField[]; category: string; entryFor?: FormEntryFor }) =>
      apiPost<{ html: string; css: string }>("forms.design_from_fields", {
        fields: JSON.stringify(vars.fields),
        category: vars.category,
        entry_for: vars.entryFor ?? "Student",
      }),
  });
}

/** «تحويل التصميم إلى حقول». */
export function useFieldsFromDesign() {
  return useMutation({
    mutationFn: (vars: { html: string; fields: FormField[]; category: string }) =>
      apiPost<{
        fields: FormField[];
        kept: number;
        added: number;
        dropped: string[];
        unknownTypes: string[];
      }>("forms.fields_from_design", {
        html: vars.html,
        fields: JSON.stringify(vars.fields),
        category: vars.category,
      }),
  });
}

export function usePreviewFormPrint() {
  return useMutation({
    // The whole draft goes along, so the preview follows unsaved changes.
    mutationFn: (vars: { template?: string; payload: Record<string, unknown>; blank?: boolean }) =>
      apiPost<{ html: string; blank: boolean }>("forms.preview_print", {
        ...(vars.template ? { template: vars.template } : {}),
        payload: JSON.stringify(vars.payload),
        blank: vars.blank ? 1 : 0,
      }),
  });
}

/** Open printable HTML in a window and print it once its fonts are in. */
export function printHtml(html: string, title: string): void {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) throw new Error("نافذة الطباعة محجوبة — اسمح بالنوافذ المنبثقة");
  win.document.write(
    `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`,
  );
  win.document.close();
  win.focus();
  const go = () => setTimeout(() => win.print(), 150);
  if (win.document.fonts?.ready) void win.document.fonts.ready.then(go);
  else setTimeout(go, 400);
}

/** The form with no answers, to print and fill by hand. */
export async function printBlankForm(template: string): Promise<void> {
  const res = await apiGet<{ html: string; title: string }>("forms.print_blank", { template });
  printHtml(res.html, res.title);
}

/** A logo for a form's letterhead; returns its URL. */
export async function uploadFormLogo(file: File): Promise<string> {
  const res = await apiUpload<{ url: string }>("forms.upload_logo", file);
  return res.url;
}

/* -------------------------------------------------------------------------
 * The workspace, arranged per user
 * ---------------------------------------------------------------------- */

export interface WorkspaceLayout {
  hiddenGroups?: string[];
  hiddenItems?: string[];
  hiddenCards?: string[];
  groupOrder?: string[];
}

/** This user's own arrangement. Empty means the default for their role. */
export function useMyWorkspaceLayout() {
  return useQuery<{ layout: WorkspaceLayout; user: string }>({
    queryKey: ["workspace-layout", "me"],
    queryFn: () => apiGet("workspace.my_layout"),
    staleTime: 60_000,
  });
}

export function useWorkspaceLayoutUsers(search: string) {
  return useQuery<{
    users: Array<{
      user: string;
      name: string;
      persona: string;
      personaLabel: string;
      customised: boolean;
    }>;
  }>({
    queryKey: ["workspace-layout-users", search],
    queryFn: () => apiGet("workspace.layout_users", { search }),
  });
}

export function useWorkspaceLayoutFor(user?: string) {
  return useQuery<{
    user: string;
    persona: string;
    personaLabel: string;
    layout: WorkspaceLayout;
    cards: Array<{ key: string; label: string }>;
  }>({
    queryKey: ["workspace-layout", user ?? null],
    queryFn: () => apiGet("workspace.layout_for", { user: user as string }),
    enabled: !!user,
  });
}

export function useSaveWorkspaceLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { user: string; layout: WorkspaceLayout }) =>
      apiPost<{ user: string; layout: WorkspaceLayout; reset: boolean }>("workspace.save_layout", {
        user: vars.user,
        layout: vars.layout,
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["workspace-layout"] });
      void qc.invalidateQueries({ queryKey: ["workspace-layout-users"] });
      void qc.invalidateQueries({ queryKey: ["workspace-layout", res.user] });
    },
  });
}

/** Whether teachers may fill forms in one file. The design stays with admin. */
export function useSetFormCategorySettings() {
  const qc = useQueryClient();
  return useMutation({
    // A setting left out is left as it is on the server.
    mutationFn: (vars: {
      category: string;
      teachers_may_fill?: boolean;
      teachers_may_design?: boolean;
    }) =>
      apiPost<{ category: string; teachersMayFill: boolean; teachersMayDesign: boolean }>(
        "forms.set_category_settings",
        {
          category: vars.category,
          ...(vars.teachers_may_fill !== undefined
            ? { teachers_may_fill: vars.teachers_may_fill ? 1 : 0 }
            : {}),
          ...(vars.teachers_may_design !== undefined
            ? { teachers_may_design: vars.teachers_may_design ? 1 : 0 }
            : {}),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["form-templates"] });
      void qc.invalidateQueries({ queryKey: ["form-categories"] });
    },
  });
}

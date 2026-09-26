/**
 * Thin client for the Match Schools backend (Frappe).
 *
 * Every endpoint answers with the same flat envelope:
 *   { success, data, message_en, message_ar }
 *
 * Auth is cookie-based: `login` starts a Frappe session and the browser sends
 * the `sid` cookie on every later request, so we always use credentials.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message_en: string;
  message_ar: string;
}

export class ApiError extends Error {
  status: number;
  messageAr: string;
  /**
   * The envelope's `data` when a failure carries structured detail — a list of
   * timetable conflicts, for instance. Without this the screen can only show
   * the message and not what to fix.
   */
  data: unknown;

  constructor(message: string, status: number, messageAr = "", data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.messageAr = messageAr;
    this.data = data;
  }
}

/**
 * Base URL of the Frappe site. Leave empty to call the same origin (the Vite
 * dev server proxies /api during development).
 */
const API_BASE = (import.meta.env["VITE_API_BASE"] ?? "").replace(/\/$/, "");

const METHOD_PREFIX = "match_schools.api";

function endpointUrl(method: string) {
  // `method` is given as "module.function", e.g. "students.list_students".
  return `${API_BASE}/api/method/${METHOD_PREFIX}.${method}`;
}

async function parseResponse<T>(res: Response, method: string): Promise<T> {
  const text = await res.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(`Malformed response from ${method}`, res.status);
    }
  }

  // Frappe wraps whitelisted return values in `message`.
  const envelope = (payload as { message?: ApiEnvelope<T> } | null)?.message;

  if (!res.ok) {
    // Prefer the envelope's own message, then Frappe's exception text.
    const frappeError = (payload as { exception?: string; _server_messages?: string } | null) ?? {};
    const message =
      envelope?.message_en ||
      frappeError.exception ||
      `Request to ${method} failed (${res.status})`;
    throw new ApiError(message, res.status, envelope?.message_ar ?? "");
  }

  if (!envelope) {
    throw new ApiError(`Empty response from ${method}`, res.status);
  }

  if (!envelope.success) {
    throw new ApiError(
      envelope.message_en || `Request to ${method} failed`,
      res.status,
      envelope.message_ar,
      envelope.data,
    );
  }

  return envelope.data;
}

/* -------------------------------------------------------------------------
 * Call log
 * ---------------------------------------------------------------------- */

/** A call slower than this is worth seeing without being asked about it. */
const SLOW_MS = 1500;

export interface CallRecord {
  method: string;
  ms: number;
  ok: boolean;
  status: number;
  at: string;
  message?: string;
}

/**
 * The last calls this tab made.
 *
 * Kept in memory and capped: a support question is almost always "it was slow
 * just now" or "it failed just now", and the answer is in the last few dozen
 * calls. Longer history belongs in the server log, which records the same
 * events from the other side.
 */
const RECENT: CallRecord[] = [];
const MAX_RECENT = 80;

export function recentCalls(): CallRecord[] {
  return [...RECENT];
}

function record(entry: CallRecord) {
  RECENT.push(entry);
  if (RECENT.length > MAX_RECENT) RECENT.shift();

  if (typeof console === "undefined") return;
  if (!entry.ok) {
    console.error(
      `[api] ${entry.method} فشل بعد ${entry.ms}ms (${entry.status})`,
      entry.message ?? "",
    );
  } else if (entry.ms >= SLOW_MS) {
    console.warn(`[api] ${entry.method} استغرق ${entry.ms}ms`);
  }

  // Handy from the console when someone is looking at a misbehaving screen.
  if (typeof window !== "undefined") {
    (window as unknown as { __msCalls?: () => CallRecord[] }).__msCalls = recentCalls;
  }
}

/** Time one request and log what happened to it. */
async function timed<T>(method: string, run: () => Promise<Response>): Promise<T> {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const elapsed = () =>
    Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started);
  try {
    const res = await run();
    const data = await parseResponse<T>(res, method);
    record({ method, ms: elapsed(), ok: true, status: res.status, at: new Date().toISOString() });
    return data;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    const message = err instanceof ApiError ? err.messageAr || err.message : String(err);
    record({ method, ms: elapsed(), ok: false, status, at: new Date().toISOString(), message });
    throw err;
  }
}

/** GET request — used for reads. Params are serialised into the query string. */
export async function apiGet<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  const qs = query.toString();
  return timed<T>(method, () =>
    fetch(`${endpointUrl(method)}${qs ? `?${qs}` : ""}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    }),
  );
}

/** POST request — used for writes. */
export async function apiPost<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  return timed<T>(method, () =>
    fetch(endpointUrl(method), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // Frappe requires this header for cookie-authenticated writes.
        "X-Frappe-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Multipart upload — the browser sets its own Content-Type boundary, so unlike
 * apiPost we must not set that header ourselves.
 */
export async function apiUpload<T>(
  method: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);

  const res = await fetch(endpointUrl(method), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Frappe-CSRF-Token": getCsrfToken(),
    },
    body: form,
  });
  return parseResponse<T>(res, method);
}

/** A GET endpoint as a plain link — for downloads the browser should open itself. */
export function methodUrl(method: string, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  return `${endpointUrl(method)}${qs ? `?${qs}` : ""}`;
}

/** Absolute URL for a stored file, so links work when the SPA is hosted apart. */
export function fileUrl(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Frappe exposes the CSRF token on the served page. When the frontend is
 * hosted separately there is none, and Frappe accepts the request without it
 * as long as the session cookie is valid.
 */
function getCsrfToken(): string {
  if (typeof window === "undefined") return "";
  return (window as unknown as { csrf_token?: string }).csrf_token ?? "";
}

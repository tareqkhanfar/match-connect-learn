/** Triggers server-side Excel / PDF exports and saves the file. */

import { ApiError } from "./client";

export type ExportDataset =
  | "students"
  | "fees"
  | "grades"
  | "exams"
  | "classes"
  | "subjects"
  | "teachers"
  | "assignments"
  | "behaviour"
  | "books"
  | "loans"
  | "transport"
  | "guardians"
  | "health"
  | "routes";

export interface ExportRequest {
  dataset: ExportDataset;
  /** The columns currently on screen, in display order. */
  columns: Array<{ fieldname: string; label: string }>;
  filters?: Record<string, unknown> | undefined;
  title?: string | undefined;
}

const API_BASE = (import.meta.env["VITE_API_BASE"] ?? "").replace(/\/$/, "");

function endpoint(method: string) {
  return `${API_BASE}/api/method/match_schools.api.export.${method}`;
}

/**
 * Requests the file and hands it to the browser.
 *
 * The endpoint answers with a binary body on success, but with the usual JSON
 * envelope on failure — so the content type decides how to read the response.
 */
export async function downloadExport(
  format: "excel" | "pdf",
  request: ExportRequest,
): Promise<void> {
  const res = await fetch(endpoint(format === "excel" ? "export_excel" : "export_pdf"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token":
        (typeof window !== "undefined" &&
          (window as unknown as { csrf_token?: string }).csrf_token) ||
        "",
    },
    body: JSON.stringify({
      dataset: request.dataset,
      columns: JSON.stringify(request.columns),
      filters: JSON.stringify(request.filters ?? {}),
      ...(request.title ? { title: request.title } : {}),
    }),
  });

  const contentType = res.headers.get("content-type") ?? "";

  // An error comes back as JSON even when we asked for a file.
  if (!res.ok || contentType.includes("application/json")) {
    let messageEn = `Export failed (${res.status})`;
    let messageAr = "";
    try {
      const payload = await res.json();
      const envelope = payload?.message;
      messageEn = envelope?.message_en || payload?.exception || messageEn;
      messageAr = envelope?.message_ar ?? "";
    } catch {
      /* keep the default message */
    }
    throw new ApiError(messageEn, res.status, messageAr);
  }

  const blob = await res.blob();
  const filename =
    filenameFrom(res.headers.get("content-disposition")) ?? defaultName(request, format);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Pull the filename out of Content-Disposition, handling RFC 5987 encoding. */
function filenameFrom(header: string | null): string | null {
  if (!header) return null;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain?.[1] ?? null;
}

function defaultName(request: ExportRequest, format: "excel" | "pdf") {
  const date = new Date().toISOString().slice(0, 10);
  return `${request.title || request.dataset}-${date}.${format === "excel" ? "xlsx" : "pdf"}`;
}

/** Downloads a printable report card for one student. */
export async function downloadReportCard(student: string, academicTerm?: string): Promise<void> {
  const res = await fetch(endpoint("export_report_card"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token":
        (typeof window !== "undefined" &&
          (window as unknown as { csrf_token?: string }).csrf_token) ||
        "",
    },
    body: JSON.stringify({ student, ...(academicTerm ? { academic_term: academicTerm } : {}) }),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || contentType.includes("application/json")) {
    let messageEn = `Export failed (${res.status})`;
    let messageAr = "";
    try {
      const payload = await res.json();
      messageEn = payload?.message?.message_en || messageEn;
      messageAr = payload?.message?.message_ar ?? "";
    } catch {
      /* keep default */
    }
    throw new ApiError(messageEn, res.status, messageAr);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    filenameFrom(res.headers.get("content-disposition")) ?? `report-card-${student}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Endpoint name per certificate kind. */
const CERTIFICATE_METHOD: Record<string, string> = {
  enrolment: "enrolment_letter",
  transcript: "transcript",
  graduation: "graduation_certificate",
  conduct: "conduct_certificate",
};

/**
 * Download an official document as a PDF.
 *
 * These live under api/certificates rather than api/export, so the URL is
 * built here instead of going through `endpoint()`.
 */
export async function downloadCertificate(kind: string, student: string): Promise<void> {
  const method = CERTIFICATE_METHOD[kind];
  if (!method) throw new ApiError(`Unknown document: ${kind}`, 400, "نوع وثيقة غير معروف");

  const base = (import.meta.env["VITE_API_BASE"] ?? "").replace(/\/$/, "");
  const url = `${base}/api/method/match_schools.api.certificates.${method}?student=${encodeURIComponent(student)}`;

  const res = await fetch(url, { credentials: "include" });

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || contentType.includes("application/json")) {
    let messageEn = `Could not issue the document (${res.status})`;
    let messageAr = "";
    try {
      const payload = await res.json();
      messageEn = payload?.message?.message_en || messageEn;
      messageAr = payload?.message?.message_ar ?? "";
    } catch {
      /* keep default */
    }
    throw new ApiError(messageEn, res.status, messageAr);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filenameFrom(res.headers.get("content-disposition")) ?? `${kind}-${student}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

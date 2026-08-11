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

/**
 * Download the registration slip, including the credentials just issued.
 *
 * Sent as a POST: the password is in the body rather than the query string,
 * so it does not end up in access logs or browser history. The server cannot
 * look these up — they are readable only in the response that created them —
 * so whatever the caller received is what gets printed.
 */
export async function downloadRegistrationSlip(args: {
  student?: string;
  applicant?: string;
  credentials?: unknown;
  guardians?: unknown;
  printFormat?: string;
  letterhead?: string;
}): Promise<void> {
  const base = (import.meta.env["VITE_API_BASE"] ?? "").replace(/\/$/, "");
  const url = `${base}/api/method/match_schools.api.registration_print.registration_slip`;

  const body = new URLSearchParams();
  if (args.student) body.set("student", args.student);
  if (args.applicant) body.set("applicant", args.applicant);
  if (args.credentials) body.set("credentials", JSON.stringify(args.credentials));
  if (args.guardians) body.set("guardians", JSON.stringify(args.guardians));
  if (args.printFormat) body.set("print_format", args.printFormat);
  if (args.letterhead) body.set("letterhead", args.letterhead);

  await postForPdf(url, body, `registration-${args.student ?? args.applicant}.pdf`);
}

/**
 * Print any supported document using the ERPNext print format.
 *
 * Layout comes from the desk: omit `printFormat` and the doctype's default is
 * used, so editing a Print Format in ERPNext changes what this prints.
 */
export async function downloadDocumentPrint(args: {
  doctype: string;
  name: string;
  printFormat?: string;
  letterhead?: string;
}): Promise<void> {
  const base = (import.meta.env["VITE_API_BASE"] ?? "").replace(/\/$/, "");
  const url = `${base}/api/method/match_schools.api.registration_print.print_document`;

  const body = new URLSearchParams();
  body.set("doctype", args.doctype);
  body.set("name", args.name);
  if (args.printFormat) body.set("print_format", args.printFormat);
  if (args.letterhead) body.set("letterhead", args.letterhead);

  await postForPdf(url, body, `${args.doctype}-${args.name}.pdf`);
}

/** POST a form body and save the PDF that comes back. */
async function postForPdf(url: string, body: URLSearchParams, fallbackName: string) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Frappe-CSRF-Token":
        (typeof window !== "undefined" &&
          (window as unknown as { csrf_token?: string }).csrf_token) ||
        "",
    },
    body,
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || contentType.includes("application/json")) {
    let messageEn = `Could not produce the document (${res.status})`;
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
  link.download = filenameFrom(res.headers.get("content-disposition")) ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Upload a student's profile photo.
 *
 * Multipart rather than JSON, because the file is binary; the server stores it
 * as a public file so it can be rendered in an `<img>`.
 */
export async function uploadStudentPhoto(student: string, file: File): Promise<string> {
  const base = (import.meta.env["VITE_API_BASE"] ?? "").replace(/\/$/, "");
  const body = new FormData();
  body.append("student", student);
  body.append("file", file);

  const res = await fetch(
    `${base}/api/method/match_schools.api.students.upload_student_photo`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "X-Frappe-CSRF-Token":
          (typeof window !== "undefined" &&
            (window as unknown as { csrf_token?: string }).csrf_token) ||
          "",
      },
      body,
    },
  );

  const payload = await res.json().catch(() => null);
  const envelope = payload?.message;
  if (!res.ok || !envelope?.success) {
    throw new ApiError(
      envelope?.message_en || `Upload failed (${res.status})`,
      res.status,
      envelope?.message_ar ?? "",
    );
  }
  return envelope.data.image as string;
}

/**
 * Upload a document against a record.
 *
 * Sent as multipart/form-data rather than JSON: a 15 MB scan base64-encoded
 * would be 20 MB on the wire, and the browser streams a FormData body.
 */
export async function uploadAttachment(
  doctype: string,
  name: string,
  file: File,
  description?: string,
): Promise<{ id: string; fileName: string; url: string }> {
  const base = (import.meta.env["VITE_API_BASE"] ?? "").replace(/\/$/, "");
  const body = new FormData();
  body.append("file", file);
  if (description) body.append("description", description);

  const params = new URLSearchParams({ doctype, name });
  const res = await fetch(
    `${base}/api/method/match_schools.api.attachments.upload_attachment?${params}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "X-Frappe-CSRF-Token":
          (typeof window !== "undefined" &&
            (window as unknown as { csrf_token?: string }).csrf_token) ||
          "",
      },
      body,
    },
  );

  const payload = await res.json().catch(() => null);
  const envelope = payload?.message;
  if (!res.ok || !envelope?.success) {
    const error = new Error(envelope?.message_en || "Upload failed") as Error & {
      messageAr?: string;
    };
    error.messageAr =
      envelope?.message_ar ||
      (res.status === 403 ? "لا تملك صلاحية رفع الملفات لهذا السجل." : "تعذّر رفع الملف.");
    throw error;
  }
  return envelope.data.attachment;
}

/** Download a single quarter's report card ("شهادة الشهرين") for one student. */
export async function downloadQuarterCard(
  student: string,
  quarter: string,
  options: { studentGroup?: string; academicTerm?: string } = {},
): Promise<void> {
  const res = await fetch(endpoint("export_quarter_report_card"), {
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
      student,
      quarter,
      ...(options.studentGroup ? { student_group: options.studentGroup } : {}),
      ...(options.academicTerm ? { academic_term: options.academicTerm } : {}),
    }),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || contentType.includes("application/json")) {
    let messageEn = `Export failed (${res.status})`;
    let messageAr = "تعذّر إنشاء الشهادة.";
    try {
      const payload = await res.json();
      const envelope = payload?.message;
      messageEn = envelope?.message_en || messageEn;
      messageAr = envelope?.message_ar || messageAr;
    } catch {
      // A non-JSON error body tells us nothing useful; keep the defaults.
    }
    const error = new Error(messageEn) as Error & { messageAr?: string };
    error.messageAr = messageAr;
    throw error;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quarter-${quarter}-${student}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

import { ApiError } from "./client";

/**
 * The most useful text we have for a failed request.
 *
 * Prefers the Arabic message, then the English one, and only then the caller's
 * fallback. A generic "تعذّر الحفظ" hides the reason — "date of birth cannot be
 * in the future" is what the registrar actually needs to read.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.messageAr || err.message || fallback;
  }
  const e = err as { messageAr?: string; message?: string } | null;
  return e?.messageAr || e?.message || fallback;
}

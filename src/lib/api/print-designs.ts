/**
 * تصاميم الطباعة — the print design of each printed page, set in Settings.
 *
 * The server keeps the registry (`print_designs.DOCUMENTS`): which pages can
 * be designed, the design each prints with now, and a sample to preview a
 * draft on. Only the administration saves or resets a design; the office may
 * read and preview.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./client";

export type PrintTheme = "soft" | "classic" | "letter";
export type PrintOrientation = "Portrait" | "Landscape";
/** Where the design comes from: saved here, the school's own form, or the system. */
export type PrintDesignSource = "saved" | "school" | "builtin";

export interface PrintDesignRow {
  document: string;
  title: string;
  /** The screen it is printed from. */
  page: string;
  description: string;
  source: PrintDesignSource;
  sourceLabel: string;
  modified: string;
  modifiedBy: string;
}

/** What the editor changes, and what is sent to preview or save. */
export interface PrintDesignDraft {
  design: string;
  css: string;
  theme: PrintTheme;
  orientation: PrintOrientation;
  /** The design's own letterhead image; empty = the school's letterhead. */
  logo: string;
}

export interface PrintDesign extends PrintDesignDraft {
  document: string;
  title: string;
  page: string;
  description: string;
  note: string;
  source: PrintDesignSource;
  sourceLabel: string;
  /** Title of the school's own form of the same name, when it has one. */
  schoolForm: string;
  /** The school's letterhead, used when `logo` is empty. */
  defaultLogo: string;
  modified: string;
  modifiedBy: string;
  variables: Array<{ code: string; label: string }>;
  fields: Array<{ fieldname: string; label: string; fieldtype: string }>;
  /** The system's own design, offered when a school form is in the way. */
  builtin: Omit<PrintDesignDraft, "logo"> | null;
}

const KEY = "print-designs";

export function usePrintDesigns() {
  return useQuery<{ documents: PrintDesignRow[]; canEdit: boolean }>({
    queryKey: [KEY],
    queryFn: () => apiGet("print_designs.list_designs"),
  });
}

export function usePrintDesign(document: string | null) {
  return useQuery<PrintDesign>({
    queryKey: [KEY, document],
    queryFn: () => apiGet("print_designs.get_design", { document }),
    enabled: !!document,
    // The editor seeds its draft from this once; a refetch on focus must not
    // look like a change under the person typing.
    refetchOnWindowFocus: false,
  });
}

export function usePreviewPrintDesign() {
  return useMutation({
    mutationFn: (vars: { document: string; draft: PrintDesignDraft }) =>
      apiPost<{ html: string }>("print_designs.preview", {
        document: vars.document,
        payload: JSON.stringify(vars.draft),
      }),
  });
}

function useDesignWrite<V>(method: string, body: (vars: V) => Record<string, unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => apiPost<PrintDesign>(`print_designs.${method}`, body(vars)),
    onSuccess: (design) => {
      qc.setQueryData([KEY, design.document], design);
      void qc.invalidateQueries({ queryKey: [KEY], exact: true });
      if (design.document === "table") forgetTableFrame();
    },
  });
}

export function useSavePrintDesign() {
  return useDesignWrite("save_design", (vars: { document: string; draft: PrintDesignDraft }) => ({
    document: vars.document,
    payload: JSON.stringify(vars.draft),
  }));
}

export function useResetPrintDesign() {
  return useDesignWrite("reset_design", (document: string) => ({ document }));
}

/* -------------------------------------------------------------------------
 * The frame a printed table sits in
 * ---------------------------------------------------------------------- */

export interface TableFrame {
  /** The whole printable page, with a token where each value goes. */
  html: string;
  tokens: { title: string; date: string; count: string; table: string };
}

/** Kept a little while: one fetch serves every table printed meanwhile. */
const FRAME_TTL_MS = 2 * 60_000;
const FRAME_WAIT_MS = 4000;
let frameCache: { at: number; frame: TableFrame } | null = null;
let frameLoading: Promise<TableFrame | null> | null = null;

export function forgetTableFrame(): void {
  frameCache = null;
}

/**
 * The table print frame, or `null` when it cannot be had quickly — the
 * caller then prints the plain page it always printed.
 */
export function getTableFrame(): Promise<TableFrame | null> {
  if (frameCache && Date.now() - frameCache.at < FRAME_TTL_MS)
    return Promise.resolve(frameCache.frame);
  if (!frameLoading) {
    const load = apiGet<TableFrame>("print_designs.table_frame")
      .then((frame) => {
        frameCache = { at: Date.now(), frame };
        return frame;
      })
      .catch(() => null)
      .finally(() => {
        frameLoading = null;
      });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FRAME_WAIT_MS));
    frameLoading = Promise.race([load, timeout]);
  }
  return frameLoading;
}

/** The frame with its values put in. Values must already be HTML-safe. */
export function fillTableFrame(
  frame: TableFrame,
  values: { title: string; date: string; count: string; table: string },
): string {
  let html = frame.html;
  for (const key of ["title", "date", "count", "table"] as const) {
    // split/join, not replace: a table may hold "$&" and friends.
    html = html.split(frame.tokens[key]).join(values[key]);
  }
  return html;
}

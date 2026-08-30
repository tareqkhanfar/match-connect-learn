import { useCallback, useRef } from "react";

/**
 * Spreadsheet behaviour for a grid of inputs.
 *
 * Teachers enter marks and assessments the way they enter anything else: fast,
 * with two hands, without reaching for the mouse. That means arrows and Enter
 * walk the sheet, and a block copied out of Excel drops in where the caret is.
 * Both of those were written once for the mark sheet; this is that behaviour
 * pulled out so the assessment and homework sheets get it too rather than a
 * near-copy that drifts.
 *
 * The grid tells the hook only how big it is and which cells accept input.
 * What a cell contains — a number, a word, a chosen option — is the grid's
 * business.
 */
export interface SheetNavOptions {
  /** How many rows the sheet has. */
  rows: number;
  /** How many columns the sheet has, counting ones that take no input. */
  cols: number;
  /** Prefix for the generated cell ids, so two sheets on a page never collide. */
  prefix: string;
  /** False for a column the caret should skip — a computed total, say. */
  isEditable?: (col: number) => boolean;
  /** Called for each pasted value with its destination. */
  onPasteCell?: (row: number, col: number, value: string) => void;
}

export function useSheetNav({
  rows,
  cols,
  prefix,
  isEditable = () => true,
  onPasteCell,
}: SheetNavOptions) {
  const gridRef = useRef<HTMLDivElement>(null);

  const cellId = useCallback((row: number, col: number) => `${prefix}-${row}-${col}`, [prefix]);

  const focusCell = useCallback(
    (row: number, col: number) => {
      const el = gridRef.current?.querySelector<HTMLElement>(`#${cellId(row, col)}`);
      el?.focus();
      if (el instanceof HTMLInputElement) el.select();
    },
    [cellId],
  );

  /** Arrows and Enter walk the sheet the way a spreadsheet does. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      const moves: Record<string, [number, number]> = {
        ArrowUp: [row - 1, col],
        ArrowDown: [row + 1, col],
        Enter: [row + 1, col],
        // The page is RTL, so the visual "left" is the next column along.
        ArrowLeft: [row, col + 1],
        ArrowRight: [row, col - 1],
      };
      const move = moves[e.key];
      if (!move) return false;

      const [r, c] = move;
      if (r < 0 || r >= rows) return false;

      // Step past columns that take no input, rather than dropping the caret
      // on one and leaving the teacher stuck.
      const step = c > col ? 1 : c < col ? -1 : 0;
      let target = c;
      while (step !== 0 && target >= 0 && target < cols && !isEditable(target)) target += step;
      if (target < 0 || target >= cols || !isEditable(target)) return false;

      e.preventDefault();
      focusCell(r, target);
      return true;
    },
    [rows, cols, isEditable, focusCell],
  );

  /**
   * Paste a block out of Excel.
   *
   * Schools keep marks in spreadsheets, and retyping a column of forty is how
   * transcription errors get in. A tab/newline block dropped on a cell fills
   * outward from it, clipped to the sheet's own bounds and skipping columns
   * that take no input — a copied block has no cell for a computed figure, so
   * counting one would shift every value along by a column.
   */
  const onPaste = useCallback(
    (e: React.ClipboardEvent, row: number, col: number) => {
      if (!onPasteCell) return;
      const text = e.clipboardData.getData("text/plain");
      if (!text || !/[\t\n\r]/.test(text)) return; // a single value pastes normally
      e.preventDefault();

      const block = text
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .filter((line, i, all) => line !== "" || i < all.length - 1)
        .map((line) => line.split("\t"));

      block.forEach((line, dr) => {
        const r = row + dr;
        if (r >= rows) return;
        let at = col;
        line.forEach((raw) => {
          while (at < cols && !isEditable(at)) at += 1;
          if (at >= cols) return;
          onPasteCell(r, at, raw.trim());
          at += 1;
        });
      });
    },
    [rows, cols, isEditable, onPasteCell],
  );

  return { gridRef, cellId, focusCell, onKeyDown, onPaste };
}

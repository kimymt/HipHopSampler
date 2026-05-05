/**
 * Pad id helpers.
 *
 * Internal pad ids use a `row-col` shape ("0-0", "0-1", ..., "3-3") because
 * that's what the original 4×4 grid layout naturally produces. Users see
 * pads numbered 1..16 (left-to-right, top-to-bottom), so every place that
 * displays a pad to the user routes through these helpers to keep the
 * mapping consistent.
 *
 * Single source of truth — earlier we had two inline implementations of
 * the same arithmetic (Mixer + PadGrid), and a third place displaying the
 * raw "0-0" string by accident. Centralizing avoids that drift.
 */

const COLS = 4;

/** Convert a pad id like "2-3" to its 1-based display number (e.g. 12). */
export const padIdToNumber = (padId: string): number => {
  const [row, col] = padId.split('-').map((n) => parseInt(n, 10));
  if (Number.isNaN(row) || Number.isNaN(col)) return 0;
  return row * COLS + col + 1;
};

/** Convert a pad id to a zero-padded two-digit string ("01".."16"). */
export const padIdToDisplayString = (padId: string): string => {
  return padIdToNumber(padId).toString().padStart(2, '0');
};

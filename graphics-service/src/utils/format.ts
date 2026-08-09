/**
 * Value + unit formatting, shared by every template so a chart never disagrees
 * with itself about spacing.
 */

/**
 * Units that read as a magnitude suffix rather than a unit of measure, and so
 * attach directly to the number: `42k`, `3M`, `10x`. A compound unit whose
 * first token is one of these attaches too (`"k qps"` -> `42k qps`), which is
 * the whole reason this is token-wise rather than a plain string check.
 */
const ATTACHED_UNITS = new Set(["k", "K", "M", "G", "T", "B", "x", "X"]);

/**
 * Whether `unit` butts up against the number or takes a space before it.
 *
 * Symbols attach (`94%`, `12°`), words separate (`25 deps`, `120 ms`) — the
 * SI convention, and the thing that makes `25deps` look broken. A unit that
 * already starts with a space is passed through as the caller wrote it.
 */
function attachesToNumber(unit: string): boolean {
  const head = unit.split(" ")[0] ?? "";
  if (head === "") return true; // leading space: caller spaced it themselves
  if (!/^\p{L}/u.test(head)) return true; // %, °, ×, $, / ...
  return ATTACHED_UNITS.has(head);
}

/**
 * Renders a number for display: integers bare, everything else to one decimal.
 * Kept separate from the unit so axis ticks and value labels round identically.
 */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

/** Renders a value with its unit, spaced per `attachesToNumber`. */
export function formatValue(value: number, unit?: string): string {
  const rounded = formatNumber(value);
  if (!unit) return rounded;
  return attachesToNumber(unit) ? `${rounded}${unit}` : `${rounded} ${unit}`;
}

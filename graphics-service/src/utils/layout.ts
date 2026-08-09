import type { TextAlign } from "../schemas/common.js";

export interface HeadingAnchor {
  x: number;
  align: "start" | "middle" | "end";
}

/**
 * Where the title/subtitle baseline starts, for a given alignment. Templates
 * position headings through this so `textAlign` behaves identically across
 * every template.
 */
export function headingAnchor(
  textAlign: TextAlign | undefined,
  width: number,
  padding: number,
): HeadingAnchor {
  switch (textAlign) {
    case "center":
      return { x: width / 2, align: "middle" };
    case "right":
      return { x: width - padding, align: "end" };
    default:
      return { x: padding, align: "start" };
  }
}

/**
 * Applies an optional caller-supplied `height`. It's a floor, not an override:
 * a height smaller than the content needs would clip the chart, so the
 * computed height wins in that case. Extra room lands below the content.
 */
export function applyMinHeight(computed: number, requested?: number): number {
  return requested !== undefined && requested > computed ? requested : computed;
}

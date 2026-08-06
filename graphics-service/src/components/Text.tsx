import { color, typography, type ColorToken, type TypographyToken } from "../utils/tokens.js";

export interface TextProps {
  x: number;
  y: number;
  children: string;
  variant?: TypographyToken;
  color?: ColorToken;
  align?: "start" | "middle" | "end";
  weight?: number;
}

/**
 * Text primitive. Font size / weight / line-height always come from the
 * typography scale — the only thing callers position is x/y and pick a
 * variant + color.
 */
export function Text({
  x,
  y,
  children,
  variant = "body",
  color: colorToken = "text",
  align = "start",
  weight,
}: TextProps) {
  const style = typography[variant];
  return (
    <text
      x={x}
      y={y}
      fontSize={style.fontSize}
      fontWeight={weight ?? style.fontWeight}
      fill={color[colorToken]}
      textAnchor={align}
    >
      {children}
    </text>
  );
}

/** Measures approximate rendered width of a string for a given typography variant. */
export function measureText(text: string, variant: TypographyToken = "body"): number {
  const { fontSize, fontWeight } = typography[variant];
  // Average glyph-width heuristic for Inter. Deterministic and good enough
  // for layout (centering, right-alignment, column sizing) without needing
  // a headless font-metrics engine.
  const avgCharWidth = fontSize * (fontWeight >= 600 ? 0.58 : 0.54);
  return Math.ceil(text.length * avgCharWidth);
}

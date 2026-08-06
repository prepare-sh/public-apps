/**
 * Design tokens.
 *
 * Everything visual in this service should trace back to one of these
 * values. No ad-hoc numbers or colors in component/template code.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export type SpacingToken = keyof typeof spacing;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
} as const;

export type RadiusToken = keyof typeof radius;

export const color = {
  primary: "#2563EB",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  background: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
} as const;

export type ColorToken = keyof typeof color;

/**
 * A "semantic" subset of colors used for status/accent variants across
 * templates (bars, badges, arrows, etc). Kept separate from the full
 * palette so components can restrict their `variant` prop types.
 */
export const accent = {
  primary: color.primary,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
  muted: color.muted,
} as const;

export type AccentToken = keyof typeof accent;

/**
 * Ordered categorical palette for multi-series charts, where the 5 semantic
 * `accent` colors run out. Series take colors by index
 * (`seriesPalette[i % seriesPalette.length]`), so the same input always
 * produces the same colors. Deliberately desaturated to match the rest of
 * the palette.
 */
export const seriesPalette = [
  "#2563EB", // blue (primary)
  "#16A34A", // green
  "#F59E0B", // amber
  "#DC2626", // red
  "#7C3AED", // violet
  "#0EA5E9", // sky
  "#DB2777", // pink
  "#65A30D", // lime
  "#6B7280", // gray
  "#0D9488", // teal
] as const;

export const fontFamily = "Inter, sans-serif";

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export type FontWeightToken = keyof typeof fontWeight;

/**
 * Typography scale. Every text element in the system must reference one
 * of these entries rather than an inline font-size.
 */
export const typography = {
  title: { fontSize: 28, fontWeight: fontWeight.bold, lineHeight: 34 },
  subtitle: { fontSize: 15, fontWeight: fontWeight.regular, lineHeight: 20 },
  heading: { fontSize: 18, fontWeight: fontWeight.semibold, lineHeight: 24 },
  label: { fontSize: 13, fontWeight: fontWeight.medium, lineHeight: 16 },
  body: { fontSize: 13, fontWeight: fontWeight.regular, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: fontWeight.medium, lineHeight: 14 },
  value: { fontSize: 13, fontWeight: fontWeight.semibold, lineHeight: 16 },
} as const;

export type TypographyToken = keyof typeof typography;

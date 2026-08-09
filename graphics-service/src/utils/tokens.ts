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

/**
 * Accent hues are the `--rb-badge-fg` values from the site's badge system, so
 * a chart dropped into an article matches the badges around it. The badges
 * pair each hue with the same hue at 17% alpha for their background — that
 * ratio is `ACCENT_TINT_OPACITY` below.
 */
export const color = {
  primary: "#3B6FFF",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  purple: "#7C3AED",
  background: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
} as const;

/** Alpha the badge system uses for an accent's tinted background. */
export const ACCENT_TINT_OPACITY = 0.17;

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
  purple: color.purple,
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
  color.primary, // blue
  color.success, // green
  color.warning, // amber
  color.danger, // red
  color.purple, // purple
  color.muted, // gray
  // Beyond the six badge hues the palette has to invent colors; these are
  // picked to sit at the same saturation so a 7+ series chart stays coherent.
  "#0EA5E9", // sky
  "#DB2777", // pink
  "#65A30D", // lime
  "#0D9488", // teal
] as const;

/**
 * resvg resolves this against `assets/fonts` only (system fonts are off), so
 * "Source Sans 3" is the one entry that actually matches — the rest mirror the
 * site's CSS stack and serve as documentation for SVG output rendered in a
 * browser, where the earlier names may resolve.
 */
// Single-quoted deliberately: this string is interpolated raw into a
// double-quoted `font-family="..."` attribute in renderMultipleToSvg.
export const fontFamily =
  "'Source Sans Pro', 'Source Sans 3', ui-sans-serif, system-ui, sans-serif";

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

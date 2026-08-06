import { accent, spacing, type AccentToken } from "../utils/tokens.js";
import { measureText } from "./Text.js";

export interface BadgeProps {
  x: number;
  y: number;
  label: string;
  variant?: AccentToken;
}

const BADGE_HEIGHT = 22;

/** Small pill-shaped status label, e.g. "Best", "Beta", "Deprecated". */
export function Badge({ x, y, label, variant = "primary" }: BadgeProps) {
  const textWidth = measureText(label, "caption");
  const paddingX = spacing.sm;
  const width = textWidth + paddingX * 2;
  const accentColor = accent[variant];

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={0} y={0} width={width} height={BADGE_HEIGHT} rx={BADGE_HEIGHT / 2} ry={BADGE_HEIGHT / 2} fill={`${accentColor}1A`} />
      <text
        x={width / 2}
        y={BADGE_HEIGHT / 2 + 4}
        fontSize={11}
        fontWeight={600}
        fill={accentColor}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

export const badgeHeight = BADGE_HEIGHT;

import { color, radius, type ColorToken, type RadiusToken } from "../utils/tokens.js";

export interface RectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: ColorToken;
  stroke?: ColorToken;
  strokeWidth?: number;
  cornerRadius?: RadiusToken;
  opacity?: number;
}

/** Basic rectangle primitive. Radius always comes from the radius scale. */
export function Rect({
  x,
  y,
  width,
  height,
  fill = "primary",
  stroke,
  strokeWidth = 1,
  cornerRadius,
  opacity,
}: RectProps) {
  return (
    <rect
      x={x}
      y={y}
      width={Math.max(width, 0)}
      height={Math.max(height, 0)}
      rx={cornerRadius ? radius[cornerRadius] : 0}
      ry={cornerRadius ? radius[cornerRadius] : 0}
      fill={color[fill]}
      stroke={stroke ? color[stroke] : "none"}
      strokeWidth={stroke ? strokeWidth : 0}
      opacity={opacity}
    />
  );
}

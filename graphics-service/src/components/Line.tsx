import { color, type ColorToken } from "../utils/tokens.js";

export interface LineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: ColorToken;
  strokeWidth?: number;
  dashed?: boolean;
}

/** Basic straight line primitive. */
export function Line({ x1, y1, x2, y2, stroke = "border", strokeWidth = 1, dashed = false }: LineProps) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color[stroke]}
      strokeWidth={strokeWidth}
      strokeDasharray={dashed ? "4 4" : undefined}
      strokeLinecap="round"
    />
  );
}

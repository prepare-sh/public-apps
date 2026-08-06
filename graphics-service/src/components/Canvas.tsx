import type { ReactNode } from "react";
import { color, fontFamily } from "../utils/tokens.js";

export interface CanvasProps {
  width: number;
  height: number;
  background?: string;
  children: ReactNode;
}

/**
 * Root SVG element every template renders into. Owns the document
 * dimensions, background fill, and the base font-family so children never
 * need to repeat it.
 */
export function Canvas({ width, height, background = color.background, children }: CanvasProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fontFamily={fontFamily}
    >
      <rect x={0} y={0} width={width} height={height} fill={background} />
      {children}
    </svg>
  );
}

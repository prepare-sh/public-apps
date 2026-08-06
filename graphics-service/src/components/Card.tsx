import type { ReactNode } from "react";
import { color, radius, spacing, type ColorToken, type RadiusToken } from "../utils/tokens.js";
import { Text } from "./Text.js";

export interface CardProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: ColorToken;
  stroke?: ColorToken;
  cornerRadius?: RadiusToken;
  title?: string;
  /** Children are positioned in a coordinate space local to the card (0,0 = top-left of the card interior). */
  children?: ReactNode;
}

/**
 * Rounded container panel. Establishes a local `<g transform="translate">`
 * coordinate space so children (and templates composing them) can be
 * authored as if the card were at the origin.
 */
export function Card({
  x,
  y,
  width,
  height,
  fill = "background",
  stroke = "border",
  cornerRadius = "lg",
  title,
  children,
}: CardProps) {
  const pad = spacing.lg;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={radius[cornerRadius]}
        ry={radius[cornerRadius]}
        fill={color[fill]}
        stroke={color[stroke]}
        strokeWidth={1}
      />
      {title ? (
        <Text x={pad} y={pad + 14} variant="heading">
          {title}
        </Text>
      ) : null}
      <g transform={`translate(${pad}, ${title ? pad + spacing["2xl"] : pad})`}>{children}</g>
    </g>
  );
}

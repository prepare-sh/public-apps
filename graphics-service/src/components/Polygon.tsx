export interface PolygonProps {
  points: { x: number; y: number }[];
  /**
   * Raw color string rather than a ColorToken: callers pass categorical
   * series colors from `seriesPalette`, which is a plain string array and
   * not part of the ColorToken union.
   */
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  /** Connects the last point back to the first. */
  closed?: boolean;
}

/** Arbitrary N-vertex shape: grid rings, radar areas, generic outlines. */
export function Polygon({
  points,
  fill = "none",
  fillOpacity,
  stroke,
  strokeWidth = 1,
  closed = true,
}: PolygonProps) {
  const d = points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");

  if (!closed) {
    return (
      <polyline
        points={d}
        fill={fill}
        fillOpacity={fill === "none" ? undefined : fillOpacity}
        stroke={stroke ?? "none"}
        strokeWidth={stroke ? strokeWidth : 0}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    );
  }

  return (
    <polygon
      points={d}
      fill={fill}
      fillOpacity={fill === "none" ? undefined : fillOpacity}
      stroke={stroke ?? "none"}
      strokeWidth={stroke ? strokeWidth : 0}
      strokeLinejoin="round"
    />
  );
}

/** Keeps generated path data compact and stable across renders. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

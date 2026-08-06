import { accent, type AccentToken } from "../utils/tokens.js";

export interface ArrowProps {
  /** Unique id for this arrow's marker definition. Must be unique within the document. */
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  variant?: AccentToken;
  strokeWidth?: number;
  dashed?: boolean;
  label?: string;
}

/**
 * Straight connector with an arrowhead at the end point. Used for flow /
 * pipeline / architecture diagrams. Each instance defines its own
 * `<marker>` scoped by `id` so multiple arrows with different colors can
 * coexist in one document.
 */
export function Arrow({ id, x1, y1, x2, y2, variant = "muted", strokeWidth = 1.5, dashed = false, label }: ArrowProps) {
  const markerId = `arrow-${id}`;
  const strokeColor = accent[variant];
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={7}
          markerHeight={7}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={strokeColor} />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? "4 4" : undefined}
        markerEnd={`url(#${markerId})`}
      />
      {label ? (
        <>
          <rect x={midX - label.length * 3.2 - 4} y={midY - 9} width={label.length * 6.4 + 8} height={16} fill="white" />
          <text x={midX} y={midY + 3} fontSize={11} fontWeight={500} fill={strokeColor} textAnchor="middle">
            {label}
          </text>
        </>
      ) : null}
    </g>
  );
}

import { Canvas } from "../components/Canvas.js";
import { Text, measureText } from "../components/Text.js";
import { Line } from "../components/Line.js";
import { Polygon } from "../components/Polygon.js";
import { color, spacing, seriesPalette } from "../utils/tokens.js";
import { applyMinHeight, headingAnchor, type HeadingAnchor } from "../utils/layout.js";
import type { RadarChartInput, RadarSeries } from "../schemas/radar.js";

const PADDING = spacing.xl; // 24
const HEADER_HEIGHT_NO_SUBTITLE = 52;
const HEADER_HEIGHT_WITH_SUBTITLE = 76;

/**
 * Horizontal room reserved on each side of the plot for axis labels. The
 * actual gutter grows to fit the widest label, up to AXIS_LABEL_GUTTER_MAX_X
 * — past that the plot would collapse, so labels truncate instead.
 */
const AXIS_LABEL_GUTTER_MIN_X = 96;
/** Ceiling on the label gutter, as a fraction of total width (each side). */
const AXIS_LABEL_GUTTER_MAX_RATIO = 0.3;
/** Vertical room above/below the plot for the top and bottom axis labels. */
const AXIS_LABEL_GUTTER_Y = 40;
/**
 * Gap between the outer ring and the axis labels. Wide enough that a
 * highlighted vertex sitting at full scale still clears its axis label.
 */
const AXIS_LABEL_OFFSET = spacing.xl;
const VERTEX_LABEL_OFFSET = 13;
const MIN_PLOT_RADIUS = 80;

const RING_RATIOS = [0.25, 0.5, 0.75, 1] as const;
const AREA_FILL_OPACITY = 0.18;
/**
 * Past this many series the translucent fills stack into an opaque blob that
 * swallows the grid, so only the highlighted area stays filled and the rest
 * read as outlines.
 */
const MAX_FILLED_SERIES = 3;
const AREA_STROKE_WIDTH = 1.75;
const VERTEX_RADIUS = 3;

const LEGEND_TOP_GAP = spacing.xl;
const LEGEND_ROW_HEIGHT = 20;
const LEGEND_SWATCH_WIDTH = 18;
const LEGEND_SWATCH_GAP = spacing.sm;
const LEGEND_ITEM_GAP = spacing.lg;

interface Point {
  x: number;
  y: number;
}

/** A plotted vertex, carrying the axis geometry it was derived from. */
interface Vertex extends Point {
  angle: number;
  value: number;
}

interface AxisGeometry {
  label: string;
  angle: number;
  max: number;
}

interface SeriesGeometry {
  name: string;
  stroke: string;
  highlight: boolean;
  vertices: Vertex[];
}

interface LegendItem {
  name: string;
  stroke: string;
  width: number;
}

/**
 * Angle of an axis in radians. The first axis points straight up and the
 * rest are spaced evenly clockwise.
 */
function axisAngle(index: number, axisCount: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / axisCount;
}

/** Point at `ratio` (0..1) of the way out along an axis. */
function pointOnAxis(center: Point, radius: number, angle: number, ratio: number): Point {
  return {
    x: center.x + Math.cos(angle) * radius * ratio,
    y: center.y + Math.sin(angle) * radius * ratio,
  };
}

/** Anchors a label to the side of the circle it sits on, so it reads away from the plot. */
function anchorForAngle(angle: number): "start" | "middle" | "end" {
  const dx = Math.cos(angle);
  if (Math.abs(dx) < 0.05) return "middle";
  return dx > 0 ? "start" : "end";
}

/** Nudges a label vertically so top/bottom labels clear the outer ring. */
function baselineShiftForAngle(angle: number): number {
  const dy = Math.sin(angle);
  if (Math.abs(dy) < 0.05) return 4; // horizontal axis: optical centering
  return dy > 0 ? 12 : -4;
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function truncate(text: string, maxWidth: number): string {
  const width = measureText(text, "label");
  if (width <= maxWidth) return text;
  const cut = Math.max(1, Math.floor(text.length * (maxWidth / width)) - 1);
  return `${text.slice(0, cut)}…`;
}

/**
 * Horizontal space the axis labels need. Side labels extend their full width
 * away from the plot; top/bottom labels are centered, so they only spill half
 * their width to each side.
 */
function axisLabelGutter(input: RadarChartInput, width: number): number {
  const needed = input.axes.map((axis, i) => {
    const labelWidth = measureText(axis.label, "label");
    const angle = axisAngle(i, input.axes.length);
    return anchorForAngle(angle) === "middle" ? labelWidth / 2 : labelWidth;
  });
  const widest = Math.max(...needed);
  return Math.min(
    Math.max(widest + AXIS_LABEL_OFFSET, AXIS_LABEL_GUTTER_MIN_X),
    width * AXIS_LABEL_GUTTER_MAX_RATIO,
  );
}

function seriesColor(series: RadarSeries, index: number): string {
  return series.color ?? seriesPalette[index % seriesPalette.length] ?? seriesPalette[0];
}

/** Packs legend entries into rows that fit the available width. */
function legendRows(input: RadarChartInput, availableWidth: number): LegendItem[][] {
  const items: LegendItem[] = input.series.map((s, i) => ({
    name: s.name,
    stroke: seriesColor(s, i),
    width: LEGEND_SWATCH_WIDTH + LEGEND_SWATCH_GAP + measureText(s.name, "caption"),
  }));

  const rows: LegendItem[][] = [];
  let row: LegendItem[] = [];
  let rowWidth = 0;

  for (const item of items) {
    const added = row.length === 0 ? item.width : rowWidth + LEGEND_ITEM_GAP + item.width;
    if (row.length > 0 && added > availableWidth) {
      rows.push(row);
      row = [item];
      rowWidth = item.width;
    } else {
      row.push(item);
      rowWidth = added;
    }
  }
  if (row.length > 0) rows.push(row);

  return rows;
}

function rowWidth(row: LegendItem[]): number {
  return row.reduce((sum, item, i) => sum + item.width + (i > 0 ? LEGEND_ITEM_GAP : 0), 0);
}

interface RadarLayout {
  width: number;
  height: number;
  center: Point;
  plotRadius: number;
  gutterX: number;
  legendTop: number;
  rows: LegendItem[][];
  heading: HeadingAnchor;
}

/** Single source of truth for geometry — used by both the dimensions helper and the render. */
function radarChartLayout(input: RadarChartInput): RadarLayout {
  const width = input.width ?? 720;
  const headerHeight = input.subtitle ? HEADER_HEIGHT_WITH_SUBTITLE : HEADER_HEIGHT_NO_SUBTITLE;

  const gutterX = axisLabelGutter(input, width);
  const plotRadius = Math.max(MIN_PLOT_RADIUS, (width - 2 * PADDING - 2 * gutterX) / 2);

  const plotTop = PADDING + headerHeight;
  const center: Point = {
    x: width / 2,
    y: plotTop + AXIS_LABEL_GUTTER_Y + plotRadius,
  };

  const legendTop = center.y + plotRadius + AXIS_LABEL_GUTTER_Y + LEGEND_TOP_GAP;
  const rows = legendRows(input, width - 2 * PADDING);
  const content = legendTop + rows.length * LEGEND_ROW_HEIGHT + PADDING;
  const height = applyMinHeight(content, input.height);

  return {
    width,
    height,
    center,
    plotRadius,
    gutterX,
    legendTop,
    rows,
    heading: headingAnchor(input.textAlign, width, PADDING),
  };
}

export function radarChartDimensions(input: RadarChartInput): { width: number; height: number } {
  const { width, height } = radarChartLayout(input);
  return { width, height };
}

export function RadarChart(props: RadarChartInput) {
  const { title, subtitle, axes, series } = props;
  const { width, height, center, plotRadius, gutterX, legendTop, rows, heading } =
    radarChartLayout(props);

  const axisGeometry: AxisGeometry[] = axes.map((axis, i) => ({
    label: axis.label,
    angle: axisAngle(i, axes.length),
    max: axis.max ?? props.maxValue ?? 1,
  }));

  // The labelled series is the first one explicitly flagged, else the first
  // series. Labelling every vertex of every series is unreadable.
  const flaggedIndex = series.findIndex((s) => s.highlight === true);
  const highlightIndex = flaggedIndex >= 0 ? flaggedIndex : 0;

  const seriesGeometry: SeriesGeometry[] = series.map((s, seriesIndex) => ({
    name: s.name,
    stroke: seriesColor(s, seriesIndex),
    highlight: seriesIndex === highlightIndex,
    vertices: axisGeometry.map((axis, i) => {
      const value = s.values[i] ?? 0;
      const ratio = axis.max > 0 ? Math.min(value / axis.max, 1) : 0;
      return { ...pointOnAxis(center, plotRadius, axis.angle, ratio), angle: axis.angle, value };
    }),
  }));

  // Draw the highlighted series last so it sits on top of the others.
  const drawOrder = [...seriesGeometry].sort(
    (a, b) => Number(a.highlight) - Number(b.highlight),
  );
  const highlighted = seriesGeometry.find((s) => s.highlight);

  return (
    <Canvas width={width} height={height}>
      <Text x={heading.x} y={PADDING + 20} variant="title" align={heading.align}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          x={heading.x}
          y={PADDING + 44}
          variant="subtitle"
          color="muted"
          align={heading.align}
        >
          {subtitle}
        </Text>
      ) : null}

      {RING_RATIOS.map((ratio) => (
        <Polygon
          key={`ring-${ratio}`}
          points={axisGeometry.map((axis) => pointOnAxis(center, plotRadius, axis.angle, ratio))}
          fill="none"
          stroke={color.border}
        />
      ))}

      {axisGeometry.map((axis, i) => {
        const outer = pointOnAxis(center, plotRadius, axis.angle, 1);
        return (
          <Line key={`spoke-${i}`} x1={center.x} y1={center.y} x2={outer.x} y2={outer.y} stroke="border" />
        );
      })}

      {axisGeometry.map((axis, i) => {
        const anchor = pointOnAxis(center, plotRadius + AXIS_LABEL_OFFSET, axis.angle, 1);
        const align = anchorForAngle(axis.angle);
        // Centered labels spill into the gutter on both sides; side labels only one.
        const room = gutterX - AXIS_LABEL_OFFSET;
        return (
          <Text
            key={`axis-label-${i}`}
            x={anchor.x}
            y={anchor.y + baselineShiftForAngle(axis.angle)}
            variant="label"
            color="muted"
            align={align}
          >
            {truncate(axis.label, align === "middle" ? room * 2 : room)}
          </Text>
        );
      })}

      {drawOrder.map((s) => {
        const filled = series.length <= MAX_FILLED_SERIES || s.highlight;
        return (
          <g key={`series-${s.name}`}>
            <Polygon
              points={s.vertices}
              fill={filled ? s.stroke : "none"}
              fillOpacity={AREA_FILL_OPACITY}
              stroke={s.stroke}
              strokeWidth={AREA_STROKE_WIDTH}
            />
            {s.vertices.map((vertex, i) => (
              <circle key={`vertex-${i}`} cx={vertex.x} cy={vertex.y} r={VERTEX_RADIUS} fill={s.stroke} />
            ))}
          </g>
        );
      })}

      {(highlighted?.vertices ?? []).map((vertex, i) => (
        <Text
          key={`vertex-label-${i}`}
          x={vertex.x + Math.cos(vertex.angle) * VERTEX_LABEL_OFFSET}
          y={vertex.y + Math.sin(vertex.angle) * VERTEX_LABEL_OFFSET + baselineShiftForAngle(vertex.angle) / 2 + 4}
          variant="caption"
          align={anchorForAngle(vertex.angle)}
        >
          {formatValue(vertex.value)}
        </Text>
      ))}

      {rows.map((row, rowIndex) => {
        const y = legendTop + rowIndex * LEGEND_ROW_HEIGHT;
        let x = (width - rowWidth(row)) / 2;
        return (
          <g key={`legend-row-${rowIndex}`}>
            {row.map((item) => {
              const itemX = x;
              x += item.width + LEGEND_ITEM_GAP;
              return (
                <g key={item.name}>
                  <line
                    x1={itemX}
                    y1={y}
                    x2={itemX + LEGEND_SWATCH_WIDTH}
                    y2={y}
                    stroke={item.stroke}
                    strokeWidth={AREA_STROKE_WIDTH}
                    strokeLinecap="round"
                  />
                  <Text
                    x={itemX + LEGEND_SWATCH_WIDTH + LEGEND_SWATCH_GAP}
                    y={y + 4}
                    variant="caption"
                    color="muted"
                  >
                    {item.name}
                  </Text>
                </g>
              );
            })}
          </g>
        );
      })}
    </Canvas>
  );
}

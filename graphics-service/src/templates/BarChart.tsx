import { Canvas } from "../components/Canvas.js";
import { Text, measureText } from "../components/Text.js";
import { Rect } from "../components/Rect.js";
import { Line } from "../components/Line.js";
import { spacing, type AccentToken } from "../utils/tokens.js";
import { headingAnchor, type HeadingAnchor } from "../utils/layout.js";
import type { BarChartInput } from "../schemas/bar.js";

const PADDING = spacing.xl; // 24
const HEADER_HEIGHT_NO_SUBTITLE = 52;
const HEADER_HEIGHT_WITH_SUBTITLE = 76;

/** Default height of the plot area itself. `height` on the input grows this. */
const PLOT_HEIGHT = 240;
const MIN_PLOT_HEIGHT = 120;
/** Room above the top gridline so a full-scale column's value label still fits. */
const TOP_HEADROOM = 20;
/** Strip under the baseline holding the category labels. */
const CATEGORY_LABEL_HEIGHT = 28;

/** Y-axis tick label gutter: measured, but never narrower than this. */
const TICK_GUTTER_MIN = 32;
const TICK_GUTTER_GAP = spacing.sm;
const TICK_RATIOS = [0, 0.25, 0.5, 0.75, 1] as const;

const COLUMN_WIDTH_RATIO = 0.62;
const COLUMN_MAX_WIDTH = 56;
const COLUMN_MIN_WIDTH = 4;
const VALUE_LABEL_GAP = 6;
/** Columns lose contrast when another column is the highlighted one. */
const DIMMED_OPACITY = 0.35;

function formatValue(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return unit ? `${rounded}${unit}` : rounded;
}

/**
 * Rounds an axis max up to a round number (1 / 2 / 2.5 / 5 / 10 × 10^n), so
 * the four gridline labels land on readable values instead of the raw data max.
 */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 2, 2.5, 5, 10].find((s) => normalized <= s) ?? 10;
  return step * magnitude;
}

function axisMax(input: BarChartInput): number {
  return input.maxValue ?? niceMax(Math.max(...input.columns.map((c) => c.value)));
}

/** Widest tick label decides how much room the value axis needs. */
function tickGutter(input: BarChartInput): number {
  const max = axisMax(input);
  const widest = Math.max(
    ...TICK_RATIOS.map((r) => measureText(formatValue(max * r, input.unit), "caption")),
  );
  return Math.max(widest + TICK_GUTTER_GAP, TICK_GUTTER_MIN);
}

function truncate(text: string, maxWidth: number): string {
  const width = measureText(text, "label");
  if (width <= maxWidth) return text;
  const cut = Math.max(1, Math.floor(text.length * (maxWidth / width)) - 1);
  return `${text.slice(0, cut)}…`;
}

interface BarLayout {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  max: number;
  heading: HeadingAnchor;
}

/** Single source of truth for geometry — shared by the dimensions helper and the render. */
function barChartLayout(input: BarChartInput): BarLayout {
  const width = input.width ?? 720;
  const headerHeight = input.subtitle ? HEADER_HEIGHT_WITH_SUBTITLE : HEADER_HEIGHT_NO_SUBTITLE;
  const chrome = PADDING + headerHeight + TOP_HEADROOM + CATEGORY_LABEL_HEIGHT + PADDING;

  // Unlike the other templates, extra height is useful here — it makes the
  // columns taller rather than padding the canvas with whitespace.
  const plotHeight = Math.max(
    MIN_PLOT_HEIGHT,
    input.height !== undefined ? input.height - chrome : PLOT_HEIGHT,
  );

  const plotTop = PADDING + headerHeight + TOP_HEADROOM;
  const plotBottom = plotTop + plotHeight;
  const plotLeft = PADDING + tickGutter(input);

  return {
    width,
    height: plotBottom + CATEGORY_LABEL_HEIGHT + PADDING,
    plotLeft,
    plotRight: width - PADDING,
    plotTop,
    plotBottom,
    max: axisMax(input),
    heading: headingAnchor(input.textAlign, width, PADDING),
  };
}

export function barChartDimensions(input: BarChartInput): { width: number; height: number } {
  const { width, height } = barChartLayout(input);
  return { width, height };
}

export function BarChart(props: BarChartInput) {
  const { title, subtitle, unit, columns } = props;
  const showValues = props.showValues ?? true;
  const { width, height, plotLeft, plotRight, plotTop, plotBottom, max, heading } =
    barChartLayout(props);

  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const pitch = plotWidth / columns.length;
  const columnWidth = Math.max(
    COLUMN_MIN_WIDTH,
    Math.min(pitch * COLUMN_WIDTH_RATIO, COLUMN_MAX_WIDTH),
  );
  const anyHighlighted = columns.some((c) => c.highlight);

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

      {TICK_RATIOS.map((ratio) => {
        const y = plotBottom - plotHeight * ratio;
        return (
          <g key={`tick-${ratio}`}>
            <Line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="border" />
            <Text
              x={plotLeft - TICK_GUTTER_GAP}
              y={y + 4}
              variant="caption"
              color="muted"
              align="end"
            >
              {formatValue(max * ratio, unit)}
            </Text>
          </g>
        );
      })}

      {columns.map((column, i) => {
        const centerX = plotLeft + pitch * (i + 0.5);
        const ratio = max > 0 ? Math.min(column.value / max, 1) : 0;
        const columnHeight = plotHeight * ratio;
        const columnTop = plotBottom - columnHeight;
        const variant: AccentToken = column.variant ?? "primary";

        return (
          <g key={`${column.label}-${i}`}>
            <Rect
              x={centerX - columnWidth / 2}
              y={columnTop}
              width={columnWidth}
              height={columnHeight}
              fill={variant}
              cornerRadius="sm"
              opacity={anyHighlighted && !column.highlight ? DIMMED_OPACITY : undefined}
            />
            {showValues ? (
              <Text
                x={centerX}
                y={columnTop - VALUE_LABEL_GAP}
                variant="value"
                align="middle"
                color={anyHighlighted && !column.highlight ? "muted" : "text"}
              >
                {formatValue(column.value, unit)}
              </Text>
            ) : null}
            <Text
              x={centerX}
              y={plotBottom + 20}
              variant="label"
              align="middle"
              color="muted"
            >
              {truncate(column.label, pitch - spacing.xs)}
            </Text>
          </g>
        );
      })}
    </Canvas>
  );
}

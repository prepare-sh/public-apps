import { Canvas } from "../components/Canvas.js";
import { Text, measureText } from "../components/Text.js";
import { Rect } from "../components/Rect.js";
import { Line } from "../components/Line.js";
import { Badge } from "../components/Badge.js";
import { spacing, type AccentToken } from "../utils/tokens.js";
import type { BenchmarkInput } from "../schemas/benchmark.js";

const PADDING = spacing.xl; // 24
const ROW_HEIGHT = 40;
const BAR_HEIGHT = 12;
const LABEL_COLUMN_WIDTH = 168;
const VALUE_COLUMN_WIDTH = 64;
const HEADER_HEIGHT_NO_SUBTITLE = 52;
const HEADER_HEIGHT_WITH_SUBTITLE = 76;

function formatValue(value: number, unit?: string): string {
  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return unit ? `${rounded}${unit}` : rounded;
}

export function benchmarkChartDimensions(input: BenchmarkInput): { width: number; height: number } {
  const width = input.width ?? 720;
  const headerHeight = input.subtitle ? HEADER_HEIGHT_WITH_SUBTITLE : HEADER_HEIGHT_NO_SUBTITLE;
  const height = PADDING + headerHeight + input.bars.length * ROW_HEIGHT + PADDING;
  return { width, height };
}

export function BenchmarkChart(props: BenchmarkInput) {
  const { title, subtitle, unit, bars } = props;
  const { width, height } = benchmarkChartDimensions(props);
  const headerHeight = subtitle ? HEADER_HEIGHT_WITH_SUBTITLE : HEADER_HEIGHT_NO_SUBTITLE;

  const maxValue = props.maxValue ?? Math.max(...bars.map((b) => b.value));
  const barAreaX = PADDING + LABEL_COLUMN_WIDTH;
  const barAreaWidth = width - PADDING - LABEL_COLUMN_WIDTH - VALUE_COLUMN_WIDTH - PADDING;
  const chartTop = PADDING + headerHeight;

  return (
    <Canvas width={width} height={height}>
      <Text x={PADDING} y={PADDING + 20} variant="title">
        {title}
      </Text>
      {subtitle ? (
        <Text x={PADDING} y={PADDING + 44} variant="subtitle" color="muted">
          {subtitle}
        </Text>
      ) : null}

      <Line x1={PADDING} y1={chartTop - 8} x2={width - PADDING} y2={chartTop - 8} stroke="border" />

      {bars.map((bar, i) => {
        const rowY = chartTop + i * ROW_HEIGHT;
        const barY = rowY + (ROW_HEIGHT - BAR_HEIGHT) / 2;
        const ratio = maxValue > 0 ? Math.min(bar.value / maxValue, 1) : 0;
        const barWidth = barAreaWidth * ratio;
        const variant: AccentToken = bar.variant ?? "primary";
        const labelWidth = measureText(bar.label, "label");
        const availableLabelWidth = LABEL_COLUMN_WIDTH - (bar.highlight ? 46 : 0);

        return (
          <g key={`${bar.label}-${i}`}>
            <Text x={PADDING} y={rowY + ROW_HEIGHT / 2 + 4} variant="label">
              {truncate(bar.label, availableLabelWidth)}
            </Text>
            {bar.highlight ? (
              <Badge
                x={PADDING + Math.min(labelWidth, LABEL_COLUMN_WIDTH - 46) + spacing.sm}
                y={rowY + ROW_HEIGHT / 2 - 11}
                label="Best"
                variant={variant}
              />
            ) : null}

            <Rect x={barAreaX} y={barY} width={barAreaWidth} height={BAR_HEIGHT} fill="border" cornerRadius="sm" opacity={0.5} />
            <Rect x={barAreaX} y={barY} width={barWidth} height={BAR_HEIGHT} fill={variant} cornerRadius="sm" />

            <Text
              x={barAreaX + barAreaWidth + VALUE_COLUMN_WIDTH - spacing.xs}
              y={rowY + ROW_HEIGHT / 2 + 4}
              variant="value"
              align="end"
              color="text"
            >
              {formatValue(bar.value, unit)}
            </Text>
          </g>
        );
      })}
    </Canvas>
  );
}

function truncate(text: string, maxWidth: number): string {
  const width = measureText(text, "label");
  if (width <= maxWidth) return text;
  const ratio = maxWidth / width;
  const cut = Math.max(1, Math.floor(text.length * ratio) - 1);
  return `${text.slice(0, cut)}…`;
}

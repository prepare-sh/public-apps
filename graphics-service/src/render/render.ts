import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { benchmarkSchema } from "../schemas/benchmark.js";
import {
  BenchmarkChart,
  benchmarkChartDimensions,
} from "../templates/BenchmarkChart.js";
import { barChartSchema } from "../schemas/bar.js";
import { BarChart, barChartDimensions } from "../templates/BarChart.js";
import { radarChartSchema } from "../schemas/radar.js";
import { RadarChart, radarChartDimensions } from "../templates/RadarChart.js";
import type {
  ImageFormat,
  RenderedImage,
  RenderResult,
} from "../types/index.js";
import { color, fontFamily, spacing as tokensSpacing } from "../utils/tokens.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.resolve(__dirname, "../../assets/fonts");

/**
 * Discriminated union of every supported request payload. New templates
 * are added here and nowhere else needs to change to be schema-validated.
 */
export const renderRequestSchema = z.discriminatedUnion("type", [
  benchmarkSchema,
  barChartSchema,
  radarChartSchema,
]);

export type RenderRequest = z.infer<typeof renderRequestSchema>;

export class RenderValidationError extends Error {
  constructor(public issues: z.ZodIssue[]) {
    super("Invalid render request");
    this.name = "RenderValidationError";
  }
}

/** Validates raw JSON input against the appropriate schema for its `type`. */
export function parseRenderRequest(input: unknown): RenderRequest {
  const result = renderRequestSchema.safeParse(input);
  if (!result.success) {
    throw new RenderValidationError(result.error.issues);
  }
  return result.data;
}

/** Renders a validated request to an SVG string. */
export function renderToSvg(request: RenderRequest): RenderResult {
  switch (request.type) {
    case "benchmark": {
      const { width, height } = benchmarkChartDimensions(request);
      const svg = renderToStaticMarkup(BenchmarkChart(request));
      return { svg, width, height };
    }
    case "bar": {
      const { width, height } = barChartDimensions(request);
      const svg = renderToStaticMarkup(BarChart(request));
      return { svg, width, height };
    }
    case "radar": {
      const { width, height } = radarChartDimensions(request);
      const svg = renderToStaticMarkup(RadarChart(request));
      return { svg, width, height };
    }
  }
}

/** Rasterizes an SVG string to PNG bytes using resvg, with Source Sans 3 embedded. */
export function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    font: {
      fontDirs: [FONT_DIR],
      loadSystemFonts: false,
      defaultFontFamily: "Source Sans 3",
    },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}

/** Full pipeline: validated request -> final image bytes in the requested format. */
export function renderImage(
  request: RenderRequest,
  format: ImageFormat,
): RenderedImage {
  const { svg } = renderToSvg(request);

  if (format === "svg") {
    return {
      format: "svg",
      contentType: "image/svg+xml",
      buffer: Buffer.from(svg, "utf-8"),
    };
  }

  return {
    format: "png",
    contentType: "image/png",
    buffer: svgToPng(svg),
  };
}

/**
 * How a cell shorter than its row is placed in the leftover vertical space.
 *
 * - `top`     — hug the top, whitespace below. The original behavior.
 * - `center`  — split the leftover space above and below.
 * - `stretch` — re-render the cell at the row height, so templates that spend
 *               extra height on content (`bar`) actually fill the row. Ones
 *               that only pad fall back to behaving like `top`.
 */
export type GridVAlign = "top" | "center" | "stretch";

/** Row heights of an already-rendered set of fragments laid out in `cols` columns. */
function rowHeightsOf(rendered: RenderResult[], cols: number): number[] {
  const heights = new Array<number>(Math.ceil(rendered.length / cols)).fill(0);
  rendered.forEach((r, i) => {
    const row = Math.floor(i / cols);
    if (r.height > heights[row]!) heights[row] = r.height;
  });
  return heights;
}

/**
 * Compose multiple validated render requests into a single SVG arranged
 * in an invisible grid (no lines) with `cols` columns and `spacing` pixels
 * between items.
 */
export function renderMultipleToSvg(
  requests: RenderRequest[],
  options?: {
    cols?: number;
    spacing?: number;
    background?: string;
    valign?: GridVAlign;
  },
): RenderResult {
  const cols = Math.max(1, Math.floor(options?.cols ?? requests.length));
  const spacing = options?.spacing ?? tokensSpacing.lg;
  const valign = options?.valign ?? "top";

  // Render each request to its own SVG fragment and dimensions
  let rendered = requests.map((r) => renderToSvg(r));

  // "stretch" needs the row heights before it can re-render, so measure first.
  if (valign === "stretch") {
    const measured = rowHeightsOf(rendered, cols);
    rendered = requests.map((r, i) => {
      const target = measured[Math.floor(i / cols)];
      // `height` is a floor in every template, so this can never clip. It only
      // changes the picture for templates that spend extra height on content
      // (`bar` grows its plot); the rest just pad, same as "top".
      return target === undefined ? renderToSvg(r) : renderToSvg({ ...r, height: target });
    });
  }

  // Helper: strip outer <svg> wrapper and remove an initial background rect
  function stripInner(svg: string) {
    const start = svg.indexOf("<svg");
    if (start === -1) return svg;
    const firstClose = svg.indexOf(">", start);
    const lastClose = svg.lastIndexOf("</svg>");
    let inner = svg.slice(firstClose + 1, lastClose);
    // remove a leading <rect .../> or <rect ...></rect> used for background
    inner = inner.replace(/^\s*<rect[^>]*>(?:<\/rect>)?\s*/i, "");
    return inner;
  }

  const fragments = rendered.map((r) => ({
    width: r.width,
    height: r.height,
    inner: stripInner(r.svg),
  }));

  const rows = Math.ceil(fragments.length / cols);
  const colWidths = new Array(cols).fill(0);
  const rowHeights = new Array(rows).fill(0);

  fragments.forEach((f, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    if (f.width > colWidths[c]) colWidths[c] = f.width;
    if (f.height > rowHeights[r]) rowHeights[r] = f.height;
  });

  const totalWidth =
    colWidths.reduce((s, v) => s + v, 0) + spacing * Math.max(0, cols - 1);
  const totalHeight =
    rowHeights.reduce((s, v) => s + v, 0) + spacing * Math.max(0, rows - 1);

  // compute offsets
  const colOffsets: number[] = [];
  let xAcc = 0;
  for (let i = 0; i < cols; i++) {
    colOffsets.push(xAcc);
    xAcc += colWidths[i] + spacing;
  }
  const rowOffsets: number[] = [];
  let yAcc = 0;
  for (let i = 0; i < rows; i++) {
    rowOffsets.push(yAcc);
    yAcc += rowHeights[i] + spacing;
  }

  // assemble groups
  const groups = fragments
    .map((f, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = colOffsets[c];
      // "stretch" already re-rendered at the row height where that helps, so
      // any remaining slack is a template that can only pad — leave it at top.
      const slack = valign === "center" ? (rowHeights[r] - f.height) / 2 : 0;
      const y = (rowOffsets[r] ?? 0) + slack;
      return `<g transform="translate(${x} ${y})">${f.inner}</g>`;
    })
    .join("\n");

  // Each fragment's own background rect is stripped, so the composite needs one
  // of its own — default to the same surface color the single-chart templates use.
  const background = options?.background ?? color.background;
  const bgAttr =
    background === "none"
      ? ""
      : `\n  <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${background}" />`;

  const svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${totalWidth}\" height=\"${totalHeight}\" viewBox=\"0 0 ${totalWidth} ${totalHeight}\" font-family=\"${fontFamily}\">${bgAttr}\n${groups}\n</svg>`;

  return { svg, width: totalWidth, height: totalHeight };
}

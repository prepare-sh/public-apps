import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { benchmarkSchema } from "../schemas/benchmark.js";
import { BenchmarkChart, benchmarkChartDimensions } from "../templates/BenchmarkChart.js";
import { radarChartSchema } from "../schemas/radar.js";
import { RadarChart, radarChartDimensions } from "../templates/RadarChart.js";
import type { ImageFormat, RenderedImage, RenderResult } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.resolve(__dirname, "../../assets/fonts");

/**
 * Discriminated union of every supported request payload. New templates
 * are added here and nowhere else needs to change to be schema-validated.
 */
export const renderRequestSchema = z.discriminatedUnion("type", [benchmarkSchema, radarChartSchema]);

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
    case "radar": {
      const { width, height } = radarChartDimensions(request);
      const svg = renderToStaticMarkup(RadarChart(request));
      return { svg, width, height };
    }
  }
}

/** Rasterizes an SVG string to PNG bytes using resvg, with Inter embedded. */
export function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    font: {
      fontDirs: [FONT_DIR],
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}

/** Full pipeline: validated request -> final image bytes in the requested format. */
export function renderImage(request: RenderRequest, format: ImageFormat): RenderedImage {
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

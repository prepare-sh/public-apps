import { z } from "zod";
import { textAlignSchema } from "./common.js";

export const radarAxisSchema = z.object({
  label: z.string().min(1).max(40),
  /** Per-axis max, for axes with different natural scales. Falls back to the chart's global maxValue. */
  max: z.number().positive().optional(),
});

export const radarSeriesSchema = z.object({
  name: z.string().min(1).max(60),
  values: z.array(z.number().min(0)),
  /** Marks the series whose vertices get value labels. Defaults to the first series. */
  highlight: z.boolean().optional(),
  /** Overrides the palette color assigned by index. */
  color: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color, e.g. #2563EB")
    .optional(),
});

export const radarChartSchema = z
  .object({
    type: z.literal("radar"),
    title: z.string().min(1).max(120),
    subtitle: z.string().max(200).optional(),
    axes: z.array(radarAxisSchema).min(3).max(12),
    series: z.array(radarSeriesSchema).min(1).max(10),
    /** Global scale used by any axis without its own `max`. Required unless every axis sets its own max. */
    maxValue: z.number().positive().optional(),
    width: z.number().int().min(400).max(1600).optional(),
    /** Minimum canvas height. Ignored if the plot and legend need more room than this. */
    height: z.number().int().min(200).max(4000).optional(),
    /** Alignment of the title/subtitle block. Defaults to "left". */
    textAlign: textAlignSchema.optional(),
    /**
     * Which series get a translucent area fill. Defaults to "auto": all of
     * them up to three series, highlighted-only beyond that, since stacked
     * fills swallow the grid.
     */
    fill: z.enum(["auto", "all", "highlight", "none"]).optional(),
  })
  .refine((data) => data.series.every((s) => s.values.length === data.axes.length), {
    message: "Each series' values array must have exactly one value per axis",
    path: ["series"],
  })
  .refine((data) => data.maxValue !== undefined || data.axes.every((a) => a.max !== undefined), {
    message: "Provide a global maxValue, or a max on every axis",
    path: ["maxValue"],
  });

export type RadarAxis = z.infer<typeof radarAxisSchema>;
export type RadarSeries = z.infer<typeof radarSeriesSchema>;
export type RadarChartInput = z.infer<typeof radarChartSchema>;

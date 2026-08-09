import { z } from "zod";
import { textAlignSchema } from "./common.js";

export const barColumnSchema = z.object({
  label: z.string().min(1).max(40),
  value: z.number().min(0).max(1_000_000),
  variant: z.enum(["primary", "success", "warning", "danger", "purple", "muted"]).optional(),
  /** Dims every other column, so one bar carries the point of the chart. */
  highlight: z.boolean().optional(),
});

export const barChartSchema = z.object({
  type: z.literal("bar"),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  unit: z.string().max(10).optional(),
  /** Explicit axis max. If omitted, it's rounded up from the tallest column to a round number. */
  maxValue: z.number().positive().optional(),
  width: z.number().int().min(320).max(2400).optional(),
  /** Canvas height. Any room beyond the default goes to the plot, making the columns taller. */
  height: z.number().int().min(200).max(4000).optional(),
  /** Alignment of the title/subtitle block. Defaults to "left". */
  textAlign: textAlignSchema.optional(),
  /** Draws each column's value above it. Defaults to true. */
  showValues: z.boolean().optional(),
  columns: z.array(barColumnSchema).min(1).max(24),
});

export type BarColumn = z.infer<typeof barColumnSchema>;
export type BarChartInput = z.infer<typeof barChartSchema>;

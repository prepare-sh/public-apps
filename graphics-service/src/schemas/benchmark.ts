import { z } from "zod";
import { textAlignSchema } from "./common.js";

export const benchmarkBarSchema = z.object({
  label: z.string().min(1).max(60),
  value: z.number().min(0).max(1000),
  variant: z.enum(["primary", "success", "warning", "danger", "muted"]).optional(),
  highlight: z.boolean().optional(),
});

export const benchmarkSchema = z.object({
  type: z.literal("benchmark"),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  unit: z.string().max(10).optional(),
  /** Explicit axis max. If omitted, it's derived from the largest bar value. */
  maxValue: z.number().positive().optional(),
  width: z.number().int().min(320).max(2400).optional(),
  /** Minimum canvas height. Ignored if the bars need more room than this. */
  height: z.number().int().min(120).max(4000).optional(),
  /** Alignment of the title/subtitle block. Defaults to "left". */
  textAlign: textAlignSchema.optional(),
  bars: z.array(benchmarkBarSchema).min(1).max(20),
});

export type BenchmarkBar = z.infer<typeof benchmarkBarSchema>;
export type BenchmarkInput = z.infer<typeof benchmarkSchema>;

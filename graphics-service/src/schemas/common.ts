import { z } from "zod";

/** Horizontal alignment of a chart's title/subtitle block. */
export const textAlignSchema = z.enum(["left", "center", "right"]);

export type TextAlign = z.infer<typeof textAlignSchema>;

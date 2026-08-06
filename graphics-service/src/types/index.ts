export type ImageFormat = "png" | "svg";

export interface RenderResult {
  svg: string;
  width: number;
  height: number;
}

export interface RenderedImage {
  format: ImageFormat;
  contentType: "image/png" | "image/svg+xml";
  buffer: Buffer;
}

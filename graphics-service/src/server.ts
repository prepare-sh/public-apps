import Fastify from "fastify";
import { parseRenderRequest, renderImage, RenderValidationError } from "./render/render.js";
import type { ImageFormat } from "./types/index.js";

const PORT = Number(process.env.PORT ?? 3000);

const app = Fastify({ logger: true });

function resolveFormat(query: Record<string, unknown>): ImageFormat {
  const raw = query["format"];
  if (raw === "svg") return "svg";
  return "png";
}

app.post("/render", async (request, reply) => {
  let parsed;
  try {
    parsed = parseRenderRequest(request.body);
  } catch (err) {
    if (err instanceof RenderValidationError) {
      return reply.status(400).send({
        error: "validation_error",
        issues: err.issues,
      });
    }
    throw err;
  }

  const format = resolveFormat(request.query as Record<string, unknown>);

  try {
    const image = renderImage(parsed, format);
    return reply.status(200).header("content-type", image.contentType).send(image.buffer);
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: "render_error", message: (err as Error).message });
  }
});

app.get("/health", async () => ({ status: "ok" }));

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

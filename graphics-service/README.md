# graphics-service

Deterministic technical-graphics rendering service. JSON in, PNG/SVG out.
No AI image generation, no Mermaid, no headless browser — every pixel comes
from hand-composed SVG driven by a small design-token system.

## Pipeline

```
JSON  →  Zod validation  →  React component tree  →  static SVG markup  →  resvg  →  PNG
```

React is used purely as a templating engine (`renderToStaticMarkup`) — there
is no client-side runtime, no hydration, nothing dynamic. The same input
always produces byte-identical output.

## Quick start

```bash
npm install
npm run dev        # tsx watch src/server.ts, listens on :3000
```

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "type": "benchmark",
    "title": "Model Performance",
    "subtitle": "Higher is better.",
    "unit": "%",
    "bars": [
      { "label": "Claude Opus 4.8", "value": 78.4, "variant": "primary", "highlight": true },
      { "label": "GPT-5", "value": 74.1 },
      { "label": "Gemini 3 Pro", "value": 71.8 }
    ]
  }' -o chart.png
```

Add `?format=svg` to get raw SVG back instead of a rasterized PNG.

## Multiple charts (grid)

You can compose several charts into a single image using the `/render/multiple` endpoint. Provide an array of validated chart requests in `requests` and optional layout `options` (`cols`, `spacing`, `background`). The endpoint returns PNG by default; add `?format=svg` to get SVG.

```bash
curl -X POST http://localhost:3000/render/multiple?format=png \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "type": "benchmark",
        "title": "Speed",
        "bars": [ { "label": "A", "value": 10 }, { "label": "B", "value": 8 } ]
      },
      {
        "type": "radar",
        "title": "Capabilities",
        "axes": [ { "label": "X" }, { "label": "Y" }, { "label": "Z" } ],
        "series": [ { "name": "S1", "values": [1,2,3], "highlight": true } ]
      }
    ],
    "options": { "cols": 2, "spacing": 16 }
  }' -o grid.png
```

## Templates

Every request is discriminated by its `type` field.

### `benchmark` — horizontal bar chart

See the Quick start example above. Bars take an optional `variant`
(`primary` / `success` / `warning` / `danger` / `muted`) and `highlight`,
which attaches a "Best" badge.

### `radar` — multi-axis radar / spider chart

Compares several series across 3–12 evaluation axes. Grid rings sit at 25 /
50 / 75 / 100% of scale, axis labels are anchored by which side of the
circle they fall on, and a wrapping legend renders below the plot.

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "type": "radar",
    "title": "Qwen-RobotWorld",
    "maxValue": 100,
    "axes": [
      { "label": "AIME Physics" }, { "label": "GAIA GAI" },
      { "label": "HLE Hard" },     { "label": "PhD Domain" },
      { "label": "PB Motion" },    { "label": "EVM Overall" },
      { "label": "EVM HSI" },      { "label": "DS Total" }
    ],
    "series": [
      { "name": "Qwen-RobotWorld", "values": [98.8, 87.8, 90, 65.7, 90, 92, 56.5, 82.5], "highlight": true },
      { "name": "VLA",             "values": [82, 70, 78, 55, 80, 75, 48, 68] },
      { "name": "GigaWorld",       "values": [75, 65, 70, 50, 72, 68, 44, 60] }
    ]
  }' -o radar.png
```

| Field                | Notes                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axes[].max`         | Per-axis maximum, for axes with different natural scales. Falls back to `maxValue`.                                                                                           |
| `maxValue`           | Global scale. Required unless _every_ axis sets its own `max` — otherwise the request is rejected with a 400.                                                                 |
| `series[].values`    | Must contain exactly one value per axis, or the request is rejected with a 400.                                                                                               |
| `series[].highlight` | Marks the one series whose vertices get value labels. Defaults to the first series. Labelling every vertex of every series is illegible, so only one series is ever labelled. |
| `series[].color`     | Hex override. By default series take colors from `seriesPalette` by index, so the same input always yields the same colors.                                                   |

Two layout behaviors are worth knowing about, both driven by the input:

- **Area fills drop out past 3 series.** Translucent fills stack into an
  opaque blob that hides the grid, so beyond three series only the
  highlighted area stays filled and the rest render as outlines.
- **The axis-label gutter is measured, not fixed.** It grows to fit the
  widest label (capped at 30% of width, with truncation as a backstop), so
  long axis labels shrink the plot rather than clipping off the edge.

## Project layout

```
src/
  server.ts                 Fastify app, POST /render, GET /health
  render/
    render.ts                Validates → dispatches to a template → SVG → PNG
  components/                Reusable SVG primitives (the only building blocks)
    Canvas.tsx                Root <svg>, background, base font-family
    Text.tsx                  Typography-token-driven <text> + measureText()
    Rect.tsx / Line.tsx       Low-level shape primitives
    Polygon.tsx               Arbitrary N-vertex shape (grid rings, radar areas)
    Card.tsx                  Rounded panel, establishes local coordinate space
    Badge.tsx                 Pill label (status/highlight)
    Arrow.tsx                 Connector with arrowhead marker, for diagrams
  templates/
    BenchmarkChart.tsx        Horizontal bar chart
    RadarChart.tsx            Multi-axis radar chart + polar coordinate helpers
  schemas/
    benchmark.ts              Zod schema for the benchmark template
    radar.ts                  Zod schema for the radar template
  utils/
    tokens.ts                 Spacing / radius / color / typography scales
  types/
    index.ts                  Shared render-pipeline types
assets/
  fonts/                      Inter TTFs (Regular/Medium/SemiBold/Bold), embedded at raster time
```

## Design tokens

Everything visual traces back to `src/utils/tokens.ts`. No inline magic
numbers or colors are allowed in components or templates.

- **Spacing**: 4, 8, 12, 16, 24, 32, 48
- **Radius**: 6, 8, 12
- **Typography**: title / subtitle / heading / label / body / caption / value
  — each a fixed `{fontSize, fontWeight, lineHeight}` triple, Inter only,
  weights limited to 400/500/600/700
- **Color**: primary `#2563EB`, success `#16A34A`, warning `#F59E0B`,
  danger `#DC2626`, background `#FFFFFF`, text `#111827`, muted `#6B7280`,
  border `#E5E7EB`
- **Series palette**: a fixed, ordered array of 10 categorical colors for
  charts with more series than the 5 semantic accents can cover. Assigned by
  index (`seriesPalette[i % seriesPalette.length]`), so colors are stable
  across renders. Deliberately desaturated to match the rest of the palette.

## Why a font is vendored in `assets/fonts`

`@resvg/resvg-js` (the Rust `resvg` rasterizer) does not reliably shape text
from `.woff2` — glyphs silently disappear. The four Inter weights this
service uses were extracted from the `inter-ui` npm package and converted to
`.ttf` (via `fonttools`) ahead of time, then wired into resvg's `fontDirs`.
This keeps rendering fully offline and deterministic — no network font
fetch, no system-font dependency.

## Adding a new template

1. Add a Zod schema in `src/schemas/`.
2. Add the schema to the `renderRequestSchema` discriminated union in
   `src/render/render.ts`.
3. Build the template in `src/templates/` out of the existing primitives
   (`Canvas`, `Text`, `Rect`, `Line`, `Polygon`, `Card`, `Badge`, `Arrow`).
   Export a `<Name>Dimensions(input)` helper alongside the component so the
   render pipeline can compute width/height without re-rendering.
4. Add a `case` in `renderToSvg()`. Leave the `switch` without a `default` —
   discriminated-union narrowing then makes a missing template a compile
   error, which is why there's no unreachable `never` cast.

No other code should need to change — the server, validation, and PNG
rasterization are all template-agnostic.

## What's intentionally not built yet

Per the brief: `ArchitectureDiagram`, `ComparisonTable`, and
`PipelineDiagram` templates are not implemented. The primitive set
(`Arrow`, `Card`, etc.) already anticipates them, but only
`BenchmarkChart` and `RadarChart` are wired into the render pipeline.

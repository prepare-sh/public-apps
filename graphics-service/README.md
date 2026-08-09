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

You can compose several charts into a single image using the `/render/multiple` endpoint. Provide an array of validated chart requests in `requests` and optional layout `options` (`cols`, `spacing`, `background`, `valign`). The endpoint returns PNG by default; add `?format=svg` to get SVG.

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

### Uneven cell heights

Every cell in a row is laid out against the tallest chart in that row. Since
templates size themselves from their content, a tall neighbour leaves the
short ones stranded at the top of their cell with whitespace underneath.
`valign` decides what happens to that leftover space:

| `valign`  | Behavior                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `top`     | Default. Hug the top, whitespace below. Unchanged from before the option existed.                                                                            |
| `stretch` | Re-render each cell at its row's height. `bar` grows its plot and `benchmark` spreads its rows, so they genuinely fill; `radar` can only pad, so it stays top-aligned. |
| `center`  | Split the leftover space above and below. Note this pushes titles out of line with each other across a row, which usually looks worse than `stretch`.        |

`stretch` handles the common case, but it can only work with the height a row
already has. A `radar` is close to square, so one in a grid forces its whole
row to that height — give it an explicit `height` to cap its plot radius
rather than letting it drive the row:

```json
{
  "requests": [
    { "type": "radar", "title": "Capabilities", "height": 420, "maxValue": 100, "axes": [], "series": [] },
    { "type": "bar", "title": "Reliability", "columns": [] }
  ],
  "options": { "cols": 2, "spacing": 24, "valign": "stretch" }
}
```

## Templates

Every request is discriminated by its `type` field.

### Options shared by every template

| Field       | Notes                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `width`     | Canvas width in px. Benchmark defaults to 720 (320–2400), radar to 720 (400–1600).                                                                            |
| `height`    | Canvas height in px — a _floor_, not an override. A height below what the content needs would clip it, so the computed height wins; extra room sits at the bottom. Two templates spend the extra room rather than padding with it: `bar` grows its plot, `benchmark` grows its row pitch (capped at 72px/row). `radar` also treats it as a _ceiling_, shrinking its plot radius to fit. |
| `textAlign` | `left` (default) / `center` / `right`. Aligns the title and subtitle block. Everything else (bar rows, axis labels, legend) keeps its own layout rules.        |
| `unit`      | Suffix on every value. Spacing is automatic — see below.                                                                                                      |

```json
{
  "type": "benchmark",
  "title": "Model Performance",
  "textAlign": "center",
  "width": 900,
  "height": 400,
  "bars": [{ "label": "A", "value": 10 }]
}
```

#### Unit spacing

`unit` is joined to the number by the rule in `src/utils/format.ts`, so a
chart never disagrees with itself:

| `unit`      | Renders    | Why                                                     |
| ----------- | ---------- | ------------------------------------------------------- |
| `"%"`, `"°"` | `94%`      | Symbols attach — a space would be wrong.                 |
| `"deps"`, `"ms"`, `"req/s"` | `25 deps` | Word units take a space, per SI convention. |
| `"k qps"`, `"M"`, `"x"` | `42k qps` | A leading magnitude suffix attaches, and carries the rest of the unit with it. |

The check is on the unit's first token, which is what keeps `"k qps"` from
becoming `42 k qps` while `"kg"` still renders as `64 kg`. To override, write
the space yourself — a `unit` starting with a space is passed through as-is.

### `benchmark` — horizontal bar chart

See the Quick start example above. Bars take an optional `variant`
(`primary` / `success` / `warning` / `danger` / `purple` / `muted`) and `highlight`,
which attaches a "Best" badge.

### `bar` — vertical column chart

Categories along the x-axis, values rising from a zero baseline. Use this
when the category labels are short (months, regions, versions); use
`benchmark` when the labels are long, since horizontal rows give them room.

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bar",
    "title": "Throughput by Engine",
    "subtitle": "Queries per second, higher is better.",
    "unit": "k",
    "columns": [
      { "label": "Postgres", "value": 42.5, "highlight": true },
      { "label": "MySQL",    "value": 31.2 },
      { "label": "SQLite",   "value": 18.9 },
      { "label": "DuckDB",   "value": 27.4, "variant": "success" }
    ]
  }' -o bar.png
```

| Field                 | Notes                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `columns[].variant`   | `primary` (default) / `success` / `warning` / `danger` / `purple` / `muted`.                                                                 |
| `columns[].highlight` | Dims every _other_ column to 35% opacity, so one column carries the point. No badge — it would collide with the value label.      |
| `maxValue`            | Axis max. If omitted, it's rounded up from the tallest column to a round number (1 / 2 / 2.5 / 5 / 10 × 10ⁿ) so ticks read cleanly. |
| `showValues`          | Value label above each column. Defaults to `true`; turn it off for dense charts.                                                 |
| `height`              | **Differs from the other templates**: extra height grows the plot (taller columns) rather than padding the canvas.                |

Gridlines sit at 0 / 25 / 50 / 75 / 100% of scale, and the tick gutter is
measured from the widest tick label. Column width is 62% of the available
pitch, capped at 56px — so a 3-column chart doesn't render three slabs.
Category labels truncate to their pitch rather than overlapping.

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
| `fill`               | Which series get a translucent area fill: `auto` (default) / `all` / `highlight` / `none`. See below.                                                                          |

Two layout behaviors are worth knowing about, both driven by the input:

- **Area fills drop out past 3 series.** Translucent fills stack into an
  opaque blob that hides the grid, so beyond three series only the
  highlighted area stays filled and the rest render as outlines. That's the
  `fill: "auto"` default; override it per request:

  | `fill`      | Behavior                                                                          |
  | ----------- | ----------------------------------------------------------------------------------- |
  | `auto`      | Default. Fill everything up to 3 series; past that, fill only the highlighted one. |
  | `all`       | Always fill every series. Legible at 2–3 series, muddy at 4+.                      |
  | `highlight` | Only the highlighted series is filled, however many there are.                     |
  | `none`      | Pure outlines. The cleanest read for 4+ series where every series matters equally.  |
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
    BarChart.tsx              Vertical column chart + value-axis helpers
    RadarChart.tsx            Multi-axis radar chart + polar coordinate helpers
  schemas/
    benchmark.ts              Zod schema for the benchmark template
    bar.ts                    Zod schema for the bar template
    radar.ts                  Zod schema for the radar template
    common.ts                 Fields shared across templates (textAlign)
  utils/
    tokens.ts                 Spacing / radius / color / typography scales
    layout.ts                 textAlign anchoring + height-floor helper
    format.ts                 Value rounding + unit spacing, shared by all templates
  types/
    index.ts                  Shared render-pipeline types
assets/
  fonts/                      Source Sans 3 TTFs (Regular/Medium/SemiBold/Bold), embedded at raster time
scripts/
  build-fonts.py              Rebuilds those TTFs from the @fontsource devDependency
```

## Design tokens

Everything visual traces back to `src/utils/tokens.ts`. No inline magic
numbers or colors are allowed in components or templates.

- **Spacing**: 4, 8, 12, 16, 24, 32, 48
- **Radius**: 6, 8, 12
- **Typography**: title / subtitle / heading / label / body / caption / value
  — each a fixed `{fontSize, fontWeight, lineHeight}` triple, Source Sans 3
  only, weights limited to 400/500/600/700. The `fontFamily` token emits the
  site's full CSS stack (`'Source Sans Pro', 'Source Sans 3', ui-sans-serif,
  system-ui, sans-serif`) so SVG output matches in a browser, but the PNG
  rasterizer only ever resolves Source Sans 3 — see below.
- **Color**: the accent hues are the `--rb-badge-fg` values from the site's
  badge system, so a chart sits alongside the badges in an article without
  clashing: primary `#3B6FFF`, success `#16A34A`, warning `#F59E0B`, danger
  `#DC2626`, purple `#7C3AED`, muted `#6B7280`. Plus background `#FFFFFF`,
  text `#111827`, border `#E5E7EB`.
- **Accent tint**: `ACCENT_TINT_OPACITY` (0.17) is the alpha the badge system
  pairs with each `fg` hue for its background. Radar area fills use it, so a
  filled area reads as the same tint as a badge of that color.
- **Series palette**: a fixed, ordered array of 10 categorical colors for
  charts with more series than the semantic accents can cover. The first six
  _are_ the badge hues; the last four (sky, pink, lime, teal) are picked at
  matching saturation to extend the set. Assigned by index
  (`seriesPalette[i % seriesPalette.length]`), so colors are stable across
  renders.

## Why a font is vendored in `assets/fonts`

`@resvg/resvg-js` (the Rust `resvg` rasterizer) runs with
`loadSystemFonts: false` and does not reliably shape text from `.woff2` —
glyphs silently disappear. So the four Source Sans 3 weights are converted to
`.ttf` ahead of time and wired into resvg's `fontDirs`. Rendering stays fully
offline and deterministic: no network font fetch, no system-font dependency.

The consequence worth knowing: the CSS font stack in the `fontFamily` token is
inert as far as PNG output goes. `Source Sans Pro`, `ui-sans-serif`, and
`system-ui` are not in `assets/fonts`, so they can never resolve — every PNG
renders in Source Sans 3. The stack only does real work for `?format=svg`
output displayed in a browser.

`python scripts/build-fonts.py` regenerates the TTFs from the
`@fontsource/source-sans-3` devDependency (needs `pip install fonttools`). It
merges the `latin`, `latin-ext`, `greek`, and `cyrillic` subsets into one file
per weight — ~970 codepoints, 164KB each — and rewrites the name tables so all
four weights share a single `Source Sans 3` family. Without that rewrite the
500/600 faces declare themselves as separate families and a `font-weight: 500`
lookup silently falls back to Regular.

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
`BenchmarkChart`, `BarChart` and `RadarChart` are wired into the render
pipeline.

# Redis Atomic Counter Demo

A tiny Flask app that demonstrates why counters belong in Redis. One post, one Like
button. Clicking it runs a single `INCR likes:post1` — Redis performs the whole
read-modify-write itself, so concurrent clicks can never lose an update.

Beside it sits a second counter that does the same job the naive way — `GET`, add one,
`SET` — under the key `unsafe:likes:post1`. Both counters are incremented by every
like, so a burst of concurrent requests shows the contrast directly: the atomic counter
lands on exactly the right number, the unsafe one comes up short.

## Prerequisites

- Docker + Docker Compose (Compose brings its own Redis — nothing to install)
- Or, to run natively: Python 3.9+ and a Redis reachable at `localhost:6379`

## Run with Docker (recommended)

```bash
docker compose up --build
```

Then open <http://localhost:5000>.

Compose starts two services: `redis` (redis:7-alpine, published on `6379`) and
`like-app`, which reaches it over the Compose network at hostname `redis`. The app
waits for Redis's healthcheck before starting, so a fresh clone works with one command.

## Run without Docker

```bash
pip install -r requirements.txt
python app.py
```

## The keys

| Key                  | Written by            | Atomic? |
| -------------------- | --------------------- | ------- |
| `likes:post1`        | `INCR` / `DECR`       | yes     |
| `unsafe:likes:post1` | `GET` then `SET`      | no      |

Inspect and reset them from the terminal:

```bash
redis-cli GET likes:post1
redis-cli GET unsafe:likes:post1
redis-cli DEL likes:post1 unsafe:likes:post1   # back to zero between takes
```

Running under Compose, use the `redis` service — e.g.
`docker compose exec redis redis-cli DEL likes:post1 unsafe:likes:post1`.

The **Reset** button on the page does exactly that `DEL`, if you'd rather not switch
to the terminal on camera.

## The concurrency demo

`POST /api/simulate-burst?n=100` fires 100 likes at once from a server-side thread
pool and reports what each counter gained:

```bash
curl -s -X POST "http://localhost:5000/api/simulate-burst?n=100"
```

```json
{
  "n": 100,
  "elapsed_ms": 118,
  "before": { "likes": 0, "unsafe_likes": 0 },
  "after":  { "likes": 100, "unsafe_likes": 37 },
  "gained": 100,
  "unsafe_gained": 37,
  "lost": 63
}
```

`gained` is always exactly `n`. `unsafe_gained` is not, and `lost` counts the
increments that disappeared. The page's **Fire burst** button calls the same endpoint
and shows those four numbers side by side.

The unsafe path sleeps 5 ms between its `GET` and its `SET` (see `unsafe_like()` in
`app.py`). Without that gap the race is real but too narrow to lose many updates on a
local Redis, and the demo wouldn't show anything on screen. The bug itself is the two
separate round trips, not the sleep.

`n` is capped at 1000.

## Environment variables

| Variable     | Default     | Meaning                       |
| ------------ | ----------- | ----------------------------- |
| `REDIS_HOST` | `localhost` | Redis hostname                |
| `REDIS_PORT` | `6379`      | Redis port                    |
| `PORT`       | `5000`      | Port the Flask app listens on |

## Endpoints

- `GET /` — the demo page
- `GET /api/likes` — `{"likes": 42, "unsafe_likes": 37}`
- `POST /api/like` — `INCR`, returns the new counts
- `POST /api/unlike` — `DECR`, returns the new counts
- `POST /api/simulate-burst?n=100` — fire `n` concurrent likes, return before/after
- `POST /api/reset` — `DEL` both keys
- `GET /api/health` — `{"status": "ok", "redis": true}`, handy for a readiness check:
  `curl -sf http://localhost:5000/api/health`

If Redis is unreachable, the `/api/*` endpoints return `503` with `{"error": "..."}`
(JSON, not an HTML error page) and the page shows the message instead of hanging.

## The code that matters

`like()` and `unlike()` in `app.py` are one line each — `r.incr(...)` and `r.decr(...)`.
`unsafe_like()` right below them is the same operation written as a read and a write.
That side-by-side pair is the whole lesson.

The favicon is the shared `public-apps/favicon.ico`, copied to `static/favicon.ico` so
the Docker build context contains it.

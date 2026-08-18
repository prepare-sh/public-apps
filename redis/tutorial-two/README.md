# Redis Cache-Aside Demo

A tiny Flask app that demonstrates the **cache-aside** pattern with Redis. Clicking
"Fetch Report" calls `/api/report`, which first looks for the result in Redis. On a
miss it sleeps ~2 seconds (standing in for an expensive query), computes the report,
and stores it in Redis with a TTL. On a hit it returns instantly from Redis. The page
times its own round trip and shows a big millisecond readout plus a red **CACHE MISS**
or green **CACHE HIT** badge, so the difference is obvious on screen.

## Prerequisites

- Docker + Docker Compose (or Python 3.9+ if running natively)
- A Redis server already running and reachable (default `localhost:6379`)

## Run with Docker (recommended)

```bash
docker compose up --build
```

Then open <http://localhost:5000>.

The container uses `network_mode: host`, so it talks to the Redis already running
natively on the VM at `localhost:6379` — same arrangement as the PostgreSQL tutorials.
If you don't have Redis installed natively, start one in Docker first:

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

## Run without Docker

```bash
pip install -r requirements.txt
python app.py
```

## Clearing the cache between takes

The report is cached under a single Redis key named **`report`**. To force the next
click to be a fresh MISS:

```bash
redis-cli DEL report
```

Useful companions:

```bash
redis-cli GET report    # see the cached JSON
redis-cli TTL report    # seconds left before it expires
```

If Redis itself is running in Docker rather than natively, prefix those with
`docker exec -it redis` — e.g. `docker exec -it redis redis-cli DEL report`.

## Environment variables

| Variable                  | Default     | Meaning                                     |
| ------------------------- | ----------- | ------------------------------------------- |
| `REDIS_HOST`              | `localhost` | Redis hostname                              |
| `REDIS_PORT`              | `6379`      | Redis port                                  |
| `PORT`                    | `5000`      | Port the Flask app listens on               |
| `CACHE_TTL_SECONDS`       | `30`        | How long the cached report lives            |
| `SIMULATED_DELAY_SECONDS` | `2`         | How long a cache miss "takes" to compute    |

## Endpoints

- `GET /` — the demo page
- `GET /api/report` — the cache-aside endpoint; returns `{"source": "cache" | "computed", "ttl": ..., "data": {...}}`
- `GET /api/health` — `{"status": "ok", "redis": true}`, handy for a readiness check:
  `curl -sf http://localhost:5000/api/health`

## The code that matters

The whole lesson is in `app.py` in `get_report()` — a `GET`, an `if cached` branch,
and a `SET ... EX`. No caching library, no decorators.

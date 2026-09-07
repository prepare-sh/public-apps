# Redis Caching Patterns Demo

A tiny Flask app for demonstrating cache invalidation. One product — "Wireless
Headphones, $79.99" — with a storefront that reads it through a cache-aside cache, and
an admin page that changes its price.

The point of the demo is the bug you can see: change the price in the admin, and the
storefront keeps showing the old one. The mode selector then fixes it two different
ways.

## The three modes

The **read** path never changes. Every storefront load is the same cache-aside read:
`GET product:1`, and on a miss a slow database query that gets stored back with a TTL.
Only the **write** path differs, and you switch between the three from the admin page.

| Mode                    | Redis ops on a price update | What the storefront does                              |
| ----------------------- | --------------------------- | ----------------------------------------------------- |
| **No Invalidation**     | none — DB write only        | keeps serving the **old** price until the TTL expires |
| **Invalidate on Write** | `DEL product:1`             | next read misses, pulls the new price, re-caches it   |
| **Write-Through**       | `SET product:1 EX 60`       | next read is a **hit** and already has the new price  |

Each mode is its own function in `app.py` — `write_no_invalidation()`,
`write_with_invalidation()`, `write_through()` — three or four lines each. They are
deliberately not refactored into a shared code path, so they can be read side by side.

## Prerequisites

- Docker + Docker Compose (Compose brings its own Redis — nothing to install)
- Or, to run natively: Python 3.9+ and a Redis reachable at `localhost:6379`

## Run with Docker (recommended)

```bash
docker compose up --build
```

Then open <http://localhost:5000> (storefront) and <http://localhost:5000/admin>.

Compose starts two services: `redis` (redis:7-alpine, published on `6379`) and
`cache-patterns-app`, which reaches it over the Compose network at hostname `redis`.
The app waits for Redis's healthcheck before starting, so a fresh clone works with one
command.

## Run without Docker

```bash
pip install -r requirements.txt
python app.py
```

## The key

One Redis key, holding the product as JSON:

| Key         | Written by                          | Read by                |
| ----------- | ----------------------------------- | ---------------------- |
| `product:1` | the cache-aside read, and modes 2/3 | every storefront load  |

Inspect it from the terminal while the demo runs:

```bash
redis-cli GET product:1     # the cached JSON — the price a customer sees
redis-cli TTL product:1     # seconds left before it expires on its own
redis-cli DEL product:1     # force the next read to miss
```

Running under Compose, use the `redis` service — e.g.
`docker compose exec redis redis-cli GET product:1`.

The **active mode** is not in Redis. It is demo configuration, so it lives in a module
global in `app.py` and resets to `no-invalidation` when the app restarts.

## The "database"

There is no real database engine. `_DB` in `app.py` is a dict behind a lock, marked in
the code as the stand-in for one. `db_read_product()` sleeps
`SIMULATED_DB_DELAY_SECONDS` before returning, so a cache miss is visibly slower on
screen than a hit — the same technique as `report-app`.

## Running the demo

1. Open the storefront and the admin side by side. Hit **Reload page** on the
   storefront twice: the first read is a `CACHE MISS` at ~1200 ms, the second a
   `CACHE HIT` at a few ms.
2. Leave the mode on **No Invalidation**. In the admin, set the price to `59.99` and
   save. The admin shows the database price is now $59.99.
3. Reload the storefront. It still shows **$79.99**, and the badge says `CACHE HIT`.
   The TTL readout is counting down — that number is why it is stale, and it is the
   real `TTL product:1`, not a story. Tick **Auto-reload every 2s** and watch the price
   flip on its own the moment the TTL hits zero.
4. Switch to **Invalidate on Write** and save a new price. The admin's op readout shows
   `DB write → DEL product:1`. The storefront's next read is a `CACHE MISS` — slow
   again — and comes back with the new price.
5. Switch to **Write-Through** and save again. The op readout shows
   `DB write → SET product:1 EX 60`. The storefront's next read is a `CACHE HIT`, fast,
   and already correct — the cache was never stale for a moment.

**Reset demo** at the bottom of the admin page puts the price back to $79.99 and
`DEL`s the key, for a clean second take.

## Environment variables

| Variable                     | Default     | Meaning                                  |
| ---------------------------- | ----------- | ---------------------------------------- |
| `REDIS_HOST`                 | `localhost` | Redis hostname                           |
| `REDIS_PORT`                 | `6379`      | Redis port                               |
| `PORT`                       | `5000`      | Port the Flask app listens on            |
| `CACHE_TTL_SECONDS`          | `60`        | TTL set on `product:1`                   |
| `SIMULATED_DB_DELAY_SECONDS` | `1.2`       | Fake latency on every database read      |

Lower `CACHE_TTL_SECONDS` to about `20` if you want natural TTL expiry to happen fast
enough to film without a cut.

## Endpoints

- `GET /` — storefront page
- `GET /admin` — admin page: price form + mode selector
- `GET /api/product` — cache-aside read →
  `{"source": "hit"|"miss", "ttl": 47, "key": "product:1", "product": {...}}`
- `POST /api/admin/update-price` — `{"price": 59.99}` → writes the DB, then does
  whatever the active mode says about the cache. Returns the ops it performed:
  `{"mode": "...", "ops": ["DB write", "DEL product:1"], "product": {...}, "ttl": -2}`
- `POST /api/admin/set-mode` — `{"mode": "no-invalidation"|"invalidate-on-write"|"write-through"}`
- `GET /api/mode` — current mode, the mode list, the database's real price, and the
  live TTL. This is what the admin page loads with and polls.
- `POST /api/admin/reset` — price back to $79.99, `DEL product:1`
- `GET /api/health` — `{"status": "ok", "redis": true}`, handy for a readiness check:
  `curl -sf http://localhost:5000/api/health`

`ttl` follows Redis's own convention: `-2` means the key does not exist, `-1` means it
exists with no expiry.

If Redis is unreachable, the `/api/*` endpoints return `503` with `{"error": "..."}`
(JSON, not an HTML error page) and the pages show the message instead of hanging.

## The code that matters

`read_product_cache_aside()` is the read, unchanged across all three modes. The three
write functions directly below it are the lesson: one does nothing to the cache, one
deletes, one sets. Everything else in `app.py` is routing.

The favicon is the shared `public-apps/favicon.ico`, copied to `static/favicon.ico` so
the Docker build context contains it.

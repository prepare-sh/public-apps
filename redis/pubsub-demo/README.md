# Redis Pub/Sub Notification Demo

A tiny Flask app for demonstrating Redis Pub/Sub: `PUBLISH`, `SUBSCRIBE`, and the
core limitation that makes Streams exist &mdash; a channel has no memory. If nobody
is subscribed when a message is published, it is gone forever.

Two pages, one channel:

- **`/`** &mdash; the live feed. Holds an open `SUBSCRIBE` on the channel (relayed to
  the browser over Server-Sent Events) and shows every notification the instant
  it arrives, with a toast and a card sliding into the feed.
- **`/admin`** &mdash; a form that calls `PUBLISH` on the same channel.

## The channel

Everything happens on one channel, named by the `CHANNEL_NAME` constant in
`app.py` (default `notifications`). The channel doesn't care who publishes to
it &mdash; the admin page's `POST /api/publish` and a raw
`redis-cli PUBLISH notifications "hello"` from a terminal produce the exact
same effect on the live feed.

## How the live relay works

`GET /api/stream` is a Server-Sent Events endpoint. On each request,
`notification_stream()` in `app.py` opens a fresh `redis_client.pubsub()`,
calls `.subscribe(CHANNEL_NAME)`, and then loops over `pubsub.listen()`,
turning every message it gets into one SSE event. No websocket library is
involved &mdash; the browser's built-in `EventSource` does the rest. Each
browser tab with the feed page open holds its own independent subscription.

## The core limitation, demonstrated

Pub/Sub does not store anything. There is no history, no queue, no way to ask
Redis "what did I miss?" &mdash; **unlike Streams, there is no `XRANGE`
equivalent for a channel.**

To see it:

1. Open the live feed at `/` and note the "Connected since" timestamp.
2. Click **Disconnect**. This closes the `EventSource` and the server-side
   `SUBSCRIBE` behind it.
3. Publish 2&ndash;3 notifications, either from `/admin` or via
   `redis-cli PUBLISH notifications "missed you"`.
4. Click **Reconnect**. The feed gets a new "Connected since" timestamp and
   the missed notifications never appear &mdash; there is nothing to fetch them
   from.

The app deliberately has no logging, no persistence, and no backlog endpoint,
so this is genuinely true and not just a UI trick.

## Prerequisites

- Docker + Docker Compose (Compose brings its own Redis &mdash; nothing to install)
- Or, to run natively: Python 3.9+ and a Redis reachable at `localhost:6379`

## Run with Docker (recommended)

```bash
docker compose up --build
```

Then open <http://localhost:5000> (live feed) and <http://localhost:5000/admin>.

## Run without Docker

```bash
pip install -r requirements.txt
python app.py
```

## Test it with redis-cli

```bash
redis-cli PUBLISH notifications "New order placed: #4821"
```

Running under Compose, use the `redis` service, e.g.
`docker compose exec redis redis-cli PUBLISH notifications "hello"`.

## Environment variables

| Variable       | Default     | Meaning                              |
| -------------- | ----------- | ------------------------------------- |
| `REDIS_HOST`   | `localhost` | Redis hostname                        |
| `REDIS_PORT`   | `6379`      | Redis port                            |
| `PORT`         | `5000`      | Port the Flask app listens on         |
| `CHANNEL_NAME` | `notifications` | The Pub/Sub channel used everywhere |

## Endpoints

- `GET /` &mdash; live feed page (subscriber side)
- `GET /admin` &mdash; publish form
- `GET /api/stream` &mdash; Server-Sent Events stream relaying `SUBSCRIBE` messages
  to the browser. Emits a `connected` event with `{"connected_at": "..."}` on
  open, then a `notification` event per message:
  `{"message": "...", "sent_at": "..."}`
- `POST /api/publish` &mdash; `{"message": "..."}` &rarr; runs `PUBLISH` and returns
  `{"success": true, "channel": "notifications", "message": "...", "subscribers_notified": 1}`
- `GET /api/health` &mdash; `{"status": "ok", "redis": "connected", "channel": "notifications"}`

## The code that matters

`publish_notification()` and `notification_stream()` in `app.py` are the whole
lesson &mdash; a few lines each, deliberately not hidden behind any abstraction:
one calls `redis_client.publish()`, the other calls `redis_client.pubsub()`
and `.subscribe()`. Everything else is routing and the SSE wrapper Flask
needs around the generator.

The favicon is the shared `public-apps/favicon.ico`, copied to
`static/favicon.ico` so the Docker build context contains it.

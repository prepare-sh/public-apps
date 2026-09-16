import json
import os
import time
from datetime import datetime, timezone

import redis
from flask import Flask, Response, jsonify, request, send_from_directory


app = Flask(__name__, static_folder="static")

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
PORT = int(os.environ.get("PORT", 5000))

# The single Pub/Sub channel this whole demo revolves around.
CHANNEL_NAME = os.environ.get("CHANNEL_NAME", "notifications")

# How often the stream checks in when no message has arrived. A blocking
# pubsub.listen() call has no yield point for the WSGI server to notice a
# closed browser tab, so the subscription (and its Redis connection) would
# never clean up. Polling on this interval gives the generator a chance to
# attempt a write - which fails once the client is gone - so `finally`
# actually runs instead of leaking the subscription forever.
HEARTBEAT_SECONDS = 3

redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    decode_responses=True,
)


# -----------------------------------------------------------------------------
# Publish
# -----------------------------------------------------------------------------

def publish_notification(message):
    """
    Put one message onto the Redis channel.

    This is the entire "publisher" side of Pub/Sub: PUBLISH does not queue,
    store, or remember the message anywhere. If nobody is subscribed at this
    exact moment, the message is simply gone once this call returns.
    """
    payload = json.dumps({
        "message": message,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })

    subscriber_count = redis_client.publish(CHANNEL_NAME, payload)

    return subscriber_count


# -----------------------------------------------------------------------------
# Subscribe (relayed to the browser over SSE)
# -----------------------------------------------------------------------------

def notification_stream():
    """
    Subscribe to the channel and yield each message as an SSE event.

    This generator only knows about messages published *after* the SUBSCRIBE
    call below completes. Nothing here reads history, because Pub/Sub has
    none to read - there is no XRANGE equivalent for a channel.

    NOTE: this originally used pubsub.listen(), which blocks forever and
    never notices when the browser disconnects - the Redis subscription
    would linger indefinitely after a tab closed. Polling get_message()
    with a timeout, and yielding a keepalive when nothing arrives, forces
    a periodic write to the client; once the browser is gone, that write
    is what fails and lets `finally` actually run and clean up.
    """
    pubsub = redis_client.pubsub()
    pubsub.subscribe(CHANNEL_NAME)

    try:
        connected_at = datetime.now(timezone.utc).isoformat()

        yield f"event: connected\ndata: {json.dumps({'connected_at': connected_at})}\n\n"

        while True:
            item = pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=HEARTBEAT_SECONDS,
            )

            if item is None:
                # Nothing published this interval. Yielding here is what
                # lets a dead connection surface: if the browser is gone,
                # this write is what raises and reaches `finally` below.
                yield ": keepalive\n\n"
                continue

            yield f"event: notification\ndata: {item['data']}\n\n"
    finally:
        pubsub.close()


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

@app.get("/favicon.ico")
def favicon():
    return send_from_directory(app.static_folder, "favicon.ico")


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/admin")
def admin():
    return send_from_directory(app.static_folder, "admin.html")


@app.get("/api/stream")
def stream():
    return Response(
        notification_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/publish")
def publish():
    data = request.get_json(silent=True) or {}

    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "message is required"}), 400

    subscriber_count = publish_notification(message)

    return jsonify({
        "success": True,
        "channel": CHANNEL_NAME,
        "message": message,
        "subscribers_notified": subscriber_count,
    })


@app.get("/api/health")
def health():
    try:
        redis_client.ping()

        return jsonify({
            "status": "ok",
            "redis": "connected",
            "channel": CHANNEL_NAME,
        })

    except redis.RedisError as error:
        return jsonify({
            "status": "error",
            "redis": "disconnected",
            "error": str(error),
        }), 503


# -----------------------------------------------------------------------------
# Error handling
# -----------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found"}), 404

    return send_from_directory(app.static_folder, "index.html")


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500


# -----------------------------------------------------------------------------
# Start server
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Redis Pub/Sub Notification Demo running on port {PORT}")
    print(f"Redis: {REDIS_HOST}:{REDIS_PORT}")
    print(f"Channel: {CHANNEL_NAME}")

    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=True,
        threaded=True,
    )

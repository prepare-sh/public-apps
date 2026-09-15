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
    """
    pubsub = redis_client.pubsub()
    pubsub.subscribe(CHANNEL_NAME)

    try:
        connected_at = datetime.now(timezone.utc).isoformat()

        yield f"event: connected\ndata: {json.dumps({'connected_at': connected_at})}\n\n"

        for item in pubsub.listen():
            if item["type"] != "message":
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

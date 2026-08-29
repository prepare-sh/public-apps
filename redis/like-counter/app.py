import os
import time
from concurrent.futures import ThreadPoolExecutor

import redis
from flask import Flask, jsonify, request, send_from_directory

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
PORT = int(os.environ.get("PORT", 5000))

# The two Redis keys this demo uses.
# Inspect or reset them from the terminal with:
#   redis-cli GET likes:post1
#   redis-cli DEL likes:post1 unsafe:likes:post1
LIKES_KEY = "likes:post1"
UNSAFE_LIKES_KEY = "unsafe:likes:post1"

app = Flask(__name__, static_folder="static")
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


# ---- the atomic counter: one command, Redis does the read-modify-write ----

def like():
    return r.incr(LIKES_KEY)


def unlike():
    return r.decr(LIKES_KEY)


# ---- the unsafe counter: read, then write, with a gap in between ----

def unsafe_like():
    """Deliberately NOT atomic. Two clients can read the same value and both
    write value+1, so one of the increments is silently lost."""
    count = int(r.get(UNSAFE_LIKES_KEY) or 0)
    time.sleep(0.005)  # widen the race window so the bug is visible on camera
    r.set(UNSAFE_LIKES_KEY, count + 1)
    return count + 1


def unsafe_unlike():
    count = int(r.get(UNSAFE_LIKES_KEY) or 0)
    time.sleep(0.005)
    r.set(UNSAFE_LIKES_KEY, count - 1)
    return count - 1


def read_counts():
    return {
        "likes": int(r.get(LIKES_KEY) or 0),
        "unsafe_likes": int(r.get(UNSAFE_LIKES_KEY) or 0),
    }


@app.get("/api/likes")
def get_likes():
    try:
        return jsonify(read_counts())
    except redis.RedisError as exc:
        return redis_down(exc)


@app.post("/api/like")
def post_like():
    try:
        return jsonify({"likes": like(), "unsafe_likes": unsafe_like()})
    except redis.RedisError as exc:
        return redis_down(exc)


@app.post("/api/unlike")
def post_unlike():
    try:
        return jsonify({"likes": unlike(), "unsafe_likes": unsafe_unlike()})
    except redis.RedisError as exc:
        return redis_down(exc)


@app.post("/api/simulate-burst")
def simulate_burst():
    """Fire n likes concurrently from a thread pool and report what happened.

    The atomic counter always ends up exactly n higher. The unsafe one loses
    increments, because its read and its write are two separate round trips."""
    try:
        n = int(request.args.get("n", 100))
    except ValueError:
        return jsonify({"error": "n must be an integer"}), 400
    if not 1 <= n <= 1000:
        return jsonify({"error": "n must be between 1 and 1000"}), 400

    try:
        before = read_counts()

        def one_request(_):
            like()
            unsafe_like()

        started = time.perf_counter()
        with ThreadPoolExecutor(max_workers=min(n, 64)) as pool:
            list(pool.map(one_request, range(n)))
        elapsed_ms = round((time.perf_counter() - started) * 1000)

        after = read_counts()
        return jsonify({
            "n": n,
            "elapsed_ms": elapsed_ms,
            "before": before,
            "after": after,
            "gained": after["likes"] - before["likes"],
            "unsafe_gained": after["unsafe_likes"] - before["unsafe_likes"],
            "lost": n - (after["unsafe_likes"] - before["unsafe_likes"]),
        })
    except redis.RedisError as exc:
        return redis_down(exc)


@app.post("/api/reset")
def reset():
    """Zero both counters between takes -- same as redis-cli DEL on both keys."""
    try:
        r.delete(LIKES_KEY, UNSAFE_LIKES_KEY)
        return jsonify(read_counts())
    except redis.RedisError as exc:
        return redis_down(exc)


@app.get("/api/health")
def health():
    try:
        return jsonify({"status": "ok", "redis": r.ping()})
    except redis.RedisError as exc:
        return jsonify({"status": "degraded", "redis": False, "error": str(exc)}), 503


def redis_down(exc):
    # Redis is unreachable -- say so in JSON so the UI can show it.
    return jsonify({"error": f"Redis unavailable at {REDIS_HOST}:{REDIS_PORT} ({exc})"}), 503


@app.errorhandler(Exception)
def json_errors(exc):
    """Keep /api/* responses JSON so the frontend never chokes on an HTML error page."""
    code = getattr(exc, "code", 500)
    if request.path.startswith("/api/"):
        return jsonify({"error": getattr(exc, "description", str(exc))}), code
    return (getattr(exc, "description", str(exc)), code)


@app.get("/favicon.ico")
def favicon():
    # Shared repo favicon, copied into static/ so the Docker build context has it.
    return send_from_directory(app.static_folder, "favicon.ico")


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    print(f" * Redis  {REDIS_HOST}:{REDIS_PORT}  keys={LIKES_KEY}, {UNSAFE_LIKES_KEY}")
    app.run(host="0.0.0.0", port=PORT, debug=True, threaded=True)

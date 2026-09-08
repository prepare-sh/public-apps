import os
import time

import redis
from flask import Flask, jsonify, request, send_from_directory


app = Flask(__name__, static_folder="static")

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
PORT = int(os.environ.get("PORT", 5000))

FIXED_WINDOW_LIMIT = int(os.environ.get("FIXED_WINDOW_LIMIT", 5))
FIXED_WINDOW_SECONDS = int(os.environ.get("FIXED_WINDOW_SECONDS", 10))

SLIDING_WINDOW_LIMIT = int(os.environ.get("SLIDING_WINDOW_LIMIT", 5))
SLIDING_WINDOW_SECONDS = int(os.environ.get("SLIDING_WINDOW_SECONDS", 10))

TOKEN_BUCKET_CAPACITY = int(os.environ.get("TOKEN_BUCKET_CAPACITY", 5))
TOKEN_BUCKET_REFILL_SECONDS = float(
    os.environ.get("TOKEN_BUCKET_REFILL_SECONDS", 2)
)

CLIENT_ID = "demo-client"

redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    decode_responses=True,
)

current_algorithm = "fixed"


# -----------------------------------------------------------------------------
# Rate-limiting algorithms
# -----------------------------------------------------------------------------

def fixed_window_allow(client_id):
    """
    Fixed Window

    Creates one Redis counter for each time window.

    Example:
        ratelimit:fixed:demo-client:12345

    Redis operations:
        INCR
        EXPIRE
    """
    now = time.time()
    window_number = int(now // FIXED_WINDOW_SECONDS)

    key = f"ratelimit:fixed:{client_id}:{window_number}"

    count = redis_client.incr(key)

    # Only set the expiry when the key is created.
    if count == 1:
        redis_client.expire(key, FIXED_WINDOW_SECONDS)

    allowed = count <= FIXED_WINDOW_LIMIT

    remaining = max(0, FIXED_WINDOW_LIMIT - count)

    window_end = (window_number + 1) * FIXED_WINDOW_SECONDS
    window_remaining_ms = max(0, int((window_end - now) * 1000))

    return {
        "allowed": allowed,
        "used": min(count, FIXED_WINDOW_LIMIT),
        "remaining": remaining,
        "window_remaining_ms": window_remaining_ms,
    }


def sliding_window_allow(client_id):
    """
    Sliding Window

    Stores each request as a member in a Redis sorted set.

    Redis operations:
        ZADD
        ZREMRANGEBYSCORE
        ZCARD
        EXPIRE
    """
    now = time.time()

    key = f"ratelimit:sliding:{client_id}"

    # Remove requests outside the rolling window.
    cutoff = now - SLIDING_WINDOW_SECONDS

    redis_client.zremrangebyscore(
        key,
        0,
        cutoff,
    )

    # Every request needs a unique member.
    request_id = f"{now}:{time.time_ns()}"

    redis_client.zadd(
        key,
        {request_id: now},
    )

    count = redis_client.zcard(key)

    # Keep the sorted set from living forever.
    redis_client.expire(
        key,
        SLIDING_WINDOW_SECONDS + 1,
    )

    allowed = count <= SLIDING_WINDOW_LIMIT

    # If this request was blocked, remove it again.
    if not allowed:
        redis_client.zrem(key, request_id)
        count -= 1

    remaining = max(
        0,
        SLIDING_WINDOW_LIMIT - count,
    )

    return {
        "allowed": allowed,
        "used": count,
        "remaining": remaining,
    }


def token_bucket_allow(client_id):
    """
    Token Bucket

    The bucket:
        - holds up to 5 tokens
        - refills one token every 2 seconds
        - consumes one token for every allowed request

    Redis operations:
        HGETALL
        HSET
    """
    key = f"ratelimit:bucket:{client_id}"

    now = time.time()

    data = redis_client.hgetall(key)

    if not data:
        tokens = float(TOKEN_BUCKET_CAPACITY)
        last_refill = now
    else:
        tokens = float(data["tokens"])
        last_refill = float(data["last_refill"])

    # Calculate how many tokens should have been added
    # since the last request.
    elapsed = now - last_refill

    refill_rate = 1 / TOKEN_BUCKET_REFILL_SECONDS

    tokens += elapsed * refill_rate

    # Never allow the bucket to exceed its capacity.
    tokens = min(
        tokens,
        TOKEN_BUCKET_CAPACITY,
    )

    # Consume one token if available.
    if tokens >= 1:
        tokens -= 1
        allowed = True
    else:
        allowed = False

    redis_client.hset(
        key,
        mapping={
            "tokens": tokens,
            "last_refill": now,
        },
    )

    remaining = max(0, int(tokens))

    return {
        "allowed": allowed,
        "used": TOKEN_BUCKET_CAPACITY - tokens,
        "remaining": remaining,
    }


# -----------------------------------------------------------------------------
# Rate limiter dispatcher
# -----------------------------------------------------------------------------

def check_rate_limit(client_id):
    if current_algorithm == "fixed":
        return fixed_window_allow(client_id)

    if current_algorithm == "sliding":
        return sliding_window_allow(client_id)

    if current_algorithm == "token":
        return token_bucket_allow(client_id)

    raise ValueError(f"Unknown algorithm: {current_algorithm}")


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def make_attempt(attempt_number):
    """
    Run one rate-limited request and return a frontend-friendly result.
    """
    result = check_rate_limit(CLIENT_ID)

    return {
        "attempt": attempt_number,
        "allowed": result["allowed"],
        "remaining": result["remaining"],
    }


def clear_rate_limit_keys():
    """
    Delete all demo rate-limit state for the demo client.
    """
    keys = []

    keys.extend(
        redis_client.scan_iter(
            match=f"ratelimit:fixed:{CLIENT_ID}:*"
        )
    )

    keys.extend(
        redis_client.scan_iter(
            match=f"ratelimit:sliding:{CLIENT_ID}"
        )
    )

    keys.extend(
        redis_client.scan_iter(
            match=f"ratelimit:bucket:{CLIENT_ID}"
        )
    )

    if keys:
        redis_client.delete(*keys)


def get_status():
    """
    Return the current configuration and allowance.
    """
    if current_algorithm == "fixed":
        now = time.time()
        window_number = int(now // FIXED_WINDOW_SECONDS)

        key = f"ratelimit:fixed:{CLIENT_ID}:{window_number}"

        count = redis_client.get(key)
        count = int(count) if count else 0

        window_end = (window_number + 1) * FIXED_WINDOW_SECONDS

        window_remaining_ms = max(
            0,
            int((window_end - now) * 1000),
        )

        return {
            "algorithm": current_algorithm,
            "used": min(count, FIXED_WINDOW_LIMIT),
            "remaining": max(
                0,
                FIXED_WINDOW_LIMIT - count,
            ),
            "window_remaining_ms": window_remaining_ms,
        }

    if current_algorithm == "sliding":
        now = time.time()

        key = f"ratelimit:sliding:{CLIENT_ID}"

        redis_client.zremrangebyscore(
            key,
            0,
            now - SLIDING_WINDOW_SECONDS,
        )

        count = redis_client.zcard(key)

        return {
            "algorithm": current_algorithm,
            "used": count,
            "remaining": max(
                0,
                SLIDING_WINDOW_LIMIT - count,
            ),
        }

    if current_algorithm == "token":
        key = f"ratelimit:bucket:{CLIENT_ID}"

        data = redis_client.hgetall(key)

        if not data:
            tokens = float(TOKEN_BUCKET_CAPACITY)
        else:
            tokens = float(data["tokens"])

            last_refill = float(data["last_refill"])
            elapsed = time.time() - last_refill

            tokens += elapsed / TOKEN_BUCKET_REFILL_SECONDS
            tokens = min(
                tokens,
                TOKEN_BUCKET_CAPACITY,
            )

        return {
            "algorithm": current_algorithm,
            "used": TOKEN_BUCKET_CAPACITY - tokens,
            "remaining": max(0, int(tokens)),
        }

    raise ValueError(f"Unknown algorithm: {current_algorithm}")


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

@app.get("/")
def index():
    return send_from_directory(
        app.static_folder,
        "index.html",
    )


@app.post("/api/login")
def login():
    """
    Fake login endpoint.

    Credentials are intentionally ignored.
    The point of this endpoint is to demonstrate rate limiting.
    """
    result = check_rate_limit(CLIENT_ID)

    if not result["allowed"]:
        return jsonify({
            "success": False,
            "error": "rate_limited",
            "message": "Too many requests. Try again later.",
            "remaining": result["remaining"],
        }), 429

    return jsonify({
        "success": False,
        "error": "invalid_credentials",
        "message": "Invalid username or password.",
        "remaining": result["remaining"],
    }), 401


@app.post("/api/set-algorithm")
def set_algorithm():
    global current_algorithm

    data = request.get_json(silent=True) or {}

    algorithm = data.get("algorithm")

    valid_algorithms = {
        "fixed",
        "sliding",
        "token",
    }

    if algorithm not in valid_algorithms:
        return jsonify({
            "error": "Invalid algorithm.",
            "valid": sorted(valid_algorithms),
        }), 400

    current_algorithm = algorithm

    # Switching algorithms starts with a clean slate.
    clear_rate_limit_keys()

    return jsonify({
        "algorithm": current_algorithm,
        "status": get_status(),
    })


@app.post("/api/burst")
def burst():
    """
    Fire multiple requests against the currently selected algorithm.

    Example:
        POST /api/burst?n=10
    """
    try:
        n = int(request.args.get("n", 10))
    except ValueError:
        n = 10

    n = max(1, min(n, 50))

    results = []

    for attempt in range(1, n + 1):
        results.append(
            make_attempt(attempt)
        )

        # Small delay makes the behavior easier to see
        # in the UI and during a tutorial recording.
        if attempt < n:
            time.sleep(0.05)

    allowed = sum(
        1 for result in results
        if result["allowed"]
    )

    blocked = n - allowed

    return jsonify({
        "algorithm": current_algorithm,
        "results": results,
        "allowed": allowed,
        "blocked": blocked,
    })


@app.post("/api/boundary-burst")
def boundary_burst():
    """
    Reliable fixed-window boundary demonstration.

    The server controls the timing so the browser clock cannot
    interfere with the demonstration.

    Sequence:
        1. Reset the limiter.
        2. Wait until the end of the current window.
        3. Send 5 requests just before the boundary.
        4. Wait for the next window.
        5. Send 5 requests in the new window.

    This demonstrates the classic fixed-window boundary problem:
    10 requests can be accepted within a very short period even
    though the configured limit is 5 requests per 10 seconds.
    """
    if current_algorithm != "fixed":
        return jsonify({
            "error": "Boundary burst is only available for Fixed Window."
        }), 400

    clear_rate_limit_keys()

    # Find the next window boundary.
    now = time.time()

    current_window = int(now // FIXED_WINDOW_SECONDS)

    boundary = (
        (current_window + 1)
        * FIXED_WINDOW_SECONDS
    )

    # Leave a tiny amount of time before the boundary.
    # This is deliberately controlled server-side.
    before_boundary = 0.05

    wait_time = boundary - time.time() - before_boundary

    if wait_time > 0:
        time.sleep(wait_time)

    # First burst: five requests at the end of the old window.
    first_results = []

    for attempt in range(1, FIXED_WINDOW_LIMIT + 1):
        first_results.append(
            make_attempt(attempt)
        )

    # Wait until we are definitely inside the next window.
    while time.time() < boundary + 0.05:
        time.sleep(0.005)

    # Second burst: five requests in the new window.
    second_results = []

    for index in range(1, FIXED_WINDOW_LIMIT + 1):
        second_results.append(
            make_attempt(
                FIXED_WINDOW_LIMIT + index
            )
        )

    results = first_results + second_results

    allowed = sum(
        1 for result in results
        if result["allowed"]
    )

    blocked = len(results) - allowed

    return jsonify({
        "algorithm": current_algorithm,
        "results": results,
        "allowed": allowed,
        "blocked": blocked,
        "boundary_demo": True,
    })


@app.post("/api/reset")
def reset():
    clear_rate_limit_keys()

    return jsonify({
        "success": True,
        "algorithm": current_algorithm,
        "status": get_status(),
    })


@app.get("/api/status")
def status():
    return jsonify(
        get_status()
    )


@app.get("/api/health")
def health():
    try:
        redis_client.ping()

        return jsonify({
            "status": "ok",
            "redis": "connected",
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
        return jsonify({
            "error": "Not found"
        }), 404

    return send_from_directory(
        app.static_folder,
        "index.html",
    )


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "error": "Internal server error"
    }), 500


# -----------------------------------------------------------------------------
# Start server
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    print(
        f"Redis Rate Limiter running on port {PORT}"
    )

    print(
        f"Redis: {REDIS_HOST}:{REDIS_PORT}"
    )

    print(
        f"Fixed Window: "
        f"{FIXED_WINDOW_LIMIT} requests / "
        f"{FIXED_WINDOW_SECONDS}s"
    )

    print(
        f"Sliding Window: "
        f"{SLIDING_WINDOW_LIMIT} requests / "
        f"rolling {SLIDING_WINDOW_SECONDS}s"
    )

    print(
        f"Token Bucket: "
        f"{TOKEN_BUCKET_CAPACITY} tokens, "
        f"1 token / {TOKEN_BUCKET_REFILL_SECONDS}s"
    )

    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=True,
        threaded=True,
    )